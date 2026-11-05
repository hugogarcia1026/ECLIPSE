export class CollisionSystem {
  constructor(obstaculos = []) {
    this.obstaculos = Array.isArray(obstaculos) ? obstaculos : [];
    this.limite = 295;
    this.alturaMaximaDegrau = 0.95;
  }

  deslocar(root, deslocamento, raio = 0.55) {
    root.position.addInPlace(deslocamento);

    this.resolver(root.position, raio);

    root.position.x = Math.max(
      -this.limite,
      Math.min(this.limite, root.position.x)
    );

    root.position.z = Math.max(
      -this.limite,
      Math.min(this.limite, root.position.z)
    );
  }

  resolver(posicao, raio = 0.55) {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      for (const obstaculo of this.obstaculos) {
        if (!obstaculo) continue;

        if (obstaculo.tipo === "retangulo") {
          this._resolverRetangulo(posicao, obstaculo, raio);
        } else if (obstaculo.tipo === "capsula") {
          this._resolverCapsula(posicao, obstaculo, raio);
        } else {
          this._resolverCirculo(posicao, obstaculo, raio);
        }
      }
    }
  }

  _resolverCirculo(posicao, obstaculo, raio) {
    const dx = posicao.x - obstaculo.x;
    const dz = posicao.z - obstaculo.z;

    const distancia = Math.sqrt(dx * dx + dz * dz);
    const distanciaMinima = raio + (obstaculo.raio ?? 1);

    if (distancia >= distanciaMinima) return;

    let nx = 1;
    let nz = 0;

    if (distancia > 0.0001) {
      nx = dx / distancia;
      nz = dz / distancia;
    }

    const penetracao = distanciaMinima - distancia;

    posicao.x += nx * penetracao;
    posicao.z += nz * penetracao;
  }

  _resolverCapsula(posicao, obstaculo, raio) {
    const ax = obstaculo.x1;
    const az = obstaculo.z1;
    const bx = obstaculo.x2;
    const bz = obstaculo.z2;

    const abx = bx - ax;
    const abz = bz - az;

    const comprimentoQuadrado = abx * abx + abz * abz;

    let t = 0;

    if (comprimentoQuadrado > 0.0001) {
      t =
        ((posicao.x - ax) * abx + (posicao.z - az) * abz) /
        comprimentoQuadrado;

      t = Math.max(0, Math.min(1, t));
    }

    const pontoX = ax + abx * t;
    const pontoZ = az + abz * t;

    const dx = posicao.x - pontoX;
    const dz = posicao.z - pontoZ;

    const distancia = Math.sqrt(dx * dx + dz * dz);
    const distanciaMinima = raio + (obstaculo.raio ?? 1);

    if (distancia >= distanciaMinima) return;

    let nx = 1;
    let nz = 0;

    if (distancia > 0.0001) {
      nx = dx / distancia;
      nz = dz / distancia;
    } else {
      const comprimento = Math.sqrt(abx * abx + abz * abz);

      if (comprimento > 0.0001) {
        nx = -abz / comprimento;
        nz = abx / comprimento;
      }
    }

    const penetracao = distanciaMinima - distancia;

    posicao.x += nx * penetracao;
    posicao.z += nz * penetracao;
  }

  /**
   * Indica se a superfície de um obstáculo com "topo" pode ser
   * pisada a partir da altura atual (degrau baixo o suficiente).
   */
  podeSubir(obstaculo, alturaAtual) {
    return (
      obstaculo.topo !== undefined &&
      obstaculo.topo <= alturaAtual + this.alturaMaximaDegrau
    );
  }

  _resolverRetangulo(posicao, obstaculo, raio) {
    // Plataforma baixa o suficiente funciona como piso (degrau),
    // não como parede. A verificação precisa vir ANTES do teste
    // de borda: antes, a borda empurrava o personagem para fora
    // e o centro dele nunca chegava a entrar na plataforma.
    if (this.podeSubir(obstaculo, posicao.y)) {
      return;
    }

    const metadeX = obstaculo.largura / 2;
    const metadeZ = obstaculo.profundidade / 2;

    const esquerda = obstaculo.x - metadeX;
    const direita = obstaculo.x + metadeX;
    const frente = obstaculo.z - metadeZ;
    const tras = obstaculo.z + metadeZ;

    const dentro =
      posicao.x > esquerda &&
      posicao.x < direita &&
      posicao.z > frente &&
      posicao.z < tras;

    const pontoX = Math.max(esquerda, Math.min(posicao.x, direita));
    const pontoZ = Math.max(frente, Math.min(posicao.z, tras));

    const dx = posicao.x - pontoX;
    const dz = posicao.z - pontoZ;

    const distancia = Math.sqrt(dx * dx + dz * dz);

    if (!dentro && distancia >= raio) return;

    if (dentro || distancia < 0.0001) {
      const distEsquerda = Math.abs(posicao.x - esquerda);
      const distDireita = Math.abs(direita - posicao.x);
      const distFrente = Math.abs(posicao.z - frente);
      const distTras = Math.abs(tras - posicao.z);

      const menor = Math.min(
        distEsquerda,
        distDireita,
        distFrente,
        distTras
      );

      if (menor === distEsquerda) {
        posicao.x = esquerda - raio;
      } else if (menor === distDireita) {
        posicao.x = direita + raio;
      } else if (menor === distFrente) {
        posicao.z = frente - raio;
      } else {
        posicao.z = tras + raio;
      }

      return;
    }

    const penetracao = raio - distancia;

    posicao.x += (dx / distancia) * penetracao;
    posicao.z += (dz / distancia) * penetracao;
  }
}
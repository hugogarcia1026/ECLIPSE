
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";

export class Colossus {
  constructor(
    scene,
    alturaEm,
    x = 0,
    z = 14,
    collisionSystem = null
  ) {
    this.scene = scene;
    this.alturaEm = alturaEm;
    this.collisionSystem = collisionSystem;

    this.raioColisao = 2.2;

    // Vida e fases.
    this.vidaMaxima = 1200;
    this.vida = this.vidaMaxima;
    this.fase = 1;

    // Inteligência.
    this.velocidade = 2.5;
    this.velocidadeFase2 = 4.2;
    this.danoAtaque = 12;
    this.danoFase2 = 20;

    this.raioPerseguicao = 32;
    this.distanciaAtaque = 9;

    // Controle de ataque.
    this.ataqueAtual = "nenhum";
    this.atacando = false;
    this.preparandoAtaque = false;
    this.recuperando = false;

    this.tempoAtaque = 0;
    this.intervaloAtaque = 2.8;
    this.tempoRecuperacao = 0;

    this.duracaoPreparacao = 1.1;
    this.duracaoExecucao = 0.65;
    this.duracaoRecuperacao = 1.3;

    // Despertar.
    this.desppertando = true;
    this.despertando = true;
    this.tempoDespertar = 0;
    this.duracaoDespertar = 2.5;

    // Movimento.
    this.velocidadeRotacao = 2.5;
    this.direcaoMovimento = Vector3.Zero();

    // Estado.
    this.derrotado = false;
    this.tempoAnimacao = 0;

    this._criarRaiz(x, z);
    this._criarMateriais();
    this._criarCorpo();
  }

  _criarRaiz(x, z) {
    this.root = new TransformNode(
      "AzhKhar_Root",
      this.scene
    );

    this.root.position.set(
      x,
      this.alturaEm(x, z),
      z
    );

    // Não nascer sobreposto a colunas/obstáculos: a posição
    // padrão (0, 14) fica encostada na coluna em (0, 13).
    if (this.collisionSystem) {
      this.collisionSystem.resolver(
        this.root.position,
        this.raioColisao
      );

      this.root.position.y = this.alturaEm(
        this.root.position.x,
        this.root.position.z
      );
    }

    this.root.scaling.setAll(2.5);
  }

  _criarMateriais() {
    this.materialCorpo = new StandardMaterial(
      "azhkhar_material_corpo",
      this.scene
    );

    this.materialCorpo.diffuseColor = new Color3(
      0.27, 0.25, 0.22
    );

    this.materialCorpo.specularColor = new Color3(
      0.12, 0.12, 0.12
    );

    this.materialPedra = new StandardMaterial(
      "azhkhar_material_pedra",
      this.scene
    );

    this.materialPedra.diffuseColor = new Color3(
      0.16, 0.17, 0.17
    );

    this.materialEnergia = new StandardMaterial(
      "azhkhar_material_energia",
      this.scene
    );

    this.materialEnergia.diffuseColor = new Color3(
      0.8, 0.12, 0.04
    );

    this.materialEnergia.emissiveColor = new Color3(
      0.55, 0.04, 0.01
    );

    this.materialOlhos = new StandardMaterial(
      "azhkhar_material_olhos",
      this.scene
    );

    this.materialOlhos.diffuseColor = new Color3(
      1, 0.12, 0.02
    );

    this.materialOlhos.emissiveColor = new Color3(
      0.9, 0.08, 0.01
    );
  }

  _criarPeca(nome, tamanho, posicao, material, tipo = "box") {
    let mesh;

    if (tipo === "sphere") {
      mesh = MeshBuilder.CreateSphere(
        nome,
        {
          diameter: 1,
          segments: 12
        },
        this.scene
      );

      mesh.scaling.set(
        tamanho.x,
        tamanho.y,
        tamanho.z
      );
    } else if (tipo === "cylinder") {
      mesh = MeshBuilder.CreateCylinder(
        nome,
        {
          height: tamanho.y,
          diameterTop: tamanho.x,
          diameterBottom: tamanho.x,
          tessellation: 10
        },
        this.scene
      );

      mesh.scaling.z = tamanho.z;
    } else {
      mesh = MeshBuilder.CreateBox(
        nome,
        {
          width: tamanho.x,
          height: tamanho.y,
          depth: tamanho.z
        },
        this.scene
      );
    }

    mesh.parent = this.root;
    mesh.position.copyFrom(posicao);
    mesh.material = material;
    mesh.isPickable = false;

    return mesh;
  }

  _criarCorpo() {
    // Pernas.
    this.pernaEsquerda = this._criarPeca(
      "AzhKhar_Perna_Esquerda",
      new Vector3(1.15, 3.2, 1.25),
      new Vector3(-0.9, 1.6, 0),
      this.materialPedra
    );

    this.pernaDireita = this._criarPeca(
      "AzhKhar_Perna_Direita",
      new Vector3(1.15, 3.2, 1.25),
      new Vector3(0.9, 1.6, 0),
      this.materialPedra
    );

    // Pés.
    this._criarPeca(
      "AzhKhar_Pe_Esquerdo",
      new Vector3(1.6, 0.65, 2),
      new Vector3(-0.9, 0.35, 0.25),
      this.materialCorpo
    );

    this._criarPeca(
      "AzhKhar_Pe_Direito",
      new Vector3(1.6, 0.65, 2),
      new Vector3(0.9, 0.35, 0.25),
      this.materialCorpo
    );

    // Tronco.
    this.tronco = this._criarPeca(
      "AzhKhar_Tronco",
      new Vector3(3.4, 3.6, 1.8),
      new Vector3(0, 4.8, 0),
      this.materialCorpo
    );

    // Peitoral.
    this._criarPeca(
      "AzhKhar_Peitoral",
      new Vector3(2.7, 2.2, 0.35),
      new Vector3(0, 5, -0.98),
      this.materialPedra
    );

    // Cabeça.
    this._criarPeca(
      "AzhKhar_Cabeca",
      new Vector3(1.7, 1.7, 1.5),
      new Vector3(0, 7.2, 0),
      this.materialPedra,
      "sphere"
    );

    // Olhos.
    this._criarPeca(
      "AzhKhar_Olho_Esquerdo",
      new Vector3(0.22, 0.22, 0.12),
      new Vector3(-0.38, 7.35, -0.72),
      this.materialOlhos,
      "sphere"
    );

    this._criarPeca(
      "AzhKhar_Olho_Direito",
      new Vector3(0.22, 0.22, 0.12),
      new Vector3(0.38, 7.35, -0.72),
      this.materialOlhos,
      "sphere"
    );

    // Ombros.
    this._criarPeca(
      "AzhKhar_Ombro_Esquerdo",
      new Vector3(1.8, 1.6, 1.8),
      new Vector3(-2.1, 5.9, 0),
      this.materialPedra,
      "sphere"
    );

    this._criarPeca(
      "AzhKhar_Ombro_Direito",
      new Vector3(1.8, 1.6, 1.8),
      new Vector3(2.1, 5.9, 0),
      this.materialPedra,
      "sphere"
    );

    // Braços.
    this.bracoEsquerdo = new TransformNode(
      "AzhKhar_Braco_Esquerdo",
      this.scene
    );

    this.bracoEsquerdo.parent = this.root;
    this.bracoEsquerdo.position.set(-2.1, 5.4, 0);

    this.bracoDireito = new TransformNode(
      "AzhKhar_Braco_Direito",
      this.scene
    );

    this.bracoDireito.parent = this.root;
    this.bracoDireito.position.set(2.1, 5.4, 0);

    this._criarBraco(this.bracoEsquerdo, "Esquerdo");
    this._criarBraco(this.bracoDireito, "Direito");

    // Marcas de energia.
    this.marcasEnergia = [];

    for (let i = 0; i < 3; i++) {
      const marca = MeshBuilder.CreateBox(
        `AzhKhar_Marca_Energia_${i}`,
        {
          width: 0.18,
          height: 1.1,
          depth: 0.08
        },
        this.scene
      );

      marca.parent = this.root;

      marca.position.set(
        (i - 1) * 0.65,
        5,
        -1.2
      );

      marca.rotation.z = i === 1 ? 0 : 0.25;
      marca.material = this.materialEnergia;
      marca.isPickable = false;

      this.marcasEnergia.push(marca);
    }
  }

  _criarBraco(pivo, lado) {
    const braco = MeshBuilder.CreateCylinder(
      `AzhKhar_Braco_${lado}`,
      {
        height: 2.8,
        diameterTop: 1.15,
        diameterBottom: 1.45,
        tessellation: 10
      },
      this.scene
    );

    braco.parent = pivo;
    braco.position.y = -1.35;
    braco.material = this.materialCorpo;
    braco.isPickable = false;

    const mao = MeshBuilder.CreateSphere(
      `AzhKhar_Mao_${lado}`,
      {
        diameter: 1.5,
        segments: 10
      },
      this.scene
    );

    mao.parent = pivo;
    mao.position.y = -2.8;
    mao.material = this.materialPedra;
    mao.isPickable = false;
  }

  _atualizarDespertar(delta) {
    if (!this.desppertando) return;

    this.tempoDespertar += delta;

    const progresso = Math.min(
      1,
      this.tempoDespertar / this.duracaoDespertar
    );

    this.root.rotation.x = (1 - progresso) * 0.08;

    if (progresso >= 1) {
      this.desppertando = false;
      this.despertando = false;
      this.root.rotation.x = 0;
    }
  }

  _ativarSegundaFase() {
    if (this.fase >= 2) return;

    this.fase = 2;

    this.velocidade = this.velocidadeFase2;
    this.danoAtaque = this.danoFase2;
    this.intervaloAtaque = 1.9;

    this.materialEnergia.emissiveColor = new Color3(
      1, 0.12, 0.01
    );

    this.marcasEnergia.forEach((marca) => {
      marca.scaling.y = 1.25;
    });
  }

  receberDano(dano) {
    if (this.derrotado || this.vida <= 0) return;

    const valor = Math.max(0, Number(dano) || 0);

    if (valor <= 0) return;

    this.vida = Math.max(
      0,
      this.vida - valor
    );

    if (
      this.vida <= this.vidaMaxima * 0.5 &&
      this.fase === 1
    ) {
      this._ativarSegundaFase();
    }

    if (this.vida <= 0) {
      this.derrotado = true;
      this.atacando = false;
      this.preparandoAtaque = false;
      this.recuperando = false;
      this.ataqueAtual = "derrotado";
    }
  }

  _perseguirJogador(delta, jogador) {
    if (!jogador?.root) return;

    const posJogador = jogador.root.position;
    const posicao = this.root.position;

    const direcao = new Vector3(
      posJogador.x - posicao.x,
      0,
      posJogador.z - posicao.z
    );

    const distancia = direcao.length();

    if (distancia <= 0.001) return;

    direcao.normalize();

    const anguloAlvo = Math.atan2(
      direcao.x,
      direcao.z
    );

    let diferenca = anguloAlvo - this.root.rotation.y;

    while (diferenca > Math.PI) {
      diferenca -= Math.PI * 2;
    }

    while (diferenca < -Math.PI) {
      diferenca += Math.PI * 2;
    }

    this.root.rotation.y +=
      Math.sign(diferenca) *
      Math.min(
        Math.abs(diferenca),
        this.velocidadeRotacao * delta
      );

    if (
      distancia > this.distanciaAtaque &&
      distancia < this.raioPerseguicao &&
      !this.atacando &&
      !this.preparandoAtaque &&
      !this.recuperando
    ) {
      const movimento = direcao.scale(
        this.velocidade * delta
      );

      if (this.collisionSystem) {
        this.collisionSystem.deslocar(
          this.root,
          movimento,
          this.raioColisao
        );
      } else {
        posicao.addInPlace(movimento);
      }
    }

    this.root.position.y = this.alturaEm(
      this.root.position.x,
      this.root.position.z
    );
  }

  _prepararAtaque() {
    if (this.atacando || this.preparandoAtaque) return;

    this.preparandoAtaque = true;
    this.atacando = false;
    this.ataqueAtual = "preparando";
    this.tempoAtaque = 0;

    this.bracoDireito.rotation.x = -0.9;
    this.bracoEsquerdo.rotation.x = -0.35;
  }

  _executarAtaque(delta, jogador) {
    if (!jogador?.root) return;

    this.tempoAtaque += delta;

    if (
      this.preparandoAtaque &&
      this.tempoAtaque >= this.duracaoPreparacao
    ) {
      this.preparandoAtaque = false;
      this.atacando = true;
      this.ataqueAtual = "golpe";
      this.tempoAtaque = 0;

      const distancia = Vector3.Distance(
        new Vector3(
          this.root.position.x,
          0,
          this.root.position.z
        ),
        new Vector3(
          jogador.root.position.x,
          0,
          jogador.root.position.z
        )
      );

      if (distancia <= this.distanciaAtaque + 1.5) {
        if (typeof jogador.receberDano === "function") {
          jogador.receberDano(this.danoAtaque);
        } else if (
          typeof jogador.vida === "number" &&
          (jogador.invulnerabilidade ?? 0) <= 0
        ) {
          jogador.vida = Math.max(
            0,
            jogador.vida - this.danoAtaque
          );

          jogador.invulnerabilidade = 0.8;
        }
      }
    }

    if (
      this.atacando &&
      this.tempoAtaque >= this.duracaoExecucao
    ) {
      this.atacando = false;
      this.recuperando = true;
      this.ataqueAtual = "recuperacao";
      this.tempoRecuperacao = this.duracaoRecuperacao;
      this.tempoAtaque = 0;
    }

    if (this.preparandoAtaque) {
      this.bracoDireito.rotation.x = -0.9;
    }

    if (this.atacando) {
      const progresso = Math.min(
        1,
        this.tempoAtaque / this.duracaoExecucao
      );

      this.bracoDireito.rotation.x =
        -0.9 + progresso * 1.8;
    }
  }

  _atualizarRecuperacao(delta) {
    if (!this.recuperando) return;

    this.tempoRecuperacao -= delta;

    const progresso = Math.max(
      0,
      this.tempoRecuperacao / this.duracaoRecuperacao
    );

    this.bracoDireito.rotation.x = -0.9 * progresso;

    if (this.tempoRecuperacao <= 0) {
      this.recuperando = false;
      this.ataqueAtual = "nenhum";
      this.tempoAtaque = 0;

      this.bracoDireito.rotation.x = 0;
      this.bracoEsquerdo.rotation.x = 0;

      this.intervaloAtaque =
        this.fase === 2 ? 1.9 : 2.8;
    }
  }

  atualizar(delta, jogador) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    if (this.derrotado) return;

    this._atualizarDespertar(delta);

    if (this.desppertando) return;

    if (this.recuperando) {
      this._atualizarRecuperacao(delta);
      return;
    }

    if (this.preparandoAtaque || this.atacando) {
      this._executarAtaque(delta, jogador);
      return;
    }

    this.tempoAnimacao += delta;
    this.tempoAtaque += delta;

    this._perseguirJogador(delta, jogador);

    if (!jogador?.root) return;

    const distancia = Vector3.Distance(
      new Vector3(
        this.root.position.x,
        0,
        this.root.position.z
      ),
      new Vector3(
        jogador.root.position.x,
        0,
        jogador.root.position.z
      )
    );

    if (
      distancia <= this.distanciaAtaque &&
      this.tempoAtaque >= this.intervaloAtaque
    ) {
      this._prepararAtaque();
    }
  }

  dispose() {
    if (this.root) {
      this.root.dispose(false, true);
    }

    this.materialCorpo?.dispose();
    this.materialPedra?.dispose();
    this.materialEnergia?.dispose();
    this.materialOlhos?.dispose();
  }
}

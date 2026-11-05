
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";

export class Player {
  constructor(scene, alturaEm, collisionSystem = null) {
    this.scene = scene;
    this.alturaEm = alturaEm;
    this.collisionSystem = collisionSystem;

    this.raioColisao = 0.5;

    this.velocidade = 10;
    this.velocidadeCorrida = 14;
    this.velocidadeVertical = 0;
    this.forcaPulo = 8;
    this.gravidade = 22;

    // Desníveis pequenos (rampas do terreno) são acompanhados
    // sem "voar"; desníveis maiores (degraus, barrancos) viram queda.
    this.alturaColarChao = 0.4;

    this.teclas = {};
    this.noChao = true;

    this.vidaMaxima = 150;
    this.vida = this.vidaMaxima;
    this.invulnerabilidade = 0;

    this.tempoAnimacao = 0;
    this.intensidadeAnimacao = 0;

    this.atacando = false;
    this.tempoAtaque = 0;
    this.duracaoAnimacaoAtaque = 0.42;
    this.anguloAtaqueBraco = 0;
    this.anguloAtaqueTronco = 0;

    this.root = new TransformNode("jogador", scene);

    this.root.position = new Vector3(
      0,
      alturaEm(0, 0),
      0
    );

    // Não nascer dentro de um obstáculo (ex.: orbe central).
    if (this.collisionSystem) {
      this.collisionSystem.resolver(
        this.root.position,
        this.raioColisao
      );

      this.root.position.y = alturaEm(
        this.root.position.x,
        this.root.position.z
      );
    }

    this._criarMateriais();
    this._criarModelo();
    this._configurarControles();
  }

  _criarMateriais() {
    this.materialCorpo = new StandardMaterial(
      "materialCorpo",
      this.scene
    );

    this.materialCorpo.diffuseColor = new Color3(
      0.12, 0.16, 0.22
    );

    this.materialArmadura = new StandardMaterial(
      "materialArmadura",
      this.scene
    );

    this.materialArmadura.diffuseColor = new Color3(
      0.35, 0.38, 0.43
    );

    this.materialDetalhe = new StandardMaterial(
      "materialDetalhe",
      this.scene
    );

    this.materialDetalhe.diffuseColor = new Color3(
      0.75, 0.38, 0.12
    );

    this.materialPele = new StandardMaterial(
      "materialPele",
      this.scene
    );

    this.materialPele.diffuseColor = new Color3(
      0.65, 0.48, 0.36
    );
  }

  _criarModelo() {
    const esfera = (
      nome,
      diametro,
      x,
      y,
      z,
      material
    ) => {
      const mesh = MeshBuilder.CreateSphere(
        nome,
        {
          diameter: diametro,
          segments: 16
        },
        this.scene
      );

      mesh.position.set(x, y, z);
      mesh.material = material;
      mesh.parent = this.root;

      return mesh;
    };

    const cilindro = (
      nome,
      altura,
      diametro,
      x,
      y,
      z,
      material
    ) => {
      const mesh = MeshBuilder.CreateCylinder(
        nome,
        {
          height: altura,
          diameter: diametro,
          tessellation: 12
        },
        this.scene
      );

      mesh.position.set(x, y, z);
      mesh.material = material;
      mesh.parent = this.root;

      return mesh;
    };

    this.corpo = cilindro(
      "corpoJogador",
      1.15,
      0.65,
      0,
      1.15,
      0,
      this.materialCorpo
    );

    const peito = MeshBuilder.CreateBox(
      "armaduraPeito",
      {
        width: 0.58,
        height: 0.55,
        depth: 0.18
      },
      this.scene
    );

    peito.position.set(0, 1.35, 0.3);
    peito.material = this.materialArmadura;
    peito.parent = this.root;

    this.cabeca = esfera(
      "cabecaJogador",
      0.48,
      0,
      2,
      0,
      this.materialPele
    );

    esfera(
      "ombroEsquerdo",
      0.34,
      -0.48,
      1.55,
      0,
      this.materialArmadura
    );

    esfera(
      "ombroDireito",
      0.34,
      0.48,
      1.55,
      0,
      this.materialArmadura
    );

    this.pivoBracoEsquerdo = new TransformNode(
      "pivoBracoEsquerdo",
      this.scene
    );

    this.pivoBracoEsquerdo.parent = this.root;
    this.pivoBracoEsquerdo.position.set(-0.52, 1.55, 0);

    this.pivoBracoDireito = new TransformNode(
      "pivoBracoDireito",
      this.scene
    );

    this.pivoBracoDireito.parent = this.root;
    this.pivoBracoDireito.position.set(0.52, 1.55, 0);

    this.bracoEsquerdo = MeshBuilder.CreateCylinder(
      "bracoEsquerdo",
      {
        height: 0.85,
        diameter: 0.23,
        tessellation: 12
      },
      this.scene
    );

    this.bracoEsquerdo.position.y = -0.425;
    this.bracoEsquerdo.material = this.materialCorpo;
    this.bracoEsquerdo.parent = this.pivoBracoEsquerdo;

    this.bracoDireito = MeshBuilder.CreateCylinder(
      "bracoDireito",
      {
        height: 0.85,
        diameter: 0.23,
        tessellation: 12
      },
      this.scene
    );

    this.bracoDireito.position.y = -0.425;
    this.bracoDireito.material = this.materialCorpo;
    this.bracoDireito.parent = this.pivoBracoDireito;

    this.maoEsquerda = new TransformNode(
      "maoEsquerda",
      this.scene
    );

    this.maoEsquerda.parent = this.pivoBracoEsquerdo;
    this.maoEsquerda.position.set(0, -0.85, 0);

    this.maoDireita = new TransformNode(
      "maoDireita",
      this.scene
    );

    this.maoDireita.parent = this.pivoBracoDireito;
    this.maoDireita.position.set(0, -0.85, 0);

    this.pernaEsquerda = cilindro(
      "pernaEsquerda",
      0.85,
      0.29,
      -0.2,
      0.42,
      0,
      this.materialCorpo
    );

    this.pernaDireita = cilindro(
      "pernaDireita",
      0.85,
      0.29,
      0.2,
      0.42,
      0,
      this.materialCorpo
    );

    const simbolo = MeshBuilder.CreateBox(
      "simboloArmadura",
      {
        width: 0.13,
        height: 0.28,
        depth: 0.04
      },
      this.scene
    );

    simbolo.position.set(0, 1.38, 0.405);
    simbolo.material = this.materialDetalhe;
    simbolo.parent = this.root;
  }

  _configurarControles() {
    if (typeof window === "undefined") return;

    this._aoPressionar = (evento) => {
      const tecla = evento.key.toLowerCase();

      if (
        ["w", "a", "s", "d", "shift", " "].includes(tecla)
      ) {
        evento.preventDefault();
      }

      this.teclas[tecla] = true;
    };

    this._aoSoltar = (evento) => {
      this.teclas[evento.key.toLowerCase()] = false;
    };

    this._aoPerderFoco = () => {
      this.teclas = {};
    };

    window.addEventListener(
      "keydown",
      this._aoPressionar
    );

    window.addEventListener(
      "keyup",
      this._aoSoltar
    );

    window.addEventListener(
      "blur",
      this._aoPerderFoco
    );
  }

  iniciarAtaque() {
    if (this.vida <= 0 || this.atacando) return false;

    this.atacando = true;
    this.tempoAtaque = 0;

    return true;
  }

  _atualizarAnimacaoAtaque(delta) {
    if (!this.atacando) {
      this.anguloAtaqueBraco = 0;
      this.anguloAtaqueTronco = 0;
      return;
    }

    this.tempoAtaque += delta;

    const progresso = Math.min(
      1,
      this.tempoAtaque / this.duracaoAnimacaoAtaque
    );

    if (progresso < 0.3) {
      const t = progresso / 0.3;
      const suavizado = t * t * (3 - 2 * t);

      this.anguloAtaqueBraco = -0.9 * suavizado;
      this.anguloAtaqueTronco = -0.12 * suavizado;
    } else if (progresso < 0.58) {
      const t = (progresso - 0.3) / 0.28;
      const suavizado = t * t * (3 - 2 * t);

      this.anguloAtaqueBraco = -0.9 + 2.35 * suavizado;
      this.anguloAtaqueTronco = -0.12 + 0.2 * suavizado;
    } else {
      const t = (progresso - 0.58) / 0.42;
      const suavizado = t * t * (3 - 2 * t);

      this.anguloAtaqueBraco = 1.45 * (1 - suavizado);
      this.anguloAtaqueTronco = 0.08 * (1 - suavizado);
    }

    if (progresso >= 1) {
      this.atacando = false;
      this.tempoAtaque = 0;
      this.anguloAtaqueBraco = 0;
      this.anguloAtaqueTronco = 0;
    }
  }

  _animar(delta, correndo) {
    const movendo =
      this.teclas["w"] ||
      this.teclas["a"] ||
      this.teclas["s"] ||
      this.teclas["d"];

    const intensidadeAlvo = movendo ? 1 : 0;

    this.intensidadeAnimacao +=
      (intensidadeAlvo - this.intensidadeAnimacao) *
      Math.min(1, delta * 8);

    const intensidade = this.intensidadeAnimacao;

    const velocidadeAnimacao = correndo ? 13 : 8;

    this.tempoAnimacao += delta * velocidadeAnimacao;

    const movimento = Math.sin(this.tempoAnimacao);
    const oscilacao = movimento * intensidade;

    const intensidadeCorrida = correndo ? 1.4 : 1;

    this.pernaEsquerda.rotation.x =
      oscilacao * 0.65 * intensidadeCorrida;

    this.pernaDireita.rotation.x =
      -oscilacao * 0.65 * intensidadeCorrida;

    this.pivoBracoEsquerdo.rotation.x =
      -oscilacao * 0.55 * intensidadeCorrida;

    const movimentoBracoDireito =
      oscilacao * 0.55 * intensidadeCorrida;

    this.pivoBracoDireito.rotation.x =
      movimentoBracoDireito + this.anguloAtaqueBraco;

    this.corpo.rotation.x = this.anguloAtaqueTronco;

    this.corpo.position.y =
      1.15 + Math.abs(movimento) * 0.06 * intensidade;

    this.cabeca.rotation.x =
      Math.sin(this.tempoAnimacao * 0.5) *
      0.025 *
      intensidade;
  }

  atualizar(delta, anguloCamera) {
    const frente = new Vector3(
      -Math.cos(anguloCamera),
      0,
      -Math.sin(anguloCamera)
    );

    const direita = new Vector3(
      frente.z,
      0,
      -frente.x
    );

    const direcao = Vector3.Zero();

    if (this.teclas["w"]) direcao.addInPlace(frente);
    if (this.teclas["s"]) direcao.subtractInPlace(frente);
    if (this.teclas["d"]) direcao.addInPlace(direita);
    if (this.teclas["a"]) direcao.subtractInPlace(direita);

    const movendo = direcao.lengthSquared() > 0;
    const correndo = !!this.teclas["shift"] && movendo;

    if (movendo) {
      direcao.normalize();

      const velocidade = correndo
        ? this.velocidadeCorrida
        : this.velocidade;

      const deslocamento = direcao.scale(
        velocidade * delta
      );

      if (this.collisionSystem) {
        this.collisionSystem.deslocar(
          this.root,
          deslocamento,
          this.raioColisao
        );
      } else {
        this.root.position.addInPlace(deslocamento);
      }

      this.root.rotation.y = Math.atan2(
        direcao.x,
        direcao.z
      );
    }

    this.root.position.x = Math.max(
      -295,
      Math.min(295, this.root.position.x)
    );

    this.root.position.z = Math.max(
      -295,
      Math.min(295, this.root.position.z)
    );

    // Pulo.
    if (this.teclas[" "] && this.noChao) {
      this.velocidadeVertical = this.forcaPulo;
      this.noChao = false;
    }

    this.root.position.y +=
      this.velocidadeVertical * delta;

    this.velocidadeVertical -=
      this.gravidade * delta;

    const alturaChao = this.alturaEm(
      this.root.position.x,
      this.root.position.z
    );

    const acimaDoChao = this.root.position.y - alturaChao;

    if (acimaDoChao <= 0) {
      // Pousou, ou subiu um degrau liberado pela colisão.
      this.root.position.y = alturaChao;
      this.velocidadeVertical = 0;
      this.noChao = true;
    } else if (
      this.noChao &&
      this.velocidadeVertical <= 0 &&
      acimaDoChao <= this.alturaColarChao
    ) {
      // Descendo uma rampa: continua colado ao chão.
      this.root.position.y = alturaChao;
      this.velocidadeVertical = 0;
    } else {
      // Saiu de um degrau ou barranco: está caindo.
      // Impede pular no ar ao descer as plataformas.
      this.noChao = false;
    }

    this._atualizarAnimacaoAtaque(delta);
    this._animar(delta, correndo);

    this.invulnerabilidade = Math.max(
      0,
      this.invulnerabilidade - delta
    );
  }

  receberDano(quantidade) {
    if (this.vida <= 0 || this.invulnerabilidade > 0) {
      return;
    }

    this.vida = Math.max(
      0,
      this.vida - quantidade
    );

    this.invulnerabilidade = 0.8;
  }

  dispose() {
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "keydown",
        this._aoPressionar
      );

      window.removeEventListener(
        "keyup",
        this._aoSoltar
      );

      window.removeEventListener(
        "blur",
        this._aoPerderFoco
      );
    }

    this.root.dispose(false, true);

    this.materialCorpo.dispose();
    this.materialArmadura.dispose();
    this.materialDetalhe.dispose();
    this.materialPele.dispose();
  }
}

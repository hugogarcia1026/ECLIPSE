import "@babylonjs/core/Meshes/Builders/capsuleBuilder.js";
import "@babylonjs/core/Meshes/Builders/torusBuilder.js";

import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { Constants } from "@babylonjs/core/Engines/constants.js";

import { criarMaterial } from "./Materiais.js";

const suave = (t) => t * t * (3 - 2 * t);
const aproximar = (atual, alvo, taxa, delta) =>
  atual + (alvo - atual) * Math.min(1, taxa * delta);

function anguloMaisProximo(atual, alvo) {
  let d = alvo - atual;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Comprimento aproximado de cada arma (ponta do rastro do golpe).
const PONTA_ARMA = {
  Espada: 1.45,
  Machado: 1.1,
  "Lança": 2.2
};

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

    // Estado da animação procedural.
    this.tempoAnimacao = 0;
    this.intensidadeAnimacao = 0;
    this.fatorCorrida = 0;
    this.fatorAr = 0;
    this.fatorEsquiva = 0;
    this.esquivando = false;
    this.tempoTotal = 0;
    this.tempoDano = 0;
    this.tempoDerrota = 0;
    this.velocidadeHorizontal = 0;
    this.velocidadeGiro = 0;
    this._rotacaoAlvo = 0;
    this._ultimaPosicao = null;

    this.atacando = false;
    this.tempoAtaque = 0;
    this.duracaoAnimacaoAtaque = 0.42;
    this.anguloAtaqueBraco = 0;
    this.anguloAtaqueTronco = 0;
    this.anguloAtaqueCotovelo = 0;
    this.giroAtaque = 0;
    this.lateralAtaque = 0;

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
    this._criarCapa();
    this._criarRastro();
    this._configurarControles();

    this.malhas = this.root.getChildMeshes(false).filter((m) => m !== this.rastro);
  }

  // ------------------------------------------------------------
  // MATERIAIS
  // ------------------------------------------------------------

  _criarMateriais() {
    const s = this.scene;

    this.materialArmadura = criarMaterial(s, "jogadorAco", {
      cor: [0.58, 0.59, 0.62],
      metal: 1,
      rugosidade: 0.42,
      normal: "metal",
      escala: 2,
      nivelNormal: 0.35
    });

    this.materialAcoEscuro = criarMaterial(s, "jogadorAcoEscuro", {
      cor: [0.2, 0.21, 0.24],
      metal: 0.9,
      rugosidade: 0.42,
      normal: "metal",
      escala: 2,
      nivelNormal: 0.4
    });

    this.materialDetalhe = criarMaterial(s, "jogadorOuro", {
      cor: [0.96, 0.74, 0.4],
      metal: 1,
      rugosidade: 0.26
    });

    this.materialCouro = criarMaterial(s, "jogadorCouro", {
      cor: [0.3, 0.19, 0.12],
      rugosidade: 0.6,
      normal: "terreno",
      escala: 3,
      nivelNormal: 0.45
    });

    this.materialCorpo = criarMaterial(s, "jogadorTecidoEscuro", {
      cor: [0.14, 0.13, 0.17],
      rugosidade: 0.88,
      normal: "tecido",
      escala: 3,
      nivelNormal: 0.6
    });

    this.materialTecido = criarMaterial(s, "jogadorTecido", {
      cor: [0.5, 0.07, 0.08],
      rugosidade: 0.85,
      normal: "tecido",
      escala: 3,
      nivelNormal: 0.7,
      duplaFace: true
    });
    this.materialTecido.sheen.isEnabled = true;
    this.materialTecido.sheen.intensity = 0.6;
    this.materialTecido.sheen.color = new Color3(1, 0.45, 0.4);

    // Fresta do visor: brilho âmbar.
    this.materialPele = new StandardMaterial("jogadorVisor", s);
    this.materialPele.disableLighting = true;
    this.materialPele.emissiveColor = new Color3(1.7, 0.75, 0.22);
    this.materialPele.diffuseColor = Color3.Black();
  }

  // ------------------------------------------------------------
  // MODELO
  // ------------------------------------------------------------

  _parte(nome, tipo, opcoes, pai, posicao, material, escala = null, rotacao = null) {
    let mesh;
    const s = this.scene;
    if (tipo === "esfera") {
      mesh = MeshBuilder.CreateSphere(nome, { diameter: 1, segments: opcoes.segmentos ?? 20 }, s);
    } else if (tipo === "capsula") {
      mesh = MeshBuilder.CreateCapsule(
        nome,
        { radius: opcoes.raio, height: opcoes.altura, tessellation: 16, subdivisions: 2, capSubdivisions: 6 },
        s
      );
    } else if (tipo === "cilindro") {
      mesh = MeshBuilder.CreateCylinder(
        nome,
        {
          height: opcoes.altura,
          diameterTop: opcoes.topo ?? opcoes.diametro,
          diameterBottom: opcoes.base ?? opcoes.diametro,
          tessellation: opcoes.lados ?? 20
        },
        s
      );
    } else if (tipo === "toro") {
      mesh = MeshBuilder.CreateTorus(
        nome,
        { diameter: opcoes.diametro, thickness: opcoes.espessura, tessellation: 32 },
        s
      );
    } else {
      mesh = MeshBuilder.CreateBox(
        nome,
        { width: opcoes.largura, height: opcoes.altura, depth: opcoes.profundidade },
        s
      );
    }
    mesh.parent = pai;
    mesh.position.copyFrom(posicao);
    if (escala) mesh.scaling.copyFrom(escala);
    if (rotacao) mesh.rotation.copyFrom(rotacao);
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  }

  _no(nome, pai, x, y, z) {
    const no = new TransformNode(nome, this.scene);
    no.parent = pai;
    no.position.set(x, y, z);
    return no;
  }

  _criarModelo() {
    const V = (x, y, z) => new Vector3(x, y, z);
    const aco = this.materialArmadura;
    const acoEscuro = this.materialAcoEscuro;
    const ouro = this.materialDetalhe;
    const couro = this.materialCouro;
    const roupa = this.materialCorpo;
    const tecido = this.materialTecido;

    // Nó do modelo inteiro (inclinações de esquiva e queda).
    this.modelo = this._no("modeloJogador", this.root, 0, 0, 0);

    // ---------------- Quadril ----------------
    this.quadril = this._no("quadrilJogador", this.modelo, 0, 0.98, 0);
    this._parte("pelvisJogador", "esfera", {}, this.quadril, V(0, 0, 0), roupa, V(0.4, 0.26, 0.27));
    this._parte("cintoJogador", "cilindro", { altura: 0.09, diametro: 0.45 }, this.quadril, V(0, 0.08, 0), couro, V(1, 1, 0.7));
    this._parte("fivelaJogador", "caixa", { largura: 0.1, altura: 0.08, profundidade: 0.03 }, this.quadril, V(0, 0.08, 0.16), ouro);

    // Saiote do tabardo (frente e trás), balança com as pernas.
    this.saioteFrente = this._no("saioteFrente", this.quadril, 0, 0.05, 0.15);
    this._parte("tabardoFrente", "caixa", { largura: 0.3, altura: 0.5, profundidade: 0.02 }, this.saioteFrente, V(0, -0.25, 0), tecido);
    this._parte("barraTabardo", "caixa", { largura: 0.31, altura: 0.04, profundidade: 0.025 }, this.saioteFrente, V(0, -0.49, 0), ouro);
    this.saioteTras = this._no("saioteTras", this.quadril, 0, 0.05, -0.15);
    this._parte("tabardoTras", "caixa", { largura: 0.34, altura: 0.48, profundidade: 0.02 }, this.saioteTras, V(0, -0.24, 0), tecido);

    // ---------------- Pernas ----------------
    const criarPerna = (lado, x) => {
      const quadrilPerna = this._no(`pivoPerna${lado}`, this.quadril, x, -0.06, 0);
      this._parte(`coxa${lado}`, "capsula", { raio: 0.1, altura: 0.52 }, quadrilPerna, V(0, -0.23, 0), roupa);
      this._parte(`coxote${lado}`, "esfera", {}, quadrilPerna, V(0, -0.2, 0.04), acoEscuro, V(0.2, 0.34, 0.16));
      const joelho = this._no(`joelho${lado}`, quadrilPerna, 0, -0.47, 0);
      this._parte(`joelheira${lado}`, "esfera", {}, joelho, V(0, 0, 0.06), aco, V(0.14, 0.14, 0.12));
      this._parte(`canela${lado}`, "capsula", { raio: 0.09, altura: 0.46 }, joelho, V(0, -0.21, 0.01), aco);
      this._parte(`bota${lado}`, "esfera", {}, joelho, V(0, -0.4, 0.05), couro, V(0.15, 0.13, 0.3));
      this._parte(`solado${lado}`, "caixa", { largura: 0.13, altura: 0.03, profundidade: 0.28 }, joelho, V(0, -0.455, 0.05), acoEscuro);
      return { quadrilPerna, joelho };
    };
    const pe = criarPerna("Esquerda", -0.13);
    const pd = criarPerna("Direita", 0.13);
    this.pernaEsquerda = pe.quadrilPerna;
    this.joelhoEsquerdo = pe.joelho;
    this.pernaDireita = pd.quadrilPerna;
    this.joelhoDireito = pd.joelho;

    // ---------------- Tronco ----------------
    this.corpo = this._no("troncoJogador", this.quadril, 0, 0.1, 0);
    this._parte("torsoJogador", "capsula", { raio: 0.2, altura: 0.66 }, this.corpo, V(0, 0.28, 0), roupa, V(1.3, 1, 0.82));
    this._parte("peitoralJogador", "esfera", { segmentos: 28 }, this.corpo, V(0, 0.36, 0.035), aco, V(0.5, 0.5, 0.36));
    this._parte("costasArmadura", "esfera", {}, this.corpo, V(0, 0.38, -0.05), acoEscuro, V(0.46, 0.44, 0.3));
    this._parte("abdomeArmadura", "cilindro", { altura: 0.16, topo: 0.42, base: 0.38 }, this.corpo, V(0, 0.08, 0.01), acoEscuro, V(1, 1, 0.75));

    // Emblema do eclipse no peito: anel dourado + disco escuro.
    this._parte("emblemaAnel", "toro", { diametro: 0.15, espessura: 0.022 }, this.corpo, V(0, 0.4, 0.2), ouro, null, V(Math.PI / 2 - 0.25, 0, 0));
    this._parte("emblemaDisco", "cilindro", { altura: 0.01, diametro: 0.11 }, this.corpo, V(0.012, 0.402, 0.205), acoEscuro, null, V(Math.PI / 2 - 0.25, 0, 0));

    this._parte("gorjalJogador", "cilindro", { altura: 0.12, topo: 0.22, base: 0.3 }, this.corpo, V(0, 0.63, 0), aco);

    // Ombreiras em camadas.
    for (const [lado, x] of [["Esquerda", -1], ["Direita", 1]]) {
      this._parte(`ombreira${lado}`, "esfera", {}, this.corpo, V(0.31 * x, 0.57, 0), aco, V(0.27, 0.17, 0.27), V(0, 0, -0.35 * x));
      this._parte(`ombreira2${lado}`, "esfera", {}, this.corpo, V(0.35 * x, 0.49, 0), acoEscuro, V(0.25, 0.12, 0.25), V(0, 0, -0.5 * x));
      this._parte(`bordaOmbreira${lado}`, "toro", { diametro: 0.25, espessura: 0.02 }, this.corpo, V(0.33 * x, 0.53, 0), ouro, V(1, 1, 1), V(0, 0, -0.4 * x));
    }

    // ---------------- Cabeça (elmo) ----------------
    this.cabeca = this._no("cabecaJogador", this.corpo, 0, 0.68, 0);
    this._parte("elmoJogador", "esfera", { segmentos: 28 }, this.cabeca, V(0, 0.17, 0), aco, V(0.36, 0.4, 0.38));
    this._parte("mascaraElmo", "esfera", {}, this.cabeca, V(0, 0.11, 0.07), acoEscuro, V(0.3, 0.26, 0.3));
    this._parte("viseiraJogador", "caixa", { largura: 0.19, altura: 0.02, profundidade: 0.05 }, this.cabeca, V(0, 0.175, 0.165), this.materialPele);
    this._parte("cristaElmo", "caixa", { largura: 0.035, altura: 0.1, profundidade: 0.34 }, this.cabeca, V(0, 0.37, -0.01), ouro);
    this._parte("aroElmo", "toro", { diametro: 0.37, espessura: 0.025 }, this.cabeca, V(0, 0.2, 0), ouro, V(1, 1, 1.04));
    this._parte("plumaElmo", "esfera", {}, this.cabeca, V(0, 0.34, -0.2), tecido, V(0.06, 0.1, 0.3), V(-0.5, 0, 0));

    // ---------------- Braços ----------------
    const criarBraco = (lado, x) => {
      const ombro = this._no(`pivoBraco${lado}`, this.corpo, 0.33 * x, 0.52, 0);
      this._parte(`braco${lado}`, "capsula", { raio: 0.075, altura: 0.38 }, ombro, V(0, -0.16, 0), roupa);
      this._parte(`braçadeira${lado}`, "cilindro", { altura: 0.14, topo: 0.17, base: 0.15 }, ombro, V(0, -0.12, 0), aco);
      const cotovelo = this._no(`cotovelo${lado}`, ombro, 0, -0.33, 0);
      this._parte(`cotoveleira${lado}`, "esfera", {}, cotovelo, V(0, 0, -0.03), aco, V(0.13, 0.13, 0.13));
      this._parte(`antebraco${lado}`, "capsula", { raio: 0.068, altura: 0.32 }, cotovelo, V(0, -0.15, 0), couro);
      this._parte(`manopla${lado}`, "cilindro", { altura: 0.17, topo: 0.15, base: 0.18 }, cotovelo, V(0, -0.22, 0), aco);
      const mao = this._no(`mao${lado}`, cotovelo, 0, -0.36, 0);
      this._parte(`punho${lado}`, "esfera", {}, mao, V(0, 0.02, 0.01), acoEscuro, V(0.1, 0.11, 0.11));
      return { ombro, cotovelo, mao };
    };
    const be = criarBraco("Esquerdo", -1);
    const bd = criarBraco("Direito", 1);
    this.pivoBracoEsquerdo = be.ombro;
    this.cotoveloEsquerdo = be.cotovelo;
    this.maoEsquerda = be.mao;
    this.pivoBracoDireito = bd.ombro;
    this.cotoveloDireito = bd.cotovelo;
    this.maoDireita = bd.mao;

    // A arma (criada pelo WeaponSystem) pende no eixo -Y da mão;
    // girando a mão, ela fica apontada para a frente, em guarda média.
    this.maoDireita.rotation.x = -1.0;
  }

  // ------------------------------------------------------------
  // CAPA (malha de pano animada por vértice)
  // ------------------------------------------------------------

  _criarCapa() {
    this.capaColunas = 7;
    this.capaLinhas = 10;
    this.capaComprimento = 1.08;

    const posicoes = [];
    const indices = [];
    const uvs = [];
    for (let r = 0; r < this.capaLinhas; r++) {
      for (let c = 0; c < this.capaColunas; c++) {
        posicoes.push(0, 0, 0);
        uvs.push(c / (this.capaColunas - 1), r / (this.capaLinhas - 1));
        if (r < this.capaLinhas - 1 && c < this.capaColunas - 1) {
          const a = r * this.capaColunas + c;
          const b = a + this.capaColunas;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }

    this.capa = new Mesh("capaJogador", this.scene);
    const dados = new VertexData();
    dados.positions = posicoes;
    dados.indices = indices;
    dados.uvs = uvs;
    dados.normals = posicoes.slice();
    dados.applyToMesh(this.capa, true);

    this.capa.parent = this.corpo;
    this.capa.position.set(0, 0.6, -0.15);
    this.capa.material = this.materialTecido;
    this.capa.isPickable = false;
    this.capa.alwaysSelectAsActiveMesh = true;

    this._posCapa = new Float32Array(posicoes.length);
    this._normCapa = new Float32Array(posicoes.length);
    this._indicesCapa = indices;
    this._atualizarCapa(0);
  }

  _atualizarCapa(delta) {
    const C = this.capaColunas;
    const R = this.capaLinhas;
    const seg = this.capaComprimento / (R - 1);
    const t = this.tempoTotal;

    const vel = Math.min(1, this.velocidadeHorizontal / this.velocidadeCorrida);
    const ar = this.fatorAr;
    const giro = Math.max(-1, Math.min(1, this.velocidadeGiro * 0.15));
    this._levantarCapa = aproximar(this._levantarCapa ?? 0, vel * 0.85 + ar * 0.6 + this.fatorEsquiva * 0.6, 4, delta || 1);

    const p = this._posCapa;
    for (let c = 0; c < C; c++) {
      const s = c / (C - 1) * 2 - 1; // -1..1
      let y = 0;
      let z = 0;
      let x = s * 0.26;
      for (let r = 0; r < R; r++) {
        const k = r / (R - 1);
        const i = (r * C + c) * 3;
        if (r > 0) {
          const ondulacao = Math.sin(t * (5 + vel * 6) - k * 5 + s * 1.3) * (0.05 + 0.14 * vel) * k;
          const angulo = 0.1 + this._levantarCapa * Math.pow(k, 1.2) + ondulacao;
          y -= Math.cos(angulo) * seg;
          z -= Math.sin(angulo) * seg;
          x += (s * 0.07 + giro * 0.16 * k) * seg;
        }
        // Curvatura envolvendo as costas.
        const curva = -0.06 * (1 - s * s) * (1 - k * 0.5);
        p[i] = x;
        p[i + 1] = y;
        p[i + 2] = z + curva;
      }
    }

    VertexData.ComputeNormals(p, this._indicesCapa, this._normCapa);
    this.capa.updateVerticesData(VertexBuffer.PositionKind, p);
    this.capa.updateVerticesData(VertexBuffer.NormalKind, this._normCapa);
  }

  // ------------------------------------------------------------
  // RASTRO DO GOLPE
  // ------------------------------------------------------------

  /**
   * Rastro em fita: guarda as últimas posições da base e da ponta da
   * lâmina e monta uma faixa que desaparece com a idade.
   */
  _criarRastro() {
    this.baseLamina = this._no("baseLamina", this.maoDireita, 0, -0.4, 0);
    this.pontaArma = this._no("pontaArma", this.maoDireita, 0, -1.45, 0);

    this.amostrasRastro = 14;
    const n = this.amostrasRastro;
    this._posRastro = new Float32Array(n * 2 * 3);
    this._corRastro = new Float32Array(n * 2 * 4);
    this._historicoRastro = [];
    const indices = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    this.rastro = new Mesh("rastroGolpe", this.scene);
    const dados = new VertexData();
    dados.positions = this._posRastro;
    dados.colors = this._corRastro;
    dados.indices = indices;
    dados.applyToMesh(this.rastro, true);
    this.rastro.hasVertexAlpha = true;
    this.rastro.alwaysSelectAsActiveMesh = true;
    this.rastro.isPickable = false;
    this.rastro.isVisible = false;

    const mat = new StandardMaterial("materialRastroGolpe", this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.diffuseColor = Color3.Black();
    mat.alphaMode = Constants.ALPHA_ADD;
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true;
    mat.fogEnabled = false;
    this.rastro.material = mat;
    this.materialRastro = mat;
  }

  // ------------------------------------------------------------
  // CONTROLES
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // ANIMAÇÃO
  // ------------------------------------------------------------

  _atualizarAnimacaoAtaque(delta) {
    if (!this.atacando) {
      this.anguloAtaqueBraco = 0;
      this.anguloAtaqueTronco = 0;
      this.anguloAtaqueCotovelo = 0;
      this.giroAtaque = 0;
      this.lateralAtaque = 0;
      return;
    }

    this.tempoAtaque += delta;

    const progresso = Math.min(
      1,
      this.tempoAtaque / this.duracaoAnimacaoAtaque
    );

    // Preparação (braço sobe e o tronco gira para trás),
    // golpe rápido em diagonal e retorno à guarda.
    if (progresso < 0.3) {
      const e = suave(progresso / 0.3);
      this.anguloAtaqueBraco = -2.7 * e;
      this.anguloAtaqueCotovelo = -0.9 * e;
      this.anguloAtaqueTronco = -0.1 * e;
      this.giroAtaque = 0.4 * e;
      this.lateralAtaque = 0.35 * e;
    } else if (progresso < 0.55) {
      const t = (progresso - 0.3) / 0.25;
      const e = t * t * (3 - 2 * t);
      this.anguloAtaqueBraco = -2.7 + 2.85 * e;
      this.anguloAtaqueCotovelo = -0.9 + 1.2 * e;
      this.anguloAtaqueTronco = -0.1 + 0.34 * e;
      this.giroAtaque = 0.4 - 0.85 * e;
      this.lateralAtaque = 0.35 - 0.6 * e;
    } else {
      const e = suave((progresso - 0.55) / 0.45);
      this.anguloAtaqueBraco = 0.15 * (1 - e);
      this.anguloAtaqueCotovelo = 0.3 * (1 - e);
      this.anguloAtaqueTronco = 0.24 * (1 - e);
      this.giroAtaque = -0.45 * (1 - e);
      this.lateralAtaque = -0.25 * (1 - e);
    }

    if (progresso >= 1) {
      this.atacando = false;
      this.tempoAtaque = 0;
      this.anguloAtaqueBraco = 0;
      this.anguloAtaqueTronco = 0;
      this.anguloAtaqueCotovelo = 0;
      this.giroAtaque = 0;
      this.lateralAtaque = 0;
    }
  }

  _atualizarRastro() {
    const progresso = this.atacando ? this.tempoAtaque / this.duracaoAnimacaoAtaque : 1;
    // Só durante o golpe (depois da preparação).
    const ativo = this.atacando && progresso > 0.26 && progresso < 0.62;
    const nome = this.armaAtual?.nome;
    this.pontaArma.position.y = -(PONTA_ARMA[nome] ?? 1.2);

    const h = this._historicoRastro;
    const n = this.amostrasRastro;
    if (ativo) {
      // Posições do quadro atual (a pose acabou de mudar).
      for (const no of [
        this.root, this.modelo, this.quadril, this.corpo,
        this.pivoBracoDireito, this.cotoveloDireito, this.maoDireita,
        this.baseLamina, this.pontaArma
      ]) {
        no.computeWorldMatrix(true);
      }
      h.unshift([
        this.baseLamina.getAbsolutePosition().clone(),
        this.pontaArma.getAbsolutePosition().clone()
      ]);
      if (h.length > n) h.length = n;
    } else if (h.length) {
      // Depois do golpe, a fita se dissolve em poucos quadros.
      h.pop();
      h.pop();
    }

    if (h.length < 2) {
      this.rastro.isVisible = false;
      return;
    }
    this.rastro.isVisible = true;

    const p = this._posRastro;
    const c = this._corRastro;
    for (let i = 0; i < n; i++) {
      const amostra = h[Math.min(i, h.length - 1)];
      const idade = i < h.length ? i / (h.length - 1) : 1;
      const a = Math.pow(1 - idade, 1.4);
      for (let lado = 0; lado < 2; lado++) {
        const v = i * 2 + lado;
        const ponto = amostra[lado];
        p[v * 3] = ponto.x;
        p[v * 3 + 1] = ponto.y;
        p[v * 3 + 2] = ponto.z;
        c[v * 4] = 1;
        c[v * 4 + 1] = 0.86;
        c[v * 4 + 2] = 0.62;
        c[v * 4 + 3] = a * (lado === 0 ? 0.12 : 0.85);
      }
    }
    this.rastro.updateVerticesData(VertexBuffer.PositionKind, p);
    this.rastro.updateVerticesData(VertexBuffer.ColorKind, c);
  }

  _animar(delta, correndo) {
    const movendo =
      this.teclas["w"] ||
      this.teclas["a"] ||
      this.teclas["s"] ||
      this.teclas["d"];

    this.intensidadeAnimacao = aproximar(this.intensidadeAnimacao, movendo ? 1 : 0, 8, delta);
    this.fatorCorrida = aproximar(this.fatorCorrida, correndo ? 1 : 0, 5, delta);
    this.fatorAr = aproximar(this.fatorAr, this.noChao ? 0 : 1, 10, delta);
    this.fatorEsquiva = aproximar(this.fatorEsquiva, this.esquivando ? 1 : 0, 18, delta);

    const s = this.intensidadeAnimacao;
    const run = this.fatorCorrida;
    const ar = this.fatorAr;
    const esq = this.fatorEsquiva;

    this.tempoAnimacao += delta * (7.5 + run * 4) * (0.25 + 0.75 * s);
    const p = this.tempoAnimacao;
    const respiracao = Math.sin(this.tempoTotal * 1.9) * (1 - s);

    // Pernas: quadril balança, joelho dobra na fase de avanço.
    const amplitude = 0.5 * s * (1 + 0.4 * run);
    let quadrilE = -Math.sin(p) * amplitude;
    let quadrilD = Math.sin(p) * amplitude;
    const dobra = 0.7 + 0.55 * run;
    let joelhoE = 0.08 + s * dobra * Math.max(0, Math.cos(p));
    let joelhoD = 0.08 + s * dobra * Math.max(0, -Math.cos(p));

    // No ar: pernas encolhidas.
    quadrilE = quadrilE * (1 - ar) - 0.65 * ar;
    joelhoE = joelhoE * (1 - ar) + 1.1 * ar;
    quadrilD = quadrilD * (1 - ar) + 0.2 * ar;
    joelhoD = joelhoD * (1 - ar) + 0.45 * ar;

    // Esquiva: postura baixa de investida.
    quadrilE = quadrilE * (1 - esq) - 0.9 * esq;
    joelhoE = joelhoE * (1 - esq) + 1.3 * esq;
    quadrilD = quadrilD * (1 - esq) + 0.5 * esq;
    joelhoD = joelhoD * (1 - esq) + 0.9 * esq;

    this.pernaEsquerda.rotation.x = quadrilE;
    this.pernaDireita.rotation.x = quadrilD;
    this.joelhoEsquerdo.rotation.x = joelhoE;
    this.joelhoDireito.rotation.x = joelhoD;

    // Tabardo acompanha as pernas.
    this.saioteFrente.rotation.x = Math.min(quadrilE, quadrilD) * 0.8 - 0.05;
    this.saioteTras.rotation.x = Math.max(quadrilE, quadrilD) * 0.8 + 0.05 + run * 0.15;

    // Quadril: sobe e desce a cada passo e gira levemente.
    const sobe = s * (0.035 + 0.03 * run) * Math.cos(2 * p);
    this.quadril.position.y = 0.98 - s * 0.03 - run * 0.03 + sobe - esq * 0.3 - ar * 0.05;
    this.quadril.rotation.y = -Math.sin(p) * 0.1 * s;
    this.quadril.rotation.z = Math.cos(p) * 0.03 * s;

    // Tronco: contrabalança o quadril e inclina ao correr/atacar.
    this.corpo.rotation.y = Math.sin(p) * 0.14 * s + this.giroAtaque;
    this.corpo.rotation.x = 0.05 * s + 0.2 * run + this.anguloAtaqueTronco + respiracao * 0.02 + esq * 0.4;
    this.corpo.rotation.z = -this.velocidadeGiro * 0.01 * s;

    // Braços em oposição às pernas.
    const balanco = 0.45 * s * (1 + 0.5 * run);
    this.pivoBracoEsquerdo.rotation.x = Math.sin(p) * balanco - 0.08 + esq * 0.9 + ar * -0.4;
    this.pivoBracoEsquerdo.rotation.z = -0.14 - 0.06 * run - respiracao * 0.02 - ar * 0.3;
    this.cotoveloEsquerdo.rotation.x = -(0.25 + 0.2 * s + 0.85 * run * s) - ar * 0.4;

    this.pivoBracoDireito.rotation.x =
      -Math.sin(p) * balanco * 0.6 - 0.25 + this.anguloAtaqueBraco + esq * 0.7;
    this.pivoBracoDireito.rotation.z = 0.12 + 0.05 * run + this.lateralAtaque + respiracao * 0.02;
    this.cotoveloDireito.rotation.x = -(0.45 + 0.4 * run) + this.anguloAtaqueCotovelo;

    // Cabeça estabilizada (olha para onde anda).
    this.cabeca.rotation.y = -this.corpo.rotation.y * 0.7;
    this.cabeca.rotation.x = -this.corpo.rotation.x * 0.5 + respiracao * 0.015;

    // Inclinação geral da esquiva.
    this.modelo.rotation.x = esq * 0.25;
  }

  _atualizarDano(delta) {
    const ferido = this.tempoDano > 0;
    if (ferido) this.tempoDano = Math.max(0, this.tempoDano - delta);
    const ligar = this.tempoDano > 0;
    if (ligar !== this._overlayLigado) {
      for (const m of this.malhas) {
        m.renderOverlay = ligar;
        m.overlayColor = new Color3(1, 0.15, 0.1);
        m.overlayAlpha = 0.55;
      }
      this._overlayLigado = ligar;
    }
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

    if (!this._ultimaPosicao) this._ultimaPosicao = this.root.position.clone();

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

      this._rotacaoAlvo = Math.atan2(
        direcao.x,
        direcao.z
      );

      // Giro suave (sem "estalar" de direção).
      const diferenca = anguloMaisProximo(this.root.rotation.y, this._rotacaoAlvo);
      const passo = diferenca * Math.min(1, 16 * delta);
      this.root.rotation.y += passo;
      this.velocidadeGiro = delta > 0 ? passo / delta : 0;
    } else {
      this.velocidadeGiro = aproximar(this.velocidadeGiro, 0, 8, delta);
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

    // Velocidade horizontal real (inclui esquiva), para capa e animação.
    if (delta > 0) {
      const dx = this.root.position.x - this._ultimaPosicao.x;
      const dz = this.root.position.z - this._ultimaPosicao.z;
      this.velocidadeHorizontal = aproximar(this.velocidadeHorizontal, Math.hypot(dx, dz) / delta, 10, delta);
    }
    this._ultimaPosicao.copyFrom(this.root.position);

    this.tempoTotal += delta;
    this._atualizarAnimacaoAtaque(delta);
    this._animar(delta, correndo);
    this._atualizarRastro();
    this._atualizarCapa(delta);
    this._atualizarDano(delta);

    this.invulnerabilidade = Math.max(
      0,
      this.invulnerabilidade - delta
    );
  }

  /** Animação de derrota (chamada pelo Game quando a vida acaba). */
  atualizarDerrota(delta) {
    this.tempoDerrota += delta;
    this.tempoTotal += delta;
    const ajoelhar = suave(Math.min(1, this.tempoDerrota / 0.7));
    const cair = suave(Math.min(1, Math.max(0, this.tempoDerrota - 0.6) / 0.8));

    this.quadril.position.y = 0.98 - 0.48 * ajoelhar - 0.25 * cair;
    this.pernaEsquerda.rotation.x = -1.1 * ajoelhar;
    this.pernaDireita.rotation.x = -0.3 * ajoelhar;
    this.joelhoEsquerdo.rotation.x = 1.5 * ajoelhar;
    this.joelhoDireito.rotation.x = 1.6 * ajoelhar;
    this.corpo.rotation.x = 0.45 * ajoelhar;
    this.corpo.rotation.y = 0;
    this.pivoBracoEsquerdo.rotation.x = 0.2 * ajoelhar;
    this.pivoBracoDireito.rotation.x = -0.4 * ajoelhar;
    this.cabeca.rotation.x = 0.5 * ajoelhar;
    this.modelo.rotation.x = 1.25 * cair;
    this.modelo.position.y = 0.12 * cair;

    this.fatorAr = 0;
    this.velocidadeHorizontal = 0;
    this.atacando = false;
    this._atualizarRastro();
    this._atualizarCapa(delta);
    this._atualizarDano(delta);
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
    this.tempoDano = 0.16;
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

    this.rastro.dispose();
    this.materialRastro.dispose();

    this.root.dispose(false, false);

    this.materialCorpo.dispose();
    this.materialArmadura.dispose();
    this.materialAcoEscuro.dispose();
    this.materialDetalhe.dispose();
    this.materialCouro.dispose();
    this.materialTecido.dispose();
    this.materialPele.dispose();
  }
}

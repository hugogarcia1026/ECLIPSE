import "@babylonjs/core/Meshes/Builders/icoSphereBuilder.js";
import "@babylonjs/core/Meshes/Builders/torusBuilder.js";

import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";

import { ruidoValor } from "./Ruido.js";
import { criarMaterial } from "./Materiais.js";

const suave = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const aproximar = (atual, alvo, taxa, delta) =>
  atual + (alvo - atual) * Math.min(1, taxa * delta);
const L = (v) => Math.pow(v, 2.2);

// Cor da lava nas rachaduras (HDR, linear).
const LAVA_FASE1 = new Color3(1.5, 0.26, 0.04);
const LAVA_FASE2 = new Color3(2.6, 0.8, 0.12);

// Pose neutra de cada articulação (radianos / unidades locais).
const POSE_ZERO = {
  corpoY: 0,
  corpoX: 0,
  troncoX: 0,
  troncoY: 0,
  troncoZ: 0,
  cabecaX: 0,
  bracoDX: 0,
  bracoDZ: 0.08,
  cotoveloD: -0.25,
  bracoEX: 0,
  bracoEZ: -0.08,
  cotoveloE: -0.25,
  pernaE: 0,
  pernaD: 0,
  joelhoE: 0.05,
  joelhoD: 0.05
};

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

    // Animação procedural.
    this.pose = { ...POSE_ZERO };
    this.fasePasso = 0;
    this.fatorAndar = 0;
    this.tempoTotal = 0;
    this.tempoImpacto = 0;
    this.tempoDerrota = 0;
    this.impactoGolpe = false;
    this.brilhoOlhos = 0;
    this.intensidadeLava = 0;
    this.efeitos = null; // definido pelo Game
    this._ultimaPosicao = null;
    this._poeiraDerrota = 0;

    this._criarRaiz(x, z);
    this._criarMateriais();
    this._criarCorpo();
    this._aplicarPose();
    this._atualizarBrilho(0);
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

    // Começa voltado para o centro do monumento (onde o jogador nasce).
    this.root.rotation.y = Math.atan2(-this.root.position.x, -this.root.position.z);

    this.root.scaling.setAll(2.5);
  }

  _criarMateriais() {
    // Basalto escuro com rachaduras de lava (emissivas).
    this.materialCorpo = criarMaterial(this.scene, "azhkhar_material_corpo", {
      cor: [0.4, 0.37, 0.35],
      rugosidade: 0.9,
      conjunto: "rocha",
      escala: 1.6,
      nivelNormal: 1.2,
      emissiva: "rachaduras",
      corEmissiva: [LAVA_FASE1.r, LAVA_FASE1.g, LAVA_FASE1.b],
      escalaEmissiva: 1.6
    });
    this.materialCorpo.metallicTexture = null;

    // Placas entalhadas com runas.
    this.materialPedra = criarMaterial(this.scene, "azhkhar_material_pedra", {
      cor: [0.33, 0.31, 0.3],
      conjunto: "pedra",
      nivelNormal: 1.3,
      emissiva: "runas",
      corEmissiva: [LAVA_FASE1.r, LAVA_FASE1.g, LAVA_FASE1.b],
      escalaEmissiva: 1
    });

    // Núcleo incandescente no peito.
    this.materialEnergia = new StandardMaterial("azhkhar_material_energia", this.scene);
    this.materialEnergia.disableLighting = true;
    this.materialEnergia.diffuseColor = Color3.Black();
    this.materialEnergia.emissiveColor = new Color3(4, 1.2, 0.2);

    this.materialOlhos = new StandardMaterial("azhkhar_material_olhos", this.scene);
    this.materialOlhos.disableLighting = true;
    this.materialOlhos.diffuseColor = Color3.Black();
    this.materialOlhos.emissiveColor = new Color3(6, 1.4, 0.25);
  }

  // ------------------------------------------------------------
  // GEOMETRIA
  // ------------------------------------------------------------

  /**
   * Bloco de rocha facetado: icosfera deformada por ruído, com
   * sombreamento chapado (cara de pedra lascada) e musgo no alto.
   */
  _rocha(nome, dimensoes, posicao, pai, semente, material = this.materialCorpo, rotacao = null) {
    const mesh = MeshBuilder.CreateIcoSphere(nome, { radius: 0.5, subdivisions: 3 }, this.scene);
    const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      const n =
        ruidoValor(x * 3.1 + y * 2.3 + semente, z * 3.1 - y * 1.9 - semente) * 0.7 +
        ruidoValor(x * 7.7 - semente, z * 7.7 + y * 6.1) * 0.3;
      // Bloco talhado: aproxima a esfera de um cubo de quinas gastas,
      // com lascas irregulares (ruído) em cada face.
      const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) || 1;
      const cx = (x / m) * 0.5;
      const cy = (y / m) * 0.5;
      const cz = (z / m) * 0.5;
      const k = 0.72;
      const bx = x + (cx - x) * k;
      const by = y + (cy - y) * k;
      const bz = z + (cz - z) * k;
      const f = (0.86 + 0.2 * n) * 0.9;
      pos[i] = bx * f;
      pos[i + 1] = by * f;
      pos[i + 2] = bz * f;
    }
    const normais = [];
    VertexData.ComputeNormals(pos, mesh.getIndices(), normais);
    mesh.setVerticesData(VertexBuffer.PositionKind, pos);
    mesh.setVerticesData(VertexBuffer.NormalKind, normais);
    mesh.convertToFlatShadedMesh();

    // Musgo e líquen nas faces de cima.
    const p2 = mesh.getVerticesData(VertexBuffer.PositionKind);
    const n2 = mesh.getVerticesData(VertexBuffer.NormalKind);
    const cores = new Float32Array((p2.length / 3) * 4);
    for (let v = 0; v < p2.length / 3; v++) {
      const ny = n2[v * 3 + 1];
      const mancha = ruidoValor(p2[v * 3] * 4 + semente * 2, p2[v * 3 + 2] * 4 + p2[v * 3 + 1] * 3);
      const musgo = Math.max(0, Math.min(1, (ny - 0.5) * 2.2)) * (mancha > 0.45 ? 1 : 0.25);
      const k = 0.85 + 0.3 * mancha;
      cores[v * 4] = L(k * (1 - musgo) + 0.3 * musgo);
      cores[v * 4 + 1] = L(k * (1 - musgo) + 0.42 * musgo);
      cores[v * 4 + 2] = L(k * (1 - musgo) + 0.16 * musgo);
      cores[v * 4 + 3] = 1;
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, cores);

    mesh.parent = pai;
    mesh.position.copyFrom(posicao);
    mesh.scaling.copyFrom(dimensoes);
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

  _criarCorpo() {
    const V = (x, y, z) => new Vector3(x, y, z);
    const pedra = this.materialPedra;

    // Nó geral (agachar ao despertar / desabar na derrota).
    this.corpo = this._no("AzhKhar_Corpo", this.root, 0, 0, 0);
    this.pelvis = this._no("AzhKhar_Pelvis", this.corpo, 0, 3.3, 0);
    this._rocha("AzhKhar_Quadril", V(2.7, 1.3, 1.7), V(0, 0, 0), this.pelvis, 1);

    // ---------------- Pernas ----------------
    const criarPerna = (lado, x, semente) => {
      const quadril = this._no(`AzhKhar_Perna_${lado}`, this.pelvis, x, -0.1, 0);
      this._rocha(`AzhKhar_Coxa_${lado}`, V(1.3, 1.95, 1.4), V(0, -0.85, 0), quadril, semente);
      const joelho = this._no(`AzhKhar_Joelho_${lado}`, quadril, 0, -1.65, 0);
      this._rocha(`AzhKhar_Rotula_${lado}`, V(0.9, 0.8, 0.8), V(0, 0, 0.35), joelho, semente + 1, pedra);
      this._rocha(`AzhKhar_Canela_${lado}`, V(1.15, 1.75, 1.25), V(0, -0.75, 0), joelho, semente + 2);
      const pe = this._rocha(`AzhKhar_Pe_${lado}`, V(1.75, 0.65, 2.3), V(0, -1.32, 0.3), joelho, semente + 3);
      return { quadril, joelho, pe };
    };
    const pe = criarPerna("Esquerda", -0.95, 11);
    const pd = criarPerna("Direita", 0.95, 21);
    this.pernaEsquerda = pe.quadril;
    this.joelhoEsquerdo = pe.joelho;
    this.peEsquerdo = pe.pe;
    this.pernaDireita = pd.quadril;
    this.joelhoDireito = pd.joelho;
    this.peDireito = pd.pe;

    // ---------------- Tronco ----------------
    this.tronco = this._no("AzhKhar_Tronco", this.pelvis, 0, 0.5, 0);
    this.massaTronco = this._rocha("AzhKhar_Torso", V(3.7, 3.3, 2.3), V(0, 1.35, 0), this.tronco, 31);
    this._rocha("AzhKhar_Peitoral", V(2.8, 2.0, 0.7), V(0, 1.55, 0.95), this.tronco, 32, pedra);
    this._rocha("AzhKhar_Abdome", V(2.3, 1.2, 1.6), V(0, 0.15, 0.2), this.tronco, 33, pedra);

    // Núcleo incandescente (ponto fraco visual) emoldurado por pedra.
    this.nucleo = MeshBuilder.CreateIcoSphere("AzhKhar_Nucleo", { radius: 0.38, subdivisions: 2 }, this.scene);
    this.nucleo.parent = this.tronco;
    this.nucleo.position.set(0, 1.6, 1.28);
    this.nucleo.material = this.materialEnergia;
    this.nucleo.isPickable = false;
    const moldura = MeshBuilder.CreateTorus("AzhKhar_Moldura_Nucleo", { diameter: 0.95, thickness: 0.22, tessellation: 24 }, this.scene);
    moldura.parent = this.tronco;
    moldura.position.set(0, 1.6, 1.25);
    moldura.rotation.x = Math.PI / 2;
    moldura.material = pedra;
    moldura.isPickable = false;

    // Espinhos de pedra nas costas.
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      this._rocha(
        `AzhKhar_Espinho_${i}`,
        V(0.55 - t * 0.15, 1.3 - t * 0.3, 0.55),
        V((i % 2 ? 0.45 : -0.45) * (1 - t * 0.5), 0.6 + t * 2.0, -1.05 - t * 0.1),
        this.tronco,
        40 + i,
        pedra,
        V(-0.7, 0, (i % 2 ? -0.3 : 0.3))
      );
    }

    // ---------------- Cabeça ----------------
    this.cabeca = this._no("AzhKhar_Pescoco", this.tronco, 0, 3.05, 0.25);
    this._rocha("AzhKhar_Cabeca", V(1.55, 1.35, 1.5), V(0, 0.5, 0), this.cabeca, 51);
    this._rocha("AzhKhar_Testa", V(1.85, 0.5, 0.7), V(0, 0.85, 0.55), this.cabeca, 52, pedra);
    this._rocha("AzhKhar_Mandibula", V(1.3, 0.55, 1.05), V(0, 0.02, 0.3), this.cabeca, 53);

    for (const [lado, x] of [["Esquerdo", -1], ["Direito", 1]]) {
      // Olhos em fenda, na FRENTE (+z: o lado que encara o jogador).
      const olho = MeshBuilder.CreateSphere(`AzhKhar_Olho_${lado}`, { diameter: 1, segments: 12 }, this.scene);
      olho.parent = this.cabeca;
      olho.position.set(0.36 * x, 0.58, 0.72);
      olho.scaling.set(0.34, 0.12, 0.12);
      olho.rotation.z = 0.25 * x;
      olho.material = this.materialOlhos;
      olho.isPickable = false;

      // Chifres curvos (dois segmentos).
      const baseChifre = this._no(`AzhKhar_Chifre_${lado}`, this.cabeca, 0.62 * x, 1.0, -0.05);
      baseChifre.rotation.set(-0.35, 0, -0.75 * x);
      const c1 = MeshBuilder.CreateCylinder(`AzhKhar_Chifre1_${lado}`, { height: 0.9, diameterTop: 0.26, diameterBottom: 0.42, tessellation: 10 }, this.scene);
      c1.parent = baseChifre;
      c1.position.y = 0.42;
      c1.material = pedra;
      const ponta = this._no(`AzhKhar_PontaChifre_${lado}`, baseChifre, 0, 0.85, 0);
      ponta.rotation.set(-0.6, 0, 0.45 * x);
      const c2 = MeshBuilder.CreateCylinder(`AzhKhar_Chifre2_${lado}`, { height: 0.8, diameterTop: 0.02, diameterBottom: 0.27, tessellation: 10 }, this.scene);
      c2.parent = ponta;
      c2.position.y = 0.38;
      c2.material = pedra;
      c1.isPickable = c2.isPickable = false;
    }

    // ---------------- Braços ----------------
    const criarBraco = (lado, x, semente) => {
      this._rocha(`AzhKhar_Ombro_${lado}`, V(2.0, 1.75, 2.0), V(2.2 * x, 2.55, 0), this.tronco, semente);
      const ombro = this._no(`AzhKhar_Braco_${lado}`, this.tronco, 2.35 * x, 2.25, 0);
      this._rocha(`AzhKhar_BracoSup_${lado}`, V(1.25, 2.1, 1.25), V(0, -1.0, 0), ombro, semente + 1);
      const cotovelo = this._no(`AzhKhar_Cotovelo_${lado}`, ombro, 0, -2.0, 0);
      this._rocha(`AzhKhar_Antebraco_${lado}`, V(1.45, 2.1, 1.45), V(0, -0.95, 0), cotovelo, semente + 2);
      // Faixa de runas ao redor do antebraço.
      const faixa = MeshBuilder.CreateTorus(`AzhKhar_Faixa_${lado}`, { diameter: 1.3, thickness: 0.22, tessellation: 24 }, this.scene);
      faixa.parent = cotovelo;
      faixa.position.y = -0.7;
      faixa.material = pedra;
      faixa.isPickable = false;
      const punho = this._rocha(`AzhKhar_Mao_${lado}`, V(1.7, 1.55, 1.7), V(0, -2.05, 0.05), cotovelo, semente + 3);
      return { ombro, cotovelo, punho };
    };
    const be = criarBraco("Esquerdo", -1, 61);
    const bd = criarBraco("Direito", 1, 71);
    this.bracoEsquerdo = be.ombro;
    this.cotoveloEsquerdo = be.cotovelo;
    this.punhoEsquerdo = be.punho;
    this.bracoDireito = bd.ombro;
    this.cotoveloDireito = bd.cotovelo;
    this.punhoDireito = bd.punho;

    // Mantido por compatibilidade: as "marcas de energia" agora são
    // as rachaduras do corpo e o núcleo.
    this.marcasEnergia = [this.nucleo];
  }

  // ------------------------------------------------------------
  // POSE E BRILHO
  // ------------------------------------------------------------

  _aplicarPose() {
    const p = this.pose;
    this.corpo.position.y = p.corpoY;
    this.corpo.rotation.x = p.corpoX;
    this.tronco.rotation.set(p.troncoX, p.troncoY, p.troncoZ);
    this.cabeca.rotation.x = p.cabecaX;
    this.bracoDireito.rotation.set(p.bracoDX, 0, p.bracoDZ);
    this.cotoveloDireito.rotation.x = p.cotoveloD;
    this.bracoEsquerdo.rotation.set(p.bracoEX, 0, p.bracoEZ);
    this.cotoveloEsquerdo.rotation.x = p.cotoveloE;
    this.pernaEsquerda.rotation.x = p.pernaE;
    this.pernaDireita.rotation.x = p.pernaD;
    this.joelhoEsquerdo.rotation.x = p.joelhoE;
    this.joelhoDireito.rotation.x = p.joelhoD;
  }

  /** Aproxima a pose atual da pose-alvo (taxa por segundo). */
  _irPara(alvo, taxa, delta) {
    for (const chave in POSE_ZERO) {
      const valor = alvo[chave] ?? POSE_ZERO[chave];
      this.pose[chave] = aproximar(this.pose[chave], valor, taxa, delta);
    }
  }

  _atualizarBrilho(delta) {
    this.tempoImpacto = Math.max(0, this.tempoImpacto - delta);
    const base = this.fase >= 2 ? LAVA_FASE2 : LAVA_FASE1;
    const velocidadePulso = this.fase >= 2 ? 4.5 : 2.2;
    const pulso = 0.72 + 0.28 * Math.sin(this.tempoTotal * velocidadePulso);
    const flash = 1 + this.tempoImpacto * 6;
    const k = this.intensidadeLava * pulso * flash;

    this.materialCorpo.emissiveColor.set(base.r * k, base.g * k, base.b * k);
    this.materialPedra.emissiveColor.set(base.r * k * 0.55, base.g * k * 0.55, base.b * k * 0.55);
    const nucleo = this.intensidadeLava * (0.8 + 0.4 * Math.sin(this.tempoTotal * velocidadePulso * 1.3)) * flash;
    this.materialEnergia.emissiveColor.set(base.r * 1.6 * nucleo, base.g * 2.2 * nucleo, base.b * 2 * nucleo);
    const o = this.brilhoOlhos;
    this.materialOlhos.emissiveColor.set(6 * o, (this.fase >= 2 ? 2.4 : 1.4) * o, 0.25 * o);
  }

  _poseAndar() {
    const s = this.fatorAndar;
    const f = this.fasePasso;
    const balanco = Math.sin(f);
    const respiracao = Math.sin(this.tempoTotal * 0.9);
    return {
      corpoY: -s * 0.12 * Math.abs(Math.cos(f)) + respiracao * 0.02,
      troncoX: 0.08 * s + respiracao * 0.025,
      troncoY: -balanco * 0.08 * s,
      troncoZ: balanco * 0.05 * s,
      cabecaX: 0.1 - respiracao * 0.02,
      bracoDX: -balanco * 0.28 * s - 0.05,
      bracoDZ: 0.1 + 0.03 * respiracao,
      cotoveloD: -0.3 - 0.15 * s,
      bracoEX: balanco * 0.28 * s - 0.05,
      bracoEZ: -0.1 - 0.03 * respiracao,
      cotoveloE: -0.3 - 0.15 * s,
      pernaE: -balanco * 0.38 * s,
      pernaD: balanco * 0.38 * s,
      joelhoE: 0.05 + s * 0.55 * Math.max(0, Math.cos(f)),
      joelhoD: 0.05 + s * 0.55 * Math.max(0, -Math.cos(f))
    };
  }

  // Braço direito erguido acima da cabeça, tronco torcido para trás.
  static POSE_PREPARO = {
    corpoY: 0.1,
    troncoX: -0.2,
    troncoY: 0.3,
    troncoZ: -0.06,
    cabecaX: 0.15,
    bracoDX: -2.75,
    bracoDZ: 0.35,
    cotoveloD: -0.7,
    bracoEX: -0.55,
    bracoEZ: -0.3,
    cotoveloE: -0.6,
    pernaE: -0.15,
    pernaD: 0.2,
    joelhoE: 0.2,
    joelhoD: 0.1
  };

  // Punho cravado no chão à frente, corpo agachado.
  static POSE_GOLPE = {
    corpoY: -0.75,
    troncoX: 0.55,
    troncoY: -0.25,
    troncoZ: 0.05,
    cabecaX: -0.2,
    bracoDX: -1.05,
    bracoDZ: 0.05,
    cotoveloD: -0.15,
    bracoEX: 0.35,
    bracoEZ: -0.35,
    cotoveloE: -0.5,
    pernaE: -0.55,
    pernaD: 0.35,
    joelhoE: 0.95,
    joelhoD: 0.55
  };

  _misturarPoses(a, b, t) {
    const r = {};
    for (const chave in POSE_ZERO) {
      const va = a[chave] ?? POSE_ZERO[chave];
      const vb = b[chave] ?? POSE_ZERO[chave];
      r[chave] = va + (vb - va) * t;
    }
    return r;
  }

  _posicaoChao(malha) {
    const p = malha.getAbsolutePosition();
    return new Vector3(p.x, this.alturaEm(p.x, p.z), p.z);
  }

  _passos(distancia) {
    // Uma passada completa a cada ~7 m.
    const anterior = this.fasePasso;
    this.fasePasso += (distancia / 7) * Math.PI * 2;
    const meioAnterior = Math.floor(anterior / Math.PI);
    const meioAtual = Math.floor(this.fasePasso / Math.PI);
    if (meioAtual !== meioAnterior && this.efeitos) {
      const pe = meioAtual % 2 ? this.peEsquerdo : this.peDireito;
      this.efeitos.poeira(this._posicaoChao(pe), this.fase >= 2 ? 0.3 : 0.2);
    }
  }

  // ------------------------------------------------------------
  // DESPERTAR
  // ------------------------------------------------------------

  _atualizarDespertar(delta) {
    if (!this.desppertando) return;

    this.tempoDespertar += delta;

    const progresso = Math.min(
      1,
      this.tempoDespertar / this.duracaoDespertar
    );

    // Começa ajoelhado e de cabeça baixa; ergue-se acendendo.
    const e = suave(progresso);
    const ajoelhado = {
      corpoY: -1.7,
      troncoX: 0.65,
      cabecaX: 0.5,
      bracoDX: -0.5,
      bracoDZ: 0.25,
      cotoveloD: -0.6,
      bracoEX: -0.5,
      bracoEZ: -0.25,
      cotoveloE: -0.6,
      pernaE: -1.25,
      pernaD: -0.2,
      joelhoE: 1.6,
      joelhoD: 1.25
    };
    this.pose = this._misturarPoses(ajoelhado, this._poseAndar(delta), e);
    this.brilhoOlhos = suave((progresso - 0.15) / 0.3);
    this.intensidadeLava = suave((progresso - 0.25) / 0.6);

    if (progresso >= 1) {
      this.desppertando = false;
      this.despertando = false;
      this.root.rotation.x = 0;
      this.efeitos?.poeira(this._posicaoChao(this.pelvis), 1.0);
    }
  }

  _ativarSegundaFase() {
    if (this.fase >= 2) return;

    this.fase = 2;

    this.velocidade = this.velocidadeFase2;
    this.danoAtaque = this.danoFase2;
    this.intervaloAtaque = 1.9;

    this.tempoImpacto = 0.6;
    if (this.efeitos && !this.brasas) {
      this.brasas = this.efeitos.criarBrasas(this.massaTronco, 0.55);
    }
    if (this.brasas) this.brasas.emitRate = 70;
  }

  receberDano(dano) {
    if (this.derrotado || this.vida <= 0) return;

    const valor = Math.max(0, Number(dano) || 0);

    if (valor <= 0) return;

    this.vida = Math.max(
      0,
      this.vida - valor
    );

    // Reação visual: rachaduras piscam e o tronco recua.
    this.tempoImpacto = Math.max(this.tempoImpacto, 0.15);
    this.pose.troncoX -= 0.06;

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
    this.impactoGolpe = false;
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

    // Animação: preparo lento e golpe rápido com onda de choque.
    if (this.preparandoAtaque) {
      const e = suave(this.tempoAtaque / this.duracaoPreparacao);
      const alvo = this._misturarPoses(this._poseAndar(delta), Colossus.POSE_PREPARO, e);
      this._irPara(alvo, 12, delta);
      // Tremor de esforço no fim do preparo.
      this.pose.troncoZ += Math.sin(this.tempoTotal * 40) * 0.006 * e;
    } else if (this.atacando) {
      this._irPara(Colossus.POSE_GOLPE, 26, delta);
      if (!this.impactoGolpe && this.tempoAtaque >= 0.1) {
        this.impactoGolpe = true;
        this.tempoImpacto = 0.35;
        if (this.efeitos) {
          const cor = this.fase >= 2 ? new Color3(3.2, 1.3, 0.3) : new Color3(2.4, 0.8, 0.25);
          this.efeitos.ondaDeChoque(this._posicaoChao(this.punhoDireito), this.fase >= 2 ? 15 : 12, cor);
        }
      }
    }
  }

  _atualizarRecuperacao(delta) {
    if (!this.recuperando) return;

    this.tempoRecuperacao -= delta;

    const progresso = Math.max(
      0,
      this.tempoRecuperacao / this.duracaoRecuperacao
    );

    const alvo = this._misturarPoses(this._poseAndar(delta), Colossus.POSE_GOLPE, suave(progresso));
    this._irPara(alvo, 10, delta);

    if (this.tempoRecuperacao <= 0) {
      this.recuperando = false;
      this.ataqueAtual = "nenhum";
      this.tempoAtaque = 0;

      this.intervaloAtaque =
        this.fase === 2 ? 1.9 : 2.8;
    }
  }

  _animarDerrota(delta) {
    this.tempoDerrota += delta;
    const t = this.tempoDerrota;
    const ajoelhar = suave(t / 1.6);
    const tombar = suave((t - 1.2) / 1.6);

    const caido = {
      corpoY: -1.9 * ajoelhar - 0.5 * tombar,
      corpoX: 0.28 * tombar,
      troncoX: 0.5 * ajoelhar + 0.35 * tombar,
      troncoY: 0.1,
      cabecaX: 0.55 * ajoelhar,
      bracoDX: -0.35 * ajoelhar,
      bracoDZ: 0.35,
      cotoveloD: -0.2,
      bracoEX: -0.5 * ajoelhar,
      bracoEZ: -0.35,
      cotoveloE: -0.2,
      pernaE: -1.25 * ajoelhar,
      pernaD: -0.3 * ajoelhar,
      joelhoE: 1.6 * ajoelhar,
      joelhoD: 1.3 * ajoelhar
    };
    this._irPara(caido, 6, delta);

    // As rachaduras e os olhos se apagam.
    const apagar = 1 - suave((t - 0.5) / 3);
    this.intensidadeLava = Math.min(this.intensidadeLava, apagar);
    this.brilhoOlhos = Math.min(this.brilhoOlhos, 1 - suave((t - 0.2) / 1.5));
    if (this.brasas) this.brasas.emitRate = 70 * apagar;

    // Poeira ao bater os joelhos e ao tombar.
    if (this.efeitos) {
      if (this._poeiraDerrota === 0 && t > 1.0) {
        this._poeiraDerrota = 1;
        this.efeitos.poeira(this._posicaoChao(this.joelhoEsquerdo), 1.3);
        this.efeitos.poeira(this._posicaoChao(this.joelhoDireito), 1.3);
      } else if (this._poeiraDerrota === 1 && t > 2.6) {
        this._poeiraDerrota = 2;
        this.efeitos.poeira(this._posicaoChao(this.cabeca), 1.6);
      }
    }
  }

  atualizar(delta, jogador) {
    if (!Number.isFinite(delta) || delta <= 0) return;

    this.tempoTotal += delta;
    if (!this._ultimaPosicao) this._ultimaPosicao = this.root.position.clone();

    if (this.derrotado) {
      this._animarDerrota(delta);
      this._aplicarPose();
      this._atualizarBrilho(delta);
      return;
    }

    this._atualizarDespertar(delta);

    if (this.desppertando) {
      this._aplicarPose();
      this._atualizarBrilho(delta);
      return;
    }

    // Brilho volta ao normal depois de despertar.
    this.intensidadeLava = aproximar(this.intensidadeLava, 1, 2, delta);
    this.brilhoOlhos = aproximar(this.brilhoOlhos, 1, 2, delta);

    if (this.recuperando) {
      this._atualizarRecuperacao(delta);
      this._finalizarQuadro(delta, jogador);
      return;
    }

    if (this.preparandoAtaque || this.atacando) {
      this._executarAtaque(delta, jogador);
      this._finalizarQuadro(delta, jogador);
      return;
    }

    this.tempoAnimacao += delta;
    this.tempoAtaque += delta;

    this._perseguirJogador(delta, jogador);

    // Caminhada: as pernas acompanham a distância percorrida.
    const dx = this.root.position.x - this._ultimaPosicao.x;
    const dz = this.root.position.z - this._ultimaPosicao.z;
    const distancia = Math.hypot(dx, dz);
    this.fatorAndar = aproximar(this.fatorAndar, distancia / delta > 0.3 ? 1 : 0, 4, delta);
    this._passos(distancia);
    this._irPara(this._poseAndar(delta), 8, delta);
    this._finalizarQuadro(delta, jogador);

    if (!jogador?.root) return;

    const distanciaJogador = Vector3.Distance(
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
      distanciaJogador <= this.distanciaAtaque &&
      this.tempoAtaque >= this.intervaloAtaque
    ) {
      this._prepararAtaque();
    }
  }

  _finalizarQuadro(delta, jogador) {
    // A cabeça acompanha o jogador (dentro de um limite).
    if (jogador?.root) {
      const dx = jogador.root.position.x - this.root.position.x;
      const dz = jogador.root.position.z - this.root.position.z;
      let relativo = Math.atan2(dx, dz) - this.root.rotation.y;
      while (relativo > Math.PI) relativo -= Math.PI * 2;
      while (relativo < -Math.PI) relativo += Math.PI * 2;
      const alvo = Math.max(-0.6, Math.min(0.6, relativo));
      this.cabeca.rotation.y = aproximar(this.cabeca.rotation.y, alvo, 3, delta);
    }

    this._ultimaPosicao.copyFrom(this.root.position);
    this._aplicarPose();
    this._atualizarBrilho(delta);
  }

  dispose() {
    if (this.root) {
      this.root.dispose(false, false);
    }

    this.brasas?.dispose(false);
    this.materialCorpo?.dispose();
    this.materialPedra?.dispose();
    this.materialEnergia?.dispose();
    this.materialOlhos?.dispose();
  }
}

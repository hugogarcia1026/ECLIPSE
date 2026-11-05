import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent.js";
import "@babylonjs/core/Layers/effectLayerSceneComponent.js";
import "@babylonjs/core/Rendering/depthRendererSceneComponent.js";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent.js";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent.js";

import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline.js";
import { VolumetricLightScatteringPostProcess } from "@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess.js";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer.js";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration.js";
import { ColorCurves } from "@babylonjs/core/Materials/colorCurves.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Constants } from "@babylonjs/core/Engines/constants.js";

import { textura } from "./Texturas.js";

// --------------------------------------------------------------
// Níveis de qualidade
// --------------------------------------------------------------

export const QUALIDADES = {
  alta: {
    nome: "alta",
    rotulo: "ALTA",
    sombra: 2048,
    cascatas: 4,
    densidadeGrama: 1,
    particulas: 1,
    msaa: 4,
    fxaa: false,
    ssao: true,
    raios: true,
    bloom: true,
    brilho: true,
    nitidez: true,
    escala: 1
  },
  media: {
    nome: "media",
    rotulo: "MÉDIA",
    sombra: 2048,
    cascatas: 3,
    densidadeGrama: 0.6,
    particulas: 0.7,
    msaa: 1,
    fxaa: true,
    ssao: false,
    raios: false,
    bloom: true,
    brilho: true,
    nitidez: true,
    escala: 1
  },
  baixa: {
    nome: "baixa",
    rotulo: "BAIXA",
    sombra: 1024,
    cascatas: 2,
    densidadeGrama: 0.3,
    particulas: 0.4,
    msaa: 1,
    fxaa: true,
    ssao: false,
    raios: false,
    bloom: false,
    brilho: false,
    nitidez: false,
    escala: 1.25
  }
};

const ORDEM = ["alta", "media", "baixa"];
const CHAVE = "eclipse.qualidade";

/**
 * Qualidade inicial: ?qualidade=alta|media|baixa na URL, depois a
 * última escolha salva no navegador, senão "alta".
 */
export function lerQualidade() {
  let nome = null;
  try {
    if (typeof window !== "undefined" && window.location) {
      nome = new URLSearchParams(window.location.search).get("qualidade");
    }
  } catch (e) {
    nome = null;
  }
  if (!QUALIDADES[nome]) {
    try {
      nome = typeof localStorage !== "undefined" ? localStorage.getItem(CHAVE) : null;
    } catch (e) {
      nome = null;
    }
  }
  return QUALIDADES[nome] ?? QUALIDADES.alta;
}

function salvarQualidade(nome) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CHAVE, nome);
  } catch (e) {
    // Sem armazenamento (aba privada): só não lembra a escolha.
  }
}

// --------------------------------------------------------------
// Pós-processamento
// --------------------------------------------------------------

/**
 * Pipeline de imagem: HDR, bloom, ACES, correção de cor, vinheta,
 * grão, anti-serrilhado, oclusão de ambiente (SSAO), brilho de
 * emissivos e raios de sol volumétricos.
 */
export class Graficos {
  constructor(scene, camera, { direcaoSol, qualidade = QUALIDADES.alta, excluirBrilho = [], aoMudar = null } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.engine = scene.getEngine();
    this.paraOSol = direcaoSol ? direcaoSol.scale(-1).normalize() : new Vector3(0.46, 0.21, 0.86);
    this.qualidade = qualidade;
    this.aoMudar = aoMudar;
    this.excluirBrilho = excluirBrilho;

    // Sem GPU (NullEngine dos testes): nada de pós-processamento.
    this.ativo = !!this.engine.getRenderingCanvas();

    this._amostrasFps = [];
    this._tempoMonitor = 0;
    this._autoAjuste = true;

    if (!this.ativo) return;

    this._criarSol();
    this._aplicar(qualidade);

    this._tecla = (evento) => {
      if (evento.code !== "KeyG" || evento.repeat) return;
      this._autoAjuste = false;
      this.proximaQualidade();
    };
    window.addEventListener("keydown", this._tecla);
  }

  proximaQualidade() {
    const i = ORDEM.indexOf(this.qualidade.nome);
    const proxima = QUALIDADES[ORDEM[(i + 1) % ORDEM.length]];
    this._aplicar(proxima);
    salvarQualidade(proxima.nome);
    this.aoMudar?.(proxima, false);
  }

  _criarSol() {
    // Sprite do sol: fonte dos raios volumétricos.
    const material = new StandardMaterial("materialSolRaios", this.scene);
    material.disableLighting = true;
    material.emissiveColor = new Color3(7, 4.2, 2.2);
    material.diffuseColor = Color3.Black();
    material.opacityTexture = textura(this.scene, "sol");
    material.alphaMode = Constants.ALPHA_ADD;
    material.fogEnabled = false;
    material.disableDepthWrite = true;
    this.materialSol = material;
  }

  _aplicar(q) {
    this._limpar();
    this.qualidade = q;
    const { scene, camera, engine } = this;

    engine.setHardwareScalingLevel(q.escala ?? 1);

    // 1) SSAO (antes do pipeline principal, que faz o tone mapping).
    if (q.ssao && SSAO2RenderingPipeline.IsSupported) {
      try {
        const ssao = new SSAO2RenderingPipeline(
          "ssao",
          scene,
          { ssaoRatio: 0.5, blurRatio: 0.5 },
          [camera]
        );
        ssao.radius = 0.9;
        ssao.totalStrength = 0.95;
        ssao.base = 0.08;
        ssao.samples = 16;
        ssao.maxZ = 140;
        ssao.minZAspect = 0.4;
        ssao.expensiveBlur = true;
        ssao.textureSamples = q.msaa;
        this.ssao = ssao;
      } catch (erro) {
        console.warn("SSAO indisponível:", erro);
        this.ssao = null;
      }
    }

    // 2) Raios de sol volumétricos.
    if (q.raios) {
      try {
        const vls = new VolumetricLightScatteringPostProcess(
          "raiosSol",
          { postProcessRatio: 1, passRatio: 0.5 },
          camera,
          null,
          72,
          Texture.BILINEAR_SAMPLINGMODE,
          engine,
          false,
          scene
        );
        vls.exposure = 0.22;
        vls.decay = 0.965;
        vls.weight = 0.55;
        vls.density = 0.93;
        vls.mesh.material.dispose();
        vls.mesh.material = this.materialSol;
        vls.mesh.scaling.setAll(70);
        vls.mesh.isPickable = false;
        this.vls = vls;
        this._seguirSol = scene.onBeforeRenderObservable.add(() => {
          vls.mesh.position.copyFrom(camera.position).addInPlace(this.paraOSol.scale(900));
        });
      } catch (erro) {
        console.warn("Raios de luz indisponíveis:", erro);
        this.vls = null;
      }
    }

    // 3) Pipeline principal (HDR).
    const pipeline = new DefaultRenderingPipeline("pipelineEclipse", true, scene, [camera]);
    pipeline.samples = engine.webGLVersion >= 2 ? q.msaa : 1;
    pipeline.fxaaEnabled = !!q.fxaa;

    pipeline.bloomEnabled = !!q.bloom;
    pipeline.bloomThreshold = 0.9;
    pipeline.bloomWeight = 0.32;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;

    pipeline.sharpenEnabled = !!q.nitidez;
    pipeline.sharpen.edgeAmount = 0.22;
    pipeline.sharpen.colorAmount = 1;

    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 5;
    pipeline.grain.animated = true;

    pipeline.chromaticAberrationEnabled = q.nome !== "baixa";
    pipeline.chromaticAberration.aberrationAmount = 6;
    pipeline.chromaticAberration.radialIntensity = 0.8;

    pipeline.imageProcessingEnabled = true;
    const ip = pipeline.imageProcessing;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.05;
    ip.contrast = 1.12;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 2.4;
    ip.vignetteStretch = 0.5;
    ip.vignetteColor = new Color4(0.06, 0.02, 0.05, 0);
    ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    const curvas = new ColorCurves();
    curvas.globalSaturation = 14;
    curvas.shadowsHue = 215;
    curvas.shadowsDensity = 30;
    curvas.shadowsSaturation = 35;
    curvas.highlightsHue = 32;
    curvas.highlightsDensity = 22;
    curvas.highlightsSaturation = 25;
    ip.colorCurvesEnabled = true;
    ip.colorCurves = curvas;

    this.pipeline = pipeline;

    // 4) Brilho dos materiais emissivos (runas, orbe, olhos, lava).
    if (q.brilho) {
      const brilho = new GlowLayer("brilhoEmissivos", scene, {
        mainTextureRatio: 0.5,
        blurKernelSize: 48
      });
      brilho.intensity = 0.55;
      for (const malha of this.excluirBrilho) {
        if (malha) brilho.addExcludedMesh(malha);
      }
      if (this.vls) brilho.addExcludedMesh(this.vls.mesh);
      this.brilho = brilho;
    }
  }

  _limpar() {
    if (this.brilho) {
      this.brilho.dispose();
      this.brilho = null;
    }
    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }
    if (this._seguirSol) {
      this.scene.onBeforeRenderObservable.remove(this._seguirSol);
      this._seguirSol = null;
    }
    if (this.vls) {
      // O VLS não descarta a própria malha; o material do sol é nosso
      // e é reaproveitado quando os raios voltam a ser ligados.
      const malhaSol = this.vls.mesh;
      this.vls.dispose(this.camera);
      malhaSol.material = null;
      malhaSol.dispose();
      this.vls = null;
    }
    if (this.ssao) {
      this.ssao.dispose(false);
      this.ssao = null;
    }
  }

  /**
   * Ajuste automático: se nos primeiros segundos a média de FPS
   * ficar baixa, desce um nível (só enquanto o jogador não tiver
   * escolhido manualmente com G).
   */
  atualizar(delta) {
    if (!this.ativo || !this._autoAjuste) return;
    this._tempoMonitor += delta;
    if (this._tempoMonitor < 4) return;

    this._amostrasFps.push(this.engine.getFps());
    if (this._amostrasFps.length < 240) return;

    const media = this._amostrasFps.reduce((a, b) => a + b, 0) / this._amostrasFps.length;
    this._amostrasFps = [];
    this._tempoMonitor = 0;

    const i = ORDEM.indexOf(this.qualidade.nome);
    if (media < 28 && i < ORDEM.length - 1) {
      const proxima = QUALIDADES[ORDEM[i + 1]];
      this._aplicar(proxima);
      this.aoMudar?.(proxima, true);
    } else {
      this._autoAjuste = false;
    }
  }

  dispose() {
    if (!this.ativo) return;
    window.removeEventListener("keydown", this._tecla);
    this._limpar();
    this.materialSol?.dispose();
  }
}

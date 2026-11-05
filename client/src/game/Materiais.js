import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";

import { textura } from "./Texturas.js";

/** Converte uma cor sRGB (0..1) para linear, como o PBR espera. */
export function linear(r, g, b) {
  return new Color3(r, g, b).toLinearSpace();
}

/**
 * Cria um material PBR (metal/rugosidade) com as texturas procedurais.
 *
 * opcoes:
 *  cor:        [r, g, b] sRGB
 *  metal:      0..1
 *  rugosidade: 0..1
 *  conjunto:   nome do conjunto de texturas ("pedra", "rocha", ...)
 *  escala:     repetição da textura
 *  nivelNormal intensidade do relevo
 *  normal:     nome de uma textura de normal isolada ("metal", "tecido")
 *  emissiva:   nome da máscara emissiva ("runas", "rachaduras")
 *  corEmissiva [r, g, b] linear (pode passar de 1 para HDR)
 *  duplaFace:  desenha os dois lados
 */
export function criarMaterial(scene, nome, opcoes = {}) {
  const {
    cor = [0.8, 0.8, 0.8],
    metal = 0,
    rugosidade = 0.8,
    conjunto = null,
    escala = 1,
    nivelNormal = 1,
    normal = null,
    emissiva = null,
    corEmissiva = null,
    escalaEmissiva = escala,
    duplaFace = false,
    alpha = 1
  } = opcoes;

  const m = new PBRMaterial(nome, scene);
  m.albedoColor = linear(cor[0], cor[1], cor[2]);
  m.metallic = metal;
  m.roughness = rugosidade;
  m.environmentIntensity = 1;
  m.enableSpecularAntiAliasing = true;
  m.useHorizonOcclusion = true;

  if (conjunto) {
    const t = textura(scene, conjunto);
    if (t.albedo) {
      m.albedoTexture = copiaTextura(t.albedo, escala);
    }
    if (t.normal) {
      m.bumpTexture = copiaTextura(t.normal, escala);
      m.bumpTexture.level = nivelNormal;
    }
    if (t.orm) {
      m.metallicTexture = copiaTextura(t.orm, escala);
      m.useRoughnessFromMetallicTextureGreen = true;
      m.useMetallnessFromMetallicTextureBlue = true;
      m.useAmbientOcclusionFromMetallicTextureRed = true;
      // Com textura, metallic/roughness viram multiplicadores.
      m.metallic = Math.max(metal, 0);
      m.roughness = 1;
    }
  }

  if (normal) {
    // Aceita uma textura isolada ("metal") ou um conjunto ("terreno").
    const t = textura(scene, normal);
    m.bumpTexture = copiaTextura(t.normal ?? t, escala);
    m.bumpTexture.level = nivelNormal;
  }

  if (emissiva) {
    m.emissiveTexture = copiaTextura(textura(scene, emissiva), escalaEmissiva);
    m.emissiveColor = corEmissiva
      ? new Color3(corEmissiva[0], corEmissiva[1], corEmissiva[2])
      : new Color3(1, 1, 1);
  } else if (corEmissiva) {
    m.emissiveColor = new Color3(corEmissiva[0], corEmissiva[1], corEmissiva[2]);
  }

  if (duplaFace) {
    m.backFaceCulling = false;
    m.twoSidedLighting = true;
  }

  if (alpha < 1) {
    m.alpha = alpha;
    m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  }

  return m;
}

/**
 * Cópia leve: compartilha a textura de GPU, mas tem repetição própria.
 * O clone do RawTexture não copia gammaSpace/wrap, então copiamos aqui.
 */
export function copiaTextura(original, escalaU = 1, escalaV = escalaU) {
  const tex = original.clone();
  tex.name = original.name;
  tex.gammaSpace = original.gammaSpace;
  tex.wrapU = original.wrapU;
  tex.wrapV = original.wrapV;
  tex.anisotropicFilteringLevel = original.anisotropicFilteringLevel;
  tex.uScale = escalaU;
  tex.vScale = escalaV;
  return tex;
}

// --------------------------------------------------------------
// Vento: desloca os vértices no shader, proporcional à altura
// local do vértice (a base fica parada, a ponta balança).
// --------------------------------------------------------------

const inicio = typeof performance !== "undefined" ? performance.now() : Date.now();
const agora = () =>
  ((typeof performance !== "undefined" ? performance.now() : Date.now()) - inicio) / 1000;

export class VentoPlugin extends MaterialPluginBase {
  constructor(material, { forca = 0.15, alturaBase = 0, alturaReferencia = 1, frequencia = 1 } = {}) {
    super(material, "Vento", 200, { VENTO: false });
    this.forca = forca;
    this.alturaBase = alturaBase;
    this.alturaReferencia = alturaReferencia;
    this.frequencia = frequencia;
    this._enable(true);
  }

  getClassName() {
    return "VentoPlugin";
  }

  prepareDefines(defines) {
    defines.VENTO = this._isEnabled;
  }

  getUniforms() {
    return {
      ubo: [
        { name: "ventoParams", size: 4, type: "vec4" }
      ],
      vertex: `
        #ifdef VENTO
          uniform vec4 ventoParams;
        #endif
      `
    };
  }

  bindForSubMesh(uniformBuffer) {
    uniformBuffer.updateFloat4(
      "ventoParams",
      agora() * this.frequencia,
      this.forca,
      this.alturaBase,
      1 / this.alturaReferencia
    );
  }

  getCustomCode(shaderType) {
    if (shaderType !== "vertex") return null;
    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
        #ifdef VENTO
        {
          float hVento = max(positionUpdated.y - ventoParams.z, 0.0) * ventoParams.w;
          hVento = hVento * hVento;
          float faseVento = dot(worldPos.xz, vec2(0.13, 0.09));
          float tVento = ventoParams.x;
          float rajada = 0.6 + 0.4 * sin(tVento * 0.35 + worldPos.x * 0.01);
          vec2 deslocVento = vec2(
            sin(tVento * 1.7 + faseVento) + 0.35 * sin(tVento * 4.1 + faseVento * 2.7),
            0.6 * cos(tVento * 1.3 + faseVento * 0.8)
          );
          worldPos.xz += deslocVento * ventoParams.y * hVento * rajada;
          vPositionW = worldPos.xyz;
        }
        #endif
      `
    };
  }
}

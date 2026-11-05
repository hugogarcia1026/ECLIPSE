import "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import "@babylonjs/core/Engines/Extensions/engine.rawTexture.js";
import "@babylonjs/core/Materials/Textures/baseTexture.polynomial.js";

import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial.js";
import { RawCubeTexture } from "@babylonjs/core/Materials/Textures/rawCubeTexture.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { CubeMapToSphericalPolynomialTools } from "@babylonjs/core/Misc/HighDynamicRange/cubemapToSphericalPolynomial.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";

// Paleta do entardecer (espaço linear, HDR).
const ZENITE = [0.045, 0.1, 0.27];
const HORIZONTE_SOL = [1.0, 0.5, 0.24];
const HORIZONTE_OPOSTO = [0.36, 0.33, 0.46];
const COR_SOL = [1.0, 0.62, 0.32];
const CHAO = [0.12, 0.1, 0.1];

// Cor média do horizonte (sRGB), usada na neblina.
export const COR_HORIZONTE = [0.82, 0.62, 0.52];

const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Cor do céu (linear) para uma direção normalizada. A mesma fórmula
 * existe no shader; aqui ela gera a iluminação ambiente (IBL).
 */
export function corDoCeu(dx, dy, dz, sol) {
  const sd = Math.max(0, dx * sol.x + dy * sol.y + dz * sol.z);
  const lh = Math.hypot(dx, dz) || 1;
  const sh = Math.hypot(sol.x, sol.z) || 1;
  const lado = ((dx / lh) * (sol.x / sh) + (dz / lh) * (sol.z / sh)) * 0.5 + 0.5;
  const pesoLado = Math.pow(lado, 1.6);
  const hor = [0, 1, 2].map((i) => mix(HORIZONTE_OPOSTO[i], HORIZONTE_SOL[i], pesoLado));
  const t = Math.pow(clamp(dy, 0, 1), 0.42);
  const c = [0, 1, 2].map((i) => mix(hor[i], ZENITE[i], t));
  const halo = Math.pow(sd, 6) * 0.45 + Math.pow(sd, 48) * 1.4;
  for (let i = 0; i < 3; i++) c[i] += COR_SOL[i] * halo;
  if (dy < 0) {
    const k = clamp(-dy * 5, 0, 1);
    for (let i = 0; i < 3; i++) c[i] = mix(hor[i] * 0.85, CHAO[i], k);
  }
  return c;
}

const VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const FRAGMENT = `
precision highp float;
varying vec3 vDir;
uniform vec3 direcaoSol;
uniform float tempo;
uniform float discoSol;

const vec3 ZENITE = vec3(${ZENITE.join(",")});
const vec3 HORIZONTE_SOL = vec3(${HORIZONTE_SOL.join(",")});
const vec3 HORIZONTE_OPOSTO = vec3(${HORIZONTE_OPOSTO.join(",")});
const vec3 COR_SOL = vec3(${COR_SOL.join(",")});
const vec3 CHAO = vec3(${CHAO.join(",")});

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * ruido(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

void main(void) {
  vec3 dir = normalize(vDir);
  vec3 sol = normalize(direcaoSol);
  float sd = max(dot(dir, sol), 0.0);

  vec2 dh = normalize(dir.xz + 1e-5);
  vec2 sh = normalize(sol.xz + 1e-5);
  float lado = pow(dot(dh, sh) * 0.5 + 0.5, 1.6);
  vec3 horizonte = mix(HORIZONTE_OPOSTO, HORIZONTE_SOL, lado);

  float t = pow(clamp(dir.y, 0.0, 1.0), 0.42);
  vec3 cor = mix(horizonte, ZENITE, t);
  cor += COR_SOL * (pow(sd, 6.0) * 0.45 + pow(sd, 48.0) * 1.4);

  // Nuvens: plano projetado acima do observador.
  if (dir.y > 0.0) {
    vec2 p = dir.xz / (dir.y + 0.08) * 0.55;
    p += vec2(tempo * 0.006, tempo * 0.0025);
    float n = fbm(p * 1.4);
    float detalhe = fbm(p * 4.0 + 3.1);
    float densidade = smoothstep(0.46, 0.8, n * 0.8 + detalhe * 0.25);
    densidade *= smoothstep(0.0, 0.22, dir.y);

    float iluminada = pow(sd, 3.0);
    vec3 sombra = mix(vec3(0.22, 0.17, 0.26), vec3(0.45, 0.28, 0.25), lado);
    vec3 luz = mix(vec3(0.85, 0.5, 0.38), vec3(1.6, 0.85, 0.45), iluminada);
    vec3 nuvem = mix(sombra, luz, clamp(0.35 + (1.0 - n) * 0.6 + iluminada * 0.5, 0.0, 1.0));
    // Borda prateada perto do sol.
    nuvem += COR_SOL * pow(sd, 10.0) * (1.0 - densidade) * 2.5;
    cor = mix(cor, nuvem, densidade * 0.88);
  }

  // Disco solar (HDR, alimenta o bloom).
  float disco = smoothstep(0.99955, 0.99985, sd);
  cor += COR_SOL * disco * 28.0 * discoSol;

  if (dir.y < 0.0) {
    cor = mix(horizonte * 0.85, CHAO, clamp(-dir.y * 5.0, 0.0, 1.0));
  }

  gl_FragColor = vec4(cor, 1.0);
}
`;

/**
 * Domo de céu com shader (degradê, sol HDR e nuvens animadas).
 * `direcaoSol` aponta DO observador PARA o sol.
 */
export function criarCeu(scene, direcaoSol) {
  const raio = 1000;
  const ceu = MeshBuilder.CreateSphere(
    "ceu",
    { diameter: raio * 2, segments: 32, sideOrientation: Mesh.BACKSIDE },
    scene
  );

  const sol = direcaoSol.normalizeToNew();

  const material = new ShaderMaterial(
    "matCeu",
    scene,
    { vertexSource: VERTEX, fragmentSource: FRAGMENT },
    {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "direcaoSol", "tempo", "discoSol"]
    }
  );
  material.backFaceCulling = false;
  material.fogEnabled = false;
  material.setVector3("direcaoSol", sol);
  material.setFloat("tempo", 0);
  material.setFloat("discoSol", 1);

  ceu.material = material;
  ceu.infiniteDistance = true;
  ceu.isPickable = false;
  ceu.applyFog = false;

  let tempo = 0;
  const observador = scene.onBeforeRenderObservable.add(() => {
    tempo += scene.getEngine().getDeltaTime() / 1000;
    material.setFloat("tempo", tempo);
  });
  ceu.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(observador));

  return ceu;
}

/**
 * Gera o mapa de ambiente (cubemap) a partir da fórmula do céu e
 * o usa como iluminação indireta (IBL) dos materiais PBR.
 */
export function criarAmbiente(scene, direcaoSol, tamanho = 64) {
  const sol = direcaoSol.normalizeToNew();
  const faces = CubeMapToSphericalPolynomialTools._FileFaces;
  const dadosGPU = [];
  const info = { size: tamanho, format: 5, type: 1, gammaSpace: false };

  const du = 2 / tamanho;
  const dir = new Vector3();

  for (const face of faces) {
    const bytes = new Uint8Array(tamanho * tamanho * 4);
    const floats = new Float32Array(tamanho * tamanho * 4);
    for (let y = 0; y < tamanho; y++) {
      const v = -1 + du * (y + 0.5);
      for (let x = 0; x < tamanho; x++) {
        const u = -1 + du * (x + 0.5);
        dir.copyFrom(face.worldAxisForNormal)
          .addInPlace(face.worldAxisForFileX.scale(u))
          .addInPlace(face.worldAxisForFileY.scale(v))
          .normalize();
        const c = corDoCeu(dir.x, dir.y, dir.z, sol);
        const i = (y * tamanho + x) * 4;
        for (let k = 0; k < 3; k++) {
          floats[i + k] = c[k];
          bytes[i + k] = Math.round(255 * Math.pow(clamp(c[k], 0, 1), 1 / 2.2));
        }
        floats[i + 3] = 1;
        bytes[i + 3] = 255;
      }
    }
    dadosGPU.push(bytes);
    info[face.name] = floats;
  }

  let ambiente = null;
  try {
    ambiente = new RawCubeTexture(
      scene,
      dadosGPU,
      tamanho,
      5,
      0,
      true,
      false,
      Texture.TRILINEAR_SAMPLINGMODE
    );
    ambiente.name = "ambienteCeu";
    ambiente.gammaSpace = true;
    ambiente.sphericalPolynomial =
      CubeMapToSphericalPolynomialTools.ConvertCubeMapToSphericalPolynomial(info);
    scene.environmentTexture = ambiente;
    scene.environmentIntensity = 0.85;
  } catch (erro) {
    // Sem suporte a cubemap: os materiais usam só as luzes diretas.
    ambiente = null;
  }

  return ambiente;
}

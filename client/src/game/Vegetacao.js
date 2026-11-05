
import "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import "@babylonjs/core/Meshes/Builders/icoSphereBuilder.js";
import "@babylonjs/core/Meshes/thinInstanceMesh.js";

import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";

import {
  Matrix,
  Quaternion,
  Vector3
} from "@babylonjs/core/Maths/math.vector.js";

import {
  alturaEm,
  NIVEL_AGUA,
  RAIO_RUINAS
} from "./Terreno.js";

import {
  fbm,
  ruidoValor,
  criarRng,
  suavizar
} from "./Ruido.js";

import { criarMaterial, VentoPlugin } from "./Materiais.js";

const L = (v) => Math.pow(v, 2.2);

function matriz(x, y, z, rotY, sx, sy, sz, inclinacaoX = 0, inclinacaoZ = 0) {
  return Matrix.Compose(
    new Vector3(sx, sy, sz),
    Quaternion.RotationYawPitchRoll(rotY, inclinacaoX, inclinacaoZ),
    new Vector3(x, y, z)
  );
}

function aplicarInstancias(malha, matrizes, cores) {
  const buffer = new Float32Array(matrizes.length * 16);

  matrizes.forEach((m, i) => {
    m.copyToArray(buffer, i * 16);
  });

  malha.thinInstanceSetBuffer("matrix", buffer, 16, true);

  if (cores) {
    malha.thinInstanceSetBuffer(
      "color",
      new Float32Array(cores),
      4,
      true
    );
  }

  malha.thinInstanceRefreshBoundingInfo(false);
  malha.alwaysSelectAsActiveMesh = true;
  malha.isPickable = false;
}

function inclinacao(x, z) {
  const d = 2;

  const dx = alturaEm(x + d, z) - alturaEm(x - d, z);
  const dz = alturaEm(x, z + d) - alturaEm(x, z - d);

  return Math.hypot(dx, dz) / (2 * d);
}

/** Desloca vértices de uma malha com uma função e recalcula normais. */
function deformar(malha, fn) {
  const pos = malha.getVerticesData(VertexBuffer.PositionKind);
  for (let i = 0; i < pos.length; i += 3) {
    const r = fn(pos[i], pos[i + 1], pos[i + 2]);
    pos[i] = r[0];
    pos[i + 1] = r[1];
    pos[i + 2] = r[2];
  }
  const normais = [];
  VertexData.ComputeNormals(pos, malha.getIndices(), normais);
  malha.setVerticesData(VertexBuffer.PositionKind, pos);
  malha.setVerticesData(VertexBuffer.NormalKind, normais);
  return { pos, normais };
}

function pintar(malha, fn) {
  const pos = malha.getVerticesData(VertexBuffer.PositionKind);
  const normais = malha.getVerticesData(VertexBuffer.NormalKind);
  const cores = new Float32Array((pos.length / 3) * 4);
  for (let v = 0; v < pos.length / 3; v++) {
    const c = fn(
      pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2],
      normais[v * 3], normais[v * 3 + 1], normais[v * 3 + 2]
    );
    cores[v * 4] = c[0];
    cores[v * 4 + 1] = c[1];
    cores[v * 4 + 2] = c[2];
    cores[v * 4 + 3] = 1;
  }
  malha.setVerticesData(VertexBuffer.ColorKind, cores);
}

// --------------------------------------------------------------
// PINHEIROS
// --------------------------------------------------------------

function criarCopaPinheiro(scene) {
  const camadas = [
    { d: 6.8, h: 4.2, y: 5.2 },
    { d: 5.9, h: 3.9, y: 7.2 },
    { d: 4.9, h: 3.6, y: 9.0 },
    { d: 3.8, h: 3.2, y: 10.7 },
    { d: 2.6, h: 2.8, y: 12.2 },
    { d: 1.4, h: 2.2, y: 13.6 }
  ];

  const partes = camadas.map(({ d, h, y }, k) => {
    const cone = MeshBuilder.CreateCylinder(
      `copaCamada${k}`,
      {
        diameterTop: 0,
        diameterBottom: d,
        height: h,
        tessellation: 16,
        subdivisions: 3
      },
      scene
    );

    deformar(cone, (px, py, pz) => {
      const ang = Math.atan2(pz, px);
      const r = Math.hypot(px, pz);
      if (r < 1e-4) return [px, py + y, pz];
      // Pontas de galhos (forma de estrela) e irregularidade.
      const pontas = 1 + 0.22 * Math.max(0, Math.cos(ang * 7 + k * 1.3));
      const irregular = 0.88 + 0.24 * ruidoValor(ang * 2.2 + k * 5.1, py * 0.8 + k);
      const fator = pontas * irregular;
      // Galhos caídos: a borda de baixo desce um pouco.
      const base = py < -h / 2 + 0.05 ? -0.35 * fator : 0;
      return [px * fator, py + y + base, pz * fator];
    });

    return cone;
  });

  const copa = Mesh.MergeMeshes(partes, true);

  // Normais "esféricas": a copa é iluminada como um volume macio.
  const pos = copa.getVerticesData(VertexBuffer.PositionKind);
  const normais = copa.getVerticesData(VertexBuffer.NormalKind);
  for (let i = 0; i < pos.length; i += 3) {
    let nx = pos[i];
    let ny = (pos[i + 1] - 8.5) * 0.45;
    let nz = pos[i + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx = nx / l * 0.65 + normais[i] * 0.35;
    ny = ny / l * 0.65 + normais[i + 1] * 0.35;
    nz = nz / l * 0.65 + normais[i + 2] * 0.35;
    const l2 = Math.hypot(nx, ny, nz) || 1;
    normais[i] = nx / l2;
    normais[i + 1] = ny / l2;
    normais[i + 2] = nz / l2;
  }
  copa.setVerticesData(VertexBuffer.NormalKind, normais);

  pintar(copa, (x, y, z) => {
    const r = Math.hypot(x, z);
    const externo = Math.min(1, r / 3);
    const alto = Math.min(1, Math.max(0, (y - 4) / 11));
    const k = 0.45 + 0.4 * externo + 0.25 * alto;
    return [L(0.2 * k), L(0.33 * k), L(0.16 * k)];
  });

  return copa;
}

/**
 * Pinheiros em manchas de floresta.
 */
export function criarArvores(scene, semente = 7, maximo = 150) {
  const rng = criarRng(semente);

  const troncoBase = MeshBuilder.CreateCylinder(
    "troncoBase",
    {
      diameterTop: 0.35,
      diameterBottom: 0.85,
      height: 14,
      tessellation: 10,
      subdivisions: 6
    },
    scene
  );

  deformar(troncoBase, (x, y, z) => {
    // Raízes alargadas na base e leve curvatura.
    const ang = Math.atan2(z, x);
    const base = Math.max(0, -y - 5) / 2;
    const raiz = 1 + base * (0.5 + 0.5 * Math.cos(ang * 5));
    const curva = Math.sin((y + 7) * 0.25) * 0.08;
    return [x * raiz + curva, y + 7, z * raiz];
  });

  const tronco = Mesh.MergeMeshes([troncoBase], true);
  tronco.name = "troncosArvores";

  const copa = criarCopaPinheiro(scene);
  copa.name = "copasArvores";

  const matTronco = criarMaterial(scene, "matTronco", {
    cor: [0.42, 0.33, 0.27],
    rugosidade: 0.95,
    conjunto: "casca",
    escala: 2,
    nivelNormal: 1.2
  });
  matTronco.albedoTexture.vScale = 6;
  matTronco.bumpTexture.vScale = 6;

  const matCopa = criarMaterial(scene, "matCopa", {
    cor: [1, 1, 1],
    rugosidade: 0.8,
    normal: "terreno",
    escala: 3,
    nivelNormal: 0.6
  });
  matCopa.metallic = 0;
  // Luz atravessando as agulhas quando o sol está atrás (contraluz).
  matCopa.subSurface.isTranslucencyEnabled = true;
  matCopa.subSurface.translucencyIntensity = 0.2;
  matCopa.subSurface.tintColor.set(0.35, 0.6, 0.2);

  new VentoPlugin(matCopa, { forca: 0.1, alturaBase: 4, alturaReferencia: 11 });

  tronco.material = matTronco;
  copa.material = matCopa;

  const matrizes = [];
  const cores = [];
  const colisoes = [];

  for (
    let tentativa = 0;
    tentativa < 4000 && matrizes.length < maximo;
    tentativa++
  ) {
    const x = (rng() - 0.5) * 480;
    const z = (rng() - 0.5) * 480;

    if (Math.hypot(x, z) < RAIO_RUINAS + 15) continue;

    if (fbm(x * 0.012 + 3, z * 0.012 - 7, 3) < 0.52) {
      continue;
    }

    const y = alturaEm(x, z);

    if (
      y < NIVEL_AGUA + 1.2 ||
      y > 40 ||
      inclinacao(x, z) > 0.55
    ) {
      continue;
    }

    const e = 0.8 + rng() * 0.9;

    matrizes.push(
      matriz(
        x,
        y - 0.3,
        z,
        rng() * 6.28,
        e,
        e * (0.9 + rng() * 0.3),
        e
      )
    );

    const t = 0.8 + rng() * 0.4;

    cores.push(
      t,
      t * (0.95 + rng() * 0.15),
      t * 0.9,
      1
    );

    colisoes.push({
      x,
      z,
      raio: 0.55 * e
    });
  }

  aplicarInstancias(tronco, matrizes);
  aplicarInstancias(copa, matrizes, cores);

  return {
    tronco,
    copa,
    quantidade: matrizes.length,
    colisoes
  };
}

// --------------------------------------------------------------
// ROCHAS
// --------------------------------------------------------------

function criarFormaRocha(scene, nome, semente, subdivisoes = 4) {
  const rocha = MeshBuilder.CreateIcoSphere(
    nome,
    { radius: 1, subdivisions: subdivisoes },
    scene
  );

  deformar(rocha, (x, y, z) => {
    const s = semente * 3.7;
    const grande = ruidoValor(x * 1.3 + y * 2.1 + s, z * 1.3 - y * 1.7 - s);
    const medio = ruidoValor(x * 3.1 - y * 2.9 + s * 2, z * 3.1 + y * 3.3);
    const fino = ruidoValor(x * 7.3 + y * 5.1, z * 7.3 - y * 6.7 + s);
    let f = 0.68 + 0.5 * grande + 0.18 * medio + 0.05 * fino;
    // Facetas: achata partes da superfície como rocha quebrada.
    const faceta = Math.max(0, ruidoValor(x * 2 + s, z * 2 + y * 2) - 0.55) * 0.6;
    f -= faceta;
    let ny = y * f * 0.78;
    // Base achatada (apoia no chão).
    if (ny < -0.35) ny = -0.35 + (ny + 0.35) * 0.25;
    return [x * f, ny, z * f];
  });

  pintar(rocha, (x, y, z, _nx, ny) => {
    const musgo = Math.max(0, Math.min(1, (ny - 0.45) * 2.5)) *
      (0.4 + 0.6 * ruidoValor(x * 2 + semente, z * 2));
    const base = 0.62 + 0.38 * Math.min(1, (y + 0.35) * 1.2);
    const r = 0.56 * base;
    const g = 0.54 * base;
    const b = 0.5 * base;
    return [
      L(r * (1 - musgo) + 0.24 * musgo),
      L(g * (1 - musgo) + 0.32 * musgo),
      L(b * (1 - musgo) + 0.12 * musgo)
    ];
  });

  return rocha;
}

/**
 * Rochas irregulares em instâncias (3 formatos diferentes) e seixos.
 */
export function criarRochas(scene, semente = 21, quantidade = 70) {
  const rng = criarRng(semente);

  const mat = criarMaterial(scene, "matRocha", {
    cor: [1, 1, 1],
    rugosidade: 0.88,
    conjunto: "rocha",
    escala: 1.5,
    nivelNormal: 1.1
  });

  const formas = [0, 1, 2].map((i) => {
    const forma = criarFormaRocha(scene, i === 0 ? "rochasBase" : `rochasBase${i}`, i + 1);
    forma.material = mat;
    return forma;
  });

  const matrizesPorForma = [[], [], []];
  const colisoes = [];
  let total = 0;

  for (
    let tentativa = 0;
    tentativa < 2000 && total < quantidade;
    tentativa++
  ) {
    const x = (rng() - 0.5) * 500;
    const z = (rng() - 0.5) * 500;

    if (Math.hypot(x, z) < RAIO_RUINAS + 5) continue;

    const y = alturaEm(x, z);

    if (y < NIVEL_AGUA - 0.4 || y > 45) continue;

    const e = 0.8 + rng() * rng() * 5;
    const rotacao = rng() * 6.28;

    const escalaX = e * (1 + rng() * 0.8);
    const escalaY = e * (0.7 + rng() * 0.5);
    const escalaZ = e * (1 + rng() * 0.6);

    matrizesPorForma[total % 3].push(
      matriz(
        x,
        y + e * 0.2,
        z,
        rotacao,
        escalaX,
        escalaY,
        escalaZ
      )
    );

    colisoes.push({
      x,
      z,
      raio: Math.max(escalaX, escalaZ) * 0.85
    });

    total++;
  }

  formas.forEach((forma, i) => aplicarInstancias(forma, matrizesPorForma[i]));

  // Seixos decorativos (sem colisão): dão escala e detalhe ao chão.
  const seixos = criarFormaRocha(scene, "seixos", 7, 2);
  seixos.material = mat;
  const rngSeixos = criarRng(semente + 1000);
  const matrizesSeixos = [];
  for (let i = 0; i < 6000 && matrizesSeixos.length < 900; i++) {
    const ang = rngSeixos() * Math.PI * 2;
    const dist = 24 + Math.pow(rngSeixos(), 1.6) * 230;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    // Fora do topo das plataformas (|x|,|z| < 22).
    if (Math.abs(x) < 23 && Math.abs(z) < 23) continue;
    const y = alturaEm(x, z);
    if (y < NIVEL_AGUA - 0.6 || y > 45) continue;
    const e = 0.08 + Math.pow(rngSeixos(), 3) * 0.35;
    matrizesSeixos.push(
      matriz(x, y + e * 0.1, z, rngSeixos() * 6.28, e * (1 + rngSeixos()), e * 0.7, e)
    );
  }
  aplicarInstancias(seixos, matrizesSeixos);

  return {
    rocha: formas[0],
    malhas: formas,
    seixos,
    quantidade: total,
    colisoes
  };
}

// --------------------------------------------------------------
// GRAMA, FLORES E ARBUSTOS (decorativos, sem colisão)
// --------------------------------------------------------------

/** Tufo de grama: lâminas curvas em leque. */
function criarTufo(scene, nome, laminas = 9) {
  const rng = criarRng(99);
  const posicoes = [];
  const indices = [];
  const normais = [];
  const cores = [];
  const segmentos = 3;

  for (let b = 0; b < laminas; b++) {
    const ang = (b / laminas) * Math.PI * 2 + rng() * 0.6;
    const dist = rng() * 0.14;
    const bx = Math.cos(ang) * dist;
    const bz = Math.sin(ang) * dist;
    const altura = 0.38 + rng() * 0.38;
    const largura = 0.07 + rng() * 0.04;
    const curva = 0.12 + rng() * 0.22;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    // Vetor lateral da lâmina.
    const lx = -dirZ;
    const lz = dirX;
    const inicio = posicoes.length / 3;

    for (let s = 0; s <= segmentos; s++) {
      const t = s / segmentos;
      const w = largura * (1 - t) * 0.5;
      const desloc = curva * t * t;
      const cx = bx + dirX * desloc;
      const cz = bz + dirZ * desloc;
      const cy = altura * t;
      posicoes.push(cx - lx * w, cy, cz - lz * w, cx + lx * w, cy, cz + lz * w);
      for (let k = 0; k < 2; k++) {
        normais.push(0, 1, 0);
        const base = 0.45 + 0.55 * t;
        cores.push(L(0.42 * base), L(0.52 * base), L(0.2 * base), 1);
      }
    }
    for (let s = 0; s < segmentos; s++) {
      const a = inicio + s * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const malha = new Mesh(nome, scene);
  const dados = new VertexData();
  dados.positions = posicoes;
  dados.indices = indices;
  dados.normals = normais;
  dados.colors = cores;
  dados.applyToMesh(malha);
  return malha;
}

/** Flor: hastes finas com uma corola colorida (cor por instância). */
function criarFlor(scene) {
  const haste = MeshBuilder.CreateCylinder(
    "hasteFlor",
    { height: 0.45, diameterTop: 0.012, diameterBottom: 0.02, tessellation: 4 },
    scene
  );
  haste.position.y = 0.225;
  const corola = MeshBuilder.CreateIcoSphere(
    "corolaFlor",
    { radius: 0.06, subdivisions: 1 },
    scene
  );
  corola.position.y = 0.47;
  corola.scaling.y = 0.45;
  pintar(haste, () => [L(0.2), L(0.35), L(0.12)]);
  pintar(corola, () => [1, 1, 1]);
  const flor = Mesh.MergeMeshes([haste, corola], true);
  flor.name = "flores";
  return flor;
}

/**
 * Grama, flores e arbustos espalhados onde o terreno é gramado.
 * `densidade` (0..1) vem da qualidade gráfica.
 */
export function criarCobertura(scene, densidade = 1) {
  const rng = criarRng(515);

  const matGrama = criarMaterial(scene, "matGrama", {
    cor: [1, 1, 1],
    rugosidade: 0.85,
    duplaFace: true
  });
  // As normais da grama apontam para cima; os dois lados recebem a mesma luz.
  matGrama.twoSidedLighting = false;
  matGrama.subSurface.isTranslucencyEnabled = true;
  matGrama.subSurface.translucencyIntensity = 0.22;
  matGrama.subSurface.tintColor.set(0.45, 0.65, 0.2);
  new VentoPlugin(matGrama, { forca: 0.16, alturaBase: 0, alturaReferencia: 0.6, frequencia: 1.4 });

  const grama = criarTufo(scene, "grama");
  grama.material = matGrama;

  const flor = criarFlor(scene);
  const matFlor = criarMaterial(scene, "matFlor", { cor: [1, 1, 1], rugosidade: 0.7 });
  new VentoPlugin(matFlor, { forca: 0.2, alturaBase: 0, alturaReferencia: 0.5, frequencia: 1.4 });
  flor.material = matFlor;

  const matrizesGrama = [];
  const coresGrama = [];
  const matrizesFlor = [];
  const coresFlor = [];

  const alvoGrama = Math.round(26000 * densidade);
  const alvoFlor = Math.round(1800 * densidade);
  const paletaFlores = [
    [1.0, 0.82, 0.25],
    [0.95, 0.93, 0.85],
    [0.75, 0.45, 0.85],
    [0.95, 0.4, 0.3]
  ];

  for (let i = 0; i < alvoGrama * 6 && matrizesGrama.length < alvoGrama; i++) {
    // Mais densidade perto da área jogável central.
    const ang = rng() * Math.PI * 2;
    const dist = 26 + Math.pow(rng(), 1.35) * 250;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;

    if (Math.abs(x) < 22.5 && Math.abs(z) < 22.5) continue;

    const y = alturaEm(x, z);
    if (y < NIVEL_AGUA + 0.5 || y > 42) continue;
    if (inclinacao(x, z) > 0.45) continue;

    const terraBatida = 1 - suavizar(30, 75, dist);
    const mancha = fbm(x * 0.045 + 2, z * 0.045 - 5, 3);
    const chance = (1 - terraBatida * 0.8) * suavizar(0.32, 0.55, mancha);
    if (rng() > chance) continue;

    const e = 0.7 + rng() * 0.7;
    matrizesGrama.push(
      matriz(x, y - 0.04, z, rng() * 6.28, e, e * (0.8 + rng() * 0.5), e)
    );
    const seca = suavizar(0.45, 0.75, fbm(x * 0.009 - 11, z * 0.009 + 4, 3));
    const t = 0.85 + rng() * 0.3;
    coresGrama.push(t * (1 + seca * 0.45), t * (1 + seca * 0.1), t * (1 - seca * 0.35), 1);

    if (matrizesFlor.length < alvoFlor && rng() < 0.09) {
      const fx = x + (rng() - 0.5) * 0.8;
      const fz = z + (rng() - 0.5) * 0.8;
      matrizesFlor.push(matriz(fx, alturaEm(fx, fz) - 0.02, fz, rng() * 6.28, 1, 0.8 + rng() * 0.6, 1));
      const p = paletaFlores[Math.floor(rng() * paletaFlores.length)];
      coresFlor.push(L(p[0]), L(p[1]), L(p[2]), 1);
    }
  }

  aplicarInstancias(grama, matrizesGrama, coresGrama);
  aplicarInstancias(flor, matrizesFlor, coresFlor);

  // Arbustos: volumes de folhagem baixos.
  const arbusto = MeshBuilder.CreateIcoSphere("arbustos", { radius: 1, subdivisions: 3 }, scene);
  deformar(arbusto, (x, y, z) => {
    const f = 0.75 + 0.45 * ruidoValor(x * 2.5 + y * 3, z * 2.5 - y * 2) + 0.12 * ruidoValor(x * 6, z * 6 + y * 5);
    return [x * f, Math.max(-0.2, y * f * 0.7) + 0.2, z * f];
  });
  pintar(arbusto, (_x, y) => {
    const k = 0.45 + 0.55 * Math.min(1, (y + 0.1) / 1.0);
    return [L(0.22 * k), L(0.33 * k), L(0.14 * k)];
  });
  const matArbusto = criarMaterial(scene, "matArbusto", {
    cor: [1, 1, 1],
    rugosidade: 0.85,
    normal: "terreno",
    escala: 2,
    nivelNormal: 0.8
  });
  matArbusto.subSurface.isTranslucencyEnabled = true;
  matArbusto.subSurface.translucencyIntensity = 0.2;
  matArbusto.subSurface.tintColor.set(0.6, 0.8, 0.3);
  new VentoPlugin(matArbusto, { forca: 0.05, alturaBase: 0, alturaReferencia: 1.2 });
  arbusto.material = matArbusto;

  const matrizesArbusto = [];
  const coresArbusto = [];
  const alvoArbusto = Math.round(320 * Math.max(0.4, densidade));
  for (let i = 0; i < 8000 && matrizesArbusto.length < alvoArbusto; i++) {
    const x = (rng() - 0.5) * 500;
    const z = (rng() - 0.5) * 500;
    const dc = Math.hypot(x, z);
    if (dc < 40) continue;
    const y = alturaEm(x, z);
    if (y < NIVEL_AGUA + 0.8 || y > 38 || inclinacao(x, z) > 0.5) continue;
    if (fbm(x * 0.02 + 7, z * 0.02 - 3, 3) < 0.5) continue;
    const e = 0.5 + rng() * 1.1;
    matrizesArbusto.push(matriz(x, y - 0.1, z, rng() * 6.28, e * (1 + rng() * 0.5), e, e));
    const t = 0.8 + rng() * 0.35;
    coresArbusto.push(t, t, t * 0.9, 1);
  }
  aplicarInstancias(arbusto, matrizesArbusto, coresArbusto);

  return {
    grama,
    flor,
    arbusto,
    quantidadeGrama: matrizesGrama.length,
    quantidadeArbustos: matrizesArbusto.length
  };
}

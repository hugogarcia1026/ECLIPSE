import "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import "@babylonjs/core/Meshes/Builders/latheBuilder.js";
import "@babylonjs/core/Meshes/Builders/torusBuilder.js";
import "@babylonjs/core/Meshes/thinInstanceMesh.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";

import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { FresnelParameters } from "@babylonjs/core/Materials/fresnelParameters.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3, Vector4, Matrix, Quaternion } from "@babylonjs/core/Maths/math.vector.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { Constants } from "@babylonjs/core/Engines/constants.js";

import { alturaEm } from "./Terreno.js";
import { criarRng, ruidoValor } from "./Ruido.js";
import { criarMaterial, copiaTextura } from "./Materiais.js";
import { textura } from "./Texturas.js";

const L = (v) => Math.pow(v, 2.2);

// --------------------------------------------------------------
// Utilitários de geometria
// --------------------------------------------------------------

function escalarUV(malha, su, sv) {
  const uv = malha.getVerticesData(VertexBuffer.UVKind);
  if (!uv) return;
  for (let i = 0; i < uv.length; i += 2) {
    uv[i] *= su;
    uv[i + 1] *= sv;
  }
  malha.setVerticesData(VertexBuffer.UVKind, uv);
}

function recalcularNormais(malha, pos) {
  const normais = [];
  VertexData.ComputeNormals(pos, malha.getIndices(), normais);
  malha.setVerticesData(VertexBuffer.PositionKind, pos);
  malha.setVerticesData(VertexBuffer.NormalKind, normais);
}

/**
 * Desgaste por cor de vértice: sujeira na base, escorridos
 * verticais e musgo nas faces voltadas para cima/norte.
 */
function envelhecer(malha, { semente = 0, alturaSujeira = 1.2, musgo = 0.6 } = {}) {
  const pos = malha.getVerticesData(VertexBuffer.PositionKind);
  const normais = malha.getVerticesData(VertexBuffer.NormalKind);
  const cores = new Float32Array((pos.length / 3) * 4);
  const info = malha.getBoundingInfo().boundingBox;
  const minY = info.minimum.y;

  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    const ny = normais[v * 3 + 1];
    const nz = normais[v * 3 + 2];
    const ang = Math.atan2(z, x);

    const altura = y - minY;
    const sujeira = Math.max(0, 1 - altura / alturaSujeira) * 0.55;
    const escorrido = Math.max(0, ruidoValor(ang * 4 + semente, y * 0.15) - 0.55) * 1.2;
    const manchaMusgo =
      Math.max(0, ruidoValor(x * 0.6 + semente * 3, z * 0.6 + y * 0.4) - 0.45) * 2;
    const voltadoMusgo = Math.max(0, ny) * 0.7 + Math.max(0, nz) * 0.3 + (altura < 1.5 ? 0.4 : 0);
    const m = Math.min(1, manchaMusgo * voltadoMusgo * musgo);

    let k = 1 - sujeira - escorrido * 0.25;
    let r = k;
    let g = k * 0.98;
    let b = k * 0.95;
    r = r * (1 - m) + 0.32 * m;
    g = g * (1 - m) + 0.42 * m;
    b = b * (1 - m) + 0.18 * m;
    cores[v * 4] = L(Math.max(0.05, r));
    cores[v * 4 + 1] = L(Math.max(0.05, g));
    cores[v * 4 + 2] = L(Math.max(0.05, b));
    cores[v * 4 + 3] = 1;
  }
  malha.setVerticesData(VertexBuffer.ColorKind, cores);
}

/**
 * Fuste de coluna canelado (16 caneluras), com êntase e, se
 * `quebra` > 0, topo irregular de coluna partida.
 */
function criarFuste(scene, nome, altura, diametro, { quebraTopo = 0, quebraBase = 0, semente = 0 } = {}) {
  const fuste = MeshBuilder.CreateCylinder(
    nome,
    {
      height: altura,
      diameter: diametro,
      tessellation: 48,
      subdivisions: Math.max(4, Math.round(altura * 1.5))
    },
    scene
  );

  const pos = fuste.getVerticesData(VertexBuffer.PositionKind);
  const meia = altura / 2;

  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i];
    let y = pos[i + 1];
    const z = pos[i + 2];
    const r = Math.hypot(x, z);
    const ang = Math.atan2(z, x);
    const t = (y + meia) / altura;

    let fator = 1;
    if (r > 1e-4) {
      const canelura = Math.pow(0.5 + 0.5 * Math.cos(ang * 16), 3);
      fator *= 1 - 0.06 * canelura;
      // Êntase: leve barriga e afinamento para o alto.
      fator *= 1 + 0.025 * Math.sin(Math.PI * t) - 0.05 * t;
      // Lascas pequenas.
      fator *= 1 - 0.03 * Math.max(0, ruidoValor(ang * 3 + semente, y * 1.3) - 0.6);
    }

    if (quebraTopo > 0 && y > meia - 0.01) {
      y -= quebraTopo * (0.15 + 0.85 * ruidoValor(Math.cos(ang) * 1.7 + semente, Math.sin(ang) * 1.7 + r));
    }
    if (quebraBase > 0 && y < -meia + 0.01) {
      y += quebraBase * (0.15 + 0.85 * ruidoValor(Math.cos(ang) * 1.9 - semente, Math.sin(ang) * 1.9 - r));
    }

    pos[i] = x * fator;
    pos[i + 1] = y;
    pos[i + 2] = z * fator;
  }

  recalcularNormais(fuste, pos);
  escalarUV(fuste, 2, altura / 3.5);
  return fuste;
}

/** Anel plano (faixa de runas no chão), UV: u ao longo do anel, v radial. */
function criarAnelPlano(scene, nome, raioInterno, raioExterno, segmentos = 96, repeticoes = 10) {
  const posicoes = [];
  const uvs = [];
  const indices = [];
  const normais = [];
  for (let i = 0; i <= segmentos; i++) {
    const a = (i / segmentos) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    posicoes.push(c * raioInterno, 0, s * raioInterno, c * raioExterno, 0, s * raioExterno);
    uvs.push((i / segmentos) * repeticoes, 0, (i / segmentos) * repeticoes, 1);
    normais.push(0, 1, 0, 0, 1, 0);
    if (i < segmentos) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const malha = new Mesh(nome, scene);
  const dados = new VertexData();
  dados.positions = posicoes;
  dados.uvs = uvs;
  dados.indices = indices;
  dados.normals = normais;
  dados.applyToMesh(malha);
  return malha;
}

// --------------------------------------------------------------
// RUÍNAS
// --------------------------------------------------------------

export function criarRuinas(scene) {
  const malhas = [];
  const obstaculos = [];
  const plataformas = [];
  const semSombra = [];

  const rng = criarRng(83);
  // Gerador separado para os detalhes visuais: não altera a
  // sequência do `rng` original (posições e colisões ficam iguais).
  const rngDetalhe = criarRng(1983);

  const matLajotas = criarMaterial(scene, "materialLajotas", {
    cor: [0.9, 0.84, 0.74],
    conjunto: "lajotas",
    nivelNormal: 1.1
  });

  const matPedra = criarMaterial(scene, "materialPedraRuinas", {
    cor: [0.88, 0.82, 0.72],
    conjunto: "pedra",
    nivelNormal: 1.0
  });

  const matPedraEscura = criarMaterial(scene, "materialPedraClara", {
    cor: [0.6, 0.58, 0.55],
    conjunto: "pedra",
    nivelNormal: 1.2
  });

  const matMonolito = criarMaterial(scene, "materialMonolito", {
    cor: [0.5, 0.48, 0.47],
    conjunto: "rocha",
    nivelNormal: 1.1,
    emissiva: "runasColuna",
    corEmissiva: [0.12, 0.45, 1.0],
    escalaEmissiva: 1
  });

  function adicionar(malha, material = matPedra) {
    malha.material = material;
    malha.receiveShadows = true;
    malha.isPickable = false;
    malhas.push(malha);
    return malha;
  }

  // --------------------------------------------------
  // PLATAFORMAS CENTRAIS
  // --------------------------------------------------

  const degraus = [
    { tamanho: 44, altura: 0.8 },
    { tamanho: 38, altura: 1.6 },
    { tamanho: 32, altura: 2.4 }
  ];

  const blocoTextura = 8; // metros por repetição da textura de lajotas

  for (let i = 0; i < degraus.length; i++) {
    const degrau = degraus[i];
    const yBase = alturaEm(0, 0);

    const ladoU = degrau.tamanho / blocoTextura;
    const ladoV = degrau.altura / blocoTextura;
    const topo = new Vector4(0, 0, ladoU, ladoU);
    const lado = new Vector4(0, 0, ladoU, ladoV);

    const caixa = MeshBuilder.CreateBox(
      `plataformaCentral_${i}`,
      {
        width: degrau.tamanho,
        depth: degrau.tamanho,
        height: degrau.altura,
        faceUV: [lado, lado, lado, lado, topo, topo],
        wrap: true
      },
      scene
    );

    caixa.position.set(0, yBase + degrau.altura / 2, 0);
    adicionar(caixa, matLajotas);

    // Cornija: friso fino no alto de cada degrau (puramente visual,
    // fica dentro da área de colisão do degrau).
    const cornija = MeshBuilder.CreateBox(
      `cornijaPlataforma_${i}`,
      {
        width: degrau.tamanho + 0.24,
        depth: degrau.tamanho + 0.24,
        height: 0.16,
        faceUV: [lado, lado, lado, lado, topo, topo],
        wrap: true
      },
      scene
    );
    // Topo 2 cm abaixo do piso: evita z-fighting com a plataforma.
    cornija.position.set(0, yBase + degrau.altura - 0.1, 0);
    adicionar(cornija, matPedra);

    plataformas.push({
      x: 0,
      z: 0,
      largura: degrau.tamanho,
      profundidade: degrau.tamanho,
      topo: yBase + degrau.altura
    });

    obstaculos.push({
      tipo: "retangulo",
      x: 0,
      z: 0,
      largura: degrau.tamanho,
      profundidade: degrau.tamanho,
      topo: yBase + degrau.altura
    });
  }

  // --------------------------------------------------
  // COLUNAS AO REDOR DO MONUMENTO
  // --------------------------------------------------

  const alturasColunas = [
    14, 14, 9, 14, 5, 14,
    14, 11, 14, 6, 14, 12
  ];

  const pontasQuebradas = [];

  for (let i = 0; i < alturasColunas.length; i++) {
    const angulo = (i / alturasColunas.length) * Math.PI * 2;
    const raio = 13;

    const x = Math.cos(angulo) * raio;
    const z = Math.sin(angulo) * raio;
    const altura = alturasColunas[i];
    const inteira = altura >= 14;

    // As colunas ficam sobre a plataforma superior, e não
    // enterradas nela (a base considera a altura dos degraus).
    const base = alturaDaPlataforma(x, z, alturaEm(x, z));

    const coluna = criarFuste(scene, `colunaRuina_${i}`, altura, 2.2, {
      quebraTopo: inteira ? 0 : 1.1,
      semente: i * 7.3
    });

    coluna.position.set(x, base + altura / 2, z);
    coluna.rotation.y = rngDetalhe() * Math.PI * 2;
    envelhecer(coluna, { semente: i, alturaSujeira: 2.2 });
    adicionar(coluna, matPedra);

    // Base (plinto + toro).
    const plinto = MeshBuilder.CreateBox(`plintoRuina_${i}`, { width: 2.6, depth: 2.6, height: 0.45 }, scene);
    plinto.position.set(x, base + 0.225, z);
    plinto.rotation.y = angulo;
    adicionar(plinto, matPedraEscura);

    const toro = MeshBuilder.CreateCylinder(
      `toroRuina_${i}`,
      { height: 0.32, diameterTop: 2.25, diameterBottom: 2.5, tessellation: 32 },
      scene
    );
    toro.position.set(x, base + 0.6, z);
    escalarUV(toro, 2, 0.2);
    adicionar(toro, matPedra);

    obstaculos.push({
      x,
      z,
      raio: 1.25
    });

    if (inteira) {
      // Capitel: equino (curvo) + ábaco (placa).
      const equino = MeshBuilder.CreateCylinder(
        `equinoRuina_${i}`,
        { height: 0.55, diameterTop: 3.0, diameterBottom: 2.05, tessellation: 32 },
        scene
      );
      equino.position.set(x, base + altura + 0.2, z);
      escalarUV(equino, 2, 0.3);
      adicionar(equino, matPedra);

      const capitel = MeshBuilder.CreateBox(
        `capitelRuina_${i}`,
        { width: 3.2, height: 0.7, depth: 3.2 },
        scene
      );
      capitel.position.set(x, base + altura + 0.8, z);
      capitel.rotation.y = angulo;
      adicionar(capitel, matPedra);
    } else {
      pontasQuebradas.push({ x, z, base, altura });
    }
  }

  // --------------------------------------------------
  // COLUNAS CAÍDAS (tambores separados)
  // --------------------------------------------------

  for (let i = 0; i < 6; i++) {
    const angulo = rng() * Math.PI * 2;
    const distancia = 24 + rng() * 14;
    const comprimento = 4 + rng() * 5;

    const x = Math.cos(angulo) * distancia;
    const z = Math.sin(angulo) * distancia;
    const rotacao = rng() * Math.PI * 2;

    const grupo = new TransformNode(`colunaCaida_${i}`, scene);
    grupo.rotation.set(0, rotacao, Math.PI / 2);
    grupo.position.set(x, alturaEm(x, z) + 1, z);

    const tambores = Math.max(2, Math.round(comprimento / 2.2));
    const tamanhoTambor = comprimento / tambores;
    for (let t = 0; t < tambores; t++) {
      const tambor = criarFuste(scene, `tamborCaido_${i}_${t}`, tamanhoTambor - 0.06, 2.2, {
        quebraTopo: t === tambores - 1 ? 0.6 : 0.08,
        quebraBase: t === 0 ? 0.5 : 0.08,
        semente: i * 13 + t
      });
      tambor.parent = grupo;
      tambor.position.y = -comprimento / 2 + tamanhoTambor * (t + 0.5);
      tambor.position.x = (rngDetalhe() - 0.5) * 0.12;
      tambor.position.z = (rngDetalhe() - 0.5) * 0.12;
      tambor.rotation.y = rngDetalhe() * Math.PI;
      tambor.rotation.x = (rngDetalhe() - 0.5) * 0.06;
      envelhecer(tambor, { semente: i * 5 + t, alturaSujeira: 0.1, musgo: 0.9 });
      adicionar(tambor, matPedraEscura);
    }

    const dx = Math.cos(rotacao);
    const dz = -Math.sin(rotacao);

    obstaculos.push({
      tipo: "capsula",
      x1: x - dx * comprimento / 2,
      z1: z - dz * comprimento / 2,
      x2: x + dx * comprimento / 2,
      z2: z + dz * comprimento / 2,
      raio: 1.2
    });
  }

  // --------------------------------------------------
  // MONÓLITOS AO REDOR DO MONUMENTO
  // --------------------------------------------------

  const distanciasMonolitos = [60, 78, 96, 60, 78, 96, 70, 88];

  for (let i = 0; i < distanciasMonolitos.length; i++) {
    const angulo =
      (i / distanciasMonolitos.length) * Math.PI * 2;

    const distancia = distanciasMonolitos[i];

    const x = Math.cos(angulo) * distancia;
    const z = Math.sin(angulo) * distancia;

    const altura = 14 + rng() * 15;
    const faceU = 1;
    const faceV = altura / 3.2;
    const face = new Vector4(0, 0, faceU, faceV);
    const faceTopo = new Vector4(0, 0, 1, 0.75);

    const monolito = MeshBuilder.CreateBox(
      `monolito_${i}`,
      {
        width: 3.2,
        depth: 2.4,
        height: altura,
        faceUV: [face, face, face, face, faceTopo, faceTopo],
        wrap: true
      },
      scene
    );

    // Afina para o alto e quebra levemente o topo.
    const pos = monolito.getVerticesData(VertexBuffer.PositionKind);
    for (let k = 0; k < pos.length; k += 3) {
      const t = (pos[k + 1] + altura / 2) / altura;
      const afinar = 1 - 0.22 * t;
      pos[k] *= afinar;
      pos[k + 2] *= afinar;
      if (t > 0.99) {
        pos[k + 1] -= ruidoValor(pos[k] * 0.9 + i, pos[k + 2] * 0.9) * 1.4;
      }
    }
    recalcularNormais(monolito, pos);

    monolito.position.set(
      x,
      alturaEm(x, z) + altura / 2 - 0.4,
      z
    );

    monolito.rotation.y = rng() * Math.PI * 2;

    envelhecer(monolito, { semente: 40 + i, alturaSujeira: 3, musgo: 0.8 });
    adicionar(monolito, matMonolito);

    obstaculos.push({
      x,
      z,
      raio: 2.2
    });
  }

  // --------------------------------------------------
  // ENTULHO (decorativo, sem colisão)
  // --------------------------------------------------

  const entulho = MeshBuilder.CreateBox("entulhoRuinas", { size: 1 }, scene);
  {
    // Bloco lascado: arestas irregulares.
    const pos = entulho.getVerticesData(VertexBuffer.PositionKind);
    for (let k = 0; k < pos.length; k += 3) {
      const n = ruidoValor(pos[k] * 3.1 + pos[k + 1] * 5.3, pos[k + 2] * 3.7 - pos[k + 1] * 2.1);
      pos[k] *= 0.8 + n * 0.4;
      pos[k + 1] *= 0.8 + n * 0.3;
      pos[k + 2] *= 0.8 + (1 - n) * 0.4;
    }
    recalcularNormais(entulho, pos);
  }
  entulho.material = matPedraEscura;
  entulho.receiveShadows = true;
  entulho.isPickable = false;

  const matrizesEntulho = [];
  const blocoEntulho = (x, y, z, s) => {
    matrizesEntulho.push(
      Matrix.Compose(
        new Vector3(s * (0.8 + rngDetalhe() * 0.8), s * (0.5 + rngDetalhe() * 0.4), s * (0.8 + rngDetalhe() * 0.6)),
        Quaternion.RotationYawPitchRoll(rngDetalhe() * 6.28, (rngDetalhe() - 0.5) * 0.5, (rngDetalhe() - 0.5) * 0.5),
        new Vector3(x, y + s * 0.18, z)
      )
    );
  };

  // Pedaços caídos ao pé das colunas quebradas.
  for (const p of pontasQuebradas) {
    for (let k = 0; k < 7; k++) {
      const a = rngDetalhe() * Math.PI * 2;
      const d = 1.9 + rngDetalhe() * 2.6;
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      blocoEntulho(x, alturaDaPlataforma(x, z, alturaEm(x, z)), z, 0.25 + rngDetalhe() * 0.35);
    }
  }

  // Blocos soltos ao redor da base do monumento.
  for (let k = 0; k < 90; k++) {
    const a = rngDetalhe() * Math.PI * 2;
    const d = 23 + Math.pow(rngDetalhe(), 1.5) * 22;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    blocoEntulho(x, alturaDaPlataforma(x, z, alturaEm(x, z)), z, 0.2 + rngDetalhe() * 0.35);
  }

  {
    const buffer = new Float32Array(matrizesEntulho.length * 16);
    matrizesEntulho.forEach((m, k) => m.copyToArray(buffer, k * 16));
    entulho.thinInstanceSetBuffer("matrix", buffer, 16, true);
    entulho.thinInstanceRefreshBoundingInfo(false);
    entulho.alwaysSelectAsActiveMesh = true;
  }
  malhas.push(entulho);

  // --------------------------------------------------
  // ALTAR E ORBE CENTRAL
  // --------------------------------------------------

  const topoPlataforma = alturaDaPlataforma(0, 0, alturaEm(0, 0));

  const perfilAltar = [
    new Vector3(0, 0, 0),
    new Vector3(1.7, 0, 0),
    new Vector3(1.7, 0.18, 0),
    new Vector3(1.45, 0.3, 0),
    new Vector3(1.0, 0.42, 0),
    new Vector3(0.8, 0.62, 0),
    new Vector3(0.78, 0.82, 0),
    new Vector3(1.15, 0.94, 0),
    new Vector3(1.45, 1.02, 0),
    new Vector3(1.2, 1.06, 0),
    new Vector3(0, 1.0, 0)
  ];
  const altar = MeshBuilder.CreateLathe(
    "altarOrbe",
    { shape: perfilAltar, tessellation: 48, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  altar.position.set(0, topoPlataforma, 0);
  escalarUV(altar, 3, 1);
  adicionar(altar, matPedra);

  const orbe = MeshBuilder.CreateSphere(
    "orbeCentral",
    {
      diameter: 3.5,
      segments: 48
    },
    scene
  );

  orbe.position.set(
    0,
    alturaEm(0, 0) + 5.2,
    0
  );

  const materialOrbe = new StandardMaterial("materialOrbe", scene);
  materialOrbe.disableLighting = true;
  materialOrbe.diffuseColor = Color3.Black();
  materialOrbe.specularColor = Color3.Black();
  materialOrbe.emissiveColor = new Color3(0.08, 0.45, 1.2);
  materialOrbe.emissiveTexture = copiaTextura(textura(scene, "rachaduras"), 2, 1);
  materialOrbe.emissiveTexture.level = 3.5;
  materialOrbe.emissiveFresnelParameters = new FresnelParameters({
    bias: 0.15,
    power: 1.6,
    leftColor: new Color3(1.2, 2.2, 3.0),
    rightColor: new Color3(0.4, 0.7, 1.2)
  });
  orbe.material = materialOrbe;
  orbe.isPickable = false;
  semSombra.push(orbe);

  // Casca externa translúcida com brilho na borda (fresnel).
  const casca = MeshBuilder.CreateSphere("cascaOrbe", { diameter: 4.2, segments: 32 }, scene);
  casca.parent = orbe;
  const materialCasca = new StandardMaterial("materialCascaOrbe", scene);
  materialCasca.disableLighting = true;
  materialCasca.emissiveColor = new Color3(0.2, 0.6, 1.4);
  materialCasca.alpha = 0.35;
  materialCasca.alphaMode = Constants.ALPHA_ADD;
  materialCasca.opacityFresnelParameters = new FresnelParameters({
    bias: 0.0,
    power: 2.5,
    leftColor: Color3.White(),
    rightColor: Color3.Black()
  });
  materialCasca.backFaceCulling = true;
  casca.material = materialCasca;
  casca.isPickable = false;
  semSombra.push(casca);

  // O orbe flutua pouco acima da plataforma superior (a base
  // dele fica a ~1 m do piso). Sem colisão, o jogador
  // atravessava a esfera com a cabeça.
  obstaculos.push({
    x: 0,
    z: 0,
    raio: 1.75
  });

  // Anéis de metal antigo girando ao redor do orbe.
  const matAnel = criarMaterial(scene, "materialAnelOrbe", {
    cor: [0.85, 0.66, 0.36],
    metal: 1,
    rugosidade: 0.32,
    normal: "metal",
    emissiva: "runas",
    corEmissiva: [0.3, 0.9, 2.0],
    escalaEmissiva: 1
  });
  matAnel.emissiveTexture.uScale = 6;
  matAnel.emissiveTexture.vScale = 0.5;

  const aneis = [
    { d: 4.6, e: 0.12, inclinacao: 0.35, velocidade: 0.5 },
    { d: 5.0, e: 0.09, inclinacao: -0.55, velocidade: -0.35 },
    { d: 5.3, e: 0.07, inclinacao: 0.15, velocidade: 0.22 }
  ].map((cfg, k) => {
    const pivo = new TransformNode(`pivoAnelOrbe_${k}`, scene);
    pivo.position.copyFrom(orbe.position);
    const anel = MeshBuilder.CreateTorus(
      `anelOrbe_${k}`,
      { diameter: cfg.d, thickness: cfg.e, tessellation: 96 },
      scene
    );
    anel.parent = pivo;
    anel.rotation.x = cfg.inclinacao;
    anel.rotation.z = cfg.inclinacao * 0.6;
    anel.material = matAnel;
    anel.isPickable = false;
    malhas.push(anel);
    return { pivo, anel, cfg };
  });

  // Círculo de runas no piso ao redor do altar.
  const matRunasChao = new StandardMaterial("materialRunasChao", scene);
  matRunasChao.disableLighting = true;
  matRunasChao.diffuseColor = Color3.Black();
  matRunasChao.emissiveColor = new Color3(0.1, 0.38, 0.9);
  matRunasChao.opacityTexture = copiaTextura(textura(scene, "runas"), 1, 1);
  matRunasChao.opacityTexture.getAlphaFromRGB = true;
  matRunasChao.alphaMode = Constants.ALPHA_ADD;
  matRunasChao.zOffset = -2;

  const runasChao = criarAnelPlano(scene, "runasChao", 4.2, 5.6, 128, 14);
  runasChao.position.set(0, topoPlataforma + 0.02, 0);
  runasChao.material = matRunasChao;
  runasChao.isPickable = false;
  semSombra.push(runasChao);

  const runasChaoExterno = criarAnelPlano(scene, "runasChaoExterno", 8.4, 9.2, 160, 26);
  runasChaoExterno.position.set(0, topoPlataforma + 0.02, 0);
  runasChaoExterno.material = matRunasChao;
  runasChaoExterno.isPickable = false;
  semSombra.push(runasChaoExterno);

  // Feixe de luz subindo do orbe (marco visível de longe).
  const feixe = MeshBuilder.CreateCylinder(
    "feixeOrbe",
    { height: 160, diameterTop: 3.2, diameterBottom: 1.4, tessellation: 32, cap: Mesh.NO_CAP },
    scene
  );
  feixe.position.set(0, orbe.position.y + 80 + 1.2, 0);
  const matFeixe = new StandardMaterial("materialFeixe", scene);
  matFeixe.disableLighting = true;
  matFeixe.diffuseColor = Color3.Black();
  matFeixe.emissiveColor = new Color3(0.16, 0.48, 1.15);
  matFeixe.opacityTexture = copiaTextura(textura(scene, "feixe"), 1, 1);
  matFeixe.opacityTexture.wrapV = 0;
  matFeixe.opacityFresnelParameters = new FresnelParameters({
    bias: 0,
    power: 2,
    leftColor: Color3.Black(),
    rightColor: Color3.White()
  });
  matFeixe.alphaMode = Constants.ALPHA_ADD;
  matFeixe.backFaceCulling = false;
  matFeixe.disableDepthWrite = true;
  matFeixe.fogEnabled = false;
  feixe.material = matFeixe;
  feixe.isPickable = false;
  semSombra.push(feixe);

  const luzOrbe = new PointLight(
    "luzOrbeCentral",
    new Vector3(0, 0, 0),
    scene
  );

  luzOrbe.position.copyFrom(orbe.position);
  luzOrbe.diffuse = new Color3(0.3, 0.65, 1);
  luzOrbe.specular = new Color3(0.3, 0.65, 1);
  luzOrbe.intensity = 20;
  luzOrbe.range = 40;

  // Animação do orbe, anéis e runas.
  let tempo = 0;
  const animar = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    tempo += dt;
    const pulso = 0.8 + 0.2 * Math.sin(tempo * 1.6) + 0.06 * Math.sin(tempo * 7.3);
    materialOrbe.emissiveTexture.uOffset = tempo * 0.03;
    materialOrbe.emissiveTexture.vOffset = tempo * 0.011;
    materialOrbe.emissiveTexture.level = 3.5 * pulso;
    luzOrbe.intensity = 20 * pulso;
    for (const a of aneis) {
      a.pivo.rotation.y += a.cfg.velocidade * dt;
    }
    matRunasChao.emissiveColor.set(0.1 * pulso, 0.38 * pulso, 0.9 * pulso);
    const brilhoRunas = 0.75 + 0.25 * Math.sin(tempo * 0.7);
    matMonolito.emissiveColor.set(0.12 * brilhoRunas, 0.45 * brilhoRunas, 1.0 * brilhoRunas);
    matFeixe.alpha = 0.3 + 0.08 * Math.sin(tempo * 1.1);
  });

  orbe.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(animar));

  // --------------------------------------------------
  // ALTURA DAS PLATAFORMAS
  // --------------------------------------------------

  function alturaDaPlataforma(x, z, alturaBase) {
    let resultado = alturaBase;

    for (const plataforma of plataformas) {
      const dentro =
        Math.abs(x - plataforma.x) <= plataforma.largura / 2 &&
        Math.abs(z - plataforma.z) <= plataforma.profundidade / 2;

      if (dentro) {
        resultado = Math.max(resultado, plataforma.topo);
      }
    }

    return resultado;
  }

  return {
    malhas,
    semSombra,
    obstaculos,
    plataformas,
    orbe,
    luzOrbe,
    alturaEm: alturaDaPlataforma
  };
}

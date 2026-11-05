import "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import "@babylonjs/core/Materials/material.detailMapConfiguration.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { fbm, suavizar, misturar } from "./Ruido.js";
import { textura } from "./Texturas.js";
import { criarMaterial, copiaTextura } from "./Materiais.js";

export const TAMANHO_MUNDO = 600;
export const NIVEL_AGUA = -1.2;
export const RAIO_RUINAS = 50; // area plana em volta das ruinas centrais
const LAGO = { x: -130, z: 110, raio: 60 };

/**
 * Altura do terreno em (x, z). Funcao pura: serve para gerar a malha,
 * posicionar arvores/rochas e, nas proximas fases, manter o personagem no chao.
 */
export function alturaEm(x, z) {
  const dc = Math.hypot(x, z);
  let h = (fbm(x * 0.006 + 50, z * 0.006 + 50, 5) - 0.5) * 16 + 4;
  h += (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 3;
  // montanhas distantes formando uma borda natural ao redor do mundo
  h += suavizar(140, 290, dc) * (35 + 40 * fbm(x * 0.01 - 30, z * 0.01 + 30, 4));
  // bacia do lago
  h -= (1 - suavizar(0, LAGO.raio, Math.hypot(x - LAGO.x, z - LAGO.z))) * 14;
  // area plana nas ruinas, com transicao suave
  return h * suavizar(RAIO_RUINAS, RAIO_RUINAS + 55, dc);
}

function cor(base, destino, t) {
  return [
    misturar(base[0], destino[0], t),
    misturar(base[1], destino[1], t),
    misturar(base[2], destino[2], t),
  ];
}

// Cores em sRGB convertidas para linear (o PBR trabalha em linear).
const lin = (c) => [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)];

export function criarTerreno(scene) {
  const terreno = MeshBuilder.CreateGround(
    "terreno",
    { width: TAMANHO_MUNDO, height: TAMANHO_MUNDO, subdivisions: 260, updatable: true },
    scene
  );

  const pos = terreno.getVerticesData(VertexBuffer.PositionKind);
  const indices = terreno.getIndices();
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] = alturaEm(pos[i], pos[i + 2]);
  }
  const normais = [];
  VertexData.ComputeNormals(pos, indices, normais);
  terreno.setVerticesData(VertexBuffer.PositionKind, pos, true);
  terreno.setVerticesData(VertexBuffer.NormalKind, normais, true);

  // Cores por altura, inclinacao e proximidade da agua (aparencia de terreno real)
  const cores = new Float32Array((pos.length / 3) * 4);
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    const inclinacao = 1 - normais[v * 3 + 1];
    const variacao = fbm(x * 0.05, z * 0.05, 3);
    const dc = Math.hypot(x, z);

    const secura = fbm(x * 0.009 - 11, z * 0.009 + 4, 3);

    // Grama: verde-oliva, mais seca (dourada) em algumas regiões.
    let c = [0.3 + 0.12 * variacao, 0.4 + 0.12 * variacao, 0.17 + 0.06 * variacao];
    c = cor(c, [0.52, 0.47, 0.25], suavizar(0.45, 0.75, secura) * 0.7);
    c = cor(c, [0.5, 0.42, 0.32], (1 - suavizar(30, 75, dc)) * 0.7); // terra batida nas ruinas
    c = cor(c, [0.44, 0.38, 0.29], suavizar(0.5, 0.9, fbm(x * 0.03 + 9, z * 0.03, 3)) * 0.5); // manchas de terra
    c = cor(c, [0.72, 0.65, 0.5], 1 - suavizar(NIVEL_AGUA - 0.5, NIVEL_AGUA + 1.8, y)); // areia na margem
    c = cor(c, [0.34, 0.31, 0.25], 1 - suavizar(NIVEL_AGUA - 3, NIVEL_AGUA - 0.4, y)); // fundo do lago
    const rocha = Math.max(suavizar(0.16, 0.36, inclinacao), suavizar(34, 60, y));
    c = cor(c, [0.56 + 0.08 * variacao, 0.53 + 0.07 * variacao, 0.49 + 0.06 * variacao], rocha);
    // Neve leve nos picos mais altos.
    c = cor(c, [0.86, 0.86, 0.9], suavizar(58, 72, y) * (1 - suavizar(0.3, 0.55, inclinacao)));

    const l = lin(c);
    cores.set([l[0], l[1], l[2], 1], v * 4);
  }
  terreno.setVerticesData(VertexBuffer.ColorKind, cores);

  const material = criarMaterial(scene, "matTerreno", {
    cor: [1, 1, 1],
    rugosidade: 0.92,
    conjunto: "terreno",
    escala: 110,
    nivelNormal: 0.9
  });

  // Segunda escala de detalhe: quebra a repetição de perto.
  const detalhe = copiaTextura(textura(scene, "detalheTerreno"), 420);
  material.detailMap.texture = detalhe;
  material.detailMap.isEnabled = true;
  material.detailMap.diffuseBlendLevel = 0.35;
  material.detailMap.bumpLevel = 0.6;
  material.detailMap.roughnessBlendLevel = 0.3;

  terreno.material = material;
  terreno.receiveShadows = true;
  terreno.isPickable = false;
  terreno.freezeWorldMatrix();
  return terreno;
}

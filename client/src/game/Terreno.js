import "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { fbm, suavizar, misturar } from "./Ruido.js";
import { criarTexturaRuido } from "./Texturas.js";

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

export function criarTerreno(scene) {
  const terreno = MeshBuilder.CreateGround(
    "terreno",
    { width: TAMANHO_MUNDO, height: TAMANHO_MUNDO, subdivisions: 220, updatable: true },
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

    let c = [0.18 + 0.14 * variacao, 0.29 + 0.15 * variacao, 0.1 + 0.07 * variacao]; // grama
    c = cor(c, [0.36, 0.3, 0.22], (1 - suavizar(30, 75, dc)) * 0.65); // terra batida nas ruinas
    c = cor(c, [0.3, 0.27, 0.2], suavizar(0.5, 0.9, fbm(x * 0.03 + 9, z * 0.03, 3)) * 0.5); // manchas de terra
    c = cor(c, [0.57, 0.52, 0.4], 1 - suavizar(NIVEL_AGUA - 0.5, NIVEL_AGUA + 1.8, y)); // areia na margem
    const rocha = Math.max(suavizar(0.16, 0.36, inclinacao), suavizar(34, 60, y));
    c = cor(c, [0.46 + 0.06 * variacao, 0.44 + 0.06 * variacao, 0.41 + 0.05 * variacao], rocha);

    cores.set([c[0], c[1], c[2], 1], v * 4);
  }
  terreno.setVerticesData(VertexBuffer.ColorKind, cores);

  const material = new StandardMaterial("matTerreno", scene);
  material.diffuseColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(0, 0, 0);
  const detalhe = criarTexturaRuido(scene, { tamanho: 256, semente: 11, base: 0.78, variacao: 0.22 });
  detalhe.uScale = 140;
  detalhe.vScale = 140;
  material.diffuseTexture = detalhe;
  terreno.material = material;
  terreno.receiveShadows = true;
  terreno.freezeWorldMatrix();
  return terreno;
}

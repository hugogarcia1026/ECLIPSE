import "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { misturar } from "./Ruido.js";

export const COR_HORIZONTE = [0.88, 0.66, 0.5];
const COR_ZENITE = [0.08, 0.17, 0.4];
const COR_SOL = [1.0, 0.72, 0.4];

/**
 * Domo de ceu com degrade horizonte -> zenite e brilho ao redor do sol.
 * `direcaoSol` aponta DO observador PARA o sol.
 */
export function criarCeu(scene, direcaoSol) {
  const raio = 1000;
  const ceu = MeshBuilder.CreateSphere(
    "ceu",
    { diameter: raio * 2, segments: 32, sideOrientation: Mesh.BACKSIDE },
    scene
  );
  const pos = ceu.getVerticesData(VertexBuffer.PositionKind);
  const cores = new Float32Array((pos.length / 3) * 4);
  const s = direcaoSol.normalizeToNew();

  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3] / raio;
    const y = pos[i * 3 + 1] / raio;
    const z = pos[i * 3 + 2] / raio;
    const t = Math.pow(Math.max(0, y), 0.55);
    const c = [
      misturar(COR_HORIZONTE[0], COR_ZENITE[0], t),
      misturar(COR_HORIZONTE[1], COR_ZENITE[1], t),
      misturar(COR_HORIZONTE[2], COR_ZENITE[2], t),
    ];
    const proximidadeSol = Math.max(0, x * s.x + y * s.y + z * s.z);
    const brilho = Math.pow(proximidadeSol, 48) * 1.2 + Math.pow(proximidadeSol, 6) * 0.18;
    cores.set([c[0] + COR_SOL[0] * brilho, c[1] + COR_SOL[1] * brilho, c[2] + COR_SOL[2] * brilho, 1], i * 4);
  }
  ceu.setVerticesData(VertexBuffer.ColorKind, cores);

  const material = new StandardMaterial("matCeu", scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(1, 1, 1); // mostra exatamente a cor dos vertices
  material.diffuseColor = new Color3(0, 0, 0);
  material.specularColor = new Color3(0, 0, 0);
  material.backFaceCulling = false;
  material.fogEnabled = false;
  ceu.material = material;
  ceu.infiniteDistance = true;
  ceu.isPickable = false;
  return ceu;
}

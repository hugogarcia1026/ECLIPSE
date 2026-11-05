
import "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import "@babylonjs/core/Meshes/Builders/icoSphereBuilder.js";
import "@babylonjs/core/Meshes/thinInstanceMesh.js";

import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";

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
  criarRng
} from "./Ruido.js";

function matriz(x, y, z, rotY, sx, sy, sz) {
  return Matrix.Compose(
    new Vector3(sx, sy, sz),
    Quaternion.RotationYawPitchRoll(rotY, 0, 0),
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
}

function inclinacao(x, z) {
  const d = 2;

  const dx = alturaEm(x + d, z) - alturaEm(x - d, z);
  const dz = alturaEm(x, z + d) - alturaEm(x, z - d);

  return Math.hypot(dx, dz) / (2 * d);
}

/**
 * Pinheiros em manchas de floresta.
 */
export function criarArvores(scene, semente = 7, maximo = 150) {
  const rng = criarRng(semente);

  const tronco = MeshBuilder.CreateCylinder(
    "troncoBase",
    {
      diameterTop: 0.5,
      diameterBottom: 0.9,
      height: 5,
      tessellation: 8
    },
    scene
  );

  tronco.position.y = 2.5;

  const copas = [
    { d: 6.2, h: 6, y: 6.5 },
    { d: 4.8, h: 5, y: 9.4 },
    { d: 3.2, h: 4.5, y: 12 }
  ].map(({ d, h, y }, i) => {
    const copa = MeshBuilder.CreateCylinder(
      `copa${i}`,
      {
        diameterTop: 0,
        diameterBottom: d,
        height: h,
        tessellation: 9
      },
      scene
    );

    copa.position.y = y;

    return copa;
  });

  const copa = Mesh.MergeMeshes(copas, true);
  copa.name = "copasArvores";

  const troncoFinal = Mesh.MergeMeshes([tronco], true);
  troncoFinal.name = "troncosArvores";

  const matTronco = new StandardMaterial("matTronco", scene);
  matTronco.diffuseColor = new Color3(0.28, 0.2, 0.14);
  matTronco.specularColor = Color3.Black();

  const matCopa = new StandardMaterial("matCopa", scene);
  matCopa.diffuseColor = new Color3(0.14, 0.28, 0.12);
  matCopa.specularColor = Color3.Black();

  troncoFinal.material = matTronco;
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

  aplicarInstancias(troncoFinal, matrizes);
  aplicarInstancias(copa, matrizes, cores);

  return {
    tronco: troncoFinal,
    copa,
    quantidade: matrizes.length,
    colisoes
  };
}

/**
 * Rochas irregulares em instâncias.
 */
export function criarRochas(scene, semente = 21, quantidade = 70) {
  const rng = criarRng(semente);

  const rocha = MeshBuilder.CreateIcoSphere(
    "rochasBase",
    {
      radius: 1,
      subdivisions: 3
    },
    scene
  );

  const pos = rocha.getVerticesData(VertexBuffer.PositionKind);

  for (let i = 0; i < pos.length; i += 3) {
    const f =
      0.72 +
      0.55 *
        ruidoValor(
          pos[i] * 1.7 + pos[i + 1] * 3.1,
          pos[i + 2] * 1.7 - pos[i + 1] * 2.3
        );

    pos[i] *= f;
    pos[i + 1] *= f * 0.8;
    pos[i + 2] *= f;
  }

  const normais = [];

  VertexData.ComputeNormals(
    pos,
    rocha.getIndices(),
    normais
  );

  rocha.setVerticesData(VertexBuffer.PositionKind, pos);
  rocha.setVerticesData(VertexBuffer.NormalKind, normais);

  const mat = new StandardMaterial("matRocha", scene);

  mat.diffuseColor = new Color3(0.45, 0.42, 0.39);
  mat.specularColor = new Color3(0.04, 0.04, 0.04);

  rocha.material = mat;

  const matrizes = [];
  const colisoes = [];

  for (
    let tentativa = 0;
    tentativa < 2000 && matrizes.length < quantidade;
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

    matrizes.push(
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
  }

  aplicarInstancias(rocha, matrizes);

  return {
    rocha,
    quantidade: matrizes.length,
    colisoes
  };
}

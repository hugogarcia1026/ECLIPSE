import "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";

import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";

import { alturaEm } from "./Terreno.js";
import { criarRng } from "./Ruido.js";

export function criarRuinas(scene) {
  const malhas = [];
  const obstaculos = [];
  const plataformas = [];

  const rng = criarRng(83);

  const pedra = new StandardMaterial("materialPedraRuinas", scene);
  pedra.diffuseColor = new Color3(0.32, 0.30, 0.28);
  pedra.specularColor = new Color3(0.12, 0.12, 0.12);

  const pedraClara = new StandardMaterial("materialPedraClara", scene);
  pedraClara.diffuseColor = new Color3(0.48, 0.43, 0.36);
  pedraClara.specularColor = new Color3(0.15, 0.13, 0.1);

  const materialOrbe = new StandardMaterial("materialOrbe", scene);
  materialOrbe.diffuseColor = new Color3(0.08, 0.25, 0.42);
  materialOrbe.emissiveColor = new Color3(0.05, 0.35, 0.75);
  materialOrbe.specularColor = new Color3(0.8, 0.9, 1);

  function adicionar(malha, material = pedra) {
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

  for (let i = 0; i < degraus.length; i++) {
    const degrau = degraus[i];

    const yBase = alturaEm(0, 0);
    const caixa = MeshBuilder.CreateBox(
      `plataformaCentral_${i}`,
      {
        width: degrau.tamanho,
        depth: degrau.tamanho,
        height: degrau.altura
      },
      scene
    );

    caixa.position.set(
      0,
      yBase + degrau.altura / 2,
      0
    );

    adicionar(caixa, i === 2 ? pedraClara : pedra);

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

  for (let i = 0; i < alturasColunas.length; i++) {
    const angulo = (i / alturasColunas.length) * Math.PI * 2;
    const raio = 13;

    const x = Math.cos(angulo) * raio;
    const z = Math.sin(angulo) * raio;
    const altura = alturasColunas[i];

    // As colunas ficam sobre a plataforma superior, e não
    // enterradas nela (a base considera a altura dos degraus).
    const base = alturaDaPlataforma(x, z, alturaEm(x, z));

    const coluna = MeshBuilder.CreateCylinder(
      `colunaRuina_${i}`,
      {
        height: altura,
        diameter: 2.2,
        tessellation: 10
      },
      scene
    );

    coluna.position.set(
      x,
      base + altura / 2,
      z
    );

    adicionar(coluna, pedraClara);

    obstaculos.push({
      x,
      z,
      raio: 1.25
    });

    if (altura >= 14) {
      const capitel = MeshBuilder.CreateBox(
        `capitelRuina_${i}`,
        {
          width: 3.2,
          height: 0.9,
          depth: 3.2
        },
        scene
      );

      capitel.position.set(
        x,
        coluna.position.y + altura / 2 + 0.35,
        z
      );

      adicionar(capitel, pedraClara);
    }
  }

  // --------------------------------------------------
  // COLUNAS CAÍDAS
  // --------------------------------------------------

  for (let i = 0; i < 6; i++) {
    const angulo = rng() * Math.PI * 2;
    const distancia = 24 + rng() * 14;
    const comprimento = 4 + rng() * 5;

    const x = Math.cos(angulo) * distancia;
    const z = Math.sin(angulo) * distancia;
    const rotacao = rng() * Math.PI * 2;

    const coluna = MeshBuilder.CreateCylinder(
      `colunaCaida_${i}`,
      {
        height: comprimento,
        diameter: 2.2,
        tessellation: 10
      },
      scene
    );

    coluna.rotation.set(
      0,
      rotacao,
      Math.PI / 2
    );

    coluna.position.set(
      x,
      alturaEm(x, z) + 1,
      z
    );

    adicionar(coluna, pedra);

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

    const monolito = MeshBuilder.CreateBox(
      `monolito_${i}`,
      {
        width: 3.2,
        depth: 2.4,
        height: altura
      },
      scene
    );

    monolito.position.set(
      x,
      alturaEm(x, z) + altura / 2,
      z
    );

    monolito.rotation.y = rng() * Math.PI * 2;

    adicionar(monolito, pedraClara);

    obstaculos.push({
      x,
      z,
      raio: 2.2
    });
  }

  // --------------------------------------------------
  // ORBE CENTRAL
  // --------------------------------------------------

  const orbe = MeshBuilder.CreateSphere(
    "orbeCentral",
    {
      diameter: 3.5,
      segments: 24
    },
    scene
  );

  orbe.position.set(
    0,
    alturaEm(0, 0) + 5.2,
    0
  );

  adicionar(orbe, materialOrbe);

  // O orbe flutua pouco acima da plataforma superior (a base
  // dele fica a ~1 m do piso). Sem colisão, o jogador
  // atravessava a esfera com a cabeça.
  obstaculos.push({
    x: 0,
    z: 0,
    raio: 1.75
  });

  const luzOrbe = new PointLight(
    "luzOrbeCentral",
    new Vector3(0, 0, 0),
    scene
  );

  luzOrbe.position.copyFrom(orbe.position);
  luzOrbe.diffuse = new Color3(0.15, 0.45, 1);
  luzOrbe.intensity = 2.2;
  luzOrbe.range = 35;

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
    obstaculos,
    plataformas,
    orbe,
    luzOrbe,
    alturaEm: alturaDaPlataforma
  };
}
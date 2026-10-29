import "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { criarTexturaRuido } from "./Texturas.js";
import { alturaEm } from "./Terreno.js";
import { criarRng } from "./Ruido.js";

/**
 * Ruinas de Auralis: plataforma em degraus, circulo de colunas (algumas
 * quebradas), blocos caidos, monolitos e o nucleo azul do Pulso.
 * Retorna as malhas que devem projetar sombra.
 */
export function criarRuinas(scene) {
  const rng = criarRng(5);
  const pedra = new StandardMaterial("matPedra", scene);
  pedra.diffuseColor = new Color3(0.68, 0.63, 0.56);
  pedra.specularColor = new Color3(0.05, 0.05, 0.05);
  const tex = criarTexturaRuido(scene, { tamanho: 256, semente: 3, base: 0.78, variacao: 0.22 });
  tex.uScale = 6; tex.vScale = 6;
  pedra.diffuseTexture = tex;

  const malhas = [];
  const add = (m) => { m.material = pedra; m.receiveShadows = true; malhas.push(m); return m; };

  // Degraus
  const degraus = [
    ["degrau2", 44, 0.8, 0.4],
    ["degrau1", 38, 0.8, 1.2],
    ["plataformaCentral", 32, 0.8, 2.0],
  ];
  for (const [nome, lado, alt, y] of degraus) {
    const b = MeshBuilder.CreateBox(nome, { width: lado, height: alt, depth: lado }, scene);
    b.position.y = y;
    add(b);
  }
  const topo = 2.4;

  // Circulo de colunas
  const alturas = [14, 14, 9, 14, 5, 14, 14, 11, 14, 6, 14, 12];
  alturas.forEach((h, i) => {
    const ang = (i / alturas.length) * Math.PI * 2;
    const x = Math.cos(ang) * 13;
    const z = Math.sin(ang) * 13;
    const col = MeshBuilder.CreateCylinder(`coluna${i}`, { height: h, diameter: 2.2, tessellation: 16 }, scene);
    col.position = new Vector3(x, topo + h / 2, z);
    add(col);
    if (h === 14) {
      const cap = MeshBuilder.CreateBox(`capitel${i}`, { width: 3.2, height: 0.7, depth: 3.2 }, scene);
      cap.position = new Vector3(x, topo + h + 0.35, z);
      add(cap);
    }
  });

  // Blocos de colunas caidas
  for (let i = 0; i < 6; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 24 + rng() * 14;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const t = MeshBuilder.CreateCylinder(`colunaCaida${i}`, { height: 4 + rng() * 5, diameter: 2.2, tessellation: 14 }, scene);
    t.rotation = new Vector3(0, rng() * 6.28, Math.PI / 2);
    t.position = new Vector3(x, alturaEm(x, z) + 1, z);
    add(t);
  }

  // Monolitos altos ao redor
  for (let i = 0; i < 8; i++) {
    const ang = i * 0.8 + 0.3;
    const r = 60 + (i % 3) * 18;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const h = 14 + (i % 4) * 5;
    const m = MeshBuilder.CreateBox(`monolito${i}`, { width: 3.2, height: h, depth: 2.4 }, scene);
    m.position = new Vector3(x, alturaEm(x, z) + h / 2 - 1, z);
    m.rotation = new Vector3((rng() - 0.5) * 0.1, rng() * 6.28, (rng() - 0.5) * 0.1);
    add(m);
  }

  // Nucleo do Pulso (luz azul no centro da plataforma)
  const orbe = MeshBuilder.CreateSphere("nucleoPulso", { diameter: 2.2, segments: 16 }, scene);
  orbe.position = new Vector3(0, topo + 2.4, 0);
  const matPulso = new StandardMaterial("matPulso", scene);
  matPulso.emissiveColor = new Color3(0.25, 0.65, 1);
  matPulso.diffuseColor = Color3.Black();
  matPulso.specularColor = Color3.Black();
  matPulso.disableLighting = true;
  orbe.material = matPulso;
  const luz = new PointLight("luzPulso", new Vector3(0, topo + 3, 0), scene);
  luz.diffuse = new Color3(0.3, 0.65, 1);
  luz.intensity = 2.2;
  luz.range = 40;

  return { malhas, orbe, luz };
}

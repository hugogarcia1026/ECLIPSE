import "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";

import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";

import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator.js";

import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Scene } from "@babylonjs/core/scene.js";

import {
  criarTerreno,
  alturaEm,
  NIVEL_AGUA,
  TAMANHO_MUNDO
} from "./Terreno.js";

import { criarCeu, criarAmbiente, COR_HORIZONTE } from "./Ceu.js";
import { criarArvores, criarRochas, criarCobertura } from "./Vegetacao.js";
import { criarRuinas } from "./Ruinas.js";
import { criarMaterial, copiaTextura } from "./Materiais.js";
import { textura } from "./Texturas.js";

// Direção DA luz do sol (do sol para a cena): sol baixo de fim de
// tarde, um pouco à direita de quem olha para +z (onde fica o colosso).
export const DIRECAO_SOL = new Vector3(-0.459, -0.208, -0.864).normalize();

const QUALIDADE_PADRAO = {
  nome: "alta",
  sombra: 2048,
  cascatas: 4,
  densidadeGrama: 1
};

export class World {
  constructor(scene, { qualidade = QUALIDADE_PADRAO } = {}) {
    this.scene = scene;
    this.qualidade = qualidade;
    this.direcaoSol = DIRECAO_SOL.clone();

    this.alturaTerreno = alturaEm;

    this._criarAtmosfera();
    this._criarLuzes();

    const paraOSol = DIRECAO_SOL.scale(-1);
    this.ceu = criarCeu(scene, paraOSol);
    this.ambiente = criarAmbiente(scene, paraOSol);

    this.terreno = criarTerreno(scene);
    this.agua = this._criarAgua();

    this.arvores = criarArvores(scene);
    this.rochas = criarRochas(scene);
    this.cobertura = criarCobertura(scene, qualidade.densidadeGrama ?? 1);
    this.ruinas = criarRuinas(scene);

    // Altura combinada do terreno e das plataformas.
    this.alturaEm = (x, z) => {
      const alturaNatural = this.alturaTerreno(x, z);

      return this.ruinas.alturaEm(
        x,
        z,
        alturaNatural
      );
    };

    // Todos os obstáculos do mundo.
    // Vegetacao.js devolve as colisões em "colisoes";
    // Ruinas.js devolve em "obstaculos". Antes só "obstaculos"
    // era lido, e árvores/rochas ficavam sem colisão.
    this.obstaculos = [
      ...(this.arvores.colisoes ?? this.arvores.obstaculos ?? []),
      ...(this.rochas.colisoes ?? this.rochas.obstaculos ?? []),
      ...(this.ruinas.obstaculos ?? [])
    ];

    this._criarSombras();
  }

  _criarAtmosfera() {
    // Neblina exponencial na cor do horizonte (em espaço linear,
    // porque é aplicada antes do tone mapping).
    const fog = new Color3(
      COR_HORIZONTE[0] * 0.95,
      COR_HORIZONTE[1] * 0.92,
      COR_HORIZONTE[2] * 0.95
    ).toLinearSpace();

    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0026;
    this.scene.fogColor = fog;
    this.scene.clearColor = fog.toColor4(1);
    this.scene.ambientColor = new Color3(0, 0, 0);
  }

  _criarLuzes() {
    // Luz de preenchimento: céu azulado em cima, rebatida quente embaixo.
    this.luzAmbiente = new HemisphericLight(
      "luzAmbiente",
      new Vector3(0, 1, 0),
      this.scene
    );

    this.luzAmbiente.intensity = 0.18;
    this.luzAmbiente.diffuse = new Color3(0.55, 0.62, 0.9);
    this.luzAmbiente.groundColor = new Color3(0.45, 0.3, 0.2);
    this.luzAmbiente.specular = Color3.Black();

    this.luzSol = new DirectionalLight(
      "luzSol",
      DIRECAO_SOL.clone(),
      this.scene
    );

    this.luzSol.intensity = 3.4;
    this.luzSol.diffuse = new Color3(1, 0.74, 0.5);
    this.luzSol.specular = new Color3(1, 0.8, 0.6);
    this.luzSol.autoUpdateExtends = false;
    this.luzSol.shadowFrustumSize = 300;
    this.luzSol.shadowMinZ = 1;
    this.luzSol.shadowMaxZ = 450;

    this.luzSol.position =
      DIRECAO_SOL.normalizeToNew().scale(-200);
  }

  _criarAgua() {
    const agua = MeshBuilder.CreateGround(
      "agua",
      {
        width: TAMANHO_MUNDO + 200,
        height: TAMANHO_MUNDO + 200
      },
      this.scene
    );

    agua.position.y = NIVEL_AGUA;

    const mat = criarMaterial(this.scene, "matAgua", {
      cor: [0.03, 0.09, 0.1],
      rugosidade: 0.06,
      normal: "agua",
      escala: 90,
      nivelNormal: 0.45,
      alpha: 0.86
    });
    mat.indexOfRefraction = 1.33;

    // Segunda camada de ondas no "clear coat", em outra direção.
    mat.clearCoat.isEnabled = true;
    mat.clearCoat.intensity = 1;
    mat.clearCoat.roughness = 0.02;
    mat.clearCoat.bumpTexture = copiaTextura(textura(this.scene, "agua"), 37);
    mat.clearCoat.bumpTexture.level = 0.35;

    agua.material = mat;
    agua.isPickable = false;
    agua.receiveShadows = true;

    let tempo = 0;
    const animar = this.scene.onBeforeRenderObservable.add(() => {
      tempo += Math.min(0.05, this.scene.getEngine().getDeltaTime() / 1000);
      mat.bumpTexture.uOffset = tempo * 0.006;
      mat.bumpTexture.vOffset = tempo * 0.004;
      mat.clearCoat.bumpTexture.uOffset = -tempo * 0.005;
      mat.clearCoat.bumpTexture.vOffset = tempo * 0.007;
    });
    agua.onDisposeObservable.add(() => this.scene.onBeforeRenderObservable.remove(animar));

    return agua;
  }

  _criarSombras() {
    const q = this.qualidade;

    if (CascadedShadowGenerator.IsSupported) {
      // Sombras em cascata: nítidas perto da câmera e ainda
      // presentes ao longe, sem precisar de um mapa gigante.
      const csm = new CascadedShadowGenerator(q.sombra ?? 2048, this.luzSol);
      csm.numCascades = q.cascatas ?? 4;
      csm.lambda = 0.85;
      csm.shadowMaxZ = 280;
      csm.stabilizeCascades = true;
      csm.cascadeBlendPercentage = 0.08;
      csm.usePercentageCloserFiltering = true;
      csm.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      csm.bias = 0.0018;
      csm.normalBias = 0.018;
      csm.darkness = 0;
      csm.depthClamp = true;
      this.sombras = csm;
    } else {
      const sg = new ShadowGenerator(q.sombra ?? 2048, this.luzSol);
      sg.usePercentageCloserFiltering = true;
      sg.bias = 0.0008;
      sg.normalBias = 0.03;
      sg.darkness = 0.1;
      this.sombras = sg;
    }

    const lancadores = [
      ...this.ruinas.malhas,
      this.arvores.tronco,
      this.arvores.copa,
      ...(this.rochas.malhas ?? [this.rochas.rocha])
    ];
    if ((q.densidadeGrama ?? 1) >= 0.9) {
      lancadores.push(this.cobertura.arbusto);
    }
    this.adicionarSombra(lancadores);

    const receptores = [
      this.terreno,
      this.agua,
      this.arvores.tronco,
      this.arvores.copa,
      ...(this.rochas.malhas ?? [this.rochas.rocha]),
      this.rochas.seixos,
      this.cobertura.grama,
      this.cobertura.flor,
      this.cobertura.arbusto
    ];
    for (const malha of receptores) {
      if (malha) malha.receiveShadows = true;
    }
  }

  /** Faz as malhas projetarem sombra (e recebê-la). */
  adicionarSombra(malhas) {
    if (!this.sombras) return;
    for (const malha of malhas) {
      if (!malha) continue;
      this.sombras.addShadowCaster(malha, false);
      malha.receiveShadows = true;
    }
  }
}

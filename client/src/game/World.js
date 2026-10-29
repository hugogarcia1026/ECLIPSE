import "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Scene } from "@babylonjs/core/scene.js";
import { criarTerreno, alturaEm, NIVEL_AGUA, TAMANHO_MUNDO } from "./Terreno.js";
import { criarCeu, COR_HORIZONTE } from "./Ceu.js";
import { criarArvores, criarRochas } from "./Vegetacao.js";
import { criarRuinas } from "./Ruinas.js";

const DIRECAO_SOL = new Vector3(-0.7, -0.28, -0.55); // sol baixo, fim de tarde
const QUALIDADE_SOMBRA = 2048;

/**
 * Cenario da Fase 1: regiao de ruinas com relevo, lago, floresta, ceu
 * de por do sol e sombras. Tudo gerado por codigo (sem assets externos).
 */
export class World {
  /** @param {Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.alturaEm = alturaEm;
    this._criarAtmosfera();
    this._criarLuzes();
    this.terreno = criarTerreno(scene);
    this.agua = this._criarAgua();
    this.ceu = criarCeu(scene, DIRECAO_SOL.scale(-1));
    this.arvores = criarArvores(scene);
    this.rochas = criarRochas(scene);
    this.ruinas = criarRuinas(scene);
    this._criarSombras();
  }

  _criarAtmosfera() {
    const fog = new Color3(COR_HORIZONTE[0] * 0.85, COR_HORIZONTE[1] * 0.8, COR_HORIZONTE[2] * 0.8);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0032;
    this.scene.fogColor = fog;
    this.scene.clearColor = fog.toColor4(1);
  }

  _criarLuzes() {
    this.luzAmbiente = new HemisphericLight("luzAmbiente", new Vector3(0, 1, 0), this.scene);
    this.luzAmbiente.intensity = 0.55;
    this.luzAmbiente.diffuse = new Color3(0.5, 0.6, 0.85);
    this.luzAmbiente.groundColor = new Color3(0.28, 0.22, 0.2);
    this.luzAmbiente.specular = Color3.Black();

    this.luzSol = new DirectionalLight("luzSol", DIRECAO_SOL.clone(), this.scene);
    this.luzSol.intensity = 1.6;
    this.luzSol.diffuse = new Color3(1, 0.78, 0.52);
    this.luzSol.specular = Color3.Black();
    // Caixa de sombra fixa (300x300) centrada nas ruinas
    this.luzSol.autoUpdateExtends = false;
    this.luzSol.shadowFrustumSize = 300;
    this.luzSol.position = DIRECAO_SOL.normalizeToNew().scale(-150);
  }

  _criarAgua() {
    const agua = MeshBuilder.CreateGround("agua", { width: TAMANHO_MUNDO + 200, height: TAMANHO_MUNDO + 200 }, this.scene);
    agua.position.y = NIVEL_AGUA;
    const mat = new StandardMaterial("matAgua", this.scene);
    mat.diffuseColor = new Color3(0.06, 0.2, 0.28);
    mat.specularColor = new Color3(1, 0.85, 0.7);
    mat.specularPower = 160;
    mat.alpha = 0.78;
    agua.material = mat;
    agua.isPickable = false;
    return agua;
  }

  _criarSombras() {
    this.sombras = new ShadowGenerator(QUALIDADE_SOMBRA, this.luzSol);
    this.sombras.usePercentageCloserFiltering = true;
    this.sombras.bias = 0.0008;
    this.sombras.normalBias = 0.03;
    this.sombras.darkness = 0.25;
    this.ruinas.malhas.forEach((m) => this.sombras.addShadowCaster(m));
    this.sombras.addShadowCaster(this.arvores.tronco);
    this.sombras.addShadowCaster(this.arvores.copa);
    this.sombras.addShadowCaster(this.rochas.rocha);
    this.terreno.receiveShadows = true;
    this.arvores.copa.receiveShadows = true;
    this.rochas.rocha.receiveShadows = true;
  }
}


import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

export class WeaponSystem {
  constructor(scene, jogador) {
    this.scene = scene;
    this.jogador = jogador;

    this.mao = jogador.maoDireita;

    this.armas = {
      espada: {
        nome: "Espada",
        dano: 35,
        alcance: 7,
        velocidade: 0.42
      },
      machado: {
        nome: "Machado",
        dano: 50,
        alcance: 5.5,
        velocidade: 0.58
      },
      lanca: {
        nome: "Lança",
        dano: 30,
        alcance: 10,
        velocidade: 0.48
      }
    };

    this.modelos = {};

    this._criarMateriais();
    this._criarEspada();
    this._criarMachado();
    this._criarLanca();

    this.equipar("espada");

    this._tecla = (event) => {
      if (event.repeat) return;

      const elemento = event.target;

      if (
        elemento instanceof HTMLInputElement ||
        elemento instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.code === "Digit1") this.equipar("espada");
      if (event.code === "Digit2") this.equipar("machado");
      if (event.code === "Digit3") this.equipar("lanca");
    };

    window.addEventListener("keydown", this._tecla);
  }

  _criarMateriais() {
    this.materialMetal = new StandardMaterial(
      "metalArmas",
      this.scene
    );
    this.materialMetal.diffuseColor = new Color3(0.48, 0.53, 0.59);
    this.materialMetal.specularColor = new Color3(0.9, 0.9, 0.9);

    this.materialEscuro = new StandardMaterial(
      "caboArmas",
      this.scene
    );
    this.materialEscuro.diffuseColor = new Color3(0.16, 0.09, 0.055);

    this.materialDourado = new StandardMaterial(
      "detalhesArmas",
      this.scene
    );
    this.materialDourado.diffuseColor = new Color3(0.72, 0.48, 0.16);

    this.materialPonta = new StandardMaterial(
      "pontaLanca",
      this.scene
    );
    this.materialPonta.diffuseColor = new Color3(0.68, 0.72, 0.78);
  }

  _criarRaiz(nome) {
    const raiz = new TransformNode(nome, this.scene);
    raiz.parent = this.mao;
    raiz.position = new Vector3(0, 0, 0);
    raiz.rotation = new Vector3(0, 0, 0);
    return raiz;
  }

  _criarEspada() {
    const raiz = this._criarRaiz("modeloEspada");

    const cabo = MeshBuilder.CreateCylinder(
      "caboEspada",
      { height: 0.38, diameter: 0.105 },
      this.scene
    );
    cabo.parent = raiz;
    cabo.position.y = -0.12;
    cabo.material = this.materialEscuro;

    const guarda = MeshBuilder.CreateBox(
      "guardaEspada",
      { width: 0.48, height: 0.09, depth: 0.12 },
      this.scene
    );
    guarda.parent = raiz;
    guarda.position.y = -0.34;
    guarda.material = this.materialDourado;

    const lamina = MeshBuilder.CreateBox(
      "laminaEspada",
      { width: 0.16, height: 0.95, depth: 0.055 },
      this.scene
    );
    lamina.parent = raiz;
    lamina.position.y = -0.86;
    lamina.material = this.materialMetal;

    const ponta = MeshBuilder.CreateCylinder(
      "pontaEspada",
      {
        height: 0.22,
        diameterTop: 0,
        diameterBottom: 0.16,
        tessellation: 4
      },
      this.scene
    );
    ponta.parent = raiz;
    ponta.position.y = -1.43;
    ponta.rotation.z = Math.PI;
    ponta.material = this.materialMetal;

    this.modelos.espada = raiz;
  }

  _criarMachado() {
    const raiz = this._criarRaiz("modeloMachado");

    const cabo = MeshBuilder.CreateCylinder(
      "caboMachado",
      { height: 1.05, diameter: 0.11 },
      this.scene
    );
    cabo.parent = raiz;
    cabo.position.y = -0.53;
    cabo.material = this.materialEscuro;

    const cabeca = MeshBuilder.CreateBox(
      "cabecaMachado",
      { width: 0.62, height: 0.48, depth: 0.14 },
      this.scene
    );
    cabeca.parent = raiz;
    cabeca.position.set(0.24, -0.95, 0);
    cabeca.material = this.materialMetal;

    const detalhe = MeshBuilder.CreateBox(
      "detalheMachado",
      { width: 0.18, height: 0.52, depth: 0.17 },
      this.scene
    );
    detalhe.parent = raiz;
    detalhe.position.set(0.02, -0.95, 0);
    detalhe.material = this.materialDourado;

    this.modelos.machado = raiz;
  }

  _criarLanca() {
    const raiz = this._criarRaiz("modeloLanca");

    const haste = MeshBuilder.CreateCylinder(
      "hasteLanca",
      { height: 1.8, diameter: 0.085 },
      this.scene
    );
    haste.parent = raiz;
    haste.position.y = -0.9;
    haste.material = this.materialEscuro;

    const ponta = MeshBuilder.CreateCylinder(
      "pontaLanca",
      {
        height: 0.48,
        diameterTop: 0,
        diameterBottom: 0.24,
        tessellation: 4
      },
      this.scene
    );
    ponta.parent = raiz;
    ponta.position.y = -2.04;
    ponta.rotation.z = Math.PI;
    ponta.material = this.materialPonta;

    const encaixe = MeshBuilder.CreateCylinder(
      "encaixeLanca",
      { height: 0.18, diameter: 0.15 },
      this.scene
    );
    encaixe.parent = raiz;
    encaixe.position.y = -1.78;
    encaixe.material = this.materialDourado;

    this.modelos.lanca = raiz;
  }

  equipar(tipo) {
    if (!this.armas[tipo]) return;

    for (const modelo of Object.values(this.modelos)) {
      modelo.setEnabled(false);
    }

    this.modelos[tipo].setEnabled(true);

    this.jogador.armaAtual = this.armas[tipo];

    console.log("Arma equipada:", this.armas[tipo].nome);
  }

  dispose() {
    window.removeEventListener("keydown", this._tecla);

    for (const modelo of Object.values(this.modelos)) {
      modelo.dispose(false, true);
    }

    this.materialMetal.dispose();
    this.materialEscuro.dispose();
    this.materialDourado.dispose();
    this.materialPonta.dispose();
  }
}

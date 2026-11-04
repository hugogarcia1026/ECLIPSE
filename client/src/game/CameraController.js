
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput.js";
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraMouseWheelInput.js";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

export class CameraController {
  constructor(scene, canvas) {
    this.scene = scene;
    this.canvas = canvas;

    this.camera = new ArcRotateCamera(
      "cameraTerceiraPessoa",
      -Math.PI / 2,
      1.15,
      14,
      Vector3.Zero(),
      scene
    );

    this.camera.lowerRadiusLimit = 4;
    this.camera.upperRadiusLimit = 35;
    this.camera.lowerBetaLimit = 0.3;
    this.camera.upperBetaLimit = 1.5;

    this.camera.wheelPrecision = 4;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1500;

    this.camera.inertia = 0;
    this.camera.panningSensibility = 0;

    this.camera.attachControl(canvas, true);

    this.modos = [
      {
        nome: "TERCEIRA PESSOA",
        raio: 14,
        beta: 1.15,
        altura: 2.2,
        alpha: -Math.PI / 2
      },
      {
        nome: "VISÃO PRÓXIMA",
        raio: 7,
        beta: 1.25,
        altura: 2.5,
        alpha: -Math.PI / 2
      },
      {
        nome: "VISÃO ELEVADA",
        raio: 19,
        beta: 0.8,
        altura: 2,
        alpha: -Math.PI / 2
      }
    ];

    this.modoAtual = 0;

    this._tecla = (event) => {
      if (event.code !== "KeyV" || event.repeat) return;

      const elemento = event.target;

      if (
        elemento instanceof HTMLInputElement ||
        elemento instanceof HTMLTextAreaElement
      ) {
        return;
      }

      this.alternarModo();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._tecla);
    }

    this._aplicarModo();
  }

  _aplicarModo() {
    const modo = this.modos[this.modoAtual];

    this.camera.radius = modo.raio;
    this.camera.beta = modo.beta;
    this.camera.alpha = modo.alpha;

    this.camera.inertialAlphaOffset = 0;
    this.camera.inertialBetaOffset = 0;
    this.camera.inertialRadiusOffset = 0;
    this.camera.inertialPanningX = 0;
    this.camera.inertialPanningY = 0;
  }

  alternarModo() {
    this.modoAtual = (this.modoAtual + 1) % this.modos.length;

    this._aplicarModo();

    console.log(
      "Modo de câmera:",
      this.modos[this.modoAtual].nome
    );
  }

  atualizar(posicao) {
    const modo = this.modos[this.modoAtual];

    const alvo = new Vector3(
      posicao.x,
      posicao.y + modo.altura,
      posicao.z
    );

    // Atualização direta: sem atraso ou interpolação.
    this.camera.setTarget(alvo);
  }

  seguir(posicao) {
    this.atualizar(posicao);
  }

  dispose() {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this._tecla);
    }

    this.camera.detachControl();
  }
}


import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

export class CameraController {
  constructor(scene, canvas) {
    this.scene = scene;
    this.canvas = canvas;

    this.yaw = -Math.PI / 2;
    this.pitch = 0.25;

    this.pitchMin = -0.35;
    this.pitchMax = 1.0;

    this.sensibilidadeMouse = 0.005;

    this.arrastando = false;
    this.ultimoMouseX = 0;
    this.ultimoMouseY = 0;

    this.modos = [
      {
        nome: "TERCEIRA PESSOA",
        distancia: 14,
        alturaCamera: 5.8,
        alturaAlvo: 2.2
      },
      {
        nome: "VISÃO PRÓXIMA",
        distancia: 7,
        alturaCamera: 4.5,
        alturaAlvo: 2.5
      },
      {
        nome: "VISÃO ELEVADA",
        distancia: 19,
        alturaCamera: 14,
        alturaAlvo: 2
      }
    ];

    this.modoAtual = 0;
    this.zoom = this.modos[0].distancia;

    this.camera = new UniversalCamera(
      "cameraEclipse",
      new Vector3(0, 6, -14),
      scene
    );

    this.camera.minZ = 0.1;
    this.camera.maxZ = 1500;
    this.camera.fov = 0.8;
    this.camera.inertia = 0;
    this.camera.inputs.clear();

    scene.activeCamera = this.camera;

    this._configurarControles();
  }

  _configurarControles() {
    this._pointerDown = (event) => {
      if (event.button !== 2) return;

      this.arrastando = true;

      this.ultimoMouseX = event.clientX;
      this.ultimoMouseY = event.clientY;

      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch (erro) {
        // Continua funcionando mesmo se a captura não estiver disponível.
      }
    };

    this._pointerMove = (event) => {
      if (!this.arrastando) return;

      const deltaX = event.clientX - this.ultimoMouseX;
      const deltaY = event.clientY - this.ultimoMouseY;

      this.yaw += deltaX * this.sensibilidadeMouse;
      this.pitch -= deltaY * this.sensibilidadeMouse;

      this.pitch = Math.max(
        this.pitchMin,
        Math.min(this.pitchMax, this.pitch)
      );

      this.ultimoMouseX = event.clientX;
      this.ultimoMouseY = event.clientY;
    };

    this._pointerUp = (event) => {
      if (event.button !== 2) return;

      this.arrastando = false;

      try {
        if (this.canvas.hasPointerCapture(event.pointerId)) {
          this.canvas.releasePointerCapture(event.pointerId);
        }
      } catch (erro) {
        // Não interrompe o jogo.
      }
    };

    this._contextMenu = (event) => {
      event.preventDefault();
    };

    this._mouseWheel = (event) => {
      event.preventDefault();

      this.zoom += event.deltaY * 0.01;

      const modo = this.modos[this.modoAtual];

      this.zoom = Math.max(
        3,
        Math.min(modo.distancia + 12, this.zoom)
      );
    };

    this._tecla = (event) => {
      if (event.code !== "KeyV" || event.repeat) return;

      this.modoAtual =
        (this.modoAtual + 1) % this.modos.length;

      this.zoom = this.modos[this.modoAtual].distancia;
    };

    this.canvas.addEventListener("pointerdown", this._pointerDown);
    this.canvas.addEventListener("pointermove", this._pointerMove);
    this.canvas.addEventListener("pointerup", this._pointerUp);
    this.canvas.addEventListener("pointercancel", this._pointerUp);

    this.canvas.addEventListener("contextmenu", this._contextMenu);
    this.canvas.addEventListener("wheel", this._mouseWheel, {
      passive: false
    });

    window.addEventListener("keydown", this._tecla);
  }

  atualizar(posicaoJogador) {
    const modo = this.modos[this.modoAtual];
    const distancia = this.zoom;

    const alturaAlvo = posicaoJogador.y + modo.alturaAlvo;

    const horizontal = Math.cos(this.pitch) * distancia;
    const vertical = Math.sin(this.pitch) * distancia;

    const x =
      posicaoJogador.x +
      Math.cos(this.yaw) * horizontal;

    const z =
      posicaoJogador.z +
      Math.sin(this.yaw) * horizontal;

    const y =
      alturaAlvo +
      modo.alturaCamera -
      vertical;

    this.camera.position.set(x, y, z);

    const alvo = new Vector3(
      posicaoJogador.x,
      alturaAlvo,
      posicaoJogador.z
    );

    this.camera.setTarget(alvo);
  }

  dispose() {
    this.canvas.removeEventListener("pointerdown", this._pointerDown);
    this.canvas.removeEventListener("pointermove", this._pointerMove);
    this.canvas.removeEventListener("pointerup", this._pointerUp);
    this.canvas.removeEventListener("pointercancel", this._pointerUp);

    this.canvas.removeEventListener("contextmenu", this._contextMenu);
    this.canvas.removeEventListener("wheel", this._mouseWheel);

    window.removeEventListener("keydown", this._tecla);

    this.camera.dispose();
  }
}

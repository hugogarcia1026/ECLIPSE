
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Ray } from "@babylonjs/core/Culling/ray.js";

export class PlayerController {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.velocidade = 7;
    this.velocidadeCorrida = 11;
    this.velocidadeEsquiva = 19;

    this.vida = 100;
    this.vidaMaxima = 100;

    this.direcao = new Vector3(0, 0, 1);
    this.direcaoEsquiva = new Vector3(0, 0, 1);

    this.teclas = {};
    this.esquivando = false;
    this.tempoEsquiva = 0;
    this.cooldownEsquiva = 0;
    this.duracaoEsquiva = 0.32;
    this.intervaloEsquiva = 0.9;

    this.tempo = 0;

    this._criarPersonagem();
    this._configurarControles();
    this._configurarCamera();

    this._observador = this.scene.onBeforeRenderObservable.add(() => {
      this._atualizar();
    });
  }

  _criarPersonagem() {
    this.corpo = MeshBuilder.CreateCapsule(
      "jogador",
      {
        height: 2.1,
        radius: 0.43,
        tessellation: 12
      },
      this.scene
    );

    this.corpo.position = new Vector3(0, 1.05, 0);
    this.corpo.rotationQuaternion = null;

    const material = new StandardMaterial("materialJogador", this.scene);
    material.diffuseColor = new Color3(0.16, 0.18, 0.25);
    material.specularColor = new Color3(0.35, 0.35, 0.45);
    material.emissiveColor = new Color3(0.035, 0.015, 0.07);
    this.corpo.material = material;

    this.cabeca = MeshBuilder.CreateSphere(
      "cabecaJogador",
      { diameter: 0.58, segments: 12 },
      this.scene
    );

    this.cabeca.parent = this.corpo;
    this.cabeca.position = new Vector3(0, 0.83, 0);
    this.cabeca.scaling = new Vector3(0.85, 1, 0.85);

    const materialCabeca = new StandardMaterial("materialCabecaJogador", this.scene);
    materialCabeca.diffuseColor = new Color3(0.24, 0.22, 0.27);
    materialCabeca.emissiveColor = new Color3(0.025, 0.01, 0.04);
    this.cabeca.material = materialCabeca;

    this.corpo.isPickable = false;
    this.cabeca.isPickable = false;
  }

  _configurarControles() {
    this._aoPressionar = (evento) => {
      this.teclas[evento.code] = true;

      if (
        evento.code === "Space" &&
        !evento.repeat &&
        this.cooldownEsquiva <= 0
      ) {
        this._iniciarEsquiva();
        evento.preventDefault();
      }
    };

    this._aoSoltar = (evento) => {
      this.teclas[evento.code] = false;
    };

    window.addEventListener("keydown", this._aoPressionar);
    window.addEventListener("keyup", this._aoSoltar);
    window.addEventListener("blur", this._limparTeclas);
  }

  _limparTeclas = () => {
    this.teclas = {};
  };

  _configurarCamera() {
    this.camera = this.scene.activeCamera;

    if (this.camera) {
      this.camera.position = new Vector3(0, 5.5, -9);
      this.camera.setTarget(this.corpo.position);
    }
  }

  _iniciarEsquiva() {
    let x = 0;
    let z = 0;

    if (this.teclas.KeyW || this.teclas.ArrowUp) z += 1;
    if (this.teclas.KeyS || this.teclas.ArrowDown) z -= 1;
    if (this.teclas.KeyA || this.teclas.ArrowLeft) x -= 1;
    if (this.teclas.KeyD || this.teclas.ArrowRight) x += 1;

    if (x === 0 && z === 0) {
      this.direcaoEsquiva.copyFrom(this.direcao);
    } else {
      this.direcaoEsquiva.set(x, 0, z).normalize();
    }

    this.esquivando = true;
    this.tempoEsquiva = this.duracaoEsquiva;
    this.cooldownEsquiva = this.intervaloEsquiva;
  }

  _atualizar() {
    const delta = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.05);
    this.tempo += delta;

    this.cooldownEsquiva = Math.max(0, this.cooldownEsquiva - delta);

    const x =
      Number(this.teclas.KeyD || this.teclas.ArrowRight) -
      Number(this.teclas.KeyA || this.teclas.ArrowLeft);

    const z =
      Number(this.teclas.KeyW || this.teclas.ArrowUp) -
      Number(this.teclas.KeyS || this.teclas.ArrowDown);

    const movimento = new Vector3(x, 0, z);

    if (movimento.lengthSquared() > 0) {
      movimento.normalize();
      this.direcao.copyFrom(movimento);

      if (!this.esquivando) {
        this.corpo.rotation.y = Math.atan2(movimento.x, movimento.z);
      }
    }

    if (this.esquivando) {
      this.tempoEsquiva -= delta;

      this.corpo.position.addInPlace(
        this.direcaoEsquiva.scale(this.velocidadeEsquiva * delta)
      );

      if (this.tempoEsquiva <= 0) {
        this.esquivando = false;
      }
    } else if (movimento.lengthSquared() > 0) {
      const correndo = this.teclas.ShiftLeft || this.teclas.ShiftRight;
      const velocidade = correndo ? this.velocidadeCorrida : this.velocidade;

      this.corpo.position.addInPlace(movimento.scale(velocidade * delta));
    }

    this._ajustarAltura();
    this._atualizarCamera();
  }

  _ajustarAltura() {
    const ray = new Vector3(
      this.corpo.position.x,
      100,
      this.corpo.position.z
    );

    const direcao = new Vector3(0, -1, 0);

    const resultado = this.scene.pickWithRay(
      new Ray(ray, direcao, 200),
      (mesh) => mesh === this.world.terreno
    );

    if (resultado && resultado.hit && resultado.pickedPoint) {
      this.corpo.position.y = resultado.pickedPoint.y + 1.05;
    } else {
      this.corpo.position.y = 1.05;
    }
  }

  _atualizarCamera() {
    if (!this.camera) return;

    const alvo = this.corpo.position.add(new Vector3(0, 0.8, 0));
    const deslocamento = new Vector3(0, 5.2, -8.5);

    const posicaoDesejada = alvo.add(deslocamento);
    const suavizacao = 1 - Math.exp(-5 * this.scene.getEngine().getDeltaTime() / 1000);

    Vector3.LerpToRef(
      this.camera.position,
      posicaoDesejada,
      suavizacao,
      this.camera.position
    );

    this.camera.setTarget(alvo);
  }

  dispose() {
    this.scene.onBeforeRenderObservable.remove(this._observador);

    window.removeEventListener("keydown", this._aoPressionar);
    window.removeEventListener("keyup", this._aoSoltar);
    window.removeEventListener("blur", this._limparTeclas);

    this.corpo.dispose();
  }
}

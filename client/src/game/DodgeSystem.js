
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

export class DodgeSystem {
  constructor(jogador) {
    this.jogador = jogador;

    this.duracao = 0.24;
    this.tempoRestante = 0;

    this.cooldownMaximo = 1.0;
    this.cooldown = 0;

    this.velocidade = 17;
    this.direcao = Vector3.Zero();

    this.solicitada = false;

    this._tecla = (event) => {
      if (
        event.code !== "ControlLeft" &&
        event.code !== "ControlRight"
      ) {
        return;
      }

      if (event.repeat) return;

      const elemento = event.target;

      if (
        elemento instanceof HTMLInputElement ||
        elemento instanceof HTMLTextAreaElement
      ) {
        return;
      }

      this.solicitada = true;
    };

    window.addEventListener("keydown", this._tecla);
  }

  _iniciar() {
    if (this.cooldown > 0) return;
    if (this.jogador.vida <= 0) return;

    const rotacao = this.jogador.root.rotation.y;

    this.direcao.set(
      Math.sin(rotacao),
      0,
      Math.cos(rotacao)
    );

    if (this.direcao.lengthSquared() === 0) {
      return;
    }

    this.direcao.normalize();

    this.tempoRestante = this.duracao;
    this.cooldown = this.cooldownMaximo;

    this.jogador.invulnerabilidade = Math.max(
      this.jogador.invulnerabilidade ?? 0,
      this.duracao
    );
  }

  atualizar(delta) {
    this.cooldown = Math.max(0, this.cooldown - delta);

    if (this.solicitada) {
      this.solicitada = false;

      if (this.tempoRestante <= 0) {
        this._iniciar();
      }
    }

    if (this.tempoRestante <= 0) return;

    const passo = Math.min(delta, this.tempoRestante);

    this.jogador.root.position.addInPlace(
      this.direcao.scale(this.velocidade * passo)
    );

    this.tempoRestante -= passo;

    if (this.tempoRestante < 0) {
      this.tempoRestante = 0;
    }
  }

  dispose() {
    window.removeEventListener("keydown", this._tecla);
  }
}

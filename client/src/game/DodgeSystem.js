
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

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._tecla);
    }
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
    this.cooldown = Math.max(
      0,
      this.cooldown - delta
    );

    if (this.solicitada) {
      this.solicitada = false;

      if (this.tempoRestante <= 0) {
        this._iniciar();
      }
    }

    if (this.tempoRestante <= 0) return;

    const passo = Math.min(
      delta,
      this.tempoRestante
    );

    const deslocamento = this.direcao.scale(
      this.velocidade * passo
    );

    if (this.jogador.collisionSystem) {
      this.jogador.collisionSystem.deslocar(
        this.jogador.root,
        deslocamento,
        this.jogador.raioColisao ?? 0.5
      );
    } else {
      this.jogador.root.position.addInPlace(
        deslocamento
      );
    }

    // Acompanha o chão durante a esquiva: sobe e desce degraus
    // pequenos, mas cai normalmente (pela gravidade do Player)
    // ao sair de um desnível maior, em vez de teletransportar.
    const posicao = this.jogador.root.position;
    const alturaChao = this.jogador.alturaEm(posicao.x, posicao.z);

    const alturaDegrau =
      this.jogador.collisionSystem?.alturaMaximaDegrau ?? 0.95;

    const diferenca = alturaChao - posicao.y;

    if (diferenca >= 0) {
      // Entrou em um degrau mais alto (já liberado pela colisão)
      // ou está no mesmo nível: nunca fica abaixo do piso.
      posicao.y = alturaChao;
    } else if (
      this.jogador.noChao &&
      -diferenca <= alturaDegrau
    ) {
      // Degrau ou rampa para baixo: continua no chão.
      posicao.y = alturaChao;
    } else if (this.jogador.noChao) {
      // Saiu de um barranco: começa a cair.
      this.jogador.noChao = false;
    }

    this.tempoRestante -= passo;

    if (this.tempoRestante < 0) {
      this.tempoRestante = 0;
    }
  }

  dispose() {
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "keydown",
        this._tecla
      );
    }
  }
}

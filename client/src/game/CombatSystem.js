
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

export class CombatSystem {
  constructor(scene, jogador, colosso) {
    this.scene = scene;
    this.jogador = jogador;
    this.colosso = colosso;

    this.canvas = scene.getEngine().getRenderingCanvas();

    this.cooldown = 0;
    this.ataqueSolicitado = false;
    this.tempoMensagem = 0;

    // Sistema de combos
    this.comboStep = 0;
    this.comboTimer = 0;
    this.comboDuration = 1.2;
    this.comboDisplayTimer = 0;

    this.multiplicadoresCombo = [1, 1.15, 1.35];

    this._criarHUD();

    this._pointerDown = (event) => {
      if (event.button !== 0) return;
      if (event.target !== this.canvas) return;

      this.ataqueSolicitado = true;
    };

    this.canvas?.addEventListener("pointerdown", this._pointerDown);

    this._atualizarHUD();
  }

  _criarHUD() {
    document.getElementById("eclipse-combat-hud")?.remove();

    this.hud = document.createElement("div");
    this.hud.id = "eclipse-combat-hud";

    this.hud.innerHTML = `
      <div class="boss">
        <div class="boss-header">
          <span>AZH'KHAR</span>
          <span id="boss-phase">FASE 1</span>
        </div>

        <div class="bar">
          <div id="boss-health"></div>
        </div>

        <div id="boss-health-text">300 / 300</div>
      </div>

      <div class="player">
        <div>JOGADOR</div>

        <div class="bar">
          <div id="player-health"></div>
        </div>

        <div id="player-health-text">100 / 100</div>
      </div>

      <div class="weapon" id="weapon-name">ARMA: PUNHOS</div>

      <div class="message" id="combat-message"></div>

      <div class="combo" id="combo-display"></div>
    `;

    document.body.appendChild(this.hud);

    this.elementos = {
      bossHealth: this.hud.querySelector("#boss-health"),
      bossHealthText: this.hud.querySelector("#boss-health-text"),
      bossPhase: this.hud.querySelector("#boss-phase"),
      playerHealth: this.hud.querySelector("#player-health"),
      playerHealthText: this.hud.querySelector("#player-health-text"),
      weapon: this.hud.querySelector("#weapon-name"),
      message: this.hud.querySelector("#combat-message"),
      combo: this.hud.querySelector("#combo-display")
    };

    this.style = document.createElement("style");

    this.style.textContent = `
      #eclipse-combat-hud {
        position: fixed;
        inset: 0;
        z-index: 20;
        pointer-events: none;
        color: white;
        font-family: Arial, sans-serif;
      }

      #eclipse-combat-hud .boss {
        position: absolute;
        top: 25px;
        left: 50%;
        transform: translateX(-50%);
        width: min(440px, 75vw);
        text-align: center;
      }

      #eclipse-combat-hud .boss-header {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        font-weight: bold;
        letter-spacing: 2px;
        margin-bottom: 7px;
      }

      #eclipse-combat-hud .bar {
        height: 12px;
        background: rgba(0,0,0,0.7);
        border: 1px solid rgba(255,255,255,0.4);
        overflow: hidden;
      }

      #boss-health {
        height: 100%;
        width: 100%;
        background: #c52e35;
        transition: width 0.2s ease;
      }

      #player-health {
        height: 100%;
        width: 100%;
        background: #35bd65;
        transition: width 0.2s ease;
      }

      #boss-health-text,
      #player-health-text {
        font-size: 11px;
        margin-top: 4px;
      }

      #eclipse-combat-hud .player {
        position: absolute;
        bottom: 28px;
        left: 28px;
        width: 210px;
        font-size: 12px;
        font-weight: bold;
      }

      #eclipse-combat-hud .weapon {
        position: absolute;
        bottom: 30px;
        right: 30px;
        font-size: 13px;
        font-weight: bold;
      }

      #eclipse-combat-hud .message {
        position: absolute;
        top: 43%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 23px;
        font-weight: bold;
        color: #ffd36a;
        text-shadow: 0 2px 8px black;
        opacity: 0;
        transition: opacity 0.15s;
      }

      #eclipse-combat-hud .combo {
        position: absolute;
        top: 53%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 28px;
        font-weight: 900;
        color: #ffbd4a;
        letter-spacing: 3px;
        text-shadow: 0 3px 8px black;
        opacity: 0;
        transition: opacity 0.15s;
      }

      .eclipse-damage-number {
        position: fixed;
        z-index: 30;
        color: #ffd36a;
        font-size: 25px;
        font-weight: bold;
        pointer-events: none;
        text-shadow: 0 2px 5px black;
        animation: eclipseDamageFloat 0.8s ease-out forwards;
      }

      @keyframes eclipseDamageFloat {
        from {
          opacity: 1;
          transform: translateY(0);
        }

        to {
          opacity: 0;
          transform: translateY(-60px);
        }
      }
    `;

    document.head.appendChild(this.style);
  }

  _obterArma() {
    return this.jogador.armaAtual ?? {
      nome: "Punhos",
      dano: 15,
      alcance: 5,
      velocidade: 0.5
    };
  }

  _mostrarMensagem(texto, duracao = 1) {
    this.elementos.message.textContent = texto;
    this.elementos.message.style.opacity = "1";
    this.tempoMensagem = duracao;
  }

  _mostrarCombo(texto) {
    this.elementos.combo.textContent = texto;
    this.elementos.combo.style.opacity = "1";
    this.comboDisplayTimer = 0.75;
  }

  _mostrarDano(dano) {
    const numero = document.createElement("div");

    numero.className = "eclipse-damage-number";
    numero.textContent = `-${dano}`;
    numero.style.left = "50%";
    numero.style.top = "40%";

    document.body.appendChild(numero);

    numero.addEventListener("animationend", () => {
      numero.remove();
    }, { once: true });
  }

  _calcularCombo() {
    if (this.comboTimer <= 0) {
      this.comboStep = 0;
    }

    this.comboStep++;

    if (this.comboStep > 3) {
      this.comboStep = 1;
    }

    const multiplicador =
      this.multiplicadoresCombo[this.comboStep - 1];

    const etapa = this.comboStep;

    this.comboTimer = this.comboDuration;

    if (etapa === 3) {
      this._mostrarCombo("COMBO FINAL!");
      this.comboStep = 0;
    } else {
      this._mostrarCombo(`COMBO ${etapa}/3`);
    }

    return multiplicador;
  }

  _atacar() {
    if (this.jogador.vida <= 0) return;
    if (this.colosso.vida <= 0) return;

    const arma = this._obterArma();

    if (this.cooldown > 0) return;

    this.cooldown = Math.max(0.1, arma.velocidade ?? 0.5);

    this.jogador.iniciarAtaque?.();

    const jogador = this.jogador.root.position;
    const colosso = this.colosso.root.position;

    const distancia = Vector3.Distance(
      new Vector3(jogador.x, 0, jogador.z),
      new Vector3(colosso.x, 0, colosso.z)
    );

    if (distancia > (arma.alcance ?? 5)) {
      this.comboStep = 0;
      this.comboTimer = 0;
      this._mostrarMensagem("FORA DE ALCANCE");
      return;
    }

    const direcao = new Vector3(
      Math.sin(this.jogador.root.rotation.y),
      0,
      Math.cos(this.jogador.root.rotation.y)
    );

    const direcaoAlvo = new Vector3(
      colosso.x - jogador.x,
      0,
      colosso.z - jogador.z
    );

    if (direcaoAlvo.lengthSquared() > 0) {
      direcaoAlvo.normalize();
    }

    if (Vector3.Dot(direcao, direcaoAlvo) < 0.1) {
      this.comboStep = 0;
      this.comboTimer = 0;
      this._mostrarMensagem("VIRE-SE PARA O COLOSSO");
      return;
    }

    const multiplicador = this._calcularCombo();

    const danoBase = Math.max(0, Number(arma.dano) || 15);
    const dano = Math.round(danoBase * multiplicador);

    // Aplica o dano no colosso.
    this.colosso.receberDano(dano);

    this._mostrarMensagem("ACERTO!", 0.35);
    this._mostrarDano(dano);
  }

  _atualizarHUD() {
    const vidaMaximaColosso = this.colosso.vidaMaxima ?? 300;
    const vidaMaximaJogador = this.jogador.vidaMaxima ?? 100;

    const vidaColosso = Math.max(0, this.colosso.vida);
    const vidaJogador = Math.max(0, this.jogador.vida);

    this.elementos.bossHealth.style.width =
      `${Math.min(100, vidaColosso / vidaMaximaColosso * 100)}%`;

    this.elementos.playerHealth.style.width =
      `${Math.min(100, vidaJogador / vidaMaximaJogador * 100)}%`;

    this.elementos.bossHealthText.textContent =
      `${Math.ceil(vidaColosso)} / ${vidaMaximaColosso}`;

    this.elementos.playerHealthText.textContent =
      `${Math.ceil(vidaJogador)} / ${vidaMaximaJogador}`;

    this.elementos.bossPhase.textContent =
      `FASE ${this.colosso.fase ?? 1}`;

    this.elementos.weapon.textContent =
      `ARMA: ${this._obterArma().nome.toUpperCase()}`;
  }

  atualizar(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;

    this.cooldown = Math.max(0, this.cooldown - delta);

    // Tempo disponível para continuar o combo.
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - delta);

      if (this.comboTimer <= 0) {
        this.comboStep = 0;
      }
    }

    // Tempo de exibição do indicador de combo.
    if (this.comboDisplayTimer > 0) {
      this.comboDisplayTimer -= delta;

      if (this.comboDisplayTimer <= 0) {
        this.elementos.combo.style.opacity = "0";
      }
    }

    if (this.tempoMensagem > 0) {
      this.tempoMensagem -= delta;

      if (this.tempoMensagem <= 0) {
        this.elementos.message.style.opacity = "0";
      }
    }

    if (this.ataqueSolicitado) {
      this.ataqueSolicitado = false;

      if (this.cooldown <= 0) {
        this._atacar();
      }
    }

    this._atualizarHUD();
  }

  dispose() {
    this.canvas?.removeEventListener(
      "pointerdown",
      this._pointerDown
    );

    this.hud?.remove();
    this.style?.remove();
  }
}

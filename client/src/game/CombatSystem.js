
export class CombatSystem {
  constructor(scene, jogador, colosso) {
    this.scene = scene;
    this.jogador = jogador;
    this.colosso = colosso;

    this.danoAtaque = 35;
    this.alcance = 8;
    this.intervaloAtaque = 0.65;
    this.tempoRecarga = 0;
    this.ataqueSolicitado = false;
    this.tempoFeedback = 0;
    this.textoFeedback = "";

    this._aoClicar = (evento) => {
      if (
        evento.button === 0 &&
        evento.target === this.scene.getEngine().getRenderingCanvas()
      ) {
        this.ataqueSolicitado = true;
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", this._aoClicar);
    }

    this._criarHUD();
  }

  _criarHUD() {
    if (typeof document === "undefined") return;

    this.hud = document.createElement("div");

    this.hud.style.cssText = `
      position: fixed;
      top: 22px;
      left: 50%;
      transform: translateX(-50%);
      width: min(390px, 78vw);
      color: white;
      font-family: Arial, sans-serif;
      text-align: center;
      pointer-events: none;
      z-index: 20;
      text-shadow: 1px 2px 4px black;
    `;

    this.hud.innerHTML = `
      <div style="font-size:22px;font-weight:900;letter-spacing:3px">
        AZH'KHAR
      </div>

      <div style="font-size:11px;letter-spacing:2px;margin:3px 0 10px;color:#d6c5a9">
        O COLOSSO ADORMECIDO
      </div>

      <div id="eclipse-boss-phase"
        style="font-size:12px;font-weight:bold;margin-bottom:5px;color:#f0b46b">
        FASE I
      </div>

      <div style="height:14px;background:#181818;border:1px solid #b69b75;border-radius:8px;overflow:hidden">
        <div id="eclipse-boss-life"
          style="height:100%;width:100%;background:#a52b24;transition:width .15s">
        </div>
      </div>

      <div id="eclipse-boss-text"
        style="font-size:12px;margin-top:4px">
        300 / 300
      </div>

      <div style="margin-top:18px;text-align:left;font-size:12px;font-weight:bold">
        VIDA DO JOGADOR
      </div>

      <div style="height:12px;background:#181818;border:1px solid #aaa;border-radius:8px;overflow:hidden">
        <div id="eclipse-player-life"
          style="height:100%;width:100%;background:#399b53;transition:width .15s">
        </div>
      </div>

      <div id="eclipse-combat-message"
        style="margin-top:14px;font-size:14px;font-weight:bold;min-height:20px">
        CLIQUE ESQUERDO PARA ATACAR
      </div>
    `;

    document.body.appendChild(this.hud);

    this.barraColosso = this.hud.querySelector("#eclipse-boss-life");
    this.textoColosso = this.hud.querySelector("#eclipse-boss-text");
    this.faseColosso = this.hud.querySelector("#eclipse-boss-phase");
    this.barraJogador = this.hud.querySelector("#eclipse-player-life");
    this.mensagem = this.hud.querySelector("#eclipse-combat-message");
  }

  _mostrarFeedback(texto, duracao = 0.8) {
    this.textoFeedback = texto;
    this.tempoFeedback = duracao;
  }

  _atacar() {
    if (this.colosso.morto) {
      this._mostrarFeedback("O COLOSSO FOI DERROTADO");
      return;
    }

    const jogador = this.jogador.root.position;
    const inimigo = this.colosso.root.position;

    const direcao = inimigo.subtract(jogador);
    direcao.y = 0;

    const distancia = direcao.length();

    if (distancia > this.alcance || distancia < 0.001) {
      this._mostrarFeedback("VOCÊ ESTÁ LONGE DEMAIS");
      return;
    }

    direcao.normalize();

    const frenteX = Math.sin(this.jogador.root.rotation.y);
    const frenteZ = Math.cos(this.jogador.root.rotation.y);

    const alinhamento =
      frenteX * direcao.x + frenteZ * direcao.z;

    if (alinhamento < 0.25) {
      this._mostrarFeedback("VIRE-SE PARA O COLOSSO");
      return;
    }

    this.colosso.receberDano(this.danoAtaque);

    this._mostrarFeedback(
      this.colosso.morto
        ? "AZH'KHAR FOI DERROTADO!"
        : `ACERTO! -${this.danoAtaque} DE VIDA`
    );
  }

  atualizar(delta) {
    this.tempoRecarga = Math.max(
      0,
      this.tempoRecarga - delta
    );

    this.tempoFeedback = Math.max(
      0,
      this.tempoFeedback - delta
    );

    if (
      this.ataqueSolicitado &&
      this.tempoRecarga <= 0 &&
      this.jogador.vida > 0
    ) {
      this._atacar();
      this.tempoRecarga = this.intervaloAtaque;
    }

    this.ataqueSolicitado = false;

    if (!this.barraColosso) return;

    const vidaBoss = Math.max(
      0,
      (this.colosso.vida / this.colosso.vidaMaxima) * 100
    );

    const vidaJogador = Math.max(
      0,
      (this.jogador.vida / this.jogador.vidaMaxima) * 100
    );

    this.barraColosso.style.width = `${vidaBoss}%`;
    this.textoColosso.textContent =
      `${this.colosso.vida} / ${this.colosso.vidaMaxima}`;

    this.barraJogador.style.width = `${vidaJogador}%`;

    this.faseColosso.textContent =
      this.colosso.fase === 1 ? "FASE I" : "FASE II — DESPERTAR";

    this.faseColosso.style.color =
      this.colosso.fase === 1 ? "#f0b46b" : "#ff6848";

    if (this.colosso.morto) {
      this.mensagem.textContent = "AZH'KHAR FOI DERROTADO!";
    } else if (this.jogador.vida <= 0) {
      this.mensagem.textContent = "VOCÊ FOI DERROTADO!";
    } else if (this.tempoFeedback > 0) {
      this.mensagem.textContent = this.textoFeedback;
    } else if (this.colosso.ataqueAtual === "impacto") {
      this.mensagem.textContent = "CUIDADO! IMPACTO EM ÁREA!";
    } else if (this.colosso.ataqueAtual === "golpe") {
      this.mensagem.textContent = "CUIDADO! GOLPE SE APROXIMANDO!";
    } else {
      this.mensagem.textContent = "CLIQUE ESQUERDO PARA ATACAR";
    }
  }

  dispose() {
    if (typeof window !== "undefined") {
      window.removeEventListener("pointerdown", this._aoClicar);
    }

    this.hud?.remove();
  }
}

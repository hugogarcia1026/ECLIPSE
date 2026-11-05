import { Game } from "./game/Game.js";

const canvas = document.getElementById("renderCanvas");
const erro = document.getElementById("erro");
const fps = document.getElementById("fps");
const carregando = document.getElementById("carregando");
const overlay = document.getElementById("overlay");
const aviso = document.getElementById("aviso");

function mostrarErro(mensagem) {
  erro.textContent = mensagem;
  erro.hidden = false;
  carregando.classList.add("oculto");
}

let timerAviso = null;
function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.classList.add("visivel");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => aviso.classList.remove("visivel"), 2800);
}

function esconderCarregamento() {
  carregando.classList.add("oculto");
  overlay.classList.add("visivel");
}

async function iniciar() {
  // Deixa a tela de carregamento aparecer antes de gerar o mundo
  // (texturas e vegetação procedurais levam um instante).
  await new Promise((resolver) => requestAnimationFrame(() => setTimeout(resolver, 30)));

  try {
    const game = new Game(canvas, null, {
      aoMudarQualidade: (q, automatico) => {
        mostrarAviso(
          automatico
            ? `Gráficos ajustados para ${q.rotulo} (desempenho)`
            : `Qualidade gráfica: ${q.rotulo}`
        );
      }
    });

    game.iniciar((valor) => {
      fps.textContent = `${valor} FPS · ${game.graficos.qualidade.rotulo}`;
    });

    // Some com o carregamento quando os shaders estiverem prontos
    // (evita travadas no primeiro segundo de jogo).
    const reserva = setTimeout(esconderCarregamento, 12000);
    game.scene.executeWhenReady(() => {
      clearTimeout(reserva);
      setTimeout(esconderCarregamento, 250);
    });

    // Facilita a inspecao no console do navegador durante o desenvolvimento.
    window.eclipse = game;
  } catch (e) {
    console.error(e);
    mostrarErro(
      "Não foi possível iniciar o jogo. Verifique se o navegador suporta WebGL. Detalhe: " +
        e.message
    );
  }
}

iniciar();

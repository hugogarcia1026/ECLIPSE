import { Game } from "./game/Game.js";

const canvas = document.getElementById("renderCanvas");
const erro = document.getElementById("erro");
const fps = document.getElementById("fps");

function mostrarErro(mensagem) {
  erro.textContent = mensagem;
  erro.hidden = false;
}

try {
  const game = new Game(canvas);
  game.iniciar((valor) => {
    fps.textContent = `${valor} FPS`;
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

// Testes da Fase 1 (executar com: npm test)
// Usam o NullEngine do Babylon.js: sem GPU/navegador, mas com a cena real.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Game } from "../client/src/game/Game.js";

let falhas = 0;
function teste(nome, fn) {
  try {
    fn();
    console.log(`  OK    ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`  FALHA ${nome}\n        ${e.message}`);
  }
}

console.log("Fase 1 - projeto minimo executavel\n");

teste("arquivos essenciais existem", () => {
  for (const f of [
    "client/index.html",
    "client/styles/main.css",
    "client/src/main.js",
    "client/src/game/Game.js",
    "client/src/game/World.js",
    "client/src/game/CameraController.js",
  ]) {
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `faltando ${f}`);
  }
});

teste("index.html tem canvas e carrega main.js", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  assert.match(html, /id="renderCanvas"/);
  assert.match(html, /src="\.\/src\/main\.js"/);
  assert.match(html, /ECLIPSE/);
});

const engine = new NullEngine();
const game = new Game({}, engine); // canvas falso: NullEngine nao usa
const { scene } = game;

teste("cena criada com camera ativa", () => {
  assert.ok(scene.activeCamera, "sem camera ativa");
  assert.equal(scene.activeCamera.name, "cameraOrbital");
});

teste("terreno, agua, ceu e ruinas existem", () => {
  for (const nome of ["terreno", "agua", "ceu", "plataformaCentral", "nucleoPulso", "coluna0"]) {
    assert.ok(scene.getMeshByName(nome), `sem ${nome}`);
  }
});

teste("vegetacao e rochas foram posicionadas", () => {
  assert.ok(game.world.arvores.quantidade > 20, `poucas arvores: ${game.world.arvores.quantidade}`);
  assert.ok(game.world.rochas.quantidade > 20, `poucas rochas: ${game.world.rochas.quantidade}`);
});

teste("altura do terreno e deterministica e plana nas ruinas", () => {
  assert.equal(game.world.alturaEm(123, -45), game.world.alturaEm(123, -45));
  assert.equal(game.world.alturaEm(0, 0), 0);
  assert.ok(game.world.alturaEm(250, 250) > 10, "borda deveria ter montanhas");
});

teste("gerador de sombras configurado", () => {
  assert.ok(game.world.sombras, "sem ShadowGenerator");
  assert.ok(game.world.sombras.getShadowMap().renderList.length > 10);
});

teste("tres luzes na cena", () => {
  assert.equal(scene.lights.length, 3); // ambiente, sol e luz do Pulso
});

teste("renderiza 60 quadros sem lancar erro", () => {
  for (let i = 0; i < 60; i++) scene.render();
});

teste("dispose encerra sem erro", () => {
  game.dispose();
});

console.log(falhas === 0 ? "\nTodos os testes passaram." : `\n${falhas} teste(s) falharam.`);
process.exit(falhas === 0 ? 1 - 1 : 1);

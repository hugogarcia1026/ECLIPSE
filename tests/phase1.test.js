// Testes do ECLIPSE (executar com: npm test)
// Usam o NullEngine do Babylon.js: sem GPU/navegador, mas com a cena real.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";

// --------------------------------------------------
// DOM mínimo simulado
// CombatSystem, CameraController e WeaponSystem usam
// document / window / canvas diretamente. Em Node eles
// não existem, então criamos versões falsas e simples.
// --------------------------------------------------
function criarElementoFalso() {
  return {
    id: "",
    className: "",
    innerHTML: "",
    textContent: "",
    style: {},
    querySelector: () => criarElementoFalso(),
    appendChild: () => {},
    remove: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
  };
}

globalThis.document = {
  body: criarElementoFalso(),
  head: criarElementoFalso(),
  createElement: () => criarElementoFalso(),
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
};

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

const { Game } = await import("../client/src/game/Game.js");
const { CollisionSystem } = await import("../client/src/game/CollisionSystem.js");

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

const quase = (a, b, tolerancia = 0.01) => Math.abs(a - b) <= tolerancia;
const DT = 1 / 60;
const YAW_PARA_MAIS_Z = -Math.PI / 2; // câmera olhando para +z

console.log("ECLIPSE - estrutura, mundo e fisica\n");

teste("arquivos essenciais existem", () => {
  for (const f of [
    "client/index.html",
    "client/styles/main.css",
    "client/src/main.js",
    "client/src/game/Game.js",
    "client/src/game/World.js",
    "client/src/game/CameraController.js",
    "client/src/game/CollisionSystem.js",
    "client/src/game/DodgeSystem.js",
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
const game = new Game(criarElementoFalso(), engine);
const { scene, world, player, colossus, dodgeSystem } = game;
const colisao = game.collisionSystem;

teste("cena criada com camera ativa", () => {
  assert.ok(scene.activeCamera, "sem camera ativa");
});

teste("terreno, agua, ceu e ruinas existem", () => {
  for (const nome of [
    "terreno",
    "agua",
    "ceu",
    "plataformaCentral_0",
    "plataformaCentral_1",
    "plataformaCentral_2",
    "orbeCentral",
    "colunaRuina_0",
  ]) {
    assert.ok(scene.getMeshByName(nome), `sem ${nome}`);
  }
});

teste("vegetacao e rochas foram posicionadas", () => {
  assert.ok(world.arvores.quantidade > 20, `poucas arvores: ${world.arvores.quantidade}`);
  assert.ok(world.rochas.quantidade > 20, `poucas rochas: ${world.rochas.quantidade}`);
});

teste("altura do terreno e deterministica e plana nas ruinas", () => {
  assert.equal(world.alturaEm(123, -45), world.alturaEm(123, -45));
  assert.equal(world.alturaTerreno(0, 0), 0);
  assert.ok(world.alturaEm(250, 250) > 10, "borda deveria ter montanhas");
});

teste("altura combinada considera os tres degraus", () => {
  assert.ok(quase(world.alturaEm(0, -30), 0), "fora do monumento deveria ser 0");
  assert.ok(quase(world.alturaEm(0, -20), 0.8), "1o degrau deveria ser 0.8");
  assert.ok(quase(world.alturaEm(0, -17.5), 1.6), "2o degrau deveria ser 1.6");
  assert.ok(quase(world.alturaEm(5, -5), 2.4), "topo deveria ser 2.4");
});

teste("colunas apoiadas no topo da plataforma", () => {
  const coluna = scene.getMeshByName("colunaRuina_0"); // altura 14
  const base = coluna.position.y - 7;
  assert.ok(quase(base, 2.4), `base da coluna em ${base.toFixed(2)}`);
});

teste("arvores, rochas e ruinas entram na colisao", () => {
  const totalVegetacao = world.arvores.quantidade + world.rochas.quantidade;
  const totalRuinas = world.ruinas.obstaculos.length;
  assert.equal(colisao.obstaculos.length, totalVegetacao + totalRuinas);
});

teste("colisao: degrau baixo e piso, plataforma alta e parede", () => {
  const sistema = new CollisionSystem([
    { tipo: "retangulo", x: 0, z: 0, largura: 10, profundidade: 10, topo: 0.8 },
  ]);
  const p = { x: 0, y: 0, z: -5.3 }; // encostado na borda
  sistema.resolver(p, 0.5);
  assert.ok(quase(p.z, -5.3), "degrau de 0.8 nao deveria bloquear");

  const muro = new CollisionSystem([
    { tipo: "retangulo", x: 0, z: 0, largura: 10, profundidade: 10, topo: 5 },
  ]);
  const q = { x: 0, y: 0, z: -5.3 };
  muro.resolver(q, 0.5);
  assert.ok(q.z <= -5.5 + 1e-6, `plataforma alta deveria empurrar (z=${q.z})`);
});

teste("jogador e colosso nao nascem dentro de obstaculos", () => {
  for (const ob of colisao.obstaculos) {
    if (ob.tipo) continue; // so circulos
    const dj = Math.hypot(player.root.position.x - ob.x, player.root.position.z - ob.z);
    assert.ok(dj >= ob.raio + player.raioColisao - 1e-6, "jogador nasceu dentro de obstaculo");
    const dc = Math.hypot(colossus.root.position.x - ob.x, colossus.root.position.z - ob.z);
    assert.ok(dc >= ob.raio + colossus.raioColisao - 1e-6, "colosso nasceu dentro de obstaculo");
  }
});

// Passa entre as colunas (x = 3.36) e caminha até o topo.
function posicionarJogador(x, z) {
  player.root.position.set(x, world.alturaEm(x, z), z);
  player.velocidadeVertical = 0;
  player.noChao = true;
}

function caminhar(teclas, segundos, aoQuadro) {
  player.teclas = teclas;
  for (let t = 0; t < segundos; t += DT) {
    player.atualizar(DT, YAW_PARA_MAIS_Z);
    dodgeSystem.atualizar(DT);
    aoQuadro?.();
  }
  player.teclas = {};
}

teste("jogador sobe os tres degraus caminhando", () => {
  posicionarJogador(3.36, -30);
  caminhar({ w: true }, 2.2);
  const p = player.root.position;
  assert.ok(p.z > -16, `parou na borda (z=${p.z.toFixed(2)})`);
  assert.ok(quase(p.y, 2.4), `deveria estar no topo (y=${p.y.toFixed(2)})`);
  assert.equal(player.noChao, true);
});

teste("jogador desce os degraus caindo, sem pular no ar", () => {
  let caiu = false;
  caminhar({ s: true }, 3, () => {
    const p = player.root.position;
    if (p.y > world.alturaEm(p.x, p.z) + 0.05) {
      caiu = true;
      assert.equal(player.noChao, false, "noChao deveria ser false durante a queda");
    }
  });
  // Espera pousar.
  caminhar({}, 0.5);
  const p = player.root.position;
  assert.ok(caiu, "deveria ter havido queda entre os degraus");
  assert.ok(quase(p.y, 0), `deveria estar no chao (y=${p.y.toFixed(2)})`);
  assert.equal(player.noChao, true);
});

function esquivar(direcaoX) {
  player.root.rotation.y = Math.atan2(direcaoX, 0);
  dodgeSystem.cooldown = 0;
  dodgeSystem.solicitada = true;
  caminhar({}, 0.4);
}

teste("esquiva nao atravessa coluna", () => {
  posicionarJogador(16.5, 0); // coluna em (13, 0)
  esquivar(-1);
  const x = player.root.position.x;
  assert.ok(x >= 13 + 1.25 + player.raioColisao - 1e-6, `atravessou a coluna (x=${x.toFixed(2)})`);
});

teste("esquiva sobe degrau", () => {
  posicionarJogador(20.5, 3); // 1o degrau
  esquivar(-1);
  const p = player.root.position;
  assert.ok(p.x < 19, `nao subiu o degrau (x=${p.x.toFixed(2)})`);
  assert.ok(quase(p.y, world.alturaEm(p.x, p.z)), `fora do piso (y=${p.y.toFixed(2)})`);
});

teste("colosso sobe os degraus perseguindo o jogador", () => {
  posicionarJogador(-17.5, 3);
  colossus.desppertando = false;
  colossus.despertando = false;
  const alcanceOriginal = colossus.distanciaAtaque;
  colossus.distanciaAtaque = 1; // so para o teste: nao parar para atacar
  colossus.root.position.set(-40, world.alturaEm(-40, 3), 3);

  for (let t = 0; t < 12; t += DT) colossus.atualizar(DT, player);

  colossus.distanciaAtaque = alcanceOriginal;
  const c = colossus.root.position;
  assert.ok(c.x > -21, `colosso travou na borda (x=${c.x.toFixed(2)})`);
  assert.ok(quase(c.y, world.alturaEm(c.x, c.z)), "colosso fora do piso");
});

teste("gerador de sombras configurado", () => {
  assert.ok(world.sombras, "sem ShadowGenerator");
  assert.ok(world.sombras.getShadowMap().renderList.length > 10);
});

teste("tres luzes na cena", () => {
  assert.equal(scene.lights.length, 3); // ambiente, sol e luz do orbe
});

teste("loop do jogo roda 120 quadros sem lancar erro", () => {
  posicionarJogador(3.36, -30);
  for (let i = 0; i < 120; i++) {
    player.atualizar(DT, game.cameraController.yaw);
    dodgeSystem.atualizar(DT);
    colossus.atualizar(DT, player);
    game.combat.atualizar(DT);
    game.cameraController.atualizar(player.root.position);
    scene.render();
  }
});

teste("dispose encerra sem erro", () => {
  game.dispose();
});

console.log(falhas === 0 ? "\nTodos os testes passaram." : `\n${falhas} teste(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);

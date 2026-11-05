import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration.js";

import { World } from "./World.js";
import { CameraController } from "./CameraController.js";
import { Player } from "./Player.js";
import { Colossus } from "./Colossus.js";
import { CombatSystem } from "./CombatSystem.js";
import { WeaponSystem } from "./WeaponSystem.js";
import { DodgeSystem } from "./DodgeSystem.js";
import { CollisionSystem } from "./CollisionSystem.js";
import { Efeitos } from "./Efeitos.js";
import { Graficos, lerQualidade } from "./Graficos.js";
import { criarMaterial } from "./Materiais.js";

export class Game {
  constructor(canvas, engine = null, opcoes = {}) {
    this.canvas = canvas;

    this.engine =
      engine ?? new Engine(canvas, true, { stencil: true, antialias: true });

    this.scene = new Scene(this.engine);

    this.qualidade = opcoes.qualidade ?? lerQualidade();
    this.aoMudarQualidade = opcoes.aoMudarQualidade ?? null;

    // A câmera vem antes do mundo: as sombras em cascata dependem dela.
    this.cameraController = new CameraController(
      this.scene,
      this.canvas
    );

    this.world = new World(this.scene, { qualidade: this.qualidade });

    // Um único sistema de colisão, compartilhado pelo jogador,
    // pela esquiva e pelo colosso.
    this.collisionSystem = new CollisionSystem(
      this.world.obstaculos
    );

    this.player = new Player(
      this.scene,
      this.world.alturaEm,
      this.collisionSystem
    );

    // A esquiva usa o collisionSystem do próprio jogador.
    this.dodgeSystem = new DodgeSystem(this.player);

    this.weaponSystem = new WeaponSystem(
      this.scene,
      this.player
    );
    this._aprimorarArmas();

    this.colossus = new Colossus(
      this.scene,
      this.world.alturaEm,
      0,
      14,
      this.collisionSystem
    );

    this.combat = new CombatSystem(
      this.scene,
      this.player,
      this.colossus
    );

    // Efeitos visuais (partículas, ondas de choque).
    this.efeitos = new Efeitos(this.scene, {
      alturaEm: this.world.alturaEm,
      posicaoOrbe: this.world.ruinas.orbe.position,
      intensidade: this.qualidade.particulas ?? 1
    });
    this.colossus.efeitos = this.efeitos;

    // Personagens (e armas) projetam sombra.
    this.world.adicionarSombra(
      this.player.root.getChildMeshes(false).filter((m) => m !== this.player.rastro)
    );
    this.world.adicionarSombra(this.colossus.root.getChildMeshes(false));

    this._configurarImagem();

    this.graficos = new Graficos(this.scene, this.cameraController.camera, {
      direcaoSol: this.world.direcaoSol,
      qualidade: this.qualidade,
      excluirBrilho: [
        this.scene.getMeshByName("feixeOrbe"),
        this.scene.getMeshByName("cascaOrbe"),
        this.scene.getMeshByName("runasChao"),
        this.scene.getMeshByName("runasChaoExterno")
      ],
      aoMudar: (q, automatico) => this.aoMudarQualidade?.(q, automatico)
    });

    this._onResize = () => this.engine.resize();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", this._onResize);
    }

    this.cameraController.atualizar(
      this.player.root.position
    );
  }

  /**
   * Troca os materiais simples das armas (criados pelo WeaponSystem,
   * que não é alterado) por materiais PBR, coerentes com o resto da cena.
   */
  _aprimorarArmas() {
    const s = this.scene;
    const mapa = {
      metalArmas: criarMaterial(s, "metalArmasPBR", {
        cor: [0.8, 0.82, 0.85], metal: 1, rugosidade: 0.2, normal: "metal", escala: 1, nivelNormal: 0.25
      }),
      caboArmas: criarMaterial(s, "caboArmasPBR", {
        cor: [0.26, 0.15, 0.09], rugosidade: 0.62, normal: "terreno", escala: 2, nivelNormal: 0.5
      }),
      detalhesArmas: criarMaterial(s, "detalhesArmasPBR", {
        cor: [0.96, 0.74, 0.4], metal: 1, rugosidade: 0.26
      }),
      pontaLanca: criarMaterial(s, "pontaLancaPBR", {
        cor: [0.78, 0.8, 0.84], metal: 1, rugosidade: 0.22, normal: "metal", escala: 1, nivelNormal: 0.25
      })
    };
    for (const modelo of Object.values(this.weaponSystem.modelos ?? {})) {
      for (const malha of modelo.getChildMeshes(false)) {
        const novo = mapa[malha.material?.name];
        if (novo) malha.material = novo;
      }
    }
    this._materiaisArmas = Object.values(mapa);
  }

  // Usado quando não há pipeline de pós-processamento (ex.: testes);
  // com o pipeline ativo, o Graficos assume estes ajustes.
  _configurarImagem() {
    const ip = this.scene.imageProcessingConfiguration;

    ip.toneMappingEnabled = true;
    ip.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES;

    ip.exposure = 1.05;
    ip.contrast = 1.12;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.6;
  }

  /** Atualiza um quadro da simulação (sem desenhar). */
  passo(delta) {
    if (this.player.vida > 0) {
      this.player.esquivando = this.dodgeSystem.tempoRestante > 0;

      this.player.atualizar(
        delta,
        this.cameraController.yaw
      );

      this.dodgeSystem.atualizar(delta);
    } else {
      this.player.atualizarDerrota(delta);
    }

    this.colossus.atualizar(delta, this.player);

    this.combat.atualizar(delta);

    this.efeitos.atualizar(delta, this.player.root.position);
    this.graficos.atualizar(delta);

    this.cameraController.atualizar(
      this.player.root.position
    );
  }

  iniciar(aoAtualizarFps) {
    this.engine.runRenderLoop(() => {
      const delta = Math.min(
        this.engine.getDeltaTime() / 1000,
        0.05
      );

      this.passo(delta);

      this.scene.render();

      if (aoAtualizarFps) {
        aoAtualizarFps(
          Math.round(this.engine.getFps())
        );
      }
    });
  }

  dispose() {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this._onResize);
    }

    this.engine.stopRenderLoop();

    this.graficos.dispose();
    this.efeitos.dispose();

    this.combat.dispose();
    this.dodgeSystem.dispose();
    this.weaponSystem.dispose();
    for (const material of this._materiaisArmas ?? []) material.dispose();

    this.colossus.dispose();
    this.player.dispose();
    this.cameraController.dispose();

    this.scene.dispose();
    this.engine.dispose();
  }
}

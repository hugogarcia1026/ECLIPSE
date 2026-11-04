
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

export class Game {
  constructor(canvas, engine = null) {
    this.canvas = canvas;

    this.engine =
      engine ?? new Engine(canvas, true, { stencil: true });

    this.scene = new Scene(this.engine);

    this.world = new World(this.scene);

    this.cameraController = new CameraController(
      this.scene,
      this.canvas
    );

    this.player = new Player(
      this.scene,
      this.world.alturaEm
    );

    this.dodgeSystem = new DodgeSystem(this.player);

    this.weaponSystem = new WeaponSystem(
      this.scene,
      this.player
    );

    this.colossus = new Colossus(
      this.scene,
      this.world.alturaEm,
      0,
      14
    );

    this.combat = new CombatSystem(
      this.scene,
      this.player,
      this.colossus
    );

    this._configurarImagem();

    this._onResize = () => this.engine.resize();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", this._onResize);
    }

    this.cameraController.atualizar(
      this.player.root.position
    );
  }

  _configurarImagem() {
    const ip = this.scene.imageProcessingConfiguration;

    ip.toneMappingEnabled = true;
    ip.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES;

    ip.exposure = 1.15;
    ip.contrast = 1.2;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.2;
  }

  iniciar(aoAtualizarFps) {
    this.engine.runRenderLoop(() => {
      const delta = Math.min(
        this.engine.getDeltaTime() / 1000,
        0.05
      );

      if (this.player.vida > 0) {
        this.player.atualizar(
          delta,
          this.cameraController.yaw
        );

        this.dodgeSystem.atualizar(delta);

      }

      this.colossus.atualizar(delta, this.player);

      this.combat.atualizar(delta);

      this.cameraController.atualizar(
        this.player.root.position
      );

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

    this.combat.dispose();
    this.dodgeSystem.dispose();
    this.weaponSystem.dispose();

    this.colossus.dispose();
    this.player.dispose();
    this.cameraController.dispose();

    this.scene.dispose();
    this.engine.dispose();
  }

}

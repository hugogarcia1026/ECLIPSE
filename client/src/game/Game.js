import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration.js";
import { World } from "./World.js";
import { CameraController } from "./CameraController.js";

/**
 * Responsavel pelo ciclo de vida: engine, cena, loop de render e resize.
 * A construcao do cenario fica em World e a camera em CameraController.
 * O parametro `engine` permite injetar um NullEngine nos testes.
 */
export class Game {
  constructor(canvas, engine = null) {
    this.canvas = canvas;
    this.engine = engine ?? new Engine(canvas, true, { stencil: true });
    this.scene = new Scene(this.engine);

    this.world = new World(this.scene);
    this.cameraController = new CameraController(this.scene, this.canvas);
    this._configurarImagem();

    this._onResize = () => this.engine.resize();
    if (typeof window !== "undefined") window.addEventListener("resize", this._onResize);
  }

  /** Aspecto cinematografico: tone mapping, contraste e vinheta. */
  _configurarImagem() {
    const ip = this.scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.15;
    ip.contrast = 1.2;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.2;
  }

  iniciar(aoAtualizarFps) {
    this.engine.runRenderLoop(() => {
      this.scene.render();
      if (aoAtualizarFps) aoAtualizarFps(Math.round(this.engine.getFps()));
    });
  }

  dispose() {
    if (typeof window !== "undefined") window.removeEventListener("resize", this._onResize);
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}

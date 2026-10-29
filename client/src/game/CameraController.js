import "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput.js";
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraMouseWheelInput.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

/**
 * Camera orbital provisoria da Fase 1 (apenas para inspecionar a cena).
 * A camera em terceira pessoa seguindo o personagem sera feita na Fase 2.
 */
export class CameraController {
  constructor(scene, canvas) {
    this.camera = new ArcRotateCamera(
      "cameraOrbital",
      -Math.PI / 2,
      1.25,
      60,
      new Vector3(0, 8, 0),
      scene
    );
    this.camera.lowerRadiusLimit = 10;
    this.camera.upperRadiusLimit = 180;
    this.camera.upperBetaLimit = Math.PI / 2 - 0.05; // nao desce abaixo do chao
    this.camera.wheelPrecision = 4;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 1500;
    this.camera.attachControl(canvas, true);
  }
}

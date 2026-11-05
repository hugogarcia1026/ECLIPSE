import "@babylonjs/core/Particles/particleSystemComponent.js";
import "@babylonjs/core/Meshes/Builders/discBuilder.js";

import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Constants } from "@babylonjs/core/Engines/constants.js";

import { textura } from "./Texturas.js";

/**
 * Efeitos visuais: poeira no ar, partículas do orbe, poeira de
 * impacto, ondas de choque e brasas do colosso.
 * Não interferem na lógica do jogo.
 */
export class Efeitos {
  constructor(scene, { alturaEm, posicaoOrbe = null, intensidade = 1 } = {}) {
    this.scene = scene;
    this.alturaEm = alturaEm ?? (() => 0);
    this.intensidade = intensidade;
    this.sistemas = [];

    this.texParticula = textura(scene, "particula");
    this.texFumaca = textura(scene, "fumaca");

    this._criarPoeiraAmbiente();
    if (posicaoOrbe) this._criarParticulasOrbe(posicaoOrbe);
    this._criarPoeiraImpacto();
    this._criarOndas();
  }

  _sistema(nome, capacidade, texturaBase) {
    const ps = new ParticleSystem(nome, Math.max(10, Math.round(capacidade * this.intensidade)), this.scene);
    ps.particleTexture = texturaBase;
    ps.isLocal = false;
    this.sistemas.push(ps);
    return ps;
  }

  // Grãos de poeira/pólen iluminados pelo sol, sempre perto do jogador.
  _criarPoeiraAmbiente() {
    const ps = this._sistema("poeiraAmbiente", 380, this.texParticula);
    this.emissorAmbiente = new Vector3(0, 0, 0);
    ps.emitter = this.emissorAmbiente;
    ps.createBoxEmitter(
      new Vector3(-0.15, 0.02, -0.1),
      new Vector3(0.2, 0.1, 0.15),
      new Vector3(-20, 0.3, -20),
      new Vector3(20, 9, 20)
    );
    ps.emitRate = 40 * this.intensidade;
    ps.minLifeTime = 5;
    ps.maxLifeTime = 9;
    ps.minSize = 0.03;
    ps.maxSize = 0.09;
    ps.minEmitPower = 0.15;
    ps.maxEmitPower = 0.4;
    ps.gravity = new Vector3(0, -0.012, 0);
    ps.color1 = new Color4(1.0, 0.85, 0.6, 0.55);
    ps.color2 = new Color4(1.0, 0.72, 0.45, 0.35);
    ps.colorDead = new Color4(1.0, 0.7, 0.4, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.preWarmCycles = 60;
    ps.preWarmStepOffset = 5;
    ps.start();
    this.poeiraAmbiente = ps;
  }

  // Centelhas subindo do orbe central.
  _criarParticulasOrbe(posicao) {
    const ps = this._sistema("particulasOrbe", 220, this.texParticula);
    ps.emitter = posicao.clone();
    ps.createSphereEmitter(2.3, 0.4);
    ps.emitRate = 28 * this.intensidade;
    ps.minLifeTime = 2.5;
    ps.maxLifeTime = 5;
    ps.minSize = 0.05;
    ps.maxSize = 0.16;
    ps.minEmitPower = 0.05;
    ps.maxEmitPower = 0.25;
    ps.gravity = new Vector3(0, 0.55, 0);
    ps.color1 = new Color4(0.45, 0.9, 2.0, 1);
    ps.color2 = new Color4(0.2, 0.6, 1.6, 0.8);
    ps.colorDead = new Color4(0.1, 0.3, 1.0, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.preWarmCycles = 80;
    ps.preWarmStepOffset = 5;
    ps.start();
    this.particulasOrbe = ps;
  }

  // Poeira de impacto (passos e golpes do colosso): disparos manuais.
  _criarPoeiraImpacto() {
    const ps = this._sistema("poeiraImpacto", 700, this.texFumaca);
    this.emissorImpacto = new Vector3(0, 0, 0);
    ps.emitter = this.emissorImpacto;
    ps.createHemisphericEmitter(1.5, 1);
    ps.emitRate = 0;
    ps.manualEmitCount = 0;
    ps.minLifeTime = 1.2;
    ps.maxLifeTime = 2.6;
    ps.minSize = 1.2;
    ps.maxSize = 3.2;
    ps.minEmitPower = 1.5;
    ps.maxEmitPower = 5;
    ps.minInitialRotation = 0;
    ps.maxInitialRotation = Math.PI * 2;
    ps.minAngularSpeed = -0.6;
    ps.maxAngularSpeed = 0.6;
    ps.gravity = new Vector3(0, -0.6, 0);
    ps.color1 = new Color4(0.62, 0.54, 0.45, 0.34);
    ps.color2 = new Color4(0.5, 0.44, 0.38, 0.26);
    ps.colorDead = new Color4(0.45, 0.4, 0.36, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.addDragGradient(0, 0.2);
    ps.addDragGradient(1, 0.9);
    ps.start();
    this.poeiraImpacto = ps;
  }

  /** Nuvem de poeira em `posicao`. `forca` ~ 0.3 (passo) a 1.5 (golpe). */
  poeira(posicao, forca = 1) {
    const ps = this.poeiraImpacto;
    this.emissorImpacto.copyFrom(posicao);
    ps.minSize = 0.8 + forca * 0.8;
    ps.maxSize = 1.6 + forca * 2.2;
    ps.minEmitPower = 0.8 + forca * 1.2;
    ps.maxEmitPower = 2 + forca * 4;
    ps.manualEmitCount = Math.round((12 + forca * 50) * this.intensidade);
  }

  _criarOndas() {
    const anel = textura(this.scene, "anel");
    this.ondas = [];
    for (let i = 0; i < 3; i++) {
      const disco = MeshBuilder.CreateDisc(`ondaChoque_${i}`, { radius: 1, tessellation: 64 }, this.scene);
      disco.rotation.x = Math.PI / 2;
      const mat = new StandardMaterial(`materialOndaChoque_${i}`, this.scene);
      mat.disableLighting = true;
      mat.diffuseColor = Color3.Black();
      mat.emissiveColor = new Color3(2.4, 1.0, 0.35);
      mat.opacityTexture = anel;
      mat.alphaMode = Constants.ALPHA_ADD;
      mat.backFaceCulling = false;
      mat.disableDepthWrite = true;
      mat.zOffset = -4;
      disco.material = mat;
      disco.isPickable = false;
      disco.setEnabled(false);
      this.ondas.push({ disco, mat, tempo: 0, duracao: 0.75, raio: 12 });
    }
  }

  /** Onda de choque no chão (golpe do colosso). */
  ondaDeChoque(posicao, raio = 12, cor = null) {
    const onda = this.ondas.find((o) => !o.disco.isEnabled()) ?? this.ondas[0];
    onda.tempo = 0;
    onda.raio = raio;
    onda.disco.position.set(posicao.x, posicao.y + 0.12, posicao.z);
    if (cor) onda.mat.emissiveColor.copyFrom(cor);
    onda.disco.setEnabled(true);
    this.poeira(posicao, 1.5);
  }

  /** Brasas que saem de uma malha (colosso na fase 2). */
  criarBrasas(malha, raio = 1.6) {
    const ps = this._sistema("brasas", 260, this.texParticula);
    ps.emitter = malha;
    ps.createSphereEmitter(raio, 0.6);
    ps.emitRate = 0;
    ps.minLifeTime = 1.2;
    ps.maxLifeTime = 2.8;
    ps.minSize = 0.08;
    ps.maxSize = 0.28;
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 1.2;
    ps.gravity = new Vector3(0, 2.2, 0);
    ps.color1 = new Color4(2.5, 0.9, 0.2, 1);
    ps.color2 = new Color4(2.0, 0.45, 0.08, 1);
    ps.colorDead = new Color4(0.6, 0.1, 0.02, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.start();
    return ps;
  }

  atualizar(delta, posicaoJogador) {
    if (posicaoJogador) {
      this.emissorAmbiente.copyFrom(posicaoJogador);
    }

    for (const onda of this.ondas) {
      if (!onda.disco.isEnabled()) continue;
      onda.tempo += delta;
      const t = Math.min(1, onda.tempo / onda.duracao);
      const s = 1 + (onda.raio - 1) * (1 - Math.pow(1 - t, 2.2));
      onda.disco.scaling.set(s, s, s);
      onda.mat.alpha = Math.pow(1 - t, 1.5);
      if (t >= 1) onda.disco.setEnabled(false);
    }
  }

  dispose() {
    for (const ps of this.sistemas) ps.dispose(false);
    for (const onda of this.ondas) {
      onda.mat.dispose();
      onda.disco.dispose();
    }
  }
}

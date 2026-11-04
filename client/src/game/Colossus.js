
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";

export class Colossus {
  constructor(scene, alturaEm, x = 0, z = 14) {
    this.scene = scene;
    this.alturaEm = alturaEm;

    this.nome = "AZH'KHAR";
    this.titulo = "O COLOSSO ADORMECIDO";

    this.vidaMaxima = 300;
    this.vida = 300;

    this.fase = 1;
    this.velocidade = 2.2;
    this.dano = 12;

    this.morto = false;
    this.desppertando = false;
    this.tempoDespertar = 0;
    this.duracaoDespertar = 2.5;

    this.tempoAtaque = 1;
    this.ataqueAtual = null;
    this.tempoPreparacao = 0;
    this.tempoAnimacao = 0;

    this.root = new TransformNode("AzhKhar", scene);
    this.root.position.set(x, alturaEm(x, z), z);

    this._criarMateriais();
    this._criarModelo();
  }

  _criarMateriais() {
    this.materialCorpo = new StandardMaterial("azhKharCorpo", this.scene);
    this.materialCorpo.diffuseColor = new Color3(0.16, 0.19, 0.23);

    this.materialArmadura = new StandardMaterial("azhKharArmadura", this.scene);
    this.materialArmadura.diffuseColor = new Color3(0.38, 0.32, 0.25);

    this.materialOlhos = new StandardMaterial("azhKharOlhos", this.scene);
    this.materialOlhos.diffuseColor = new Color3(1, 0.2, 0.03);
    this.materialOlhos.emissiveColor = new Color3(0.8, 0.06, 0.01);

    this.materialEnergia = new StandardMaterial("azhKharEnergia", this.scene);
    this.materialEnergia.diffuseColor = new Color3(0.5, 0.04, 0.01);
    this.materialEnergia.emissiveColor = new Color3(0.7, 0.02, 0.005);
  }

  _criarModelo() {
    const caixa = (nome, tamanho, posicao, material) => {
      const mesh = MeshBuilder.CreateBox(nome, tamanho, this.scene);
      mesh.position.copyFrom(posicao);
      mesh.material = material;
      mesh.parent = this.root;
      return mesh;
    };

    const esfera = (nome, diametro, posicao, material) => {
      const mesh = MeshBuilder.CreateSphere(
        nome,
        { diameter: diametro, segments: 16 },
        this.scene
      );
      mesh.position.copyFrom(posicao);
      mesh.material = material;
      mesh.parent = this.root;
      return mesh;
    };

    caixa("azhPernaEsquerda", { width: 1.15, height: 2.5, depth: 1.2 },
      new Vector3(-0.85, 1.25, 0), this.materialCorpo);

    caixa("azhPernaDireita", { width: 1.15, height: 2.5, depth: 1.2 },
      new Vector3(0.85, 1.25, 0), this.materialCorpo);

    this.tronco = caixa("azhTronco",
      { width: 3.3, height: 3.4, depth: 1.7 },
      new Vector3(0, 4.1, 0), this.materialArmadura);

    esfera("azhCabeca", 1.7, new Vector3(0, 6.4, 0), this.materialCorpo);

    esfera("azhOmbroEsquerdo", 1.5, new Vector3(-2, 5.3, 0), this.materialArmadura);
    esfera("azhOmbroDireito", 1.5, new Vector3(2, 5.3, 0), this.materialArmadura);

    caixa("azhBracoEsquerdo", { width: 1, height: 2.8, depth: 1 },
      new Vector3(-2.15, 3.7, 0), this.materialCorpo);

    caixa("azhBracoDireito", { width: 1, height: 2.8, depth: 1 },
      new Vector3(2.15, 3.7, 0), this.materialCorpo);

    this.olhoEsquerdo = esfera("azhOlhoEsquerdo", 0.22,
      new Vector3(-0.38, 6.45, 0.78), this.materialOlhos);

    this.olhoDireito = esfera("azhOlhoDireito", 0.22,
      new Vector3(0.38, 6.45, 0.78), this.materialOlhos);

    this.placaPeitoral = caixa("azhPlacaPeitoral",
      { width: 2.2, height: 1.2, depth: 0.25 },
      new Vector3(0, 4.5, 0.95), this.materialCorpo);

    // Marcas de energia que aparecem na segunda fase.
    this.marcasEnergia = [];

    for (let i = 0; i < 3; i++) {
      const marca = caixa(
        `azhMarcaEnergia${i}`,
        { width: 0.18, height: 1.5, depth: 0.12 },
        new Vector3((i - 1) * 0.55, 4.1, 1.02),
        this.materialEnergia
      );

      marca.setEnabled(false);
      this.marcasEnergia.push(marca);
    }
  }

  _iniciarSegundaFase() {
    if (this.fase !== 1 || this.morto) return;

    this.fase = 2;
    this.desppertando = true;
    this.tempoDespertar = this.duracaoDespertar;

    this.velocidade = 3.3;
    this.dano = 20;
    this.tempoAtaque = 0.8;

    this.ataqueAtual = null;
    this.tempoPreparacao = 0;

    this.materialOlhos.emissiveColor = new Color3(1, 0.02, 0.01);
    this.materialOlhos.diffuseColor = new Color3(1, 0.05, 0.01);

    this.materialEnergia.emissiveColor = new Color3(1, 0.025, 0.005);

    this.materialArmadura.diffuseColor = new Color3(0.32, 0.12, 0.09);
    this.materialCorpo.diffuseColor = new Color3(0.20, 0.12, 0.13);

    for (const marca of this.marcasEnergia) {
      marca.setEnabled(true);
    }

    this.root.scaling.set(1.12, 1.12, 1.12);

    console.log("AZH'KHAR DESPERTOU! FASE II.");
  }

  receberDano(quantidade) {
    if (this.morto || this.desppertando) return;

    this.vida = Math.max(0, this.vida - quantidade);

    if (this.vida <= 0) {
      this.morto = true;
      this.root.setEnabled(false);
      return;
    }

    if (this.fase === 1 && this.vida <= this.vidaMaxima * 0.5) {
      this._iniciarSegundaFase();
    }
  }

  _prepararAtaque(tipo, duracao) {
    this.ataqueAtual = tipo;
    this.tempoPreparacao = duracao;
  }

  _executarAtaque(jogador, distancia) {
    if (this.ataqueAtual === "impacto" && distancia <= 8) {
      jogador.receberDano(this.dano);
    }

    if (this.ataqueAtual === "golpe" && distancia <= 4.8) {
      jogador.receberDano(this.dano);
    }

    this.ataqueAtual = null;
    this.tempoAtaque = this.fase === 1 ? 2.2 : 1.6;
  }

  _atualizarDespertar(delta) {
    if (!this.desppertando) return;

    this.tempoDespertar -= delta;

    const progresso = Math.max(
      0,
      1 - this.tempoDespertar / this.duracaoDespertar
    );

    const pulsacao = 1 + Math.sin(this.tempoAnimacao * 12) * 0.035;

    this.root.scaling.set(
      1.12 * pulsacao,
      1.12 * pulsacao,
      1.12 * pulsacao
    );

    this.materialEnergia.emissiveColor = new Color3(
      0.5 + progresso * 0.5,
      0.015,
      0.005
    );

    if (this.tempoDespertar <= 0) {
      this.desppertando = false;
      this.root.scaling.set(1, 1, 1);
      this.tempoAtaque = 0.5;
    }
  }

  atualizar(delta, jogador) {
    if (this.morto || jogador.vida <= 0) return;

    this.tempoAnimacao += delta;

    if (this.desppertando) {
      this._atualizarDespertar(delta);
      return;
    }

    this.tempoAtaque -= delta;

    const direcao = jogador.root.position.subtract(this.root.position);
    direcao.y = 0;

    const distancia = direcao.length();

    if (distancia > 0.001) {
      direcao.normalize();

      this.root.rotation.y = Math.atan2(
        direcao.x,
        direcao.z
      );
    }

    if (this.ataqueAtual !== null) {
      this.tempoPreparacao -= delta;

      const intensidade = this.fase === 2 ? 0.055 : 0.025;
      const pulsacao = 1 + Math.sin(this.tempoAnimacao * 14) * intensidade;

      this.root.scaling.set(pulsacao, pulsacao, pulsacao);

      if (this.tempoPreparacao <= 0) {
        this.root.scaling.set(1, 1, 1);
        this._executarAtaque(jogador, distancia);
      }
    } else {
      this.root.scaling.set(1, 1, 1);

      if (this.tempoAtaque <= 0) {
        if (this.fase === 1 && distancia <= 5.5) {
          this._prepararAtaque("golpe", 0.8);
        } else if (this.fase === 2 && distancia <= 9) {
          this._prepararAtaque("impacto", 0.7);
        }
      }

      if (this.ataqueAtual === null && distancia > 4.5) {
        this.root.position.addInPlace(
          direcao.scale(this.velocidade * delta)
        );
      }
    }

    this.root.position.x = Math.max(-295, Math.min(295, this.root.position.x));
    this.root.position.z = Math.max(-295, Math.min(295, this.root.position.z));

    this.root.position.y = this.alturaEm(
      this.root.position.x,
      this.root.position.z
    );
  }

  dispose() {
    this.root.dispose(false, true);

    this.materialCorpo.dispose();
    this.materialArmadura.dispose();
    this.materialOlhos.dispose();
    this.materialEnergia.dispose();
  }
}

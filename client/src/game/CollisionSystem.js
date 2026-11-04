
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

export class CollisionSystem {
  constructor(obstaculos = []) {
    this.obstaculos = obstaculos;
    this.iteracoes = 5;
  }

  mover(posicao, deslocamento, raio = 0.5) {
    const resultado = posicao.clone();

    resultado.x += deslocamento.x;
    resultado.z += deslocamento.z;

    for (let i = 0; i < this.iteracoes; i++) {
      let houveColisao = false;

      for (const obstaculo of this.obstaculos) {
        const dx = resultado.x - obstaculo.x;
        const dz = resultado.z - obstaculo.z;

        const distancia = Math.hypot(dx, dz);
        const distanciaMinima = raio + obstaculo.raio;

        if (distancia >= distanciaMinima) continue;

        houveColisao = true;

        if (distancia < 0.0001) {
          resultado.x += distanciaMinima;
          continue;
        }

        const normalX = dx / distancia;
        const normalZ = dz / distancia;
        const penetracao = distanciaMinima - distancia;

        resultado.x += normalX * penetracao;
        resultado.z += normalZ * penetracao;
      }

      if (!houveColisao) break;
    }

    return resultado;
  }

  deslocar(alvo, deslocamento, raio = 0.5) {
    const novaPosicao = this.mover(
      alvo.position,
      deslocamento,
      raio
    );

    alvo.position.x = novaPosicao.x;
    alvo.position.z = novaPosicao.z;
  }
}

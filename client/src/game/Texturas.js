import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { criarRng } from "./Ruido.js";

/**
 * Textura de ruido em tons de cinza, gerada por codigo (sem arquivos externos,
 * portanto sem questoes de licenca). Adiciona granulacao fina aos materiais.
 */
export function criarTexturaRuido(scene, { tamanho = 256, semente = 1, base = 0.75, variacao = 0.25 } = {}) {
  const rng = criarRng(semente);
  const dados = new Uint8Array(tamanho * tamanho * 4);
  for (let i = 0; i < tamanho * tamanho; i++) {
    const v = Math.round(255 * Math.min(1, base + (rng() - 0.5) * variacao * 2));
    dados[i * 4] = v;
    dados[i * 4 + 1] = v;
    dados[i * 4 + 2] = v;
    dados[i * 4 + 3] = 255;
  }
  const textura = RawTexture.CreateRGBATexture(
    dados, tamanho, tamanho, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE
  );
  textura.wrapU = Texture.WRAP_ADDRESSMODE;
  textura.wrapV = Texture.WRAP_ADDRESSMODE;
  textura.anisotropicFilteringLevel = 8;
  return textura;
}

// Funcoes deterministicas de ruido: mesmo resultado em toda execucao
// (cenario reprodutivel, importante para multiplayer e testes).

/** Gerador pseudoaleatorio com semente (mulberry32). */
export function criarRng(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function suavizar(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function misturar(a, b, t) {
  return a + (b - a) * t;
}

/** Ruido de valor 2D, retorna 0..1. */
export function ruidoValor(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = suavizar(0, 1, x - ix);
  const fz = suavizar(0, 1, z - iz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return misturar(misturar(a, b, fx), misturar(c, d, fx), fz);
}

/** Ruido fractal (varias oitavas), retorna aproximadamente 0..1. */
export function fbm(x, z, oitavas = 5) {
  let soma = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < oitavas; i++) {
    soma += amp * ruidoValor(x * freq + i * 17.3, z * freq - i * 9.1);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return soma / norm;
}

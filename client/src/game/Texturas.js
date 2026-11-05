import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { criarRng } from "./Ruido.js";

// --------------------------------------------------------------
// Texturas procedurais.
// Tudo é gerado por código (sem arquivos externos, portanto sem
// questões de licença). As texturas são "tileáveis" (sem emenda),
// porque o ruído usado é periódico.
// --------------------------------------------------------------

/**
 * Textura de ruído em tons de cinza (mantida por compatibilidade).
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
  return texturaDeDados(scene, "texturaRuido", tamanho, dados, { srgb: true });
}

// --------------------------------------------------------------
// Ruído periódico
// --------------------------------------------------------------

function hash3(ix, iy, semente) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(semente, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const mod = (a, n) => ((a % n) + n) % n;
const suave = (t) => t * t * (3 - 2 * t);
const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const passo = (a, b, x) => suave(limitar((x - a) / (b - a)));
const mistura = (a, b, t) => a + (b - a) * t;

/** Ruído de valor periódico (repete a cada `periodo`), retorna 0..1. */
export function ruidoPeriodico(x, y, periodo, semente = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = suave(x - ix);
  const fy = suave(y - iy);
  const x0 = mod(ix, periodo);
  const y0 = mod(iy, periodo);
  const x1 = mod(ix + 1, periodo);
  const y1 = mod(iy + 1, periodo);
  const a = hash3(x0, y0, semente);
  const b = hash3(x1, y0, semente);
  const c = hash3(x0, y1, semente);
  const d = hash3(x1, y1, semente);
  return mistura(mistura(a, b, fx), mistura(c, d, fx), fy);
}

/** Ruído fractal periódico. (u, v) em 0..1. */
export function fbmPeriodico(u, v, periodo, oitavas = 4, semente = 0) {
  let soma = 0;
  let amp = 0.5;
  let norm = 0;
  let p = periodo;
  for (let i = 0; i < oitavas; i++) {
    soma += amp * ruidoPeriodico(u * p, v * p, p, semente + i * 31);
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return soma / norm;
}

/** Voronoi periódico: distâncias ao 1º e 2º ponto e id da célula. */
export function voronoiPeriodico(u, v, periodo, semente = 0) {
  const x = u * periodo;
  const y = v * periodo;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = mod(ix + i, periodo);
      const cy = mod(iy + j, periodo);
      const px = ix + i + hash3(cx, cy, semente);
      const py = iy + j + hash3(cx, cy, semente + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash3(cx, cy, semente + 13);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2, id };
}

// --------------------------------------------------------------
// Utilitários de textura
// --------------------------------------------------------------

function texturaDeDados(scene, nome, tamanho, dados, { srgb = true, mipmaps = true, repetir = true } = {}) {
  const textura = RawTexture.CreateRGBATexture(
    dados,
    tamanho,
    tamanho,
    scene,
    mipmaps,
    false,
    Texture.TRILINEAR_SAMPLINGMODE
  );
  textura.name = nome;
  textura.gammaSpace = srgb;
  textura.wrapU = repetir ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
  textura.wrapV = repetir ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
  textura.anisotropicFilteringLevel = 8;
  return textura;
}

/** Gera uma textura chamando fn(u, v, saida[4]) para cada texel. */
function gerar(scene, nome, tamanho, fn, opcoes) {
  const dados = new Uint8Array(tamanho * tamanho * 4);
  const cor = [0, 0, 0, 1];
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      cor[3] = 1;
      fn((x + 0.5) / tamanho, (y + 0.5) / tamanho, cor, x, y);
      const i = (y * tamanho + x) * 4;
      dados[i] = limitar(cor[0]) * 255;
      dados[i + 1] = limitar(cor[1]) * 255;
      dados[i + 2] = limitar(cor[2]) * 255;
      dados[i + 3] = limitar(cor[3]) * 255;
    }
  }
  return texturaDeDados(scene, nome, tamanho, dados, opcoes);
}

/** Campo de alturas (Float32Array) a partir de fn(u, v). */
function campo(tamanho, fn) {
  const h = new Float32Array(tamanho * tamanho);
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      h[y * tamanho + x] = fn((x + 0.5) / tamanho, (y + 0.5) / tamanho, x, y);
    }
  }
  return h;
}

/** Mapa de normais (espaço tangente) a partir de um campo de alturas. */
function normalDeAltura(scene, nome, h, tamanho, forca) {
  const dados = new Uint8Array(tamanho * tamanho * 4);
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const e = h[y * tamanho + mod(x - 1, tamanho)];
      const d = h[y * tamanho + mod(x + 1, tamanho)];
      const b = h[mod(y - 1, tamanho) * tamanho + x];
      const c = h[mod(y + 1, tamanho) * tamanho + x];
      let nx = -(d - e) * forca;
      let ny = -(c - b) * forca;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * tamanho + x) * 4;
      dados[i] = (nx * 0.5 + 0.5) * 255;
      dados[i + 1] = (ny * 0.5 + 0.5) * 255;
      dados[i + 2] = (nz * 0.5 + 0.5) * 255;
      dados[i + 3] = 255;
    }
  }
  return texturaDeDados(scene, nome, tamanho, dados, { srgb: false });
}

// --------------------------------------------------------------
// Geradores
// --------------------------------------------------------------

/**
 * Glifos de traços numa grade 8 x 8. `usarColuna(cx)` escolhe quais
 * colunas da grade recebem runas (as outras ficam vazias).
 */
function gerarRunas(scene, nome, usarColuna) {
  const n = 512;
  const celulas = 8;
  const tamanhoCelula = n / celulas;
  const rng = criarRng(4242);
  const glifos = [];
  for (let i = 0; i < celulas * celulas; i++) {
    const tracos = [];
    if (rng() > 0.18) {
      const total = 2 + Math.floor(rng() * 4);
      for (let t = 0; t < total; t++) {
        const a = [Math.floor(rng() * 3), Math.floor(rng() * 3)];
        let b = [Math.floor(rng() * 3), Math.floor(rng() * 3)];
        if (a[0] === b[0] && a[1] === b[1]) b = [2 - a[0], 2 - a[1]];
        tracos.push([a, b]);
      }
    }
    glifos.push(tracos);
  }
  const distSegmento = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = limitar(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  };
  return gerar(scene, nome, n, (u, v, c, x, y) => {
    const cx = Math.floor(x / tamanhoCelula);
    const cy = Math.floor(y / tamanhoCelula);
    let k = 0;
    if (usarColuna(cx)) {
      const lx = (x % tamanhoCelula) / tamanhoCelula;
      const ly = (y % tamanhoCelula) / tamanhoCelula;
      const g = glifos[cy * celulas + cx];
      let d = 9;
      for (const [a, b] of g) {
        const p = (q) => 0.22 + q * 0.28;
        d = Math.min(d, distSegmento(lx, ly, p(a[0]), p(a[1]), p(b[0]), p(b[1])));
      }
      k = passo(0.05, 0.025, d);
    }
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
}

const geradores = {
  // Detalhe do chão: variação de tom + pedrinhas no relevo.
  terreno(scene) {
    const n = 512;
    const h = campo(n, (u, v) => {
      // Seixos raros e irregulares (sem formar um padrão de bolinhas).
      const pedras = voronoiPeriodico(u, v, 24, 3);
      const raros = pedras.id > 0.72 ? 1 : 0;
      const seixo = passo(0.32, 0.08, pedras.f1) * raros;
      return fbmPeriodico(u, v, 6, 5, 11) * 0.8 + seixo * 0.22;
    });
    const albedo = gerar(scene, "terrenoAlbedo", n, (u, v, c, x, y) => {
      const t = 0.76 + 0.28 * fbmPeriodico(u, v, 4, 4, 5);
      const r = h[y * n + x];
      const k = t * (0.9 + 0.16 * r);
      c[0] = k;
      c[1] = k * (0.98 + 0.06 * fbmPeriodico(u, v, 3, 2, 9));
      c[2] = k * 0.95;
    });
    return { albedo, normal: normalDeAltura(scene, "terrenoNormal", h, n, 5) };
  },

  // Mapa de detalhe (formato do Babylon: R=albedo, G=normal Y, B=rugosidade, A=normal X).
  detalheTerreno(scene) {
    const n = 256;
    const h = campo(n, (u, v) => fbmPeriodico(u, v, 8, 4, 77));
    return gerar(scene, "detalheTerreno", n, (u, v, c, x, y) => {
      const e = h[y * n + mod(x - 1, n)];
      const d = h[y * n + mod(x + 1, n)];
      const b = h[mod(y - 1, n) * n + x];
      const t = h[mod(y + 1, n) * n + x];
      c[0] = 0.5 + (h[y * n + x] - 0.5) * 0.6;
      c[1] = 0.5 - (t - b) * 3;
      c[2] = 0.5 + (h[y * n + x] - 0.5) * 0.4;
      c[3] = 0.5 - (d - e) * 3;
    }, { srgb: false });
  },

  // Pedra calcária desgastada (ruínas).
  pedra(scene) {
    const n = 512;
    // Rachaduras finas, sinuosas e só em algumas regiões da pedra.
    const rachas = campo(n, (u, v) => {
      const wu = 0.06 * (fbmPeriodico(u, v, 4, 3, 2) - 0.5);
      const wv = 0.06 * (fbmPeriodico(u, v, 4, 3, 3) - 0.5);
      const vo = voronoiPeriodico(u + wu, v + wv, 4, 21);
      const linha = passo(0.03, 0.0, vo.f2 - vo.f1);
      const regiao = passo(0.48, 0.62, fbmPeriodico(u, v, 3, 3, 25));
      return linha * regiao;
    });
    const h = campo(n, (u, v, x, y) => {
      return fbmPeriodico(u, v, 4, 6, 31) * 0.8 - rachas[y * n + x] * 0.22 + ruidoPeriodico(u * 128, v * 128, 128, 4) * 0.08;
    });
    const albedo = gerar(scene, "pedraAlbedo", n, (u, v, c, x, y) => {
      const m = fbmPeriodico(u, v, 3, 5, 41);
      const manchas = passo(0.55, 0.75, fbmPeriodico(u, v, 2, 4, 51));
      const pontos = ruidoPeriodico(u * 160, v * 160, 160, 61) > 0.93 ? 0.8 : 1;
      const camadas = 0.96 + 0.04 * Math.sin((v + 0.05 * fbmPeriodico(u, v, 2, 2, 57)) * Math.PI * 2 * 9);
      let k = (0.78 + 0.3 * m) * pontos * camadas * (1 - rachas[y * n + x] * 0.35);
      k *= 1 - manchas * 0.25;
      c[0] = k * 1.0;
      c[1] = k * 0.94;
      c[2] = k * 0.84;
    });
    const orm = gerar(scene, "pedraORM", n, (u, v, c, x, y) => {
      c[0] = 1 - rachas[y * n + x] * 0.6;
      c[1] = 0.72 + 0.22 * fbmPeriodico(u, v, 4, 3, 71);
      c[2] = 0;
    }, { srgb: false });
    return { albedo, normal: normalDeAltura(scene, "pedraNormal", h, n, 6), orm };
  },

  // Lajotas de pedra (piso das plataformas): 4 x 4 blocos em junta amarrada.
  lajotas(scene) {
    const n = 512;
    const linhas = 4;
    const bloco = (u, v) => {
      const fila = Math.floor(v * linhas);
      const deslocamento = fila % 2 ? 0.5 / linhas : 0;
      const uu = mod(u + deslocamento, 1);
      const col = Math.floor(uu * linhas);
      const lu = uu * linhas - col;
      const lv = v * linhas - fila;
      const id = hash3(mod(col, linhas), fila, 5);
      const borda = Math.min(lu, 1 - lu, lv, 1 - lv);
      return { id, borda, col, fila };
    };
    const h = campo(n, (u, v) => {
      const b = bloco(u, v);
      const lascas = fbmPeriodico(u, v, 16, 3, 9) * 0.05;
      const chanfro = passo(0.0, 0.05 + lascas, b.borda);
      const superficie = fbmPeriodico(u, v, 8, 4, 19 + Math.floor(b.id * 10)) * 0.25;
      return chanfro * (0.75 + superficie + (b.id - 0.5) * 0.08);
    });
    const albedo = gerar(scene, "lajotasAlbedo", n, (u, v, c, x, y) => {
      const b = bloco(u, v);
      const altura = h[y * n + x];
      const tom = 0.78 + 0.32 * b.id;
      const m = fbmPeriodico(u, v, 6, 5, 23);
      const sujeira = passo(0.5, 0.9, 1 - altura) * 0.55;
      let k = tom * (0.82 + 0.3 * m) * (1 - sujeira);
      const quente = 0.95 + 0.08 * hash3(b.col, b.fila, 17);
      c[0] = k * quente;
      c[1] = k * 0.93;
      c[2] = k * 0.82;
    });
    const orm = gerar(scene, "lajotasORM", n, (u, v, c, x, y) => {
      const altura = h[y * n + x];
      c[0] = 0.45 + 0.55 * passo(0.2, 0.7, altura);
      c[1] = 0.68 + 0.25 * fbmPeriodico(u, v, 8, 3, 29) + (1 - altura) * 0.1;
      c[2] = 0;
    }, { srgb: false });
    return { albedo, normal: normalDeAltura(scene, "lajotasNormal", h, n, 7), orm };
  },

  // Rocha estratificada (rochas do mapa e corpo do colosso).
  rocha(scene) {
    const n = 512;
    const h = campo(n, (u, v) => {
      const dist = fbmPeriodico(u, v, 3, 4, 101);
      const estratos = 0.5 + 0.5 * Math.sin((v + dist * 0.35) * Math.PI * 2 * 6);
      const vo = voronoiPeriodico(u, v, 6, 103);
      const facetas = passo(0.0, 0.5, vo.f1) * 0.25;
      return fbmPeriodico(u, v, 5, 6, 107) * 0.7 + estratos * 0.15 + facetas;
    });
    const albedo = gerar(scene, "rochaAlbedo", n, (u, v, c, x, y) => {
      const a = h[y * n + x];
      const m = fbmPeriodico(u, v, 4, 4, 109);
      const liquen = passo(0.62, 0.72, fbmPeriodico(u, v, 6, 4, 113));
      let k = 0.7 + 0.45 * a * m;
      c[0] = mistura(k * 0.98, 0.62, liquen * 0.35);
      c[1] = mistura(k * 0.95, 0.66, liquen * 0.35);
      c[2] = mistura(k * 0.9, 0.45, liquen * 0.35);
    });
    return { albedo, normal: normalDeAltura(scene, "rochaNormal", h, n, 8) };
  },

  // Casca de árvore: fissuras verticais.
  casca(scene) {
    const n = 256;
    const h = campo(n, (u, v) => {
      const fissura = Math.abs(fbmPeriodico(u, v * 0.25, 8, 4, 131) - 0.5) * 2;
      return Math.pow(fissura, 0.6);
    });
    const albedo = gerar(scene, "cascaAlbedo", n, (u, v, c, x, y) => {
      const a = h[y * n + x];
      const k = 0.45 + 0.6 * a;
      c[0] = k * 0.95;
      c[1] = k * 0.82;
      c[2] = k * 0.7;
    });
    return { albedo, normal: normalDeAltura(scene, "cascaNormal", h, n, 6) };
  },

  // Máscara de rachaduras incandescentes (colosso).
  rachaduras(scene) {
    const n = 512;
    // Veias finas e esparsas: a maior parte da pedra fica escura.
    return gerar(scene, "rachadurasEmissiva", n, (u, v, c) => {
      const wu = (fbmPeriodico(u, v, 4, 3, 151) - 0.5) * 0.12;
      const wv = (fbmPeriodico(u, v, 4, 3, 153) - 0.5) * 0.12;
      const vo = voronoiPeriodico(u + wu, v + wv, 4, 157);
      const vo2 = voronoiPeriodico(u - wv, v + wu, 9, 163);
      const regiao = passo(0.42, 0.6, fbmPeriodico(u, v, 2, 3, 171));
      const regiaoFina = passo(0.5, 0.68, fbmPeriodico(u, v, 3, 3, 173));
      const linha = passo(0.035, 0.0, vo.f2 - vo.f1) * regiao;
      const linhaFina = passo(0.025, 0.0, vo2.f2 - vo2.f1) * regiaoFina * 0.45;
      const pulso = 0.6 + 0.4 * fbmPeriodico(u, v, 3, 3, 167);
      const k = Math.max(linha, linhaFina) * pulso;
      c[0] = k;
      c[1] = k;
      c[2] = k;
    });
  },

  // Runas só numa coluna central (monólitos: inscrição vertical).
  runasColuna(scene) {
    return gerarRunas(scene, "runasColunaEmissiva", (cx) => cx === 3 || cx === 4);
  },

  // Runas: glifos de traços em uma grade 8 x 8.
  runas(scene) {
    return gerarRunas(scene, "runasEmissiva", () => true);
  },

  // Normal da água (ondas sobrepostas).
  agua(scene) {
    const n = 256;
    const h = campo(n, (u, v) => {
      let s = 0;
      s += Math.sin((u * 3 + v * 2) * Math.PI * 2) * 0.25;
      s += Math.sin((u * -2 + v * 5) * Math.PI * 2) * 0.15;
      s += fbmPeriodico(u, v, 6, 4, 181) * 0.6;
      return s;
    });
    return normalDeAltura(scene, "aguaNormal", h, n, 2.5);
  },

  // Trama de tecido.
  tecido(scene) {
    const n = 256;
    const fios = 48;
    const h = campo(n, (u, v) => {
      const a = Math.sin(u * fios * Math.PI * 2);
      const b = Math.sin(v * fios * Math.PI * 2);
      const cruzamento = Math.floor(u * fios) + Math.floor(v * fios);
      const trama = cruzamento % 2 ? a * 0.5 + 0.5 : b * 0.5 + 0.5;
      return trama * 0.6 + fbmPeriodico(u, v, 8, 3, 191) * 0.4;
    });
    return normalDeAltura(scene, "tecidoNormal", h, n, 3);
  },

  // Metal: arranhões finos e variação de rugosidade.
  metal(scene) {
    const n = 256;
    const h = campo(n, (u, v) => {
      const riscos = ruidoPeriodico(u * 4, v * 128, 128, 201) * 0.4 + ruidoPeriodico(u * 8, v * 256, 256, 203) * 0.2;
      return riscos + fbmPeriodico(u, v, 4, 4, 207) * 0.4;
    });
    return normalDeAltura(scene, "metalNormal", h, n, 1.6);
  },

  // Partícula suave (círculo com borda difusa).
  particula(scene) {
    const n = 64;
    return gerar(scene, "particula", n, (u, v, c) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const a = Math.pow(limitar(1 - d), 2.2);
      c[0] = 1;
      c[1] = 1;
      c[2] = 1;
      c[3] = a;
    }, { repetir: false });
  },

  // Fumaça/poeira (partícula irregular).
  fumaca(scene) {
    const n = 128;
    return gerar(scene, "fumaca", n, (u, v, c) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const r = fbmPeriodico(u, v, 4, 4, 211);
      const a = limitar(1 - d) * passo(0.25, 0.75, r + (1 - d) * 0.5);
      c[0] = 1;
      c[1] = 1;
      c[2] = 1;
      c[3] = a;
    }, { repetir: false });
  },

  // Anel (onda de choque).
  anel(scene) {
    const n = 256;
    return gerar(scene, "anel", n, (u, v, c) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const anel = Math.exp(-Math.pow((d - 0.86) / 0.06, 2));
      const interno = passo(0.9, 0.2, d) * 0.18;
      c[0] = 1;
      c[1] = 1;
      c[2] = 1;
      c[3] = limitar(anel + interno) * (d < 1 ? 1 : 0);
    }, { repetir: false });
  },

  // Degradê vertical para o feixe de luz do orbe.
  feixe(scene) {
    const n = 128;
    // As bordas laterais vêm do fresnel do material; aqui só o degradê.
    return gerar(scene, "feixe", n, (u, v, c) => {
      const k = Math.pow(1 - v, 1.8) * passo(0, 0.03, v);
      c[0] = k;
      c[1] = k;
      c[2] = k;
      c[3] = k;
    }, { repetir: false });
  },

  // Brilho do sol (disco + halo).
  sol(scene) {
    const n = 128;
    return gerar(scene, "sol", n, (u, v, c) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const disco = passo(0.32, 0.26, d);
      const halo = Math.pow(limitar(1 - d), 3) * 0.6;
      c[0] = 1;
      c[1] = 1;
      c[2] = 1;
      c[3] = limitar(disco + halo);
    }, { repetir: false });
  }
};

// --------------------------------------------------------------
// Biblioteca com cache por cena
// --------------------------------------------------------------

const bibliotecas = new WeakMap();

/**
 * Devolve a textura `nome`, gerando-a na primeira vez em que
 * for pedida nesta cena.
 */
export function textura(scene, nome) {
  let biblioteca = bibliotecas.get(scene);
  if (!biblioteca) {
    biblioteca = new Map();
    bibliotecas.set(scene, biblioteca);
  }
  if (!biblioteca.has(nome)) {
    const gerador = geradores[nome];
    if (!gerador) throw new Error(`Textura desconhecida: ${nome}`);
    biblioteca.set(nome, gerador(scene));
  }
  return biblioteca.get(nome);
}

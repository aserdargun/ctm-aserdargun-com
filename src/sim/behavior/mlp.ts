/**
 * Cell to Mind — ana davranış denetleyicisi: 12 → 8 → 4 MLP.
 *
 *   Girdi     12 birim
 *   Gizli      8 birim, tanh
 *   Çıktı      4 birim, sayısal kararlı softmax (4 eylem)
 *
 * Parametre sayısı: 12*8 + 8 + 8*4 + 4 = **140**
 *   W1 96 · b1 8 · W2 32 · b2 4
 * Toplam birim: 12 + 8 + 4 = **24**
 * Ağırlıklı bağlantı: 96 + 32 = **128**
 * Bias: 8 + 4 = **12**
 *
 * Saf TypeScript'tir; ağır ML bağımlılığı yoktur. Gradyanlar analitiktir ve
 * `tests/mlp.test.ts` içinde merkezi sonlu farkla doğrulanır.
 *
 * BU, organizmanın soyut hesaplama modelidir. Fiziksel `Cell` ile matematiksel
 * sinir birimi aynı şey değildir; tek hücrelilerin biyolojik nöronu olduğu
 * iddia edilmez.
 */

export const MLP_SHAPE = {
  INPUTS: 12,
  HIDDEN: 8,
  OUTPUTS: 4,
  /** W1 (96) + b1 (8) + W2 (32) + b2 (4). */
  PARAM_COUNT: 140,
  WEIGHTED_CONNECTIONS: 128,
  BIASES: 12,
  TOTAL_UNITS: 24,
} as const;

/** Dört eylem. */
export const ACTIONS = {
  TOWARD_A: 0,
  TOWARD_B: 1,
  EXPLORE: 2,
  REST: 3,
} as const;
export type ActionName = 'towardA' | 'towardB' | 'explore' | 'rest';
export const ACTION_NAMES: readonly ActionName[] = ['towardA', 'towardB', 'explore', 'rest'];

/** Parametre vektöründeki dilim sınırları. */
const W1_OFF = 0; // 96
const B1_OFF = 96; // 8
const W2_OFF = 104; // 32
const B2_OFF = 136; // 4
export const PARAM_SLICES = { W1_OFF, B1_OFF, W2_OFF, B2_OFF } as const;

export interface ForwardResult {
  hidden: Float64Array;
  logits: Float64Array;
  probs: Float64Array;
}

/** Girdi vektörü boyutu doğrulaması. */
export function assertInputShape(x: ArrayLike<number>): void {
  if (x.length !== MLP_SHAPE.INPUTS) {
    throw new Error(`MLP girdi boyutu ${x.length}; beklenen ${MLP_SHAPE.INPUTS}`);
  }
}

export function assertParamShape(theta: ArrayLike<number>): void {
  if (theta.length !== MLP_SHAPE.PARAM_COUNT) {
    throw new Error(`MLP parametre boyutu ${theta.length}; beklenen ${MLP_SHAPE.PARAM_COUNT}`);
  }
}

export function createTheta(fill = 0): Float64Array {
  const t = new Float64Array(MLP_SHAPE.PARAM_COUNT);
  if (fill !== 0) t.fill(fill);
  return t;
}

/** Tüm sayıların sonlu olduğunu kontrol eder (NaN/Infinity savunması). */
export function isFiniteVec(v: ArrayLike<number>): boolean {
  for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) return false;
  return true;
}

/**
 * Küçük ölçekli rastgele başlangıç ağırlıkları.
 * Ölçek, girdi birimlerinin [-1, 1] aralığında olduğu varsayımına göre seçilir.
 */
export function initTheta(rand: () => number): Float64Array {
  const theta = createTheta();
  const s1 = Math.sqrt(1 / MLP_SHAPE.INPUTS);
  const s2 = Math.sqrt(1 / MLP_SHAPE.HIDDEN);
  for (let k = 0; k < MLP_SHAPE.HIDDEN; k++) {
    for (let i = 0; i < MLP_SHAPE.INPUTS; i++) theta[W1_OFF + k * MLP_SHAPE.INPUTS + i] = (rand() * 2 - 1) * s1;
  }
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) {
    for (let k = 0; k < MLP_SHAPE.HIDDEN; k++) theta[W2_OFF + j * MLP_SHAPE.HIDDEN + k] = (rand() * 2 - 1) * s2;
  }
  // Bias'lar sıfırdan başlar (rastgele başlangıçta öngörülemez çıktı üretmemek için).
  return theta;
}

/** İleri geçiş. `out` verilirse yeniden kullanılır (GC baskısını azaltır). */
export function forward(theta: Float64Array, x: ArrayLike<number>, out?: ForwardResult): ForwardResult {
  assertInputShape(x);
  assertParamShape(theta);
  const hidden = out?.hidden ?? new Float64Array(MLP_SHAPE.HIDDEN);
  const logits = out?.logits ?? new Float64Array(MLP_SHAPE.OUTPUTS);
  const probs = out?.probs ?? new Float64Array(MLP_SHAPE.OUTPUTS);

  for (let k = 0; k < MLP_SHAPE.HIDDEN; k++) {
    let sum = theta[B1_OFF + k] as number;
    const base = W1_OFF + k * MLP_SHAPE.INPUTS;
    for (let i = 0; i < MLP_SHAPE.INPUTS; i++) sum += (theta[base + i] as number) * (x[i] as number);
    hidden[k] = Math.tanh(sum);
  }

  let maxLogit = -Infinity;
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) {
    let sum = theta[B2_OFF + j] as number;
    const base = W2_OFF + j * MLP_SHAPE.HIDDEN;
    for (let k = 0; k < MLP_SHAPE.HIDDEN; k++) sum += (theta[base + k] as number) * (hidden[k] as number);
    logits[j] = sum;
    if (sum > maxLogit) maxLogit = sum;
  }

  let total = 0;
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) {
    const e = Math.exp((logits[j] as number) - maxLogit);
    probs[j] = e;
    total += e;
  }
  const inv = 1 / total;
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) probs[j] = (probs[j] as number) * inv;

  return out ?? { hidden, logits, probs };
}

/** Gizli birim maskesi (0 = susturulmuş, 1 = açık). Ablasyon deneyleri için. */
export type HiddenMask = Uint8Array;

/**
 * Maskeli ileri geçiş — **karşı-olgusal** (counterfactual) hesap.
 *
 * Bu, simülasyonda olmuş bir kararı DEĞİL, aynı ağın aynı gözlemle
 * susturulmuş gizli birimlerle ne yapacağını hesaplar. Mikroskopta açıkça
 * "karşı-olgusal" etiketiyle gösterilir; gerçek bir simülasyon kararı gibi
 * sunulmaz.
 */
export function forwardMasked(
  theta: Float64Array,
  x: ArrayLike<number>,
  mask?: HiddenMask,
  out?: ForwardResult,
): ForwardResult {
  const full = forward(theta, x);
  if (!mask) return out ?? full;
  const hidden = new Float64Array(MLP_SHAPE.HIDDEN);
  for (let k = 0; k < MLP_SHAPE.HIDDEN; k++) hidden[k] = mask[k] === 0 ? 0 : (full.hidden[k] as number);

  const logits = new Float64Array(MLP_SHAPE.OUTPUTS);
  let maxLogit = -Infinity;
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) {
    let sum = theta[B2_OFF + j] as number;
    const base = W2_OFF + j * MLP_SHAPE.HIDDEN;
    for (let k = 0; k < MLP_SHAPE.HIDDEN; k++) sum += (theta[base + k] as number) * (hidden[k] as number);
    logits[j] = sum;
    if (sum > maxLogit) maxLogit = sum;
  }
  const probs = new Float64Array(MLP_SHAPE.OUTPUTS);
  let total = 0;
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) {
    const e = Math.exp((logits[j] as number) - maxLogit);
    probs[j] = e;
    total += e;
  }
  const inv = 1 / total;
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) probs[j] = (probs[j] as number) * inv;

  return out ?? { hidden, logits, probs };
}

/** Olasılıklardan örnekle (on-policy eylem seçimi). */
export function sampleAction(probs: Float64Array, u: number): number {
  let acc = 0;
  for (let j = 0; j < probs.length; j++) {
    acc += probs[j] as number;
    if (u < acc) return j;
  }
  return probs.length - 1;
}

/** En yüksek olasılıklı eylem (mikroskop karşılaştırması için referans). */
export function greedyAction(probs: Float64Array): number {
  let best = 0;
  for (let j = 1; j < probs.length; j++) if ((probs[j] as number) > (probs[best] as number)) best = j;
  return best;
}

/** `log pi(a|x)` ve bunun parametrelere göre analitik gradyanı. */
export function logProbAndGrad(
  theta: Float64Array,
  x: ArrayLike<number>,
  action: number,
  grad?: Float64Array,
): { logProb: number; grad: Float64Array } {
  const { hidden, logits, probs } = forward(theta, x);
  const g = grad ?? new Float64Array(MLP_SHAPE.PARAM_COUNT);

  // logsumexp, en büyük logit çıkarılarak kararlı biçimde hesaplanır.
  let maxLogit = -Infinity;
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) if ((logits[j] as number) > maxLogit) maxLogit = logits[j] as number;
  let logSumExp = 0;
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) logSumExp += Math.exp((logits[j] as number) - maxLogit);
  logSumExp = maxLogit + Math.log(logSumExp);

  const logProb = (logits[action] as number) - logSumExp;

  // delta_j = 1{j=action} - p_j
  const delta = new Float64Array(MLP_SHAPE.OUTPUTS);
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) {
    delta[j] = (j === action ? 1 : 0) - (probs[j] as number);
  }

  g.fill(0);

  // Çıktı katmanı: d log pi / dW2[j][k] = delta_j * h_k
  for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) {
    const dj = delta[j] as number;
    const base = W2_OFF + j * MLP_SHAPE.HIDDEN;
    for (let k = 0; k < MLP_SHAPE.HIDDEN; k++) {
      g[base + k] = dj * (hidden[k] as number);
    }
    g[B2_OFF + j] = dj;
  }

  // Gizli katman: dh_k = (1 - h_k^2) * sum_j (delta_j * W2[j][k])
  for (let k = 0; k < MLP_SHAPE.HIDDEN; k++) {
    let acc = 0;
    for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) {
      acc += (delta[j] as number) * (theta[W2_OFF + j * MLP_SHAPE.HIDDEN + k] as number);
    }
    const h = hidden[k] as number;
    const dh = (1 - h * h) * acc;
    const base = W1_OFF + k * MLP_SHAPE.INPUTS;
    for (let i = 0; i < MLP_SHAPE.INPUTS; i++) {
      g[base + i] = dh * (x[i] as number);
    }
    g[B1_OFF + k] = dh;
  }

  return { logProb, grad: g };
}

/**
 * Analitik gradyanı merkezi sonlu farkla doğrulamak için yardımcı.
 * Üretim kodunda kullanılmaz; yalnızca `tests/mlp.test.ts` çağırır.
 */
export function centralDifferenceGrad(
  theta: Float64Array,
  x: ArrayLike<number>,
  action: number,
  eps = 1e-5,
): Float64Array {
  const numeric = new Float64Array(MLP_SHAPE.PARAM_COUNT);
  const plus = new Float64Array(theta);
  const minus = new Float64Array(theta);
  const scratchA = new Float64Array(MLP_SHAPE.PARAM_COUNT);
  const scratchB = new Float64Array(MLP_SHAPE.PARAM_COUNT);
  for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
    const v = theta[p] as number;
    (plus as Float64Array)[p] = v + eps;
    (minus as Float64Array)[p] = v - eps;
    const lp = logProbAndGrad(plus, x, action, scratchA).logProb;
    const lm = logProbAndGrad(minus, x, action, scratchB).logProb;
    numeric[p] = (lp - lm) / (2 * eps);
    (plus as Float64Array)[p] = v;
    (minus as Float64Array)[p] = v;
  }
  return numeric;
}

/**
 * Gradyan normunu sınırla (NaN/Infinity savunması).
 * Dönüş değeri **kırpma öncesi** normdur: patlamayı tanımlamak için
 * tanılayıcı olarak kullanılır. NaN bulunursa gradyan sıfırlanır ve 0 döner.
 */
export function clipGradNorm(grad: Float64Array, maxNorm: number): number {
  let norm = 0;
  for (let i = 0; i < grad.length; i++) {
    const v = grad[i] as number;
    if (!Number.isFinite(v)) {
      grad.fill(0);
      return 0;
    }
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  if (norm > maxNorm && norm > 0) {
    const scale = maxNorm / norm;
    for (let i = 0; i < grad.length; i++) grad[i] = (grad[i] as number) * scale;
  }
  return norm;
}

/** İki parametre vektörü arasındaki maksimum mutlak fark (testler için). */
export function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs((a[i] as number) - (b[i] as number));
    if (d > max) max = d;
  }
  return max;
}

/** Ağırlıkları sıfırlamadan önce/sonra karşılaştırmak için kopya. */
export function copyTheta(src: ArrayLike<number>): Float64Array {
  const out = new Float64Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] as number;
  return out;
}
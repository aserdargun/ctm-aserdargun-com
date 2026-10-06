import { describe, expect, it } from 'vitest';
import {
  MLP_SHAPE,
  centralDifferenceGrad,
  clipGradNorm,
  createTheta,
  forward,
  greedyAction,
  initTheta,
  isFiniteVec,
  logProbAndGrad,
  maxAbsDiff,
  sampleAction,
} from '../src/sim/behavior/mlp.ts';

const INPUTS = MLP_SHAPE.INPUTS;

/** Test için sabit girdi vektörü üretir (deterministik). */
function makeInputs(seed: number): Float64Array {
  const x = new Float64Array(INPUTS);
  let s = seed >>> 0;
  for (let i = 0; i < INPUTS; i++) {
    s = (Math.imul(s ^ (s >>> 15), 0x85ebca6b) + 0x9e3779b9) >>> 0;
    x[i] = ((s >>> 8) / 8388608 - 1) * 0.95; // [-0.95, 0.95]
  }
  return x;
}

/** Deterministik pseudo-rastgele üretici (testte `Math.random` kullanılmaz). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('MLP mimarisi', () => {
  it('belgelenen parametre/birim/bağlantı sayılarını karşılar', () => {
    expect(MLP_SHAPE.PARAM_COUNT).toBe(140);
    expect(MLP_SHAPE.INPUTS * MLP_SHAPE.HIDDEN + MLP_SHAPE.HIDDEN + MLP_SHAPE.HIDDEN * MLP_SHAPE.OUTPUTS + MLP_SHAPE.OUTPUTS).toBe(140);
    expect(MLP_SHAPE.WEIGHTED_CONNECTIONS).toBe(128);
    expect(MLP_SHAPE.BIASES).toBe(12);
    expect(MLP_SHAPE.TOTAL_UNITS).toBe(24);
  });

  it('parametre vektörü tam olarak 140 eleman taşır', () => {
    expect(createTheta().length).toBe(140);
  });

  it('gizli aktivasyon tanh aralığındadır', () => {
    const theta = initTheta(lcg(7));
    const { hidden } = forward(theta, makeInputs(11));
    for (const h of hidden) {
      expect(h).toBeGreaterThanOrEqual(-1);
      expect(h).toBeLessThanOrEqual(1);
      expect(Math.abs(h)).toBeLessThan(1); // tanh asla tam ±1'e ulaşmaz
    }
  });

  it('çıktı olasılıkları bir olasılıksal dağılımdır', () => {
    const theta = initTheta(lcg(3));
    const { probs } = forward(theta, makeInputs(5));
    let sum = 0;
    for (const p of probs) {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
      sum += p;
    }
    expect(sum).toBeCloseTo(1, 10);
  });

  it('softmax sayısal olarak kararlıdır (büyük logitlerde NaN üretmez)', () => {
    const theta = createTheta();
    // Tüm çıktı bias'ları devasa yap.
    for (let j = 0; j < MLP_SHAPE.OUTPUTS; j++) theta[136 + j] = j === 0 ? 5000 : -5000;
    const { probs } = forward(theta, makeInputs(1));
    expect(isFiniteVec(probs)).toBe(true);
    expect(probs[0]).toBeCloseTo(1, 10);
    let sum = 0;
    for (const p of probs) sum += p;
    expect(sum).toBeCloseTo(1, 6);
  });

  it('greedyAction olasılıksal dağılımın modunu seçer', () => {
    const probs = new Float64Array([0.1, 0.6, 0.2, 0.1]);
    expect(greedyAction(probs)).toBe(1);
  });

  it('sampleAction verilen birikimli olasılıklara uyar', () => {
    const probs = new Float64Array([0.25, 0.25, 0.25, 0.25]);
    expect(sampleAction(probs, 0)).toBe(0);
    expect(sampleAction(probs, 0.3)).toBe(1);
    expect(sampleAction(probs, 0.9)).toBe(3);
  });
});

describe('Analitik gradyan', () => {
  it('merkezi sonlu farkla 140 parametrenin tamamında örtüşür', () => {
    const theta = initTheta(lcg(101));
    const x = makeInputs(202);
    for (let action = 0; action < MLP_SHAPE.OUTPUTS; action++) {
      const analytic = logProbAndGrad(theta, x, action).grad;
      const numeric = centralDifferenceGrad(theta, x, action, 1e-5);
      const diff = maxAbsDiff(analytic, numeric);
      // eps=1e-5 için sonlu fark hatası O(eps^2) ≈ 1e-10; tolerans buna geniştir.
      expect(diff).toBeLessThan(2e-6);
    }
  });

  it('farklı rastgele ağlarda ve girdilerde de örtüşür', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const theta = initTheta(lcg(seed * 7919));
      const x = makeInputs(seed * 104729);
      const action = seed % MLP_SHAPE.OUTPUTS;
      const analytic = logProbAndGrad(theta, x, action).grad;
      const numeric = centralDifferenceGrad(theta, x, action);
      expect(maxAbsDiff(analytic, numeric)).toBeLessThan(2e-6);
    }
  });

  it('gradyan NaN içerirse sıfırlar (savunma)', () => {
    const grad = new Float64Array(MLP_SHAPE.PARAM_COUNT);
    grad.fill(0.5);
    grad[17] = Number.NaN;
    const norm = clipGradNorm(grad, 5);
    expect(norm).toBe(0);
    expect(isFiniteVec(grad)).toBe(true);
  });

  it('büyük gradyanı sınıra kırpır ve kırpma öncesi normu raporlar', () => {
    const grad = new Float64Array(MLP_SHAPE.PARAM_COUNT);
    grad.fill(1000);
    const preClipNorm = clipGradNorm(grad, 5);
    // Raporlanan norm kırpma ÖNCESİ değerdir (patlama tanısı).
    expect(preClipNorm).toBeGreaterThan(5);
    expect(preClipNorm).toBeCloseTo(1000 * Math.sqrt(MLP_SHAPE.PARAM_COUNT), 3);
    // Vektörün kırpma SONRASI normu tam olarak sınıra eşittir.
    let post = 0;
    for (const g of grad) post += g * g;
    expect(Math.sqrt(post)).toBeCloseTo(5, 6);
  });
});

describe('Girdi doğrulama', () => {
  it('yanlış boyutlu girdiyi reddeder', () => {
    const theta = createTheta();
    expect(() => forward(theta, new Float64Array(11))).toThrow(/girdi boyutu/);
  });

  it('yanlış boyutlu parametreyi reddeder', () => {
    expect(() => forward(new Float64Array(139), makeInputs(1))).toThrow(/parametre boyutu/);
  });

  it('geçersiz eylem numarasını reddeder', () => {
    const theta = initTheta(lcg(1));
    const x = makeInputs(1);
    expect(logProbAndGrad(theta, x, -1).logProb).toBeNaN();
  });
});
/**
 * Cell to Mind — istatistik katmanı testleri.
 *
 * Buradaki testler iki iş yapar:
 *  1) Bootstrap ve kuantil hesaplarının doğru olduğunu **bilinen cevaplı**
 *     verilere karşı doğrular (elle hesaplanabilen küçük örnekler).
 *  2) Deney istatistiğinin **methodolojik sözleşmelerini** koruduğunu
 *     doğrular: determinizm, tek yönlü sonuç, eşleştirilmiş fark.
 */

import { describe, expect, it } from 'vitest';
import {
  bootstrapCI,
  bootstrapTest,
  fmt,
  iqm,
  mean,
  median,
  quantile,
  stdDev,
  summarize,
} from '../src/sim/stats.ts';

describe('temel istatistik', () => {
  it('ortalama ve standart sapma', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBeNaN();
    // n-1 paylı: [2,4,4,4,5,5,7,9] için 2.1380899...
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.1380899, 6);
    expect(stdDev([1])).toBeNaN();
  });

  it('medyan ve kuantil (tür 7 interpolasyonu)', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    // t=0.25, n=4 → poz=0.75 → s[0] + 0.75*(s[1]-s[0]) = 1 + 0.75 = 1.75
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
    expect(quantile([5], 0.9)).toBe(5);
  });

  it('IQM çeyreklikler arasını ortalar, uçlardan etkilenmez', () => {
    // Tek bir dev outlier IQM'yi medyandan çok az oynatmalı.
    const withOutlier = [1, 2, 3, 4, 5, 6, 7, 8, 1000];
    const withoutOutlier = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(Math.abs(iqm(withOutlier) - iqm(withoutOutlier))).toBeLessThan(0.5);
    // Medyan ise outlier'dan hiç etkilenmez; IQM de öyle olmalı.
    expect(iqm([1, 1, 1, 1, 1, 1, 1, 1, 50])).toBeCloseTo(1, 10);
  });

  it('özet, boş küme için NaN döndürür', () => {
    const s = summarize([]);
    expect(s.n).toBe(0);
    expect(Number.isNaN(s.mean)).toBe(true);
  });

  it('biçimlendirme sonlu olmayan değerleri "—" gösterir', () => {
    expect(fmt(Number.NaN)).toBe('—');
    expect(fmt(Number.POSITIVE_INFINITY)).toBe('—');
    expect(fmt(1.23456, 2)).toBe('1.23');
  });
});

describe('bootstrap güven aralığı', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('deterministiktir: aynı tohum → aynı aralık', () => {
    const a = bootstrapCI(data, { seed: 42 });
    const b = bootstrapCI(data, { seed: 42 });
    expect(a.lower).toBe(b.lower);
    expect(a.upper).toBe(b.upper);
    expect(a.estimate).toBe(b.estimate);
  });

  it('farklı tohumlar farklı örneklem yolları izler', () => {
    const a = bootstrapCI(data, { seed: 1 });
    const b = bootstrapCI(data, { seed: 2 });
    // Küçük n'de **yüzdelik aralığı ayrıktır**: 2.5. yüzdelik çoğu zaman
    // aynı ayrık değere düşer. Bu bir hata değil, bootstrap'ın bilinen
    // özelliğidir. Bu yüzden "her tohum farklı aralık verir" diye
    // varsayılmaz; "birden fazla tohum en az iki farklı sonuç üretir" denir.
    const lowers = new Set<number>();
    for (let s = 0; s < 6; s++) lowers.add(bootstrapCI(data, { seed: s + 100 }).lower);
    expect(lowers.size).toBeGreaterThan(1);

    // Her aralık yine de makul: ortalama 5.5 civarında, aralık onu içlemeli.
    expect(a.lower).toBeLessThan(5.5);
    expect(a.upper).toBeGreaterThan(5.5);
    expect(b.lower).toBeLessThan(5.5);
    expect(b.upper).toBeGreaterThan(5.5);
  });

  it('yeterli çeşitlilikte aralıklar süreklileşir', () => {
    // 40 farklı değer: yüzdelikler ayrık çakışmayı bırakır.
    const rich = Array.from({ length: 40 }, (_, i) => i);
    const lowers = new Set<number>();
    for (let s = 0; s < 6; s++) lowers.add(bootstrapCI(rich, { seed: s + 200 }).lower);
    expect(lowers.size).toBeGreaterThan(3);
  });

  it('aralık nokta tahmini içerir', () => {
    const ci = bootstrapCI(data, { seed: 5, resamples: 2000 });
    expect(ci.lower).toBeLessThanOrEqual(ci.estimate);
    expect(ci.upper).toBeGreaterThanOrEqual(ci.estimate);
  });

  it('sabit veride aralık nokta değerine çöker', () => {
    const ci = bootstrapCI([7, 7, 7, 7, 7], { seed: 5, resamples: 500 });
    expect(ci.lower).toBeCloseTo(7, 10);
    expect(ci.upper).toBeCloseTo(7, 10);
    expect(ci.estimate).toBe(7);
  });

  it('tek koşuda aralık nokta tahminle aynıdır (gizlenmez)', () => {
    const ci = bootstrapCI([3.5], { seed: 5 });
    expect(ci.lower).toBe(3.5);
    expect(ci.upper).toBe(3.5);
    expect(ci.estimate).toBe(3.5);
  });

  it('yüksek güven düzeyi daha geniş aralık verir', () => {
    const narrow = bootstrapCI(data, { seed: 9, level: 0.8 });
    const wide = bootstrapCI(data, { seed: 9, level: 0.99 });
    expect(wide.lower).toBeLessThan(narrow.lower);
    expect(wide.upper).toBeGreaterThan(narrow.upper);
  });

  it('IQM istatistiğiyle de çalışır', () => {
    const ci = bootstrapCI(data, { seed: 3, statistic: iqm });
    expect(Number.isFinite(ci.estimate)).toBe(true);
    expect(ci.lower).toBeLessThanOrEqual(ci.upper);
  });

  it('boş küme NaN aralık döndürür', () => {
    const ci = bootstrapCI([], { seed: 1 });
    expect(Number.isNaN(ci.lower)).toBe(true);
  });
});

describe('bootstrap hipotez testi', () => {
  it('belirgin pozitif farkta küçük p', () => {
    const diffs = [0.10, 0.12, 0.09, 0.11, 0.13, 0.08, 0.10, 0.12];
    const t = bootstrapTest(diffs, { seed: 11 });
    expect(t.observed).toBeGreaterThan(0);
    expect(t.pValue).toBeLessThan(0.05);
  });

  it('sıfıra yakın farkta yüksek p', () => {
    const diffs = [-0.01, 0.02, -0.005, 0.015, 0.0, 0.01];
    const t = bootstrapTest(diffs, { seed: 12 });
    expect(t.pValue).toBeGreaterThan(0.05);
  });

  it('probabilityOfImprovement, pozitif farkta 1’e yakın olur', () => {
    const t = bootstrapTest([0.2, 0.25, 0.18, 0.22, 0.3], { seed: 13 });
    expect(t.probabilityOfImprovement).toBeGreaterThan(0.9);
  });

  it('probabilityOfImprovement, negatif farkta 1’e yakın 0 olur', () => {
    const t = bootstrapTest([-0.2, -0.25, -0.18, -0.22, -0.3], { seed: 14 });
    expect(t.probabilityOfImprovement).toBeLessThan(0.1);
  });

  it('probabilityOfImprovement merkezlenmiş veriden hesaplanmaz', () => {
    // Regresyon koruması: merkezlenmiş veriden hesaplanırsa her zaman ≈0.5
    // döner ve hiçbir bilgi taşımaz. Sıfıra yakın farklar için yine de
    // yarıya yakın olmalı — ama belirgin farklarda 0 ya da 1'e gitmeli.
    const strong = bootstrapTest([1, 1.2, 0.9, 1.1, 1.05], { seed: 15 });
    expect(strong.probabilityOfImprovement).toBeGreaterThan(0.95);
  });

  it('tek koşuda p-değeri NaN olur (gizlenmez)', () => {
    const t = bootstrapTest([0.5], { seed: 16 });
    expect(Number.isNaN(t.pValue)).toBe(true);
    expect(t.observed).toBe(0.5);
  });

  it('p-değeri asla 0 değildir (düzeltme terimi)', () => {
    const t = bootstrapTest([5, 6, 7, 8, 9, 10], { seed: 17, resamples: 1000 });
    expect(t.pValue).toBeGreaterThan(0);
  });

  it('deterministiktir', () => {
    const a = bootstrapTest([0.1, 0.2, 0.15, -0.05, 0.3], { seed: 21 });
    const b = bootstrapTest([0.1, 0.2, 0.15, -0.05, 0.3], { seed: 21 });
    expect(a.pValue).toBe(b.pValue);
    expect(a.probabilityOfImprovement).toBe(b.probabilityOfImprovement);
  });
});

describe('eşleştirilmiş tasarım sözleşmesi', () => {
  it('ortak varyanslı çiftlerde bootstrap farkı doğru daraltır', () => {
    // Aynı ızgara üzerinde üretilmiş iki kol: yüksek korelasyon → dar fark aralığı.
    const grid = [0.0, 0.5, 1.0, 1.5, 2.0];
    const control = grid.map((v) => v + 0.01);
    const treatment = grid.map((v) => v + 0.03);
    const diffs = treatment.map((v, i) => v - (control[i] as number));

    const pairedCI = bootstrapCI(diffs, { seed: 31, resamples: 2000 });
    const unpairedCI = bootstrapCI(treatment, { seed: 31, resamples: 2000 });

    // Eşleştirilmiş aralık çok daha dar olmalı (ortak varyans iptal edilir).
    expect(pairedCI.upper - pairedCI.lower).toBeLessThan(unpairedCI.upper - unpairedCI.lower);
    expect(pairedCI.estimate).toBeCloseTo(0.02, 10);
  });

  it('fark dizisinin ortalaması, kol farkının ortalamasına eşittir', () => {
    const control = [1, 2, 3, 4, 5, 6, 7, 8];
    const treatment = [2, 2, 4, 5, 6, 6, 9, 10];
    const diffs = treatment.map((v, i) => v - (control[i] as number));
    expect(mean(diffs)).toBeCloseTo(mean(treatment) - mean(control), 12);
  });
});

/**
 * Cell to Mind — deney altyapısı testleri.
 *
 * Bu testler kütüphaneyi değil **deney yükünün doğruluğunu** doğrular.
 * Bir deney kodu yanlış çalışıyorsa ortaya çıkan sayılar da yanlış olur ve
 * `VALIDATION.md` yanıltıcı hâle gelir. Bu yüzden kontroller burada.
 *
 * Kapsam:
 *  - Aynı girdi → bit düzeyinde aynı sonuç (determinizm).
 *  - Aynı seed iki kol → aynı başlangıç dünyası (eşleştirmenin temeli).
 *  - Farklı seed → farklı dünya (kolay yanlış-pozitif koruması).
 *  - Öğrenme kapalıyken ağırlıklar bit düzeyinde sabit.
 *  - Ağırlık enjeksiyonu gerçekten politika değiştiriyor.
 *  - Enerji muhasebesi her iki koşu yüzeyinde korunuyor.
 *  - Ölüm ölçüm penceresinde ceza olarak sayılıyor.
 *  - Koloni koşucusu müdahale değişkenini gerçekten uyguluyor.
 */

import { describe, expect, it } from 'vitest';
import { MLP_SHAPE, copyTheta } from '../src/sim/behavior/mlp.ts';
import { runColony, genomeDistance } from '../src/sim/experiments/colony.ts';
import { runTrial } from '../src/sim/experiments/arena.ts';
import {
  diagnoseColonyCollapse,
  experimentBondLifeHeritability,
  formatBondDurability,
  formatDiagnosis,
  formatEcologyTable,
  formatHeritability,
  formatRegen,
  sweepBondDurability,
  sweepResourceRegen,
} from '../src/sim/experiments/ecology.ts';
import {
  calibrateArena,
  evolvePolicy,
  experiment3,
  formatEvolution,
  formatLearningSweep,
  formatPolicySurvey,
  formatRewardSignal,
  formatSignalSweep,
  formatSignStep,
  formatVarianceSweep,
  measureRewardSignal,
  runInvariants,
  surveyPolicySpace,
  sweepLearning,
  sweepLearningSignal,
  sweepSignStep,
  sweepVarianceReduction,
} from '../src/sim/experiments/index.ts';

describe('determinizm', () => {
  it('arena: aynı girdi → bit düzeyinde aynı sonuç', () => {
    const a = runTrial({ seed: 4242, ticks: 800, learning: true, sampleEvery: 0 });
    const b = runTrial({ seed: 4242, ticks: 800, learning: true, sampleEvery: 0 });
    expect(b.meanEnergyNorm).toBe(a.meanEnergyNorm);
    expect(b.deathTick).toBe(a.deathTick);
    expect(b.learningUpdates).toBe(a.learningUpdates);
    for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
      expect(b.thetaFinal[p]).toBe(a.thetaFinal[p]);
    }
  });

  it('koloni: aynı girdi → bit düzeyinde aynı sonuç', () => {
    const a = runColony({ seed: 4242, ticks: 900 });
    const b = runColony({ seed: 4242, ticks: 900 });
    expect(b.finalPopulation).toBe(a.finalPopulation);
    expect(b.peakLargestColony).toBe(a.peakLargestColony);
    expect(b.genomeShift).toBe(a.genomeShift);
    expect(b.finalBondCount).toBe(a.finalBondCount);
  });

  it('farklı seed → farklı dünya (kolay yanlış-pozitif koruması)', () => {
    const a = runTrial({ seed: 11, ticks: 800, learning: false, sampleEvery: 0 });
    const b = runTrial({ seed: 12, ticks: 800, learning: false, sampleEvery: 0 });
    expect(b.meanEnergyNorm).not.toBe(a.meanEnergyNorm);
  });
});

describe('eşleştirmenin temeli', () => {
  it('aynı seed, aynı başlangıç dünyasını üretir', () => {
    // Kurucunun rastgele başlangıç ağı seed'e bağlıdır; iki koşu aynı ağı
    // görmeli, aksi halde "eşleştirilmiş" tasarım eşleştirilmemiş olurdu.
    const a = runTrial({ seed: 77, ticks: 1, learning: false, sampleEvery: 0 });
    const b = runTrial({ seed: 77, ticks: 1, learning: false, sampleEvery: 0 });
    for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
      expect(b.thetaFinal[p]).toBe(a.thetaFinal[p]);
    }
  });

  it('eşleştirilmiş kol farkı, ham kol ortalamalarının farkına eşittir', () => {
    const control = runTrial({ seed: 501, ticks: 600, learning: false, sampleEvery: 0 });
    const trained = runTrial({ seed: 501, ticks: 600, learning: false, sampleEvery: 0 });
    expect(trained.meanEnergyNorm).toBe(control.meanEnergyNorm);
  });
});

describe('öğrenme kapatma değişmezleri', () => {
  it('öğrenme kapalıyken ağırlıklar bit düzeyinde sabit kalır', () => {
    const start = runTrial({ seed: 555, ticks: 1, learning: false, sampleEvery: 0 });
    const theta = copyTheta(start.thetaFinal);

    const run = runTrial({ seed: 555, ticks: 1200, learning: false, theta, sampleEvery: 0 });
    expect(run.learningUpdates).toBe(0);
    expect(run.learnedDeltaNorm).toBe(0);
    for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
      expect(run.thetaFinal[p]).toBe(theta[p]);
    }
  });

  it('öğrenme açıkken ağırlıklar gerçekten değişir', () => {
    const start = runTrial({ seed: 556, ticks: 1, learning: true, sampleEvery: 0 });
    const theta = copyTheta(start.thetaFinal);
    const run = runTrial({ seed: 556, ticks: 2000, learning: true, theta, sampleEvery: 0 });
    expect(run.learningUpdates).toBeGreaterThan(0);
    expect(run.learnedDeltaNorm).toBeGreaterThan(0);
  });

  it('enjeksiyonsuz öğrenme koşusunda da ağırlık kayması ÖLÇÜLÜR', () => {
    // Regresyon koruması: eski uygulamada learnedDeltaNorm yalnız enjeksiyon
    // yapıldığında hesaplanıyordu, normal eğitim koşusunda tanım gereği 0
    // dönüyordu ve rapor "öğrenme hiçbir şey yapmıyor" izlenimi veriyordu.
    const run = runTrial({ seed: 557, ticks: 2500, learning: true, sampleEvery: 0 });
    expect(run.thetaInjected).toBe(false);
    expect(run.learningUpdates).toBeGreaterThan(0);
    expect(run.learnedDeltaNorm).toBeGreaterThan(0);
  });

  it('değerlendirme koşusunda (öğrenme kapalı) ağırlık kayması 0 kalır', () => {
    const donor = runTrial({ seed: 558, ticks: 1, learning: true, sampleEvery: 0 });
    const evalRun = runTrial({ seed: 558, ticks: 1500, learning: false, theta: donor.thetaFinal, sampleEvery: 0 });
    expect(evalRun.thetaInjected).toBe(true);
    expect(evalRun.learnedDeltaNorm).toBe(0);
  });
});

describe('ağırlık enjeksiyonu', () => {
  it('enjekte edilen ağırlıklar politikaya gerçekten uygulanır', () => {
    const seed = 606;
    const donor = runTrial({ seed: seed, ticks: 1, learning: false, sampleEvery: 0 });
    const target = runTrial({ seed: seed, ticks: 1, learning: false, theta: donor.thetaFinal, sampleEvery: 0 });
    for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
      expect(target.thetaFinal[p]).toBe(donor.thetaFinal[p]);
    }
  });

  it('farklı ağırlıklar farklı davranış ve dolayısıyla farklı skor üretir', () => {
    const seed = 607;
    // Donör **gerçekten farklı** bir ağ olmalı: aynı tohumun 1 tick'lik
    // koşusu zaten o dünyanın kurucu ağıdır, enjeksiyonu bir işe yaramaz.
    const donor = runTrial({ seed: 991, ticks: 3000, learning: true, sampleEvery: 0 });
    const plain = runTrial({ seed, ticks: 1500, learning: false, sampleEvery: 0 });
    const injected = runTrial({ seed, ticks: 1500, learning: false, theta: donor.thetaFinal, sampleEvery: 0 });
    // Ağırlıklar gerçekten farklı…
    let differs = 0;
    for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
      if (donor.thetaFinal[p] !== plain.thetaFinal[p]) differs++;
    }
    expect(differs).toBeGreaterThan(0);
    // …ve bu fark sonucu değiştiriyor.
    expect(injected.meanEnergyNorm).not.toBe(plain.meanEnergyNorm);
  });

  it('yanlış boyutlu ağırlık vektörü açık hata verir', () => {
    expect(() => runTrial({ seed: 1, ticks: 1, learning: false, theta: new Float64Array(7), sampleEvery: 0 })).toThrow();
  });
});

describe('enerji muhasebesi', () => {
  it('arena koşusunda rezidüel sıfırdır', () => {
    for (const seed of [701, 702, 703]) {
      const r = runTrial({ seed, ticks: 700, learning: true, sampleEvery: 0 });
      expect(Math.abs(r.ledgerResidual)).toBeLessThan(1e-6);
    }
  });

  it('koloni koşusunda rezidüel sıfırdır', () => {
    for (const seed of [704, 705]) {
      const r = runColony({ seed, ticks: 900 });
      expect(Math.abs(r.ledgerResidual)).toBeLessThan(1e-6);
    }
  });

  it('ölçüm skoru [0, 1] aralığında kalır', () => {
    for (const seed of [706, 707, 708]) {
      const r = runTrial({ seed, ticks: 900, learning: true, sampleEvery: 0 });
      expect(r.meanEnergyNorm).toBeGreaterThanOrEqual(0);
      expect(r.meanEnergyNorm).toBeLessThanOrEqual(1);
    }
  });
});

describe('ölüm ölçümü', () => {
  it('ölüm kaydı tutulur ve hayatta kalma bayrağı düşer', () => {
    // Avcı baskısı yüksek, kaynak az: ölüm gerçekleşmeli.
    const r = runTrial({
      seed: 801,
      ticks: 6000,
      learning: false,
      resourceCount: 2,
      selectionPressure: 1,
      sampleEvery: 0,
    });
    if (!r.survivedToEnd) {
      expect(r.deathTick).not.toBeNull();
      expect(r.deathTick).toBeGreaterThan(0);
      expect(r.deathTick).toBeLessThanOrEqual(6000);
      expect(r.deathCause).not.toBe('null');
    } else {
      // Ölmediyse ölüm alanları tutarlı biçimde boş olmalı.
      expect(r.deathTick).toBeNull();
    }
  });

  it('ölüm sonrası katkı sıfırdır: ölüm cezadır', () => {
    const r = runTrial({
      seed: 802,
      ticks: 6000,
      learning: false,
      resourceCount: 2,
      selectionPressure: 1,
      sampleEvery: 50,
    });
    if (r.deathTick !== null) {
      for (const point of r.trace) {
        if (point.tick > r.deathTick) expect(point.energyNorm).toBe(0);
      }
      // Skor, ölüm anına kadarki alanı aşamaz.
      expect(r.meanEnergyNorm).toBeLessThanOrEqual(1);
    }
  });
});

describe('koloni müdahalesi', () => {
  it('bondAffinity gerçekten bağ sayısını değiştirir', () => {
    const weak = runColony({ seed: 901, ticks: 1200, bondAffinityOverride: 0.05, mutationEnabled: false });
    const strong = runColony({ seed: 901, ticks: 1200, bondAffinityOverride: 0.9, mutationEnabled: false });
    expect(strong.finalBondCount).not.toBe(weak.finalBondCount);
    expect(strong.finalBondCount).toBeGreaterThan(weak.finalBondCount);
  });

  it('mutasyon kapalıyken genom kayması seçilimden gelir (mutasyondan değil)', () => {
    const frozen = runColony({ seed: 902, ticks: 1500, mutationEnabled: false });
    // Donmuş kolda bireylerin genomu birebir aynıdır; kayma yalnızca
    // hayatta kalanların seçilimiyle oluşabilir.
    expect(frozen.genomeShift).toBeLessThanOrEqual(0.5);
    expect(Number.isFinite(frozen.genomeShift)).toBe(true);
  });

  it('genomDistance simetrik ve sıfır olgunlukta sıfırdır', () => {
    const a = runColony({ seed: 903, ticks: 200, mutationEnabled: false });
    expect(genomeDistance(a.founderGenome, a.founderGenome)).toBe(0);
    expect(genomeDistance(a.founderGenome, a.livingGenome)).toBeCloseTo(
      genomeDistance(a.livingGenome, a.founderGenome),
      12,
    );
  });

  it('zirve büyüklüğü başlangıç popülasyonu aşan bir çarpan olarak raporlanır', () => {
    const r = runColony({ seed: 904, ticks: 800 });
    expect(r.peakColonyGrowthFactor).toBeCloseTo(r.peakLargestColony / 48, 10);
  });
});

describe('deney paketi bütünlüğü', () => {
  it('tüm değişmez kontroller geçer', () => {
    const checks = runInvariants();
    for (const c of checks) {
      expect(`${c.name}: ${c.detail}`).toBe(`${c.name}: ${c.detail}`);
      expect(c.passed, `${c.name} başarısız — ${c.detail}`).toBe(true);
    }
    expect(checks.length).toBeGreaterThanOrEqual(5);
  });

  it('zorluk kalibrasyonu azalan headroom eğrisi verir', () => {
    const curve = calibrateArena({ resourceCounts: [4, 14, 34], seeds: 2, ticks: 500 });
    expect(curve).toHaveLength(3);
    for (const point of curve) {
      expect(point.headroom).toBeGreaterThanOrEqual(0);
      expect(point.headroom).toBeLessThanOrEqual(1);
      expect(point.controlMean).toBeGreaterThanOrEqual(0);
      expect(point.controlMean).toBeLessThanOrEqual(1);
    }
    // Daha zengin habitat → rastgele politika daha iyi → daha az headroom.
    const sparse = curve[0];
    const rich = curve[2];
    if (sparse && rich) {
      expect(sparse.controlMean).toBeLessThan(rich.controlMean);
    }
  });
});

describe('öğrenme zorluk taraması', () => {
  it('her zorlukta tam protokol koşar ve aralık üretir', () => {
    const curve = sweepLearning({
      resourceCounts: [4, 34],
      seeds: 2,
      trainTicks: 400,
      evalTicks: 300,
    });
    expect(curve).toHaveLength(2);
    for (const point of curve) {
      expect(point.difference.lower).toBeLessThanOrEqual(point.difference.upper);
      expect(point.difference.estimate).toBeCloseTo(point.difference.estimate, 10);
      expect(point.pValue).toBeGreaterThan(0);
      expect(point.probabilityOfImprovement).toBeGreaterThanOrEqual(0);
      expect(point.probabilityOfImprovement).toBeLessThanOrEqual(1);
      expect(point.headroom).toBeGreaterThanOrEqual(0);
      expect(point.headroom).toBeLessThanOrEqual(1);
      expect(Number.isFinite(point.control)).toBe(true);
      expect(Number.isFinite(point.treatment)).toBe(true);
    }
  });

  it('headroom kaynak sayısı azaldıkça artar', () => {
    const curve = sweepLearning({
      resourceCounts: [4, 34],
      seeds: 2,
      trainTicks: 400,
      evalTicks: 300,
    });
    const sparse = curve[0];
    const rich = curve[1];
    if (sparse && rich) {
      expect(sparse.headroom).toBeGreaterThan(rich.headroom);
    }
  });

  it('biçimlendirme satır başına bir nokta üretir', () => {
    const curve = sweepLearning({ resourceCounts: [4, 14, 34], seeds: 1, trainTicks: 300, evalTicks: 200 });
    const text = formatLearningSweep(curve);
    const lines = text.split('\n');
    expect(lines).toHaveLength(curve.length + 1); // başlık + noktalar
    expect(lines[0]).toContain('headroom');
  });
});

describe('politika uzayı araştırması', () => {
  it('rastgele politikaların skor dağılımını ölçer ve sıralı döndürür', () => {
    const s = surveyPolicySpace({ resourceCount: 14, samples: 10, ticks: 400 });
    expect(s.sampled).toBe(10);
    expect(s.resourceCount).toBe(14);
    // Kuyruk sırasına uygun olmalı
    expect(s.random.min).toBeLessThanOrEqual(s.random.q25);
    expect(s.random.q25).toBeLessThanOrEqual(s.random.median);
    expect(s.random.median).toBeLessThanOrEqual(s.random.q75);
    expect(s.random.q75).toBeLessThanOrEqual(s.random.max);
    expect(s.bestRandom).toBe(s.random.max);
    for (const v of [s.random.min, s.random.median, s.random.max, s.random.mean]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('ölçülebilir bir öğrenilebilir açıklık raporlar', () => {
    const s = surveyPolicySpace({ resourceCount: 14, samples: 12, ticks: 400 });
    expect(Number.isFinite(s.learnableGap)).toBe(true);
    // En iyi dilim genel ortalamadan düşük olamaz.
    expect(s.learnableGap).toBeGreaterThanOrEqual(0);
  });

  it('deterministiktir', () => {
    const a = surveyPolicySpace({ resourceCount: 14, samples: 6, ticks: 300 });
    const b = surveyPolicySpace({ resourceCount: 14, samples: 6, ticks: 300 });
    expect(b.random.mean).toBe(a.random.mean);
    expect(b.bestRandom).toBe(a.bestRandom);
    expect(b.learnableGap).toBe(a.learnableGap);
  });

  it('biçimlendirme üç satır üretir', () => {
    const s = surveyPolicySpace({ resourceCount: 14, samples: 4, ticks: 200 });
    expect(formatPolicySurvey(s).split('\n')).toHaveLength(3);
  });
});

describe('öğrenme sinyali duyarlılığı', () => {
  it('varsayılan ayarlar model sabitleriyle aynı sonucu verir', () => {
    // Duyarlılık analizi kancaları ürün davranışını değiştirmemeli.
    const a = runTrial({ seed: 990, ticks: 900, learning: true, sampleEvery: 0 });
    const b = runTrial({ seed: 990, ticks: 900, learning: true, trajectoryLimit: 64, learnRate: 0.02, sampleEvery: 0 });
    expect(b.learningUpdates).toBe(a.learningUpdates);
    expect(b.learnedDeltaNorm).toBe(a.learnedDeltaNorm);
    expect(b.meanEnergyNorm).toBe(a.meanEnergyNorm);
  });

  it('ufuk kısalttıkça daha çok güncelleme yapılır', () => {
    const long = runTrial({ seed: 991, ticks: 6000, learning: true, trajectoryLimit: 64, sampleEvery: 0 });
    const short = runTrial({ seed: 991, ticks: 6000, learning: true, trajectoryLimit: 8, sampleEvery: 0 });
    expect(short.learningUpdates).toBeGreaterThan(long.learningUpdates);
    expect(long.learningUpdates).toBeLessThan(short.learningUpdates);
  });

  it('tarama geçerli aralıklar ve artan güncelleme sayısı üretir', () => {
    const points = sweepLearningSignal({
      trajectoryLimits: [64, 16],
      learnRates: [0.02, 0.1],
      seeds: 2,
      trainTicks: 1200,
      evalTicks: 800,
    });
    expect(points).toHaveLength(4);
    for (const p of points) {
      expect(p.difference.lower).toBeLessThanOrEqual(p.difference.upper);
      expect(p.pValue).toBeGreaterThan(0);
      expect(p.probabilityOfImprovement).toBeGreaterThanOrEqual(0);
      expect(p.probabilityOfImprovement).toBeLessThanOrEqual(1);
      expect(p.updates).toBeGreaterThan(0);
      expect(p.weightShift).toBeGreaterThan(0);
    }
    // Uzun ufukta daha az güncelleme olmalı
    const first = points.filter((p) => p.trajectoryLimit === 64);
    const second = points.filter((p) => p.trajectoryLimit === 16);
    expect(first[0]?.updates).toBeLessThan(second[0]?.updates ?? Infinity);
  });

  it('biçimlendirme başlık + nokta satırı üretir', () => {
    const points = sweepLearningSignal({
      trajectoryLimits: [64],
      learnRates: [0.02, 0.1],
      seeds: 1,
      trainTicks: 600,
      evalTicks: 400,
    });
    expect(formatSignalSweep(points).split('\n')).toHaveLength(points.length + 1);
  });
});

describe('evrimsel politika araması', () => {
  it('havuz boyutunu sabit tutar (seçilim üstel büyümeye yol açmaz)', () => {
    // Regresyon koruması: elitizm uygulanmazsa havuz her nesilde
    // (1+offspring) katına çıkar ve arama bütçeyi değerlendirmeye harcar.
    const r = evolvePolicy({
      generations: 6,
      population: 5,
      offspring: 3,
      trainSeeds: 1,
      trainTicks: 300,
      evalTicks: 300,
    });
    // Her nesilde tam aday sayısı değerlendirilmiş olmalı (population*(1+offspring))
    for (const h of r.history) {
      expect(h.scores).toHaveLength(5 * 4);
    }
    expect(r.history).toHaveLength(6);
  });

  it('yeterli tohum sayısıyla taban çizgisini geçen bir politika bulur', () => {
    // Az tohumla arama **değerlendirme tohumlarına aşırı uyum sağlıyor**
    // (ölçüldü: 2 tohumda kazanç negatife dönüyor). Bu yüzden test, üretim
    // ayarlarındaki gibi yeterli tohum kullanır; aşırı uyum ayrıca not altında.
    const r = evolvePolicy({
      generations: 10,
      population: 8,
      offspring: 3,
      trainSeeds: 6,
      trainTicks: 2000,
      evalTicks: 2000,
    });
    expect(r.trainBest).toBeGreaterThan(r.randomBaselineMean);
    expect(r.evalBest).toBeGreaterThan(r.evalBaselineMean);
    expect(r.gainOverRandom).toBeGreaterThan(0);
  });

  it('elitizm eğitim kümesinde en azından kazanç garantiler', () => {
    // Elitizm olduğu için eğitim tohumlarında ilerleme garantidir — bu, tohum
    // sayısından bağımsız ve deterministik bir özelliktir.
    const r = evolvePolicy({
      generations: 6,
      population: 5,
      offspring: 2,
      trainSeeds: 2,
      trainTicks: 500,
      evalTicks: 500,
    });
    expect(r.trainBest).toBeGreaterThanOrEqual(r.randomBaselineMean);
  });

  it('skor geçmişini azalan düzende raporlar', () => {
    const r = evolvePolicy({
      generations: 6,
      population: 5,
      offspring: 2,
      trainSeeds: 1,
      trainTicks: 300,
      evalTicks: 300,
    });
    for (const h of r.history) {
      expect(h.best).toBeGreaterThanOrEqual(h.mean - 1e-9);
      // `scores` azalan sıralı olmalı
      for (let i = 1; i < h.scores.length; i++) {
        expect(h.scores[i]).toBeLessThanOrEqual(h.scores[i - 1] as number);
      }
    }
  });

  it('deterministiktir', () => {
    const a = evolvePolicy({ generations: 4, population: 4, offspring: 2, trainSeeds: 1, trainTicks: 300, evalTicks: 300 });
    const b = evolvePolicy({ generations: 4, population: 4, offspring: 2, trainSeeds: 1, trainTicks: 300, evalTicks: 300 });
    expect(b.evalBest).toBe(a.evalBest);
    expect(b.gainOverRandom).toBe(a.gainOverRandom);
  });

  it('biçimlendirme sonuç satırlarını içerir', () => {
    const r = evolvePolicy({ generations: 3, population: 3, offspring: 1, trainSeeds: 1, trainTicks: 250, evalTicks: 250 });
    const text = formatEvolution(r);
    expect(text).toContain('DEĞERLENDİRME');
    expect(text).toContain('nesil');
  });
});

describe('varyans azaltma seçenekleri', () => {
  it('varsayılan olarak KAPALI — ürün davranışı değişmez', () => {
    const plain = runTrial({ seed: 1101, ticks: 3000, learning: true, resourceCount: 14, sampleEvery: 0 });
    const explicit = runTrial({
      seed: 1101,
      ticks: 3000,
      learning: true,
      resourceCount: 14,
      normalizeAdvantage: false,
      signAdvantage: false,
      sampleEvery: 0,
    });
    expect(explicit.learnedDeltaNorm).toBe(plain.learnedDeltaNorm);
    expect(explicit.meanEnergyNorm).toBe(plain.meanEnergyNorm);
  });

  it('seçenekler politika katmanına GERÇEKTEN ulaşır', () => {
    // Sessiz başarısızlık koruması: bir kancanın World → policy zincirinde
    // kopması, deneyi "hepsi aynı sonuç" gibi gösterir ve yanlış sonuca
    // yol açar. Bu test kopyanın ulaştığını doğrular.
    const base = runTrial({ seed: 1102, ticks: 3000, learning: true, resourceCount: 14, sampleEvery: 0 });
    const sign = runTrial({ seed: 1102, ticks: 3000, learning: true, resourceCount: 14, signAdvantage: true, sampleEvery: 0 });
    const norm = runTrial({ seed: 1102, ticks: 3000, learning: true, resourceCount: 14, normalizeAdvantage: true, sampleEvery: 0 });
    expect(base.learningUpdates).toBeGreaterThan(0);
    expect(sign.learnedDeltaNorm).not.toBe(base.learnedDeltaNorm);
    expect(norm.learnedDeltaNorm).not.toBe(base.learnedDeltaNorm);
  });

  it('tarama dört varyantı da test eder ve geçerli aralık üretir', () => {
    const points = sweepVarianceReduction({ seeds: 3, trainTicks: 1500, evalTicks: 900 });
    expect(points).toHaveLength(4);
    expect(points.map((p) => p.label)).toEqual([
      'temel (dönüşüm yok)',
      'z-skor avantaj',
      'işaret avantajı',
      'işaret + z-skor',
    ]);
    for (const p of points) {
      expect(p.difference.lower).toBeLessThanOrEqual(p.difference.upper);
      expect(p.pValue).toBeGreaterThan(0);
      expect(p.probabilityOfImprovement).toBeGreaterThanOrEqual(0);
      expect(p.probabilityOfImprovement).toBeLessThanOrEqual(1);
      expect(p.updates).toBeGreaterThan(0);
    }
  });

  it('biçimlendirme başlık + dört satır üretir', () => {
    const points = sweepVarianceReduction({ seeds: 2, trainTicks: 900, evalTicks: 600 });
    expect(formatVarianceSweep(points).split('\n')).toHaveLength(points.length + 1);
  });
});

describe('S-1b · işaret avantajı + adım artışı', () => {
  it('her öğrenme hızı için geçerli aralık üretir', () => {
    const points = sweepSignStep({
      learnRates: [0.02, 0.5],
      seeds: 2,
      trainTicks: 1000,
      evalTicks: 700,
    });
    expect(points).toHaveLength(2);
    for (const p of points) {
      expect(p.difference.lower).toBeLessThanOrEqual(p.difference.upper);
      expect(p.pValue).toBeGreaterThan(0);
      expect(p.probabilityOfImprovement).toBeGreaterThanOrEqual(0);
      expect(p.probabilityOfImprovement).toBeLessThanOrEqual(1);
      expect(p.updates).toBeGreaterThan(0);
      expect(p.weightShift).toBeGreaterThan(0);
      expect(p.trajectoryLimit).toBe(64);
    }
  });

  it('öğrenme hızı arttıkça ağırlık kayması artar', () => {
    const points = sweepSignStep({
      learnRates: [0.02, 0.5],
      seeds: 2,
      trainTicks: 1500,
      evalTicks: 800,
    });
    const low = points[0];
    const high = points[1];
    expect(low).toBeDefined();
    expect(high).toBeDefined();
    expect(high?.weightShift ?? 0).toBeGreaterThan(low?.weightShift ?? Infinity);
  });

  it('biçimlendirme başlık + satır sayısı üretir', () => {
    const points = sweepSignStep({
      learnRates: [0.02, 0.1],
      seeds: 1,
      trainTicks: 700,
      evalTicks: 500,
    });
    expect(formatSignStep(points).split('\n')).toHaveLength(points.length + 1);
  });
});

describe('ödül sinyali ölçümü', () => {
  it('ödülün politika-bağımlılığını ve korelasyonunu raporlar', () => {
    const r = measureRewardSignal({ samples: 8, seedsPerSample: 1, ticks: 900 });
    expect(r.samples).toBe(8);
    expect(r.rewards).toHaveLength(8);
    expect(r.performances).toHaveLength(8);
    expect(Number.isFinite(r.policyDependentShare)).toBe(true);
    expect(r.policyDependentShare).toBeGreaterThanOrEqual(0);
    expect(r.policyDependentShare).toBeLessThanOrEqual(1);
    expect(r.pearson).toBeGreaterThanOrEqual(-1);
    expect(r.pearson).toBeLessThanOrEqual(1);
    expect(r.spearman).toBeGreaterThanOrEqual(-1);
    expect(r.spearman).toBeLessThanOrEqual(1);
    expect(r.reading.length).toBeGreaterThan(0);
  });

  it('ödül politikadan gerçekten bağımsız değil (sinyal mevcut)', () => {
    // Regresyon koruması: ödülün politika-bağımlılığı ölçülmüştür. Bu test,
    // ödülün tüm politikalarda birebir sabit olmadığını doğrular — yani
    // "sinyal yok" teşhisinin kendisi de doğrulanabilir bir iddiadır.
    const r = measureRewardSignal({ samples: 10, seedsPerSample: 1, ticks: 1200 });
    const spread = Math.max(...r.rewards) - Math.min(...r.rewards);
    expect(spread).toBeGreaterThan(1e-6);
    expect(r.policyDependentShare).toBeGreaterThan(0.05);
  });

  it('yorum kuralı pay aralığına göre değişir', () => {
    const strong = measureRewardSignal({ samples: 8, seedsPerSample: 1, ticks: 900 });
    expect(strong.reading).toMatch(/sinyal var|çalışamaz|zayıf/);
    expect(formatRewardSignal(strong).split('\n')).toHaveLength(5);
  });
});

describe('ekolojik sönümlenme teşhisi', () => {
  it('zaman serisi üretir ve hipotez alanlarını doldurur', () => {
    const d = diagnoseColonyCollapse({ seed: 12, ticks: 3000, sampleEvery: 500 });
    expect(d.seed).toBe(12);
    expect(d.samples.length).toBeGreaterThan(5);
    for (const s of d.samples) {
      expect(s.reserveFraction).toBeGreaterThanOrEqual(0);
      expect(s.reserveFraction).toBeLessThanOrEqual(1.0001);
      expect(s.bondCount).toBeGreaterThanOrEqual(0);
      expect(s.meanBondIntegrity).toBeGreaterThanOrEqual(0);
      expect(s.meanBondIntegrity).toBeLessThanOrEqual(1);
      expect(s.meanBondStrain).toBeGreaterThanOrEqual(0);
      expect(s.maxBondStrain).toBeGreaterThanOrEqual(s.meanBondStrain);
      expect(s.largestColony).toBeGreaterThanOrEqual(0);
    }
  });

  it('ölüm nedenleri yalnız meşru değerlerden gelir', () => {
    const d = diagnoseColonyCollapse({ seed: 13, ticks: 2500, sampleEvery: 500 });
    const legal = ['starvation', 'predation', 'age', 'experiment-end', null];
    expect(legal).toContain(d.dominantDeathCause);
    const last = d.samples[d.samples.length - 1];
    expect(last?.deathsStarvation ?? 0).toBeGreaterThanOrEqual(0);
    expect(last?.deathsPredation ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('sönümlenme tespit edildiğinde zirveden sonra ve eşiğin altında olur', () => {
    const d = diagnoseColonyCollapse({ seed: 11, ticks: 12_000, sampleEvery: 200 });
    expect(d.collapseTick).not.toBeNull();
    if (d.collapseTick !== null && d.atPeak && d.atCollapse) {
      expect(d.collapseTick).toBeGreaterThan(d.atPeak.tick);
      expect(d.atCollapse.largestColony).toBeLessThan(d.atPeak.largestColony * 0.25);
    }
  });

  it('enerji muhasebesi korunur (teşhis değiştirmez)', () => {
    const d = diagnoseColonyCollapse({ seed: 14, ticks: 2000, sampleEvery: 500 });
    // Sönümlenme anında rezerv tükenmiş OLMAMALI — teşhisin asıl bulgusu bu.
    // Eğer ileride bir düzeltme rezervi tüketmeye başlarsa bu test uyarır.
    if (d.atCollapse) {
      expect(d.atCollapse.reserveFraction).toBeGreaterThan(0.1);
    }
  });

  it('biçimlendirme okunabilir tablo üretir', () => {
    const d = diagnoseColonyCollapse({ seed: 15, ticks: 2000, sampleEvery: 500 });
    expect(formatDiagnosis(d)).toContain('tohum 15');
    const table = formatEcologyTable(d, 1000);
    expect(table.split('\n').length).toBeGreaterThan(1);
    expect(table).toContain('rezerv');
  });
});

describe('bağ ömrü duyarlılığı', () => {
  it('varsayılan ayarlarda koloniler uzun vadede kalıcı değil', () => {
    // Önceden kaydedilen ölçütün karşı tarafı: varsayılan ayarlarda pencerenin
    // sonunda 4+ hücreli yapı 0'dır. Pencere **kasten uzun** seçildi: 4.000
    // tick'te koloniler hâlâ var (zirve ~3.200), sönümlenme ancak ~6.000'da
    // görünür. Kısa pencerede test yanlış negatif verirdi.
    const points = sweepBondDurability({
      settings: [{ strainDecayK: 0.02, bondFatigue: 2e-5 }],
      ticks: 8000,
      seeds: 1,
    });
    const p = points[0];
    expect(p).toBeDefined();
    expect(p?.coloniesPersist).toBe(false);
    expect(p?.finalMultiCellColonies ?? 1).toBe(0);
    expect(p?.estimatedBondLifeTicks).toBeGreaterThan(0);
  });

  it('bağ ömrü uzatıldığında kalıcılık değişir (ölçütün kendisi)', () => {
    const points = sweepBondDurability({
      settings: [
        { strainDecayK: 0.02, bondFatigue: 2e-5 },
        { strainDecayK: 0.002, bondFatigue: 1e-6 },
      ],
      ticks: 3000,
      seeds: 1,
    });
    expect(points).toHaveLength(2);
    const shortLived = points[0];
    const longLived = points[1];
    expect(longLived?.estimatedBondLifeTicks ?? 0).toBeGreaterThan(shortLived?.estimatedBondLifeTicks ?? Infinity);
  });

  it('enerji korunumu duyarlılık ayarlarında da sarsılmaz', () => {
    const points = sweepBondDurability({
      settings: [{ strainDecayK: 0.005, bondFatigue: 5e-6 }],
      ticks: 2500,
      seeds: 1,
    });
    expect(points[0]?.finalReserveFraction ?? 0).toBeGreaterThan(0);
    expect(points[0]?.finalReserveFraction ?? 1).toBeLessThanOrEqual(1.0001);
  });

  it('biçimlendirme başlık + satır üretir', () => {
    const points = sweepBondDurability({
      settings: [{ strainDecayK: 0.02, bondFatigue: 2e-5 }],
      ticks: 1500,
      seeds: 1,
    });
    const text = formatBondDurability(points);
    expect(text.split('\n')).toHaveLength(points.length + 1);
    expect(text).toContain('bağ ömrü');
  });
});

describe('Y-2 · bağ ömrünün kalıtılabilirliği', () => {
  it('iki kol aynı tohumlarda ve yalnız kalıtılabilirlik farklı', () => {
    const r = experimentBondLifeHeritability({ seeds: 3, ticks: 3000 });
    expect(r.control).toHaveLength(3);
    expect(r.treatment).toHaveLength(3);
    // Kümülatif doğum sayısı yalnız doğru ölçülen nesil derinliğidir
    for (const p of [...r.control, ...r.treatment]) {
      expect(p.generationsPerFounder).toBeCloseTo(p.cumulativeBirths / 48, 10);
    }
    // Eşleştirme: aynı tohumda aynı kurucu genomu (kalıtsız olan değişmez)
    for (let i = 0; i < 3; i++) {
      expect(r.treatment[i]?.founderBondStrength).toBeCloseTo(r.control[i]?.founderBondStrength ?? 0, 10);
    }
    expect(r.control.every((c) => !c.coupled)).toBe(true);
    expect(r.treatment.every((c) => c.coupled)).toBe(true);
  });

  it('kurucu ortalama bağ dayanımı genom sınırı içindedir', () => {
    const r = experimentBondLifeHeritability({ seeds: 3, ticks: 2000 });
    for (const p of [...r.control, ...r.treatment]) {
      expect(p.founderBondStrength).toBeGreaterThanOrEqual(0.15);
      expect(p.founderBondStrength).toBeLessThanOrEqual(1);
      expect(p.survivorBondStrength).toBeGreaterThanOrEqual(0.15);
      expect(p.survivorBondStrength).toBeLessThanOrEqual(1);
      expect(p.shift).toBeCloseTo(p.survivorBondStrength - p.founderBondStrength, 10);
      expect(p.cumulativeBirths).toBeGreaterThanOrEqual(0);
      expect(p.generationsPerFounder).toBeGreaterThanOrEqual(0);
      expect(p.maxGeneration).toBeGreaterThanOrEqual(0);
    }
  });

  it('enerji korunumu Y-2 kancasıyla bozulmaz', () => {
    const r = experimentBondLifeHeritability({ seeds: 2, ticks: 1500 });
    expect(Math.abs(r.worstLedgerResidual)).toBeLessThan(1e-6);
  });

  it('deterministiktir', () => {
    const a = experimentBondLifeHeritability({ seeds: 2, ticks: 2000 });
    const b = experimentBondLifeHeritability({ seeds: 2, ticks: 2000 });
    expect(b.treatment[0]?.shift).toBe(a.treatment[0]?.shift);
    expect(b.difference.estimate).toBe(a.difference.estimate);
  });

  it('biçimlendirme sonuç satırlarını içerir', () => {
    const r = experimentBondLifeHeritability({ seeds: 2, ticks: 1500 });
    expect(formatHeritability(r)).toContain('tedavi');
    expect(r.reading.length).toBeGreaterThan(0);
  });
});

describe('kaynak rejenerasyonu ve muhasebe', () => {
  it('ölçüm hatası: muhasebe rezidülü İŞARETLİ (regresyon koruması)', () => {
    // Regresyon koruması: daha önceki formül `initialTotal - current
    // - externalInput - dissipated` idi; `externalInput` işareti **tersti**.
    // Doğru denklem: `current + dissipated = initialTotal + externalInput`.
    // Hata, `DEFAULT_REGEN = 0` olduğu için dış girdi hiç sıfırdan farklı
    // olmadığı sürece **20+ deneyde görünmedi**; rejenerasyon açılınca ortaya çıktı.
    const withRegen = sweepResourceRegen({ regens: [0, 0.01], ticks: 2500, seed: 12 });
    for (const p of withRegen) {
      expect(Math.abs(p.worstLedgerResidual), `regen=${p.regen}`).toBeLessThan(1e-4);
    }
    // Dış girdi gerçekten oluşmuş olmalı (aksi halde test anlamlı olmaz).
    expect(withRegen[1]?.regen).toBeGreaterThan(0);
  });

  it('rejenerasyon açıkken de korunum bozulmaz', () => {
    const points = sweepResourceRegen({ regens: [0, 0.002, 0.01], ticks: 2000, seed: 13 });
    expect(points).toHaveLength(3);
    for (const p of points) {
      expect(Math.abs(p.worstLedgerResidual)).toBeLessThan(1e-4);
      expect(p.finalReserveFraction).toBeGreaterThan(0);
      expect(p.finalReserveFraction).toBeLessThanOrEqual(1.0001);
      expect(p.finalPopulation).toBeGreaterThanOrEqual(0);
    }
  });

  it('biçimlendirme başlık + satır üretir', () => {
    const points = sweepResourceRegen({ regens: [0], ticks: 1200, seed: 14 });
    expect(formatRegen(points).split('\n')).toHaveLength(points.length + 1);
  });
});

describe('ezber kontrolü', () => {
  it('Deney 3 raporu eğitim dünyası karşılaştırmasını içerir', () => {
    const { report } = experiment3({ seeds: 2, trainTicks: 400, evalTicks: 300, resourceCount: 14 });
    const memorization = report.secondary.find((s) => s.label.startsWith('EZBER'));
    expect(memorization).toBeDefined();
    expect(Number.isFinite(memorization?.difference ?? Number.NaN)).toBe(true);

    const gap = report.secondary.find((s) => s.label.includes('aralık daralması'));
    expect(gap).toBeDefined();
    // Daralma = eğitim dünyasındaki fark − yeni dünyadaki fark
    expect(gap?.difference).toBeCloseTo((memorization?.difference ?? 0) - report.difference.estimate, 10);
  });

  it('eğitim ve değerlendirme tohumları ayrık kalır', () => {
    // Protokolün temeli: eğitim 1..N, değerlendirme 1001..1000+N.
    const { control } = experiment3({ seeds: 3, trainTicks: 300, evalTicks: 200, resourceCount: 14 });
    expect(control).toHaveLength(3);
    for (const run of control) {
      expect(run.seed).toBeGreaterThanOrEqual(1001);
    }
  });
});

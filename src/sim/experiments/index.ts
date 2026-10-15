/**
 * Cell to Mind — deney paketi (Faz A1/A2).
 *
 * Bu modül `docs/PROGRESS.md` §2'de listelenen deneyleri gerçek koşu
 * yüzeyine bağlar ve `docs/ROADMAP.md` Faz A'nın istatistik kurallarını
 * uygular:
 *
 *   - Her deney **eşleştirilmiş** (paired) tasarımla koşar: iki kol aynı
 *     başlangıç durumunu paylaşır, tek fark müdahale edilen değişkendir.
 *   - Raporlanan her şey bir **aralıktır**; eşik testi (`15/20 geçti`)
 *     kullanılmaz.
 *   - **Hiçbir koşu düşürülmez.** Başarısız/ölü koşular da `values` dizisinde
 *     kalır ve ayrıca özetlenir.
 *   - Bootstrap birimı **farktır** (treatment − control), ham kol ortalamaları
 *     değil. Bu, koşular arası ortak varyansı iptal eder.
 *   - Her deney enerji muhasebesi rezidüelini raporlar; rezidül sıfırdan
 *     farklıysa sonuç geçersizdir.
 *
 * Hipotezler ve analiz planı **rapordan önce** burada sabitlenmiştir;
 * sonuç ne olursa olsun değiştirilmez.
 */

import { MLP_SHAPE } from '../behavior/mlp.ts';
import { Rng } from '../rng.ts';
import {
  bootstrapCI,
  bootstrapTest,
  fmt,
  fmtInterval,
  quantile,
  stdDev,
  summarize,
  type HypothesisTest,
  type Interval,
  type Summary,
} from '../stats.ts';
import { World } from '../world.ts';
import { deserializeWorld, serializeWorld } from '../persistence/snapshot.ts';
import { runColony, type ColonyResult } from './colony.ts';
import { runTrial, type TrialResult } from './arena.ts';

// ------------------------------------------------------------------ rapor şekli

export type ExperimentId = 'exp1-bond-affinity' | 'exp2-evolution' | 'exp3-learning';

export interface ArmReport {
  label: string;
  summary: Summary;
  /** Bootstrap güven aralığı (ortalama için). */
  interval: Interval;
  /** Ham koşu değerleri — hiçbiri düşürülmez. */
  values: number[];
}

export interface ExperimentReport {
  id: ExperimentId;
  title: string;
  /** Deneyin sorduğu tek cümle. */
  question: string;
  /** Sonuçtan ÖNCE sabitlenen analiz planı. */
  protocol: string;
  /** Koşu başına örneklem büyüklüğü (n). */
  seeds: number;
  /** Birincil ölçüm. */
  metric: string;
  control: ArmReport;
  treatment: ArmReport;
  /** treatment − control farkının güven aralığı. */
  difference: Interval;
  test: HypothesisTest;
  /** Bu deneye özgü ek ölçümler (ikincil). */
  secondary: { label: string; control: number; treatment: number; difference: number }[];
  /** En büyük enerji muhasebesi rezidüelü (mutlak). */
  worstLedgerResidual: number;
  /** Deneyin yazılı kısıtları ve dürüstlük notları. */
  notes: string[];
  /** Bu deneyin gözlenen sonucu — otomatik değil, kurucu tarafından yazılır. */
  interpretation: string | null;
}

export interface InvariantCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ExperimentSuiteReport {
  generatedAt: number;
  tickMs: number;
  experiments: ExperimentReport[];
  invariants: InvariantCheck[];
  /** Toplam koşu sayısı. */
  totalRuns: number;
  totalWallMs: number;
}

// ------------------------------------------------------------------ yardımcılar

function armReport(label: string, values: number[], seed: number): ArmReport {
  return {
    label,
    summary: summarize(values),
    interval: bootstrapCI(values, { seed }),
    values,
  };
}

function worstResidual(results: readonly { ledgerResidual: number }[]): number {
  let worst = 0;
  for (const r of results) {
    if (Math.abs(r.ledgerResidual) > Math.abs(worst)) worst = r.ledgerResidual;
  }
  return worst;
}

/**
 * Rastgele taban örnekleri — **sabit referans**.
 *
 * ⚠️ Aramanın RNG akışından kesinlikle AYRI bir akıştan çizilir. Bu yardımcı
 * dışarıda çizilirse iki kol aynı tabanı paylaşır ve `generations: 0` geçerli
 * bir kontrol olur.
 */
export function baselineThetas(seed: number, count: number, n: number): Float64Array[] {
  const rng = new Rng(seed + 7919);
  const out: Float64Array[] = [];
  for (let i = 0; i < count; i++) {
    const t = new Float64Array(n);
    for (let p = 0; p < n; p++) t[p] = rng.normal();
    out.push(t);
  }
  return out;
}

function meanOf(values: readonly number[]): number {
  // Sonlu olmayan değerler ortalamaya katılmaz; ortalama, var olanların
  // ortalamasıdır. `-Infinity` sentinel'inin ortalamayı yuttuğu hatanın
  // genel hali — bkz. VALIDATION §10 satır 30.
  const ok = values.filter((v) => Number.isFinite(v));
  if (ok.length === 0) return Number.NaN;
  let sum = 0;
  for (const v of ok) sum += v;
  return sum / ok.length;
}

// --------------------------------------------------- Deney 1 · bağ gücü

/**
 * **Deney 1 — Bağ gücü kolonileri büyütüyor mu?**
 *
 * Tek müdahale: kurucu genomlarının `bondAffinity` değeri. Mutasyon kapalı
 * olduğu için bu değer soy boyunca birebir korunur ve müdahalenin etkisi
 * diğer hiçbir değişkenden arındırılamaz.
 *
 * Hipotez: güçlü bağ → daha büyük bağlı kümeler.
 */
export function experiment1(options?: { seeds?: number; ticks?: number }): {
  report: ExperimentReport;
  weak: ColonyResult[];
  strong: ColonyResult[];
} {
  const seeds = options?.seeds ?? 12;
  const ticks = options?.ticks ?? 3000;
  const seedList = Array.from({ length: seeds }, (_, i) => 101 + i);

  const weak: ColonyResult[] = [];
  const strong: ColonyResult[] = [];
  for (const seed of seedList) {
    weak.push(runColony({ seed, ticks, bondAffinityOverride: 0.05, mutationEnabled: false }));
    strong.push(runColony({ seed, ticks, bondAffinityOverride: 0.9, mutationEnabled: false }));
  }

  const controlValues = weak.map((r) => r.peakLargestColony);
  const treatmentValues = strong.map((r) => r.peakLargestColony);
  const differences = treatmentValues.map((v, i) => v - (controlValues[i] as number));

  const report: ExperimentReport = {
    id: 'exp1-bond-affinity',
    title: 'Bağ gücü koloni büyüklüğünü artırıyor mu?',
    question: 'Aynı dünyada, aynı tohumda, yalnız kurucuların bondAffinity değeri değiştiğinde bağlı küme daha büyük mü oluyor?',
    protocol:
      'Eşleştirilmiş tasarım. Aynı seed iki kolda kullanılır (aynı kaynak düzeni, aynı kaya düzeni, aynı başlangıç konumları). ' +
      'Tek fark: kurucu genomlarının bondAffinity değeri 0.05 ↔ 0.9. Mutasyon kapalı → değer soy boyunca birebir korunur. ' +
      'Birincil ölçüm: pencerede görülen en büyük bağlı küme. Farkın güven aralığı bootstrap ile hesaplanır.',
    seeds,
    metric: 'penceredeki en büyük bağlı küme (hücre)',
    control: armReport('bondAffinity = 0.05', controlValues, 101),
    treatment: armReport('bondAffinity = 0.90', treatmentValues, 102),
    difference: bootstrapCI(differences, { seed: 103 }),
    test: bootstrapTest(differences, { seed: 104 }),
    secondary: [
      {
        label: 'zirve 4+ hücreli yapı sayısı',
        control: meanOf(weak.map((r) => r.peakMultiCellColonies)),
        treatment: meanOf(strong.map((r) => r.peakMultiCellColonies)),
        difference: meanOf(strong.map((r) => r.peakMultiCellColonies)) - meanOf(weak.map((r) => r.peakMultiCellColonies)),
      },
      {
        label: 'pencere sonu popülasyon',
        control: meanOf(weak.map((r) => r.finalPopulation)),
        treatment: meanOf(strong.map((r) => r.finalPopulation)),
        difference: meanOf(strong.map((r) => r.finalPopulation)) - meanOf(weak.map((r) => r.finalPopulation)),
      },
      {
        label: 'pencere sonu bağ sayısı',
        control: meanOf(weak.map((r) => r.finalBondCount)),
        treatment: meanOf(strong.map((r) => r.finalBondCount)),
        difference: meanOf(strong.map((r) => r.finalBondCount)) - meanOf(weak.map((r) => r.finalBondCount)),
      },
    ],
    worstLedgerResidual: Math.max(
      Math.abs(worstResidual(weak)),
      Math.abs(worstResidual(strong)),
    ),
    notes: [
      '`bondAffinity` genetik bir parametredir; seçilim değeri değildir. Bu deney müdahale edilen bir parametrenin etkisini ölçer, seçilim gücünü değil.',
      '4+ hücreli eşik `C.MULTICELL_THRESHOLD` işletimsel bir ölçüttür; biyolojik bir tanım değildir.',
      'Her iki kolda da popülasyon aynı çekirdekten türer; fark yalnız bağ davranışından gelir.',
    ],
    interpretation: null,
  };

  return { report, weak, strong };
}

// --------------------------------------------------- Deney 2 · evrim

/**
 * **Deney 2 — Mutasyon + seçilim popülasyonu iyileştiriyor mu?**
 *
 * Tek müdahale: `mutationEnabled`. Kapalıyken çocuklar ebeveyn genomunun
 * tam kopyasını alır (donmuş popülasyon), açıkken mutasyonlu devralır.
 *
 * İkincil ölçüm, `genomeShift`, seçilimin genları **sistematik** olarak
 * kaydırıp kaydırmadığını gösterir. Kayma sıfıra yakınsa düzen yoktur —
 * bu bir başarısızlık değil, ölçülen bir yokluktur.
 */
export function experiment2(options?: { seeds?: number; ticks?: number }): {
  report: ExperimentReport;
  frozen: ColonyResult[];
  evolving: ColonyResult[];
} {
  const seeds = options?.seeds ?? 12;
  const ticks = options?.ticks ?? 4000;
  const seedList = Array.from({ length: seeds }, (_, i) => 201 + i);

  const frozen: ColonyResult[] = [];
  const evolving: ColonyResult[] = [];
  for (const seed of seedList) {
    frozen.push(runColony({ seed, ticks, mutationEnabled: false }));
    evolving.push(runColony({ seed, ticks, mutationEnabled: true }));
  }

  const controlValues = frozen.map((r) => r.finalMeanEnergyNorm);
  const treatmentValues = evolving.map((r) => r.finalMeanEnergyNorm);
  const differences = treatmentValues.map((v, i) => v - (controlValues[i] as number));

  const report: ExperimentReport = {
    id: 'exp2-evolution',
    title: 'Mutasyon + seçilim popülasyonu iyileştiriyor mu?',
    question: 'Aynı başlangıçtan, mutasyon açık olan popülasyon donmuş popülasyondan daha iyi besleniyor mu?',
    protocol:
      'Eşleştirilmiş tasarım. Aynı seed iki kolda kullanılır; tek fark mutationEnabled. ' +
      'Birincil ölçüm: pencerenin son tick değerindeki ortalama normalize enerji (ölü hücreler ortalama dâhil hesaplanır, yani ölüm cezadır). ' +
      'İkincil ölçüm `genomeShift`: kurucu ortalama genomu ile hayatta kalanların ortalama genomu arasındaki ortalama mutlak kayma.',
    seeds,
    metric: 'pencere sonu ortalama normalize enerji (ölüm cezalı)',
    control: armReport('mutationEnabled = false (donmuş)', controlValues, 201),
    treatment: armReport('mutationEnabled = true (evrilen)', treatmentValues, 202),
    difference: bootstrapCI(differences, { seed: 203 }),
    test: bootstrapTest(differences, { seed: 204 }),
    secondary: [
      {
        label: 'genom kayması (genomeShift)',
        control: meanOf(frozen.map((r) => r.genomeShift)),
        treatment: meanOf(evolving.map((r) => r.genomeShift)),
        difference: meanOf(evolving.map((r) => r.genomeShift)) - meanOf(frozen.map((r) => r.genomeShift)),
      },
      {
        label: 'zirve en büyük küme',
        control: meanOf(frozen.map((r) => r.peakLargestColony)),
        treatment: meanOf(evolving.map((r) => r.peakLargestColony)),
        difference: meanOf(evolving.map((r) => r.peakLargestColony)) - meanOf(frozen.map((r) => r.peakLargestColony)),
      },
      {
        label: 'pencere sonu 4+ hücreli yapı',
        control: meanOf(frozen.map((r) => r.finalMultiCellColonies)),
        treatment: meanOf(evolving.map((r) => r.finalMultiCellColonies)),
        difference: meanOf(evolving.map((r) => r.finalMultiCellColonies)) - meanOf(frozen.map((r) => r.finalMultiCellColonies)),
      },
      {
        label: 'ulaşılan en yüksek nesil',
        control: meanOf(frozen.map((r) => r.maxGeneration)),
        treatment: meanOf(evolving.map((r) => r.maxGeneration)),
        difference: meanOf(evolving.map((r) => r.maxGeneration)) - meanOf(frozen.map((r) => r.maxGeneration)),
      },
    ],
    worstLedgerResidual: Math.max(
      Math.abs(worstResidual(frozen)),
      Math.abs(worstResidual(evolving)),
    ),
    notes: [
      'Bu deney **genetik uyarlanmanın dolaylı** bir ölçüsüdür: doğrudan "torun, atadan daha mı iyi" sorusu değil, mutasyonlu devralmanın popülasyon durumu iyileştirip iyileştirmediğini ölçer.',
      'Nesil sayısı artışı tek başına uyarlanma kanıtı değildir; aynı zamanda çoğalma hızının artışı olabilir. `genomeShift` buna karşı bir kontrol sağlar.',
      'Seçilim baskısı tasarımcının koyduğu bir avcı ve yoğunluk geri beslemesiyle uygulanır; rastgele yürüyüş değil.',
    ],
    interpretation: null,
  };

  return { report, frozen, evolving };
}

// --------------------------------------------------- Deney 3 · öğrenme

/**
 * **Deney 3 — Yaşam içi öğrenme politikayı iyileştiriyor mu?**
 *
 * Protokol (eğitim/değerlendirme tohumları **ayrıdır**, bu ayrım sonuçtan
 * önce sabitlenmiştir):
 *
 *   1. **Eğitim:** tohum 1..N'de, öğrenme AÇIK, T_eğitim tick koşulur.
 *      Koşu sonundaki `thetaLive` saklanır.
 *   2. **Değerlendirme:** tohum 1001..1000+N'de, öğrenme KAPALI iki kol koşar:
 *        - kontrol  → o değerlendirme dünyasının kendi rastgele başlangıç ağı
 *        - tedavi   → eğitilmiş politika (indeksle eşleştirilmiş)
 *      Aynı seed → aynı kaynak düzeni ve aynı başlangıç konumu.
 *      Değerlendirmede öğrenme kapalı olduğu için iki kol arasındaki tek
 *      fark ağırlıklardır.
 *   3. Eşleştirilmiş farklar (tedavi − kontrol) üzerinden bootstrap.
 *
 * Bu tasarımın gücü: değerlendirme dünyaları eğitimde **hiç görülmedi**.
 * Dolayısıyla sonuç "ezber" değil "genelleşen politika" hakkındadır.
 */
export function experiment3(options?: {
  seeds?: number;
  trainTicks?: number;
  evalTicks?: number;
  resourceCount?: number;
}): { report: ExperimentReport; train: TrialResult[]; control: TrialResult[]; treatment: TrialResult[] } {
  const seeds = options?.seeds ?? 20;
  const trainTicks = options?.trainTicks ?? 6000;
  const evalTicks = options?.evalTicks ?? 4000;
  const resourceCount = options?.resourceCount ?? 34;
  const EVAL_SEED_BASE = 1001;

  // 1) Eğitim
  const train: TrialResult[] = [];
  for (let i = 0; i < seeds; i++) {
    train.push(
      runTrial({ seed: 1 + i, ticks: trainTicks, learning: true, resourceCount, sampleEvery: 0 }),
    );
  }

  // 2) Değerlendirme (iki kol, aynı dünya, öğrenme kapalı)
  const control: TrialResult[] = [];
  const treatment: TrialResult[] = [];
  // 2b) **Ezber kontrolü.** Aynı protokol, ama eğitimin yapıldığı dünyada.
  // Eğitim dünyasında fark büyük, yeni dünyada küçükse sonuç genelleşme
  // değil ezberdir. İkisi de küçükse 9 gradyan adımı hiçbir şey öğretmemiştir.
  const trainEnvControl: TrialResult[] = [];
  const trainEnvTreatment: TrialResult[] = [];
  for (let i = 0; i < seeds; i++) {
    const evalSeed = EVAL_SEED_BASE + i;
    control.push(
      runTrial({ seed: evalSeed, ticks: evalTicks, learning: false, resourceCount, sampleEvery: 0 }),
    );
    treatment.push(
      runTrial({
        seed: evalSeed,
        ticks: evalTicks,
        learning: false,
        resourceCount,
        theta: train[i]?.thetaFinal,
        sampleEvery: 0,
      }),
    );
    const trainSeed = 1 + i;
    trainEnvControl.push(
      runTrial({ seed: trainSeed, ticks: evalTicks, learning: false, resourceCount, sampleEvery: 0 }),
    );
    trainEnvTreatment.push(
      runTrial({
        seed: trainSeed,
        ticks: evalTicks,
        learning: false,
        resourceCount,
        theta: train[i]?.thetaFinal,
        sampleEvery: 0,
      }),
    );
  }

  const trainEnvDifferences = trainEnvTreatment.map((v, i) => v.meanEnergyNorm - (trainEnvControl[i]?.meanEnergyNorm ?? 0));

  const controlValues = control.map((r) => r.meanEnergyNorm);
  const treatmentValues = treatment.map((r) => r.meanEnergyNorm);
  const differences = treatmentValues.map((v, i) => v - (controlValues[i] as number));

  const report: ExperimentReport = {
    id: 'exp3-learning',
    title: 'Yaşam içi öğrenme politikayı iyileştiriyor mu?',
    question: 'Eğitim tohumlarında öğrenmiş politika, hiç görülmemiş değerlendirme dünyalarında rastgele başlangıç ağından daha mı iyi besleniyor?',
    protocol:
      'Eğitim tohumları 1..N, değerlendirme tohumları 1001..1000+N — kümeler ayrık ve bu ayrım sonuçtan önce sabitlendi. ' +
      'Eğitimde öğrenme açık; değerlendirmede öğrenme KAPALI, böylece iki kol arasındaki tek fark ağırlıklardır. ' +
      'Birincil ölçüm: penceredeki ortalama normalize enerji (ölümden sonra katkı 0). ' +
      'Analiz: indeksle eşleştirilmiş farklar üzerinde yüzdelik bootstrap güven aralığı ve bootstrap hipotez testi.',
    seeds,
    metric: 'değerlendirme penceresinde ortalama normalize enerji',
    control: armReport('rastgele başlangıç ağı (öğrenme kapalı)', controlValues, 301),
    treatment: armReport('eğitilmiş politika (öğrenme kapalı)', treatmentValues, 302),
    difference: bootstrapCI(differences, { seed: 303 }),
    test: bootstrapTest(differences, { seed: 304 }),
    secondary: [
      {
        label: 'kontrol kolunun headroom u (1 − kontrol skoru)',
        control: 1 - meanOf(control.map((r) => r.meanEnergyNorm)),
        treatment: meanOf(treatment.map((r) => r.meanEnergyNorm)),
        difference: meanOf(treatment.map((r) => r.meanEnergyNorm)) - meanOf(control.map((r) => r.meanEnergyNorm)),
      },
      {
        label: 'EZBER KONTROLÜ — eğitim dünyasındaki fark',
        control: meanOf(trainEnvControl.map((r) => r.meanEnergyNorm)),
        treatment: meanOf(trainEnvTreatment.map((r) => r.meanEnergyNorm)),
        difference: meanOf(trainEnvDifferences),
      },
      {
        label: 'ezber farkı − genelleşme farkı (aralık daralması)',
        control: meanOf(trainEnvDifferences),
        treatment: meanOf(differences),
        difference: meanOf(trainEnvDifferences) - meanOf(differences),
      },
      {
        label: 'ölçüm penceresi sonuna kadar yaşama oranı',
        control: meanOf(control.map((r) => (r.survivedToEnd ? 1 : 0))),
        treatment: meanOf(treatment.map((r) => (r.survivedToEnd ? 1 : 0))),
        difference: meanOf(treatment.map((r) => (r.survivedToEnd ? 1 : 0))) - meanOf(control.map((r) => (r.survivedToEnd ? 1 : 0))),
      },
      {
        label: 'eğitimde ortalama politika güncellemesi',
        control: 0,
        treatment: meanOf(train.map((r) => r.learningUpdates)),
        difference: meanOf(train.map((r) => r.learningUpdates)),
      },
      {
        label: 'eğitimde ağırlıkların ne kadar kaydığı (‖Δθ‖)',
        control: 0,
        treatment: meanOf(train.map((r) => r.learnedDeltaNorm)),
        difference: meanOf(train.map((r) => r.learnedDeltaNorm)),
      },
      {
        label: 'eğitim koşularında hayatta kalma oranı',
        control: 0,
        treatment: meanOf(train.map((r) => (r.survivedToEnd ? 1 : 0))),
        difference: meanOf(train.map((r) => (r.survivedToEnd ? 1 : 0))),
      },
    ],
    worstLedgerResidual: Math.max(
      Math.abs(worstResidual(control)),
      Math.abs(worstResidual(treatment)),
      Math.abs(worstResidual(train)),
    ),
    notes: [
      'Değerlendirmede öğrenme kapalıdır; bu, ölçtüğümüz şeyin "öğrenme" değil **"öğrenmenin ürettiği politika"** olmasını sağlar.',
      'Kontrol kolu, değerlendirme dünyasının kendi rastgele başlangıç ağıdır — yani "hiç eğitim almamış rastgele politika" taban çizgisidir.',
      'REINFORCE + sabit sonlu ufuk (bootstrap yok, γ=0.95) kullanılır; bkz. `docs/MODEL.md` §4. Yüksek varyans beklenir.',
      'Bu deneyin sonucu **olumlu olmak zorunda değildir**. p ≥ 0.05 çıkarsa bulgu "bu koşullarda ölçülebilir bir iyileşme yok"; bulgudur.',
      'Eğitim ve değerlendirme tohum kümeleri ayrık olduğu için sonuç ezber değil **genelleşme** ölçüsüdür.',
    ],
    interpretation: null,
  };

  return { report, train, control, treatment };
}

// --------------------------------------------------- zorluk kalibrasyonu

export interface DifficultyPoint {
  resourceCount: number;
  /** Rastgele politikanın (öğrenmesiz) ortalama normalize enerjisi. */
  controlMean: number;
  /** Tam doygunluk (1.0) ile rastgele politika arasındaki ölçüm headroom'u. */
  headroom: number;
  /** Bu zorlukta pencerenin sonuna kadar yaşama oranı. */
  survivalRate: number;
}

/**
 * Arena zorluk kalibrasyonu — **headroom ölçümü**.
 *
 * Neden gerekiyor: öğrenme deneyi ancak rastgele politikanın tam performans
 * almadığı bir ortamda bilgi taşır. Kontrol kolu zaten 0.9'a yakınsa
 * ölçüm tavana yapışır ve iyileşme görünmez — bu, "öğrenme işe yaramıyor"
 * demek **değildir**, "ölçecek yer kalmadı" demektir.
 *
 * Bu yüzden zorluk ekseni (kaynak sayısı) taranır ve headroom eğrisi raporlanır.
 * Deneyler **tüm eğriyi** raporlar; yalnızca elverişli nokta seçilmez.
 */
export function calibrateArena(options?: {
  resourceCounts?: number[];
  seeds?: number;
  ticks?: number;
}): DifficultyPoint[] {
  const resourceCounts = options?.resourceCounts ?? [4, 8, 14, 22, 34];
  const seeds = options?.seeds ?? 8;
  const ticks = options?.ticks ?? 4000;

  return resourceCounts.map((resourceCount) => {
    const runs: TrialResult[] = [];
    for (let i = 0; i < seeds; i++) {
      runs.push(
        runTrial({
          seed: 2001 + i,
          ticks,
          learning: false,
          resourceCount,
          sampleEvery: 0,
        }),
      );
    }
    const controlMean = meanOf(runs.map((r) => r.meanEnergyNorm));
    const survivalRate = meanOf(runs.map((r) => (r.survivedToEnd ? 1 : 0)));
    return { resourceCount, controlMean, headroom: Math.max(0, 1 - controlMean), survivalRate };
  });
}

export function formatDifficulty(curve: readonly DifficultyPoint[]): string {
  return curve
    .map((p) => `  kaynak=${String(p.resourceCount).padStart(2)} → kontrol ${fmt(p.controlMean, 3)} · headroom ${fmt(p.headroom, 3)} · hayatta kalma ${fmt(p.survivalRate * 100, 0)}%`)
    .join('\n');
}

// --------------------------------------------------- öğrenme zorluk taraması

export interface LearningSweepPoint {
  resourceCount: number;
  /** Kontrol kolunun headroom'u (1 − kontrol skoru). */
  headroom: number;
  control: number;
  treatment: number;
  difference: Interval;
  pValue: number;
  probabilityOfImprovement: number;
  /** Eğitimde politikanın aldığı gradyan adımı sayısı. */
  learningUpdates: number;
  /** Eğitim koşularının hayatta kalma oranı. */
  trainSurvival: number;
  /** Ezber kontrolü: eğitim dünyasındaki fark. */
  trainEnvDifference: number;
  /** Eğitim koşularında ağırlıkların ortalama kaydığı (‖Δθ‖). */
  trainWeightShift: number;
}

/**
 * Öğrenme deneyini **zorluk ekseninde** tarar.
 *
 * Bu, "hangi değişikliği yapalım" sorusunu tahminle değil ölçümle yanıtlamak
 * içindir. Varsayılan habitatta (34 kaynak) headroom 0.072 olduğu için deney
 * ölçemiyordu; soru şuydu: **headroom açıldığında öğrenme etkisi beliriyor mu?**
 *
 * Her zorlukta **tam protokol** koşar (ayrık eğitim/değerlendirme tohumları,
 * eşleştirilmiş fark, bootstrap aralığı). Tüm eğri raporlanır — yalnız
 * elverişli nokta seçilmez. Bu, Goodhart tuzağına karşı önceden kaydedilmiş
 * bir tarama prosedürüdür.
 */
export function sweepLearning(options?: {
  resourceCounts?: number[];
  seeds?: number;
  trainTicks?: number;
  evalTicks?: number;
}): LearningSweepPoint[] {
  const resourceCounts = options?.resourceCounts ?? [4, 8, 14, 22, 34];
  const seeds = options?.seeds ?? 12;
  const trainTicks = options?.trainTicks ?? 6000;
  const evalTicks = options?.evalTicks ?? 4000;

  return resourceCounts.map((resourceCount) => {
    const { report, control, treatment, train } = experiment3({
      seeds,
      trainTicks,
      evalTicks,
      resourceCount,
    });
    const controlMean = meanOf(control.map((r) => r.meanEnergyNorm));
    const trainEnvDifference =
      (report.secondary.find((s) => s.label.startsWith('EZBER'))?.difference) ?? Number.NaN;
    return {
      resourceCount,
      headroom: Math.max(0, 1 - controlMean),
      control: controlMean,
      treatment: meanOf(treatment.map((r) => r.meanEnergyNorm)),
      difference: report.difference,
      pValue: report.test.pValue,
      probabilityOfImprovement: report.test.probabilityOfImprovement,
      learningUpdates: meanOf(train.map((r) => r.learningUpdates)),
      trainWeightShift: meanOf(train.map((r) => r.learnedDeltaNorm)),
      trainSurvival: meanOf(train.map((r) => (r.survivedToEnd ? 1 : 0))),
      trainEnvDifference,
    };
  });
}

export function formatLearningSweep(curve: readonly LearningSweepPoint[]): string {
  const header =
    '  kaynak  headroom   kontrol    tedavi     fark [95% CI]        p      iyileşme  günc.  ‖Δθ‖_eğt  ezber';
  const rows = curve.map((p) => {
    const ci = `[${fmt(p.difference.lower, 3)}, ${fmt(p.difference.upper, 3)}]`.padEnd(18);
    return (
      `  ${String(p.resourceCount).padStart(5)}  ${fmt(p.headroom, 6)}  ${fmt(p.control, 8)}  ${fmt(p.treatment, 8)}  ` +
      `${ci} ${fmt(p.pValue, 6)}  ${fmt(p.probabilityOfImprovement * 100, 6)}%  ${fmt(p.learningUpdates, 4)}  ` +
      `${fmt(p.trainWeightShift, 8)}  ${fmt(p.trainEnvDifference, 6)}`
    );
  });
  return [header, ...rows].join('\n');
}

// --------------------------------------------------- öğrenme sinyali duyarlılığı

export interface SignalPoint {
  trajectoryLimit: number;
  learnRate: number;
  /** Eğitimde tamamlanan gradyan adımı. */
  updates: number;
  /** Eğitimde ağırlıkların ortalama L2 kayması. */
  weightShift: number;
  /** Değerlendirmede ölçülen davranış farkı (tedavi − kontrol). */
  difference: Interval;
  pValue: number;
  probabilityOfImprovement: number;
  /** Eğitim dünyasındaki fark — ezber kontrolü. */
  trainEnvDifference: number;
}

/**
 * **Öğrenme sinyali duyarlılık analizi.**
 *
 * Soru: ölçülen davranış etkisizliği **ağır bir görevden** mi, yoksa
 * **çok küçük bir ağırlık hareketinden** mi kaynaklanıyor?
 *
 * §4.5'te ölçülen: 6.000 tick'te 9 güncelleme ve ‖Δθ‖ = 0.003. Bu tarama,
 * güncelleme sıklığını ve adım büyüklüğünü ayrı ayrı değiştirerek
 * **ağırlık hareketinin hangi büyüklükte davranışa yansımaya başladığını**
 * ölçer. Yani "ne yapmak gerekir" sorusuna tahminle değil ölçümle yanıt verir.
 *
 * Bu bir **duyarlılık analizi**, bir ürün kararı değildir: model sabitlerinin
 * varsayılanları değişmez, oyun etkilenmez.
 */
export function sweepLearningSignal(options?: {
  trajectoryLimits?: number[];
  learnRates?: number[];
  seeds?: number;
  trainTicks?: number;
  evalTicks?: number;
  resourceCount?: number;
}): SignalPoint[] {
  const trajectoryLimits = options?.trajectoryLimits ?? [64, 16, 8];
  const learnRates = options?.learnRates ?? [0.02, 0.1, 0.5];
  const seeds = options?.seeds ?? 8;
  const trainTicks = options?.trainTicks ?? 6000;
  const evalTicks = options?.evalTicks ?? 4000;
  const resourceCount = options?.resourceCount ?? 14;
  const EVAL_SEED_BASE = 1001;

  const points: SignalPoint[] = [];
  for (const trajectoryLimit of trajectoryLimits) {
    for (const learnRate of learnRates) {
      const train: TrialResult[] = [];
      for (let i = 0; i < seeds; i++) {
        train.push(
          runTrial({
            seed: 1 + i,
            ticks: trainTicks,
            learning: true,
            resourceCount,
            trajectoryLimit,
            learnRate,
            sampleEvery: 0,
          }),
        );
      }
      const control: TrialResult[] = [];
      const treatment: TrialResult[] = [];
      const trainEnv: TrialResult[] = [];
      for (let i = 0; i < seeds; i++) {
        const evalSeed = EVAL_SEED_BASE + i;
        control.push(runTrial({ seed: evalSeed, ticks: evalTicks, learning: false, resourceCount, sampleEvery: 0 }));
        treatment.push(
          runTrial({
            seed: evalSeed,
            ticks: evalTicks,
            learning: false,
            resourceCount,
            theta: train[i]?.thetaFinal,
            sampleEvery: 0,
          }),
        );
        trainEnv.push(
          runTrial({
            seed: 1 + i,
            ticks: evalTicks,
            learning: false,
            resourceCount,
            theta: train[i]?.thetaFinal,
            sampleEvery: 0,
          }),
        );
      }
      const diffs = treatment.map((v, i) => v.meanEnergyNorm - (control[i]?.meanEnergyNorm ?? 0));
      const test = bootstrapTest(diffs, { seed: 900 + trajectoryLimit + Math.round(learnRate * 100) });
      points.push({
        trajectoryLimit,
        learnRate,
        updates: meanOf(train.map((r) => r.learningUpdates)),
        weightShift: meanOf(train.map((r) => r.learnedDeltaNorm)),
        difference: bootstrapCI(diffs, { seed: 800 + trajectoryLimit + Math.round(learnRate * 100) }),
        pValue: test.pValue,
        probabilityOfImprovement: test.probabilityOfImprovement,
        trainEnvDifference: meanOf(
          trainEnv.map((v) => v.meanEnergyNorm - meanOf(control.map((r) => r.meanEnergyNorm))),
        ),
      });
    }
  }
  return points;
}

export function formatSignalSweep(points: readonly SignalPoint[]): string {
  const header = '  ufuk  lr      günc.     ‖Δθ‖      fark [95% CI]           p       iyileşme  ezber';
  const rows = points.map((p) => {
    const ci = `[${fmt(p.difference.lower, 3)}, ${fmt(p.difference.upper, 3)}]`.padEnd(21);
    return (
      `  ${String(p.trajectoryLimit).padStart(4)}  ${fmt(p.learnRate, 6)}  ${fmt(p.updates, 6)}  ` +
      `${fmt(p.weightShift, 8)}  ${ci} ${fmt(p.pValue, 6)}  ${fmt(p.probabilityOfImprovement * 100, 6)}%  ${fmt(p.trainEnvDifference, 5)}`
    );
  });
  return [header, ...rows].join('\n');
}

// --------------------------------------------------- politika uzayı araştırması

export interface PolicySpaceSurvey {
  resourceCount: number;
  /** Kaç rastgele politika örneklendi. */
  sampled: number;
  /** Rastgele politikaların skoru — eğitimsiz taban çizgisi dağılımı. */
  random: {
    min: number;
    q25: number;
    median: number;
    q75: number;
    max: number;
    mean: number;
  };
  /** En iyi ortalama skor — "bir şey öğrenilebilir mi" üst sınırı göstergesi. */
  bestRandom: number;
  /**
   * Rastgele politikaların ortalama puanı ile en iyi %10'unun ortalaması arasındaki
   * fark. **Sıfırsa rastgele seçimle bile daha iyi davranışa ulaşılabiliyor
   * demektir**, yani öğrenmenin üst sınırı vardır. Sıfıra yakınsa politika
   * sınıfı zaten tıkanmıştır ve öğrenmenin kazancı yapısal olarak sınırlıdır.
   */
  learnableGap: number;
}

/**
 * Rastgele politika uzayını örnekler — **öğrenmenin üst sınırını** ölçer.
 *
 * Neden gerekiyor: Deney 3 "öğrenme işe yaramıyor" dediğinde iki açıklama
 * yarışıyordu:
 *   (a) politika **öğrenemiyor** (sinyal sorunu), ya da
 *   (b) politika sınıfı **zaten tıkanmış** — daha iyi bir davranış yok.
 * (b) doğruysa öğrenmeyi düzeltmenin hiçbir yolu yoktur ve harcanan çaba
 * yanlış yere gider. Bu ölçüm bu ikisini ayırır.
 *
 * Rastgele (eğitimsiz) başlangıç politikalarının skor dağılımı, politikaların
 * ulaşabildiği davranış aralığını verir. **Sıfırlık değil, yayılım** önemlidir.
 */
export function surveyPolicySpace(options?: {
  resourceCount?: number;
  samples?: number;
  ticks?: number;
  seedBase?: number;
}): PolicySpaceSurvey {
  const resourceCount = options?.resourceCount ?? 14;
  const samples = options?.samples ?? 120;
  const ticks = options?.ticks ?? 4000;
  const seedBase = options?.seedBase ?? 3001;

  const scores: number[] = [];
  for (let i = 0; i < samples; i++) {
    // Her örnek farklı bir dünya tohumu → farklı başlangıç ağı.
    // Değerlendirmede öğrenme kapalı: saf politika uzayı örnekleniyor.
    scores.push(
      runTrial({
        seed: seedBase + i,
        ticks,
        learning: false,
        resourceCount,
        sampleEvery: 0,
      }).meanEnergyNorm,
    );
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const topDecileCount = Math.max(1, Math.round(samples * 0.1));
  const topSlice = sorted.slice(sorted.length - topDecileCount);

  return {
    resourceCount,
    sampled: samples,
    random: {
      min: sorted[0] as number,
      q25: quantile(sorted, 0.25),
      median: quantile(sorted, 0.5),
      q75: quantile(sorted, 0.75),
      max: sorted[sorted.length - 1] as number,
      mean: meanOf(sorted),
    },
    bestRandom: sorted[sorted.length - 1] as number,
    learnableGap: meanOf(topSlice) - meanOf(sorted),
  };
}

export function formatPolicySurvey(s: PolicySpaceSurvey): string {
  const r = s.random;
  return [
    `  kaynak=${s.resourceCount} · n=${s.sampled} rastgele politika`,
    `    min ${fmt(r.min, 3)} · q25 ${fmt(r.q25, 3)} · medyan ${fmt(r.median, 3)} · q75 ${fmt(r.q75, 3)} · maks ${fmt(r.max, 3)} · ortalama ${fmt(r.mean, 3)}`,
    `    en iyi %10 ortalaması − genel ortalama = öğrenilebilir açıklık: ${fmt(s.learnableGap, 3)}`,
  ].join('\n');
}

// --------------------------------------------------- evrimsel politika araması

export interface EvolutionPoint {
  generation: number;
  /** Nesildeki en iyi bireyin ortalama skoru. */
  best: number;
  /** Nesildeki tüm bireylerin ortalama skoru. */
  mean: number;
  /** Nesildeki bireylerin skoru (deterministik sıralı). */
  scores: number[];
}

export interface EvolutionResult {
  generations: number;
  population: number;
  offspringPerParent: number;
  /** Eğitim tohumlarındaki en iyi skor. */
  trainBest: number;
  /** Rastgele politikaların eğitim tohumlarındaki ortalaması (seçimsiz taban). */
  randomBaselineMean: number;
  /**
   * Rastgele politikaların eğitim tohumlarındaki **en iyisi** (eşleşen taban).
   *
   * ⚠️ Arama bir MAKSİMUM döndürüyor; arama ile karşılaştırılan taban da
   * maksimum olmalı, yoksa kazanç yapısal olarak şişer. ÖLÇÜLDÜ
   * (`generations: 0`, yani arama hiç çalışmadı): ortalamaya karşı kazanç
   * **+21,286** — sırf en büyüğün ortalamadan büyük olmasıyla. Bu bir
   * başarı değil, seçim artefaktıdır.
   */
  randomBaselineMax: number;
  /** Kaç rastgele taban örneği organizmayı öldürdü (ölüm oranı). */
  randomBaselineDeaths: number;
  /** Rastgele taban örneği sayısı. */
  randomBaselineN: number;
  /** **Hiç görülmemiş** değerlendirme tohumlarındaki en iyi skor. */
  evalBest: number;
  /** Değerlendirmedeki rastgele taban çizgi ortalaması (yalnız bilgi için). */
  evalBaselineMean: number;
  /**
   * Değerlendirmedeki rastgele taban çizginin **en iyisi** — kazanç BUNA
   * karşı hesaplanır.
   *
   * ⚠️ Arama MAKSİMUM döndürüyor. Ortalamayla karşılaştırıldığında kazanç
   * yapısal olarak şişer: "binlerce adayın en iyisi" ile "birkaç rastgele
   * örneğin ortalaması" aynı şey değildir. Aynı düzeltme evrimsel-arama
   * deneyinde de yapıldı; burada atlanmıştı.
   */
  evalBaselineMax: number;
  /** Aramanın taban çizginin üstüne kazandırdığı miktar. */
  gainOverRandom: number;
  /** Bulunan politikanın ağırlıkları. */
  bestTheta: Float64Array;
  history: EvolutionPoint[];
}

/**
 * Ağırlık uzayında doğrudan evrimsel arama — (μ+λ) seçilimli elitist arama.
 *
 * **Neden:** §4.8 politika sınıfında 0.118'lik öğrenilebilir açıklık olduğunu
 * ölçtü, ama §4.5–4.7 yaşam içi REINFORCE'ın bu açıklığa **ulaşamadığını**
 * gösterdi. Buradaki soru ayırıcıdır: bu açılık **arayla** bulunabiliyor mu?
 *
 *  - Bulunabiliyorsa → RL'in kusuru kanıtlanmış olur; sorun öğrenme algoritması.
 *  - Bulunamıyorsa → görev evrimsel olarak da zordur; sorun görev/algı.
 *
 * Literatürdeki karşılığı Gupta vd. (2021, DERL): "evrim mi öğrenme mi"
 * karşılaştırması. Aynı arena, aynı ölçüm, aynı tohum ayrımı kullanılır —
 * tek fark arama yöntemi. Böylece karşılaştrma adil.
 *
 * **Protokol eşleşmesi:** evrim de REINFORCE gibi *ayrık* tohumlarda çalışır.
 * Evrim 1..N (eğitim) tohumlarında arar, bulunan politika 1001..1000+N
 * (değerlendirme) tohumlarında ölçülür. Bu yüzden karşılaştırma
 * "ezber vs genelleşme" açısından da denktir.
 */
export function evolvePolicy(options?: {
  generations?: number;
  population?: number;
  offspring?: number;
  mutationSigma?: number;
  trainSeeds?: number;
  trainTicks?: number;
  evalTicks?: number;
  resourceCount?: number;
  seedBase?: number;
  /**
   * Uygunluk işlevi geçersiz kılması.
   *
   * Varsayılan: her politikayı **temiz arena koşularında** değerlendirir
   * (tek birey, kaynak kısıtlı). Canlı dünyanın bir dalında çalıştırmak
   * istendiğinde verilir; seçim, mutasyon ve geçmiş mantığı aynen korunur.
   * S-3 ölçümü bunu kullanır (`VALIDATION.md` §6.14).
   */
  evaluate?: (theta: Float64Array) => number;
  /** Rastgele taban çizgi ölçümü (yalnızca `evaluate` verilirse kullanılır). */
  evaluateBaseline?: (theta: Float64Array) => number;
  /**
   * Başlangıç popülasyonu: verilen politikayı **çevirmez**, havuza ekler.
   * Evrim Atölyesi seçili organizmanın mevcut politikasını iyileştirmek için
   * kullanır — rastgele başlamak yerine mevcut davranışın üstüne kurar.
   */
  initialThetas?: Float64Array[];
  /** Nesil nesil ilerleme bildirimi (panelde canlı eğri için). */
  onGeneration?: (generation: number, best: number, mean: number) => void;
}): EvolutionResult {
  const generations = options?.generations ?? 20;
  const population = options?.population ?? 8;
  const offspringPerParent = options?.offspring ?? 3;
  const mutationSigma = options?.mutationSigma ?? 0.12;
  const trainSeeds = options?.trainSeeds ?? 4;
  const trainTicks = options?.trainTicks ?? 4000;
  const evalTicks = options?.evalTicks ?? 4000;
  const resourceCount = options?.resourceCount ?? 14;
  const seedBase = options?.seedBase ?? 4001;
  const EVAL_SEED_BASE = 1001;
  const N = 140;

  /** Bir politikayı verilen tohum kümesinde ortalama skorla. */
  const scoreDefault = (theta: Float64Array, seedStart: number, count: number, ticks: number): number => {
    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += runTrial({
        seed: seedStart + i,
        ticks,
        learning: false,
        resourceCount,
        theta,
        sampleEvery: 0,
      }).meanEnergyNorm;
    }
    return sum / count;
  };

  // Dışarıdan verilen değerlendirici varsa o geçerli, yoksa temiz arena.
  const score = options?.evaluate
    ? (_theta: Float64Array, _seedStart: number, _count: number, _ticks: number) =>
        (options.evaluate as (t: Float64Array) => number)(_theta)
    : scoreDefault;

  // Arama için **ayrı** bir akış: dünya akışlarından (env/inherit/action)
  // bağımsız olmalı, yoksa mutasyon gürültüsü dünya tohumuyla ilişkili olur.
  const search = new Rng(seedBase);
  const randomTheta = (): Float64Array => {
    const t = new Float64Array(N);
    for (let p = 0; p < N; p++) t[p] = search.normal();
    return t;
  };

  // Başlangıç popülasyonu: verilen politikalar (varsa) + rastgele tamamlayıcılar.
  const thetaPool: Float64Array[] = (options?.initialThetas ?? []).map((t) => Float64Array.from(t));
  for (let i = thetaPool.length; i < population; i++) {
    thetaPool.push(randomTheta());
  }

  const history: EvolutionPoint[] = [];
  for (let g = 0; g < generations; g++) {
    // (μ+λ): havuz sabit boyutta kalır. Seçimsiz üretim havuzu üstel büyütür
    // ve arama, bütçeyi değerlendirmeye harcar.
    const offspringPool: Float64Array[] = [];
    for (const parent of thetaPool) {
      for (let c = 0; c < offspringPerParent; c++) {
        const child = new Float64Array(parent);
        for (let p = 0; p < N; p++) {
          // Ağırlık uzayında Gauss mutasyonu. Tek bir optimum değil bir yelpaze
          // arandığı için ölçek, nesil ilerledikçe daraltılmaz.
          child[p] = (child[p] as number) + mutationSigma * search.normal();
        }
        offspringPool.push(child);
      }
    }

    const candidates = [...thetaPool, ...offspringPool];
    const scores = candidates.map((t) => score(t, seedBase, trainSeeds, trainTicks));
    const order = scores.map((sc, i) => [sc, i] as const).sort((a, b) => b[0] - a[0]);

    history.push({
      generation: g,
      best: order[0]?.[0] ?? Number.NaN,
      mean: meanOf(scores),
      scores: order.map(([sc]) => sc),
    });
    options?.onGeneration?.(g, history[history.length - 1]?.best ?? Number.NaN, meanOf(scores));

    // Elitizm: en iyi `population` birey korunur, geri kalanı atılır.
    thetaPool.length = 0;
    for (let i = 0; i < population && i < order.length; i++) {
      thetaPool.push(candidates[order[i]?.[1] ?? 0] as Float64Array);
    }
  }

  // Son nesilen en iyisini seç.
  const finalScores = thetaPool.map((t) => score(t, seedBase, trainSeeds, trainTicks));
  const finalBestIdx = finalScores.reduce((best, s, i) => (s > (finalScores[best] as number) ? i : best), 0);
  const bestTheta = thetaPool[finalBestIdx] as Float64Array;

  // Değerlendirme: hiç görülmemiş tohumlar.
  const evalBest = score(bestTheta, EVAL_SEED_BASE, trainSeeds, evalTicks);
  // ⚠️ Taban örneği ARAMA AKIŞINDAN AYRI bir RNG'den çizilir.
  // Ölçülen hata: `randomThetas`, nesil döngüsünden SONRA ve aynı `search`
  // akışından çiziliyordu. Döngü kaç kez `search.normal()` tükettiyse taban
  // örneği o kadar kayıyordu — yani iki kol FARKLI rastgele örneklemi
  // karşılaştırıyordu ve `generations: 0` geçerli bir kontrol olmaktan
  // çıkıyordu. ÖLÇÜLDÜ: kontrol taban(ort) 48.378, evrim kolu 48.386 —
  // aynı seed, aynı population, farklı örneklem.
  // Taban artık SABİT bir referans: ne kadar arama koşulursa koşulsun aynı.
  const randomThetas = baselineThetas(seedBase, trainSeeds, N);
  const evalScores = randomThetas.map((t) => score(t, EVAL_SEED_BASE, trainSeeds, evalTicks));
  const evalBaselineMean = meanOf(evalScores);
  const evalSurvivors = evalScores.filter((v) => Number.isFinite(v));
  const evalBaselineMax = evalSurvivors.length > 0 ? Math.max(...evalSurvivors) : Number.NaN;
  const trainScores = randomThetas.map((t) => score(t, seedBase, trainSeeds, trainTicks));
  const randomBaselineMean = meanOf(trainScores);
  // Sentinel (-Infinity) bir organizmanın öldüğünü anlatıyor; ortalama onu
  // yutar. Ölüm sayısı ayrıca raporlanır ve MAKS taban bunlardan çıkarılır.
  const deaths = trainScores.filter((v) => !Number.isFinite(v));
  const survivors = trainScores.filter((v) => Number.isFinite(v));
  const randomBaselineMax = survivors.length > 0 ? Math.max(...survivors) : Number.NaN;

  return {
    generations,
    population,
    offspringPerParent,
    trainBest: finalScores[finalBestIdx] as number,
    randomBaselineMean,
    randomBaselineMax,
    randomBaselineDeaths: deaths.length,
    randomBaselineN: trainScores.length,
    evalBest,
    evalBaselineMean,
    evalBaselineMax,
    gainOverRandom: evalBest - evalBaselineMax,
    bestTheta,
    history,
  };
}

export function formatEvolution(r: EvolutionResult): string {
  const head = '   nesil   en iyi   ortalama';
  const rows = r.history
    .filter((h) => h.generation === 0 || h.generation === 1 || h.generation % 5 === 4 || h.generation === r.generations)
    .map((h) => `  ${String(h.generation).padStart(6)}  ${fmt(h.best, 7)}  ${fmt(h.mean, 9)}`);
  return [
    head,
    ...rows,
    `  eğitim en iyi ${fmt(r.trainBest, 3)} · rastgele taban(en iyi) ${fmt(r.randomBaselineMax, 3)} · ort ${fmt(r.randomBaselineMean, 3)}`,
    `  DEĞERLENDİRME (görülmemiş tohumlar): bulunan ${fmt(r.evalBest, 3)} · rastgele taban(en iyi) ${fmt(r.evalBaselineMax, 3)} · ort ${fmt(r.evalBaselineMean, 3)} · kazanç ${fmt(r.gainOverRandom, 3)}`,
  ].join('\n');
}

// --------------------------------------------------- varyans azaltma taraması

export interface VarianceReductionPoint {
  label: string;
  normalizeAdvantage: boolean;
  signAdvantage: boolean;
  updates: number;
  weightShift: number;
  difference: Interval;
  pValue: number;
  probabilityOfImprovement: number;
  trainEnvDifference: number;
}

/**
 * **S-1 · Varyans azaltma deneyi.**
 *
 * Önceden sabitlenen hipotez: REINFORCE'ın buradaki başarısızlığı **ölçek
 * sorunu** değil **varyans** sorunudur; dolayısıyla avantaj dönüşümü (z-skor
 * veya işaret) gradyanın gürültü/faydalı-sinyal oranını artırır ve ölçülebilir
 * bir davranış iyileşmesi doğar.
 *
 * **Kritik tasarım kararı:** tarama `TRAJECTORY_LIMIT` ve `LEARN_RATE`'i
 * **varsayılanlarda tutar** (64 / 0.02). Çünkü §4.7'de ölçüldüğü gibi adımı
 * büyütmek davranışı kötüleştiriyor; varyans azaltmanın başarısı, ölçek
 * değiştirilmeden gösterilmelidir. Bu, S-1'in kendisini en zor koşullarda
 * sınar.
 *
 * Başarı ölçütü (önceden kaydedildi): en az bir varyantta, değerlendirme
 * farkının güven aralığı **sıfırdan ayrışmalı** (p < 0.05) ve iyileşme
 * olasılığı **%80'in üzerinde** olmalı.
 */
export function sweepVarianceReduction(options?: {
  seeds?: number;
  trainTicks?: number;
  evalTicks?: number;
  resourceCount?: number;
}): VarianceReductionPoint[] {
  const seeds = options?.seeds ?? 20;
  const trainTicks = options?.trainTicks ?? 6000;
  const evalTicks = options?.evalTicks ?? 4000;
  const resourceCount = options?.resourceCount ?? 14;
  const EVAL_SEED_BASE = 1001;

  const variants: { label: string; normalizeAdvantage: boolean; signAdvantage: boolean }[] = [
    { label: 'temel (dönüşüm yok)', normalizeAdvantage: false, signAdvantage: false },
    { label: 'z-skor avantaj', normalizeAdvantage: true, signAdvantage: false },
    { label: 'işaret avantajı', normalizeAdvantage: false, signAdvantage: true },
    { label: 'işaret + z-skor', normalizeAdvantage: true, signAdvantage: true },
  ];

  return variants.map((variant) => {
    const tuning = {
      normalizeAdvantage: variant.normalizeAdvantage,
      signAdvantage: variant.signAdvantage,
    };
    const train: TrialResult[] = [];
    for (let i = 0; i < seeds; i++) {
      train.push(
        runTrial({ seed: 1 + i, ticks: trainTicks, learning: true, resourceCount, ...tuning, sampleEvery: 0 }),
      );
    }
    const control: TrialResult[] = [];
    const treatment: TrialResult[] = [];
    const trainEnv: TrialResult[] = [];
    for (let i = 0; i < seeds; i++) {
      const evalSeed = EVAL_SEED_BASE + i;
      control.push(runTrial({ seed: evalSeed, ticks: evalTicks, learning: false, resourceCount, sampleEvery: 0 }));
      treatment.push(
        runTrial({ seed: evalSeed, ticks: evalTicks, learning: false, resourceCount, theta: train[i]?.thetaFinal, sampleEvery: 0 }),
      );
      trainEnv.push(
        runTrial({ seed: 1 + i, ticks: evalTicks, learning: false, resourceCount, theta: train[i]?.thetaFinal, sampleEvery: 0 }),
      );
    }
    const diffs = treatment.map((v, i) => v.meanEnergyNorm - (control[i]?.meanEnergyNorm ?? 0));
    const controlMean = meanOf(control.map((r) => r.meanEnergyNorm));
    const test = bootstrapTest(diffs, { seed: 600 + Number(variant.signAdvantage) * 10 + Number(variant.normalizeAdvantage) });

    return {
      label: variant.label,
      normalizeAdvantage: variant.normalizeAdvantage,
      signAdvantage: variant.signAdvantage,
      updates: meanOf(train.map((r) => r.learningUpdates)),
      weightShift: meanOf(train.map((r) => r.learnedDeltaNorm)),
      difference: bootstrapCI(diffs, { seed: 700 + Number(variant.signAdvantage) * 10 + Number(variant.normalizeAdvantage) }),
      pValue: test.pValue,
      probabilityOfImprovement: test.probabilityOfImprovement,
      trainEnvDifference: meanOf(trainEnv.map((v) => v.meanEnergyNorm - controlMean)),
    };
  });
}

export function formatVarianceSweep(points: readonly VarianceReductionPoint[]): string {
  const header = '  varyant                  günc.     ‖Δθ‖      fark [95% CI]           p      iyileşme  ezber';
  const rows = points.map((p) => {
    const ci = `[${fmt(p.difference.lower, 3)}, ${fmt(p.difference.upper, 3)}]`.padEnd(21);
    return (
      `  ${p.label.padEnd(22)}  ${fmt(p.updates, 5)}  ${fmt(p.weightShift, 8)}  ${ci} ${fmt(p.pValue, 6)}  ` +
      `${fmt(p.probabilityOfImprovement * 100, 6)}%  ${fmt(p.trainEnvDifference, 5)}`
    );
  });
  return [header, ...rows].join('\n');
}

// --------------------------------------------------- S-1b: işaret + adım

export interface SignStepPoint {
  learnRate: number;
  trajectoryLimit: number;
  updates: number;
  weightShift: number;
  difference: Interval;
  pValue: number;
  probabilityOfImprovement: number;
  trainEnvDifference: number;
}

/**
 * **S-1b · İşaret avantajı + ölçülü adım artışı.**
 *
 * Önceden kaydedilen hipotez: §4.7'de büyük adım **dönüşümsüz** gradyanla
 * kötüleşti; §4.10'da dönüşüm tek başına yetmedi. Bu ikisinin **birleşimi**
 * denenmemişti. İşaret avantajı gradyan büyüklüğünü sınırladığı için, büyük
 * adımın gürültüyü değil sinyali ölçeklemesi beklenir.
 *
 * **Önceden kaydedilen başarı ölçütü:** en az bir noktada p < 0.05 **ve**
 * iyileşme olasılığı > %80. S-1 ile aynı eşik, adil karşılaştırma için.
 *
 * **Yanlışlanabilirlik notu:** S-1 başarısız olduğu için bu bir "daha çok
 * dene" turu değildir; listede **yazılı olarak** açık bir bileşimdir. Yine
 * başarısız olursa hipotez elenir ve S-2'ye geçilir.
 */
export function sweepSignStep(options?: {
  learnRates?: number[];
  trajectoryLimits?: number[];
  seeds?: number;
  trainTicks?: number;
  evalTicks?: number;
  resourceCount?: number;
}): SignStepPoint[] {
  const learnRates = options?.learnRates ?? [0.02, 0.1, 0.5, 2.0];
  const trajectoryLimits = options?.trajectoryLimits ?? [64];
  const seeds = options?.seeds ?? 20;
  const trainTicks = options?.trainTicks ?? 6000;
  const evalTicks = options?.evalTicks ?? 4000;
  const resourceCount = options?.resourceCount ?? 14;
  const EVAL_SEED_BASE = 1001;

  const points: SignStepPoint[] = [];
  for (const trajectoryLimit of trajectoryLimits) {
    for (const learnRate of learnRates) {
      const tuning = { signAdvantage: true, trajectoryLimit, learnRate };
      const train: TrialResult[] = [];
      for (let i = 0; i < seeds; i++) {
        train.push(
          runTrial({ seed: 1 + i, ticks: trainTicks, learning: true, resourceCount, ...tuning, sampleEvery: 0 }),
        );
      }
      const control: TrialResult[] = [];
      const treatment: TrialResult[] = [];
      const trainEnv: TrialResult[] = [];
      for (let i = 0; i < seeds; i++) {
        const evalSeed = EVAL_SEED_BASE + i;
        control.push(runTrial({ seed: evalSeed, ticks: evalTicks, learning: false, resourceCount, sampleEvery: 0 }));
        treatment.push(
          runTrial({ seed: evalSeed, ticks: evalTicks, learning: false, resourceCount, theta: train[i]?.thetaFinal, sampleEvery: 0 }),
        );
        trainEnv.push(
          runTrial({ seed: 1 + i, ticks: evalTicks, learning: false, resourceCount, theta: train[i]?.thetaFinal, sampleEvery: 0 }),
        );
      }
      const diffs = treatment.map((v, i) => v.meanEnergyNorm - (control[i]?.meanEnergyNorm ?? 0));
      const controlMean = meanOf(control.map((r) => r.meanEnergyNorm));
      const test = bootstrapTest(diffs, { seed: 1100 + Math.round(learnRate * 10) + trajectoryLimit });
      points.push({
        learnRate,
        trajectoryLimit,
        updates: meanOf(train.map((r) => r.learningUpdates)),
        weightShift: meanOf(train.map((r) => r.learnedDeltaNorm)),
        difference: bootstrapCI(diffs, { seed: 1200 + Math.round(learnRate * 10) + trajectoryLimit }),
        pValue: test.pValue,
        probabilityOfImprovement: test.probabilityOfImprovement,
        trainEnvDifference: meanOf(trainEnv.map((v) => v.meanEnergyNorm - controlMean)),
      });
    }
  }
  return points;
}

export function formatSignStep(points: readonly SignStepPoint[]): string {
  const header = '  ufuk  lr      günc.     ‖Δθ‖      fark [95% CI]           p      iyileşme  ezber';
  const rows = points.map((p) => {
    const ci = `[${fmt(p.difference.lower, 3)}, ${fmt(p.difference.upper, 3)}]`.padEnd(21);
    return (
      `  ${String(p.trajectoryLimit).padStart(4)}  ${fmt(p.learnRate, 6)}  ${fmt(p.updates, 6)}  ` +
      `${fmt(p.weightShift, 8)}  ${ci} ${fmt(p.pValue, 6)}  ${fmt(p.probabilityOfImprovement * 100, 6)}%  ${fmt(p.trainEnvDifference, 5)}`
    );
  });
  return [header, ...rows].join('\n');
}

// --------------------------------------------------- ödül sinyali ölçümü

export interface RewardSignalReport {
  resourceCount: number;
  samples: number;
  seedsPerSample: number;
  /** Politika başına ortalama ödül (karar başına). */
  rewards: number[];
  /** Aynı politikaların gerçek performansı (ortalama normalize enerji). */
  performances: number[];
  /** Pearson korelasyonu: ödül ↔ performans. */
  pearson: number;
  /** Spearman korelasyonu: sıra korelasyonu (doğrusal olmayan ilişkiyi de yakalar). */
  spearman: number;
  /**
   * **Politikaya bağlı ödül varyansının payı.**
   *
   * Toplam ödül varyansının ne kadarı politikalar arası farklardan geliyor?
   * 0'a yakınsa ödül büyük ölçüde **politikadan bağımsız**dır: gradyan
   * ne kadar iyi kurulursa kurulsun öğrenilecek sinyal kalmaz.
   * 1'e yakınsa ödül neredeyse tamamen politikanın davranışıdır ve sorun
   * optimizer'dadır.
   */
  policyDependentShare: number;
  /** Ölçümün yorumu — okuyucu için tek satırlık teşhis. */
  reading: string;
}

function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return Number.NaN;
  const mx = meanOf(xs.slice(0, n));
  const my = meanOf(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = (xs[i] as number) - mx;
    const b = (ys[i] as number) - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den > 0 ? num / den : Number.NaN;
}

function rankArray(values: readonly number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && (order[j + 1] as readonly [number, number])[0] === (order[i] as readonly [number, number])[0]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[(order[k] as readonly [number, number])[1]] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/**
 * **Ödül sinyali ölçümü — S-2'nin teşhisi.**
 *
 * Deneyler şu ana kadar yalnızca *sonuçları* ölçtü (politika daha mı iyi
 * davranıyor). Oysa öğrenmenin çalışıp çalışmadığını belirleyen şey
 * **sinyalin kendisidir**: ödül, politikanın kararlarına duyarlı mı?
 *
 * Ölçüm: N politika örneklenir. Her biri **aynı dünya kümesinde**, öğrenme
 * kapalı olarak koşturulur. Her politika için iki sayı kaydedilir:
 *   - karar başına ortalama ödül (öğrenmenin gördüğü sinyal),
 *   - ortalama normalize enerji (gerçek performans).
 *
 * Sonra:
 *   1. ödül ↔ performans korelasyonu,
 *   2. **politikaya bağlı varyans payı**.
 *
 * **Yorum kuralı (önceden yazıldı):**
 *   - policyDependentShare < 0.05 → ödül pratikte sabit; **hiçbir optimizer
 *     çalışamaz**. Sorun ödüldedir, S-2 bir düzeltme adımı değil kök nedendir.
 *   - 0.05 ≤ share < 0.2 → zayıf sinyal; öğrenme mümkün ama gürültüye yenilir.
 *   - share ≥ 0.2 → sinyal var; sorun optimizer tarafındadır (S-1/S-1b boşa çıktı).
 */
export function measureRewardSignal(options?: {
  resourceCount?: number;
  samples?: number;
  seedsPerSample?: number;
  ticks?: number;
  seedBase?: number;
}): RewardSignalReport {
  const resourceCount = options?.resourceCount ?? 14;
  const samples = options?.samples ?? 40;
  const seedsPerSample = options?.seedsPerSample ?? 2;
  const ticks = options?.ticks ?? 4000;
  const seedBase = options?.seedBase ?? 5001;

  const rewards: number[] = [];
  const performances: number[] = [];

  for (let i = 0; i < samples; i++) {
    let reward = 0;
    let performance = 0;
    for (let k = 0; k < seedsPerSample; k++) {
      const r = runTrial({
        seed: seedBase + i * seedsPerSample + k,
        ticks,
        learning: false,
        resourceCount,
        sampleEvery: 0,
      });
      reward += r.meanRewardPerDecision;
      performance += r.meanEnergyNorm;
    }
    rewards.push(reward / seedsPerSample);
    performances.push(performance / seedsPerSample);
  }

  const rewardMean = meanOf(rewards);
  let between = 0;
  for (const r of rewards) between += (r - rewardMean) ** 2;
  between /= rewards.length;
  const total = stdDev(rewards) ** 2;
  const share = total > 0 ? between / total : Number.NaN;

  const r = pearson(rewards, performances);
  const s = pearson(rankArray(rewards), rankArray(performances));

  let reading: string;
  if (!Number.isFinite(share)) {
    reading = 'Ödül tüm politikalarda birebir aynı → **sinyal yok**. Ödül politikadan tamamen bağımsız.';
  } else if (share < 0.05) {
    reading = `Ödülün yalnız %${(share * 100).toFixed(1)}'i politika farklarından geliyor → **pratikte sabit sinyal**. Hiçbir optimizer çalışamaz; sorun ödüldedir.`;
  } else if (share < 0.2) {
    reading = `Ödülün %${(share * 100).toFixed(1)}'i politika farklarından geliyor → **zayıf sinyal**. Öğrenme mümkün ama gürültüye yenilir.`;
  } else {
    reading = `Ödülün %${(share * 100).toFixed(1)}'i politika farklarından geliyor → **sinyal var**. Sorun optimizer tarafındadır.`;
  }

  return {
    resourceCount,
    samples,
    seedsPerSample,
    rewards,
    performances,
    pearson: r,
    spearman: s,
    policyDependentShare: share,
    reading,
  };
}

export function formatRewardSignal(r: RewardSignalReport): string {
  const rw = [...r.rewards].sort((a, b) => a - b);
  return [
    `  kaynak=${r.resourceCount} · ${r.samples} politika × ${r.seedsPerSample} dünya`,
    `    ödül (karar başına): min ${fmt(rw[0], 5)} · medyan ${fmt(rw[Math.floor(rw.length / 2)], 5)} · maks ${fmt(rw[rw.length - 1], 5)}`,
    `    ödül ↔ performans: Pearson ${fmt(r.pearson, 3)} · Spearman ${fmt(r.spearman, 3)}`,
    `    politikaya bağlı ödül varyansı payı: ${fmt(r.policyDependentShare * 100, 2)}%`,
    `    → ${r.reading}`,
  ].join('\n');
}

// --------------------------------------------------- değişmez kontroller

/**
 * Projenin kendi dürüstlük sözleşmesini çalıştırır. Bir deneyin sayıları
 * bu kontrollerden biri kırıkken **geçerli sayılmaz**.
 */
export function runInvariants(): InvariantCheck[] {
  const checks: InvariantCheck[] = [];

  // 1) Enerji korunumu — arena
  const arenaRuns = [runTrial({ seed: 9001, ticks: 600, learning: true, sampleEvery: 0 }),
    runTrial({ seed: 9002, ticks: 600, learning: false, sampleEvery: 0 })];
  const arenaWorst = worstResidual(arenaRuns);
  checks.push({
    name: 'enerji korunumu (arena)',
    passed: Math.abs(arenaWorst) < 1e-6,
    detail: `en büyük |rezidüel| = ${fmt(arenaWorst, 9)} e`,
  });

  // 2) Enerji korunumu — koloni
  const colonyRuns = [runColony({ seed: 9003, ticks: 800 }), runColony({ seed: 9004, ticks: 800 })];
  const colonyWorst = worstResidual(colonyRuns);
  checks.push({
    name: 'enerji korunumu (koloni)',
    passed: Math.abs(colonyWorst) < 1e-6,
    detail: `en büyük |rezidüel| = ${fmt(colonyWorst, 9)} e`,
  });

  // 3) Öğrenme kapalıyken ağırlıklar değişmez
  const frozenBaseline = new Float64Array(MLP_SHAPE.PARAM_COUNT);
  const frozenStart = runTrial({ seed: 9005, ticks: 1, learning: false, theta: frozenBaseline, sampleEvery: 0 });
  const frozenInjected = runTrial({ seed: 9005, ticks: 900, learning: false, theta: frozenStart.thetaFinal, sampleEvery: 0 });
  const frozenDelta = frozenInjected.learnedDeltaNorm;
  checks.push({
    name: 'öğrenme kapalıyken ağırlıklar sabit',
    passed: frozenDelta === 0 && frozenInjected.learningUpdates === 0,
    detail: `‖Δθ‖ = ${fmt(frozenDelta, 9)}, güncelleme sayısı = ${frozenInjected.learningUpdates}`,
  });

  // 4) Determinizm: aynı girdi → bit düzeyinde aynı sonuç
  const detA = runTrial({ seed: 9006, ticks: 700, learning: true, sampleEvery: 0 });
  const detB = runTrial({ seed: 9006, ticks: 700, learning: true, sampleEvery: 0 });
  const detColonyA = runColony({ seed: 9007, ticks: 700 });
  const detColonyB = runColony({ seed: 9007, ticks: 700 });
  const detSame =
    detA.meanEnergyNorm === detB.meanEnergyNorm &&
    detA.thetaFinal.every((v, i) => v === detB.thetaFinal[i]) &&
    detColonyA.finalPopulation === detColonyB.finalPopulation &&
    detColonyA.genomeShift === detColonyB.genomeShift;
  checks.push({
    name: 'determinizm (aynı tohum → aynı sonuç)',
    passed: detSame,
    detail: detSame
      ? 'arena ve koloni koşuları bit düzeyinde aynı'
      : 'tekrar koşu farklı sonuç verdi',
  });

  // 5) Ağırlık enjeksiyonu gerçekten uygulanıyor (deney altyapısının sağlamlığı)
  const injectTheta = runTrial({ seed: 9008, ticks: 1, learning: false, sampleEvery: 0 }).thetaFinal;
  const injected = runTrial({ seed: 9008, ticks: 1, learning: false, theta: injectTheta, sampleEvery: 0 });
  checks.push({
    name: 'ağırlık enjeksiyonu uygulanıyor',
    passed: injected.thetaFinal.every((v, i) => v === injectTheta[i]),
    detail: injected.thetaFinal.every((v, i) => v === injectTheta[i])
      ? 'enjeksiyon sonrası ağırlıklar korundu'
      : 'enjeksiyon sonrası ağırlıklar değişti',
  });

  return checks;
}

// ------------------------------------------------------------------ biçimlendirme

export function formatInvariant(checks: readonly InvariantCheck[]): string {
  return checks.map((c) => `  ${c.passed ? '✓' : '✗'} ${c.name} — ${c.detail}`).join('\n');
}

export function formatExperiment(report: ExperimentReport): string {
  const lines: string[] = [];
  lines.push(`── ${report.title}`);
  lines.push(`   soru    : ${report.question}`);
  lines.push(`   n       : ${report.seeds} eşleştirilmiş tohum`);
  lines.push(`   ölçüm   : ${report.metric}`);
  lines.push(`   kontrol : ${fmtInterval(report.control.interval)}`);
  lines.push(`   tedavi  : ${fmtInterval(report.treatment.interval)}`);
  lines.push(`   fark    : ${fmtInterval(report.difference)}   p = ${fmt(report.test.pValue, 4)}`);
  lines.push(
    `   iyileşme olasılığı (bootstrap): ${fmt(report.test.probabilityOfImprovement * 100, 1)}%`,
  );
  for (const s of report.secondary) {
    lines.push(
      `   · ${s.label}: kontrol ${fmt(s.control, 3)} · tedavi ${fmt(s.treatment, 3)} · fark ${fmt(s.difference, 3)}`,
    );
  }
  lines.push(`   enerji rezidüelü: ${fmt(report.worstLedgerResidual, 9)} e`);
  return lines.join('\n');
}

// --------------------------------------------------- S-3 · dal üzerinde evrim

export interface InWorldEvolutionPoint {
  generations: number;
  /** Nesil nesil en iyi bireyin ortalama skoru. */
  history: number[];
  /** Eşleşen taban: rastgele politikaların **en iyisi** (arama da maksimum). */
  baseline: number;
  /** Seçimsiz taban: rastgele politikaların ortalaması (yalnız bilgi için). */
  baselineMean: number;
  /** Kaç rastgele taban örneği organizmayı öldürdü. */
  baselineDeaths: number;
  /** Rastgele taban örneği sayısı. */
  baselineN: number;
  best: number;
  gain: number;
  /** Kazanan politikanın ortalama enerjisi (başlangıç ve son). */
  startEnergy: number;
  endEnergy: number;
  /** Arama süresi (ms). */
  spentMs: number;
  finalPopulation: number;
  finalMultiCellColonies: number;
  largestColony: number;
  worstLedgerResidual: number;
}

export interface InWorldEvolutionReport {
  seed: number;
  forkTick: number;
  evaluateTicks: number;
  arms: { label: string; point: InWorldEvolutionPoint }[];
  reading: string;
}

/**
 * **S-3 · Çevrimiçi (μ+λ) aramanın canlı dünyanın bir dalında çalıştığı.**
 *
 * Arena deneyi +0.161 bulmuştu (§4.9). Bu ölçüm, aynı yöntemin **canlı dünyanın
 * anlık görüntüsünden açılan bir dalda** da işe yarayıp yaramadığını sorar.
 * İkisi arasındaki fark: arena tek bireyli ve kaynak kısıtlıydı; canlı dünya
 * kalabalık. S-3'ü ürüne almadan önce bu farkın sonucu değiştirip
 * değiştirmediği **bilinmelidir.**
 *
 * Protokol: canlı dünya 3.000 tick ilerletilir, snapshot alınır, her koldan bir
 * dal açılır ve arama o dalda çalıştırılır. Kontrol kolu arama yapmaz.
 *
 * **Arama kodu (`evolvePolicy`) her iki kol için de aynıdır**; tek fark
 * `generations: 0` (arama yok) ve `generations: 12` (arama).
 */
export function experimentInWorldEvolution(options?: {
  seed?: number;
  forkTick?: number;
  evaluateTicks?: number;
  generations?: number;
  population?: number;
  offspring?: number;
  trainTicks?: number;
}): InWorldEvolutionReport {
  const seed = options?.seed ?? 11;
  const forkTick = options?.forkTick ?? 3000;
  const evaluateTicks = options?.evaluateTicks ?? 2000;
  const generations = options?.generations ?? 12;
  const population = options?.population ?? 8;
  const offspring = options?.offspring ?? 3;
  const trainTicks = options?.trainTicks ?? 2000;

  const source = new World({ seed, population: 48 });
  for (let t = 0; t < forkTick; t++) source.step();
  const snapshot = serializeWorld(source);

  const runArm = (gens: number): InWorldEvolutionPoint => {
    const started = performance.now();
    const fork = deserializeWorld(snapshot);
    // Değerlendirici: her aday politikayı **canlı dünyanın dalına** enjekte
    // edip evaluateTicks kadar ilerletir ve 1. organizmanın enerjisini okur.
    const forkScore = (theta: Float64Array): number => {
      const probe = deserializeWorld(snapshot);
      const p = probe.policies.get(1);
      const o = probe.organisms.get(1);
      if (!p || !o) return Number.NEGATIVE_INFINITY;
      p.state.thetaLive.set(theta);
      p.state.thetaInherited.set(theta);
      o.neural.thetaLive.set(theta);
      for (let t = 0; t < evaluateTicks; t++) probe.step();
      const org = probe.organisms.get(1);
      if (!org) return Number.NEGATIVE_INFINITY;
      // ⚠️ **Hücre başına** enerji, toplam değil. Toplam kullanılırsa uygunluk
      // "daha çok hücre" olmayı ödüllendirir, davranış kalitesini değil.
      // Bu hata ölçüldü: `generations: 0` (hiç arama yok) kontrol kolunda bile
      // 74 birimlik sahte "kazanç" çıktı. Arena deneyinin temiz sonucu vermesinin
      // sebebi de hücre başına normalleştirmiş olmasıdır.
      let sum = 0;
      let live = 0;
      for (const cid of org.cells) {
        const c = probe.cells.get(cid);
        if (!c?.alive) continue;
        sum += c.energy;
        live++;
      }
      return live > 0 ? sum / live : Number.NEGATIVE_INFINITY;
    };

    const result = evolvePolicy({
      generations: gens,
      population,
      offspring,
      seedBase: seed,
      evaluate: forkScore,
    });

    // Arama bittikten sonra dalı biraz daha ilerletip durumu ölç.
    for (let t = 0; t < trainTicks; t++) fork.step();

    const org = fork.organisms.get(1);
    let endEnergy = 0;
    if (org) {
      let sum = 0;
      let live = 0;
      for (const cid of org.cells) {
        const c = fork.cells.get(cid);
        if (!c?.alive) continue;
        sum += c.energy;
        live++;
      }
      endEnergy = live > 0 ? sum / live : 0;
    }
    const m = fork.latestMetrics();
    const res =
      fork.ledger.initialTotal + fork.ledger.externalInput - fork.systemEnergyTotal() - fork.ledger.dissipated;

    return {
      generations: gens,
      history: result.history.map((h) => h.best),
      baseline: result.randomBaselineMax,
      baselineMean: result.randomBaselineMean,
      baselineDeaths: result.randomBaselineDeaths,
      baselineN: result.randomBaselineN,
      best: result.trainBest,
      // Arama MAKSİMUM döndürdüğü için taban da maksimum olmalı; ortalama
      // karşılaştırılırsa kazanç yapısal olarak pozitif olur.
      gain: result.trainBest - result.randomBaselineMax,
      startEnergy: 55,
      endEnergy,
      spentMs: performance.now() - started,
      finalPopulation: fork.population(),
      finalMultiCellColonies: m?.coloniesOverFourCells ?? 0,
      largestColony: m?.largestColonySize ?? 0,
      worstLedgerResidual: res,
    };
  };

  const control = runArm(0);
  const treatment = runArm(generations);
  const arms = [
    { label: 'kontrol (arama yok)', point: control },
    { label: `evrim (${generations} nesil)`, point: treatment },
  ];

  const reading = readInWorldEvolution(treatment, control.endEnergy);

  return { seed, forkTick, evaluateTicks, arms, reading };
}

export function formatInWorldEvolution(r: InWorldEvolutionReport): string {
  const lines = [
    `  tohum ${r.seed} · canlı dünya ${r.forkTick} tick → dal · değerlendirme ${r.evaluateTicks} tick`,
  ];
  for (const arm of r.arms) {
    const p = arm.point;
    lines.push(
      `  ${arm.label.padEnd(24)} taban(en iyi) ${fmt(p.baseline, 3)} · ort ${fmt(p.baselineMean, 3)} · taban ölümü ${p.baselineDeaths}/${p.baselineN} → bulunan ${fmt(p.best, 3)} (kazanç ${fmt(p.gain, 3)}) · bölünme sonrası enerji ${fmt(p.endEnergy, 0)} e · pop ${p.finalPopulation} · 4+ ${p.finalMultiCellColonies} · süre ${fmt(p.spentMs, 0)} ms`,
    );
    if (p.history.length > 0) {
      const step = Math.max(1, Math.floor(p.history.length / 8));
      const curve = p.history.filter((_, i) => i % step === 0).map((v) => fmt(v, 3)).join(' → ');
      lines.push(`    nesil eğrisi: ${curve}`);
    }
  }
  lines.push(`  enerji rezidülü: ${fmt(r.arms[1]?.point.worstLedgerResidual ?? 0, 9)} e`);
  lines.push(`  → ${r.reading}`);
  return lines.join('\n');
}

/**
 * Dünya içi evrim deneyinin HÜKMÜ — saf fonksiyon, test edilebilir olsun diye.
 *
 * ⚠️ `forkScore` yok olan organizma için sentinel olarak `-Infinity` döndürüyor.
 * Tek bir rastgele taban örneği organizmayı öldürürse ortalama `-Infinity`
 * olur, kazanç `+Infinity` olur ve `Infinity > 0` **doğru** döner: deney saf
 * aritmetik artefaktla "işe yarıyor" derdi.
 *
 * ÖLÇÜLDÜ (tohum 11, `generations: 0`): taban **-Infinity**, kazanç **+Infinity**,
 * hüküm **"canlı dünyanın dalında da işe yarıyor"** — oysa ölçüm yoktu.
 * Bu yüzden sonlu olmayan değerle **hüküm verilmez**.
 */
export function readInWorldEvolution(
  treatment: { baseline: number; best: number; gain: number; startEnergy: number; endEnergy: number; spentMs: number },
  controlEndEnergy: number,
): string {
  if (!Number.isFinite(treatment.baseline) || !Number.isFinite(treatment.gain)) {
    return (
      `Çevrimiçi evrim **ÖLÇÜLEMEDİ**: rastgele taban ${fmt(treatment.baseline, 3)}. ` +
      `Sentinel (-Infinity) bir taban örneğinin organizmayı öldürdüğünü anlatıyor ve ` +
      `ortalamaya karışıyor; çıkan kazanç (${fmt(treatment.gain, 3)}) aritmetik ` +
      `artefakttır, kanıt değildir.`
    );
  }
  return treatment.gain > 0
    ? `Çevrimiçi evrim **canlı dünyanın dalında da işe yarıyor**: rastgele taban ` +
      `${fmt(treatment.baseline, 3)} → bulunan politika ${fmt(treatment.best, 3)} ` +
      `(kazanç +${fmt(treatment.gain, 3)}). Bölünmenin ardından organizmanın enerjisi ` +
      `${fmt(treatment.startEnergy, 0)} → ${fmt(treatment.endEnergy, 0)} e ` +
      `(kontrol ${fmt(controlEndEnergy, 0)} e). Arama ${fmt(treatment.spentMs, 0)} ms sürdü.`
    : `Çevrimiçi evrim canlı dünyanın dalında kazanç üretmedi: ${fmt(treatment.gain, 3)}.`;
}

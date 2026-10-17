/**
 * Cell to Mind — Evrim Atölyesi.
 *
 * Seçili bir organizmanın politikasını (μ+λ) evrimsel aramayla iyileştirir.
 *
 * **Neden arena?** `docs/VALIDATION.md` §4.9'da ölçüldü: arena (tek birey,
 * kaynak kısıtlı, hücre başına normalize edilmiş uygunluk, ayrık eğitim ve
 * değerlendirme tohumları) **+0.032** kazanç veriyor (+0.161 daha önce yanlışlandı). Aynı arama canlı
 * dünyanın dalında denendi ve **reddedildi** (§6.14–6.15): ~250 birey
 * birbirini doyurduğu için politikanın davranışı sonucu belirlemiyor,
 * uygunluk da hücre sayısıyla şişiyor.
 *
 * **Bu yüzden atölye canlı dünyayı değiştirmez.** Arama ayrı arena koşularında
 * yapılır; kazanan politika seçili organizmanın **ağırlıklarına yazılır**.
 * Kullanıcının gördüğü ve denetleyebildiği şey budur.
 *
 * **Ölçülen maliyet:** §6.15'te tam dünya dalında tek arama ~123 sn sürdü. Arena
 * tek birey olduğu için çok daha ucuzdur; aşağıdaki varsayılan bütçe
 * (~96 değerlendirme × 2.000 tick) tarayıcıda birkaç saniyeye iner ve üründe
 * etkileşimli olarak kullanılabilir.
 */

import { runTrial } from '../experiments/arena.ts';
import { evolvePolicy } from '../experiments/index.ts';
import { MLP_SHAPE, copyTheta } from '../behavior/mlp.ts';

export interface EvolutionLabOptions {
  /** İyileştirilecek organizmanın mevcut politikası. */
  startTheta: Float64Array;
  generations?: number;
  population?: number;
  offspring?: number;
  mutationSigma?: number;
  /** Arena koşu uzunluğu (tick). */
  ticks?: number;
  /** Başarı ölçümünde kaç dünya kullanılacak. */
  evalSeeds?: number;
  resourceCount?: number;
  seedBase?: number;
  /** Eğitim/değerlendirme tohum ayrımı (Jensen–Wald). */
  holdoutSeeds?: number;
  onGeneration?: (generation: number, best: number, mean: number) => void;
}

export interface EvolutionLabResult {
  /** Seçilen organizmanın başlangıç performansı (eğitim tohumlarında). */
  startScore: number;
  /** Aramanın bulduğu en iyi politika (eğitim tohumlarında). */
  bestScore: number;
  /** Rastgele politikaların ortalaması — aramanın taban çizgisi. */
  randomBaseline: number;
  /** **Görülmemiş** tohumlarda başlangıç politikasının skoru. */
  startHoldout: number;
  /** **Görülmemiş** tohumlarda kazanan politikanın skoru. */
  bestHoldout: number;
  /** Nesil nesil en iyi skor (panelde eğri olarak çizilir). */
  history: number[];
  /** Gerçek **genelleşme** kazancı — uydurma değil, tutulmuş tohumlarda. */
  holdoutGain: number;
  /** Değerlendirme sayısı (maliyet şeffaflığı). */
  evaluations: number;
  spentMs: number;
  /** Kazanan politika — organizmaya uygulanır. */
  bestTheta: Float64Array;
  /** Son başlangıç politikası. */
  startThetaFinal: Float64Array;
}

/**
 * Bir organizmanın politikasını arena üzerinde evrimsel aramayla iyileştirir.
 *
 **Değerlendirme protokolü (Jensen–Wald):**
 - **Eğitim tohumları** (seedBase…): arama sırasında her aday bunlarla
   puanlanır. Arama bunları "görmüş" olur.
 - **Tutulmuş tohumlar** (holdoutSeeds ile ayrık küme): ne arama ne de seçim
   bunları görür. Kazanç **yalnızca** burada raporlanır.
 Bu ayrım olmadan "genelleşme" iddiası ölçülemez.
 */
export function runEvolutionLab(options: EvolutionLabOptions): EvolutionLabResult {
  const generations = options.generations ?? 8;
  const population = options.population ?? 4;
  const offspring = options.offspring ?? 2;
  const mutationSigma = options.mutationSigma ?? 0.12;
  const ticks = options.ticks ?? 2000;
  const evalSeeds = options.evalSeeds ?? 3;
  const resourceCount = options.resourceCount ?? 14;
  const seedBase = options.seedBase ?? 7100;
  const holdoutSeeds = options.holdoutSeeds ?? 6;
  const startTheta = copyTheta(options.startTheta);

  const started = performance.now();

  /** Bir politikayı verilen tohum kümesinde ortalama skorla. */
  const score = (theta: Float64Array, seedStart: number, count: number): number => {
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

  let evaluations = 0;
  const evaluate = (theta: Float64Array): number => {
    evaluations++;
    return score(theta, seedBase, evalSeeds);
  };

  const startScore = evaluate(startTheta);

  const result = evolvePolicy({
    generations,
    population,
    offspring,
    mutationSigma,
    initialThetas: [startTheta],
    seedBase,
    evaluate,
    onGeneration: options.onGeneration,
  });

  const bestTheta = copyTheta(result.bestTheta);

  // Genelleşme ölçümü: tutulmuş tohumlar ne arama ne seçim gördü.
  const HOLDOUT_BASE = 90_001;
  const startHoldout = score(startTheta, HOLDOUT_BASE, holdoutSeeds);
  evaluations += holdoutSeeds;
  const bestHoldout = score(bestTheta, HOLDOUT_BASE, holdoutSeeds);
  evaluations += holdoutSeeds;

  return {
    startScore,
    bestScore: result.trainBest,
    randomBaseline: result.randomBaselineMean,
    startHoldout,
    bestHoldout,
    history: result.history.map((h) => h.best),
    holdoutGain: bestHoldout - startHoldout,
    evaluations,
    spentMs: performance.now() - started,
    bestTheta,
    startThetaFinal: startTheta,
  };
}

/** Parametre sayısı doğrulaması — yanlış boyutlu politika erken reddedilir. */
export function assertPolicyShape(theta: Float64Array): void {
  if (theta.length !== MLP_SHAPE.PARAM_COUNT) {
    throw new Error(`politika boyutu ${theta.length}; beklenen ${MLP_SHAPE.PARAM_COUNT}`);
  }
}
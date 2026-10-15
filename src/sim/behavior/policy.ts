/**
 * Cell to Mind — yaşam içi öğrenme: REINFORCE + eylemden bağımsız hareketli baseline.
 *
 * Politika kaybı (spec'e birebir):
 *
 *     L = -sum( stopGradient(G_t - b_t) * log( pi_theta(a_t | x_t) ) )
 *
 * Ayrıntılar, kısa ufuktan gelen sonlu-horizon basitleştirmesidir:
 *  - Yörünge en fazla `TRAJECTORY_LIMIT = 64` karardır.
 *  - Getiri `G_t = sum_{k=t}^{T-1} gamma^(k-t) * r_k`, `gamma = 0.95` sabittir.
 *  - Yörünge sonunda bootstrap değeri kullanılmaz (sabit sonlu ufuk; `docs/MODEL.md`
 *    içinde bu seçimin sonucu açıkça belgelenir).
 *  - Yörünge toplanırken ağırlıklar sabittir; güncelleme yalnızca sınırda olur.
 *  - Avantaj `A_t = G_t - b_t`; `b_t` karar anındaki baseline'dır.
 *  - Baseline önceki yörüngelerden gelir ve politika güncellemesinden SONRA
 *    hareketli (EMA) olarak tazelenir.
 *
 * Ödül, gizli "doğru besin" etiketinden değil net enerji değişiminden ve alınan
 * hasardan üretilir.
 */

import { C } from '../biology/energy.ts';
import type { NeuralState, TrajectoryStep } from '../types.ts';
import type { Rng } from '../rng.ts';
import {
  MLP_SHAPE,
  clipGradNorm,
  copyTheta,
  createTheta,
  forward,
  greedyAction,
  logProbAndGrad,
  sampleAction,
} from './mlp.ts';

/** Ödül ölçekleme sabitleri — ölçek açıkça tanımlıdır. */
export const REWARD = {
  /** Bir tick'lik bazal tüketimin iki katı: normal beslenen hücre ≈ +1.9. */
  ENERGY_SCALE: 1 / (2 * C.BASE_BASAL),
  /** Hasar cezası ölçeği. Tam ölüm ≈ -2.5. */
  DAMAGE_SCALE: 2.5,
  /** Hareket cezası ölçeği (enerji harcamak hafifçe cezadır). */
  MOVE_COST_SCALE: 0.5,
  /** Ödül kırpma aralığı (gradyan normu savunması). */
  CLAMP: 5,
} as const;

export interface DecisionInfo {
  obs: Float64Array;
  action: number;
  logProb: number;
  greedyAction: number;
  hidden: Float64Array;
  logits: Float64Array;
  probs: Float64Array;
  /** Karar anındaki baseline (mikroskopta gösterilir). */
  baseline: number;
}

export interface UpdateInfo {
  steps: number;
  meanAdvantage: number;
  gradNorm: number;
  baselineBefore: number;
  baselineAfter: number;
  meanReturn: number;
  /** Güncellemeden sonra değişmeyen parametre sayısı (0 olmalı). */
  applied: boolean;
}

/** Yeni organizma için sıfırlanmış sinir durumu. */
export function createNeuralState(thetaInherited: Float64Array): NeuralState {
  return {
    thetaInherited: copyTheta(thetaInherited),
    // Yavru kendi **başlangıç** ağıyla başlar; ebeveynin öğrenilmiş farkı
    // (thetaLive - thetaInherited) varsayılan olarak AKTARILMAZ.
    thetaLive: copyTheta(thetaInherited),
    baseline: 0,
    prevReward: 0,
    prevObs: null,
    prevAction: -1,
    prevLogProb: 0,
    prevBaseline: 0,
    hasPrev: false,
  };
}

/**
 * Koşuya özel öğrenme ayarı.
 *
 * **Neden var:** `TRAJECTORY_LIMIT` ve `LEARN_RATE` model sabitleriydi ve
 * yalnız kaynak kodundan değiştirilebiliyordu. Deney motorunun bunları
 * ölçülebilir bir eksen olarak sürebilmesi gerekiyordu.
 *
 * **Varsayılanlar değişmedi.** Verilmediğinde `C.TRAJECTORY_LIMIT` ve
 * `C.LEARN_RATE` kullanılır; yani oyunun davranışı bu değişiklikten etkilenmez.
 * Düzenleme yalnız **duyarlılık analizi** (sensitivity analysis) yapabilmek için
 * yapıldı: "ağırlık hareketinin hangi büyüklükte davranışa yansıdığını"
 * ölçmek. Ürün sabitleri değişmiş değildir.
 */
export interface PolicyTuning {
  /** Bir gradyan adımı için toplanacak karar sayısı. */
  trajectoryLimit?: number;
  /** Gradyan adım büyüklüğü (yörüngenin uzunluğuna bölünür). */
  learnRate?: number;
  /**
   * Avantajları yörünge içinde z-skoruna çevir (ortalama 0, sapma 1).
   *
   * Ölçüm gerekçesi (`docs/VALIDATION.md` §4.7–4.9): REINFORCE'ın gradyanı
   * burada gürültü baskın; 570× büyütmek davranışı kötüleştirdi. Ölçekten
   * bağımsız bir gradyan, adım büyüklüğünü ayrı ayarlamadan ayarlamaya izin
   * verir. Varsayılan **kapalı** — oyun davranışı değişmez.
   */
  normalizeAdvantage?: boolean;
  /**
   * Avantajın yalnız işaretini kullan (`sign(A_t)`).
   *
   * Ölçüm gerekçesi: ödülün ölçeği ve dağılımı sorun değil, **yönü** sorun.
   * İşaret tabanlı güncelleme (evolution-strategies / signSGD geleneği) büyük
   * pozitif/negatif aykırı değerlerin gradyanı bastırmasını engeller ve
   * varyansı sert düşürür. Varsayılan **kapalı**.
   */
  signAdvantage?: boolean;
}

export class NeuralPolicy {
  readonly state: NeuralState;
  private readonly trajectory: TrajectoryStep[] = [];
  /** Tamamlanmış karar sayacı (raporlama). */
  decisionCount = 0;
  /** Yapılan politika güncellemesi sayacı (raporlama). */
  updateCount = 0;

  private readonly trajectoryLimit: number;
  private readonly learnRate: number;
  private readonly normalizeAdvantage: boolean;
  private readonly signAdvantage: boolean;

  constructor(thetaInherited: Float64Array, tuning?: PolicyTuning) {
    this.state = createNeuralState(thetaInherited);
    this.trajectoryLimit = tuning?.trajectoryLimit ?? C.TRAJECTORY_LIMIT;
    this.learnRate = tuning?.learnRate ?? C.LEARN_RATE;
    this.normalizeAdvantage = tuning?.normalizeAdvantage ?? false;
    this.signAdvantage = tuning?.signAdvantage ?? false;
  }

  get trajectoryLength(): number {
    return this.trajectory.length;
  }

  /**
   * Kalıtsal ağı değiştirir ve yaşam içi durumu sıfırlar.
   *
   * Yavruda kullanılır: yavrunun `thetaLive` ağı kendi kalıtsal ağına eşit
   * başlar, yörünge tamponu ve baseline sıfırlanır. Öğrenilmiş fark aktarılmaz.
   *
   * ÖNEMLİ: `Organism.neural` ile `NeuralPolicy.state` AYNI nesnedir; bu
   * metot onu yerinde günceller. Ayrı nesneler kullanılırsa öğrenilen
   * ağırlıklar organizma kaydına yansımaz (organizma "hiç öğrenmemiş" görünür).
   */
  resetWeights(thetaInherited: Float64Array): void {
    this.state.thetaInherited = copyTheta(thetaInherited);
    this.state.thetaLive = copyTheta(thetaInherited);
    this.state.baseline = 0;
    this.state.prevReward = 0;
    this.state.prevObs = null;
    this.state.prevAction = -1;
    this.state.prevLogProb = 0;
    this.state.prevBaseline = 0;
    this.state.hasPrev = false;
    this.trajectory.length = 0;
    this.decisionCount = 0;
    this.updateCount = 0;
  }

  /** Yörünge adımları (mikroskopta yalnız seçili canlı için akar). */
  trajectorySteps(): readonly TrajectoryStep[] {
    return this.trajectory;
  }

  /** Kayıt geri yükleme: yörünge tamponunu olduğu gibi geri koyar. */
  pushTrajectory(steps: readonly TrajectoryStep[]): void {
    this.trajectory.length = 0;
    for (const step of steps) {
      if (step.obs.length !== MLP_SHAPE.INPUTS) continue;
      this.trajectory.push({ ...step });
    }
    if (this.trajectory.length > this.trajectoryLimit) {
      this.trajectory.splice(0, this.trajectory.length - this.trajectoryLimit);
    }
  }

  /**
   * Bir karar adımı başlatır: girdilerden eylem örnekler ve yörüngeye ekler.
   * `u` eylem örnekleme akışından gelir (ayrı RNG akışı).
   */
  beginStep(obs: Float64Array, u: number): DecisionInfo {
    const fwd = forward(this.state.thetaLive, obs);
    const action = sampleAction(fwd.probs, u);
    const logProb = Math.log(Math.max(1e-12, fwd.probs[action] as number));

    this.trajectory.push({ obs, action, logProb, baseline: this.state.baseline, reward: 0 });
    if (this.trajectory.length > this.trajectoryLimit) {
      // Sınır taşarsa en eski adım düşürülür; bu, "küçük ve on-policy" kuralıdır.
      this.trajectory.shift();
    }

    this.state.prevObs = obs;
    this.state.prevAction = action;
    this.state.prevLogProb = logProb;
    this.state.prevBaseline = this.state.baseline;
    this.state.hasPrev = true;
    this.decisionCount++;

    return {
      obs,
      action,
      logProb,
      greedyAction: greedyAction(fwd.probs),
      hidden: fwd.hidden,
      logits: fwd.logits,
      probs: fwd.probs,
      baseline: this.state.baseline,
    };
  }

  /** Yürütülen eylemin ödülünü yörüngeye yazar. */
  closeStep(reward: number): void {
    const clamped = Math.max(-REWARD.CLAMP, Math.min(REWARD.CLAMP, reward));
    const last = this.trajectory[this.trajectory.length - 1];
    if (last) last.reward = clamped;
    this.state.prevReward = clamped;
  }

  /** Yörünge dolduysa güncelleme yapar. */
  maybeUpdate(learningEnabled: boolean, plasticity: number): UpdateInfo | null {
    if (this.trajectory.length >= this.trajectoryLimit) return this.update(learningEnabled, plasticity);
    return null;
  }

  /**
   * Avantaj varyansını azaltır.
   *
   * Sıralama önemlidir: önce `signAdvantage`, sonra `normalizeAdvantage`.
   * İşaret tabanlı güncelleme, z-skorlamadan daha güçlü bir müdahaledir
   * (ölçeği tamamen atar, yalnız sıralamayı korur); ikisi birlikte
   * istendiğinde z-skorlama işareti bozmaz (z-skorlanmış bir dizinin
   * işareti, işaretlenmiş dizinin z-skorlanmışına eşittir).
   *
   * Sabit sapma (epsilon) bölme, tek adımlık yörüngelerde veya neredeyse
   * sabit avantajlarda z-skorlamanın NaN üretmesini engeller.
   */
  private reduceAdvantageVariance(raw: Float64Array, steps: number): Float64Array {
    const out = Float64Array.from(raw);
    if (steps === 0) return out;

    if (this.signAdvantage) {
      for (let t = 0; t < steps; t++) out[t] = Math.sign(out[t] as number);
    }

    if (this.normalizeAdvantage) {
      let mean = 0;
      for (let t = 0; t < steps; t++) mean += out[t] as number;
      mean /= steps;
      let variance = 0;
      for (let t = 0; t < steps; t++) {
        const d = (out[t] as number) - mean;
        variance += d * d;
      }
      variance /= steps;
      const std = Math.sqrt(variance);
      if (std > 1e-8) {
        for (let t = 0; t < steps; t++) out[t] = ((out[t] as number) - mean) / std;
      } else {
        // Sapma yoksa avantajlar ayrım gücü taşımıyor; gradyanı sıfırlama yerine
        // merkezlemek, saf gürültüyü adımlamaktan iyidir.
        for (let t = 0; t < steps; t++) out[t] = (out[t] as number) - mean;
      }
    }
    return out;
  }

  /** Ölümde kalan yörüngeyi kapatır ve güncelleme yapar. */
  onDeath(learningEnabled: boolean, plasticity: number): UpdateInfo | null {
    return this.update(learningEnabled, plasticity);
  }

  /**
   * REINFORCE güncellemesi.
   * Öğrenme kapalıysa ağırlıklar **hiç değişmez** (test bunu doğrular).
   */
  private update(learningEnabled: boolean, plasticity: number): UpdateInfo | null {
    const steps = this.trajectory.length;
    if (steps === 0) return null;

    const baselineBefore = this.state.baseline;

    // 1) Getiriler: G_t = sum_{k>=t} gamma^(k-t) * r_k
    const returns = new Float64Array(steps);
    let acc = 0;
    for (let t = steps - 1; t >= 0; t--) {
      acc = (this.trajectory[t] as TrajectoryStep).reward + C.GAMMA * acc;
      returns[t] = acc;
    }
    const meanReturn = acc / steps;

    if (!learningEnabled) {
      this.trajectory.length = 0;
      return {
        steps,
        meanAdvantage: 0,
        gradNorm: 0,
        baselineBefore,
        baselineAfter: baselineBefore,
        meanReturn,
        applied: false,
      };
    }

    // 2) Avantaj: A_t = G_t - b_t  (b_t = karar anındaki baseline)
    const totalGrad = createTheta();
    const single = createTheta();
    let advantageSum = 0;
    let signCount = 0;

    // Ham avantajlar önce toplanır; varyans azaltma dönüşümü sonra uygulanır.
    // Dönüşüm uygulanmadan önce "ortalama avantaj" **ham** avantajların ortalaması
    // olarak raporlanır — aksi halde raporlanan değer dönüşümün artefaktı olurdu.
    const rawAdvantages = new Float64Array(steps);
    for (let t = 0; t < steps; t++) {
      const step = this.trajectory[t] as TrajectoryStep;
      rawAdvantages[t] = (returns[t] as number) - step.baseline;
      advantageSum += rawAdvantages[t] as number;
      if ((rawAdvantages[t] as number) > 0) signCount++;
    }

    const advantages = this.reduceAdvantageVariance(rawAdvantages, steps);

    for (let t = 0; t < steps; t++) {
      const step = this.trajectory[t] as TrajectoryStep;
      const advantage = advantages[t] as number;
      // L = -sum(A_t * log pi). Gradyan: -A_t * d log pi / d theta
      logProbAndGrad(this.state.thetaLive, step.obs, step.action, single);
      for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
        totalGrad[p] = (totalGrad[p] as number) - advantage * (single[p] as number);
      }
    }

    // 3) Gradyan normu sınırla + ortalama
    const gradNorm = clipGradNorm(totalGrad, C.GRAD_CLIP);
    const scale = (this.learnRate * (0.25 + 0.75 * plasticity)) / steps;
    let anyNaN = false;
    for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
      const delta = (totalGrad[p] as number) * scale;
      if (!Number.isFinite(delta)) {
        anyNaN = true;
        break;
      }
      this.state.thetaLive[p] = (this.state.thetaLive[p] as number) + delta;
    }
    // NaN/Infinity koruması: bozuk delta varsa ağırlıklar olduğu gibi bırakılır.
    if (anyNaN) {
      this.trajectory.length = 0;
      return {
        steps,
        meanAdvantage: advantageSum / steps,
        gradNorm,
        baselineBefore,
        baselineAfter: baselineBefore,
        meanReturn,
        applied: false,
      };
    }

    this.updateCount++;

    // 4) Baseline TAZELEMESİ — politika güncellemesinden SONRA.
    const beta = C.BASELINE_BETA;
    this.state.baseline = (1 - beta) * baselineBefore + beta * meanReturn;

    this.trajectory.length = 0;
    return {
      steps,
      meanAdvantage: advantageSum / steps,
      gradNorm,
      baselineBefore,
      baselineAfter: this.state.baseline,
      meanReturn,
      applied: true,
    };
  }

  /**
   * Yavrunun kalıtsal ağı: ebeveynin `thetaInherited` değerlerinden mutasyonla.
   * Öğrenilmiş fark (`thetaLive - thetaInherited`) **aktarılmaz**.
   */
  static inheritedForChild(parent: NeuralState, rng: Rng, mutationRate: number, mutationScale: number): Float64Array {
    const child = copyTheta(parent.thetaInherited);
    for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
      if (rng.float() < mutationRate) {
        const v = (child[p] as number) + rng.normal() * mutationScale;
        child[p] = Number.isFinite(v) ? v : (child[p] as number);
      }
    }
    return child;
  }
}

/** `thetaLive - thetaInherited` farkının L2 normu (mikroskopta "bu yaşamda öğrenilen"). */
export function learnedDeltaNorm(state: NeuralState): number {
  let sum = 0;
  for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
    const d = (state.thetaLive[p] as number) - (state.thetaInherited[p] as number);
    sum += d * d;
  }
  return Math.sqrt(sum);
}
/** Bir organizmanın snapshot'undan `NeuralPolicy` kurar. */
export interface PolicySnapshotLike {
  neural: {
    thetaInherited: ArrayLike<number>;
    thetaLive: ArrayLike<number>;
    baseline: number;
    prevReward: number;
    prevObs: ArrayLike<number> | null;
    prevAction: number;
    prevLogProb: number;
    prevBaseline: number;
    hasPrev: boolean;
  };
  trajectory: readonly {
    obs: ArrayLike<number>;
    action: number;
    logProb: number;
    baseline: number;
    reward: number;
  }[];
  decisionCount: number;
  updateCount: number;
}

/**
 * Snapshot'tan bir `NeuralPolicy` kurar — **kanonik** uygulama.
 *
 * ⚠️ Bu işlev iki yerde kopyalanmıştı: burada ve `sim/world.ts` içinde. Kopya
 * `sim/persistence/snapshot.ts`'in `World`'i içe aktarması nedeniyle
 * konmuştu (world → snapshot → world döngüsü), ama politika durumuna alan
 * ekleyen birinin **iki yeri** de güncellemesi gerekiyordu; birini unutmak
 * fork/save yolunda sessizce öğrenme kaybı demek.
 *
 * Doğru yer burası: `policy.ts` yalnız `energy/types/rng/mlp` içe aktarıyor,
 * yani `world.ts` ve `snapshot.ts` bu modülü serbestçe kullanabiliyor.
 */
export function restorePolicyFromSnapshot(snap: PolicySnapshotLike): NeuralPolicy {
  const theta = Float64Array.from(snap.neural.thetaInherited);
  const policy = new NeuralPolicy(theta);
  policy.state.thetaLive = Float64Array.from(snap.neural.thetaLive);
  policy.state.baseline = snap.neural.baseline;
  policy.state.prevReward = snap.neural.prevReward;
  policy.state.prevObs = snap.neural.prevObs ? Float64Array.from(snap.neural.prevObs) : null;
  policy.state.prevAction = snap.neural.prevAction;
  policy.state.prevLogProb = snap.neural.prevLogProb;
  policy.state.prevBaseline = snap.neural.prevBaseline;
  policy.state.hasPrev = snap.neural.hasPrev;
  policy.pushTrajectory(
    snap.trajectory.map(
      (t): TrajectoryStep => ({
        obs: Float64Array.from(t.obs),
        action: t.action,
        logProb: t.logProb,
        baseline: t.baseline,
        reward: t.reward,
      }),
    ),
  );
  policy.decisionCount = snap.decisionCount;
  policy.updateCount = snap.updateCount;
  return policy;
}

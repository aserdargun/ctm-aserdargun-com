/**
 * Cell to Mind — deney arenası.
 *
 * `docs/ROADMAP.md` Faz A1'in çalıştırma yüzeyi. Buradaki tek soru şudur:
 * **bir organizmanın davranışı, ona atfedilebilir mi?** Popülasyonlu bir
 * dünyada bireysel başarı ile ekolojik şans ayrılamaz; bu yüzden arena
 * bireysel davranışı izole eder ve iki kol arasında **aynı başlangıç
 * durumunu** (ortam düzeni, başlangıç konumu, başlangıç ağırlıkları) garanti eder.
 *
 * Tasarım kararları:
 *
 * 1. **Tek hücre, tek organizma.** Bölünme, tomurcuklanma ve bağ kapalıdır.
 *    Bu, deneyi "koloniler birbirine yardım ediyor mu?" sorusuna değil,
 *    "politika öğreniyor mu?" sorusuna indirger. Çok hücrelilik kendi
 *    deneyinde (Faz B) ayrıca ölçülür.
 * 2. **Aynı ağırlık, iki kol.** `theta` verildiğinde hem `thetaInherited` hem
 *    `thetaLive` yerinde yazılır. Yavru aktarımı böylece deney kastedilen
 *    "eğitilmiş politika" olur.
 * 3. **Ölüm sessizce sıfır sayılır.** Organizma ölürse sonraki tick'lerin
 *    katkısı 0'dır. Bu, "ölçüm penceresi" ilkesidir: kaçırılan bir koşu
 *    lehineye değil aleyhine sayılır.
 * 4. **Enerji korunumu doğrulanır.** Her koşu muhasebe rezidüelini raporlar;
 *    sıfırdan farklı bir rezidüel deney sonucunu geçersiz kılar.
 */

import { C } from '../biology/energy.ts';
import { copyTheta } from '../behavior/mlp.ts';
import { MLP_SHAPE } from '../behavior/mlp.ts';
import { World } from '../world.ts';
import type { Cell } from '../types.ts';

export interface TrialOptions {
  /** Dünya tohumu. Aynı tohum = aynı kaynak düzeni + aynı başlangıç konumu. */
  seed: number;
  /** Kaç tick çalıştırılacak. */
  ticks: number;
  /** Öğrenme açık mı? Kapatıldığında ağırlıklar hiç değişmez. */
  learning: boolean;
  /** Avcı baskısı. Varsayılan 0 → avcı ölüm kaynağı olarak devre dışı. */
  selectionPressure?: number;
  /** Hücre bölünmesi açık mı? Varsayılan kapalı. */
  growthEnabled?: boolean;
  /** Bölünme/tohumlama açık mı? Varsayılan kapalı. */
  reproductionEnabled?: boolean;
  /**
   * Başlangıç ağırlıkları. Verilmezse kurucunun `initTheta` çıktısı kullanılır
   * (yani rastgele bir politika).
   */
  theta?: Float64Array;
  /** İz örnekleme aralığı (tick). Varsayılan 100. 0 → iz yok. */
  sampleEvery?: number;
  /** Kurucu organizmanın kimliği. Varsayılan 1. */
  founderId?: number;
  /**
   * Habitat kaynak düğümü sayısı. Varsayılan 34 (oyunun varsayılanı).
   *
   * Bu, arenanın **zorluk derecesidir**: daha az kaynak → beslenmek daha zor →
   * davranış daha çok belirleyici olur. Deneylerde kaynak sayısı azaltıldığında
   * kontrol kolunun skoru düşer; yani ölçüm için headroom açılır.
   */
  resourceCount?: number;
  /**
   * Duyarlılık analizi kancaları. Verilmezse model sabitleri kullanılır.
   * Yalnız `sweepLearningSignal()` doldurur; oyun hiçbir zaman değiştirmez.
   */
  trajectoryLimit?: number;
  learnRate?: number;
  normalizeAdvantage?: boolean;
  signAdvantage?: boolean;
}

export interface TracePoint {
  tick: number;
  energyNorm: number;
  alive: boolean;
}

export interface TrialResult {
  seed: number;
  learning: boolean;
  ticks: number;
  /** Koşuya dışarıdan ağırlık enjekte edildi miydi? */
  thetaInjected: boolean;

  /**
   * **Birincil ölçüm.** Tüm tick'lerdeki normalize enerjinin ortalaması.
   * Ölümden sonra katkı 0'dır. Aralık: [0, 1].
   *
   * Yorum: 0 = hiç beslenemedi, 0.55 = hiç hareket etmeden başlangıç
   * enerjisini korudu, 1.0 = sürekli doydu.
   */
  meanEnergyNorm: number;

  /** Ölçüm penceresinin sonuna kadar yaşadı mı? */
  survivedToEnd: boolean;
  /** Kaçıncı tick'te öldü (yaşadıysa null). */
  deathTick: number | null;
  /** Ölüm nedeni. */
  deathCause: string | null;
  /** Ölümden önceki son normalize enerji. */
  energyAtDeath: number | null;

  /**
   * Eğitimde kullanılan **ödülün** yaşam boyu toplamı (`organism.lifetimeReward`).
   *
   * Neden raporlanıyor: ödül, öğrenmenin tek sinyalidir. Bir politikanın
   * ödülü ile gerçek performansı arasında ilişki yoksa hiçbir gradyan
   * yöntemi çalışamaz. Bu sayı o ilişkinin ölçülmesini sağlar
   * (`measureRewardSignal`).
   */
  lifetimeReward: number;
  /** Karar başına ortalama ödül — politikalar arasında karşılaştırılabilir ölçüm. */
  meanRewardPerDecision: number;
  /** Ölçüm penceresi boyunca uygulanan politika güncellemesi sayısı. */
  learningUpdates: number;
  /** Politikanın aldığı karar sayısı. */
  decisions: number;

  /**
   * Bu koşu boyunca ağırlıkların ne kadar kaydığı: ‖θ_son − θ_başlangıç‖₂.
   *
   * **Daha önceki hata:** bu değer yalnız ağırlık enjeksiyonu yapıldığında
   * ölçülüyordu; enjeksiyonsuz (yani normal eğitim) koşularda tanım gereği 0
   * dönüyordu. Sonuç olarak rapordaki "öğrenilmiş ağırlık farkı" satırı
   * **her zaman 0** görünüyor ve öğrenmenin ne kadar ağırlık hareketi ürettiğini
   * söylemiyordu. Artık koşunun kendi başlangıç ağırlıklarına göre ölçülür —
   * enjeksiyonlu olsun olmasın anlamlıdır.
   */
  learnedDeltaNorm: number;

  /** Koşu sonundaki `thetaLive` — sonraki deneylere aktarılabilir. */
  thetaFinal: Float64Array;

  /** Enerji muhasebesi rezidüelü: başlangıç − şimdi − dış girdi − dağılan. */
  ledgerResidual: number;

  trace: TracePoint[];
}

/** Bir organizmanın toplam canlı hücre enerjisi. */
function liveEnergyOf(world: World, organismId: number): { energy: number; cells: number; alive: boolean } {
  const org = world.organisms.get(organismId);
  if (!org || !org.alive) return { energy: 0, cells: 0, alive: false };
  let sum = 0;
  let live = 0;
  for (const cellId of org.cells) {
    const cell = world.cells.get(cellId) as Cell | undefined;
    if (!cell?.alive) continue;
    live++;
    sum += cell.energy;
  }
  return { energy: sum, cells: live, alive: live > 0 };
}

/**
 * Bir deney koşusu. Deterministiktir: aynı `TrialOptions` → aynı sonuç.
 */
export function runTrial(options: TrialOptions): TrialResult {
  const {
    seed,
    ticks,
    learning,
    selectionPressure = 0,
    growthEnabled = false,
    reproductionEnabled = false,
    sampleEvery = 100,
    founderId = 1,
    resourceCount = 34,
    trajectoryLimit,
    learnRate,
    normalizeAdvantage,
    signAdvantage,
  } = options;

  const world = new World({
    seed,
    population: 1,
    resourceCount,
    selectionPressure,
    ...(trajectoryLimit === undefined ? {} : { trajectoryLimit }),
    ...(learnRate === undefined ? {} : { learnRate }),
    ...(normalizeAdvantage === undefined ? {} : { normalizeAdvantage }),
    ...(signAdvantage === undefined ? {} : { signAdvantage }),
    learningEnabled: learning,
    growthEnabled,
    reproductionEnabled,
    mutationEnabled: false,
    bondsEnabled: false,
  });
  // Karar bütçesi: arena sonuna kadar öğrenmeye izin ver (deney bunun için var).
  world.constraints.decisionBudget = Number.POSITIVE_INFINITY;

  let thetaInjected = false;
  if (options.theta) {
    const theta = options.theta;
    if (theta.length !== MLP_SHAPE.PARAM_COUNT) {
      throw new Error(`theta boyutu ${theta.length}; beklenen ${MLP_SHAPE.PARAM_COUNT}`);
    }
    const org = world.organisms.get(founderId);
    if (!org) throw new Error(`kurucu organizma ${founderId} bulunamadı`);
    // `organism.neural` ile `policy.state` aynı nesnedir (bkz. World.createOrganism),
    // dolayısıyla yerinde yazmak politikayı da değiştirir.
    org.neural.thetaInherited.set(theta);
    org.neural.thetaLive.set(theta);
    // Politika iç durumu sıfırlanır: geçmiş bir ödül/baseline aktarılmaz.
    org.neural.baseline = 0;
    org.neural.prevReward = 0;
    org.neural.prevObs = null;
    org.neural.prevAction = -1;
    org.neural.hasPrev = false;
    thetaInjected = true;
  }

  // 1) Kurucunun ağırlıkları — koşunun başlangıç noktası.
  const org = world.organisms.get(founderId) as NonNullable<ReturnType<World['organisms']['get']>>;
  const policy = world.policies.get(founderId);
  const thetaAtStart = copyTheta(org.neural.thetaLive);

  const trace: TracePoint[] = [];
  let energyIntegral = 0;
  let deathTick: number | null = null;
  let deathCause: string | null = null;
  let energyAtDeath: number | null = null;
  let survivedToEnd = true;

  for (let t = 1; t <= ticks; t++) {
    world.step();
    const { energy, alive } = liveEnergyOf(world, founderId);
    if (alive) {
      energyIntegral += energy / C.CELL_CAPACITY;
    } else if (deathTick === null) {
      deathTick = t;
      survivedToEnd = false;
      deathCause = org.deathCause;
      energyAtDeath = energy / C.CELL_CAPACITY;
    }
    if (sampleEvery > 0 && t % sampleEvery === 0) {
      trace.push({ tick: t, energyNorm: alive ? energy / C.CELL_CAPACITY : 0, alive });
    }
  }

  const ledger = world.ledger;
  const current = world.systemEnergyTotal();
  const ledgerResidual = ledger.initialTotal + ledger.externalInput - current - ledger.dissipated;

  // Ağırlıklar bu koşuda ne kadar kaydı? (enjeksiyondan bağımsız ölçüm)
  let sum = 0;
  for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
    const d = (org.neural.thetaLive[p] as number) - (thetaAtStart[p] as number);
    sum += d * d;
  }
  const learnedDeltaNorm = Math.sqrt(sum);

  return {
    seed,
    learning,
    ticks,
    thetaInjected,
    meanEnergyNorm: energyIntegral / ticks,
    survivedToEnd,
    deathTick,
    deathCause,
    energyAtDeath,
    lifetimeReward: org.lifetimeReward,
    meanRewardPerDecision: (policy?.decisionCount ?? 0) > 0 ? org.lifetimeReward / (policy?.decisionCount ?? 1) : 0,
    learningUpdates: policy?.updateCount ?? 0,
    decisions: policy?.decisionCount ?? 0,
    learnedDeltaNorm,
    thetaFinal: copyTheta(org.neural.thetaLive),
    ledgerResidual,
    trace,
  };
}

/**
 * Bir koşu dizisini özetler. **Hiçbir koşu düşürülmez** — koşu sayısı
 * `outcomes.length` olarak raporlanır (JMLR 2024, "hiçbir koşu atılmaz").
 */
export function summarizeTrials(results: readonly TrialResult[]): {
  n: number;
  meanEnergyNorm: number;
  survived: number;
  meanLearningUpdates: number;
  worstResidual: number;
} {
  if (results.length === 0) {
    return { n: 0, meanEnergyNorm: Number.NaN, survived: 0, meanLearningUpdates: 0, worstResidual: 0 };
  }
  let sum = 0;
  let survived = 0;
  let updates = 0;
  let worstResidual = 0;
  for (const r of results) {
    sum += r.meanEnergyNorm;
    if (r.survivedToEnd) survived++;
    updates += r.learningUpdates;
    const abs = Math.abs(r.ledgerResidual);
    if (abs > Math.abs(worstResidual)) worstResidual = r.ledgerResidual;
  }
  return {
    n: results.length,
    meanEnergyNorm: sum / results.length,
    survived,
    meanLearningUpdates: updates / results.length,
    worstResidual,
  };
}

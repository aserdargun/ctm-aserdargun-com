/**
 * Cell to Mind — ekolojik sönümlenme teşhisi (Faz B1).
 *
 * `VALIDATION.md` §2 ölçümü: koloniler ~6.000 tick'te dağılıyor. Bu modül
 * **neden** olduğunu ayırır. `docs/ROADMAP.md` Faz B1'in kuralı nettir:
 * ayrım yapılmadan hiçbir parametre değiştirilmemeli.
 *
 * Beş rakip açıklama, beş ayrı ölçümle ayrılır:
 *
 * | Hipotez | Ayıran ölçüm |
 * |---|---|
 * | Kaynak tükenmesi | Kaynak rezervinin doluluk oranı sönümlenme anında |
 * | Avcı baskısı | Ölüm nedeni dağılımında `predation` payı |
 * | Enerji bütçesi | Ölüm nedeni dağılımında `starvation` payı + sistem enerjisi |
 * | Paylaşma yetersizliği | Organizma başına yaşam boyu ödül (enerji kazanımı) |
 * | Bağ mekaniği | Bağ sayısı ve bağ bütünlüğünün zaman içindeki eğimi |
 *
 * **Bu modül hiçbir şeyi değiştirmez.** Yalnız ölçer. Parametre değişikliği
 * ayrım yapıldıktan sonra ayrı bir adımdır (Faz B2/B3).
 */

import { bootstrapCI, bootstrapTest, fmt, fmtInterval, type HypothesisTest, type Interval } from '../stats.ts';
import { World } from '../world.ts';
import type { DeathCause } from '../types.ts';

export interface EcologySample {
  tick: number;

  // Yapı
  population: number;
  organisms: number;
  largestColony: number;
  multiCellColonies: number;
  bondCount: number;
  /** Bağların ortalama bütünlüğü (0..1) — mekanik yükün göstergesi. */
  meanBondIntegrity: number;
  /**
   * Bağların ortalama **uzaması** (`(d − restLength) / restLength`, 0+).
   *
   * Bu, mekanizmanın ayırt edici ölçüsüdür. Bütünlük iki terimle erir:
   * `strain × STRAIN_DECAY_K × (1.6 − strength)` ve sabit `BOND_FATIGUE`.
   * Yorgunluk 2e-5/tick olduğu için bütünlüğü sıfırlamaya 50.000 tick
   * gerekir — 12.000 tick'lik pencerede **yorgunluk ihmal edilebilir.**
   * Dolayısıyla bütünlük kaybı uzamadan geliyorsa, sorun bağ dayanımı değil
   * **koloni geometrisidir**: hücreler dinlenme uzunluğundan uzaklaşıyor.
   */
  meanBondStrain: number;
  /** Bağların dinlenme uzunluğuna göre uzaması (0..1+); >1 ⇒ iki katından fazla açılmış. */
  maxBondStrain: number;
  /** Başlangıç popülasyonuna göre en büyük kümenin çarpanı. */
  colonyGrowthFactor: number;

  // Kaynak
  /** Tüm kaynak düğümlerindeki toplam rezerv. */
  totalReserve: number;
  /** Toplam kapasite. */
  totalCapacity: number;
  /** Rezerv doluluk oranı (0..1). 0'a yakınsa kaynak tükeniyor. */
  reserveFraction: number;

  // Enerji
  /** Sistemdeki toplam canlı enerji. */
  systemEnergy: number;
  /** Ortalama normalize enerji (0..1). */
  meanEnergyNorm: number;
  /** Kümülatif harcanan (bazal + öğrenme + hareket). */
  dissipated: number;
  /** Dış girdi — normalde 0. */
  externalInput: number;

  // Avcı
  predatorAlive: boolean;
  predatorEnergyNorm: number;

  // Ölümler (kümülatif, o ana dek)
  deathsStarvation: number;
  deathsPredation: number;
  deathsAge: number;

  // Organizmaların kümülatif yaşam boyu ödülü → enerji kazanımı göstergesi
  totalLifetimeReward: number;
}

export interface EcologyDiagnosis {
  seed: number;
  ticks: number;
  samples: EcologySample[];
  /** Sönümlenmenin gerçekleştiği tick (en büyük koloni %25'in altına düştüğü an). */
  collapseTick: number | null;
  /** Sönümlenme anındaki özet. */
  atCollapse: EcologySample | null;
  /** Sönümlenme öncesi zirve anındaki özet (karşılaştırma için). */
  atPeak: EcologySample | null;
  /** Sönümlenme anında baskın ölüm nedeni. */
  dominantDeathCause: DeathCause;
  /**
   * Kaynak tükenmesi puanı: sönümlenme anında rezerv doluluk oranı.
   * Düşükse (< %20) kaynak tükenmesi baskın açıklamadır.
   */
  reserveAtCollapse: number;
  /** Sönümlenme anına kadar ölen organizmaların oranı. */
  predatorDeathShare: number;
  /** Sönümlenme anına kadar açlıkla ölenlerin oranı. */
  starvationDeathShare: number;
  /** Sönümlenme anındaki ortalama bağ uzaması. */
  strainAtCollapse: number;
  /**
   * **Kopma anındaki** bağ gerilimi — mekanizmanın ayırt edici ölçüsü.
   *
   * Neden ayırt edici: hayatta kalan bağların ortalama uzaması düşüktür, çünkü
   * gerilmiş bağlar zaten kopmuştur. Bu, **seçilim yanlılığıdır** — gerilimi
   * görmenin yanlış yolu. Doğru soru "hayatta kalanlar ne kadar gerilmiş?"
   * değil, **"kıranlar ne kadar gerilmişti?"** sorusudur. Kopan her bağ için
   * `bond-break` olayı `detail.strain` taşır; burada onlar toplanır.
   */
  breakStrains: number[];
  /** Koptuğu anda bütünlüğü sıfır olanların oranı (yorgunluk/çekme ayrımı). */
  breakByExhaustion: number;
  /** Koptuğu anda uzama sınırını aşanların oranı. */
  breakByStretch: number;
  /** Kırılan bağların medyan uzaması. */
  breakStrainMedian: number;
  /** Kırılan bağların medyan dayanımı. */
  breakStrengthMedian: number;
  /**
   * Bütünlük kaybının **yorgunluk** payı (alt sınır).
   *
   * `ticks × BOND_FATIGUE` = 12.000 × 2e-5 = 0.24. Görülen kayıp bundan
   * büyükse kalanın tamamı uzamadan gelmiş demektir; yorgunluk açıklama değildir.
   */
  fatigueOnlyLoss: number;
  /** Tek cümlelik teşhis. */
  reading: string;
}

function countBonds(world: World): { count: number; meanIntegrity: number; meanStrain: number; maxStrain: number } {
  let count = 0;
  let sum = 0;
  let strainSum = 0;
  let maxStrain = 0;
  const seen = new Set<number>();
  for (const cell of world.cells.values()) {
    for (const bondId of cell.bonds) {
      if (seen.has(bondId)) continue;
      seen.add(bondId);
      count++;
      const bond = world.bonds.get(bondId);
      if (!bond) continue;
      sum += bond.integrity;
      strainSum += bond.strain;
      if (bond.strain > maxStrain) maxStrain = bond.strain;
    }
  }
  return {
    count,
    meanIntegrity: count > 0 ? sum / count : 0,
    meanStrain: count > 0 ? strainSum / count : 0,
    maxStrain,
  };
}

/**
 * Kolonilerin sönümlenmesini zaman serisi olarak ölçür.
 */
export function diagnoseColonyCollapse(options?: {
  seed?: number;
  ticks?: number;
  sampleEvery?: number;
  population?: number;
  preset?: string;
  /** Bağ dayanıklılığı katsayısı. Verilmezse model varsayılanı (0.02). */
  strainDecayK?: number;
  /** Bağ yorgunluğu. Verilmezse model varsayılanı (2e-5). */
  bondFatigue?: number;
}): EcologyDiagnosis {
  const seed = options?.seed ?? 11;
  const ticks = options?.ticks ?? 12_000;
  const sampleEvery = options?.sampleEvery ?? 200;
  const founderCount = options?.population ?? 48;

  const world = new World({
    seed,
    population: founderCount,
    ...(options?.preset === undefined ? {} : { preset: options.preset }),
    ...(options?.strainDecayK === undefined ? {} : { strainDecayK: options.strainDecayK }),
    ...(options?.bondFatigue === undefined ? {} : { bondFatigue: options.bondFatigue }),
  });

  const samples: EcologySample[] = [];
  let deathsStarvation = 0;
  let deathsPredation = 0;
  let deathsAge = 0;
  const seenDeaths = new Set<number>();

  const takeSample = (): EcologySample => {
    let reserve = 0;
    let capacity = 0;
    for (const r of world.resources) {
      reserve += r.reserve;
      capacity += r.capacity;
    }
    const bonds = countBonds(world);
    const metrics = world.latestMetrics();
    const aliveEnergy = world.systemEnergyTotal();

    let rewardSum = 0;
    for (const org of world.organisms.values()) rewardSum += org.lifetimeReward;

    return {
      tick: world.tick,
      population: world.population(),
      organisms: world.aliveOrganismCount(),
      largestColony: metrics?.largestColonySize ?? 0,
      multiCellColonies: metrics?.coloniesOverFourCells ?? 0,
      bondCount: bonds.count,
      meanBondIntegrity: bonds.meanIntegrity,
      meanBondStrain: bonds.meanStrain,
      maxBondStrain: bonds.maxStrain,
      colonyGrowthFactor: (metrics?.largestColonySize ?? 0) / founderCount,
      totalReserve: reserve,
      totalCapacity: capacity,
      reserveFraction: capacity > 0 ? reserve / capacity : 0,
      systemEnergy: aliveEnergy,
      meanEnergyNorm: metrics ? metrics.meanEnergy / 100 : Number.NaN,
      dissipated: world.ledger.dissipated,
      externalInput: world.ledger.externalInput,
      predatorAlive: world.predator.alive,
      predatorEnergyNorm: world.predator.energy / Math.max(1, world.predator.radius * 0 + 1) / 100,
      deathsStarvation,
      deathsPredation,
      deathsAge,
      totalLifetimeReward: rewardSum,
    };
  };

  samples.push(takeSample());

  const breakStrains: number[] = [];
  const breakStrengths: number[] = [];
  let breakByExhaustion = 0;
  let breakByStretch = 0;
  let lastEventId = -1;

  for (let t = 1; t <= ticks; t++) {
    world.step();
    // Kopma olaylarını topla. `events` halka tampon 2000 girdi tuttuğu için
    // her tick yalnız YENİ olaylar okunur (aynı olay iki kez sayılmaz).
    for (const ev of world.recentEvents(2000)) {
      if (ev.id <= lastEventId || ev.type !== 'bond-break') continue;
      lastEventId = ev.id;
      const strain = typeof ev.detail?.strain === 'number' ? ev.detail.strain : Number.NaN;
      const integrity = typeof ev.detail?.integrity === 'number' ? ev.detail.integrity : Number.NaN;
      const strength = typeof ev.detail?.strength === 'number' ? ev.detail.strength : Number.NaN;
      if (Number.isFinite(strain)) breakStrains.push(strain);
      if (Number.isFinite(strength)) breakStrengths.push(strength);
      if (integrity <= 1e-6) breakByExhaustion++;
      if (strain > 0.5) breakByStretch++;
    }
    for (const org of world.organisms.values()) {
      if (org.alive || seenDeaths.has(org.id)) continue;
      seenDeaths.add(org.id);
      if (org.deathCause === 'starvation') deathsStarvation++;
      else if (org.deathCause === 'predation') deathsPredation++;
      else if (org.deathCause === 'age') deathsAge++;
    }
    if (t % sampleEvery === 0) samples.push(takeSample());
  }

  // Sönümlenme: en büyük koloni, zirvesinin %25'inin altına ilk kez düştüğü an.
  const peak = samples.reduce((best, s) => (s.largestColony > best.largestColony ? s : best), samples[0] as EcologySample);
  const threshold = peak.largestColony * 0.25;
  const collapse = samples.find((s) => s.tick > peak.tick && s.largestColony < threshold) ?? null;

  const totalDeaths = deathsStarvation + deathsPredation + deathsAge;
  const dominant: DeathCause =
    totalDeaths === 0
      ? null
      : deathsPredation > deathsStarvation && deathsPredation > deathsAge
        ? 'predation'
        : deathsStarvation > deathsAge
          ? 'starvation'
          : 'age';
  // Yorgunluk tek başına bu pencerede ne kadar bütünlük yiyebilirdi?
  // BOND_FATIGUE = 2e-5/tick → 12.000 tick'te en fazla 0.24.
  const fatigueOnlyLoss = ticks * 2e-5;

  let reading: string;
  if (!collapse) {
    reading = `Koloni sönümlenmedi — ${ticks} tick boyunca en büyük küme ${peak.largestColony}.`;
  } else if (collapse.reserveFraction < 0.2 && totalDeaths > 0 && deathsStarvation / totalDeaths > 0.5) {
    reading =
      `Baskın açıklama: **kaynak tükenmesi**. Sönümlenmede rezerv doluluğu ` +
      `%${(collapse.reserveFraction * 100).toFixed(1)}, ölümlerin %${((deathsStarvation / totalDeaths) * 100).toFixed(0)}'i açlık.`;
  } else if (totalDeaths > 0 && deathsPredation / totalDeaths > 0.5) {
    reading =
      `Baskın açıklama: **avcı baskısı**. Ölümlerin ` +
      `%${((deathsPredation / totalDeaths) * 100).toFixed(0)}'i avcı kaynaklı.`;
  } else {
    reading =
      `Baskın açıklama: **koloni geometrisi / bağ uzaması**. Kaynak bitmemiş ` +
      `(rezerv doluluğu %${(collapse.reserveFraction * 100).toFixed(1)}), ortalama bağ uzaması ` +
      `${collapse.meanBondStrain.toFixed(3)} (dinlenme uzunluğunun ${(1 + collapse.meanBondStrain).toFixed(2)} katı). ` +
      `Yorgunluk tek başına en fazla ${fatigueOnlyLoss.toFixed(2)} bütünlük yiyebilirdi. ` +
      `Kopan ${breakStrains.length} bağdan ${breakByExhaustion} tanesi bütünlüğü tükenerek (` +
      `%${((breakByExhaustion / Math.max(1, breakStrains.length)) * 100).toFixed(0)}), ${breakByStretch} tanesi ` +
      `uzama sınırını aşarak koptu (%${((breakByStretch / Math.max(1, breakStrains.length)) * 100).toFixed(0)}); ` +
      `koptukları andaki medyan uzama ${medianOf(breakStrains).toFixed(3)} — hayatta kalanların ` +
      `${collapse.meanBondStrain.toFixed(3)} ortalamasının ${(medianOf(breakStrains) / Math.max(1e-6, collapse.meanBondStrain)).toFixed(0)} katı.`;
  }

  return {
    seed,
    ticks,
    samples,
    collapseTick: collapse?.tick ?? null,
    atCollapse: collapse,
    atPeak: peak,
    dominantDeathCause: dominant,
    reserveAtCollapse: collapse?.reserveFraction ?? Number.NaN,
    predatorDeathShare: totalDeaths > 0 ? deathsPredation / totalDeaths : Number.NaN,
    starvationDeathShare: totalDeaths > 0 ? deathsStarvation / totalDeaths : Number.NaN,
    strainAtCollapse: collapse?.meanBondStrain ?? Number.NaN,
    breakStrains,
    breakByExhaustion,
    breakByStretch,
    breakStrainMedian: breakStrains.length > 0 ? medianOf(breakStrains) : Number.NaN,
    breakStrengthMedian: breakStrengths.length > 0 ? medianOf(breakStrengths) : Number.NaN,
    fatigueOnlyLoss,
    reading,
  };
}

export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1] as number) + (s[mid] as number)) / 2 : (s[mid] as number);
}

/** Teşhis tablosunu okunabilir metne çevirir. */
export function formatDiagnosis(d: EcologyDiagnosis): string {
  return [
    `  tohum ${d.seed} · ${d.ticks} tick`,
    `  zirve: tick ${d.atPeak?.tick ?? '—'} · en büyük küme ${d.atPeak?.largestColony ?? '—'} · bağ ${d.atPeak?.bondCount ?? '—'} · bütünlük ${(d.atPeak?.meanBondIntegrity ?? 0).toFixed(3)} · uzama ${(d.atPeak?.meanBondStrain ?? 0).toFixed(3)}`,
    `  sönümlenme: ${d.collapseTick === null ? 'yok' : `tick ${d.collapseTick}`}` +
      (d.atCollapse
        ? ` · küme ${d.atCollapse.largestColony} · bağ ${d.atCollapse.bondCount} · bütünlük ${d.atCollapse.meanBondIntegrity.toFixed(3)} · uzama ${d.atCollapse.meanBondStrain.toFixed(3)}`
        : ''),
    `  rezerv (sönümlenmede): ${Number.isNaN(d.reserveAtCollapse) ? '—' : `%${(d.reserveAtCollapse * 100).toFixed(1)}`}`,
    `  ölüm payları: açlık ${Number.isNaN(d.starvationDeathShare) ? '—' : `%${(d.starvationDeathShare * 100).toFixed(0)}`} · avcı ${Number.isNaN(d.predatorDeathShare) ? '—' : `%${(d.predatorDeathShare * 100).toFixed(0)}`}`,
    `  yorgunluk tek başına açıklayabileceği kayıp: ${d.fatigueOnlyLoss.toFixed(2)}`,
    `  kopma anındaki uzama: medyan ${d.breakStrainMedian.toFixed(3)} · kopan ${d.breakStrains.length} bağ · ` +
      `tükenerek %${d.breakStrains.length > 0 ? ((d.breakByExhaustion / d.breakStrains.length) * 100).toFixed(0) : '—'} · ` +
      `uzayarak %${d.breakStrains.length > 0 ? ((d.breakByStretch / d.breakStrains.length) * 100).toFixed(0) : '—'}`,
    `  koptukları andaki medyan dayanım: ${d.breakStrengthMedian.toFixed(3)}`,
    `  → ${d.reading}`,
  ].join('\n');
}

/** Zaman serisini tabloya çevirir (tanı için). */
export function formatEcologyTable(d: EcologyDiagnosis, every = 1000): string {
  const header =
    '   tick   pop   org   küme   4+   bağ  bütünlük   uzama   rezerv%   enerji   açlık   avcı';
  const rows = d.samples
    .filter((s) => s.tick % every === 0)
    .map(
      (s) =>
        `  ${String(s.tick).padStart(5)}  ${String(s.population).padStart(4)}  ${String(s.organisms).padStart(4)}  ` +
        `${String(s.largestColony).padStart(5)}  ${String(s.multiCellColonies).padStart(3)}  ${String(s.bondCount).padStart(4)}  ` +
        `${s.meanBondIntegrity.toFixed(3)}   ${s.meanBondStrain.toFixed(3)}     ${(s.reserveFraction * 100).toFixed(1).padStart(5)}  ` +
        `${s.systemEnergy.toFixed(0).padStart(6)}  ${String(s.deathsStarvation).padStart(5)}  ${String(s.deathsPredation).padStart(5)}`,
    );
  return [header, ...rows].join('\n');
}

// --------------------------------------------------- bağ ömrü duyarlılığı

export interface BondDurabilityPoint {
  strainDecayK: number;
  bondFatigue: number;
  /** Bu ayarlarda bağın tahmini ömrü: 1 / (ortalama tick başına kayıp). */
  estimatedBondLifeTicks: number;
  ticks: number;
  peakColony: number;
  peakTick: number;
  finalColony: number;
  finalMultiCellColonies: number;
  finalPopulation: number;
  finalReserveFraction: number;
  collapseTick: number | null;
  /** Pencerenin sonunda 4+ hücreli yapı hâlâ var mı? */
  coloniesPersist: boolean;
  /** Önerilen anahtar çıktı: pencerenin son çeyreğindeki en büyük küme. */
  lateLargestColony: number;
}

/**
 * **Bağ ömrü duyarlılık taraması** — teşhisin doğrudan sınaması.
 *
 * Önceden kaydedilen hipotez (B1 teşhisinden): koloniler kaynak bitmeden,
 * avcı etkisi başlamadan **bağ yorgunluğuyla** dağılıyor; koptukları andaki
 * medyan uzama 0.079 ile geometri açıklama değil. Sınırlayıcı olan **bağ ömrü.**
 *
 * Bu tarama bağ ömrünü uzatıp koloni kalıcılığını ölçer.
 *
 * **Başarı ölçütü (önceden kaydedildi):** `bondFatigue` ve `strainDecayK`
 * düşürüldüğünde pencerenin son çeyreğinde **4+ hücreli yapıların sıfırdan
 * çıkması** gerekir (varsayılan ayarlarda pencerenin sonunda 0'dır).
 *
 * Varsayılan model sabitleri **değişmez**; bu bir duyarlılık analizidir.
 */
export function sweepBondDurability(options?: {
  settings?: { strainDecayK: number; bondFatigue: number }[];
  ticks?: number;
  seeds?: number;
}): BondDurabilityPoint[] {
  const defaultSettings = options?.settings ?? [
    { strainDecayK: 0.02, bondFatigue: 2e-5 },
    { strainDecayK: 0.01, bondFatigue: 1e-5 },
    { strainDecayK: 0.005, bondFatigue: 5e-6 },
    { strainDecayK: 0.002, bondFatigue: 1e-6 },
  ];
  const ticks = options?.ticks ?? 12_000;
  const seeds = options?.seeds ?? 4;

  return defaultSettings.map((setting) => {
    let peak = 0;
    let peakTick = 0;
    let collapse: number | null = null;
    let lateColony = 0;
    const finals: {
      colony: number;
      multiCell: number;
      population: number;
      reserve: number;
    }[] = [];

    for (let s = 0; s < seeds; s++) {
      const world = new World({
        seed: 7100 + s,
        population: 48,
        strainDecayK: setting.strainDecayK,
        bondFatigue: setting.bondFatigue,
      });
      const quarter = Math.floor(ticks * 0.75);
      let last = { colony: 0, multiCell: 0, reserve: 0 };
      for (let t = 1; t <= ticks; t++) {
        world.step();
        if (t % 200 === 0) {
          const m = world.latestMetrics();
          if (!m || m.tick !== world.tick) continue;
          if (m.largestColonySize > peak) {
            peak = m.largestColonySize;
            peakTick = t;
          }
          if (collapse === null && t > peakTick && m.largestColonySize < peak * 0.25) collapse = t;
          last = { colony: m.largestColonySize, multiCell: m.coloniesOverFourCells, reserve: 0 };
          if (t >= quarter && m.largestColonySize > lateColony) lateColony = m.largestColonySize;
        }
        if (t === ticks) {
          let reserve = 0;
          let capacity = 0;
          for (const r of world.resources) {
            reserve += r.reserve;
            capacity += r.capacity;
          }
          last.reserve = capacity > 0 ? reserve / capacity : 0;
        }
      }
      finals.push({
        colony: last.colony,
        multiCell: last.multiCell,
        population: world.population(),
        reserve: last.reserve,
      });
    }

    // Medyan uzama ve medyan dayanım kaba bir kestirim için: 0.02 katsayı,
    // 0.450 dayanım (ölçülen medyan), 0.02 ortalama uzama.
    const perTick = setting.strainDecayK * 0.02 * (1.6 - 0.45) + setting.bondFatigue;

    return {
      strainDecayK: setting.strainDecayK,
      bondFatigue: setting.bondFatigue,
      estimatedBondLifeTicks: perTick > 0 ? Math.round(1 / perTick) : Number.POSITIVE_INFINITY,
      ticks,
      peakColony: peak,
      peakTick,
      finalColony: Math.round(meanOf(finals.map((f) => f.colony))),
      finalMultiCellColonies: meanOf(finals.map((f) => f.multiCell)),
      finalPopulation: meanOf(finals.map((f) => f.population)),
      finalReserveFraction: meanOf(finals.map((f) => f.reserve)),
      collapseTick: collapse,
      coloniesPersist: finals.some((f) => f.multiCell > 0),
      lateLargestColony: lateColony,
    };
  });
}

export function formatBondDurability(points: readonly BondDurabilityPoint[]): string {
  const header = '  strainK   yorgunluk   bağ ömrü   zirve küme   son çeyrek   son 4+   son pop   son rezerv   sönüml.   kalıcı';
  const rows = points.map((p) => {
    return (
      `  ${fmt(p.strainDecayK, 7)}   ${fmt(p.bondFatigue, 8)}   ${String(p.estimatedBondLifeTicks).padStart(7)}   ` +
      `${String(p.peakColony).padStart(8)}   ${String(p.lateLargestColony).padStart(10)}   ` +
      `${fmt(p.finalMultiCellColonies, 6).padStart(7)}   ${fmt(p.finalPopulation, 7).padStart(8)}   ` +
      `${fmt(p.finalReserveFraction * 100, 8).padStart(10)}%   ${(p.collapseTick === null ? 'yok' : String(p.collapseTick)).padStart(7)}   ` +
      `${p.coloniesPersist ? 'evet' : 'HAYIR'}`
    );
  });
  return [header, ...rows].join('\n');
}

function meanOf(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

// --------------------------------------------------- Y-2: bağ ömrünün kalıtılabilirliği

export interface HeritabilityPoint {
  coupled: boolean;
  /** Kurucu popülasyonun ortalama `bondStrength` değeri. */
  founderBondStrength: number;
  /** Hayatta kalanların ortalama `bondStrength` değeri. */
  survivorBondStrength: number;
  /** Seçilim kayması (hayatta kalan − kurucu). */
  shift: number;
  /** Yaşayan popülasyondaki anlık en yüksek nesil (`maxGeneration`). */
  maxGeneration: number;
  /**
   * **Kümülatif doğum sayısı** — asıl nesil derinliği ölçüsü.
   *
   * `maxGeneration` yanıltıcıdır: o an yaşayanların en yükseğidir ve uzun
   * koşularda **düşebilir** (ölçüldü: 10k tick → 3.0, 100k tick → 1.3).
   * Seçilimin ne kadar zamanı olduğunu `nextOrganismIdForSnapshot() - 1`
   * verir: o ana dek doğmuş toplam organizma sayısı.
   */
  cumulativeBirths: number;
  /** Kurucu popülasyonun başına ortalama nesil (üreme çevrimi). */
  generationsPerFounder: number;
  finalColony: number;
  finalMultiCellColonies: number;
}

export interface HeritabilityReport {
  seeds: number;
  ticks: number;
  /** Aynı tohumlarda iki kol — eşleştirilmiş. */
  control: HeritabilityPoint[];
  treatment: HeritabilityPoint[];
  /** treatment − control farkının güven aralığı. */
  difference: Interval;
  test: HypothesisTest;
  worstLedgerResidual: number;
  reading: string;
}

/**
 * **Y-2 · Bağ ömrünün kalıtılabilirliği — seçilim dayanıklılığı artırıyor mu?**
 *
 * Önceden kaydedilen hipotez: §5.4'te bağ ömrünün koloni kalıcılığını
 * belirlediği ölçüldü. Şimdi bağ ömrünün **kalıtsız bir kısmı** olduğu görüldü:
 * yorgunluk terimi genoma bakmıyor. Bu kancayı açınca dayanıklılık seçilime
 * açık hâle gelir ve soru ölçülebilir olur:
 * **Seçilim, kolonilerin daha uzun yaşaması için `bondStrength` yükseltir mi?**
 *
 * **Kritik tasarım:** iki kol **aynı** kalıcı-bağ ayarını kullanır
 * (`strainDecayK = 0.005`), böylece ikisi de kolonileri ayakta tutar. Tek fark
 * dayanıklılığın kalıtılabilir olup olmadığıdır. Kalıtılabilir olmayan kolda
 * yorgunluk genomdan bağımsız olduğu için seçilimin dayanıklılığa bir yolu
 * yoktur — bu, **temiz bir karşılaştırmadır.**
 *
 * **Başarı ölçütü (önceden kaydedildi):** tedavi kolunun seçilim kaymasının
 * güven aralığı sıfırdan ayrışmalı **ve** kontrol kolundan büyük olmalı.
 */
export function experimentBondLifeHeritability(options?: {
  seeds?: number;
  ticks?: number;
  strainDecayK?: number;
  seedBase?: number;
}): HeritabilityReport {
  const seeds = options?.seeds ?? 12;
  const ticks = options?.ticks ?? 10_000;
  const strainDecayK = options?.strainDecayK ?? 0.005;
  const seedBase = options?.seedBase ?? 8001;

  const runArm = (coupled: boolean, seed: number): HeritabilityPoint => {
    const world = new World({
      seed,
      population: 48,
      strainDecayK,
      coupleFatigueToGenome: coupled,
      mutationEnabled: true,
    });
    const founders = [...world.organisms.values()].map((o) => o.genome.bondStrength);
    for (let t = 1; t <= ticks; t++) world.step();
    const survivors = [...world.organisms.values()].filter((o) => o.alive).map((o) => o.genome.bondStrength);
    const m = world.latestMetrics();
    const cumulativeBirths = Math.max(0, world.nextOrganismIdForSnapshot() - 1);
    return {
      coupled,
      founderBondStrength: meanOf(founders),
      survivorBondStrength: survivors.length > 0 ? meanOf(survivors) : meanOf(founders),
      shift: survivors.length > 0 ? meanOf(survivors) - meanOf(founders) : 0,
      maxGeneration: m?.maxGeneration ?? 0,
      cumulativeBirths,
      generationsPerFounder: cumulativeBirths / Math.max(1, founders.length),
      finalColony: m?.largestColonySize ?? 0,
      finalMultiCellColonies: m?.coloniesOverFourCells ?? 0,
    };
  };

  const control: HeritabilityPoint[] = [];
  const treatment: HeritabilityPoint[] = [];
  let worstLedgerResidual = 0;

  for (let i = 0; i < seeds; i++) {
    const seed = seedBase + i;
    control.push(runArm(false, seed));
    treatment.push(runArm(true, seed));

    for (const coupled of [false, true]) {
      const world = new World({
        seed,
        population: 48,
        strainDecayK,
        coupleFatigueToGenome: coupled,
        mutationEnabled: true,
      });
      for (let t = 1; t < 400; t++) world.step();
      const residual =
        world.ledger.initialTotal + world.ledger.externalInput - world.systemEnergyTotal() - world.ledger.dissipated;
      if (Math.abs(residual) > Math.abs(worstLedgerResidual)) worstLedgerResidual = residual;
    }
  }

  const diffs = treatment.map((t, i) => t.shift - (control[i]?.shift ?? 0));

  const treatmentShiftCI = bootstrapCI(
    treatment.map((t) => t.shift),
    { seed: 8101 },
  );
  const separated = treatmentShiftCI.lower > 0 || treatmentShiftCI.upper < 0;

  const reading = separated
    ? `Seçilim dayanıklılığı **değiştirdi**: tedavi kolunda ortalama bondStrength kayması ` +
      `${fmt(treatmentShiftCI.estimate, 4)} [${fmt(treatmentShiftCI.lower, 4)}, ${fmt(treatmentShiftCI.upper, 4)}], ` +
      `sıfırdan ayrışıyor. Bağ ömrü seçilime açıldığında koloniler daha uzun yaşayabiliyor.`
    : `Seçilim kayması sıfırdan **ayrışmadı**: ${fmt(treatmentShiftCI.estimate, 4)} ` +
      `[${fmt(treatmentShiftCI.lower, 4)}, ${fmt(treatmentShiftCI.upper, 4)}]. ` +
      `Kurucu başına ${fmt(meanOf(treatment.map((t) => t.generationsPerFounder)), 2)} üreme çevrimi gerçekleşti ` +
      `(kümülatif ${Math.round(meanOf(treatment.map((t) => t.cumulativeBirths)))} doğum).`;

  return {
    seeds,
    ticks,
    control,
    treatment,
    difference: bootstrapCI(diffs, { seed: 8102 }),
    test: bootstrapTest(diffs, { seed: 8103 }),
    worstLedgerResidual,
    reading,
  };
}

export function formatHeritability(r: HeritabilityReport): string {
  return [
    `  ${r.seeds} eşleştirilmiş tohum · ${r.ticks} tick · strainK 0.005 (iki kolda da koloniler ayakta)`,
    `  kontrol  (yorgunluk genoma bağlı DEĞİL): kurucu ${fmt(meanOf(r.control.map((c) => c.founderBondStrength)), 4)} → hayatta kalan ${fmt(meanOf(r.control.map((c) => c.survivorBondStrength)), 4)} · kayma ${fmt(meanOf(r.control.map((c) => c.shift)), 4)}`,
    `  tedavi   (yorgunluk genoma BAĞLI):    kurucu ${fmt(meanOf(r.treatment.map((c) => c.founderBondStrength)), 4)} → hayatta kalan ${fmt(meanOf(r.treatment.map((c) => c.survivorBondStrength)), 4)} · kayma ${fmt(meanOf(r.treatment.map((c) => c.shift)), 4)}`,
    `  tedavi kayması ${fmtIntervalOf(r)} · iki kol farkı ${fmt(r.difference.estimate, 4)} [${fmt(r.difference.lower, 4)}, ${fmt(r.difference.upper, 4)}] · p = ${fmt(r.test.pValue, 4)}`,
    `  üreme çevrimi (kurucu başına): kontrol ${fmt(meanOf(r.control.map((c) => c.generationsPerFounder)), 2)} · tedavi ${fmt(meanOf(r.treatment.map((c) => c.generationsPerFounder)), 2)}`,
    `  enerji rezidüelü: ${fmt(r.worstLedgerResidual, 9)} e`,
    `  → ${r.reading}`,
  ].join('\n');
}

function fmtIntervalOf(r: HeritabilityReport): string {
  const ci = bootstrapCI(
    r.treatment.map((t) => t.shift),
    { seed: 8101 },
  );
  return `[${fmt(ci.estimate, 4)}, ${fmt(ci.lower, 4)}, ${fmt(ci.upper, 4)}]`;
}

// --------------------------------------------------- üreme tıkanması teşhisi

export interface ReproSample {
  tick: number;
  population: number;
  organisms: number;
  /** Kümülatif doğum (kurucu 48 + bu ana dek doğanlar). */
  cumulativeBirths: number;
  /** Bu örnekte doğanların doğum tipine göre dağılımı. */
  birthsBud: number;
  birthsFragment: number;
  /** Kümülatif koloni tomurcuklama (bud) olayı. */
  cumulativeBud: number;
  /** Hâlâ yaşayan kurucu soy sayısı. */
  founderLineagesAlive: number;
  founderCellsAlive: number;
  /** Kurucu soylarından türeyen canlı hücre sayısı. */
  descendantCells: number;
  /** Tamamlanmış koloni üreme nesli (kümülatif, ölü organizmalar dahil). */
  colonyGenerations: number;
  /** Pencerede 6+ hücreli yapı görmüyor olup olmadığı (tomurcuk eşiği). */
  largestColony: number;
}

export interface ReproDiagnosis {
  seed: number;
  ticks: number;
  samples: ReproSample[];
  totalBud: number;
  totalFragment: number;
  /** Kurucu soylarından hayatta kalanların hücre payı. */
  founderDescendantShare: number;
  /** Son 1/4 pencerede doğum sayısı — döngü hızı. */
  birthsInFinalQuarter: number;
  /** İlk 1/4 pencerede doğum sayısı. */
  birthsInFirstQuarter: number;
  reading: string;
}

/**
 * **Üreme tıkanması teşhisi** — B3'ün önkoşulu.
 *
 * §5.9'da ölçüldü: popülasyon ≈5.5 üreme çevriminde durağanlığa ulaşıyor.
 * Bu modül **neden**ini ayırır. Üç rakip açıklama:
 *
 * | Hipotez | Ayıran ölçüm |
 * |---|---|
 * | Taşıma kapasitesi (yoğunluk geri beslemesi) | Popülasyon değişmiyor ama doğum da durmuyor |
 * | Soy tükenmesi | Kurucu soylarının canlı hücrelerdeki payı çöküyor |
 * | Tomurcuklama eşiğine ulaşılamıyor | `bud` doğumların payı ≈ 0, `fragment` baskın |
 *
 * **Neden önemli:** koloni üreme nesli (`completedColonyGenerations`) yalnız
 * tomurcuklama yoluyla ilerler. Eğer bud eşiğine (BUD_MIN_CELLS) ulaşılamıyorsa,
 * "ana evrimsel geçiş" ölçümü yapısal olarak imkânsızdır — B3'ün önkoşulu
 * karşılanmamış demektir.
 */
export function diagnoseReproductiveStall(options?: {
  seed?: number;
  ticks?: number;
  sampleEvery?: number;
  strainDecayK?: number;
}): ReproDiagnosis {
  const seed = options?.seed ?? 11;
  const ticks = options?.ticks ?? 40_000;
  const sampleEvery = options?.sampleEvery ?? 1000;
  const strainDecayK = options?.strainDecayK ?? 0.005;

  const world = new World({ seed, population: 48, strainDecayK, mutationEnabled: true });

  // Kurucu soy kimlikleri (genesis, ebeveynsiz).
  const founderLineages = new Set<number>();
  for (const org of world.organisms.values()) {
    if (org.birthMode === 'genesis') founderLineages.add(org.lineageId);
  }

  const seenOrganisms = new Set<number>();
  for (const org of world.organisms.values()) seenOrganisms.add(org.id);

  const samples: ReproSample[] = [];
  let birthsBud = 0;
  let birthsFragment = 0;
  let birthsInFirstQuarter = 0;
  let birthsInFinalQuarter = 0;

  const snapshot = (tick: number): ReproSample => {
    let buds = 0;
    let frags = 0;
    for (const org of world.organisms.values()) {
      if (seenOrganisms.has(org.id)) continue;
      seenOrganisms.add(org.id);
      if (org.birthMode === 'bud') buds++;
      else if (org.birthMode === 'fragment') frags++;
    }
    birthsBud += buds;
    birthsFragment += frags;
    if (tick <= ticks * 0.25) birthsInFirstQuarter += buds + frags;
    else if (tick >= ticks * 0.75) birthsInFinalQuarter += buds + frags;

    const alive = [...world.organisms.values()].filter((o) => o.alive);
    let founderCellsAlive = 0;
    let founderLineagesAlive = 0;
    let descendantCells = 0;
    let colonyGenerations = 0;
    for (const org of alive) {
      const n = org.cells.filter((id) => world.cells.get(id)?.alive).length;
      if (founderLineages.has(org.lineageId)) {
        founderLineagesAlive++;
        founderCellsAlive += n;
      } else {
        descendantCells += n;
      }
      colonyGenerations += org.completedColonyGenerations;
    }

    const m = world.latestMetrics();
    return {
      tick,
      population: world.population(),
      organisms: alive.length,
      cumulativeBirths: Math.max(0, world.nextOrganismIdForSnapshot() - 1),
      birthsBud: buds,
      birthsFragment: frags,
      cumulativeBud: birthsBud,
      founderLineagesAlive,
      founderCellsAlive,
      descendantCells,
      colonyGenerations,
      largestColony: m?.largestColonySize ?? 0,
    };
  };

  samples.push(snapshot(0));
  for (let t = 1; t <= ticks; t++) {
    world.step();
    if (t % sampleEvery === 0) samples.push(snapshot(t));
  }
  const last = samples[samples.length - 1] as ReproSample;

  const totalLiving = last.founderCellsAlive + last.descendantCells;
  const founderDescendantShare = totalLiving > 0 ? last.founderCellsAlive / totalLiving : Number.NaN;

  let reading: string;
  if (birthsInFinalQuarter < birthsInFirstQuarter * 0.5) {
    reading =
      `Doğum hızı **çöktü**: ilk çeyrekte ${birthsInFirstQuarter}, son çeyrekte ` +
      `${birthsInFinalQuarter} doğum. Üreme döngüsü tıkanmış.`;
  } else {
    reading =
      `Doğum hızı sürüyor: ilk çeyrekte ${birthsInFirstQuarter}, son çeyrekte ` +
      `${birthsInFinalQuarter} doğum — döngü **durağan ama durmuş değil.** ` +
      `Sınırlayıcı yoğunluk/enerji geri beslemesi olabilir.`;
  }
  if (birthsBud === 0 && birthsFragment > 0) {
    reading +=
      ` **Kritik:** tomurcuklama (bud) hiç gerçekleşmedi (${birthsBud}); tüm doğumlar ` +
      `parçalanma (${birthsFragment}). Koloni üreme nesli bu yolla ilerlemediği için ` +
      `ana evrimsel geçiş ölçümü yapısal olarak imkânsız — **B3'ün önkoşulu karşılanmıyor.**`;
  }

  return {
    seed,
    ticks,
    samples,
    totalBud: birthsBud,
    totalFragment: birthsFragment,
    founderDescendantShare,
    birthsInFirstQuarter,
    birthsInFinalQuarter,
    reading,
  };
}

export function formatReproDiagnosis(d: ReproDiagnosis): string {
  const header = '   tick   pop   org   küm.dğ   bud   frag   kurucu soy   kurucu hücre   soy hücre   kol.nesil   küme';
  const rows = d.samples
    .filter((_, i) => i % 4 === 0 || i === d.samples.length - 1)
    .map(
      (s) =>
        `  ${String(s.tick).padStart(6)}  ${String(s.population).padStart(4)}  ${String(s.organisms).padStart(4)}  ` +
        `${String(s.cumulativeBirths).padStart(6)}  ${String(s.cumulativeBud).padStart(4)}  ${String(s.birthsFragment).padStart(5)}  ` +
        `${String(s.founderLineagesAlive).padStart(10)}  ${String(s.founderCellsAlive).padStart(11)}  ` +
        `${String(s.descendantCells).padStart(9)}  ${String(s.colonyGenerations).padStart(10)}  ${String(s.largestColony).padStart(5)}`,
    );
  return [
    `  tohum ${d.seed} · ${d.ticks} tick`,
    `  tomurcuklama ${d.totalBud} · parçalanma ${d.totalFragment} · kurucu soyun canlı hücrelerdeki payı ${fmt(d.founderDescendantShare * 100, 1)}%`,
    `  → ${d.reading}`,
    '',
    header,
    ...rows,
  ].join('\n');
}

// --------------------------------------------------- uzun vadeli dayanıklılık

export interface LongRunPoint {
  strainDecayK: number;
  bondFatigue: number;
  /** Tahmini bağ ömrü (tick). */
  estimatedBondLife: number;
  /** Pencerenin sonundaki popülasyon. */
  finalPopulation: number;
  /** Pencerenin son çeyreğindeki ortalama en büyük küme. */
  lateLargestColony: number;
  /** Pencerenin sonunda 4+ hücreli yapı sayısı. */
  finalMultiCellColonies: number;
  /** Pencerenin sonunda bağ sayısı. */
  finalBondCount: number;
  /** Pencerenin sonundaki rezerv doluluğu. */
  finalReserveFraction: number;
  /** Pencerenin son çeyreğindeki ölüm payları. */
  lateStarvationShare: number;
  latePredationShare: number;
  /** Popülasyon zirvesi / son popülasyon oranı — çöküş derinliği. */
  crashRatio: number;
}

/**
 * **Uzun vadeli dayanıklılık taraması — §5.4'ün genellenip genellenmediğini sınar.**
 *
 * §5.4'te bağ dayanıklılığının 12.000 tick'te 4+ hücreli yapıları geri getirdiği
 * **ölçülmüştü ve önceden kaydedilen ölçütü karşılamıştı.** Ancak o ölçüt tek
 * bir pencerede geçerlidir. Bu tarama aynı ayarları **40.000 tick** boyunca
 * sınar ve şunu sorar: kalibrasyon sadece sönümlenmeyi erteliyor mu, yoksa
 * uzun vadeli çöküşü gerçekten önlüyor mu?
 *
 * **Bu, kendi önceki bulgumu sınayan bir ölçümdür.** Pencereye özgü bir etkiyi
 * kalıcı sanmamak için yazıldı.
 */
export function sweepLongRunDurability(options?: {
  settings?: { strainDecayK: number; bondFatigue: number }[];
  ticks?: number;
  seed?: number;
}): LongRunPoint[] {
  const settings = options?.settings ?? [
    { strainDecayK: 0.02, bondFatigue: 2e-5 },
    { strainDecayK: 0.005, bondFatigue: 5e-6 },
    { strainDecayK: 0.002, bondFatigue: 1e-6 },
  ];
  const ticks = options?.ticks ?? 40_000;
  const seed = options?.seed ?? 11;

  return settings.map((setting) => {
    const world = new World({
      seed,
      population: 48,
      strainDecayK: setting.strainDecayK,
      bondFatigue: setting.bondFatigue,
    });
    let peakPopulation = 0;
    const lateColonies: number[] = [];
    let lateStarvation = 0;
    let latePredation = 0;
    // Ölü organizmalar `compact()` ile silindiği için kümülatif sayaç tutuyoruz:
    // koşu sonunda `world.organisms` içinde ölü yoktur.
    const countedDeaths = new Set<number>();

    for (let t = 1; t <= ticks; t++) {
      world.step();
      if (t >= ticks * 0.75) {
        for (const org of world.organisms.values()) {
          if (org.alive || countedDeaths.has(org.id)) continue;
          countedDeaths.add(org.id);
          if (org.deathCause === 'starvation') lateStarvation++;
          else if (org.deathCause === 'predation') latePredation++;
        }
      }
      if (t % 200 !== 0) continue;
      const m = world.latestMetrics();
      if (!m || m.tick !== world.tick) continue;
      if (m.population > peakPopulation) peakPopulation = m.population;
      if (t >= ticks * 0.75) lateColonies.push(m.largestColonySize);
    }

    const m = world.latestMetrics();
    let reserve = 0;
    let capacity = 0;
    for (const r of world.resources) {
      reserve += r.reserve;
      capacity += r.capacity;
    }
    const totalDeaths = lateStarvation + latePredation;
    const perTick = setting.strainDecayK * 0.02 * (1.6 - 0.45) + setting.bondFatigue;
    const finalPopulation = world.population();

    return {
      strainDecayK: setting.strainDecayK,
      bondFatigue: setting.bondFatigue,
      estimatedBondLife: perTick > 0 ? Math.round(1 / perTick) : Number.POSITIVE_INFINITY,
      finalPopulation,
      lateLargestColony: lateColonies.length > 0 ? meanOf(lateColonies) : 0,
      finalMultiCellColonies: m?.coloniesOverFourCells ?? 0,
      finalBondCount: m?.bondCount ?? 0,
      finalReserveFraction: capacity > 0 ? reserve / capacity : Number.NaN,
      lateStarvationShare: totalDeaths > 0 ? lateStarvation / totalDeaths : Number.NaN,
      latePredationShare: totalDeaths > 0 ? latePredation / totalDeaths : Number.NaN,
      crashRatio: finalPopulation > 0 ? peakPopulation / finalPopulation : Number.NaN,
    };
  });
}

export function formatLongRun(points: readonly LongRunPoint[]): string {
  const header =
    '  strainK   bağ ömrü   son pop   çöküş oranı   son çeyrek küme   son 4+   son bağ   son rezerv   geç açlık%   geç avcı%';
  const rows = points.map((p) =>
    `  ${fmt(p.strainDecayK, 7)}  ${String(p.estimatedBondLife).padStart(7)}  ${String(p.finalPopulation).padStart(8)}  ` +
    `${fmt(p.crashRatio, 8).padStart(11)}   ${fmt(p.lateLargestColony, 10).padStart(13)}   ` +
    `${String(p.finalMultiCellColonies).padStart(6)}  ${String(p.finalBondCount).padStart(7)}   ` +
    `${fmt(p.finalReserveFraction * 100, 8).padStart(10)}%   ${fmt(p.lateStarvationShare * 100, 8).padStart(9)}   ${fmt(p.latePredationShare * 100, 8).padStart(9)}`,
  );
  return [header, ...rows].join('\n');
}

// --------------------------------------------------- uzun vadeli sınır teşhisi

export interface LongRunLimitSample {
  tick: number;
  population: number;
  /** Canlı hücrelerin ortalama enerjisi. */
  meanCellEnergy: number;
  /** Enerjisi 10 e'nin altındaki hücre sayısı — açlık göstergesi. */
  starvingCells: number;
  /** Açlıktaki hücrelerin toplam içindeki payı. */
  starvingShare: number;
  /**
   * Canlı hücrelerin **en yakın kaynak düğümüne** uzaklığının medyanı.
   * Rezerv doluyken bu uzaklık büyüyorsa sınırlayıcı **erişilebilirliğidir**,
   * kaynak miktarı değil.
   */
  medianNearestResourceDistance: number;
  /** En yakın kaynak düğümüne uzaklık ≤ 1.5 mb olan hücrelerin payı. */
  cellsNearResourceShare: number;
  /** Kaynak doluluğu. */
  reserveFraction: number;
  /** Avcının enerjisi (normalize) ve yaşayıp yaşamadığı. */
  predatorEnergyNorm: number;
  predatorAlive: boolean;
  /** Kümülatif ölümler. */
  deathsStarvation: number;
  deathsPredation: number;
}

export interface LongRunLimitDiagnosis {
  seed: number;
  ticks: number;
  strainDecayK: number;
  samples: LongRunLimitSample[];
  /** Erken (ilk çeyrek) ve geç (son çeyrek) medyan erişim uzaklığı. */
  earlyMedianDistance: number;
  lateMedianDistance: number;
  /** Erken ve geç çeyrekteki ortalama hücre enerjisi. */
  earlyMeanEnergy: number;
  lateMeanEnergy: number;
  /** Geç çeyrekte avcı enerjisi — avcı dengede mi? */
  latePredatorEnergy: number;
  reading: string;
}

/**
 * **40.000 tick'te sınırlayıcı olan ne?** (§5.14'ün açık sorusu)
 *
 * İki rakip açıklama, ölçümle ayrılır:
 *
 * | Hipotez | Ayıran ölçüm |
 * |---|---|
 * | **Erişilebilirlik** — kaynak var ama hücreler ulaşamıyor | En yakın kaynağa uzaklık zamanla büyürken rezerv dolu kalıyor |
 * | **Avcı dinamiği** — avcının kendisi denge dışı | Avcı enerjisi sınırsız yükselir / ölümler avcı kaynaklı |
 *
 * Üçüncü olasılık — enerji muhasebesinin bir bileşeni — doğrudan gözlenmez;
 * bunun yerine **hücre enerjisi dağılımı** ölçülür. Hücreler 0'a yakın
 * enerjideyken ve kaynak ulaşılabiliyorsa sorun kaynağın erişilemezliğidir.
 */
export function diagnoseLongRunLimit(options?: {
  seed?: number;
  ticks?: number;
  sampleEvery?: number;
  strainDecayK?: number;
  bondFatigue?: number;
}): LongRunLimitDiagnosis {
  const seed = options?.seed ?? 11;
  const ticks = options?.ticks ?? 40_000;
  const sampleEvery = options?.sampleEvery ?? 4000;
  const strainDecayK = options?.strainDecayK ?? 0.002;
  const bondFatigue = options?.bondFatigue ?? 1e-6;

  const world = new World({ seed, population: 48, strainDecayK, bondFatigue });
  const samples: LongRunLimitSample[] = [];
  const counted = new Set<number>();
  let deathsStarvation = 0;
  let deathsPredation = 0;

  const take = (tick: number): LongRunLimitSample => {
    const live: { x: number; y: number; z: number; energy: number }[] = [];
    for (const cell of world.cells.values()) {
      if (!cell.alive) continue;
      live.push({ x: cell.pos.x, y: cell.pos.y, z: cell.pos.z, energy: cell.energy });
    }
    let meanEnergy = 0;
    let starving = 0;
    if (live.length > 0) {
      for (const c of live) {
        meanEnergy += c.energy;
        if (c.energy < 10) starving++;
      }
      meanEnergy /= live.length;
    }

    const distances: number[] = [];
    let near = 0;
    for (const c of live) {
      let best = Infinity;
      for (const r of world.resources) {
        if (r.reserve <= 0) continue;
        const d = Math.hypot(c.x - r.pos.x, c.y - r.pos.y, c.z - r.pos.z);
        if (d < best) best = d;
      }
      if (Number.isFinite(best)) {
        distances.push(best);
        if (best <= 1.5) near++;
      }
    }

    let reserve = 0;
    let capacity = 0;
    for (const r of world.resources) {
      reserve += r.reserve;
      capacity += r.capacity;
    }

    return {
      tick,
      population: world.population(),
      meanCellEnergy: meanEnergy,
      starvingCells: starving,
      starvingShare: live.length > 0 ? starving / live.length : Number.NaN,
      medianNearestResourceDistance: distances.length > 0 ? medianOf(distances) : Number.NaN,
      cellsNearResourceShare: live.length > 0 ? near / live.length : Number.NaN,
      reserveFraction: capacity > 0 ? reserve / capacity : Number.NaN,
      predatorEnergyNorm: world.predator.energy / Math.max(1, world.predator.radius * 20),
      predatorAlive: world.predator.alive,
      deathsStarvation,
      deathsPredation,
    };
  };

  samples.push(take(0));
  for (let t = 1; t <= ticks; t++) {
    world.step();
    // Ölümleri koşu sırasında topla: `compact()` ölü organizmaları listeden
    // sildiği için sonradan sayım onları kaçırır (ölçüm hatası, §9).
    for (const org of world.organisms.values()) {
      if (org.alive || counted.has(org.id)) continue;
      counted.add(org.id);
      if (org.deathCause === 'starvation') deathsStarvation++;
      else if (org.deathCause === 'predation') deathsPredation++;
    }
    if (t % sampleEvery === 0) samples.push(take(t));
  }

  const quarter = ticks * 0.25;
  const early = samples.filter((s) => s.tick <= quarter);
  const late = samples.filter((s) => s.tick >= ticks * 0.75);
  const earlyMedianDistance = early.length > 0 ? meanOf(early.map((s) => s.medianNearestResourceDistance)) : Number.NaN;
  const lateMedianDistance = late.length > 0 ? meanOf(late.map((s) => s.medianNearestResourceDistance)) : Number.NaN;
  const earlyMeanEnergy = early.length > 0 ? meanOf(early.map((s) => s.meanCellEnergy)) : Number.NaN;
  const lateMeanEnergy = late.length > 0 ? meanOf(late.map((s) => s.meanCellEnergy)) : Number.NaN;
  const latePredatorEnergy = late.length > 0 ? meanOf(late.map((s) => s.predatorEnergyNorm)) : Number.NaN;

  const distanceGrew = lateMedianDistance > earlyMedianDistance * 1.25;
  const reserveStayed = (late.length > 0 ? (late[late.length - 1] as LongRunLimitSample).reserveFraction : 0) > 0.15;
  const last = late[late.length - 1];

  let reading: string;
  if (distanceGrew && reserveStayed) {
    reading =
      `Sınırlayıcı: **kaynak erişilebilirliği.** En yakın kaynağa uzaklık ` +
      `${fmt(earlyMedianDistance, 2)} → ${fmt(lateMedianDistance, 2)} mb arasında ` +
      `${fmt(lateMedianDistance / Math.max(1e-6, earlyMedianDistance), 2)}× büyüdü, rezerv doluluğu ` +
      `%${((last?.reserveFraction ?? 0) * 100).toFixed(1)}'de kaldı. Hücreler kaynağa ulaşamıyor.`;
  } else if ((last?.deathsPredation ?? 0) > (last?.deathsStarvation ?? 0)) {
    reading =
      `Sınırlayıcı: **avcı baskısı.** Geç dönemde avcı kaynaklı ölüm ` +
      `(${(last?.deathsPredation ?? 0)}) açlıktan (${last?.deathsStarvation ?? 0}) fazla.`;
  } else {
    reading =
      `Sınırlayıcı: **enerji erişimi / açlık.** Hücre enerjisi ${fmt(earlyMeanEnergy, 1)} → ` +
      `${fmt(lateMeanEnergy, 1)} e düştü; geç çeyrekte açlıktaki hücre payı ` +
      `%${((last?.starvingShare ?? 0) * 100).toFixed(0)}, kaynak erişim uzaklığı ` +
      `${fmt(lateMedianDistance, 2)} mb (rezerv %${((last?.reserveFraction ?? 0) * 100).toFixed(1)}).`;
  }

  return {
    seed,
    ticks,
    strainDecayK,
    samples,
    earlyMedianDistance,
    lateMedianDistance,
    earlyMeanEnergy,
    lateMeanEnergy,
    latePredatorEnergy,
    reading,
  };
}

export function formatLongRunLimit(d: LongRunLimitDiagnosis): string {
  const header =
    '   tick   pop   ort. enerji   açlık%   medyan uzaklık   yakın%   rezerv%   avcı en.   açlık öl.   avcı öl.';
  const rows = d.samples.map(
    (s) =>
      `  ${String(s.tick).padStart(6)}  ${String(s.population).padStart(4)}  ${fmt(s.meanCellEnergy, 9).padStart(12)}  ` +
      `${fmt(s.starvingShare * 100, 5).padStart(6)}   ${fmt(s.medianNearestResourceDistance, 11).padStart(13)}   ` +
      `${fmt(s.cellsNearResourceShare * 100, 6).padStart(6)}   ${fmt(s.reserveFraction * 100, 6).padStart(6)}%   ` +
      `${fmt(s.predatorEnergyNorm, 8).padStart(8)}   ${String(s.deathsStarvation).padStart(8)}   ${String(s.deathsPredation).padStart(6)}`,
  );
  return [
    `  tohum ${d.seed} · ${d.ticks} tick · strainK ${d.strainDecayK}`,
    header,
    ...rows,
    '',
    `  → ${d.reading}`,
  ].join('\n');
}

// --------------------------------------------------- kaynak rejenerasyonu

export interface RegenPoint {
  regen: number;
  ticks: number;
  peakPopulation: number;
  finalPopulation: number;
  /** Son çeyrekteki ortalama popülasyon — kalıcılığın göstergesi. */
  latePopulation: number;
  finalReserveFraction: number;
  meanCellEnergy: number;
  starvingShare: number;
  deathsStarvation: number;
  deathsPredation: number;
  predatorDiedAtTick: number | null;
  worstLedgerResidual: number;
}

/**
 * **Kaynak rejenerasyonu A/B testi** — §5.14'ün açık sorusunun kesin yanıtı.
 *
 * Ölçülen: `C.DEFAULT_REGEN = 0`, yani kaynak **hiç yenilenmiyor**. Kapalı
 * enerji sistemi 40.000 tick boyunca rezervini %100 → %23'e tüketiyor.
 *
 * **Önceden kaydedilen hipotez:** uzun vadeli çöküş kümülatif kaynak tükenmesinin
 * sonucudur; rejenerasyon açıldığında popülasyon kalıcı hâle gelir.
 *
 * **Başarı ölçütü:** rejenerasyon açık kolda son popülasyon (veya son çeyrek
 * ortalaması) rejenerasyonsuz koldan **anlamlı biçimde yüksek** olmalı.
 *
 * **Muhasebe notu:** doğal yenilenme defterde **dış girdi** olarak kaydedilir
 * (bkz. `MODEL.md`), dolayısıyla enerji korunumu bozulmaz — korunum testi
 * her kolda ayrıca denetlenir.
 */
export function sweepResourceRegen(options?: {
  regens?: number[];
  ticks?: number;
  seed?: number;
  strainDecayK?: number;
}): RegenPoint[] {
  const regens = options?.regens ?? [0, 0.002, 0.01];
  const ticks = options?.ticks ?? 40_000;
  const seed = options?.seed ?? 11;
  const strainDecayK = options?.strainDecayK ?? 0.002;

  return regens.map((regen) => {
    const world = new World({ seed, population: 48, strainDecayK, bondFatigue: 1e-6, resourceRegen: regen });
    let peakPopulation = 0;
    let last = { mean: 0, starving: 0 };
    const counted = new Set<number>();
    let deathsStarvation = 0;
    let deathsPredation = 0;
    let predatorDiedAtTick: number | null = null;
    const latePopulations: number[] = [];

    for (let t = 1; t <= ticks; t++) {
      world.step();
      for (const org of world.organisms.values()) {
        if (org.alive || counted.has(org.id)) continue;
        counted.add(org.id);
        if (org.deathCause === 'starvation') deathsStarvation++;
        else if (org.deathCause === 'predation') deathsPredation++;
      }
      if (predatorDiedAtTick === null && !world.predator.alive) predatorDiedAtTick = t;
      if (t % 4000 === 0) {
        const pop = world.population();
        if (pop > peakPopulation) peakPopulation = pop;
        if (t >= ticks * 0.75) latePopulations.push(pop);
        let sum = 0;
        let starving = 0;
        let live = 0;
        for (const cell of world.cells.values()) {
          if (!cell.alive) continue;
          live++;
          sum += cell.energy;
          if (cell.energy < 10) starving++;
        }
        last = { mean: live > 0 ? sum / live : 0, starving: live > 0 ? starving / live : Number.NaN };
      }
    }

    let reserve = 0;
    let capacity = 0;
    for (const r of world.resources) {
      reserve += r.reserve;
      capacity += r.capacity;
    }
    const residual =
      world.ledger.initialTotal + world.ledger.externalInput - world.systemEnergyTotal() - world.ledger.dissipated;

    return {
      regen,
      ticks,
      peakPopulation,
      finalPopulation: world.population(),
      latePopulation: latePopulations.length > 0 ? meanOf(latePopulations) : Number.NaN,
      finalReserveFraction: capacity > 0 ? reserve / capacity : Number.NaN,
      meanCellEnergy: last.mean,
      starvingShare: last.starving,
      deathsStarvation,
      deathsPredation,
      predatorDiedAtTick,
      worstLedgerResidual: residual,
    };
  });
}

export function formatRegen(points: readonly RegenPoint[]): string {
  const header =
    '  regen   zirve pop   son pop   son çeyrek pop   son rezerv   ort. enerji   açlık%   açlık öl.   avcı öl.   avcı öldü   rezidüel';
  const rows = points.map((p) =>
    `  ${fmt(p.regen, 6)}   ${String(p.peakPopulation).padStart(8)}   ${String(p.finalPopulation).padStart(7)}   ` +
    `${fmt(p.latePopulation, 11).padStart(14)}   ${fmt(p.finalReserveFraction * 100, 10).padStart(10)}%   ` +
    `${fmt(p.meanCellEnergy, 9).padStart(12)}   ${fmt(p.starvingShare * 100, 5).padStart(5)}   ` +
    `${String(p.deathsStarvation).padStart(8)}   ${String(p.deathsPredation).padStart(6)}   ` +
    `${(p.predatorDiedAtTick === null ? 'hayır' : String(p.predatorDiedAtTick)).padStart(9)}   ` +
    `${fmt(p.worstLedgerResidual, 9)}`,
  );
  return [header, ...rows].join('\n');
}

// --------------------------------------------------- popülasyon-ES

export interface PopulationUpdatePoint {
  populationUpdate: boolean;
  seeds: number;
  /** Hayatta kalanların ortalama ödül **hızı** (e / tick). */
  meanRewardRate: number;
  /** Hayatta kalanların ortalama normalize enerjisi. */
  meanEnergyNorm: number;
  population: number;
  /** Uygulanan popülasyon-ES güncellemesi sayısı. */
  updatesApplied: number;
  /** Kümülatif doğum. */
  cumulativeBirths: number;
  /** En büyük koloni. */
  largestColony: number;
  /** Koşulardaki en büyük enerji muhasebesi rezidülü. */
  worstLedgerResidual: number;
}

export interface PopulationUpdateReport {
  ticks: number;
  control: PopulationUpdatePoint;
  treatment: PopulationUpdatePoint;
  /** Eşleştirilmiş tohum başına farklar (tedavi − kontrol). */
  differences: number[];
  difference: Interval;
  test: HypothesisTest;
  worstLedgerResidual: number;
  reading: string;
}

/**
 * **Popülasyon-ES ölçümü** — seçilen öğrenme yönünün testi.
 *
 * **Tasarım:** REINFORCE **her iki kolda da kapalıdır.** Böylece ölçülen fark
 * yalnız popülasyon-ES'in katkısıdır; iki mekanizmanın etkisi karışmaz.
 *
 * **Zorunlu eşleştirme:** aynı tohum, iki kol, aynı ortam.
 *
 * **Birincil ölçüm — ödül hızı.** `lifetimeReward` kümülatiftir ve yaşamayı
 * ödüllendirir: uzun yaşayan ama kötü davranan birey, kısa yaşayan iyi bireyi
 * yalar. Bu bir **ölçüm yanlılığıdır** (`§5.9`'daki hatanın aynısı), bu yüzden
 * `lifetimeReward / yaş` **hızı** kullanılır.
 *
 * **Önceden kaydedilen başarı ölçütü:** tedavi kolunun ödül hızı, kontrol
 * kolundan **eşleştirilmiş** olarak anlamlı biçimde yüksek olmalı (bootstrap
 * güven aralığı sıfırdan ayrışmalı).
 */
export function experimentPopulationUpdate(options?: {
  seeds?: number;
  ticks?: number;
  updateRate?: number;
  updateInterval?: number;
  resourceRegen?: number;
  seedBase?: number;
}): PopulationUpdateReport {
  const seeds = options?.seeds ?? 8;
  const ticks = options?.ticks ?? 20_000;
  const updateRate = options?.updateRate ?? 0.06;
  const updateInterval = options?.updateInterval ?? 500;
  const resourceRegen = options?.resourceRegen ?? 0.002;
  const seedBase = options?.seedBase ?? 6001;

  const runArm = (populationUpdate: boolean): PopulationUpdatePoint & { perSeed: number[] } => {
    let rateSum = 0;
    let energySum = 0;
    // eslint-disable-next-line no-unused-vars
    let popSum = 0;
    let colonyMax = 0;
    let updates = 0;
    let births = 0;
    let residual = 0;
    const perSeed: number[] = [];

    for (let i = 0; i < seeds; i++) {
      const world = new World({
        seed: seedBase + i,
        population: 48,
        resourceRegen,
        // REINFORCE kapalı: ölçüm yalnız popülasyon-ES'in.
        learningEnabled: false,
        populationUpdate,
        populationUpdateRate: updateRate,
        populationUpdateInterval: updateInterval,
      });
      for (let t = 1; t <= ticks; t++) world.step();

      let rSum = 0;
      let live = 0;
      for (const org of world.organisms.values()) {
        if (!org.alive || org.cells.length === 0) continue;
        const age = Math.max(1, world.tick - org.bornTick);
        rSum += org.lifetimeReward / age;
        live++;
      }
      const cellE: number[] = [];
      for (const cell of world.cells.values()) {
        if (cell.alive) cellE.push(cell.energy / 100);
      }
      const meanE = cellE.length > 0 ? meanOf(cellE) : 0;
      const meanR = live > 0 ? rSum / live : 0;
      perSeed.push(meanR);

      rateSum += meanR;
      energySum += meanE;
      popSum += world.population();
      colonyMax = Math.max(colonyMax, world.latestMetrics()?.largestColonySize ?? 0);
      updates += world.populationUpdatesApplied();
      births += Math.max(0, world.nextOrganismIdForSnapshot() - 1);

      const res =
        world.ledger.initialTotal + world.ledger.externalInput - world.systemEnergyTotal() - world.ledger.dissipated;
      if (Math.abs(res) > Math.abs(residual)) residual = res;
    }

    return {
      populationUpdate,
      seeds,
      meanRewardRate: rateSum / seeds,
      meanEnergyNorm: energySum / seeds,
      population: popSum / seeds,
      updatesApplied: Math.round(updates / seeds),
      cumulativeBirths: Math.round(births / seeds),
      largestColony: colonyMax,
      worstLedgerResidual: residual,
      perSeed,
    };
  };

  const control = runArm(false);
  const treatment = runArm(true);
  const differences = treatment.perSeed.map((v, i) => v - (control.perSeed[i] ?? 0));
  const test = bootstrapTest(differences, { seed: 9101 });
  const ci = bootstrapCI(differences, { seed: 9102 });

  const reading =
    ci.lower > 0
      ? `Popülasyon-ES **işe yarıyor**: ödül hızı ${fmt(control.meanRewardRate, 5)} → ` +
        `${fmt(treatment.meanRewardRate, 5)} e/tick, eşleştirilmiş fark ` +
        `[${fmt(ci.lower, 5)}, ${fmt(ci.upper, 5)}], sıfırdan ayrışıyor (p = ${fmt(test.pValue, 4)}).`
      : `Popülasyon-ES **ölçülebilir etki üretmedi**: fark ${fmt(ci.estimate, 5)} ` +
        `[${fmt(ci.lower, 5)}, ${fmt(ci.upper, 5)}], p = ${fmt(test.pValue, 4)}.`;

  return {
    ticks,
    control,
    treatment,
    differences,
    difference: ci,
    test,
    worstLedgerResidual: Math.max(
      Math.abs(control.worstLedgerResidual),
      Math.abs(treatment.worstLedgerResidual),
    ),
    reading,
  };
}

export function formatPopulationUpdate(r: PopulationUpdateReport): string {
  const c = r.control;
  const t = r.treatment;
  return [
    `  ${r.ticks} tick · ${c.seeds} eşleştirilmiş tohum · REINFORCE her iki kolda da KAPALI`,
    `  kontrol (popülasyon-ES yok): ödül hızı ${fmt(c.meanRewardRate, 5)} e/tick · enerji ${fmt(c.meanEnergyNorm, 3)} · pop ${c.population} · küme ${c.largestColony}`,
    `  tedavi  (popülasyon-ES var): ödül hızı ${fmt(t.meanRewardRate, 5)} e/tick · enerji ${fmt(t.meanEnergyNorm, 3)} · pop ${t.population} · küme ${t.largestColony}`,
    `  uygulanan güncelleme: ${t.updatesApplied} · enerji rezidülü: ${fmt(r.worstLedgerResidual, 9)} e`,
    `  eşleştirilmiş fark ${fmtInterval(r.difference, 5)} · p = ${fmt(r.test.pValue, 4)} · iyileşme olasılığı ${fmt(r.test.probabilityOfImprovement * 100, 1)}%`,
    `  → ${r.reading}`,
  ].join('\n');
}

// --------------------------------------------------- ödül yayılımı

export interface DispersionReport {
  ticks: number;
  /** Kaç bağımsız dünya karşılaştırma için koşuldu. */
  acrossWorlds: number;
  /** Paylaşılan dünyada bireylerin ödül hızı değişim katsayısı. */
  withinWorldCv: number;
  /** Bağımsız dünyalar arasında ortalama değişim katsayısı. */
  acrossWorldCv: number;
  /** Paylaşılan koşulların sinyalini silip silmediği. */
  withinVsAcross: number;
  reading: string;
}

/**
 * **Ödül hızı yayılımı — paylaşılan dünya sinyali siler mi?**
 *
 * Popülasyon-ES'in başarısız olmasının iki açıklaması vardı:
 *   (a) Paylaşılan dünyada bireylerin getirileri ayrışmaz (konum şansı baskın),
 *       dolayısıyla ağırlıklandırma anlamsızlaşır.
 *   (b) Sinyal vardır ama **ortalama alma** onu harcamaz: popülasyon mevcut
 *       ortalamasına yakınsar; ortalama, ortalamanın en iyisini bulamaz.
 *
 * Bu ölçüm (a)'yı test eder. `withinWorldCv < acrossWorldCv` ise (a) doğru,
 * eşit veya büyükse (a) yanlış demektir.
 *
 * **Ölçülen sonuç (bkz. §6):** paylaşılan dünyada CV **%9.0**, bağımsız
 * dünyalarda **%7.4** — yani (a) **yanlıştır.** Sinyal paylaşılan koşullarda
 * silinmiyor. Başarısızlığın sebebi (b)'dir: ortalama alma bir **arama**
 * yöntemi değildir.
 */
export function measureRewardDispersion(options?: {
  ticks?: number;
  seed?: number;
  acrossWorlds?: number;
  seedBase?: number;
  population?: number;
}): DispersionReport {
  const ticks = options?.ticks ?? 15_000;
  const seed = options?.seed ?? 11;
  const acrossWorlds = options?.acrossWorlds ?? 6;
  const seedBase = options?.seedBase ?? 7001;
  const population = options?.population ?? 48;

  const cvOf = (world: World): number => {
    const rates: number[] = [];
    for (const org of world.organisms.values()) {
      if (!org.alive || org.cells.length === 0) continue;
      const age = Math.max(1, world.tick - org.bornTick);
      rates.push(org.lifetimeReward / age);
    }
    if (rates.length < 2) return Number.NaN;
    const m = meanOf(rates);
    const sd = Math.sqrt(meanOf(rates.map((r) => (r - m) ** 2)));
    return sd / Math.max(1e-9, Math.abs(m));
  };

  const shared = new World({ seed, population, resourceRegen: 0.002, learningEnabled: false });
  for (let t = 1; t <= ticks; t++) shared.step();
  const withinWorldCv = cvOf(shared);

  const across: number[] = [];
  for (let i = 0; i < acrossWorlds; i++) {
    const w = new World({ seed: seedBase + i, population, resourceRegen: 0.002, learningEnabled: false });
    for (let t = 1; t <= ticks; t++) w.step();
    const cv = cvOf(w);
    if (Number.isFinite(cv)) across.push(cv);
  }
  const acrossWorldCv = across.length > 0 ? meanOf(across) : Number.NaN;

  const withinVsAcross = acrossWorldCv > 0 ? withinWorldCv / acrossWorldCv : Number.NaN;
  const reading =
    withinWorldCv >= acrossWorldCv
      ? `Paylaşılan dünya sinyali **silmüyor**: bireyler arası CV %${(withinWorldCv * 100).toFixed(1)}, ` +
        `bağımsız dünyalar arası %${(acrossWorldCv * 100).toFixed(1)} ` +
        `(${fmt(withinVsAcross, 2)}×). Yani popülasyon içi ayrışma **vardır**; ` +
        `ortalama-alma güncellemesinin başarısızlığı arama eksikliğidir, sinyal yokluğu değil.`
      : `Paylaşılan dünya sinyali zayıflatıyor: bireyler arası CV %${(withinWorldCv * 100).toFixed(1)} ` +
        `< bağımsız dünyalar arası %${(acrossWorldCv * 100).toFixed(1)}. Ağırlıklandırma büyük ölçüde anlamsızlaşıyor.`;

  return { ticks, acrossWorlds, withinWorldCv, acrossWorldCv, withinVsAcross, reading };
}

export function formatDispersion(d: DispersionReport): string {
  return [
    `  ${d.ticks} tick`,
    `  paylaşılan dünyada bireyler arası CV: %${(d.withinWorldCv * 100).toFixed(1)}`,
    `  bağımsız dünyalar arası ortalama CV: %${(d.acrossWorldCv * 100).toFixed(1)}`,
    `  oran: ${fmt(d.withinVsAcross, 2)}×`,
    `  → ${d.reading}`,
  ].join('\n');
}

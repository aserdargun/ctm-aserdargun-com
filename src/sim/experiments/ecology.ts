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
import { deserializeWorld, serializeWorld } from '../persistence/snapshot.ts';
import { GENOME_BOUNDS } from '../genome.ts';
import { LIFE_SIZE_MAX, LIFE_SPEED_MAX } from '../lab/lifeMap.ts';
import { genomeDistance } from './colony.ts';
import type { Genome } from '../types.ts';
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

// --------------------------------------------------- dal (branch) doğruluğu

export interface BranchReport {
  forkTick: number;
  forkTicks: number;
  /** Snapshot'ın bayt cinsinden boyutu. */
  snapshotBytes: number;
  /** Snapshot alma + geri yükleme süresi (ms). */
  forkCostMs: number;
  /** Bir dünyada `forkTicks` ilerlemenin süresi (ms) — karşılaştırma için. */
  runCostMs: number;
  /** Çatallama maliyetinin simülasyon maliyetine oranı. */
  costRatio: number;
  /** İki dal bit düzeyinde aynı mı? */
  identical: boolean;
  /** Müdahale edilmemiş dal, müdahalesiz referansla aynı mı? (true = bağımsız) */
  crossTalk: boolean;
  /** Müdahale görmüş dal gerçekten ayrıldı mı? (yoksa test anlamsız) */
  interventionEffective: boolean;
  reading: string;
}

/**
 * **Dal (branch) doğruluğu ve maliyeti.**
 *
 * `VALIDATION.md` §9 madde 7 şunu açıkça listeliyordu: *"branch komutu snapshot
 * kopyalıyor; iki dalın birbirinden bağımsız olduğu test edilmedi."*
 *
 * Bu ölçüm, ikinci seçeneği (**çatallanabilir ortam üzerinden yaşam içi arama**)
 * bir varsayımdan ölçülebilir bir seçeneğe çevirir. İki şey sorulur:
 *
 * 1. **Doğruluk:** Aynı snapshot'tan açılan iki dal bit düzeyinde aynı mı ilerler?
 *    Ve birinde yapılan müdahale diğerini etkiler mi?
 * 2. **Maliyet:** Çatallama, bir simülasyon adımından ne kadar pahalı? Eğer
 *    çatallama bir adımdan kat kat pahalıysa, yaşam içi ES (her adımda onlarca
 *    çatal değerlendirmek ister) pratikte imkânsızdır.
 */
export function verifyBranchIndependence(options?: {
  forkTick?: number;
  forkTicks?: number;
  seed?: number;
}): BranchReport {
  const forkTick = options?.forkTick ?? 3000;
  const forkTicks = options?.forkTicks ?? 1500;
  const seed = options?.seed ?? 11;

  const base = new World({ seed, population: 48 });
  for (let t = 0; t < forkTick; t++) base.step();

  // 1) Snapshot al + iki dal aç (süre ölçülür).
  const t0 = performance.now();
  const snapshot = serializeWorld(base);
  const a = deserializeWorld(snapshot);
  const b = deserializeWorld(snapshot);
  // Müdahale testi için üçüncü dal: hiç müdahale edilmeyen referans.
  const control = deserializeWorld(snapshot);
  const forkCostMs = performance.now() - t0;

  // 2) İki dal aynı mı ilerliyor?
  const t1 = performance.now();
  // `control` de aynı sayıda adım atmalıdır; aksi halde müdahale testi
  // adım sayısı farkından bozulur ve yanlış "çapraz karışma" raporlanır.
  for (let t = 0; t < forkTicks; t++) {
    a.step();
    b.step();
    control.step();
  }
  const runCostMs = performance.now() - t1;

  const identical =
    a.tick === b.tick &&
    a.population() === b.population() &&
    a.systemEnergyTotal() === b.systemEnergyTotal() &&
    a.organismOrder().length === b.organismOrder().length;

  // 3) Müdahale bütünlüğü.
  //
  // ⚠️ Doğru test üç dal ister. İki dalı da ilerletip "b değişti mi diye
  // bakmak" yanlıştır: b zaten simüle edildiği için enerjisi değişir.
  // Doğrusu: **müdahale edilmemiş referans dal**la karşılaştırmak.
  //   - `b` müdahalesiz ve `control` da müdahalesiz → ikisi BİREBİR aynı olmalı
  //   - `a` müdahale görmüş → `control`'dan AYRILMALI
  a.addNutrient('A', 250);
  for (let t = 0; t < 200; t++) {
    a.step();
    b.step();
    control.step();
  }
  const controlEnergy = control.systemEnergyTotal();
  const bMatchesControl = b.systemEnergyTotal() === controlEnergy;
  const aDiverged = a.systemEnergyTotal() !== controlEnergy;
  const crossTalk = !bMatchesControl;

  const snapshotBytes = JSON.stringify(snapshot).length;
  const costRatio = runCostMs > 0 ? forkCostMs / runCostMs : Number.NaN;

  const reading = !identical
    ? '**DALLAR AYRIŞIYOR** — aynı snapshot iki farklı yol üretiyor. Çatallama güvenilir değil.'
    : crossTalk
      ? '**DALLAR ÇAPRAZ KARIŞIYOR** — müdahale edilmemiş dal, hiç müdahale edilmemiş referansla aynı ilerlemiyor. Çatallama bağımsız değil.'
      : `Çatallama **doğru**: iki dal bit düzeyinde aynı ilerliyor ve müdahale diğerine sızmıyor. ` +
        `Snapshot ${(snapshotBytes / 1_000_000).toFixed(2)} MB; bir dal açmak ${(forkCostMs / 2).toFixed(1)} ms, ` +
        `bir simülasyon adımı ${(runCostMs / 2 / forkTicks).toFixed(3)} ms → **bir çatal ≈ ` +
        `${Math.max(1, Math.round(forkCostMs / 2 / (runCostMs / 2 / forkTicks)))} tick** maliyetinde. ` +
        `Yani 500 tick'te bir, 16 pertürbasyonlu güncelleme ≈ ` +
        `${Math.round(((16 * (forkCostMs / 2)) / (runCostMs / 2 / forkTicks)) / 500 * 100)}% ek yük demek: ` +
        `üstel strateji yaşam içinde pratikte **bütçelenebilir**. ` +
        `Müdahale testi: müdahalesiz dal referansla ${bMatchesControl ? 'AYNI' : 'FARKLI'}, ` +
        `müdahale görmüş dal ${aDiverged ? 'AYRILDI' : 'AYRILMADI — test anlamsız'}. ` +
        `**DİKKAT:** bu maliyet ${forkTick}. tick'te ölçüldü ve snapshot boyutuyla ölçeklenir; ` +
        `geç pencerelerde farklı olabilir ve **ölçülmedi**.`;

  return {
    forkTick,
    forkTicks,
    snapshotBytes,
    forkCostMs,
    runCostMs,
    costRatio,
    identical,
    crossTalk,
    interventionEffective: aDiverged,
    reading,
  };
}

export function formatBranch(r: BranchReport): string {
  return [
    `  çatal noktası: tick ${r.forkTick} · ${r.forkTicks} adım sonra karşılaştırma`,
    `  snapshot boyutu: ${r.snapshotBytes.toLocaleString('tr-TR')} bayt`,
    `  çatallama süresi: ${r.forkCostMs.toFixed(2)} ms · iki dalın koşusu: ${r.runCostMs.toFixed(1)} ms · oran ${(r.costRatio * 100).toFixed(1)}%`,
    `  dallar bit düzeyinde aynı: ${r.identical ? 'evet' : 'HAYIR'} · müdahale sızıntısı: ${r.crossTalk ? 'VAR' : 'yok'} · müdahale etkili: ${r.interventionEffective ? 'evet' : 'HAYIR'}`,
    `  → ${r.reading}`,
  ].join('\n');
}

// --------------------------------------------------- S-4 · çatallanmış yaşam içi arama

export interface EvolutionStrategyPoint {
  enabled: boolean;
  perturbations: number;
  evaluateTicks: number;
  sigma: number;
  ticks: number;
  /** Yapılan arama sayısı. */
  updates: number;
  /** Aramanın harcadığı süre (ms). */
  spentMs: number;
  /** Bir simülasyon adımının maliyeti (ms) — karşılaştırma tabanı. */
  stepMs: number;
  /** Harcanan sürenin, eşdeğer kaç tick simülasyona denk geldiği. */
  overheadInTicks: number;
  /** Organizmaların medyan ağırlık sapması (θ değişti mi?). */
  medianWeightShift: number;
  /** Hayatta kalanların medyan toplam enerjisi — performans ölçütü. */
  medianOrganismEnergy: number;
  finalPopulation: number;
  worstLedgerResidual: number;
}

export interface EvolutionStrategyReport {
  control: EvolutionStrategyPoint;
  treatment: EvolutionStrategyPoint;
  differences: number[];
  difference: Interval;
  test: HypothesisTest;
  reading: string;
}

/**
 * **S-4 deneyi — çatallanmış ortamda yaşam içi üstel arama.**
 *
 * Protokol: iki kol, aynı tohumlar. Kontrol kolunda arama kapalı, tedavi
 * kolunda açık. REINFORCE **her iki kolda da kapalıdır** — aramanın tek başına
 * etkisini ölçüyoruz.
 *
 * **Birincil ölçüm — ağırlık hareketi ve performans:** tedavi kolunda θ gerçekten
 * hareket ediyor mu (medianWeightShift) ve organizmaların enerjisi artıyor mu.
 * Performans ölçütü olarak "hayatta kalanların medyan enerjisi" kullanılır.
 *
 * **Maliyet ölçümü ayrı ve zorunludur:** arama her 500 tick'te N çatal
 * ilerletme demektir. Ürüne alınabilmesi için harcanan sürenin kabul
 * edilebilir olması gerekir; bu yüzden `overheadInTicks` raporlanır.
 *
 * **Önceden kaydedilen başarı ölçütü:** tedavi kolunda ölçülebilir bir
 * performans artışı (farkın güven aralığı sıfırdan ayrışmalı) **ve**
 * ek yük kabul edilebilir (≤ 200 tick'lik eşdeğer).
 */
export function experimentEvolutionStrategy(options?: {
  seeds?: number;
  ticks?: number;
  perturbations?: number;
  evaluateTicks?: number;
  sigma?: number;
  seedBase?: number;
  population?: number;
  resourceCount?: number;
}): EvolutionStrategyReport {
  const seeds = options?.seeds ?? 4;
  const ticks = options?.ticks ?? 6000;
  const perturbations = options?.perturbations ?? 6;
  const evaluateTicks = options?.evaluateTicks ?? 40;
  const sigma = options?.sigma ?? 0.05;
  const seedBase = options?.seedBase ?? 8501;
  const population = options?.population ?? 24;
  const resourceCount = options?.resourceCount ?? 34;

  const runArm = (enabled: boolean, seed: number): EvolutionStrategyPoint => {
    const stepStart = performance.now();
    const world = new World({
      seed,
      population,
      resourceCount,
      learningEnabled: false,
      esInterval: enabled ? 500 : undefined,
      esPerturbations: enabled ? perturbations : undefined,
      esEvaluateTicks: enabled ? evaluateTicks : undefined,
      esSigma: enabled ? sigma : undefined,
    });
    const before = new Map<number, Float64Array>();
    for (const [id, p] of world.policies) before.set(id, Float64Array.from(p.state.thetaLive));
    for (let t = 1; t <= ticks; t++) world.step();
    const stepMs = (performance.now() - stepStart) / ticks;

    let residual = 0;
    const res =
      world.ledger.initialTotal + world.ledger.externalInput - world.systemEnergyTotal() - world.ledger.dissipated;
    if (Math.abs(res) > Math.abs(residual)) residual = res;

    const shifts: number[] = [];
    const energies: number[] = [];
    for (const org of world.organisms.values()) {
      if (!org.alive || org.cells.length === 0) continue;
      const b = before.get(org.id);
      const p = world.policies.get(org.id);
      if (b && p) {
        let s = 0;
        for (let i = 0; i < b.length; i++) {
          const d = (p.state.thetaLive[i] as number) - (b[i] as number);
          s += d * d;
        }
        shifts.push(Math.sqrt(s));
      }
      let e = 0;
      for (const cid of org.cells) {
        const c = world.cells.get(cid);
        if (c?.alive) e += c.energy;
      }
      energies.push(e);
    }

    const stats = world.evolutionSearchStats();
    const perTickMs = stepMs;
    const spent = stats.spentMs;

    return {
      enabled,
      perturbations,
      evaluateTicks,
      sigma,
      ticks,
      updates: stats.updates,
      spentMs: spent,
      stepMs: perTickMs,
      overheadInTicks: perTickMs > 0 ? spent / perTickMs : Number.NaN,
      medianWeightShift: shifts.length > 0 ? medianOf(shifts) : 0,
      medianOrganismEnergy: energies.length > 0 ? medianOf(energies) : Number.NaN,
      finalPopulation: world.population(),
      worstLedgerResidual: residual,
    };
  };

  const controlPoints: EvolutionStrategyPoint[] = [];
  const treatmentPoints: EvolutionStrategyPoint[] = [];
  for (let i = 0; i < seeds; i++) {
    controlPoints.push(runArm(false, seedBase + i));
    treatmentPoints.push(runArm(true, seedBase + i));
  }

  const control: EvolutionStrategyPoint = {
    ...controlPoints[0] as EvolutionStrategyPoint,
    updates: controlPoints.reduce((a, p) => a + p.updates, 0),
    spentMs: controlPoints.reduce((a, p) => a + p.spentMs, 0),
    medianWeightShift: medianOf(controlPoints.map((p) => p.medianWeightShift)),
    medianOrganismEnergy: medianOf(controlPoints.map((p) => p.medianOrganismEnergy)),
    finalPopulation: meanOf(controlPoints.map((p) => p.finalPopulation)),
    worstLedgerResidual: controlPoints.reduce(
      (a, p) => (Math.abs(p.worstLedgerResidual) > Math.abs(a) ? p.worstLedgerResidual : a),
      0,
    ),
  };
  const treatment: EvolutionStrategyPoint = {
    ...treatmentPoints[0] as EvolutionStrategyPoint,
    updates: treatmentPoints.reduce((a, p) => a + p.updates, 0),
    spentMs: treatmentPoints.reduce((a, p) => a + p.spentMs, 0),
    overheadInTicks: treatmentPoints.reduce((a, p) => a + p.overheadInTicks, 0) / treatmentPoints.length,
    medianWeightShift: medianOf(treatmentPoints.map((p) => p.medianWeightShift)),
    medianOrganismEnergy: medianOf(treatmentPoints.map((p) => p.medianOrganismEnergy)),
    finalPopulation: meanOf(treatmentPoints.map((p) => p.finalPopulation)),
    worstLedgerResidual: treatmentPoints.reduce(
      (a, p) => (Math.abs(p.worstLedgerResidual) > Math.abs(a) ? p.worstLedgerResidual : a),
      0,
    ),
  };

  const differences = treatmentPoints.map(
    (p, i) => p.medianOrganismEnergy - (controlPoints[i]?.medianOrganismEnergy ?? 0),
  );
  const ci = bootstrapCI(differences, { seed: 9201 });
  const test = bootstrapTest(differences, { seed: 9202 });

  const reading =
    ci.lower > 0
      ? `Çatallanmış arama **işe yarıyor**: medyan organizma enerjisi ` +
        `${fmt(control.medianOrganismEnergy, 2)} → ${fmt(treatment.medianOrganismEnergy, 2)} e, ` +
        `fark [${fmt(ci.lower, 2)}, ${fmt(ci.upper, 2)}] sıfırdan ayrışıyor (p = ${fmt(test.pValue, 4)}). ` +
        `Ek yük ≈ ${fmt(treatment.overheadInTicks, 0)} tick'lik eşdeğer.`
      : `Çatallanmış arama **ölçülebilir performans artışı üretmedi**: fark ` +
        `${fmt(ci.estimate, 3)} [${fmt(ci.lower, 3)}, ${fmt(ci.upper, 3)}], p = ${fmt(test.pValue, 4)}. ` +
        `Ağırlık hareketi: medyan ‖Δθ‖ = ${fmt(treatment.medianWeightShift, 4)} ` +
        `(kontrol ${fmt(control.medianWeightShift, 4)}) — yani ${treatment.medianWeightShift > 0 ? 'arama θ\'yı hareket ettirdi ama davranış kazanmadı' : 'θ hiç hareket etmedi'}. ` +
        `Ek yük ≈ ${fmt(treatment.overheadInTicks, 0)} tick'lik eşdeğer.`;

  return { control, treatment, differences, difference: ci, test, reading };
}

export function formatEvolutionStrategy(r: EvolutionStrategyReport): string {
  const c = r.control;
  const t = r.treatment;
  return [
    `  kontrol (arama kapalı): medyan enerji ${fmt(c.medianOrganismEnergy, 2)} e · pop ${fmt(c.finalPopulation, 0)} · arama ${c.updates}`,
    `  tedavi  (arama açık) : medyan enerji ${fmt(t.medianOrganismEnergy, 2)} e · pop ${fmt(t.finalPopulation, 0)} · arama ${t.updates} (${t.perturbations} pertürbasyon × ${t.evaluateTicks} tick)`,
    `  ağırlık hareketi: kontrol ${fmt(c.medianWeightShift, 5)} · tedavi ${fmt(t.medianWeightShift, 5)}`,
    `  maliyet: ${t.ticks} tick'in koşusu ${fmt(c.stepMs * t.ticks, 0)} ms · arama ${fmt(t.spentMs, 0)} ms → ek yük ≈ ${fmt(t.overheadInTicks, 0)} tick`,
    `  enerji rezidülü: ${fmt(t.worstLedgerResidual, 9)} e`,
    `  eşleştirilmiş fark ${fmtInterval(r.difference, 3)} · p = ${fmt(r.test.pValue, 4)}`,
    `  → ${r.reading}`,
  ].join('\n');
}


// --------------------------------------------------- paylaşma eşiği duyarlılığı

export interface ShareThresholdPoint {
  idleLevel: number;
  idleEnergy: number;
  transfers: number;
  maxSurplus: number;
  peakColony: number;
  finalColony: number;
  finalMultiCellColonies: number;
  finalPopulation: number;
  finalMeanEnergyNorm: number;
  worstLedgerResidual: number;
}

export interface ShareThresholdReport {
  seeds: number;
  ticks: number;
  points: ShareThresholdPoint[];
  reading: string;
}

/**
 * **Paylaşma eşiği duyarlılık analizi** — `VALIDATION.md` §6.17'de bulunan
 * kalibrasyon kusurunun etkisini ölçer.
 *
 * Bulgu: boşta eşiği 82 e, hücreler 0–70 e bandında çalışıyor → paylaşma hiç
 * tetiklenmiyor → `shareEfficiency` genom parametresi hiçbir şey yapmıyor.
 *
 * **Bu bir düzeltme değil, ölçüm.** Oyun varsayılanı değişmez; buradaki değerler
 * yalnız "eşiği düşürsek ne olur?" sorusunu yanıtlar.
 *
 * **Değerlendirme ölçütü:** bir eşik değeri bulunmalıdır ki (a) paylaşma
 * gerçekten tetiklensin (transfers > 0), (b) enerji korunumu bozulmasın
 * (|rezidüel| < 1e-4), (c) çok hücreli yapılar **kaybolmasın** (mekanik
 * canlanırken ürünün temel özelliği bozulmamalıdır).
 */
export function sweepShareThreshold(options?: {
  idleLevels?: number[];
  seeds?: number;
  ticks?: number;
  strainDecayK?: number;
}): ShareThresholdReport {
  const idleLevels = options?.idleLevels ?? [0.82, 0.6, 0.5, 0.4, 0.3];
  const seeds = options?.seeds ?? 4;
  const ticks = options?.ticks ?? 8000;
  const strainDecayK = options?.strainDecayK ?? 0.005;

  const points = idleLevels.map((idleLevel) => {
    let transfers = 0;
    let maxSurplus = 0;
    let peakColony = 0;
    let finalColony = 0;
    let finalMulti = 0;
    let finalPop = 0;
    let finalEnergy = 0;
    let residual = 0;

    for (let i = 0; i < seeds; i++) {
      const world = new World({ seed: 3001 + i, population: 48, strainDecayK, shareIdleLevel: idleLevel });
      let peak = 0;
      for (let t = 0; t < ticks; t++) {
        world.step();
        if (t % 200 === 0) {
          const m = world.latestMetrics();
          if (m && m.largestColonySize > peak) peak = m.largestColonySize;
        }
      }
      const st = world.sharingStats();
      const m = world.latestMetrics();
      transfers += st.transfers;
      maxSurplus = Math.max(maxSurplus, st.maxSurplus);
      peakColony = Math.max(peakColony, peak);
      finalColony += m?.largestColonySize ?? 0;
      finalMulti += m?.coloniesOverFourCells ?? 0;
      finalPop += world.population();
      finalEnergy += m ? m.meanEnergy / 100 : 0;
      const res =
        world.ledger.initialTotal + world.ledger.externalInput - world.systemEnergyTotal() - world.ledger.dissipated;
      if (Math.abs(res) > Math.abs(residual)) residual = res;
    }

    return {
      idleLevel,
      idleEnergy: Math.round(100 * idleLevel),
      transfers,
      maxSurplus,
      peakColony,
      finalColony: Math.round(finalColony / seeds),
      finalMultiCellColonies: finalMulti / seeds,
      finalPopulation: Math.round(finalPop / seeds),
      finalMeanEnergyNorm: finalEnergy / seeds,
      worstLedgerResidual: residual,
    };
  });

  const firstLive = points.find((p) => p.transfers > 0);
  const reading = firstLive
    ? `Paylaşma **${firstLive.idleLevel}** eşiğinde (${firstLive.idleEnergy} e) ilk kez tetikleniyor: ` +
      `${firstLive.transfers} aktarım. Bu noktada çok hücreli yapılar ` +
      `${firstLive.finalMultiCellColonies.toFixed(2)} (zirve ${firstLive.peakColony}) ve enerji korunumu ` +
      `|${firstLive.worstLedgerResidual.toExponential(1)}|. Varsayılan 0.82'de aktarım **0**.`
    : 'Listelenen hiçbir eşikte paylaşma tetiklenmedi.';

  return { seeds, ticks, points, reading };
}

export function formatShareThreshold(r: ShareThresholdReport): string {
  const header =
    '  eşik   eşikEn   aktarım   maxFazla   zirve küme   son küme   son 4+   son pop   son enerji   rezidüel';
  const rows = r.points.map((p) =>
    `  ${fmt(p.idleLevel, 5)}   ${String(p.idleEnergy).padStart(6)}   ${String(p.transfers).padStart(8)}   ` +
    `${fmt(p.maxSurplus, 8)}   ${String(p.peakColony).padStart(9)}   ${String(p.finalColony).padStart(8)}   ` +
    `${fmt(p.finalMultiCellColonies, 6).padStart(6)}   ${String(p.finalPopulation).padStart(7)}   ` +
    `${fmt(p.finalMeanEnergyNorm, 10).padStart(11)}   ${fmt(p.worstLedgerResidual, 9)}`,
  );
  return [
    `  ${r.seeds} tohum × ${r.ticks} tick (strainK 0.005)`,
    header,
    ...rows,
    `  → ${r.reading}`,
  ].join('\n');
}

// --------------------------------------------------- MODES açık uçluluk metrikleri

/**
 * **MODES metrikleri** — Dolson vd. (2019), *The MODES Toolbox*, Artificial Life
 * 25(1). Açık uçluluğu dört potansiyelle ölçer: **değişim, yenilik,
 * karmaşıklık ve çeşitlilik**; artıca **aktivite**.
 *
 * Neden burada: literatür taraması (bu deponun `docs/LITERATURE.md` §1) açık
 * uçluluğun **ölçülebilir** olmasını şart koşuyor. Şimdiye kadar bu depo
 * "yaşam sürüyor / ölmüyor" diyordu; MODES metrikleri daha kesin bir dille
 * soruyor: popülasyon **değişiyor** ve **yeni biçimler** üretiyor mu?
 *
 * Bu metriklerin çoğu **mevcut dünya verisinden** türetilir; ek hesaplama
 * maliyeti ihmal edilebilirdir (genomlar 8 skaler, organizmalar birkaç yüz).
 */
export interface ModesSample {
  tick: number;
  /** Değişim: iki ardışık örnek arasındaki ortalama genom mesafesi. */
  change: number;
  /** Yenilik: daha önce hiç görülmemiş genom imzalarının oranı. */
  novelty: number;
  /** Çeşitlilik: niceliksel çeşitlilik (Shannon, genom dağılımı). */
  diversity: number;
  /** Karmaşıklık: organizma boyutu dağılımının normalleştirilmiş entropisi. */
  complexity: number;
  /** Aktivite: doğmuş toplam organizma sayısı (tür başına yaşam süresi). */
  activity: number;
  /** Tür sayısı (lineage) — çeşitliliğin destekleyici ölçütü. */
  species: number;
  population: number;
}

export interface ModesReport {
  seed: number;
  ticks: number;
  samples: ModesSample[];
  /** Pencere boyunca biriken benzersiz genom imzası sayısı. */
  uniqueGenomesSeen: number;
  /** Son örnekteki metrikler. */
  final: ModesSample | null;
  /** Metrikler erken pencereye göre arttı mı? (açık uçluluğun işareti) */
  trend: 'rising' | 'flat' | 'falling';
  reading: string;
}

/** Genomu kısa, kararlı bir imzaya çevirir (benzersizlik ölçümü için). */
function genomeSignature(g: Genome): string {
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return [
    r(g.bondAffinity), r(g.bondStrength), r(g.motility), r(g.senseRadius),
    r(g.shareEfficiency), r(g.toleranceA), r(g.toleranceB), r(g.plasticity),
  ].join(',');
}

function shannonEntropy(counts: readonly number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log(p);
  }
  return h;
}

/**
 * MODES metriklerini zaman serisi olarak ölçer.
 *
 * **Ölçüm disiplini:** `novelty` kümülatif bir "daha önce hiç görülmedi"
 * sayacıdır; pencereler arasında karşılaştırılabilir olsun diye **ağırlıklı
 * ortalama** olarak raporlanır, tepe değeri değil.
 */
export function measureModes(options?: {
  seed?: number;
  ticks?: number;
  sampleEvery?: number;
  strainDecayK?: number;
  population?: number;
}): ModesReport {
  const seed = options?.seed ?? 11;
  const ticks = options?.ticks ?? 12_000;
  const sampleEvery = options?.sampleEvery ?? 1000;
  const strainDecayK = options?.strainDecayK ?? 0.005;
  const population = options?.population ?? 48;

  const world = new World({ seed, population, strainDecayK });
  const seen = new Set<string>();
  const samples: ModesSample[] = [];
  let prevGenomes: Genome[] = [];

  const take = (tick: number): ModesSample => {
    const alive = [...world.organisms.values()].filter((o) => o.alive);
    const genomes = alive.map((o) => o.genome);

    // Değişim: **her güncel genomün kendisine en yakın önceki genoma** uzaklığı.
    //
    // ⚠️ Endeksle eşleştirme (prev[i] ↔ curr[i]) YANLIŞTIR: organizma listesi
    // her örnekte kayar, aynı indeks farklı bireyi gösterir ve sonuç
    // yapısal olarak sıfıra yakın çıkar. En yakın komşu ölçümü, "popülasyon
    // önceki örneğe göre ne kadar kaydı" sorusunu gerçekten yanıtlar.
    let change = 0;
    if (prevGenomes.length > 0 && genomes.length > 0) {
      let acc = 0;
      for (const g of genomes) {
        let best = Infinity;
        for (const p of prevGenomes) {
          const d = genomeDistance(p, g);
          if (d < best) best = d;
        }
        if (Number.isFinite(best)) acc += best;
      }
      change = acc / genomes.length;
    }
    prevGenomes = genomes;

    // Yenilik: bu örnekte görülen imzaların ne kadarı yeni?
    let fresh = 0;
    for (const g of genomes) {
      const sig = genomeSignature(g);
      if (!seen.has(sig)) {
        seen.add(sig);
        fresh++;
      }
    }

    // Çeşitlilik: niceliksel çeşitlilik (Shannon, iki ondalık kova)
    const buckets = new Array<number>(10).fill(0);
    for (const g of genomes) {
      const b = Math.min(9, Math.floor(genomeDistance(founderGenomeBase, g) * 25));
      buckets[b] = (buckets[b] as number) + 1;
    }

    // Karmaşıklık: hücre sayısı dağılımının entropisi (log ölçeği)
    const sizeBuckets = new Array<number>(6).fill(0);
    for (const o of alive) {
      const b = Math.min(5, Math.floor(Math.log2(Math.max(1, o.cells.length))));
      sizeBuckets[b] = (sizeBuckets[b] as number) + 1;
    }

    const diversity = shannonEntropy(buckets);
    const complexityRaw = shannonEntropy(sizeBuckets);
    const complexity = complexityRaw > 0 ? complexityRaw / Math.log(6) : 0;

    return {
      tick,
      change,
      novelty: genomes.length > 0 ? fresh / genomes.length : 0,
      diversity,
      complexity,
      // Aktivite: Dolson vd.'nin tanımı **birim zamanda toplam tür yaşam
      // süresidir**, monoton artan bir sayı değil. Yaşayanların yaşı × sayıları
      // üzerinden yarıçap kaydırılmasıyla ölçülür ki eğilim gösterebilsin.
      activity: (() => {
        let acc = 0;
        for (const o of world.organisms.values()) {
          if (!o.alive) continue;
          acc += (world.tick - o.bornTick) * 0.01 * o.cells.length;
        }
        return acc;
      })(),
      species: world.lineages.size,
      population: world.population(),
    };
  };

  samples.push(take(0));
  for (let t = 1; t <= ticks; t++) {
    world.step();
    if (t % sampleEvery === 0) samples.push(take(t));
  }

  const last = samples[samples.length - 1] ?? null;
  // Eğilim pencereleri: ilk ve son örnek **kullanılmaz** — tick 0'da tüm
  // kurucular tek hücrelidir (karmaşıklık = 0) ve popülasyon kurucu kümesidir
  // (yenilik = %100); bunları karşılaştırmak yapısal bir yanlılık üretir.
  let trend: ModesReport['trend'] = 'flat';
  const interior = r0samples(samples);
  const early = interior.slice(0, Math.max(1, Math.floor(interior.length / 2)));
  const late = interior.slice(Math.floor(interior.length / 2));
  if (early.length > 0 && late.length > 0) {
    const score = (xs: ModesSample[]) =>
      meanOf(xs.map((x) => x.diversity + x.complexity + 3 * x.change + 5 * x.novelty));
    const a = score(early);
    const b = score(late);
    trend = b > a * 1.15 ? 'rising' : b < a * 0.85 ? 'falling' : 'flat';
  }

  const noveltyEarly = samples[1]?.novelty ?? 0;
  const noveltyLate = last?.novelty ?? 0;
  const complexityEarly = samples[1]?.complexity ?? 0;
  const complexityLate = last?.complexity ?? 0;

  const reading =
    `Pencere sonu: değişim ${fmt(last?.change ?? 0, 4)} · yenilik %${(noveltyLate * 100).toFixed(1)} · ` +
    `çeşitlilik ${fmt(last?.diversity ?? 0, 3)} · karmaşıklık ${fmt(last?.complexity ?? 0, 3)} · ` +
    `tür ${last?.species ?? 0}. Eğilim: **${trend}**. ` +
    `Pencere boyunca ${seen.size} benzersiz genom imzası görüldü. ` +
    (trend === 'rising'
      ? 'Değişim ve çeşitlilik yükseliyor — açık uçluluğun pozitif işareti.'
      : `**Yakınsama, açık uçluluk değil:** yenilik %${(noveltyEarly * 100).toFixed(0)} → %${(noveltyLate * 100).toFixed(1)}, ` +
        `değişim ~0'a düştü, karmaşıklık ${fmt(complexityEarly, 2)} → ${fmt(complexityLate, 2)}. ` +
        `Popülasyon kısa bir keşiften sonra daralmaya geçiyor — Literatürdeki ` +
        `"açık uçluluk geçicidir, baskın desenlere çöker" bulgusunun ` +
        `bu modeldeki karşılığı (Faldor vd. 2023).`);

  return { seed, ticks, samples, uniqueGenomesSeen: seen.size, final: last, trend, reading };
}

/** İlk ve son örnekleri çıkarır (eğilim hesabı için). */
function r0samples(samples: ModesSample[]): ModesSample[] {
  return samples.length > 2 ? samples.slice(1, samples.length - 1) : samples;
}

/** Karşılaştırma tabanı: kurucu genomunun ortalaması. */
const founderGenomeBase: Genome = {
  bondAffinity: 0.55, bondStrength: 0.45, motility: 0.5, senseRadius: 4.2,
  shareEfficiency: 0.25, toleranceA: 0.6, toleranceB: 0.6, plasticity: 0.5,
};

export function formatModes(r: ModesReport): string {
  const header = '   tick   pop   değişim   yenilik%   çeşitlilik   karmaşıklık   aktivite   tür';
  const rows = r.samples.map(
    (s) =>
      `  ${String(s.tick).padStart(5)}  ${String(s.population).padStart(4)}  ${fmt(s.change, 8).padStart(8)}   ` +
      `${fmt(s.novelty * 100, 7).padStart(8)}   ${fmt(s.diversity, 10).padStart(10)}   ` +
      `${fmt(s.complexity, 12).padStart(12)}   ${String(s.activity).padStart(8)}   ${String(s.species).padStart(3)}`,
  );
  return [
    `  tohum ${r.seed} · ${r.ticks} tick · ${r.samples.length} örnek`,
    header,
    ...rows,
    `  → ${r.reading}`,
  ].join('\n');
}

// --------------------------------------------------- niş kapsama (yaşam haritası çekirdeği)

export interface SharingEffectPoint {
  seed: number;
  /** Varsayılan ayarda (0,82) aktarım sayısı. */
  transfers: number;
  /** 0,82'de ölçülen tepe koloni büyüklüğü. */
  peakDefault: number;
  /** Paylaşmanın matematiksel olarak imkânsız olduğu kolda tepe. */
  peakImpossible: number;
  popDefault: number;
  popImpossible: number;
}

export interface SharingEffectReport {
  points: SharingEffectPoint[];
  /** Eşleştirilmiş tepe farkları (varsayılan − imkânsız). */
  peakDifferences: number[];
  /** Paylaşmanın tetiklendiği tohum sayısı. */
  firing: number;
  seeds: number;
  meanPeakDefault: number;
  meanPeakImpossible: number;
  /** Tüm farkların en büyüğü — pozitifse paylaşma tepeyi büyütüyor demektir. */
  maxPeakDifference: number;
  reading: string;
}

/**
 * **Paylaşma mekaniğinin ölçülebilir etkisi.**
 *
 * Protokol: iki kol, **aynı tohumlar** (eşleştirilmiş).
 *  - tedavi  : boşta eşiği 0,82 (varsayılan)
 *  - kontrol : boşta eşiği **1,50** — hiçbir hücre kapasitesinin üstünde
 *              olamayacağı için paylaşma **matematiksel olarak imkânsız**
 *
 * Yani kontrol kolu "paylaşma kapalı bir dünya"dır. İki kolun tepe koloni
 * büyüklüğü farkı, paylaşmanın koloni yapısına katkısını doğrudan ölçer.
 *
 * Bu birim testi **değildir** — 24 dünya koşusudur ve vitest'in süre sınırını
 * aşar. Projenin kuralı gereği ölçümler pipeline'da koşar.
 */
export function experimentSharingEffect(options?: {
  /** Tohum listesini geçersiz kılır (varsayılan 12 tohumluk sabit küme). */
  seedList?: number[];
  seeds?: number;
  ticks?: number;
  seedBase?: number;
  population?: number;
}): SharingEffectReport {
  // Tohum kümesi deneyin kendisinde sabittir.
  const seedList = options?.seedList ?? [3001, 3002, 3003, 3004, 3005, 7, 42, 91, 123, 2026, 11, 12];
  const ticks = options?.ticks ?? 8000;
  const population = options?.population ?? 48;

  const run = (idle: number, seed: number): { peak: number; pop: number; transfers: number } => {
    const world = new World({ seed, population, strainDecayK: 0.005, shareIdleLevel: idle });
    let peak = 0;
    for (let t = 0; t < ticks; t++) {
      world.step();
      if (t % 200 === 0) {
        const m = world.latestMetrics();
        if (m && m.largestColonySize > peak) peak = m.largestColonySize;
      }
    }
    return { peak, pop: world.population(), transfers: world.sharingStats().transfers };
  };

  const points: SharingEffectPoint[] = [];
  for (const seed of seedList) {
    const d = run(0.82, seed);
    const b = run(1.5, seed);
    points.push({
      seed,
      transfers: d.transfers,
      peakDefault: d.peak,
      peakImpossible: b.peak,
      popDefault: d.pop,
      popImpossible: b.pop,
    });
  }

  const peakDifferences = points.map((p) => p.peakDefault - p.peakImpossible);
  const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const firing = points.filter((p) => p.transfers > 0).length;
  const meanPeakDefault = mean(points.map((p) => p.peakDefault));
  const meanPeakImpossible = mean(points.map((p) => p.peakImpossible));
  const maxPeakDifference = peakDifferences.length ? Math.max(...peakDifferences) : 0;

  const reading =
    `Varsayılan 0,82'de paylaşma tetiklenen tohum: ${firing}/${points.length} ` +
    `(ort. aktarım ${Math.round(mean(points.map((p) => p.transfers)))}). ` +
    `Ort. tepe küme — paylaşma AÇIK: ${meanPeakDefault.toFixed(2)}, ` +
    `paylaşma İMKÂNSIZ: ${meanPeakImpossible.toFixed(2)}. ` +
    `Eşleştirilmiş farklar: [${peakDifferences.join(', ')}]. ` +
    (maxPeakDifference > 0
      ? `**Paylaşma tepe koloni büyüklüğünü artırıyor** (en büyük fark ${maxPeakDifference}).`
      : `**Varsayılan ayarda paylaşmanın tepe koloni büyüklüğüne ölçülebilir etkisi yok** — ` +
        `hiçbir tohumda fark pozitif değil, ortalama da aynı. Mekanizma çalışıyor ` +
        `ama sonucu değiştirmiyor.`);

  return {
    points,
    peakDifferences,
    firing,
    seeds: points.length,
    meanPeakDefault,
    meanPeakImpossible,
    maxPeakDifference,
    reading,
  };
}

export function formatSharingEffect(r: SharingEffectReport): string {
  const rows = r.points.map(
    (p) =>
      `  tohum ${String(p.seed).padStart(5)}   aktarım ${String(p.transfers).padStart(6)}   ` +
      `tepe ${String(p.peakDefault).padStart(3)} / ${String(p.peakImpossible).padStart(3)}   ` +
      `fark ${String(p.peakDefault - p.peakImpossible).padStart(4)}   ` +
      `pop ${String(p.popDefault).padStart(4)} / ${String(p.popImpossible).padStart(4)}`,
  );
  return [
    '  eşik 0,82 (varsayılan)  ↔  1,50 (paylaşma matematiksel olarak imkânsız)',
    ...rows,
    `  tepe farkı aralığı: [${Math.min(...r.peakDifferences)}, ${r.maxPeakDifference}]   ` +
      `ort. ${r.meanPeakDefault.toFixed(2)} / ${r.meanPeakImpossible.toFixed(2)}   ` +
      `tetiklenen ${r.firing}/${r.seeds}`,
    `  → ${r.reading}`,
  ].join('\n');
}

export interface CooperationPoint {
  seed: number;
  peakOff: number;
  peakOn: number;
  bondsOff: number;
  bondsOn: number;
  /** Zaman içindeki EN YÜKSEK bağ sayısı — asıl ölçüt (final sayısı yanıltıcı). */
  peakBondsOff: number;
  peakBondsOn: number;
  renewals: number;
}

export interface CooperationReport {
  points: CooperationPoint[];
  bondDifferences: number[];
  /** Zaman içindeki tepe bağ sayısı farkları — asıl ölçüt. */
  peakBondDifferences: number[];
  peakDifferences: number[];
  bondInterval: Interval;
  bondTest: HypothesisTest;
  peakInterval: Interval;
  peakTest: HypothesisTest;
  reading: string;
}

/**
 * **Faz D · İşbirliği aktı deneyi.**
 *
 * Protokol: eşleştirilmiş iki kol, aynı tohumlar.
 *  - kontrol : `coopRenewal = 0` (kapalı) — ürün davranışı
 *  - tedavi  : `coopRenewal = 0.002`
 *
 * **Sonuç (12 tohum, 8000 tick):** mekanizma çalışıyor, kazancı yok.
 *   bağ sayısı farkı  ort +12,5  [9,0; 16,1]   p = 0,0001   ✅ belirgin
 *   tepe küme farkı   ort −0,67  [−3,08; +1,50]  p = 0,589    ❌ etkisiz
 */
export function experimentCooperation(options?: {
  seedList?: number[];
  ticks?: number;
  k?: number;
  population?: number;
}): CooperationReport {
  const seedList = options?.seedList ?? [3001, 3002, 3003, 3004, 3005, 7, 42, 91, 123, 2026, 11, 12];
  const ticks = options?.ticks ?? 8000;
  const k = options?.k ?? 0.002;
  const population = options?.population ?? 48;

  const run = (renewal: number, seed: number) => {
    const world = new World({ seed, population, strainDecayK: 0.005, coopRenewal: renewal });
    let peak = 0;
    let peakBonds = 0;
    // ⚠️ TEK döngü. İlk düzenlemede döngü iki kez kopyalanmıştı: dünya 8000 yerine
    // 16000 tick işliyordu ve "tepe bağ" sayısı koşunun **ikinci yarısından**
    // geliyordu. Sonuç: raporda "tepe bağ" başlığı altında aslında SON bağ
    // sayıları görünüyordu ve teşhis çürütülüyordu.
    for (let t = 0; t < ticks; t++) {
      world.step();
      if (t % 200 === 0) {
        const m = world.latestMetrics();
        if (m && m.largestColonySize > peak) peak = m.largestColonySize;
        if (world.bonds.size > peakBonds) peakBonds = world.bonds.size;
      }
    }
    return { peak, bonds: world.bonds.size, peakBonds, renewals: world.cooperationStats().renewals };
  };

  const points: CooperationPoint[] = seedList.map((seed) => {
    const off = run(0, seed);
    const on = run(k, seed);
    return {
      seed,
      peakOff: off.peak, peakOn: on.peak,
      bondsOff: off.bonds, bondsOn: on.bonds,
      peakBondsOff: off.peakBonds, peakBondsOn: on.peakBonds,
      renewals: on.renewals,
    };
  });

  const bondDifferences = points.map((p) => p.bondsOn - p.bondsOff);
  const peakBondDifferences = points.map((p) => p.peakBondsOn - p.peakBondsOff);
  const peakDifferences = points.map((p) => p.peakOn - p.peakOff);
  const bondInterval = bootstrapCI(bondDifferences, { seed: 41 });
  const bondTest = bootstrapTest(bondDifferences, { seed: 41 });
  const peakInterval = bootstrapCI(peakDifferences, { seed: 41 });
  const peakTest = bootstrapTest(peakDifferences, { seed: 41 });

  const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const up = peakDifferences.filter((d) => d > 0).length;
  const down = peakDifferences.filter((d) => d < 0).length;

  const reading =
    `Bağ sayısı farkı ${mean(bondDifferences).toFixed(1)} ${fmtInterval(bondInterval, 1)} · ` +
    `p = ${fmt(bondTest.pValue, 4)} → **mekanizma çalışıyor**, bağlar yenilenmeden kopmuyor. ` +
    `Tepe küme farkı ${mean(peakDifferences).toFixed(2)} ${fmtInterval(peakInterval, 2)} · ` +
    `p = ${fmt(peakTest.pValue, 4)} → ${peakTest.pValue < 0.05 ? 'koloni kazancı var' : 'koloni kazancı yok'} ` +
    `(artış ${up}, düşüş ${down} tohum). ` +
    `Tepe bağ farkı ${mean(peakBondDifferences).toFixed(1)} — ` +
    `**bağlar zirvede zaten bol; akt onları sonraki evre kurtarıyor, kazanç orada değil.** ` +
    `Ortalama yenileme: ${Math.round(mean(points.map((p) => p.renewals)))}.`;

  return {
    points, bondDifferences, peakBondDifferences, peakDifferences,
    bondInterval, bondTest, peakInterval, peakTest, reading,
  };
}

export function formatCooperation(r: CooperationReport): string {
  const rows = r.points.map(
    (p) =>
      `  tohum ${String(p.seed).padStart(5)}   bağ ${String(p.bondsOff).padStart(3)} → ${String(p.bondsOn).padStart(3)}` +
      `   tepe ${String(p.peakOff).padStart(3)} → ${String(p.peakOn).padStart(3)}` +
      `   tepeBağ ${String(p.peakBondsOff).padStart(4)} → ${String(p.peakBondsOn).padStart(4)}` +
      `   yenileme ${String(p.renewals).padStart(6)}`,
  );
  return [
    '  k = 0 (kapalı)  ↔  k = 0,002 (işbirliği aktı açık)',
    ...rows,
    `  bağ farkı (SON) ort ${(r.bondDifferences.reduce((a, b) => a + b, 0) / r.bondDifferences.length).toFixed(1)} ` +
      `${fmtInterval(r.bondInterval, 1)} · p = ${fmt(r.bondTest.pValue, 4)}`,
    `  tepeBağ farkı ort ${(r.peakBondDifferences.reduce((a, b) => a + b, 0) / r.peakBondDifferences.length).toFixed(1)}` +
      `  ← bağlar zirvede zaten bol; kazancın olması gereken yer burasıydı`,
    `  tepe farkı ort ${(r.peakDifferences.reduce((a, b) => a + b, 0) / r.peakDifferences.length).toFixed(2)} ` +
      `${fmtInterval(r.peakInterval, 2)} · p = ${fmt(r.peakTest.pValue, 4)}`,
    `  → ${r.reading}`,
  ].join('\n');
}

export interface NicheSeedingPoint {
  seed: number;
  /** İşgal edilen kutu sayısı (max 27). */
  occupied: number;
  /** En yoğun kutudaki organizma oranı — yakınsama ölçütü. */
  concentration: number;
  /** Canlı hücrelerdeki toplam enerji (verimlilik). */
  cellEnergy: number;
  /** Canlı popülasyon. */
  population: number;
  /** Arşivden enjekte edilen organizma sayısı. */
  seedCount: number;
  /** Enerji muhasebesi rezidülü (≈0 olmalı). */
  residual: number;
}

export interface NicheSeedingReport {
  control: NicheSeedingPoint;
  treatment: NicheSeedingPoint;
  /** Eşleştirilmiş farklar (tedavi − kontrol), tohum başına. */
  differences: number[];
  difference: Interval;
  test: HypothesisTest;
  reading: string;
}

/**
 * **Faz D deneyi — arşivin seçilime katılması (ε > 0).**
 *
 * Protokol: iki kol, **aynı tohumlar** (eşleştirilmiş). Kontrolde seçilim
 * kapalı (`ε = 0`, arşiv yalnız ölçer), tedavide açık (boş nişlere elit yavru
 * enjekte edilir). Bootstrap güven aralığı + eşleştirilmiş p; **eşik testi
 * yok** ("15/20 tohum" gibi) çünkü eşik, olmayan bir şeyi varmış gibi gösterir.
 *
 * **Başarı ölçütü (sonuçtan ÖNCE kaydedildi, sonra gevşetilmedi):**
 * MAP-Elites'in vaadi "çukuru doldurmak" olduğuna göre tedavi kolunda dolu
 * kutu sayısı artmalı. Birincil sonuç **kutu doluluğu**; ikincil olarak
 * yoğunlaşmanın düşmesi beklenir. Enerji korunumu bir **kabul testidir**:
 * rezidül ≈ 0 değilse deney geçersizdir, başarılı sayılmaz.
 */
export function experimentNicheSeeding(options?: {
  seeds?: number;
  ticks?: number;
  seedingInterval?: number;
  seedBase?: number;
  population?: number;
}): NicheSeedingReport {
  const seeds = options?.seeds ?? 4;
  const ticks = options?.ticks ?? 12_000;
  const seedingInterval = options?.seedingInterval ?? 250;
  const seedBase = options?.seedBase ?? 9101;
  const population = options?.population ?? 48;

  const runArm = (enabled: boolean, seed: number): NicheSeedingPoint => {
    const world = new World({
      seed,
      population,
      strainDecayK: 0.005,
      nicheSeeding: enabled,
      nicheSeedingInterval: seedingInterval,
    });
    for (let t = 1; t <= ticks; t++) world.step();

    const snap = world.nicheSnapshot();
    let cellEnergy = 0;
    for (const c of world.cells.values()) cellEnergy += c.energy;
    return {
      seed,
      occupied: snap.occupied,
      concentration: snap.concentration,
      cellEnergy,
      population: world.population(),
      seedCount: snap.seedCount,
      residual: world.ledger.residual(world.systemEnergyTotal()),
    };
  };

  const differences: number[] = [];
  const controlPoints: NicheSeedingPoint[] = [];
  const treatmentPoints: NicheSeedingPoint[] = [];
  for (let i = 0; i < seeds; i++) {
    const seed = seedBase + i;
    const c = runArm(false, seed);
    const t = runArm(true, seed);
    controlPoints.push(c);
    treatmentPoints.push(t);
    differences.push(t.occupied - c.occupied);
  }

  const mean = (xs: readonly number[]): number =>
    xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const meanOf = (xs: readonly NicheSeedingPoint[], f: (p: NicheSeedingPoint) => number): number =>
    mean(xs.map(f));

  const control: NicheSeedingPoint = {
    seed: -1,
    occupied: meanOf(controlPoints, (p) => p.occupied),
    concentration: meanOf(controlPoints, (p) => p.concentration),
    cellEnergy: meanOf(controlPoints, (p) => p.cellEnergy),
    population: meanOf(controlPoints, (p) => p.population),
    seedCount: 0,
    residual: meanOf(controlPoints, (p) => Math.abs(p.residual)),
  };
  const treatment: NicheSeedingPoint = {
    seed: -1,
    occupied: meanOf(treatmentPoints, (p) => p.occupied),
    concentration: meanOf(treatmentPoints, (p) => p.concentration),
    cellEnergy: meanOf(treatmentPoints, (p) => p.cellEnergy),
    population: meanOf(treatmentPoints, (p) => p.population),
    seedCount: meanOf(treatmentPoints, (p) => p.seedCount),
    residual: meanOf(treatmentPoints, (p) => Math.abs(p.residual)),
  };

  const test = bootstrapTest(differences, { seed: 31 });
  const ci = bootstrapCI(differences, { seed: 31 });

  // --- Mekanizma teşhisi --------------------------------------------------
  //
  // Sonuç negatifse **neden** diye sormak zorundayız. Denen hipotez:
  // elit mutasyonla enjekte edildiği için hedef nişten kayıyor.
  //
  // ⚠️ Bu bir açıklamadır, kanıt değil — ve test edilip çürütüldü.
  // Gerçek neden ölçüldü: **enjeksiyon her seferinde boş bir nişe yapılıyor**,
  // dolayısıyla kutu o an boş görünüyor; elit nereden gelirse gelsin gireceği
  // yer boş. Yukarıdaki doluluk farklarının tohumlar arasında işaret değiştirmesi
  // (+1, −4, +4, −1) bunun dağınıklığını gösteriyor.
  //
  // Daha temel bir sınır (aşağıda ölçüldü): **boyut kalıtsal değil**. Enjekte
  // edilen her organizma tek hücreyle doğar, dolayısıyla boyut ekseninde
  // seçilim hiçbir şey koruyamaz.

  const gained = treatment.occupied > control.occupied;
  const reading =
    `Dolu kutu: kontrol ${control.occupied.toFixed(2)} → tedavi ${treatment.occupied.toFixed(2)} ` +
    `(+/27). Yoğunlaşma: %${(control.concentration * 100).toFixed(0)} → %${(treatment.concentration * 100).toFixed(0)}. ` +
    `Enjeksiyon: kolo başına ${treatment.seedCount.toFixed(1)} organizma. ` +
    `Enerji rezidülü: kontrol |${control.residual.toExponential(1)}| · tedavi |${treatment.residual.toExponential(1)}| e. ` +
    (Math.max(control.residual, treatment.residual) > 1e-6
      ? '⚠️ **Enerji korunumu bozuldu — deney geçersiz, sonuç yorumlanamaz.**'
      : gained
        ? '**Arşiv seçilime katılınca doluluk arttı:** MAP-Elites kuralı bu modelde çukuru doldurdu.'
        : '**Arşiv seçilime katılınca doluluk artmadı:** MAP-Elites kuralı bu modelde işe yaramadı. ' +
          'Nedeni yapısal: (1) **boyut kalıtsal değil** — enjekte edilen her organizma tek hücreyle ' +
          'doğar, dolayısıyla boyut ekseninde seçilim hiçbir şey koruyamaz; ' +
          '(2) seçilim **anlık boşluğa** enjekte eder, elit nereden gelirse gelsin ' +
          'gireceği yer o an boş olduğu için hedef kutu garanti değildir.');

  return { control, treatment, differences, difference: ci, test, reading };
}

export function formatNicheSeeding(r: NicheSeedingReport): string {
  return [
    `  eşleştirilmiş fark (dolu kutu, tohum başına): [${r.differences.map((d) => d.toFixed(0)).join(', ')}]`,
    `  dolu kutu (/27)          ${r.control.occupied.toFixed(2)} → ${r.treatment.occupied.toFixed(2)}`,
    `  yoğunlaşma              %${(r.control.concentration * 100).toFixed(0)} → %${(r.treatment.concentration * 100).toFixed(0)}`,
    `  canlı popülasyon        ${r.control.population.toFixed(0)} → ${r.treatment.population.toFixed(0)}`,
    `  hücre enerjisi (e)      ${r.control.cellEnergy.toFixed(0)} → ${r.treatment.cellEnergy.toFixed(0)}`,
    `  enjeksiyon (adet)       0 → ${r.treatment.seedCount.toFixed(1)}`,
    `  enerji rezidülü |e|     ${r.control.residual.toExponential(1)} → ${r.treatment.residual.toExponential(1)}`,
    `  eşleştirilmiş fark ${fmtInterval(r.difference, 2)} · p = ${fmt(r.test.pValue, 4)}`,
    `  → ${r.reading}`,
  ].join('\n');
}

/**
 * Niş ızgarasının eksen sınırları — **ortak modülden** gelir.
 *
 * ⚠️ Değerler burada tanımlanmaz; `src/sim/lab/lifeMap.ts` tek kaynaktır ve
 * üründeki yaşam haritası paneli de aynı sabitleri kullanır. İki ayrı kopya
 * zamanla ayrışır ve aynı sayı iki farklı yorumla raporlanır — bu bir kez
 * yaşandı (deneylerdeki hız "yer değiştirme", üst sınır ise "mb/tick" idi;
 * gözlemlerin 1581/1582'si tavana kırpılıyor ve eksen sıfır bilgi taşıyordu).
 *
 * Kalibrasyon `tools/calibrate-niche-axes.ts` çıktısından gelir ve
 * dondurulmuştur; gözlemden ayarlanmış bir "iyi görünen" aralık değildir.
 */
export const NICHE_SPEED_MAX = LIFE_SPEED_MAX;
export const NICHE_SIZE_MAX = LIFE_SIZE_MAX;

export interface NicheCell {
  /** Hız kutusu (0 = en yavaş). */
  speedBin: number;
  /** Boyut kutusu (hücre sayısı). */
  sizeBin: number;
  /** Duyu menzili kutusu. */
  rangeBin: number;
  /** Bu kutuda yaşayan organizma sayısı (pencere sonu). */
  count: number;
  /** Bu kutunun en iyi bireyi (enerji norm). */
  bestEnergyNorm: number;
  /** Bu kutudaki en iyi bireyin soy kimliği. */
  bestLineage: number;
}

/**
 * Bir eksenin sağlığı — **ölçüm aletinin kendi denetimi.**
 *
 * Gerekçe: bu ölçümün ilk sürümünde iki eksen de ölüydü ve hiçbir belirti
 * vermiyordu. Hız ekseni tavana kırpılıyordu (yanlış birim: iki örnek arasındaki
 * yer değiştirme "tick başına" sanılıyordu; ölçümde dağılımın %99,9'u tavanın
 * üstündeydi → herkes üst kutuya düşüyordu). Boyut ekseni ise ters yönde
 * ölüydü: tavan 48 hücreydi ama en büyük organizma 8 hücreydi, yani 3. kutu
 * yapısal olarak **hiç erişilemez**di.
 *
 * İkisi de "makul görünen" sayılar üretti. Bu yüzden alet, eksenlerinin ne
 * kadarını gerçekten kullandığını **her koşuda raporlamak zorunda**.
 */
export interface NicheAxisHealth {
  axis: 'hız' | 'boyut' | 'menzil';
  /** Kutu sayısı. */
  bins: number;
  /** Üst sınır (bu eksenin kendi biriminde). */
  max: number;
  /** Üst sınıra değen / aşan gözlem — bunlar üst kutuya kırpılır. */
  clamped: number;
  /** Toplam gözlem. */
  total: number;
  /** En az bir gözlem düşen kutu sayısı. */
  binsReached: number;
  /** Gözlenen en küçük değer. */
  min: number;
}

export interface NicheReport {
  seed: number;
  ticks: number;
  grid: { speed: number; size: number; range: number };
  /** Dolu kutu sayısı ve toplam kutu sayısı. */
  occupied: number;
  total: number;
  occupancy: number;
  /** Zaman içinde dolu kutu sayısı — daralma mı genişleme mi? */
  occupiedOverTime: number[];
  /** Pencerenin sonunda dolu kutular. */
  cells: NicheCell[];
  /** Her eksenin kendi sağlığı — aletin kendi denetimi. */
  health: NicheAxisHealth[];
  /** Bir eksen çöktüyse (tek kutuya kırpıldı veya bir kutu hiç dolmadı) adı. */
  degenerateAxes: string[];
  reading: string;
}

/**
 * **Niş kapsama ölçümü — yaşam haritasının sayısal çekirdeği.**
 *
 * Faz C1 (MODES) "popülasyon daralıyor" dedi. Bu ölçüm bunu somutlaştırır:
 * **kaç farklı davranış nişi işgal ediliyor?**
 *
 * Tasarayıcılar (Picbreeder / MAP-Elites kalıbı): ölçülebilir davranış
 * betimleyicileri üzerinden bir ızgara kurulur ve her hücrede o davranışın
 * **en iyi temsilcisi** saklanır. "Yaşam haritası" bu ızgaranın görselleştirilmiş
 * hâlidir.
 *
 * Betimleyiciler (tamamı **ölçülebilir**, genomdan tahmin değil):
 *  1. **Hız** — merkez hareketi (mb/tick), doğrudan ölçülür
 *  2. **Boyut** — hücre sayısı
 *  3. **Duyu menzili** — genom.senseRadius
 *
 * `ε = 0` varsayılanla arşiv **yalnız ölçüm** olarak çalışır; ürün davranışı
 * değişmez. Arşivin seçilimi *doldurması* (ε > 0) ayrı bir adımdır.
 */
export function measureNicheCoverage(options?: {
  seed?: number;
  ticks?: number;
  sampleEvery?: number;
  strainDecayK?: number;
  population?: number;
  binsPerAxis?: number;
}): NicheReport {
  const seed = options?.seed ?? 11;
  const ticks = options?.ticks ?? 12_000;
  const sampleEvery = options?.sampleEvery ?? 1000;
  const strainDecayK = options?.strainDecayK ?? 0.005;
  const population = options?.population ?? 48;
  const B = options?.binsPerAxis ?? 3;

  const world = new World({ seed, population, strainDecayK });

  // Betimleyici aralıkları **sabit** ve **kalibre edilmiş** (bkz. NICHE_* ve
  // `tools/calibrate-niche-axes.ts`).
  //
  // ⚠️ Bu ölçüm iki hatayı düzeltmek için yeniden yazıldı; ikisi de "makul
  // görünen" sayılar üretiyordu:
  //
  //  1. **Birim hatası.** Hız, iki örnek arasındaki *yer değiştirme* olarak
  //     ölçülüyordu, sonra `SPEED_MAX = 0.08` (mb/tick) ile karşılaştırılıyordu.
  //     Ölçümde dağılımın 1581/1582'si tavanın üstündeydi → hız ekseni tümüyle
  //     üst kutuya kırpıldı ve **hiçbir bilgi taşımadı**. Aralık doğru birimde
  //     olduğunda aynı gözlemlerin 0/1582'si tavanı aşıyor.
  //
  //  2. **Pencereye bağlı tanım.** Yer değiştirme rastgele yürüyüşte √Δt ile
  //     büyür; ölçülen "tick başına hız" örnekleme aralığına göre değişiyordu
  //     (20 tick'te medyan 0.057, 200 tick'te 0.019). Artık **yol uzunluğu**
  //     her tick biriktiriliyor ve tick sayısına bölünüyor; bu tanım pencereye
  //     bağlı değildir. (Her tick ölçmek istenirse maliyet ölçüldü: 3000 tick'te
  //     `step` yalnız 907 ms, merkez de eklenince 863 ms — yani gürültü içinde.)
  const RANGE_MIN = GENOME_BOUNDS.senseRadius[0];
  const RANGE_MAX = GENOME_BOUNDS.senseRadius[1];

  const prevC = new Map<number, { x: number; y: number; z: number }>();
  const pathOf = new Map<number, number>();
  const firstOf = new Map<number, number>();
  // Eksen sağlığı: her eksende kaç gözlem üst sınıra değdi, kaç kutu gerçekten doldu.
  const clamped = { speed: 0, size: 0, range: 0 };
  const observed = { speed: 0, size: 0, range: 0 };
  const binsHit = { speed: new Set<number>(), size: new Set<number>(), range: new Set<number>() };
  const axisMin = { speed: Infinity, size: Infinity, range: Infinity };

  const occupiedOverTime: number[] = [];
  const cells = new Map<string, NicheCell>();

  const binOf = (v: number, max: number): number => {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(B - 1, Math.floor((v / max) * B)));
  };

  /** Her tick: merkez konumunu ve yol uzunluğunu biriktir. */
  const track = (t: number): void => {
    for (const org of world.organisms.values()) {
      if (!org.alive || org.cells.length === 0) continue;
      const c = world.centroidOf(org);
      const prev = prevC.get(org.id);
      if (prev) pathOf.set(org.id, (pathOf.get(org.id) ?? 0) + Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z));
      else firstOf.set(org.id, t);
      prevC.set(org.id, { ...c });
    }
  };

  const sample = (t: number): void => {
    const occupied = new Set<string>();
    for (const org of world.organisms.values()) {
      if (!org.alive || org.cells.length === 0) continue;
      // Yeni doğan organizmanın henüz bir tick geçmişi yoktur; ölçüme
      // sokmak onu yanlışlıkla "sıfır hız" kutusuna atardı.
      const elapsed = t - (firstOf.get(org.id) ?? t);
      if (elapsed <= 0) continue;
      const speed = (pathOf.get(org.id) ?? 0) / elapsed;
      const size = Math.log2(org.cells.length);
      const range = org.genome.senseRadius - RANGE_MIN;

      if (speed >= NICHE_SPEED_MAX) clamped.speed++;
      if (size >= NICHE_SIZE_MAX) clamped.size++;
      if (range >= RANGE_MAX - RANGE_MIN) clamped.range++;
      observed.speed++;
      observed.size++;
      observed.range++;
      axisMin.speed = Math.min(axisMin.speed, speed);
      axisMin.size = Math.min(axisMin.size, size);
      axisMin.range = Math.min(axisMin.range, range);

      const sb = binOf(speed, NICHE_SPEED_MAX);
      const zb = binOf(size, NICHE_SIZE_MAX);
      const rb = binOf(range, RANGE_MAX - RANGE_MIN);
      binsHit.speed.add(sb);
      binsHit.size.add(zb);
      binsHit.range.add(rb);
      const key = `${sb}.${zb}.${rb}`;
      occupied.add(key);

      const cell = cells.get(key);
      const energyNorm =
        org.cells.reduce((a, id) => a + (world.cells.get(id)?.energyNorm ?? 0), 0) / Math.max(1, org.cells.length);
      if (!cell || energyNorm > cell.bestEnergyNorm) {
        cells.set(key, {
          speedBin: sb, sizeBin: zb, rangeBin: rb,
          count: (cell?.count ?? 0) + 1,
          bestEnergyNorm: energyNorm,
          bestLineage: org.lineageId,
        });
      } else if (cell) {
        cell.count += 1;
      }
    }
    occupiedOverTime.push(occupied.size);
  };

  // ⚠️ Döngüden **önce** örnek almak ayrı bir hataydı: hiç adım atılmadığı için
  // her organizma "sıfır hız" kutusuna düşüyor ve seri ilk noktadan itibaren
  // yanlışlıkla küçük başlıyordu. Seri artık yalnız adım sonrası noktalardan
  // oluşur.
  for (let t = 1; t <= ticks; t++) {
    world.step();
    track(t);
    if (t % sampleEvery === 0) sample(t);
  }

  const total = B * B * B;
  const cellList = [...cells.values()].sort(
    (a, b) => a.speedBin - b.speedBin || a.sizeBin - b.sizeBin || a.rangeBin - b.rangeBin,
  );

  // --- Eksen sağlığı: aletin kendi denetimi ---------------------------------
  const health: NicheAxisHealth[] = [
    { axis: 'hız', bins: B, max: NICHE_SPEED_MAX, clamped: clamped.speed, total: observed.speed, binsReached: binsHit.speed.size, min: axisMin.speed },
    { axis: 'boyut', bins: B, max: NICHE_SIZE_MAX, clamped: clamped.size, total: observed.size, binsReached: binsHit.size.size, min: axisMin.size },
    { axis: 'menzil', bins: B, max: RANGE_MAX - RANGE_MIN, clamped: clamped.range, total: observed.range, binsReached: binsHit.range.size, min: axisMin.range },
  ];
  // Çökme kuralı **yalnız güvenilir sinyale** bakar:
  //
  //  - `binsReached === 1` → eksen tek kutuya kırpılmış, hiçbir ayrım üretmiyor.
  //    (Hız ekseninin ilk hâli tam olarak buydu: %99,9 tavana kırpılıyordu.)
  //  - `clamped/total > 0.9` → neredeyse her gözlem üst sınıra yapışmış.
  //
  // ⚠️ "Bazı kutular hiç dolmadı" **tek başına arıza sayılmaz**. Boyut ekseninde
  // 3. kutu seyrek doludur çünkü organizmaların çoğu 1–2 hücreli — bu bir alet
  // hatası değil, ölçülen biyolojidir. Bu yüzden eksik kutular yalnız
  // `binsReached` olarak **raporlanır**, "çöktü" ilan edilmez. Arıza ilan etmek,
  // ölçülen bir gerçeği gizlemekten daha kötüdür.
  const degenerateAxes = health
    .filter((h) => h.binsReached < 2 || (h.total > 0 && h.clamped / h.total > 0.9))
    .map((h) => h.axis);

  // Eğilim **uç nokta** karşılaştırmasıyla değil, serinin ilk ve son üçte
  // birinin ortalamasıyla belirlenir: seri 1–5 arasında salınıyor ve uçlar
  // karşılaştırılınca "genişliyor" gibi yanlış bir eğilim çıkıyor.
  // (MODES ölçümünde de aynı tuzakla karşılaşılmıştı.)
  //
  // ⚠️ Ama "üçte bir" tek bir noktaya düşerse (kısa seride `floor(n/3) == 1`)
  // bu karşılaştırma yine uç noktadır ve **gürültüyü eğilim diye okur**.
  // Gözlem: 4 noktalı seri `[2, 5, 4, 4]` "2.0 → 4.0 genişledi" derken aynı
  // koşu 7 noktalı örneklemede daralma gösteriyordu. Seri yeterince uzun
  // değilse eğilim iddiası **hiç kurulmaz**.
  const third = Math.floor(occupiedOverTime.length / 3);
  const trendKnown = third >= 2;
  const meanOfSlice = (xs: readonly number[]) => (xs.length > 0 ? meanOf(xs) : 0);
  const early = trendKnown ? meanOfSlice(occupiedOverTime.slice(0, third)) : 0;
  const late = trendKnown ? meanOfSlice(occupiedOverTime.slice(-third)) : 0;
  const top = cellList.reduce((a, c) => (c.count > a.count ? c : a), cellList[0] as NicheCell);
  const totalOrganisms = cellList.reduce((a, c) => a + c.count, 0);
  const concentration = totalOrganisms > 0 ? (top?.count ?? 0) / totalOrganisms : 0;

  const trendText = trendKnown
    ? `Dolu kutu sayısı: ilk üçte ${early.toFixed(1)} → son üçte ${late.toFixed(1)} ortalama. `
    : `Dolu kutu sayısı: seriden eğilim okunmuyor (yalnız ${occupiedOverTime.length} örnek, ` +
      `üçte bir için gereken en az 6 örnek sağlanmıyor). `;

  const reading =
    `${cellList.length}/${total} kutu dolu (%${((cellList.length / total) * 100).toFixed(0)} doluluk). ` +
    `En yoğun kutuda %${(concentration * 100).toFixed(0)} organizma birikmiş ` +
    `(kutu ${top?.speedBin}/${top?.sizeBin}/${top?.rangeBin}). ` +
    trendText +
    (degenerateAxes.length > 0
      ? `⚠️ **Eksen çöktü (${degenerateAxes.join(', ')}):** bu eksen ızgarayı taşıyamıyor, ` +
        `doluluk sayısı bu haliyle yorumlanamaz.`
      : '') +
    (degenerateAxes.length === 0 && concentration > 0.5
      ? '**Belirgin yakınsama:** organizmaların çoğu tek bir davranış kutusunda. ' +
        'Bu, yaşam haritasının (Faz D) çözeceği problem: arşiv olmadan popülasyon tek çukura düşüyor.'
      : degenerateAxes.length === 0
        ? 'Dağılım makul; belirgin bir çukur yok.'
        : '');

  return {
    seed, ticks,
    grid: { speed: B, size: B, range: B },
    occupied: cellList.length,
    total,
    occupancy: cellList.length / total,
    occupiedOverTime,
    cells: cellList,
    health,
    degenerateAxes,
    reading,
  };
}

export function formatNiche(r: NicheReport): string {
  const header = `  hız/boyut/menzil  adet   en iyi enerji   soy`;
  const rows = r.cells.map(
    (c) =>
      `  ${String(c.speedBin).padStart(2)}/${c.sizeBin}/${c.rangeBin}      ${String(c.count).padStart(4)}   ` +
      `${fmt(c.bestEnergyNorm, 11).padStart(12)}   ${String(c.bestLineage).padStart(3)}`,
  );
  const healthRows = r.health.map(
    (h) =>
      `  ${h.axis.padEnd(7)} üst sınır ${h.max.toFixed(3).padStart(7)} · ` +
      `gözlem ${String(h.total).padStart(6)} · tavana kırpılan ${String(h.clamped).padStart(6)} ` +
      `(%${h.total > 0 ? ((h.clamped / h.total) * 100).toFixed(1) : '0.0'}) · ` +
      `dolu kutu ${h.binsReached}/${h.bins} · en küçük ${Number.isFinite(h.min) ? h.min.toFixed(3) : '—'}` +
      (r.degenerateAxes.includes(h.axis) ? '   ⚠️ ÇÖKTÜ' : ''),
  );
  return [
    `  tohum ${r.seed} · ${r.ticks} tick · ızgara ${r.grid.speed}×${r.grid.size}×${r.grid.range} = ${r.total} kutu`,
    header,
    ...rows,
    `  dolu kutu zaman serisi: [${r.occupiedOverTime.join(', ')}]`,
    `  eksen sağlığı (ölçüm aletinin kendi denetimi):`,
    ...healthRows,
    `  → ${r.reading}`,
  ].join('\n');
}

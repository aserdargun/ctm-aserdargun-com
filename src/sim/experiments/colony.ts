/**
 * Cell to Mind — koloni düzeyi deney koşucusu.
 *
 * `arena.ts` bireysel davranışı izole eder; bu modül **popülasyon**
 * sorularını yanıtlar: koloniler kuruluyor mu, soy çeşitleniyor mu,
 * ekosistem sürüyor mu.
 *
 * Aranan sonuç alanları `MetricsSample`'dan okunur — dünya zaten her tick
 * ölçüm topluyor, bu modül yeni ölçüm kodu **eklemez**. Tek istisna: zirve
 * değerler (popülasyon hiç nereye gitmediyse son değer yanıltıcıdır) koşu
 * boyunca taranarak tutulur.
 */

import { C } from '../biology/energy.ts';
import { meanGenome } from '../genome.ts';
import { World } from '../world.ts';
import type { Genome } from '../types.ts';

export interface ColonyOptions {
  seed: number;
  ticks: number;
  population?: number;
  /** Bağ kurma açık mı? (Çok hücreliliğin ön koşulu.) */
  bondsEnabled?: boolean;
  /** Mutasyon açık mı? Kapalıyken çocuklar ebeveyn genomunun **tam** kopyasını alır. */
  mutationEnabled?: boolean;
  learningEnabled?: boolean;
  selectionPressure?: number;
  preset?: string;
  /**
   * Kurucu genomlarının `bondAffinity` değerini zorla.
   * `mutationEnabled: false` ile birlikte kullanılırsa bu değer soy boyunca
   * birebir korunur ve "bağ gücünün etkisi" izole ölçülür.
   */
  bondAffinityOverride?: number;
  /** Zirve değerler için örnekleme aralığı (tick). */
  sampleEvery?: number;
}

export interface ColonyResult {
  seed: number;
  ticks: number;

  /** Pencerenin sonundaki canlı hücre sayısı. */
  finalPopulation: number;
  finalOrganisms: number;
  /** Pencerenin sonunda en büyük bağlı küme. */
  finalLargestColony: number;
  /** Pencerenin sonunda 4+ hücreli yapı sayısı (işletimsel eşik). */
  finalMultiCellColonies: number;

  /** Koşu boyunca görülen en büyük küme. */
  peakLargestColony: number;
  /** Koşu boyunca görülen 4+ hücreli yapı sayısının zirvesi. */
  peakMultiCellColonies: number;
  /** Kurucu sayısına göre zirve çarpanı (1.0 = kurucu seviyesinde kaldı). */
  peakColonyGrowthFactor: number;

  /** Pencerenin sonundaki ortalama normalize enerji. */
  finalMeanEnergyNorm: number;
  /** Koşu boyunca ulaşılan en yüksek nesil. */
  maxGeneration: number;
  /** Toplam soy sayısı (çeşitlilik göstergesi). */
  lineageCount: number;
  /** Tamamlanmış koloni üreme nesli (organizma düzeyi ölçüm). */
  completedColonyGenerations: number;
  /** Toplam bağ sayısı (pencere sonu). */
  finalBondCount: number;
  /** Kalan canlı hücre enerjisinin toplamı — rezerv tüketimiyle ilgili. */
  finalTotalEnergy: number;

  learningUpdates: number;
  /** Enerji muhasebesi rezidüelü; sıfırdan farklı olması sonucu geçersiz kılar. */
  ledgerResidual: number;

  /**
   * Kurucu popülasyonun ortalama genomu ile koşu sonunda **yaşayan**
   * organizmaların ortalama genomu arasındaki ortalama mutlak kayma
   * (8 parametre üzerinden, 0..1 ölçeğinde normalize).
   *
   * Bu, "uyarlanma"nın ölçülebilir hâlidir: seçilim genların bir yönde
   * sistematik olarak kaydırmıyorsa bu sayı sıfıra yakın çıkar. Sıfır
   * çıkması bir başarısızlık değil, **düzenin yokluğunun** bulgusudur.
   */
  genomeShift: number;
  /** Evrilen kolun kurucu genomu. */
  founderGenome: Genome;
  /** Koşu sonunda hayatta kalanların ortalama genomu (ölü organizmalar sayılmaz). */
  livingGenome: Genome;
}

/** İki genom arasındaki ortalama mutlak fark (8 parametre, normalize ölçekte). */
export function genomeDistance(a: Genome, b: Genome): number {
  return (
    (Math.abs(a.bondAffinity - b.bondAffinity) +
      Math.abs(a.bondStrength - b.bondStrength) +
      Math.abs(a.motility - b.motility) +
      Math.abs(a.senseRadius - b.senseRadius) +
      Math.abs(a.shareEfficiency - b.shareEfficiency) +
      Math.abs(a.toleranceA - b.toleranceA) +
      Math.abs(a.toleranceB - b.toleranceB) +
      Math.abs(a.plasticity - b.plasticity)) /
    8
  );
}

export function runColony(options: ColonyOptions): ColonyResult {
  const {
    seed,
    ticks,
    population = C.DEFAULT_POPULATION,
    bondsEnabled = true,
    mutationEnabled = false,
    learningEnabled = true,
    selectionPressure,
    preset,
    bondAffinityOverride,
    sampleEvery = 1,
  } = options;

  const world = new World({
    seed,
    population,
    bondsEnabled,
    mutationEnabled,
    learningEnabled,
    growthEnabled: true,
    reproductionEnabled: true,
    ...(selectionPressure === undefined ? {} : { selectionPressure }),
    ...(preset === undefined ? {} : { preset }),
  });

  if (bondAffinityOverride !== undefined) {
    for (const org of world.organisms.values()) {
      org.genome.bondAffinity = bondAffinityOverride as Genome['bondAffinity'];
    }
  }

  const founderCount = population;
  const founderGenome = meanGenome([...world.organisms.values()].map((o) => o.genome));
  let peakLargestColony = 0;
  let peakMultiCellColonies = 0;

  for (let t = 1; t <= ticks; t++) {
    world.step();
    if (t % sampleEvery !== 0) continue;
    const m = world.latestMetrics();
    if (!m || m.tick !== world.tick) continue;
    if (m.largestColonySize > peakLargestColony) peakLargestColony = m.largestColonySize;
    if (m.coloniesOverFourCells > peakMultiCellColonies) peakMultiCellColonies = m.coloniesOverFourCells;
  }

  const last = world.latestMetrics();
  const finalMetrics = last && last.tick === world.tick ? last : undefined;
  const current = world.systemEnergyTotal();

  const livingGenomes = [...world.organisms.values()].filter((o) => o.alive).map((o) => o.genome);
  const livingGenome = livingGenomes.length > 0 ? meanGenome(livingGenomes) : founderGenome;

  return {
    seed,
    ticks,
    finalPopulation: world.population(),
    finalOrganisms: world.aliveOrganismCount(),
    finalLargestColony: finalMetrics?.largestColonySize ?? 0,
    finalMultiCellColonies: finalMetrics?.coloniesOverFourCells ?? 0,
    peakLargestColony,
    peakMultiCellColonies,
    peakColonyGrowthFactor: peakLargestColony / Math.max(1, founderCount),
    finalMeanEnergyNorm: finalMetrics ? finalMetrics.meanEnergy / C.CELL_CAPACITY : Number.NaN,
    maxGeneration: finalMetrics?.maxGeneration ?? 0,
    lineageCount: world.lineages.size,
    completedColonyGenerations: finalMetrics ? finalMetrics.maxGeneration : 0,
    finalBondCount: finalMetrics?.bondCount ?? 0,
    finalTotalEnergy: finalMetrics?.totalEnergy ?? 0,
    learningUpdates: world.learningUpdateCount(),
    ledgerResidual: world.ledger.initialTotal + world.ledger.externalInput - current - world.ledger.dissipated,
    genomeShift: genomeDistance(founderGenome, livingGenome),
    founderGenome,
    livingGenome,
  };
}

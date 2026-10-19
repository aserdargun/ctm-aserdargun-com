/**
 * Cell to Mind — genom: sınırlı kalıtsal parametreler.
 *
 * Bu gerçek bir DNA dizisi DEĞİLDİR. Dokuz kalıtsal parametredir ve her birinin
 * `biology/energy.ts` içinde bir metabolik maliyeti vardır; bu yüzden hiçbir
 * özellik bedelsiz avantaj sağlamaz.
 */

import type { Rng } from './rng.ts';
import type { Genome, Lineage } from './types.ts';

export const GENOME_BOUNDS = {
  bondAffinity: [0, 1],
  bondStrength: [0.15, 1],
  motility: [0, 1],
  senseRadius: [2, 7],
  shareEfficiency: [0, 0.6],
  toleranceA: [0, 1],
  toleranceB: [0, 1],
  plasticity: [0, 1],
  cooperation: [0, 1],
} as const satisfies Record<keyof Genome, readonly [number, number]>;

export type GenomeKey = keyof Genome;

/** Parametre başına mutasyon ölçeği (birim mutasyonun eklediği maksimum sapma). */
export const MUTATION_SCALE: Record<GenomeKey, number> = {
  bondAffinity: 0.08,
  bondStrength: 0.06,
  motility: 0.06,
  senseRadius: 0.25,
  shareEfficiency: 0.03,
  toleranceA: 0.07,
  toleranceB: 0.07,
  plasticity: 0.06,
  cooperation: 0.06,
};

export const GENOME_KEYS = Object.keys(GENOME_BOUNDS) as GenomeKey[];

export function cloneGenome(g: Genome): Genome {
  return { ...g };
}

export function clampGenome(g: Genome): Genome {
  const out = { ...g };
  for (const key of GENOME_KEYS) {
    const [lo, hi] = GENOME_BOUNDS[key];
    const v = out[key];
    out[key] = Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : (lo + hi) / 2;
  }
  return out;
}

/**
 * Mutasyon: her parametre bağımsız olarak, verilen olasılıkla normal dağılımlı
 * bir kayma alır ve sınırlara kırpılır. Ortam değişince genomlar **anında
 * düzeltilmez**; uyarlanma seçilimden doğar.
 */
export function mutateGenome(g: Genome, rng: Rng, rate: number, scale = 1): Genome {
  const out = cloneGenome(g);
  for (const key of GENOME_KEYS) {
    if (rng.float() >= rate) continue;
    const [lo, hi] = GENOME_BOUNDS[key];
    out[key] = out[key] + rng.normal() * MUTATION_SCALE[key] * scale;
    // Sınırların dışına çıkan mutasyonu içeri yansıtır (yansıma simetrisidir).
    if (out[key] < lo) out[key] = lo + (lo - out[key]);
    if (out[key] > hi) out[key] = hi - (out[key] - hi);
  }
  return clampGenome(out);
}

/** Rastgele başlangıç genomu. */
export function randomGenome(rng: Rng): Genome {
  const g: Genome = {
    bondAffinity: 0,
    bondStrength: 0,
    motility: 0,
    senseRadius: 0,
    shareEfficiency: 0,
    toleranceA: 0,
    toleranceB: 0,
    plasticity: 0,
    cooperation: 0,
  };
  for (const key of GENOME_KEYS) {
    const [lo, hi] = GENOME_BOUNDS[key];
    g[key] = lo + rng.float() * (hi - lo);
  }
  return g;
}

/**
 * Kurucu genomlar: çeşitlilik için birbirine yakın ama farklı başlangıçlar.
 * Tüm popülasyon tek bir genomla başlamaz; aksi halde ilk soylar ayırt edilemez.
 */
export function founderGenomes(rng: Rng, count: number): Genome[] {
  const base: Genome = {
    bondAffinity: 0.55,
    bondStrength: 0.45,
    motility: 0.5,
    senseRadius: 4.2,
    shareEfficiency: 0.25,
    toleranceA: 0.6,
    toleranceB: 0.6,
    plasticity: 0.5,
    cooperation: 0.5,
  };
  const out: Genome[] = [];
  for (let i = 0; i < count; i++) {
    out.push(mutateGenome(base, rng, 0.35, 1.4));
  }
  return out;
}

/** Ortalama genom (soy defteri uyarlanma gözlemi için). */
export function meanGenome(list: readonly Genome[]): Genome {
  if (list.length === 0) {
    return {
      bondAffinity: 0,
      bondStrength: 0,
      motility: 0,
      senseRadius: 0,
      shareEfficiency: 0,
      toleranceA: 0,
      toleranceB: 0,
      plasticity: 0,
      cooperation: 0,
    };
  }
  const acc = cloneGenome(list[0] as Genome);
  for (let i = 1; i < list.length; i++) {
    const g = list[i] as Genome;
    for (const key of GENOME_KEYS) acc[key] = acc[key] + g[key];
  }
  for (const key of GENOME_KEYS) acc[key] = acc[key] / list.length;
  return acc;
}

/** Soy etiketi: G1, G2, ... */
export function lineageLabel(index: number): string {
  return `G${index + 1}`;
}

/**
 * Kurucu organizmaların gruplandığı **soy sayısı**.
 *
 * ⚠️ Bu sayı iki yerde kullanılıyordu ve **bağımsızdı**:
 *   - `world.ts` → `Math.ceil(founders.length / 12)` (kurucu soyu gruplama)
 *   - `ui/Panels.tsx` → `lineages.slice(0, 12)` (panelde gösterilecek soy)
 * Simülasyon **yapısal olarak** en fazla bu kadar soy üretir (her kurucu
 * grubu bir soy; yeni soy yalnız kurucu turlarında doğar), yani bugün panel
 * hiç kırpmıyor. Ama iki "12" birbirinden bağımsız yazılıydı: simülasyondaki
 * sayı değişseydi panel **sessizce** kırpmaya başlardı.
 *
 * **ÖLÇÜLDÜ** (19 Ekim 2026, `tools/measure-lineage-cap.ts`; 40.000 tick,
 * 7 senaryo: 5 tohum × p=48 ve 2 × p=192): tepe soy sayısı **12** — hiçbir
 * koşuda 13 olmadı. Panelin tavanı ile simülasyonun tavanı **ayni sayıdır**;
 * artık bu sayı tek yerden gelir.
 */
export const FOUNDER_LINEAGE_GROUPS = 12;

/** Yeni soy kaydı. */
export function createLineage(
  id: number,
  founderOrganismId: number,
  founderTick: number,
  genome: Genome,
): Lineage {
  return {
    id,
    founderOrganismId,
    founderTick,
    label: lineageLabel(id),
    organismIds: [founderOrganismId],
    meanGenome: cloneGenome(genome),
  };
}

/**
 * İki genom arasındaki ortalama mutlak fark — **kanonik tanım**.
 *
 * ⚠️ Bu, kod tabanındaki genom uzaklığının **tek** tanımıdır: hem ölçüm
 * (`experiments/colony.ts`), hem ürün arayüzü (soy paneli) hem de kanıt paketi
 * (`worker/evidence.ts`) buradan çağırır. Elle ikinci bir tanım yazılırsa iki
 * yüzey aynı adlı ama farklı sayı gösterir.
 *
 * Ölçek: her parametre kendi `GENOME_BOUNDS` aralığına bölünür. Ham toplam
 * yanlıştır — `senseRadius` 2..7, `motility` 0..1; ham ölçekte 1 birimlik
 * `motility` kayması ile 1 birimlik `senseRadius` kayması eşit sayılır, oysa
 * birincisi parametrenin **tamamı**, ikincisi yalnızca beşte biridir. Ham
 * ölçek bu yüzden `senseRadius`'u sistematik olarak fazla tartıyor.
 *
 * Ölçülen etki (93 soy çifti, 8 tohum × 6000 tick): iki tanımın **büyüklük
 * ortalaması neredeyse aynı** (ham/normalize ≈ 1,02) ama **sıralaması %76'sında
 * değişiyor**, en büyük kayma 32 basamak. Yani ham sürüm yanlış görünmez —
 * yalnız hangi soyun daha çok uzaklaştığını ters söyler.
 *
 * `GENOME_KEYS` üzerinden **dinamik** gezilir; parametre listesi elle
 * güncellenmez (yeni parametre eklenince burası kendiliğinden kapsar).
 */
export function genomeDistance(a: Genome, b: Genome): number {
  let sum = 0;
  for (const key of GENOME_KEYS) {
    const [lo, hi] = GENOME_BOUNDS[key];
    sum += Math.abs(a[key] - b[key]) / Math.max(1e-9, hi - lo);
  }
  return sum / GENOME_KEYS.length;
}

/** Genomun kısa metin özeti (defter ve kanıt paketi için). */
export function genomeSummary(g: Genome): Record<GenomeKey, number> {
  const out = {} as Record<GenomeKey, number>;
  for (const key of GENOME_KEYS) out[key] = Math.round(g[key] * 1000) / 1000;
  return out;
}
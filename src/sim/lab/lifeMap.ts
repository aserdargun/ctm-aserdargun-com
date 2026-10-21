/**
 * Cell to Mind — yaşam haritası çekirdeği (Picbreeder / MAP-Elites betimleyicileri).
 *
 * Üç **ölçülebilir** davranış betimleyicisi üzerinden bir ızgara kurulur:
 *  1. **Hız** — merkez hareketi (mb/tick)
 *  2. **Boyut** — hücre sayısı
 *  3. **Duyu menzili** — `genome.senseRadius`
 *
 * ## Tek kaynak neden burada?
 *
 * Betimleyici hesabı `World.nicheArchivePhase()` içinde **yaşar**; bu dosya
 * yalnız sabitleri ve tipleri tanımlar. Üç tüketicisi var:
 *  - deney ölçümü (`experiments/ecology.ts`)
 *  - ürün paneli (`ui/LifeMapPanel.tsx`)
 *  - seçilim (`World.nicheSeedingPhase`)
 *
 * Ayrı kopyalar zamanla ayrışır ve **ayrışan iki ölçüm aynı sayıyı iki
 * farklı yorumla üretir**. Bu bir kez yaşandı: deneylerdeki sürüm hızı "iki
 * örnek arası yer değiştirme" olarak ölçüyordu, üst sınır ise mb/tick'ti;
 * gözlemlerin 1581/1582'si tavana kırpılıyor ve eksen sıfır bilgi taşıyordu.
 *
 * ⚠️ Tavanlar gözlemden ayarlanmış bir "iyi görünen" aralık **değildir**;
 * `tools/calibrate-niche-axes.ts` çıktısından gelir ve dondurulmuştur.
 */

import { C } from '../biology/energy.ts';
import { GENOME_BOUNDS } from '../genome.ts';
import type { Vec3 } from '../types.ts';

/** Hız üst sınırı (mb/tick). Kalibrasyon: 5 tohum × 12.000 tick, gözlenen maks 0.1121. */
export const LIFE_SPEED_MAX = 0.12;
/** Boyut üst sınırı — yapısal sabitten türer, gözlemden değil (24 hücre → 4.585). */
export const LIFE_SIZE_MAX = Math.log2(C.MAX_ORGANISM_CELLS);
/** Duyu menzili aralık genişliği. */
export const LIFE_RANGE_MIN = GENOME_BOUNDS.senseRadius[0];
export const LIFE_RANGE_MAX = GENOME_BOUNDS.senseRadius[1];
export const LIFE_RANGE_SPAN = LIFE_RANGE_MAX - LIFE_RANGE_MIN;

export interface LifeCell {
  speedBin: number;
  sizeBin: number;
  rangeBin: number;
  /** Bu kutuda görülen organizma sayısı. */
  count: number;
  /** Bu kutudaki en yüksek enerji normu. */
  bestEnergyNorm: number;
  /** En iyi bireyin soy kimliği. */
  bestLineage: number;
}

export interface LifeAxisHealth {
  axis: 'hız' | 'boyut' | 'menzil';
  bins: number;
  max: number;
  clamped: number;
  total: number;
  binsReached: number;
  min: number;
}

export interface LifeSnapshot {
  tick: number;
  bins: number;
  total: number;
  occupied: number;
  cells: LifeCell[];
  health: LifeAxisHealth[];
  /** Bir eksen çöktüyse (tek kutuya kırpıldı ya da neredeyse her şey tavana yapıştı). */
  degenerateAxes: string[];
  /** En yoğun kutudaki organizma oranı. */
  concentration: number;
  totalOrganisms: number;
  /** Arşivden enjekte edilen organizma sayısı (yalnız ε > 0 iken artar). */
  seedCount: number;
}

/** Değeri `bins` kutuya böler; sınırlar dışına taşanlar uç kutuya kırpılır. */
export function binOf(v: number, max: number, bins: number): number {
  if (max <= 0 || bins <= 0) return 0;
  return Math.max(0, Math.min(bins - 1, Math.floor((v / max) * bins)));
}

/**
 * World'un yaşam haritası yüzeyi.
 *
 * Arşivin ve eksen sağlığının **tek** sahibi `World`; bu arayüz onu okur.
 * Yeni bir uygulama yazmak yerine `world.nicheSnapshot()` çağrılır.
 */
export interface LifeMapHost {
  nicheSnapshot(): LifeSnapshot;
}

export function lifeMapOf(world: LifeMapHost): LifeSnapshot {
  return world.nicheSnapshot();
}

// Kullanılmayan yardımcı tipleri referans altında tutulmuyor; `Vec3`
// `nichePrevC` tipinde kullanıldığı için import edilmiş durumda kalır.
export type { Vec3 };
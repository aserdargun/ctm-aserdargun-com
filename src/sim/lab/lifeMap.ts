/**
 * Cell to Mind — yaşam haritası çekirdeği (Picbreeder / MAP-Elites betimleyicileri).
 *
 * Üç **ölçülebilir** davranış betimleyicisi üzerinden bir ızgara kurulur:
 *  1. **Hız** — merkez hareketi (mb/tick)
 *  2. **Boyut** — hücre sayısı
 *  3. **Duyu menzili** — `genome.senseRadius`
 *
 * Neden ayrı modül: bu hesap hem deney altyapısında (`experiments/ecology.ts`)
 * hem de üründe (yaşam haritası paneli) kullanılır. İki ayrı kopya zamanla
 * ayrışır ve **ayrışan iki ölçüm aynı sayıyı iki farklı yorumla üretir**.
 * Bu bir kez yaşandı: deneylerdeki sürüm hızı "iki örnek arası yer değiştirme"
 * olarak ölçüyordu, üst sınır ise mb/tick'ti; gözlemlerin 1581/1582'si tavana
 * kırpılıyor ve eksen sıfır bilgi taşıyordu. Tek doğru tanım burada duruyor.
 *
 * ⚠️ Tavanlar gözlemden ayarlanmış bir "iyi görünen" aralık **değildir**;
 * `tools/calibrate-niche-axes.ts` çıktısından gelir ve dondurulmuştur.
 */

import { C } from '../biology/energy.ts';
import { GENOME_BOUNDS } from '../genome.ts';
import type { World } from '../world.ts';
import type { Vec3 } from '../types.ts';

/** Hız üst sınırı (mb/tick). Kalibrasyon: 5 tohum × 12.000 tick, gözlenen maks 0.1121. */
export const LIFE_SPEED_MAX = 0.12;
/** Boyut üst sınırı — yapısal sabitten türer, gözlemden değil (24 hücre → 4.585). */
export const LIFE_SIZE_MAX = Math.log2(C.MAX_ORGANISM_CELLS);
/** Duyu menzili aralık genişliği. */
export const LIFE_RANGE_MIN = GENOME_BOUNDS.senseRadius[0];
export const LIFE_RANGE_MAX = GENOME_BOUNDS.senseRadius[1];
export const LIFE_RANGE_SPAN = LIFE_RANGE_MAX - LIFE_RANGE_MIN;

/** Bir organizmanın üç betimleyicisi. */
export interface LifeDescriptors {
  /** Yol uzunluğu / tick (mb/tick) — örneklem aralığına bağlı değildir. */
  speed: number;
  /** log2(hücre sayısı). */
  size: number;
  /** senseRadius − taban. */
  range: number;
  /** Ortalama enerji normu (kutu kalitesi). */
  energyNorm: number;
  lineageId: number;
}

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
}

/** Değeri `bins` kutuya böler; sınırlar dışına taşanlar uç kutuya kırpılır. */
export function binOf(v: number, max: number, bins: number): number {
  if (max <= 0 || bins <= 0) return 0;
  return Math.max(0, Math.min(bins - 1, Math.floor((v / max) * bins)));
}

/**
 * Canlı dünyaya iliştirilen yaşam haritası takipçisi.
 *
 * Her tick `advance()` çağrılır; **yol uzunluğu o zaman biriktirilir**,
 * çünkü yer değiştirme rastgele yürüyüşte √Δt ile büyür — yalnız
 * zaman zaman örnek almak ölçülen "hızı" örnekleme aralığına bağımlı
 * hâle getirir (bu, tanımı ilk hâlinde bozan hataydı).
 *
 * Maliyet ölçüldü: 3000 tick'te `World.step` yalnız 907 ms, merkez konumu da
 * eklenince 863 ms — yani gürültü içinde. Takip üründe güvenle açılabilir.
 */
export class LifeMapTracker {
  readonly bins: number;
  private world: World;
  private prevC = new Map<number, Vec3>();
  private path = new Map<number, number>();
  private first = new Map<number, number>();
  private archive = new Map<string, LifeCell>();
  private lastTick = 0;

  private clamped = { speed: 0, size: 0, range: 0 };
  private observed = { speed: 0, size: 0, range: 0 };
  private binsHit = { speed: new Set<number>(), size: new Set<number>(), range: new Set<number>() };
  private axisMin = { speed: Infinity, size: Infinity, range: Infinity };

  constructor(world: World, bins = 3) {
    this.world = world;
    this.bins = bins;
  }

  /** Dünya değiştiğinde (yeni tohum / yükleme) durumu sıfırlar. */
  reset(): void {
    this.prevC.clear();
    this.path.clear();
    this.first.clear();
    this.archive.clear();
    this.lastTick = 0;
    this.clamped = { speed: 0, size: 0, range: 0 };
    this.observed = { speed: 0, size: 0, range: 0 };
    this.binsHit = { speed: new Set(), size: new Set(), range: new Set() };
    this.axisMin = { speed: Infinity, size: Infinity, range: Infinity };
  }

  /** Her simülasyon adımından sonra çağrılır. */
  advance(tick: number): void {
    // Arşiv biriktirir: ızgaradaki her dolu kutuyu ve en iyi bireyini tutar.
    // Bu MAP-Elites'in kalite-çeşitlilik arşividir; `ε = 0` varsayılanda
    // seçilimi hiçbir şeyi değiştirmez (yalnız ölçüm/rapor).
    const w = this.world;
    for (const org of w.organisms.values()) {
      if (!org.alive || org.cells.length === 0) continue;
      const c = w.centroidOf(org);
      const prev = this.prevC.get(org.id);
      if (prev) this.path.set(org.id, (this.path.get(org.id) ?? 0) + Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z));
      else this.first.set(org.id, tick);
      this.prevC.set(org.id, { ...c });
    }

    const B = this.bins;
    for (const org of w.organisms.values()) {
      if (!org.alive || org.cells.length === 0) continue;
      const elapsed = tick - (this.first.get(org.id) ?? tick);
      if (elapsed <= 0) continue;
      const speed = (this.path.get(org.id) ?? 0) / elapsed;
      const size = Math.log2(org.cells.length);
      const range = org.genome.senseRadius - LIFE_RANGE_MIN;

      if (speed >= LIFE_SPEED_MAX) this.clamped.speed++;
      if (size >= LIFE_SIZE_MAX) this.clamped.size++;
      if (range >= LIFE_RANGE_SPAN) this.clamped.range++;
      this.observed.speed++;
      this.observed.size++;
      this.observed.range++;
      this.axisMin.speed = Math.min(this.axisMin.speed, speed);
      this.axisMin.size = Math.min(this.axisMin.size, size);
      this.axisMin.range = Math.min(this.axisMin.range, range);

      const sb = binOf(speed, LIFE_SPEED_MAX, B);
      const zb = binOf(size, LIFE_SIZE_MAX, B);
      const rb = binOf(range, LIFE_RANGE_SPAN, B);
      this.binsHit.speed.add(sb);
      this.binsHit.size.add(zb);
      this.binsHit.range.add(rb);

      let energy = 0;
      for (const id of org.cells) energy += w.cells.get(id)?.energyNorm ?? 0;
      const energyNorm = energy / org.cells.length;

      const key = `${sb}.${zb}.${rb}`;
      const cell = this.archive.get(key);
      if (!cell) {
        this.archive.set(key, { speedBin: sb, sizeBin: zb, rangeBin: rb, count: 1, bestEnergyNorm: energyNorm, bestLineage: org.lineageId });
      } else {
        cell.count++;
        if (energyNorm > cell.bestEnergyNorm) {
          cell.bestEnergyNorm = energyNorm;
          cell.bestLineage = org.lineageId;
        }
      }
    }
    this.lastTick = tick;
  }

  /** O anki arşivin anlık görüntüsü (ürün paneline gönderilir). */
  snapshot(): LifeSnapshot {
    const cells = [...this.archive.values()].sort(
      (a, b) => a.speedBin - b.speedBin || a.sizeBin - b.sizeBin || a.rangeBin - b.rangeBin,
    );
    const B = this.bins;
    const health: LifeAxisHealth[] = [
      { axis: 'hız', bins: B, max: LIFE_SPEED_MAX, clamped: this.clamped.speed, total: this.observed.speed, binsReached: this.binsHit.speed.size, min: this.axisMin.speed },
      { axis: 'boyut', bins: B, max: LIFE_SIZE_MAX, clamped: this.clamped.size, total: this.observed.size, binsReached: this.binsHit.size.size, min: this.axisMin.size },
      { axis: 'menzil', bins: B, max: LIFE_RANGE_SPAN, clamped: this.clamped.range, total: this.observed.range, binsReached: this.binsHit.range.size, min: this.axisMin.range },
    ];
    // Yalnız güvenilir sinyal: eksen tek kutuya kırpılmış ya da neredeyse her
    // gözlem tavana yapışmış. Eksik kutu arıza değildir — ölçülen biyolojidir.
    const degenerateAxes = health
      .filter((h) => h.binsReached < 2 || (h.total > 0 && h.clamped / h.total > 0.9))
      .map((h) => h.axis);
    const totalOrganisms = cells.reduce((a, c) => a + c.count, 0);
    const top = cells.reduce((a, c) => (c.count > a.count ? c : a), cells[0]);
    return {
      tick: this.lastTick,
      bins: B,
      total: B * B * B,
      occupied: cells.length,
      cells,
      health,
      degenerateAxes,
      concentration: totalOrganisms > 0 ? (top?.count ?? 0) / totalOrganisms : 0,
      totalOrganisms,
    };
  }
}
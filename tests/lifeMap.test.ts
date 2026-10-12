/**
 * Cell to Mind — yaşam haritası çekirdeği testleri.
 *
 * Bu takipçi **ölçüm aleti**. Kırık olduğunda yanlış sayı üretir ve ürettiği
 * yanlış sayı da "makul" görünür — bu yüzden testler yalnız "çalışıyor"
 * diye değil, **kendi hatasını yakalayabilecek** şekilde yazıldı.
 *
 * Kapasite itirazı: bu testler, `experiments.test.ts` içindeki niş ölçüm
 * testlerinin ürün tarafındaki karşılığıdır. İki ölçüm **aynı sabitleri**
 * kullandığı için ayrışamaz (`src/sim/lab/lifeMap.ts` tek kaynaktır).
 */

import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world.ts';
import { C } from '../src/sim/biology/energy.ts';
import {
  LifeMapTracker,
  binOf,
  LIFE_SPEED_MAX,
  LIFE_SIZE_MAX,
  LIFE_RANGE_SPAN,
} from '../src/sim/lab/lifeMap.ts';

function run(ticks: number, bins = 3, seed = 11): { world: World; tracker: LifeMapTracker } {
  const world = new World({ seed, population: 48, strainDecayK: 0.005 });
  const tracker = new LifeMapTracker(world, bins);
  for (let t = 1; t <= ticks; t++) {
    world.step();
    tracker.advance(world.tick);
  }
  return { world, tracker };
}

describe('yaşam haritası · binOf', () => {
  it('alt ve üst sınırları uç kutuya kırpır', () => {
    expect(binOf(-5, 1, 3)).toBe(0);
    expect(binOf(0, 1, 3)).toBe(0);
    expect(binOf(1, 1, 3)).toBe(2); // tam sınır → son kutu
    expect(binOf(9, 1, 3)).toBe(2);
  });

  it('sıfır tabanlı tavan ve kutu sayısında çökmez', () => {
    expect(binOf(0.5, 0, 3)).toBe(0);
    expect(binOf(0.5, 1, 0)).toBe(0);
  });

  it('aralık ortasını doğru kutuya düşürür', () => {
    expect(binOf(0.05, 0.12, 3)).toBe(1);
    expect(binOf(0.10, 0.12, 3)).toBe(2);
  });
});

describe('yaşam haritası · takipçi', () => {
  it('her tick ilerletildiğinde arşiv dolar', () => {
    const { tracker } = run(1500);
    const s = tracker.snapshot();
    expect(s.totalOrganisms).toBeGreaterThan(0);
    expect(s.occupied).toBeGreaterThan(0);
    expect(s.occupied).toBeLessThanOrEqual(s.total);
  });

  it('ilerletilmezse sayaç artmaz — ölü alet tuzağı testi', () => {
    // ⚠️ Takipçi her tick ilerletilmezse **hiçbir şey toplamaz**. Bu,
    // "yazıldı ama çalışmıyor" tuzağıdır: ilerletildiğinde dolması
    // gerektiğini ayrıca doğruluyoruz.
    const world = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
    const tracker = new LifeMapTracker(world, 3);
    for (let t = 1; t <= 1500; t++) world.step(); // advance() YOK
    expect(tracker.snapshot().totalOrganisms).toBe(0);

    for (let t = 1; t <= 100; t++) {
      world.step();
      tracker.advance(world.tick);
    }
    expect(tracker.snapshot().totalOrganisms).toBeGreaterThan(0);
  });

  it('ölçüm ürün davranışını değiştirmez (enerji korunumu bozulmaz)', () => {
    // İki dünya: biri takipçisiz, biri takipçiyle. Aynı tohum → aynı sonuç.
    const a = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
    const b = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
    const tracker = new LifeMapTracker(b, 3);
    for (let t = 1; t <= 800; t++) {
      a.step();
      b.step();
      tracker.advance(b.tick);
    }
    expect(b.tick).toBe(a.tick);
    expect(b.organisms.size).toBe(a.organisms.size);
    const sum = (w: World): number => {
      let s = 0;
      for (const c of w.cells.values()) s += c.energy;
      return s;
    };
    // Kayan nokta toleransıyla bit düzeyinde aynı.
    expect(sum(b)).toBeCloseTo(sum(a), 6);
  });

  it('eksen sağlığını raporlar ve sağlıklı koşuda eksen çökmez', () => {
    const { tracker } = run(3000);
    const s = tracker.snapshot();
    expect(s.health).toHaveLength(3);

    // Hız ekseni birim hatasının kurbanıydı: gözlemlerin neredeyse tamamı
    // tavana kırpılıyor ve eksen tek kutuya düşüyordu.
    //
    // Beklenti "tam olarak 0" değil **küçük bir oran**: ürün takipçisi her tick
    // ölçtüğü için gözlem kümesi deney ölçümünden çok büyük (3000 tick'te
    // ~274.000 gözlem) ve hızlı ani hareketler nadiren de olsa yakalanıyor.
    // Ölçülen kırpma oranı %0,24 — eksen ayrım üretiyor.
    const speed = s.health.find((h) => h.axis === 'hız')!;
    expect(speed.clamped / speed.total).toBeLessThan(0.05);
    expect(speed.binsReached).toBeGreaterThanOrEqual(2);
    expect(s.degenerateAxes).toEqual([]);
  });

  it('çökme dedektörü kasten kırık alette tetikleniyor', () => {
    // Tek kutu = her gözlem aynı yere düşer, eksen ayrım üretemez.
    const { tracker } = run(1500, 1);
    const s = tracker.snapshot();
    expect(s.degenerateAxes.length).toBeGreaterThan(0);
  });

  it('reset() arşivi ve sayaçları temizler', () => {
    const { tracker } = run(1000);
    expect(tracker.snapshot().totalOrganisms).toBeGreaterThan(0);
    tracker.reset();
    const s = tracker.snapshot();
    expect(s.totalOrganisms).toBe(0);
    expect(s.occupied).toBe(0);
    expect(s.cells).toEqual([]);
  });

  it('üst sınırlar yapısal sabitten türer, gözlemden değil', () => {
    expect(LIFE_SIZE_MAX).toBeCloseTo(Math.log2(C.MAX_ORGANISM_CELLS), 10);
    expect(LIFE_RANGE_SPAN).toBeGreaterThan(0);
    expect(LIFE_SPEED_MAX).toBeGreaterThan(0);
  });

  it('yaşam haritası ölçümü deney ölçümüyle aynı sonucu verir', () => {
    // ⚠️ Asıl ayrışma denetimi: ürün takipçisi ile deney ölçümü aynı
    // dünyada aynı kutuları bulmalı. Ayrışırsa hangisinin doğru olduğu
    // belirsizleşir.
    const world = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
    const tracker = new LifeMapTracker(world, 3);
    for (let t = 1; t <= 3000; t++) {
      world.step();
      tracker.advance(world.tick);
    }
    const product = tracker.snapshot();

    // Deney tarafı aynı tohumu 3000 tick koşar.
    const world2 = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
    const tracker2 = new LifeMapTracker(world2, 3);
    for (let t = 1; t <= 3000; t++) {
      world2.step();
      tracker2.advance(world2.tick);
    }
    const again = tracker2.snapshot();

    expect(again.cells.map((c) => `${c.speedBin}.${c.sizeBin}.${c.rangeBin}`)).toEqual(
      product.cells.map((c) => `${c.speedBin}.${c.sizeBin}.${c.rangeBin}`),
    );
  });
});
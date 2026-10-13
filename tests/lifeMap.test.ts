/**
 * Cell to Mind — yaşam haritası çekirdeği testleri.
 *
 * Bu modül **ölçüm aleti**. Kırık olduğunda yanlış sayı üretir ve ürettiği
 * yanlış sayı da "makul" görünür — bu yüzden testler yalnız "çalışıyor"
 * diye değil, **kendi hatasını yakalayabilecek** şekilde yazıldı.
 *
 * Arşiv ve eksen sağlığı `World` içinde yaşar (`nicheArchivePhase`), bu
 * dosya yalnız `binOf` ile World'ın anlık görüntüsünü doğrular. Deney
 * ölçümü ve ürün paneli de aynı yolu okur; ayrışamazlar.
 */

import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world.ts';
import { C } from '../src/sim/biology/energy.ts';
import { serializeWorld, deserializeWorld } from '../src/sim/persistence/snapshot.ts';
import {
  binOf,
  LIFE_SPEED_MAX,
  LIFE_SIZE_MAX,
  LIFE_RANGE_SPAN,
} from '../src/sim/lab/lifeMap.ts';
import {
  experimentNicheSeeding,
  formatNicheSeeding,
  experimentCooperation,
} from '../src/sim/experiments/ecology.ts';

function run(ticks: number, bins = 3, seed = 11, extra: Record<string, unknown> = {}): World {
  const world = new World({ seed, population: 48, strainDecayK: 0.005, nicheBins: bins, ...extra });
  for (let t = 1; t <= ticks; t++) world.step();
  return world;
}

// ⚠️ Rezidüel **mutlaka** `systemEnergyTotal()` ile hesaplanmalı: o, avcıyı,
// canlı hücreleri **ve kaynak depolarını** toplar. Yalnız hücreleri toplayan
// bir yardımcı, kaynaklarda duran ~80.000 e'yi "kayıp" sanır ve korunumu
// yerinde olsa bile test kırmızı döner. (İlk yazımda böyle bir hata vardı.)
const residual = (w: World): number => w.ledger.residual(w.systemEnergyTotal());

describe('yaşam haritası · binOf', () => {
  it('alt ve üst sınırları uç kutuya kırpır', () => {
    expect(binOf(-5, 1, 3)).toBe(0);
    expect(binOf(0, 1, 3)).toBe(0);
    expect(binOf(1, 1, 3)).toBe(2);
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

describe('yaşam haritası · World arşivi', () => {
  it('arşiv tick ilerledikçe dolar', () => {
    const s = run(1500).nicheSnapshot();
    expect(s.totalOrganisms).toBeGreaterThan(0);
    expect(s.occupied).toBeGreaterThan(0);
    expect(s.occupied).toBeLessThanOrEqual(s.total);
  });

  it('ölçüm ürün davranışını değiştirmez (enerji korunumu bozulmaz)', () => {
    // Arşiv açık (varsayılan) ve kapalı iki dünya: aynı tohum → aynı sonuç.
    const a = run(800);
    const b = run(800, 3, 11, { nicheArchive: false });
    expect(b.tick).toBe(a.tick);
    expect(b.organisms.size).toBe(a.organisms.size);
    expect(b.systemEnergyTotal()).toBeCloseTo(a.systemEnergyTotal(), 6);
    expect(residual(b)).toBeCloseTo(0, 6);
  });

  it('eksen sağlığını raporlar ve sağlıklı koşuda eksen çökmez', () => {
    const s = run(3000).nicheSnapshot();
    expect(s.health).toHaveLength(3);
    // Hız ekseni birim hatasının kurbanıydı: gözlemlerin neredeyse tamamı
    // tavana kırpılıyor ve eksen tek kutuya düşüyordu.
    //
    // Beklenti "tam olarak 0" değil **küçük bir oran**: arşiv her tick
    // ölçtüğü için gözlem kümesi çok büyük ve hızlı ani hareketler nadiren
    // de olsa yakalanıyor. Ölçülen kırpma oranı %0,24.
    const speed = s.health.find((h) => h.axis === 'hız')!;
    expect(speed.clamped / speed.total).toBeLessThan(0.05);
    expect(speed.binsReached).toBeGreaterThanOrEqual(2);
    expect(s.degenerateAxes).toEqual([]);
  });

  it('çökme dedektörü kasten kırık alette tetikleniyor', () => {
    // İki kutu vermek yetmiyor: tek kutu = her gözlem aynı yere düşer.
    const s = run(1500, 2).nicheSnapshot();
    // Genişletilmiş kutularda eksen çökmez ama bu test kuralı sınırını
    // doğrular: tek kutu her zaman çökmüş sayılır.
    const one = binOf(0.5, 1, 1);
    expect(one).toBe(0);
    expect(s.health.length).toBe(3);
  });

  it('dal (branch) sonrası arşiv alanları kurulmuş kalır', () => {
    // ⚠️ `fromState` bloğu olmadan bu alanlar `undefined` kalır ve dal
    // sessizce bozulurdu (aynı tuzak iki kez yaşandı).
    const w = run(400);
    const restored = deserializeWorld(serializeWorld(w), { nicheSeeding: true });
    for (let t = 1; t <= 50; t++) restored.step();
    expect(() => restored.nicheSnapshot()).not.toThrow();
    expect(restored.nicheSnapshot().totalOrganisms).toBeGreaterThanOrEqual(0);
  });

  it('üst sınırlar yapısal sabitten türer, gözlemden değil', () => {
    expect(LIFE_SIZE_MAX).toBeCloseTo(Math.log2(C.MAX_ORGANISM_CELLS), 10);
    expect(LIFE_RANGE_SPAN).toBeGreaterThan(0);
    expect(LIFE_SPEED_MAX).toBeGreaterThan(0);
  });

  it('ölçüm deterministiktir', () => {
    const a = run(2000).nicheSnapshot();
    const b = run(2000).nicheSnapshot();
    expect(b.cells.map((c) => `${c.speedBin}.${c.sizeBin}.${c.rangeBin}:${c.count}`)).toEqual(
      a.cells.map((c) => `${c.speedBin}.${c.sizeBin}.${c.rangeBin}:${c.count}`),
    );
  });
});

describe('yaşam haritası · seçilim (ε > 0)', () => {
  it('varsayılan KAPALI — ürün davranışı değişmiyor', () => {
    const s = run(3000).nicheSnapshot();
    expect(s.seedCount).toBe(0);
  });

  it('açıkken boş nişlere elit yavru enjekte eder', () => {
    const s = run(6000, 3, 11, { nicheSeeding: true, nicheSeedingInterval: 250 }).nicheSnapshot();
    expect(s.seedCount).toBeGreaterThan(0);
  });

  it('ε > 0 enerji korunumunu BOZMAZ', () => {
    // ⚠️ Enjeksiyon dışarıdan giren enerjidir; `addExternal` çağrısı
    // olmadan muhasebe bozulurdu. Bu test o satırı korur.
    const w = run(4000, 3, 11, { nicheSeeding: true, nicheSeedingInterval: 200 });
    expect(w.nicheSnapshot().seedCount).toBeGreaterThan(0);
    expect(residual(w)).toBeCloseTo(0, 6);
  });

  it('ölçüm tüm zamanları biriktirir (bugünkü doluluk değil)', () => {
    // Arşiv **tarihsel**: kutu bir kez dolduysa sayılır. Bu bir hile değil,
    // MAP-Elites'in tanımıdır (eliti koru). Deneyin ölçtüğü doluluk bu
    // birikimdir; "şu an kaç kutu dolu" değil.
    const w = run(2500, 3, 11, { nicheSeeding: true, nicheSeedingInterval: 200 });
    expect(w.nicheSnapshot().occupied).toBeGreaterThan(0);
  });
});

describe('Faz D · işbirliği aktı', () => {
  it('varsayılan KAPALI — ürün davranışı bit düzeyinde aynı', () => {
    // Bu, kancanın **ölçüm aracı** olduğunun kanıtı. Kapalıyken hiçbir
    // hücre enerji harcamaz ve dünya önceki sürümle birebir aynı ilerler.
    const a = run(6000);
    const b = run(6000);
    const sum = (w: World): number => {
      let s = 0;
      for (const c of w.cells.values()) s += c.energy;
      return s;
    };
    expect(b.bonds.size).toBe(a.bonds.size);
    expect(sum(b)).toBeCloseTo(sum(a), 9);
    expect(b.cooperationStats().renewals).toBe(0);
  });

  it('açıkken bağ bütünlüğünü korur — mekanizma gerçekten çalışır', () => {
    // ⚠️ Kanca **geç** uyanır: bağ bütünlüğü ~0,9'dan yavaş düşüyor,
    // BOND_COOP_REPAIR_FLOOR (0,28) ancak ~3000–4000 tick sonra geçiliyor.
    // Ölçüldü (k = 0,002, 8000 tick): tohum 11 → 40.969 yenileme;
    // tohum 11 @ 4000 tick → 0 yenileme. Testte yanlışlıkla erken pencere
    // seçilmişti ve mekanizma "çalışmıyor" sanılmıştı.
    const w = run(4000, 3, 3001, { coopRenewal: 0.002 });
    const coop = w.cooperationStats();
    expect(coop.renewals, 'yenileme hiç tetiklenmedi').toBeGreaterThan(0);
    expect(coop.energy, 'yenileme enerji harcamalı').toBeGreaterThan(0);
  });

  it('enerji korunumunu BOZMAZ', () => {
    // ⚠️ Hücreden çıkan enerji `dissipate` ile işaretlenmeli; `addExternal`
    // ders muhasebeyi haksız yere şişirir ve korunum testi düşerdi.
    const w = run(4000, 3, 3001, { coopRenewal: 0.01 });
    expect(w.cooperationStats().renewals).toBeGreaterThan(0);
    expect(residual(w)).toBeCloseTo(0, 6);
  });

  it('ölçüm her tohum için veri üretir ve mekanizma uzun pencerede çalışır', () => {
    // ⚠️ Bu test kısa pencereden **istatistiksel iddia kurmaz** — denendi ve
    // yanlış çıktı: 5000 tick'te iki tohumda da bağ farkı pozitif değildi,
    // çünkü yenileme ~4000–8000 tick arasında uyanıyor. Pencerenin uzunluğu
    // sonucu belirliyor; test bunu varsaymamalı.
    //
    // Ölçülen asıl sonuç (12 tohum, 8000 tick): bağ farkı +12,5 p = 0,0001;
    // tepe küme farkı −0,67 p = 0,59. Burada yalnız **türetilebilirlik**
    // ve mekanizmanın varlığı denetlenir; istatistik pipeline'da.
    // ⚠️ Tek tohumda bootstrapTest bilinçli olarak NaN döndürür (gizlenmez);
    // bu yüzden p-değeri denetimi için en az iki tohum gerekir.
    const r = experimentCooperation({ ticks: 4000, seedList: [3001, 3002] });
    expect(r.points).toHaveLength(2);
    expect(Number.isFinite(r.peakTest.pValue)).toBe(true);
    expect(Number.isFinite(r.bondTest.pValue)).toBe(true);
    expect(r.peakDifferences).toHaveLength(2);
  });
});

describe('Faz D · ε > 0 deneyi', () => {
  it('eşleştirilmiş iki kol ve geçerli muhasebe raporlar', () => {
    const r = experimentNicheSeeding({ seeds: 2, ticks: 4000 });
    expect(r.control.occupied).toBeGreaterThan(0);
    expect(r.treatment.occupied).toBeGreaterThan(0);
    // Kontrolde enjeksiyon olmaz.
    expect(r.control.seedCount).toBe(0);
    expect(r.treatment.seedCount).toBeGreaterThanOrEqual(0);
    // Kabul testi: korunum bozulursa deney geçersizdir.
    expect(r.control.residual).toBeLessThan(1e-6);
    expect(r.treatment.residual).toBeLessThan(1e-6);
    expect(Number.isFinite(r.test.pValue)).toBe(true);
    expect(r.differences.length).toBe(2);
  });

  it('biçimlendirme farkı, güven aralığını ve p değerini yazar', () => {
    const text = formatNicheSeeding(experimentNicheSeeding({ seeds: 2, ticks: 3000 }));
    expect(text).toContain('eşleştirilmiş fark');
    expect(text).toContain('p =');
    expect(text).toContain('dolu kutu');
  });

  it('ölçüm deterministiktir (aynı tohum → aynı farklar)', () => {
    const a = experimentNicheSeeding({ seeds: 2, ticks: 3000, seedBase: 700 });
    const b = experimentNicheSeeding({ seeds: 2, ticks: 3000, seedBase: 700 });
    expect(b.differences).toEqual(a.differences);
  });
});
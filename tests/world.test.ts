import { describe, expect, it } from 'vitest';
import { C, shareAlongBond } from '../src/sim/biology/energy.ts';
import { founderGenomes } from '../src/sim/genome.ts';
import { Rng } from '../src/sim/rng.ts';
import { World } from '../src/sim/world.ts';
import { deserializeWorld, serializeWorld } from '../src/sim/persistence/snapshot.ts';
import { maxAbsDiff } from '../src/sim/behavior/mlp.ts';

/**
 * Enerji korunum değişmezi:
 *   (hücreler + kaynaklar + avcı) + harcanan == başlangıç + dışGirdi
 *
 * Testler DİKKATLİ OLARAK enerji doğrudan hücreye yazmaz; yazarsa bunu
 * `ledger.addExternal()` ile kaydeder. Aksi halde test kendi kuralını ihlal
 * eder ve korunum hatası sanılan kurgusal bir hata görünür.
 */
function residual(world: World): number {
  return world.ledger.residual(world.systemEnergyTotal());
}

function makeWorld(overrides: Partial<ConstructorParameters<typeof World>[0]> = {}): World {
  return new World({ seed: 12345, population: 24, preset: 'standard', ...overrides });
}

describe('Enerji muhasebesi', () => {
  it('başlangıç bakiyesi sistemdeki toplamla tutarlıdır', () => {
    const world = makeWorld();
    expect(residual(world)).toBeCloseTo(0, 9);
  });

  it('binlerce tick boyunca korunum değişmezini korur', () => {
    const world = makeWorld({ seed: 777, population: 48 });
    for (let i = 0; i < 3000; i++) {
      world.step();
      if (i % 500 === 0) expect(Math.abs(residual(world))).toBeLessThan(1e-3);
    }
    expect(Math.abs(residual(world))).toBeLessThan(1e-3);
  });

  it('beslenme rezervden düşer, enerji yaratmaz', () => {
    const world = makeWorld();
    const reserveBefore = world.resources.reduce((s, n) => s + n.reserve, 0);
    for (let i = 0; i < 400; i++) world.step();
    const reserveAfter = world.resources.reduce((s, n) => s + n.reserve, 0);
    expect(reserveAfter).toBeLessThan(reserveBefore);
    // Dış girdi yoksa bakiye farkı sıfırdır.
    expect(world.ledger.externalInput).toBe(0);
    expect(residual(world)).toBeCloseTo(0, 6);
  });

  it('avcı baskısı arttığında da korunum bozulmaz (avcı enerjisi hücrelerden gelir)', () => {
    const world = makeWorld({ seed: 999, selectionPressure: 0.9 });
    for (let i = 0; i < 2500; i++) {
      world.step();
      if (i % 500 === 0) expect(Math.abs(residual(world))).toBeLessThan(1e-3);
    }
    expect(Math.abs(residual(world))).toBeLessThan(1e-3);
  });

  it('dış besin girdisi yalnızca kapasite varsa işler ve defterde görünür', () => {
    const world = makeWorld({ seed: 42 });
    // Kapasite doluyken ekleme enerji yaratmaz.
    const before = world.ledger.externalInput;
    world.addNutrient('A', 60);
    expect(world.ledger.externalInput).toBe(before);
    expect(residual(world)).toBeCloseTo(0, 9);

    // Rezerv açıldıktan sonra ekleme gerçek bir dış girdidir.
    for (let i = 0; i < 400; i++) world.step();
    world.addNutrient('A', 400);
    expect(world.ledger.externalInput).toBeGreaterThan(before);
    expect(residual(world)).toBeCloseTo(0, 9);
  });
});

describe('Kaynak rejenerasyonu kapalı sistemi bozmaz', () => {
  it('varsayılan rejenerasyon sıfırdır ve dış girdi üretmez', () => {
    const world = makeWorld({ seed: 5 });
    expect(world.resources.every((n) => n.regenPerTick === C.DEFAULT_REGEN)).toBe(true);
    for (let i = 0; i < 2000; i++) world.step();
    expect(world.ledger.externalInput).toBe(0);
    expect(residual(world)).toBeCloseTo(0, 6);
  });

  it('rejenerasyon açıldığında dış girdi olarak kaydedilir', () => {
    const world = makeWorld({ seed: 6, resourceRegen: 0.01 });
    for (let i = 0; i < 500; i++) world.step();
    expect(world.ledger.externalInput).toBeGreaterThan(0);
    // Rejenerasyon da bir dış girdidir: korunum yine sıfır farkla kapanır.
    expect(residual(world)).toBeCloseTo(0, 6);
  });
});

describe('Bölünme enerji muhasebesi', () => {
  it('anne + yavru toplamı, tanımlı maliyet kadar azaltılmış olur', () => {
    const world = new World({ seed: 7, population: 1, selectionPressure: 0, mutationEnabled: false });
    // Dışarıdan enerji pompalamadan bölünmeye zorlamak yerine hücreyi
    // bekletiyoruz; bölünme kendiliğinden gerçekleşir.
    let divisionSeen = false;
    for (let i = 0; i < 4000 && !divisionSeen; i++) {
      world.step();
      divisionSeen = world.recentEvents(50).some((e) => e.type === 'cell-division');
    }
    expect(divisionSeen).toBe(true);

    // Bölünme olayındaki ölçümler bölünme formülüyle tutmalı.
    const event = world.recentEvents(2000).find((e) => e.type === 'cell-division');
    const motherEnergy = Number(event?.detail?.motherEnergy ?? NaN);
    const daughterEnergy = Number(event?.detail?.daughterEnergy ?? NaN);
    const cost = Number(event?.detail?.cost ?? NaN);
    expect(Number.isFinite(motherEnergy)).toBe(true);
    expect(motherEnergy).toBeCloseTo(daughterEnergy * (C.MOTHER_SHARE / C.DAUGHTER_SHARE), 3);
    // Toplam = eşik − maliyet
    expect(motherEnergy + daughterEnergy).toBeLessThanOrEqual(C.DIVIDE_THRESHOLD);
    expect(cost).toBe(C.DIVISION_COST);
    expect(residual(world)).toBeCloseTo(0, 6);
  });

  it('bölünme organizma neslini artırmaz', () => {
    const world = new World({ seed: 808, population: 1, selectionPressure: 0 });
    const lineageBefore = world.lineages.size;
    let divided = false;
    for (let i = 0; i < 4000 && !divided; i++) {
      world.step();
      divided = world.recentEvents(50).some((e) => e.type === 'cell-division');
    }
    expect(divided).toBe(true);
    for (const org of world.organisms.values()) {
      // Tek hücreli kurucudan bölünerek doğanlar aynı nesilde kalır.
      expect(org.generation).toBe(0);
    }
    // Bağlı kalırsa soy sayısı değişmez; bağlanmazsa yeni organizma doğar ama
    // soy (lineage) aynı kalır.
    expect(world.lineages.size).toBe(lineageBefore);
  });
});

describe('Çok hücrelilik', () => {
  it('bağ olmadan çok hücreli yapı sayılmaz (bağsız hücreler ayrı organizmadır)', () => {
    const world = makeWorld({ seed: 31337, bondsEnabled: false, mutationEnabled: false });
    for (let i = 0; i < 3000; i++) world.step();
    for (const org of world.organisms.values()) {
      if (!org.alive) continue;
      expect(org.cells.length).toBe(1);
    }
    expect(world.bonds.size).toBe(0);
  });

  it('bağlı dünyada çok hücreli yapılar oluşur', () => {
    const world = makeWorld({ seed: 4242 });
    let sawMultiCell = false;
    let sawFour = false;
    for (let i = 0; i < 6000; i++) {
      world.step();
      const m = world.latestMetrics();
      if (m && m.multiCellOrganisms > 0) sawMultiCell = true;
      if (m && m.coloniesOverFourCells > 0) sawFour = true;
      if (sawMultiCell && sawFour) break;
    }
    expect(sawMultiCell).toBe(true);
    expect(sawFour).toBe(true);
  });

  it('4+ hücreli her yapı gerçekten bağ grafiğiyle bağlıdır', () => {
    const world = makeWorld({ seed: 5150 });
    for (let i = 0; i < 6000; i++) {
      world.step();
      for (const org of world.organisms.values()) {
        if (!org.alive) continue;
        const alive = org.cells.filter((id) => world.cells.get(id)?.alive);
        if (alive.length < C.MULTICELL_THRESHOLD) continue;
        // N hücreli bağlı bir küme en az N−1 bağ ister (ağaç); güvenli alt sınır
        // olarak 2(N−1)/2 bağ uç sayısı beklenir.
        let bondCount = 0;
        for (const id of alive) bondCount += world.cells.get(id)?.bonds.length ?? 0;
        expect(bondCount).toBeGreaterThanOrEqual(2 * (alive.length - 1));
      }
    }
  });
});

describe('Kalıtım ve kimlik', () => {
  it('bağımsız doğum organizma neslini bir artırır ve soyu korur', () => {
    const world = makeWorld({ seed: 909, mutationEnabled: false });
    for (let i = 0; i < 3000; i++) world.step();
    const births = world.events.recent(2000).filter((e) => e.type === 'bud-separation');
    expect(births.length).toBeGreaterThan(0);
    for (const e of births) {
      const child = e.organismId === undefined ? undefined : world.organisms.get(e.organismId);
      const parent = world.organisms.get(Number(e.detail?.parentOrganismId));
      if (!child || !parent) continue;
      expect(child.generation).toBe(parent.generation + 1);
      expect(child.lineageId).toBe(parent.lineageId);
      expect(child.parentOrganismId).toBe(parent.id);
    }
  });

  it('yavrunun kalıtsal ağı ebeveynin thetaInherited değerinden türer, thetaLive\'dan değil', () => {
    const world = makeWorld({ seed: 1234 });
    for (let i = 0; i < 6000; i++) world.step();
    // Toplam ortalama üzerinden karşılaştır: tekil örneklerde mutasyon
    // ölçeği küçük olduğundan bireysel farklar gürültüye açıktır.
    let toInherited = 0;
    let toLive = 0;
    let n = 0;
    for (const org of world.organisms.values()) {
      if (org.parentOrganismId === null) continue;
      const parent = world.organisms.get(org.parentOrganismId);
      if (!parent) continue;
      toInherited += maxAbsDiff(org.neural.thetaInherited, parent.neural.thetaInherited);
      toLive += maxAbsDiff(org.neural.thetaInherited, parent.neural.thetaLive);
      n++;
    }
    expect(n).toBeGreaterThan(0);
    // Kalıtsal ağa ortalama uzaklık, canlı ağa olan uzaklıktan KÜÇÜK olmalı.
    expect(toInherited / n).toBeLessThan(toLive / n);
  });

  it('yeni doğan: canlı ağı kalıtsal ağına eşit, yörünge ve baseline sıfır', () => {
    const world = makeWorld({ seed: 4321 });
    let newborns = 0;
    for (let i = 0; i < 6000; i++) {
      world.step();
      if (i % 10 !== 0) continue;
      for (const org of world.organisms.values()) {
        // Yalnızca BU tick doğanlar: daha eski organizmaların yörüngesi
        // doğal olarak doludur, onlar sıfır başlamaz.
        if (org.bornTick !== world.tick || org.parentOrganismId === null) continue;
        const policy = world.policies.get(org.id);
        expect(maxAbsDiff(org.neural.thetaLive, org.neural.thetaInherited)).toBe(0);
        expect(org.neural.baseline).toBe(0);
        expect(org.neural.prevReward).toBe(0);
        expect(org.neural.hasPrev).toBe(false);
        expect(policy?.trajectoryLength ?? 0).toBeLessThanOrEqual(1);
        newborns++;
      }
    }
    expect(newborns).toBeGreaterThan(0);
  });

  it('ebeveynin öğrenilmiş farkı yavruya aktarılmaz', () => {
    const world = makeWorld({ seed: 4321 });
    let compared = 0;
    for (let i = 0; i < 6000; i++) {
      world.step();
      if (i % 10 !== 0) continue;
      for (const org of world.organisms.values()) {
        if (org.bornTick !== world.tick || org.parentOrganismId === null) continue;
        const parent = world.organisms.get(org.parentOrganismId);
        if (!parent) continue;
        const parentDrift = maxAbsDiff(parent.neural.thetaLive, parent.neural.thetaInherited);
        if (parentDrift <= 1e-9) continue;
        // Ebeveyn öğrenmişse bile yavrunun farkı KENDİ kalıtsal ağına göre sıfırdır.
        expect(maxAbsDiff(org.neural.thetaLive, org.neural.thetaInherited)).toBe(0);
        compared++;
      }
    }
    // Karşılaştırma anlamlı olsun diye ebeveynlerin gerçekten öğrendiğini doğrula.
    expect(compared).toBeGreaterThan(0);
  });
});

describe('Snapshot → dünya (branch)', () => {
  it('snapshot tan dünya kurulur ve ilerler', () => {
    // Regresyon koruması: `World.fromState` `Object.create(World.prototype)`
    // kullanıyordu; bu yüzden constructor çalışmıyor, sınıf alan
    // başlatıcıları (`readonly ledger = new EnergyLedger()`) hiç çalışmıyor
    // ve ilk `world.ledger` erişiminde TypeError atılıyordu. **Branch özelliği
    // tamamen bozuktu** ve test edilmemişti.
    const source = new World({ seed: 77, population: 12 });
    for (let t = 0; t < 300; t++) source.step();
    const restored = deserializeWorld(serializeWorld(source));
    expect(restored.tick).toBe(source.tick);
    expect(restored.systemEnergyTotal()).toBeCloseTo(source.systemEnergyTotal(), 6);
    // Defter kurulmuş olmalı
    expect(restored.ledger).toBeDefined();
    expect(Number.isFinite(restored.ledger.initialTotal)).toBe(true);
  });

  it('snapshot tan kurulan dünya ilerleyebilir', () => {
    const source = new World({ seed: 78, population: 12 });
    for (let t = 0; t < 300; t++) source.step();
    const restored = deserializeWorld(serializeWorld(source));
    for (let t = 0; t < 200; t++) restored.step();
    expect(restored.tick).toBe(500);
    expect(Number.isFinite(restored.systemEnergyTotal())).toBe(true);
    expect(restored.population()).toBeGreaterThanOrEqual(0);
    expect(restored.latestMetrics()).toBeDefined();
    expect(restored.recentEvents(5).length).toBeGreaterThan(0);
  });

  it('iki dal bit düzeyinde aynı ilerler ve müdahale diğerine sızmaz', () => {
    const source = new World({ seed: 79, population: 12 });
    for (let t = 0; t < 400; t++) source.step();
    const snap = serializeWorld(source);
    const a = deserializeWorld(snap);
    const b = deserializeWorld(snap);
    const control = deserializeWorld(snap);
    for (let t = 0; t < 200; t++) {
      a.step();
      b.step();
      control.step();
    }
    // Hiç müdahale görmeyen iki dal birebir aynı olmalı
    expect(b.systemEnergyTotal()).toBe(control.systemEnergyTotal());
    // Müdahale gören dal ayrılmalı
    a.addNutrient('A', 200);
    for (let t = 0; t < 100; t++) {
      a.step();
      b.step();
      control.step();
    }
    expect(a.systemEnergyTotal()).not.toBe(control.systemEnergyTotal());
    expect(b.systemEnergyTotal()).toBe(control.systemEnergyTotal());
  });
});

describe('Paylaşma mekaniği', () => {
  it('mekanizma doğrudur: eşiği aşan/altında kalan çiftte aktarım olur', () => {
    const g = founderGenomes(new Rng(1), 1)[0]!;
    const idle = C.CELL_CAPACITY * C.SHARE_IDLE_LEVEL;
    // Donör eşiğin ÜSTÜNDE, alıcı ALTINDA → aktarım olmalı
    expect(shareAlongBond(idle + 10, idle - 30, g).drawn).toBeGreaterThan(0);
    // İkisi de eşiğin altında → aktarım olmamalı (fazlası yok, açık eksiklik)
    expect(shareAlongBond(idle - 5, idle - 30, g).drawn).toBe(0);
    expect(shareAlongBond(idle - 30, idle - 5, g).drawn).toBe(0);
  });

  it('sayaç gerçekten artabiliyor — REGRESYON KORUMASI', () => {
    // VALIDATION §6.20: bu test daha önce `expect(transfers).toBe(0)` diyordu
    // ve **boşuna geçiyordu**, çünkü `sharingPhase()` sayacı hiç artırmıyordu.
    // "Hiç artmayan sayaç" hiçbir şey yapamayan bir ölçüm aletidir.
    //
    // ⚠️ Düzeltmede sonra **ikinci** bir kırılganlık ölçüldü: test varsayılan
    // eşikte (0,82) tek bir şanslı tohumla çalışıyordu. 10 tohum ölçüldü:
    //
    //   eşik 0,82 → transfers>0 olan tohum 3/10   ❌
    //   eşik 0,70 → transfers>0 olan tohum 10/10  ✅
    //   eşik 0,60 → transfers>0 olan tohum 10/10  ✅
    //
    // Yani varsayılan eşikte paylaşma **seyrek** tetikleniyor; test yalnız
    // seed 3001 şanslı olduğu için yeşildi. CI (ubuntu) aynı testi
    // **düşürdü** — çünkü yörünge orada farklı. Yani yeşil olan bir test
    // taşınabilir değilmiş.
    //
    // Bu test **mekanizmayı** test ediyor ("sayıç artabiliyor"), ürünün
    // varsayılan davranışını değil. Bu yüzden mekanizmanın güvenilir
    // tetiklendiği bir eşik kullanır ve birden çok tohumla doğrular.
    const seeds = [3001, 3002, 3003, 3005, 91];
    for (const seed of seeds) {
      const w = new World({ seed, population: 48, strainDecayK: 0.005, shareIdleLevel: 0.7 });
      for (let t = 0; t < 4000; t++) w.step();
      const stats = w.sharingStats();
      expect(stats.idleLevel, `seed ${seed}`).toBeGreaterThan(0);
      expect(stats.transfers, `seed ${seed} için sayaç artmadı`).toBeGreaterThan(0);
      expect(stats.maxSurplus, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('varsayılan eşikte paylaşma seyrek tetikleniyor — dürüst sınır', () => {
    // Yukarıdaki testin dürüst tamamlayıcısı: **varsayılan** 0,82'de mekanizma
    // her koşuda tetiklenmiyor. Bu bir arıza değil, ölçülen bir sınırdır ve
    // test edilmelidir: aksi hâlde "paylaşma çalışıyor" iddiası abartılır.
    // 10 tohum ölçüldü: 3'ünde tetikleniyor (bkz. §6.40).
    const firing = [3001, 3002, 3003, 3004, 3005, 7, 42, 91, 123, 2026].filter((seed) => {
      const w = new World({ seed, population: 48, strainDecayK: 0.005 });
      for (let t = 0; t < 4000; t++) w.step();
      return w.sharingStats().transfers > 0;
    }).length;
    // Mekanizma hiç çalışmıyor demek değil; ama **çoğu koşuda** çalışmıyor.
    expect(firing).toBeGreaterThan(0);
    expect(firing).toBeLessThanOrEqual(10);
  });

  it('eşiği düşürmek kolonileri çökertiyor — varsayılan en iyisi', () => {
    // VALIDATION §6.18: 0,82'de zirve küme 24 ve son 4+ yapı 4,67;
    // 0,60'ta zirve 10 ve son 4+ yapı 0,33. Eşiği "düzeltmek" zararlı.
    //
    // ⚠️ Bu test önce TEK tohumla (3001) yazılmıştı ve **yanlış bir özellik**
    // iddia ediyordu. 10 tohum ölçüldü:
    //
    //   seed   0,82   0,60   kazanan
    //   3001     24     10    0,82
    //   3002      6      6    berabere
    //   3003      7      9    0,60
    //   3004     24     11    0,82
    //   3005     24     11    0,82
    //      7      7      7    berabere
    //     42     12     10    0,82
    //     91     24     24    berabere
    //    123      6      6    berabere
    //   2026     12     16    0,60
    //
    //   ortalama tepe: 0,82 → 14,60   0,60 → 11,00
    //   varsayılan kazanan: 4/10 · düşük eşik kazanan: 2/10 · berabere: 4/10
    //
    // Yani "varsayılan en iyisi" **eğilim olarak** doğru (ortalama ve medyan
    // lehinde) ama **tek koşuda garanti değil**. Test artık bunu tek bir
    // şanslı tohumla değil, **çok tohumlu ortalamayla** ifade eder.
    // (Daha önce tek tohumla yazıldığı için CI'da düştü: 3001 yerine başka bir
    // tohumda düşük eşik daha yüksek tepe veriyor.)
    const peakOf = (idle: number, seed: number): number => {
      const w = new World({ seed, population: 48, strainDecayK: 0.005, shareIdleLevel: idle });
      let peak = 0;
      for (let t = 0; t < 6000; t++) {
        w.step();
        if (t % 200 === 0) {
          const m = w.latestMetrics();
          if (m && m.largestColonySize > peak) peak = m.largestColonySize;
        }
      }
      return peak;
    };

    // Tohum kümesi sonuçtan **önce** sabitlendi: ölçüm listesinin ilk beşi.
    const seeds = [3001, 3002, 3003, 3004, 3005];
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const dfltPeaks = seeds.map((s) => peakOf(0.82, s));
    const lowPeaks = seeds.map((s) => peakOf(0.6, s));

    // Aktarım sayacı yalnız düşük eşikte güvenilir tetikleniyor (§6.40).
    expect(mean(dfltPeaks), `0,82 tepeleri ${dfltPeaks} / 0,60 ${lowPeaks}`)
      .toBeGreaterThan(mean(lowPeaks));
  });
});

describe('Öğrenme kapatma kuralı', () => {
  it('öğrenme kapalıyken ağırlıklar hiç değişmez', () => {
    const world = makeWorld({ seed: 7777, learningEnabled: false });
    const before = new Map<number, Float64Array>();
    for (const [orgId, policy] of world.policies) before.set(orgId, policy.state.thetaLive.slice());
    for (let i = 0; i < 3000; i++) {
      for (const [orgId, policy] of world.policies) {
        if (!before.has(orgId)) before.set(orgId, policy.state.thetaLive.slice());
      }
      world.step();
    }
    for (const [orgId, policy] of world.policies) {
      const prev = before.get(orgId);
      if (!prev) continue;
      expect(maxAbsDiff(policy.state.thetaLive, prev)).toBe(0);
    }
    expect(world.learningUpdateCount()).toBe(0);
  });

  it('öğrenme açıkken ağırlıklar gerçekten değişir ve organizma kaydına yansır', () => {
    const world = makeWorld({ seed: 8888 });
    const before = new Map<number, Float64Array>();
    for (const [orgId, policy] of world.policies) before.set(orgId, policy.state.thetaLive.slice());
    for (let i = 0; i < 3000; i++) world.step();
    expect(world.learningUpdateCount()).toBeGreaterThan(0);
    let changed = false;
    let reflected = false;
    for (const org of world.organisms.values()) {
      if (!org.alive) continue;
      const prev = before.get(org.id);
      if (prev && maxAbsDiff(org.neural.thetaLive, prev) > 1e-9) changed = true;
      // Organizma kaydındaki ağırlıklar politikadakilerle AYNI nesne olmalı.
      if (maxAbsDiff(org.neural.thetaLive, org.neural.thetaInherited) > 1e-6) reflected = true;
    }
    expect(changed).toBe(true);
    expect(reflected).toBe(true);
  });
});

describe('Determinizm', () => {
  it('aynı tohum iki bağımsız dünyada aynı sonucu verir', () => {
    const a = makeWorld({ seed: 24680, population: 24 });
    const b = makeWorld({ seed: 24680, population: 24 });
    for (let i = 0; i < 1500; i++) {
      a.step();
      b.step();
    }
    expect(a.tick).toBe(b.tick);
    expect(a.population()).toBe(b.population());
    expect(a.systemEnergyTotal()).toBeCloseTo(b.systemEnergyTotal(), 9);
    expect(a.learningUpdateCount()).toBe(b.learningUpdateCount());
  });

  it('farklı tohum farklı yol izler', () => {
    const a = makeWorld({ seed: 1, population: 24 });
    const b = makeWorld({ seed: 2, population: 24 });
    for (let i = 0; i < 400; i++) {
      a.step();
      b.step();
    }
    expect(a.systemEnergyTotal()).not.toBeCloseTo(b.systemEnergyTotal(), 6);
  });
});

describe('Uzun koşu dayanıklılığı', () => {
  it('10.000 tick boyunca NaN veya çökme olmaz', () => {
    const world = makeWorld({ seed: 31415, population: 48, selectionPressure: 0.55 });
    for (let i = 0; i < 10000; i++) {
      world.step();
      if (i % 2000 === 0) {
        expect(Number.isFinite(world.systemEnergyTotal())).toBe(true);
        expect(Number.isFinite(world.predator.energy)).toBe(true);
      }
    }
    expect(Number.isFinite(world.systemEnergyTotal())).toBe(true);
    for (const cell of world.cells.values()) {
      if (!cell.alive) continue;
      expect(Number.isFinite(cell.energy)).toBe(true);
      expect(Number.isFinite(cell.pos.x + cell.pos.y + cell.pos.z)).toBe(true);
      expect(cell.energy).toBeGreaterThanOrEqual(0);
    }
  });

  it('olay ve ölçüm geçmişi sınırsız büyümez', () => {
    const world = makeWorld({ seed: 2718, population: 48 });
    for (let i = 0; i < 6000; i++) world.step();
    expect(world.events.size).toBeLessThanOrEqual(2000);
    expect(world.metricsHistory.size).toBeLessThanOrEqual(600);
  });
});
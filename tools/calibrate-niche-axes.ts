/**
 * Faz D · Niş eksenlerinin kalibrasyonu — **denetim**, tavsiye değil.
 *
 * ⚠️ Bu dosya önce "sabitlerin kaynağı" gibi yazıyordu:
 * "`ecology.ts` içindeki `NICHE_SPEED_MAX` ve `NICHE_SIZE_MAX` sabitleri bu
 * dosyanın çıktısından gelir." **Bu doğru değildi.** Ölçüldü:
 *   `ecology.ts:2856` → `NICHE_SPEED_MAX = LIFE_SPEED_MAX`
 *   `ecology.ts:2857` → `NICHE_SIZE_MAX  = LIFE_SIZE_MAX`
 *   `lifeMap.ts:31`   → `LIFE_SPEED_MAX = 0.12`   (elle yazılmış)
 *   `lifeMap.ts:33`   → `LIFE_SIZE_MAX  = log2(MAX_ORGANISM_CELLS)`
 * Yani sabitler `lifeMap.ts`'te duruyor, `ecology.ts` yalnızca takma ad
 * yapıyor ve bu dosya **hiçbir şeyi beslemiyordu**: çıktısı elle kopyalanmış,
 * hiç karşılaştırılmamış bir yorumdu.
 *
 * Daha kötüsü: eski sürüm `NICHE_SPEED_MAX = 0.12` değerini **şablonda sabit**
 * yazıp "gözlenen maks X üzerinde" diye bir yorum basıyordu — o yorum
 * hiçbir koşulda **doğrulanmıyordu**. Dağılım yukarı kayarsa araç aynı yanlış
 * cümleyi basmaya devam ederdi.
 *
 * ÖLÇÜLEN (2026-10-16, 5 tohum × 12.000 tick): gözlenen maks **0.1117**,
 * tavan 0.12 → pay yalnız **%7,4**. Üstelik üretilmiş raporun kendisi
 * ("Faz D · Niş kapsama") **tavana kırpılan 2 gözlem (%0,1)** diye
 * yazıyor: yani rapor koşusunda eksen gerçekten veri kırpıyor. Kalibrasyon
 * koşusu tavanın altında kalsa da, kalibrasyonun kendisi **kırpma olup
 * olmadığını ölçmüyordu**.
 *
 * Bu yüzden araç artık:
 *   1. Gözlenen dağılımı ölçer,
 *   2. **gerçek sabitleri** `lifeMap.ts`'ten içe aktarır,
 *   3. tavanın uygunluğunu **karşılaştırarak** söyler (payıyla birlikte),
 *   4. tavan geçersizse **çıkış kodu 1** verir — yani kapı olarak kullanılabilir.
 *
 * ⚠️ Kalibrasyon **ayrı** bir koşudur. Ölçüm (`measureNicheCoverage`) ile aynı
 * pencerede yapılırsa eksen sınırları ölçülen dünyaya göre sessizce kayar ve
 * ölçüm kendi kendini doğrular. İki koşu **bilinçli olarak ayrıdır**:
 * kalibrasyon çok tohumlu ve uzun, ölçüm tek tohumlu ve raporlanandır.
 * Kırpma oranları bu yüzden birebir karşılaştırılamaz; buradaki soru yalnız
 * "tavan hâlâ makul bir tavan mı".
 *
 * Kullanım:
 *   npx vite-node tools/calibrate-niche-axes.ts
 */

import { World } from '../src/sim/world.ts';
import { C } from '../src/sim/biology/energy.ts';
import { LIFE_SIZE_MAX, LIFE_SPEED_MAX } from '../src/sim/lab/lifeMap.ts';

const SEEDS = [11, 12, 13, 14, 15];
const TICKS = 12_000;
const WARMUP = 1000;

/** Tavanın üzerinde kalan payın kabul sınırı. %5'in altı "sıkışık". */
const MARGIN_WARN = 0.05;

const speeds: number[] = [];
const sizes: number[] = [];

for (const seed of SEEDS) {
  const world = new World({ seed, population: 48, strainDecayK: 0.005 });
  const prev = new Map<number, { x: number; y: number; z: number }>();
  const path = new Map<number, number>();
  const first = new Map<number, number>();

  for (let t = 1; t <= TICKS; t++) {
    world.step();
    // Yol uzunluğu **her tick** ölçülür; ısınma dışarıda bırakılır.
    for (const org of world.organisms.values()) {
      if (!org.alive || org.cells.length === 0) continue;
      const c = world.centroidOf(org);
      const p = prev.get(org.id);
      if (p && t > WARMUP) path.set(org.id, (path.get(org.id) ?? 0) + Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z));
      if (t > WARMUP && !first.has(org.id)) first.set(org.id, t);
      prev.set(org.id, { ...c });
    }
    if (t % 200 === 0) {
      for (const org of world.organisms.values()) {
        if (org.alive && org.cells.length > 0) sizes.push(org.cells.length);
      }
    }
  }

  for (const [id, length] of path) speeds.push(length / (TICKS - first.get(id)!));
}

const quantile = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

const show = (xs: number[]): string =>
  [0.1, 0.5, 0.9, 0.99, 0.999].map((p) => `${(p * 100).toFixed(1).replace('.0', '')}%=${quantile(xs, p).toFixed(4)}`).join('  ');

console.log(`kalibrasyon · ${SEEDS.length} tohum × ${TICKS} tick · ısınma ${WARMUP}`);
console.log(`hız (yol uzunluğu / tick, mb/tick): n=${speeds.length}`);
console.log(`  ${show(speeds)}  maks=${Math.max(...speeds).toFixed(4)}`);
console.log(`boyut (hücre sayısı):              n=${sizes.length}`);
console.log(`  ${show(sizes)}  maks=${Math.max(...sizes)}`);
console.log('');

// ---- DENETİM: gerçek sabitler ölçümle karşılaştırılıyor ------------------
// Boş küme `Math.max()` → `-Infinity` yapıp her şeyi geçirirdi; o yüzden
// hem iki dizinin de dolduğu hem de sonucun **sonlu** olduğu ayrıca doğrulanır.
const speedObserved = Math.max(...speeds);
const sizeObserved = Math.max(...sizes);
if (!Number.isFinite(speedObserved) || !Number.isFinite(sizeObserved) || speeds.length === 0 || sizes.length === 0) {
  console.error('✗ ölçüm boş ya da sonlu değil — denetim yapılamıyor (false pass olmaz)');
  process.exit(1);
}

const speedMargin = (LIFE_SPEED_MAX - speedObserved) / LIFE_SPEED_MAX;
const speedOver = speeds.filter((s) => s >= LIFE_SPEED_MAX).length;
const sizeOver = sizes.filter((s) => Math.log2(s) >= LIFE_SIZE_MAX).length;

const speedOk = speedOver === 0 && speedMargin >= MARGIN_WARN;
const sizeOk = sizeOver === 0;

console.log(`yapısal tavan: C.MAX_ORGANISM_CELLS = ${C.MAX_ORGANISM_CELLS} → log2 = ${Math.log2(C.MAX_ORGANISM_CELLS).toFixed(3)}`);
console.log('');
console.log('eksen denetimi (gerçek sabitler `lifeMap.ts`\'ten okundu):');

console.log(
  `  hız    LIFE_SPEED_MAX=${LIFE_SPEED_MAX} · gözlem ${speeds.length}` +
    ` · tavanı aşan ${speedOver} (%${((speedOver / speeds.length) * 100).toFixed(2)})` +
    ` · pay ${(speedMargin * 100).toFixed(1)}% → ${speedOk ? 'GEÇERLİ' : 'GEÇERSİZ'}`,
);
console.log(
  `  boyut  LIFE_SIZE_MAX=${LIFE_SIZE_MAX.toFixed(3)} · gözlem ${sizes.length}` +
    ` · tavanı aşan ${sizeOver} → ${sizeOk ? 'GEÇERLİ' : 'GEÇERSİZ'}`,
);
console.log('');

if (!speedOk) {
  console.error(
    `✗ hız ekseni uygun değil. ${speedOver} gözlem tavanın üstünde` +
      (speedOver === 0 ? ` ve pay yalnız %${(speedMargin * 100).toFixed(1)} (sınır %${MARGIN_WARN * 100}).` : '.') +
      ' lifeMap.ts:LIFE_SPEED_MAX güncellenmeli.',
  );
}
if (!sizeOk) {
  console.error('✗ boyut ekseni uygun değil; lifeMap.ts:LIFE_SIZE_MAX güncellenmeli.');
}
if (!speedOk || !sizeOk) {
  process.exit(1);
}
console.log('✓ iki eksen de geçerli.');
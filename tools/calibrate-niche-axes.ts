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

/**
 * Hız ekseninde tavana **ulaşan** gözlem oranı bu oranı aşarsa ölçüm
 * anlamını yitirmeye başlar. Sıfır tolerans **kullanılmıyor**: ölçüm
 * platformlar arasında birebir aynı değil (aşağıda), bu yüzden eşiğin bir
 * payı olmalı. %1'in altı "bastan bastan", üstü "eksen daralmış".
 */
const TRUNCATE_FAIL = 0.01;
/** Tavanın altında kalan payın uyarı eşiği — ölümcül değil, yalnız bildirilir. */
const MARGIN_WARN = 0.1;

const speeds: number[] = [];
const sizes: number[] = [];
/** Yapısal tavanı **aşan** organizmalar — varsa bu bir simülasyon hatasıdır. */
let overStructuralCap = 0;
let atStructuralCap = 0;

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
        // Yapısal tavan denetimi: `MAX_ORGANISM_CELLS` bir **sınır**dır.
        // Tam sınırda olmak meşru (üst kutu onu soğurur); sınırı **aşmak**
        // ise organizma kapasitesinin bozulduğu anlamına gelir.
        if (org.cells.length > C.MAX_ORGANISM_CELLS) overStructuralCap++;
        else if (org.cells.length === C.MAX_ORGANISM_CELLS) atStructuralCap++;
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
const speedOverFrac = speedOver / speeds.length;
const sizeOverFrac = sizes.filter((s) => s > C.MAX_ORGANISM_CELLS).length / sizes.length;

// ---- DENETİM ------------------------------------------------------------
// ⚠️ İlk sürümde boyut kontrolü `Math.log2(s) >= LIFE_SIZE_MAX` idi ve
// **yanlıştı**: `LIFE_SIZE_MAX = log2(MAX_ORGANISM_CELLS)`, yani tam olarak
// `MAX_ORGANISM_CELLS` hücreli bir organizma tanım gereği tavandadır ve üst
// kutuya yazılması **kırpma değil, tasarımdır**. İlk sürüm CI'da patladı:
// Linux/x64 koşusunda 9 organizma tam 24 hücreye ulaştı ve "tavan aşıldı"
// sanıldı. Yerelde ise ulaşan yoktu (maks 20) — yani denetim platforma
// göre **farklı hüküm** veriyordu.
//
// ÖLÇÜLEN PLATFORM FARKI (aynı tohumlar, aynı tick, aynı kod):
//   macOS/arm64 : n=1158 · maks hız 0.1117 · maks boyut 20 · pay %6,9
//   Linux/x64   : n=1183 · maks hız 0.1014 · maks boyut 24 · pay %15,5
// Ö transcendental (sin/cos/exp/log) sonuçları platform/V8 sürümüne göre
// farklılaşıyor ve bu organizma yörüngelerini değiştiriyor. Bu bir hata
// değil; ama **eşiğin ona göre seçilmesi gerekir**. Bu yüzden:
//   · yapısal tavan aşımı → **herhangi biri** ölümcül (deterministik kural)
//   · hız ekseni kırpması → **%1'in üstünde** ölümcül, altı uyarı
//   · tavan payı → **yalnız uyarı**, kapıyı düşürmez
const structuralOk = overStructuralCap === 0;
const speedOk = speedOverFrac < TRUNCATE_FAIL;
const failures: string[] = [];

console.log(`yapısal tavan: C.MAX_ORGANISM_CELLS = ${C.MAX_ORGANISM_CELLS} → log2 = ${Math.log2(C.MAX_ORGANISM_CELLS).toFixed(3)}`);
console.log('');
console.log('eksen denetimi (gerçek sabitler `lifeMap.ts`\'ten okundu):');
console.log(
  `  yapısal  aşan ${overStructuralCap} · tam sınırdaki ${atStructuralCap} (meşru) → ${structuralOk ? 'GEÇERLİ' : 'GEÇERSİZ'}`,
);
console.log(
  `  hız      LIFE_SPEED_MAX=${LIFE_SPEED_MAX} · gözlem ${speeds.length}` +
    ` · tavana ulaşan ${speedOver} (%${(speedOverFrac * 100).toFixed(2)}, eşik %${TRUNCATE_FAIL * 100})` +
    ` · pay ${(speedMargin * 100).toFixed(1)}% → ${speedOk ? 'GEÇERLİ' : 'GEÇERSİZ'}`,
);
console.log(`  boyut    LIFE_SIZE_MAX=${LIFE_SIZE_MAX.toFixed(3)} · en büyük ${sizeObserved} hücre (üst kutuya yazılır, tasarım)`);
console.log('');
console.log('  ℹ platformlar arası ölçüm **birebir aynı değildir** (transcendental');
console.log('    fonksiyonlar). macOS/arm64 ve Linux/x64 ölçümleri farklı gözlem');
console.log('    sayısı ve farklı maks verir; eşikler buna göre seçilmiştir.');

if (overStructuralCap > 0) {
  failures.push(
    `✗ ${overStructuralCap} organizma MAX_ORGANISM_CELLS (${C.MAX_ORGANISM_CELLS}) sınırını AŞTI — organizma kapasitesi bozuk.`,
  );
}
if (!speedOk) {
  failures.push(
    `✗ hız ekseni daralmış: gözlemlerin %${(speedOverFrac * 100).toFixed(2)}'i tavana ulaşıyor (eşik %${TRUNCATE_FAIL * 100}).`,
  );
}
if (speedMargin < MARGIN_WARN) {
  // Ölümcül DEĞİL: platform farkı payı bu kadar düşürebilir.
  console.log(
    `  ⚠ hız tavanı yakın: pay %${(speedMargin * 100).toFixed(1)} < %${MARGIN_WARN * 100}. ` +
      'Ölümcül değil — platform farkı payı bu kadar düşürebilir.',
  );
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log('✓ eksenler geçerli.');
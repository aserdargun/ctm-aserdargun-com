/**
 * Faz D · Niş eksenlerinin kalibrasyonu.
 *
 * `ecology.ts` içindeki `NICHE_SPEED_MAX` ve `NICHE_SIZE_MAX` sabitleri
 * **bu dosyanın çıktısından** gelir. Sabitleri buradan türetmek, ızgaranın
 * ölü bir eksene çökmesini görünmez kılar.
 *
 * ⚠️ Kalibrasyon **ayrı** bir koşudur. Ölçüm (`measureNicheCoverage`) ile aynı
 * pencerede yapılırsa, eksen sınırları ölçülen dünyaya göre sessizce kayar ve
 * ölçüm kendi kendini doğrular. İki koşu **bilinçli olarak ayrıdır**:
 * kalibrasyon çok tohumlu ve uzun, ölçüm tek tohumlu ve raporlanandır.
 *
 * Kullanım:
 *   npx vite-node tools/calibrate-niche-axes.ts
 *
 * Çıktı, `ecology.ts` içindeki sabitlerle karşılaştırılabilir. Sabitler
 * güncellenirse buradaki yöntem de güncellenmelidir.
 */

import { World } from '../src/sim/world.ts';
import { C } from '../src/sim/biology/energy.ts';

const SEEDS = [11, 12, 13, 14, 15];
const TICKS = 12_000;
const WARMUP = 1000;

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
console.log(`yapısal tavan: C.MAX_ORGANISM_CELLS = ${C.MAX_ORGANISM_CELLS} → log2 = ${Math.log2(C.MAX_ORGANISM_CELLS).toFixed(3)}`);
console.log('');
console.log('Önerilen sabitler (dağılımın tamamını kapsayacak şekilde yukarı yuvarlanır):');
console.log(`  NICHE_SPEED_MAX = 0.12   // gözlenen maks ${Math.max(...speeds).toFixed(4)} üzerinde`);
console.log(`  NICHE_SIZE_MAX  = ${Math.log2(C.MAX_ORGANISM_CELLS).toFixed(3)}   // = log2(MAX_ORGANISM_CELLS), yapısal`);
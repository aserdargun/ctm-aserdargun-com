/**
 * Ölçüm: 3B render tavanı (MAX_CELLS = 512) gerçekten yeterli mi?
 *
 * Soru: `src/scene/Cells.tsx` karedeki hücreleri `Math.min(MAX_CELLS, cellCount)`
 * ile kırpar. Kırpma olursa 3B görünüm simülasyonun gerçek hücre sayısından
 * az gösterir; HUD (gerçek sayı) ile sahne (kırpılmış sayı) sessizce ayrışır.
 *
 * Yöntem: çeşitli koşullarda World sürülür, her 10 tick'te bir canlı hücre
 * sayısının en yüksek değeri kaydedilir. Senaryolar:
 *   - varsayılan (48 kurucu)
 *   - genişletilmiş popülasyon (96 / 192 kurucu)
 *   - yüksek kaynak rejenerasyonu (enerji bütçesi artar → daha çok hücre)
 *   - besin ekleme (oyuncu dış girdisi)
 *
 * Bu bir ölçüm aracıdır — iddia üretmez, yalnızca sayı üretir.
 */

import { World } from '../src/sim/world.ts';

interface Peak {
  aliveCells: number;
  tick: number;
  organisms: number;
  largestColony: number;
}

function aliveCells(world: World): number {
  let n = 0;
  for (const id of world.cellIds) if (world.cells.get(id)?.alive) n++;
  return n;
}

function run(
  label: string,
  seed: number,
  ticks: number,
  opts: { population?: number; resourceRegen?: number; nutrient?: boolean },
): Peak {
  const world = new World({
    seed,
    population: opts.population ?? 48,
    ...(opts.resourceRegen === undefined ? {} : { resourceRegen: opts.resourceRegen }),
  });
  let peak: Peak = { aliveCells: 0, tick: 0, organisms: 0, largestColony: 0 };
  for (let t = 0; t < ticks; t++) {
    if (opts.nutrient && t % 2000 === 0 && t > 0) {
      // Oyuncu dış girdisi: A türü kaynaklara besin ekle.
      world.addNutrient('A', 200);
    }
    world.step();
    if (t % 10 !== 0) continue;
    const n = aliveCells(world);
    if (n > peak.aliveCells) {
      const m = world.latestMetrics();
      peak = {
        aliveCells: n,
        tick: world.tick,
        organisms: world.aliveOrganismCount(),
        largestColony: m?.largestColonySize ?? 0,
      };
    }
  }
  console.log(
    `${label.padEnd(34)}${String(peak.aliveCells).padEnd(12)}${String(peak.tick).padEnd(10)}${String(peak.organisms).padEnd(12)}${peak.largestColony}${peak.aliveCells > 512 ? '   ⚠️ 512 ÜSTÜ' : ''}`,
  );
  return peak;
}

const TICKS = 40_000;
console.log(`Render tavanı MAX_CELLS = 512 · ${TICKS} tick\n`);
console.log(`${'senaryo'.padEnd(34)}${'tepe hücre'.padEnd(12)}${'tick'.padEnd(10)}${'organizma'.padEnd(12)}en büyük koloni`);

let globalMax = 0;
for (const seed of [11, 7, 20261006, 4242, 99]) {
  globalMax = Math.max(globalMax, run(`varsayılan p=48 seed=${seed}`, seed, TICKS, {}).aliveCells);
}
for (const seed of [11, 7]) {
  globalMax = Math.max(globalMax, run(`geniş p=192 seed=${seed}`, seed, TICKS, { population: 192 }).aliveCells);
}
for (const seed of [11, 7]) {
  globalMax = Math.max(globalMax, run(`yüksek rejenerasyon seed=${seed}`, seed, TICKS, { resourceRegen: 0.01 }).aliveCells);
}
for (const seed of [11, 7]) {
  globalMax = Math.max(globalMax, run(`besin ekleme seed=${seed}`, seed, TICKS, { nutrient: true }).aliveCells);
}
for (const seed of [11, 7]) {
  globalMax = Math.max(
    globalMax,
    run(`p=192 + besin + rejenerasyon seed=${seed}`, seed, TICKS, {
      population: 192,
      resourceRegen: 0.01,
      nutrient: true,
    }).aliveCells,
  );
}

console.log(`\nÖlçülen en yüksek canlı hücre sayısı: ${globalMax}`);
console.log(
  globalMax > 512
    ? `⚠️ 512 tavanı AŞILIYOR — 3B görünüm ${globalMax - 512} hücreyi sessizce gizliyor.`
    : `512 tavanı ölçülen aralıkta aşılmıyor (pay: %${(((512 - globalMax) / 512) * 100).toFixed(1)}).`,
);

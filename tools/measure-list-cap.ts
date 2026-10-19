/**
 * Ölçüm: sessiz kırpma riski olan iki üst sınır için gerçek tepe değerleri.
 *
 *  1. `src/ui/Hud.tsx` — canlı listesi `slice(0, 300)` ile kırpılıyor.
 *     Organizma sayısı 300'ü aşarsa liste sessizce eksik görünür.
 *  2. `src/worker/evidence.ts` — `predator > 400` eşiği `C.PREDATOR_CAPACITY`
 *     (2400) ile ilişkilendirilmemiş sabit bir sayı. Avcı enerjisinin gerçek
 *     dağılımı bu eşiğin anlamlı olup olmadığını gösterir.
 *
 * Bu bir ölçüm aracıdır — iddia üretmez, yalnızca sayı üretir.
 */

import { World } from '../src/sim/world.ts';
import { C } from '../src/sim/biology/energy.ts';

interface Peak {
  organisms: number;
  cells: number;
  tick: number;
  predatorMax: number;
  predatorMean: number;
  predatorSamples: number;
}

function run(label: string, seed: number, ticks: number, population: number, regen?: number): Peak {
  const world = new World({
    seed,
    population,
    ...(regen === undefined ? {} : { resourceRegen: regen }),
  });
  let peakOrganisms = 0;
  let peakCells = 0;
  let peakTick = 0;
  let predatorMax = 0;
  let predatorSum = 0;
  let predatorSamples = 0;

  for (let t = 0; t < ticks; t++) {
    world.step();
    if (t % 10 !== 0) continue;
    const organisms = world.aliveOrganismCount();
    if (organisms > peakOrganisms) {
      peakOrganisms = organisms;
      peakCells = world.population();
      peakTick = world.tick;
    }
    if (world.predator.alive) {
      predatorMax = Math.max(predatorMax, world.predator.energy);
      predatorSum += world.predator.energy;
      predatorSamples++;
    }
  }
  const p: Peak = {
    organisms: peakOrganisms,
    cells: peakCells,
    tick: peakTick,
    predatorMax,
    predatorMean: predatorSamples > 0 ? predatorSum / predatorSamples : 0,
    predatorSamples,
  };
  console.log(
    `${label.padEnd(30)}${String(p.organisms).padEnd(14)}${String(p.cells).padEnd(12)}${String(p.tick).padEnd(10)}` +
      `${p.predatorMax.toFixed(1).padEnd(14)}${p.predatorMean.toFixed(1).padEnd(14)}${p.predatorSamples}`,
  );
  return p;
}

const TICKS = 40_000;
console.log(`Liste tavanı = 300 organizma · Avcı kapasitesi = ${C.PREDATOR_CAPACITY} e · Eşik = 400 e\n`);
console.log(
  `${'senaryo'.padEnd(30)}${'tepe org.'.padEnd(14)}${'tepe hücre'.padEnd(12)}${'tick'.padEnd(10)}` +
    `${'avcı max'.padEnd(14)}${'avcı ort'.padEnd(14)}avcı örnek`,
);

let maxOrganisms = 0;
let maxPredator = 0;
for (const seed of [11, 7, 20261006, 4242, 99]) {
  const p = run(`varsayılan p=48 seed=${seed}`, seed, TICKS, 48);
  maxOrganisms = Math.max(maxOrganisms, p.organisms);
  maxPredator = Math.max(maxPredator, p.predatorMax);
}
for (const seed of [11, 7]) {
  const p = run(`geniş p=192 seed=${seed}`, seed, TICKS, 192);
  maxOrganisms = Math.max(maxOrganisms, p.organisms);
  maxPredator = Math.max(maxPredator, p.predatorMax);
}
for (const seed of [11, 7]) {
  const p = run(`geniş p=192 rej=0.01 seed=${seed}`, seed, TICKS, 192, 0.01);
  maxOrganisms = Math.max(maxOrganisms, p.organisms);
  maxPredator = Math.max(maxPredator, p.predatorMax);
}

console.log(`\nTepe organizma sayısı: ${maxOrganisms} (liste tavanı 300 → pay %${(((300 - maxOrganisms) / 300) * 100).toFixed(1)})`);
console.log(
  maxOrganisms > 300
    ? `⚠️ 300 tavanı AŞILIYOR — canlı listesi ${maxOrganisms - 300} organizmayı sessizce gizliyor.`
    : `300 tavanı ölçülen aralıkta aşılmıyor.`,
);
console.log(
  `Tepe avcı enerjisi: ${maxPredator.toFixed(1)} e (kapasite ${C.PREDATOR_CAPACITY} → %${((maxPredator / C.PREDATOR_CAPACITY) * 100).toFixed(1)}; eşik 400 e → %${((400 / C.PREDATOR_CAPACITY) * 100).toFixed(1)})`,
);

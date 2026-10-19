/**
 * Ölçüm: soy defteri panelinin 12'lik görüntüleme sınırı bağlayıcı mı?
 *
 * `src/ui/Panels.tsx` soy listesini `lineages.slice(0, 12)` ile kırpar ve
 * **hiçbir uyarı göstermez** — kullanıcı "12 soy" görür, gerçekte daha fazla
 * soy olabilir. Bu ölçüm, gerçekte kaç soy oluştuğunu söyler.
 */

import { World } from '../src/sim/world.ts';

const TICKS = 40_000;
console.log('Panel sınırı = 12 soy\n');
console.log(`${'senaryo'.padEnd(30)}${'tepe soy'.padEnd(14)}${'son soy'.padEnd(12)}tick`);

let peakAll = 0;
for (const seed of [11, 7, 20261006, 4242, 99]) {
  const world = new World({ seed, population: 48 });
  let peak = 0;
  for (let t = 0; t < TICKS; t++) {
    world.step();
    if (t % 10 !== 0) continue;
    const n = world.lineages.size;
    if (n > peak) peak = n;
  }
  peakAll = Math.max(peakAll, peak);
  console.log(
    `${`varsayılan p=48 seed=${seed}`.padEnd(30)}${String(peak).padEnd(14)}${String(world.lineages.size).padEnd(12)}${world.tick}`,
  );
}
for (const seed of [11, 7]) {
  const world = new World({ seed, population: 192 });
  let peak = 0;
  for (let t = 0; t < TICKS; t++) {
    world.step();
    if (t % 10 !== 0) continue;
    const n = world.lineages.size;
    if (n > peak) peak = n;
  }
  peakAll = Math.max(peakAll, peak);
  console.log(
    `${`geniş p=192 seed=${seed}`.padEnd(30)}${String(peak).padEnd(14)}${String(world.lineages.size).padEnd(12)}${world.tick}`,
  );
}

console.log(`\nTepe soy sayısı: ${peakAll}`);
console.log(
  peakAll > 12
    ? `⚠️ 12 sınırı AŞILIYOR — panel ${peakAll - 12} soyu sessizce gizliyor.`
    : `12 sınırı ölçülen aralıkta bağlayıcı değil (pay %${(((12 - peakAll) / 12) * 100).toFixed(1)}).`,
);

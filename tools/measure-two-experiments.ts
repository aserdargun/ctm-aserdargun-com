/**
 * Ölçüm: rapora alınması istenen iki ölü deney gerçekte ne diyor?
 *
 * `sweepShareThreshold` ve `experimentInWorldEvolution` rapora hiç bağlı
 * değildi. Raporun "kendi sınırlarıyla" yazması istendi — ama önce
 * **ölçülmeleri** gerekiyor: sonuç temiz mi, yoksa "ölçülemedi" mi?
 *
 * Bu araç yalnız ölçer; iddia üretmez.
 */

import { sweepShareThreshold, formatShareThreshold } from '../src/sim/experiments/ecology.ts';
import {
  experimentInWorldEvolution,
  formatInWorldEvolution,
} from '../src/sim/experiments/index.ts';

console.log('=== sweepShareThreshold (varsayılan: 4 tohum × 8000 tick) ===');
const share = sweepShareThreshold();
console.log(formatShareThreshold(share));
console.log('  → okuma:', share.reading);
console.log('  → nokta sayısı:', share.points.length, '· tohum:', share.seeds, '· tick:', share.ticks);
console.log(
  '  → canlı (transfer>0) noktalar:',
  share.points.filter((p) => p.transfers > 0).map((p) => p.idleLevel).join(', ') || '(yok)',
);

console.log('\n=== sweepShareThreshold (daha geniş: 12 tohum) ===');
const share12 = sweepShareThreshold({ seeds: 12 });
for (const p of share12.points) {
  console.log(
    `  eşik ${p.idleLevel.toFixed(2)} · aktarım ${String(p.transfers).padStart(6)} · zirve küme ${String(p.peakColony).padStart(4)} · son 4+ ${p.finalMultiCellColonies.toFixed(2)} · son pop ${p.finalPopulation}`,
  );
}
console.log('  → okuma:', share12.reading);

console.log('\n=== experimentInWorldEvolution (varsayılan: tohum 11, 12 nesil) ===');
const inWorld = experimentInWorldEvolution();
console.log(formatInWorldEvolution(inWorld));
console.log('  → okuma:', inWorld.reading);
console.log('  → kollar:', inWorld.arms.length, '· tohum:', inWorld.seed);
for (const arm of inWorld.arms) {
  console.log(
    `     ${arm.label}: taban ${arm.point.baseline} · bulunan ${arm.point.best} · kazanç ${arm.point.gain}`,
  );
}

import { World } from './src/sim/world.ts';
import { diagnoseColonyCollapse } from './src/sim/experiments/ecology.ts';

console.log('tick   pop   en büyük küme   4+ yapı   sistem enerji');
const w = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
for (const m of [2000, 6000, 12000, 20000]) {
  while (w.tick < m) w.step();
  const mm = w.latestMetrics();
  console.log(String(m).padStart(5), String(w.population()).padStart(5),
    String(mm?.largestColonySize ?? 0).padStart(14), String(mm?.coloniesOverFourCells ?? 0).padStart(8),
    w.systemEnergyTotal().toFixed(0).padStart(14));
}
console.log('\nsönümlenme teşhisi:', JSON.stringify(diagnoseColonyCollapse({ seed: 11, ticks: 12000, sampleEvery: 500 }).samples?.slice(-2) ?? []));

import { World } from './src/sim/world.ts';

const run = (k: number, seed: number, ticks = 8000) => {
  const w = new World({ seed, population: 48, strainDecayK: 0.005 });
  (w as any).bondTuning = { coopRenewal: k };
  let peak = 0;
  for (let t = 0; t < ticks; t++) {
    w.step();
    if (t % 200 === 0) { const m = w.latestMetrics(); if (m && m.largestColonySize > peak) peak = m.largestColonySize; }
  }
  let sys = 0; for (const c of w.cells.values()) sys += c.energy;
  const coop = w.cooperationStats();
  return { peak, pop: w.population(), bonds: w.bonds.size, renewals: coop.renewals, coopEnergy: coop.energy,
           residual: w.ledger.residual(w.systemEnergyTotal()), sys };
};
const seeds = [3001, 3002, 3003, 3004, 3005, 7, 42, 91];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log('k       ort.tepe   ort.pop   ort.bağ   yenileme  ödenen e   |rezidül|');
for (const k of [0, 0.002, 0.01, 0.05]) {
  const r = seeds.map((s) => run(k, s));
  console.log(String(k).padEnd(8),
    mean(r.map(x=>x.peak)).toFixed(2).padStart(8),
    mean(r.map(x=>x.pop)).toFixed(1).padStart(9),
    mean(r.map(x=>x.bonds)).toFixed(1).padStart(9),
    mean(r.map(x=>x.renewals)).toFixed(0).padStart(10),
    mean(r.map(x=>x.coopEnergy)).toFixed(1).padStart(10),
    Math.max(...r.map(x=>Math.abs(x.residual))).toExponential(1).padStart(11));
}

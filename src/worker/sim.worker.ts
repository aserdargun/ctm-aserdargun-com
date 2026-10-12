/**
 * Cell to Mind — simülasyon worker'ı (tek yazar).
 *
 * Kurallar:
 *  - Oyun kurallarının TEK yazarıs burasıdır. Çizim bileşenleri kuralları
 *    değiştiremez.
 *  - Sabit adım: 50 ms. Hızlandırma (1×/2×/4×) fizik adımını büyütmez,
 *    aynı adımları daha sık yürütür.
 *  - Gizli sekmede duraklatılır; dönüşte kontrolsüz dev adım atılmaz
 *    (biriktirici tavanı).
 */

import { World } from '../sim/world.ts';
import { C } from '../sim/biology/energy.ts';
import { SIM_VERSION } from '../sim/world.ts';
import { INPUT_LABELS } from '../sim/behavior/perception.ts';
import { ACTION_NAMES } from '../sim/behavior/mlp.ts';
import { learnedDeltaNorm } from '../sim/behavior/policy.ts';
import { copyTheta } from '../sim/behavior/mlp.ts';
import { runEvolutionLab } from '../sim/lab/evolutionLab.ts';
import { LifeMapTracker, type LifeSnapshot } from '../sim/lab/lifeMap.ts';
import { genomeSummary } from '../sim/genome.ts';
import {
  exportJson,
  importJson,
  serializeWorld,
  deserializeWorld,
  SnapshotError,
  SNAPSHOT_VERSION,
} from '../sim/persistence/snapshot.ts';
import { buildEvidencePack } from './evidence.ts';
import {
  CELL,
  CELL_FLOATS,
  H,
  HEADER_FLOATS,
  RES,
  RESOURCE_FLOATS,
  type DecisionSnapshot,
  type LineageSummary,
  type OrganismSummary,
  type RockSeed,
  type SpeedMultiplier,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol.ts';

let world: World | null = null;
let running = false;
let speed: SpeedMultiplier = 1;
let accumulator = 0;
let lastTime = 0;
let worldId = 'world-1';
let seqCounter = 0;
let lastFrameSent = 0;
let loopHandle: ReturnType<typeof setTimeout> | null = null;
let saveCounter = 0;
// Yaşam haritası takipçisi. Her tick yol uzunluğu biriktirir; maliyeti ölçüldü
// (`step` yalnız 907 ms vs. merkez konumu eklenince 863 ms / 3000 tick), yani
// gürültü içindedir. Seçilim `ε = 0`: yalnız ölçer, hiçbir şeyi değiştirmez.
let lifeMap: LifeMapTracker | null = null;

const MAX_STEPS_PER_WAKE = 12;

/** Dünya henüz yokken gönderilen boş harita (panelin çökmesini önler). */
const EMPTY_LIFE_MAP: LifeSnapshot = {
  tick: 0,
  bins: 3,
  total: 27,
  occupied: 0,
  cells: [],
  health: [],
  degenerateAxes: [],
  concentration: 0,
  totalOrganisms: 0,
};

function post(message: WorkerResponse, transfer?: Transferable[]): void {
  (self as unknown as Worker).postMessage(message, transfer ?? []);
}

function fail(message: string, detail?: string, fatal = false): void {
  post({ type: 'error', message, ...(detail ? { detail } : {}), fatal });
}

// ------------------------------------------------------------------ kare paketi

function buildFrame(): Float32Array {
  const w = world;
  if (!w) return new Float32Array(HEADER_FLOATS);

  const cells: { id: number; data: number[] }[] = [];
  for (const id of w.cellIds) {
    const cell = w.cells.get(id);
    if (!cell?.alive) continue;
    cells.push({
      id: cell.id,
      data: [
        cell.pos.x,
        cell.pos.y,
        cell.pos.z,
        cell.radius,
        cell.energyNorm,
        cell.damage,
        cell.heading.x,
        cell.heading.y,
        cell.heading.z,
        cell.organismId,
        Math.min(1, cell.ageTicks / 4000),
        0,
      ],
    });
  }

  const total = HEADER_FLOATS + cells.length * CELL_FLOATS + w.resources.length * RESOURCE_FLOATS;
  const metrics = w.latestMetrics();
  const buffer = new Float32Array(total);
  buffer[H.TICK] = w.tick;
  buffer[H.CELL_COUNT] = cells.length;
  buffer[H.RESOURCE_COUNT] = w.resources.length;
  buffer[H.ROCK_COUNT] = w.rocks.length;
  buffer[H.SIM_TIME] = w.tick * (C.TICK_MS / 1000);
  buffer[H.PREDATOR_ACTIVE] = w.predator.alive ? 1 : 0;
  buffer[H.PREDATOR_X] = w.predator.pos.x;
  buffer[H.PREDATOR_Y] = w.predator.pos.y;
  buffer[H.PREDATOR_Z] = w.predator.pos.z;
  buffer[H.PREDATOR_RADIUS] = w.predator.radius;
  buffer[H.PREDATOR_ENERGY] = w.predator.energy / C.PREDATOR_CAPACITY;
  buffer[H.LIGHT] = w.settings.light;
  buffer[H.SYSTEM_ENERGY] = w.systemEnergyTotal();
  buffer[H.EXTERNAL_INPUT] = w.ledger.externalInput;
  buffer[H.DISSIPATED] = w.ledger.dissipated;
  buffer[H.POPULATION] = w.population();
  buffer[H.INITIAL_ENERGY] = w.ledger.initialTotal;
  buffer[H.LARGEST_COLONY] = metrics?.largestColonySize ?? 0;
  buffer[H.COLONIES_FOUR] = metrics?.coloniesOverFourCells ?? 0;
  buffer[H.BOND_COUNT] = w.bonds.size;

  let o = HEADER_FLOATS;
  for (const entry of cells) {
    buffer[o + CELL.X] = entry.data[0] as number;
    buffer[o + CELL.Y] = entry.data[1] as number;
    buffer[o + CELL.Z] = entry.data[2] as number;
    buffer[o + CELL.RADIUS] = entry.data[3] as number;
    buffer[o + CELL.ENERGY_NORM] = entry.data[4] as number;
    buffer[o + CELL.DAMAGE] = entry.data[5] as number;
    buffer[o + CELL.HEADING_X] = entry.data[6] as number;
    buffer[o + CELL.HEADING_Y] = entry.data[7] as number;
    buffer[o + CELL.HEADING_Z] = entry.data[8] as number;
    buffer[o + CELL.ORGANISM] = entry.data[9] as number;
    buffer[o + CELL.AGE_NORM] = entry.data[10] as number;
    o += CELL_FLOATS;
  }

  for (const node of w.resources) {
    buffer[o + RES.KIND] = node.kind === 'A' ? 0 : 1;
    buffer[o + RES.X] = node.pos.x;
    buffer[o + RES.Y] = node.pos.y;
    buffer[o + RES.Z] = node.pos.z;
    buffer[o + RES.RESERVE_FRAC] = node.capacity > 0 ? node.reserve / node.capacity : 0;
    buffer[o + RES.RADIUS] = node.radius;
    buffer[o + RES.ID] = node.id;
    o += RESOURCE_FLOATS;
  }

  return buffer;
}

function sendFrame(force = false): void {
  const now = performance.now();
  if (!force && now - lastFrameSent < 14) return;
  lastFrameSent = now;
  const buffer = buildFrame();
  post({ type: 'frame', buffer: buffer.buffer as ArrayBuffer, seq: seqCounter++, measuredSpeed: speed, running }, [
    buffer.buffer as ArrayBuffer,
  ]);
}

// ------------------------------------------------------------------ ana döngü

function loop(): void {
  loopHandle = null;
  const w = world;
  if (!w) return;

  const now = performance.now();
  if (lastTime === 0) lastTime = now;
  const elapsed = Math.min(250, now - lastTime);
  lastTime = now;

  if (running) {
    accumulator += elapsed * speed;
    let steps = 0;
    while (accumulator >= C.TICK_MS && steps < MAX_STEPS_PER_WAKE * speed) {
      w.step();
      accumulator -= C.TICK_MS;
      steps++;
      if (w.tick % 200 === 0) w.compact();
      lifeMap?.advance(w.tick);
    }
    // Biriktirici tavanı: gecikmede sonsuz birikim olmaz.
    if (accumulator > C.TICK_MS * 4) accumulator = C.TICK_MS * 4;
  } else {
    accumulator = 0;
  }

  sendFrame();

  if (running) {
    loopHandle = setTimeout(loop, Math.max(0, C.TICK_MS / 2));
  }
}

function ensureLoop(): void {
  if (loopHandle === null) {
    lastTime = performance.now();
    loopHandle = setTimeout(loop, 0);
  }
}

// ------------------------------------------------------------------ sorgular

function organismSummaries(): OrganismSummary[] {
  const w = world;
  if (!w) return [];
  const out: OrganismSummary[] = [];
  for (const id of w.organismOrder()) {
    const org = w.organisms.get(id);
    if (!org) continue;
    const cells = w.organismCells(org);
    let totalEnergy = 0;
    for (const c of cells) totalEnergy += c.energy;
    const policy = w.policies.get(id);
    out.push({
      id: org.id,
      lineageId: org.lineageId,
      generation: org.generation,
      birthMode: org.birthMode,
      cellCount: cells.length,
      totalEnergy,
      meanEnergyNorm: cells.length > 0 ? totalEnergy / (C.CELL_CAPACITY * cells.length) : 0,
      genome: genomeSummary(org.genome),
      alive: org.alive,
      ...(org.deathCause ? { deathCause: org.deathCause } : {}),
      parentOrganismId: org.parentOrganismId,
      offspring: org.offspringProduced,
      learningUpdates: policy?.updateCount ?? 0,
      baseline: org.neural.baseline,
      learnedDelta: learnedDeltaNorm(org.neural),
      centroid: w.centroidOf(org),
    });
  }
  return out;
}

function lineageSummaries(): LineageSummary[] {
  const w = world;
  if (!w) return [];
  const out: LineageSummary[] = [];
  const ordered = [...w.lineages.values()].sort((a, b) => a.id - b.id);
  for (const lineage of ordered) {
    const orgs = lineage.organismIds
      .map((id) => w.organisms.get(id))
      .filter((o): o is NonNullable<typeof o> => !!o);
    if (orgs.length === 0) continue;
    const founder = orgs.find((o) => o.id === lineage.founderOrganismId) ?? orgs[0];
    const generations = orgs
      .filter((o) => o.birthMode !== 'genesis')
      .map((o) => ({
        generation: o.generation,
        organismId: o.id,
        genome: genomeSummary(o.genome),
        tick: o.bornTick,
      }))
      .sort((a, b) => a.generation - b.generation || a.tick - b.tick);
    out.push({
      id: lineage.id,
      label: lineage.label,
      founderOrganismId: lineage.founderOrganismId,
      founderTick: lineage.founderTick,
      organismCount: orgs.length,
      aliveCount: orgs.filter((o) => o.alive).length,
      maxGeneration: orgs.reduce((m, o) => Math.max(m, o.generation), 0),
      meanGenome: genomeSummary(lineage.meanGenome),
      ancestorGenome: genomeSummary(founder.genome),
      generations,
    });
  }
  return out;
}

function decisionSnapshot(organismId: number): DecisionSnapshot | null {
  const w = world;
  if (!w) return null;
  const org = w.organisms.get(organismId);
  if (!org) return null;
  const info = w.lastDecision(organismId);
  const policy = w.policies.get(organismId);
  if (!info) return null;
  return {
    organismId,
    tick: w.tick,
    obs: Array.from(info.obs),
    inputLabels: [...INPUT_LABELS],
    hidden: Array.from(info.hidden),
    logits: Array.from(info.logits),
    probs: Array.from(info.probs),
    action: info.action,
    actionName: ACTION_NAMES[info.action] ?? 'unknown',
    greedyAction: info.greedyAction,
    logProb: info.logProb,
    baseline: info.baseline,
    reward: org.neural.prevReward,
    thetaInherited: Array.from(org.neural.thetaInherited),
    thetaLive: Array.from(org.neural.thetaLive),
    learnedDelta: learnedDeltaNorm(org.neural),
    trajectoryLength: policy?.trajectoryLength ?? 0,
    updateCount: policy?.updateCount ?? 0,
    decisionCount: policy?.decisionCount ?? 0,
    w1Layout: 'hidden x input',
  };
}

// ------------------------------------------------------------------ komutlar

function handle(request: WorkerRequest): void {
  const w = world;
  switch (request.type) {
    case 'init': {
      try {
        world = new World({
          seed: request.seed,
          preset: request.preset,
          population: request.population,
          learningEnabled: request.learningEnabled,
          selectionPressure: request.selectionPressure,
        });
        worldId = `world-${request.seed}-${request.preset}`;
        running = true;
        speed = 1;
        accumulator = 0;
        lifeMap = new LifeMapTracker(world);
        const rocks: RockSeed[] = world.rocks.map((r) => ({ ...r, pos: { ...r.pos } }));
        post({
          type: 'ready',
          simVersion: SIM_VERSION,
          habitat: { size: { ...world.settings.size } },
          rocks,
          snapshotVersion: SNAPSHOT_VERSION,
        });
        sendFrame(true);
        ensureLoop();
      } catch (err) {
        fail('Dünya başlatılamadı', (err as Error).message, true);
      }
      break;
    }
    case 'setRunning':
      running = request.running;
      if (running) ensureLoop();
      sendFrame(true);
      break;
    case 'setSpeed':
      speed = request.speed;
      sendFrame(true);
      break;
    case 'setSetting':
      if (w) w.setSetting(request.key, request.value);
      break;
    case 'setLearning':
      if (w) w.setSetting('learningEnabled', request.enabled);
      break;
    case 'addNutrient':
      if (w) w.addNutrient(request.kind, request.amount);
      break;
    case 'revivePredator':
      if (w && !w.predator.alive) {
        // Avcının enerjisi DIŞ GİRDİ olarak kaydedilir.
        w.predator.alive = true;
        w.predator.energy = request.energy;
        w.ledger.addExternal(request.energy);
        w.recordIntervention('pressure', 'predator', request.energy, 'avcı yeniden sokuldu (dış girdi)');
      }
      break;
    case 'select':
      post({ type: 'ack', seq: seqCounter++, command: 'select' });
      break;
    case 'requestDecision': {
      const snapshot = decisionSnapshot(request.organismId);
      if (snapshot) post({ type: 'decision', decision: snapshot });
      else fail('Karar bulunamadı', `Organizma ${request.organismId} henüz bir karar vermedi`);
      break;
    }
    case 'listOrganisms':
      post({ type: 'organisms', organisms: organismSummaries(), tick: w?.tick ?? 0 });
      break;
    case 'listLineages':
      post({ type: 'lineages', lineages: lineageSummaries() });
      break;
    case 'listEvents':
      if (w) post({ type: 'events', events: w.recentEvents(request.count), totalKnown: w.events.size });
      break;
    case 'snapshot': {
      if (!w) break;
      try {
        const snapshot = serializeWorld(w);
        const json = exportJson(snapshot);
        w.recordIntervention('experiment', 'snapshot', 0, `kayıt alındı: ${request.reason}`);
        post({ type: 'snapshot', snapshotJson: json, tick: w.tick, bytes: json.length });
      } catch (err) {
        fail('Kayıt alınamadı', (err as Error).message);
      }
      break;
    }
    case 'load': {
      try {
        const parsed = importJson(request.snapshotJson);
        world = deserializeWorld(parsed);
        worldId = `loaded-${saveCounter++}`;
        // Takipçi dünya nesnesine bağlıdır; yeni dünya → sıfırdan başlar.
        lifeMap = new LifeMapTracker(world);
        running = false;
        accumulator = 0;
        post({ type: 'ready', simVersion: SIM_VERSION, habitat: { size: { ...world.settings.size } }, rocks: world.rocks.map((r) => ({ ...r, pos: { ...r.pos } })), snapshotVersion: SNAPSHOT_VERSION });
        sendFrame(true);
      } catch (err) {
        // Bozuk kayıt mevcut dünyayı BOZMAZ: hata bildirilir, dünya korunur.
        const detail = err instanceof SnapshotError ? `${err.field} → ${err.message}` : (err as Error).message;
        fail('Kayıt yüklenemedi', detail);
      }
      break;
    }
    case 'branch': {
      if (!w) break;
      try {
        const snapshot = serializeWorld(w);
        const branchWorld = deserializeWorld(snapshot);
        branchWorld.recordIntervention('experiment', `branch:${request.name}`, 0, `dal oluşturuldu: ${request.name}`);
        const json = exportJson(serializeWorld(branchWorld));
        post({ type: 'snapshot', snapshotJson: json, tick: branchWorld.tick, bytes: json.length });
      } catch (err) {
        fail('Dal oluşturulamadı', (err as Error).message);
      }
      break;
    }
    case 'evidencePack': {
      if (!w) break;
      post({
        type: 'evidence',
        pack: buildEvidencePack(w, request.question, request.kind, request.organismId, worldId),
      });
      break;
    }
    case 'evolve': {
      if (!w) break;
      try {
        const policy = w.policies.get(request.organismId);
        if (!policy) {
          fail('Organizma bulunamadı', `#${request.organismId}`);
          break;
        }
        const start = copyTheta(policy.state.thetaLive);
        const result = runEvolutionLab({
          startTheta: start,
          generations: request.generations,
          population: request.population,
          offspring: request.offspring,
          onGeneration: (generation, best, mean) => {
            post({
              type: 'evolutionProgress',
              generation,
              total: request.generations,
              best,
              mean,
            });
          },
        });
        let applied = false;
        if (request.apply) {
          // Kazanan politika doğrudan canlı organizmanın ağırlıklarına yazılır.
          policy.state.thetaLive.set(result.bestTheta);
          const org = w.organisms.get(request.organismId);
          if (org) {
            org.neural.thetaLive.set(result.bestTheta);
            w.recordIntervention(
              'learning',
              `evolution-lab:#${request.organismId}`,
              0,
              `evrim atölyesi: ${request.generations} nesil, görülmemiş tohumlarda ${result.holdoutGain >= 0 ? '+' : ''}${result.holdoutGain.toFixed(3)}`,
            );
          }
          applied = true;
        }
        post({
          type: 'evolutionResult',
          organismId: request.organismId,
          applied,
          startScore: result.startScore,
          bestScore: result.bestScore,
          randomBaseline: result.randomBaseline,
          startHoldout: result.startHoldout,
          bestHoldout: result.bestHoldout,
          holdoutGain: result.holdoutGain,
          history: result.history,
          evaluations: result.evaluations,
          spentMs: result.spentMs,
        });
      } catch (err) {
        fail('Evrim atölyesi başarısız', (err as Error).message);
      }
      break;
    }
    case 'runExperiment': {
      post({ type: 'experimentResult', experiment: request.experiment, payload: { queued: true, seed: request.seed } });
      break;
    }
    case 'lifeMap':
      // Takipçi her tick ilerletildiği için bu yalnız arşivin anlık görüntüsü.
      if (!lifeMap || !w) post({ type: 'lifeMapResult', snapshot: EMPTY_LIFE_MAP });
      else post({ type: 'lifeMapResult', snapshot: lifeMap.snapshot() });
      break;
    case 'ping':
      post({ type: 'pong', t: performance.now() });
      break;
    default:
      post({ type: 'ack', seq: seqCounter++, command: 'unknown' });
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    handle(event.data);
  } catch (err) {
    fail('Komut işlenemedi', (err as Error).message);
  }
};
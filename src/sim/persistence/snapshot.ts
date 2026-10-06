/**
 * Cell to Mind — sürümlü dünya anlık görüntüsü (snapshot).
 *
 * Şema sürümlüdür. Kayıt/geri yükleme eşdeğerliği için **her şey** serileştirilir:
 *   - RNG durumları (env / inherit / action ayrı akışlar)
 *   - genomlar, kaynaklar, kaya ve avcı durumu
 *   - organizma kimlik/soy/nesil defterleri
 *   - her organizmanın `thetaInherited` **ve** `thetaLive` ağırlık dizileri
 *   - yörünge tamponları, baseline, önceki gözlem/eylem
 *   - olay ve müdahale sıraları
 *
 * Bozuk kayıt mevcut dünyayı bozmaz: `validateSnapshot` önce çalışır ve
 * hatalar `SnapshotError` ile bildirilir.
 */

import { World, type WorldOptions } from '../world.ts';
import { NeuralPolicy } from '../behavior/policy.ts';
import { MLP_SHAPE } from '../behavior/mlp.ts';
import type {
  Bond,
  Cell,
  Cell as CellType,
  HabitatSettings,
  Intervention,
  Lineage,
  MetricsSample,
  Organism,
  Predator,
  ResourceNode,
  Rock,
  SimEvent,
  TrajectoryStep,
} from '../types.ts';

export const SNAPSHOT_SCHEMA = 'ctm.world.snapshot';
export const SNAPSHOT_VERSION = 1;
/** Dışa/içe aktarım için üst sınır (bayt). Büyük kayıtlar reddedilir. */
export const MAX_SNAPSHOT_BYTES = 12 * 1024 * 1024;
/** Sayısal alanlarda kabul edilen mutlak üst sınır (NaN/Infinity ve çöp koruması). */
const MAX_FINITE = 1e12;

export class SnapshotError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'SnapshotError';
    this.field = field;
  }
}

export interface SnapshotOrganism {
  id: number;
  lineageId: number;
  generation: number;
  birthMode: string;
  bornTick: number;
  parentOrganismId: number | null;
  genome: Organism['genome'];
  cells: number[];
  neural: {
    thetaInherited: number[];
    thetaLive: number[];
    baseline: number;
    prevReward: number;
    prevObs: number[] | null;
    prevAction: number;
    prevLogProb: number;
    prevBaseline: number;
    hasPrev: boolean;
  };
  lifetimeReward: number;
  offspringProduced: number;
  deathCause: string | null;
  alive: boolean;
  completedColonyGenerations: number;
  trajectory: { obs: number[]; action: number; logProb: number; baseline: number; reward: number }[];
  decisionCount: number;
  updateCount: number;
}

export interface WorldSnapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  version: number;
  simVersion: string;
  createdAt: number;
  seed: number;
  tick: number;
  settings: HabitatSettings;
  constraints: World['constraints'];
  rng: { env: number; inherit: number; action: number };
  ledger: { initialTotal: number; externalInput: number; dissipated: number };
  counters: {
    nextCellId: number;
    nextBondId: number;
    nextOrganismId: number;
    nextResourceId: number;
    nextRockId: number;
    nextEventId: number;
    nextInterventionId: number;
  };
  cells: CellType[];
  cellIds: number[];
  bonds: Bond[];
  organisms: SnapshotOrganism[];
  lineages: Lineage[];
  resources: ResourceNode[];
  rocks: Rock[];
  predator: Predator;
  events: SimEvent[];
  metrics: MetricsSample[];
  interventions: Intervention[];
  pending: { energy: [number, number][]; damage: [number, number][]; moveCost: [number, number][] };
}

function num(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SnapshotError(path, `sonlu sayı bekleniyordu, alınan: ${String(value)}`);
  }
  if (Math.abs(value) > MAX_FINITE) {
    throw new SnapshotError(path, `değer sınırı aşıyor: ${value}`);
  }
  return value;
}

/** World → JSON-uyumlu anlık görüntü. */
export function serializeWorld(world: World): WorldSnapshot {
  const organisms: SnapshotOrganism[] = [];
  for (const org of world.organisms.values()) {
    const policy = world.policies.get(org.id);
    const trajectory: TrajectoryStep[] = policy ? [...policy.trajectorySteps()] : [];
    organisms.push({
      id: org.id,
      lineageId: org.lineageId,
      generation: org.generation,
      birthMode: org.birthMode,
      bornTick: org.bornTick,
      parentOrganismId: org.parentOrganismId,
      genome: { ...org.genome },
      cells: [...org.cells],
      neural: {
        thetaInherited: Array.from(org.neural.thetaInherited),
        thetaLive: Array.from(org.neural.thetaLive),
        baseline: org.neural.baseline,
        prevReward: org.neural.prevReward,
        prevObs: org.neural.prevObs ? Array.from(org.neural.prevObs) : null,
        prevAction: org.neural.prevAction,
        prevLogProb: org.neural.prevLogProb,
        prevBaseline: org.neural.prevBaseline,
        hasPrev: org.neural.hasPrev,
      },
      lifetimeReward: org.lifetimeReward,
      offspringProduced: org.offspringProduced,
      deathCause: org.deathCause,
      alive: org.alive,
      completedColonyGenerations: org.completedColonyGenerations,
      trajectory: trajectory.map((s) => ({
        obs: Array.from(s.obs),
        action: s.action,
        logProb: s.logProb,
        baseline: s.baseline,
        reward: s.reward,
      })),
      decisionCount: policy?.decisionCount ?? 0,
      updateCount: policy?.updateCount ?? 0,
    });
  }

  return {
    schema: SNAPSHOT_SCHEMA,
    version: SNAPSHOT_VERSION,
    simVersion: world.version,
    createdAt: Date.now(),
    seed: 0,
    tick: world.tick,
    settings: { ...world.settings, size: { ...world.settings.size } },
    constraints: { ...world.constraints },
    rng: world.rng.getState(),
    ledger: {
      initialTotal: world.ledger.initialTotal,
      externalInput: world.ledger.externalInput,
      dissipated: world.ledger.dissipated,
    },
    counters: {
      nextCellId: world.nextCellIdForSnapshot(),
      nextBondId: world.nextBondIdForSnapshot(),
      nextOrganismId: world.nextOrganismIdForSnapshot(),
      nextResourceId: world.nextResourceIdForSnapshot(),
      nextRockId: world.nextRockIdForSnapshot(),
      nextEventId: world.nextEventIdForSnapshot(),
      nextInterventionId: world.nextInterventionIdForSnapshot(),
    },
    cells: [...world.cells.values()].map((c) => ({ ...c, pos: { ...c.pos }, vel: { ...c.vel }, heading: { ...c.heading }, bonds: [...c.bonds] })),
    cellIds: [...world.cellIds],
    bonds: [...world.bonds.values()].map((b) => ({ ...b })),
    organisms,
    lineages: [...world.lineages.values()].map((l) => ({ ...l, organismIds: [...l.organismIds], meanGenome: { ...l.meanGenome } })),
    resources: world.resources.map((r) => ({ ...r, pos: { ...r.pos } })),
    rocks: world.rocks.map((r) => ({ ...r, pos: { ...r.pos } })),
    predator: { ...world.predator, pos: { ...world.predator.pos }, vel: { ...world.predator.vel } },
    events: world.events.toArray(),
    metrics: world.metricsHistory.toArray(),
    interventions: world.interventions.map((i) => ({ ...i })),
    pending: {
      energy: [...world.pendingEnergySnapshot()],
      damage: [...world.pendingDamageSnapshot()],
      moveCost: [...world.pendingMoveCostSnapshot()],
    },
  };
}

/** Anlık görüntü → World. Doğrulama başarısızsa hiçbir dünya değişmez. */
export function deserializeWorld(snapshot: WorldSnapshot, options: Partial<WorldOptions> = {}): World {
  validateSnapshot(snapshot);
  // Boş bir dünya ile başlayıp alanları geri yüklüyoruz: kurucu kodu çalıştırmadan
  // tam olarak kaydedilmiş duruma ulaşılır.
  const world = World.fromState(snapshot, options);
  return world;
}

/** Şema ve değer doğrulaması. Bozuk kayıtta anlaşılır hata üretir. */
export function validateSnapshot(input: unknown): asserts input is WorldSnapshot {
  const s = input as Partial<WorldSnapshot>;
  if (!s || typeof s !== 'object') throw new SnapshotError('snapshot', 'nesne bekleniyordu');
  if (s.schema !== SNAPSHOT_SCHEMA) {
    throw new SnapshotError('schema', `desteklenmeyen şema: ${String(s.schema)}`);
  }
  if (s.version !== SNAPSHOT_VERSION) {
    throw new SnapshotError('version', `desteklenmeyen sürüm: ${String(s.version)} (beklenen ${SNAPSHOT_VERSION})`);
  }
  num(s.tick, 'tick');
  if (!Array.isArray(s.cells)) throw new SnapshotError('cells', 'dizi bekleniyordu');
  if (!Array.isArray(s.bonds)) throw new SnapshotError('bonds', 'dizi bekleniyordu');
  if (!Array.isArray(s.organisms)) throw new SnapshotError('organisms', 'dizi bekleniyordu');
  if (!Array.isArray(s.resources)) throw new SnapshotError('resources', 'dizi bekleniyordu');

  const bytes = estimateBytes(input);
  if (bytes > MAX_SNAPSHOT_BYTES) {
    throw new SnapshotError('size', `kayıt çok büyük: ${bytes} bayt (sınır ${MAX_SNAPSHOT_BYTES})`);
  }

  for (const org of s.organisms) {
    const p = `organisms[${org?.id}]`;
    num(org.generation, `${p}.generation`);
    if (!Array.isArray(org.neural?.thetaInherited) || org.neural.thetaInherited.length !== MLP_SHAPE.PARAM_COUNT) {
      throw new SnapshotError(`${p}.neural.thetaInherited`, `${MLP_SHAPE.PARAM_COUNT} parametre bekleniyordu`);
    }
    if (!Array.isArray(org.neural?.thetaLive) || org.neural.thetaLive.length !== MLP_SHAPE.PARAM_COUNT) {
      throw new SnapshotError(`${p}.neural.thetaLive`, `${MLP_SHAPE.PARAM_COUNT} parametre bekleniyordu`);
    }
    for (let i = 0; i < org.neural.thetaInherited.length; i++) {
      num(org.neural.thetaInherited[i], `${p}.neural.thetaInherited[${i}]`);
      num(org.neural.thetaLive[i], `${p}.neural.thetaLive[${i}]`);
    }
    if (org.neural.prevObs !== null) {
      if (!Array.isArray(org.neural.prevObs) || org.neural.prevObs.length !== MLP_SHAPE.INPUTS) {
        throw new SnapshotError(`${p}.neural.prevObs`, `${MLP_SHAPE.INPUTS} girdi bekleniyordu`);
      }
    }
    if (org.neural.prevAction < -1 || org.neural.prevAction >= MLP_SHAPE.OUTPUTS) {
      throw new SnapshotError(`${p}.neural.prevAction`, `geçersiz eylem: ${org.neural.prevAction}`);
    }
  }

  for (const cell of s.cells) {
    num(cell.energy, `cells[${cell?.id}].energy`);
    num(cell.pos?.x, `cells[${cell?.id}].pos.x`);
    num(cell.pos?.y, `cells[${cell?.id}].pos.y`);
    num(cell.pos?.z, `cells[${cell?.id}].pos.z`);
  }

  for (const node of s.resources) {
    num(node.reserve, `resources[${node?.id}].reserve`);
    if (node.reserve < 0) throw new SnapshotError(`resources[${node?.id}].reserve`, 'negatif rezerv');
  }
}

/** Yaklaşık bayt boyutu (hızlı ön kontrol). */
export function estimateBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return MAX_SNAPSHOT_BYTES + 1;
  }
}

/** JSON dışa aktarım: sürümlü zarf. */
export function exportJson(snapshot: WorldSnapshot): string {
  const envelope = {
    format: 'ctm.export',
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    world: snapshot,
  };
  return JSON.stringify(envelope, null, 2);
}

/** JSON içe aktarım: zarfı açar ve doğrular. */
export function importJson(text: string): WorldSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new SnapshotError('json', `çözümlenemedi: ${(err as Error).message}`);
  }
  const envelope = parsed as { format?: string; world?: unknown };
  if (envelope?.format !== 'ctm.export' || envelope.world === undefined) {
    // Zarfsız (çıplak snapshot) kayıtları da kabul et.
    validateSnapshot(parsed);
    return parsed;
  }
  validateSnapshot(envelope.world);
  return envelope.world;
}

/** Yardımcı: yeni organizmanın NeuralPolicy'ini snapshot'tan geri kurar. */
export function restorePolicy(snapshot: SnapshotOrganism): NeuralPolicy {
  const theta = Float64Array.from(snapshot.neural.thetaInherited);
  const policy = new NeuralPolicy(theta);
  policy.state.thetaLive = Float64Array.from(snapshot.neural.thetaLive);
  policy.state.baseline = snapshot.neural.baseline;
  policy.state.prevReward = snapshot.neural.prevReward;
  policy.state.prevObs = snapshot.neural.prevObs ? Float64Array.from(snapshot.neural.prevObs) : null;
  policy.state.prevAction = snapshot.neural.prevAction;
  policy.state.prevLogProb = snapshot.neural.prevLogProb;
  policy.state.prevBaseline = snapshot.neural.prevBaseline;
  policy.state.hasPrev = snapshot.neural.hasPrev;
  policy.pushTrajectory(
    snapshot.trajectory.map(
      (t): TrajectoryStep => ({
        obs: Float64Array.from(t.obs),
        action: t.action,
        logProb: t.logProb,
        baseline: t.baseline,
        reward: t.reward,
      }),
    ),
  );
  policy.decisionCount = snapshot.decisionCount;
  policy.updateCount = snapshot.updateCount;
  return policy;
}

export type { Cell, Bond };
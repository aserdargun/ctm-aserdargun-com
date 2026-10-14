/**
 * Cell to Mind — worker protokolü.
 *
 * Simülasyonun tek yazarı Dedicated Web Worker'dır. Ana iş parçacığı yalnızca
 * komut gönderir ve **Float32Array** kare paketlerini alır; React durumuna
 * kare başına hücre yazılmaz.
 */

import type { Genome, SimEvent, Vec3 } from '../sim/types.ts';
import type { LifeSnapshot } from '../sim/lab/lifeMap.ts';

/** Kare paketi başlık uzunluğu (float). */
export const HEADER_FLOATS = 20;
/** Hücre başına float sayısı. */
export const CELL_FLOATS = 12;
/** Kaynak başına float sayısı. */
export const RESOURCE_FLOATS = 7;

// Header indeksleri
export const H = {
  TICK: 0,
  CELL_COUNT: 1,
  RESOURCE_COUNT: 2,
  ROCK_COUNT: 3,
  SIM_TIME: 4,
  PREDATOR_ACTIVE: 5,
  PREDATOR_X: 6,
  PREDATOR_Y: 7,
  PREDATOR_Z: 8,
  PREDATOR_RADIUS: 9,
  PREDATOR_ENERGY: 10,
  LIGHT: 11,
  SYSTEM_ENERGY: 12,
  EXTERNAL_INPUT: 13,
  DISSIPATED: 14,
  POPULATION: 15,
  /** Enerji muhasebesi başlangıç bakiyesi (korunum değişmezi için ZORUNLU). */
  INITIAL_ENERGY: 16,
  LARGEST_COLONY: 17,
  COLONIES_FOUR: 18,
  BOND_COUNT: 19,
} as const;

// Hücre alanı ofsetleri
export const CELL = {
  X: 0,
  Y: 1,
  Z: 2,
  RADIUS: 3,
  ENERGY_NORM: 4,
  DAMAGE: 5,
  HEADING_X: 6,
  HEADING_Y: 7,
  HEADING_Z: 8,
  ORGANISM: 9,
  AGE_NORM: 10,
  FLAGS: 11,
} as const;

// Kaynak alanı ofsetleri
export const RES = {
  KIND: 0, // 0 = A, 1 = B
  X: 1,
  Y: 2,
  Z: 3,
  RESERVE_FRAC: 4,
  RADIUS: 5,
  ID: 6,
} as const;

export type SpeedMultiplier = 1 | 2 | 4;

export interface RockSeed {
  id: number;
  pos: Vec3;
  radius: number;
  variant: number;
}

export interface InitCommand {
  type: 'init';
  seed: number;
  preset: string;
  population: number;
  learningEnabled: boolean;
  selectionPressure: number;
}

export type Command =
  | InitCommand
  | { type: 'setRunning'; running: boolean }
  | { type: 'setSpeed'; speed: SpeedMultiplier }
  | { type: 'setSetting'; key: 'light' | 'currentStrength' | 'selectionPressure'; value: number }
  | { type: 'setLearning'; enabled: boolean }
  | { type: 'addNutrient'; kind: 'A' | 'B'; amount: number }
  | { type: 'revivePredator'; energy: number }
  | { type: 'select'; organismId: number | null }
  | { type: 'requestDecision'; organismId: number }
  | { type: 'snapshot'; reason: string }
  | { type: 'load'; snapshotJson: string; label: string }
  | { type: 'branch'; name: string }
  | { type: 'listOrganisms' }
  | { type: 'listLineages' }
  | { type: 'listEvents'; count: number }
  | { type: 'evidencePack'; question: string; kind: 'A' | 'B'; organismId: number | null }
  | { type: 'runExperiment'; experiment: string; seed: number }
  /**
   * Evrim Atölyesi: seçili organizmanın politikasını arena üzerinde (μ+λ)
   * aramayla iyileştirir. Canlı dünyayı **değiştirmez**; arama ayrı arena
   * koşularında yapılır (bkz. `docs/VALIDATION.md` §6.14–6.15).
   */
  | {
      type: 'evolve';
      organismId: number;
      generations: number;
      population: number;
      offspring: number;
      /** true ise kazanan politika organizmanın ağırlıklarına yazılır. */
      apply: boolean;
    }
  | { type: 'lifeMap' }
  | { type: 'ping' };

export interface OrganismSummary {
  id: number;
  lineageId: number;
  generation: number;
  birthMode: string;
  cellCount: number;
  totalEnergy: number;
  meanEnergyNorm: number;
  // ⚠️ Bu dört alan `Record<string, number>` idi. Gevşek tip, worker sınırında
  // eksik bir genom parametresinin **sessizce** taşınmasına izin veriyordu;
  // panel `labels[k] ?? k` yüzünden eksik satırı ham anahtarla gösterirdi.
  // `Genome` ile bir eksik parametre artık derleme hatasıdır.
  genome: Genome;
  alive: boolean;
  diedAtTick?: number;
  deathCause?: string | null;
  parentOrganismId: number | null;
  offspring: number;
  learningUpdates: number;
  baseline: number;
  learnedDelta: number;
  centroid: Vec3;
}

export interface LineageSummary {
  id: number;
  label: string;
  founderOrganismId: number;
  founderTick: number;
  organismCount: number;
  aliveCount: number;
  maxGeneration: number;
  meanGenome: Genome;
  ancestorGenome: Genome;
  generations: { generation: number; organismId: number; genome: Genome; tick: number }[];
}

export interface DecisionSnapshot {
  organismId: number;
  tick: number;
  obs: number[];
  inputLabels: string[];
  hidden: number[];
  logits: number[];
  probs: number[];
  action: number;
  actionName: string;
  greedyAction: number;
  logProb: number;
  baseline: number;
  reward: number;
  thetaInherited: number[];
  thetaLive: number[];
  learnedDelta: number;
  trajectoryLength: number;
  updateCount: number;
  decisionCount: number;
  /** W1 satır indeksleri: [gizli birim][girdi]. */
  w1Layout: 'hidden x input';
}

export interface EvidencePack {
  worldId: string;
  simVersion: string;
  tickIntervalMs: number;
  tick: number;
  simTimeSeconds: number;
  question: string;
  language: string;
  eventIds: number[];
  events: unknown[];
  measurements: { metricRef: string; value: number; unit: string }[];
  interventions: unknown[];
  lineage: unknown;
  networkSummary: unknown;
  imageHint: { tick: number; simTimeSeconds: number; camera: string } | null;
  constraints: string[];
  notMeasured: string[];
}

export type WorkerRequest = Command & { seq?: number; id?: string };

export type WorkerResponse =
  | { type: 'ready'; simVersion: string; habitat: { size: Vec3 }; rocks: RockSeed[]; snapshotVersion: number }
  | { type: 'frame'; buffer: ArrayBuffer; seq: number; measuredSpeed: number; running: boolean }
  | { type: 'organisms'; organisms: OrganismSummary[]; tick: number }
  | { type: 'lineages'; lineages: LineageSummary[] }
  | { type: 'events'; events: SimEvent[]; totalKnown: number }
  | { type: 'decision'; decision: DecisionSnapshot }
  | { type: 'snapshot'; snapshotJson: string; tick: number; bytes: number }
  | { type: 'evidence'; pack: EvidencePack }
  | { type: 'experimentResult'; experiment: string; payload: unknown }
  | { type: 'evolutionProgress'; generation: number; total: number; best: number; mean: number }
  /**
   * Yaşam haritası (Picbreeder ızgarası): üç ölçülebilir betimleyici üzerinden
   * hangi davranış nişlerinin işgal edildiğini gösterir. Yalnız **ölçüm** —
   * seçilim `ε = 0` varsayılandadır ve canlı dünyayı değiştirmez.
   */
  | { type: 'lifeMapResult'; snapshot: LifeSnapshot }
  | {
      type: 'evolutionResult';
      organismId: number;
      applied: boolean;
      startScore: number;
      bestScore: number;
      randomBaseline: number;
      startHoldout: number;
      bestHoldout: number;
      holdoutGain: number;
      history: number[];
      evaluations: number;
      spentMs: number;
    }
  | { type: 'ack'; seq: number; command: string }
  | { type: 'error'; message: string; detail?: string; fatal: boolean }
  | { type: 'pong'; t: number };

/** Kare paketini okunabilir nesneye çevirir (yalnız seçili organizma için kullanılır). */
export function readFrame(data: Float32Array): {
  tick: number;
  simTime: number;
  population: number;
  systemEnergy: number;
  externalInput: number;
  dissipated: number;
  initialEnergy: number;
  largestColony: number;
  coloniesFour: number;
  bondCount: number;
  light: number;
  predator: { active: boolean; pos: Vec3; radius: number; energy: number };
} {
  return {
    tick: data[H.TICK] as number,
    simTime: data[H.SIM_TIME] as number,
    population: data[H.POPULATION] as number,
    systemEnergy: data[H.SYSTEM_ENERGY] as number,
    externalInput: data[H.EXTERNAL_INPUT] as number,
    dissipated: data[H.DISSIPATED] as number,
    initialEnergy: data[H.INITIAL_ENERGY] as number,
    largestColony: data[H.LARGEST_COLONY] as number,
    coloniesFour: data[H.COLONIES_FOUR] as number,
    bondCount: data[H.BOND_COUNT] as number,
    light: data[H.LIGHT] as number,
    predator: {
      active: (data[H.PREDATOR_ACTIVE] as number) > 0.5,
      pos: { x: data[H.PREDATOR_X] as number, y: data[H.PREDATOR_Y] as number, z: data[H.PREDATOR_Z] as number },
      radius: data[H.PREDATOR_RADIUS] as number,
      energy: data[H.PREDATOR_ENERGY] as number,
    },
  };
}
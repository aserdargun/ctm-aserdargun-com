/**
 * Cell to Mind — algı (perception): 12 girdili gözlem vektörü.
 *
 * Kurallar:
 *  - Kaynağın "faydalı/zararlı" gizli etiketi girdi DEĞİLDİR. Organizma yalnız
 *    kaynağın **yerel ağırlık sinyalini** (rezerv doluluğu ve mesafe) görür.
 *  - Dünya koordinatları girdi DEĞİLDİR; algı yarıçapıyla sınırlı yerel birim
 *    vektörler kullanılır.
 *  - Gözlemci (observer) modelinin sahip olduğu bilgi organizmaya SIZMAZ.
 */

import { C } from '../biology/energy.ts';
import type { Genome, ResourceNode, Vec3 } from '../types.ts';
import { MLP_SHAPE } from './mlp.ts';

export interface ObservationContext {
  /** Hücrenin normalize enerjisi (0..1). */
  energyNorm: number;
  /** Organizmanın normalize hücre sayısı (0..1). */
  sizeNorm: number;
  genome: Genome;
  /** Hücre konumu. */
  pos: Vec3;
  /** Algı yarıçapı (mb) — genomden. */
  senseRadius: number;
  /** Yakındaki kaynak düğümleri (tüm dünya değil, ızgaradan gelen adaylar). */
  nearbyResources: readonly ResourceNode[];
  /** Yakındaki avcı konumu (yoksa null). */
  predator: { pos: Vec3; radius: number } | null;
  /** Yerel seçilim baskısı (avcı yoksa 0). */
  selectionPressure: number;
  /** Önceki kararın ölçeklenmiş ödülü. */
  prevReward: number;
}

/** Kaynağın yerel gradyanını (birim vektör + ağırlık) hesaplar. */
export function localResourceGradient(
  ctx: ObservationContext,
  kind: 'A' | 'B',
): { x: number; y: number; z: number } {
  let ax = 0;
  let ay = 0;
  let az = 0;
  const tolerance = kind === 'A' ? ctx.genome.toleranceA : ctx.genome.toleranceB;
  if (tolerance <= 0) return { x: 0, y: 0, z: 0 };

  for (const node of ctx.nearbyResources) {
    if (node.kind !== kind || node.reserve <= 1e-9) continue;
    const dx = node.pos.x - ctx.pos.x;
    const dy = node.pos.y - ctx.pos.y;
    const dz = node.pos.z - ctx.pos.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > ctx.senseRadius || d < 1e-9) continue;
    // Yakınlık azalan ağırlık × rezerv doluluğunun karekökü.
    const proximity = 1 - d / ctx.senseRadius;
    const fullness = Math.sqrt(Math.max(0, Math.min(1, node.reserve / node.capacity)));
    const w = proximity * fullness * tolerance;
    ax += (dx / d) * w;
    ay += (dy / d) * w;
    az += (dz / d) * w;
  }

  const mag = Math.sqrt(ax * ax + ay * ay + az * az);
  if (mag > 1) {
    const inv = 1 / mag;
    ax *= inv;
    ay *= inv;
    az *= inv;
  }
  return { x: ax, y: ay, z: az };
}

/** Kaynakla temas ediliyor mu (0/1). */
export function contactFlag(ctx: ObservationContext, kind: 'A' | 'B'): number {
  for (const node of ctx.nearbyResources) {
    if (node.kind !== kind || node.reserve <= 1e-9) continue;
    const reach = C.BASE_RADIUS + node.radius;
    const dx = node.pos.x - ctx.pos.x;
    const dy = node.pos.y - ctx.pos.y;
    const dz = node.pos.z - ctx.pos.z;
    if (dx * dx + dy * dy + dz * dz < reach * reach) return 1;
  }
  return 0;
}

/** Yerel seçilim baskısı: avcı algı yarıçapı içindeyse 0..1. */
export function localSelectionPressure(ctx: ObservationContext): number {
  if (!ctx.predator || ctx.selectionPressure <= 0) return 0;
  const dx = ctx.predator.pos.x - ctx.pos.x;
  const dy = ctx.predator.pos.y - ctx.pos.y;
  const dz = ctx.predator.pos.z - ctx.pos.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const reach = ctx.senseRadius + ctx.predator.radius;
  if (d > reach) return 0;
  const proximity = 1 - d / Math.max(1e-6, reach);
  return Math.max(0, Math.min(1, proximity * ctx.selectionPressure));
}

/** 12 boyutlu gözlem vektörünü üretir. */
export function computeObservation(ctx: ObservationContext): Float64Array {
  const obs = new Float64Array(MLP_SHAPE.INPUTS);
  const gA = localResourceGradient(ctx, 'A');
  const gB = localResourceGradient(ctx, 'B');

  obs[0] = clamp01(ctx.energyNorm);
  obs[1] = clamp01(ctx.sizeNorm);
  obs[2] = gA.x;
  obs[3] = gA.y;
  obs[4] = gA.z;
  obs[5] = gB.x;
  obs[6] = gB.y;
  obs[7] = gB.z;
  obs[8] = localSelectionPressure(ctx);
  obs[9] = Math.max(-1, Math.min(1, ctx.prevReward));
  obs[10] = contactFlag(ctx, 'A');
  obs[11] = contactFlag(ctx, 'B');

  return obs;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Girdi adları — mikroskop ve gözlemci kanıtı için. */
export const INPUT_LABELS: readonly string[] = [
  'normalizeEnerji',
  'normalizeHucreSayisi',
  'kaynakA_gradyan_x',
  'kaynakA_gradyan_y',
  'kaynakA_gradyan_z',
  'kaynakB_gradyan_x',
  'kaynakB_gradyan_y',
  'kaynakB_gradyan_z',
  'yerelSecilimBaskisi',
  'oncekiOdul',
  'kaynakA_temas',
  'kaynakB_temas',
];
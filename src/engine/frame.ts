/**
 * Cell to Mind — kare paylaşımı.
 *
 * Worker'dan gelen `Float32Array` tek bir yer tutucuda saklanır; sahne
 * bileşenleri `useFrame` içinde okur. React durumu KARE BAŞINA GÜNCELLENMEZ.
 */

import { CELL, CELL_FLOATS, H, HEADER_FLOATS, RES, RESOURCE_FLOATS } from '../worker/protocol.ts';

export interface FrameView {
  tick: number;
  simTime: number;
  population: number;
  systemEnergy: number;
  externalInput: number;
  dissipated: number;
  light: number;
  predatorActive: boolean;
  predatorEnergy: number;
  predatorPos: { x: number; y: number; z: number };
  predatorRadius: number;
  cellCount: number;
  resourceCount: number;
  cellBase: number;
  resourceBase: number;
}

let buffer: Float32Array | null = null;

export function setFrame(data: Float32Array): void {
  buffer = data;
}

export function hasFrame(): boolean {
  return buffer !== null;
}

/** Son kareye erişim. Kare yoksa null döner. */
export function getFrame(): Float32Array | null {
  return buffer;
}

export function readView(data: Float32Array): FrameView {
  const cellCount = data[H.CELL_COUNT] as number;
  return {
    tick: data[H.TICK] as number,
    simTime: data[H.SIM_TIME] as number,
    population: data[H.POPULATION] as number,
    systemEnergy: data[H.SYSTEM_ENERGY] as number,
    externalInput: data[H.EXTERNAL_INPUT] as number,
    dissipated: data[H.DISSIPATED] as number,
    light: data[H.LIGHT] as number,
    predatorActive: (data[H.PREDATOR_ACTIVE] as number) > 0.5,
    predatorEnergy: data[H.PREDATOR_ENERGY] as number,
    predatorPos: {
      x: data[H.PREDATOR_X] as number,
      y: data[H.PREDATOR_Y] as number,
      z: data[H.PREDATOR_Z] as number,
    },
    predatorRadius: data[H.PREDATOR_RADIUS] as number,
    cellCount,
    resourceCount: data[H.RESOURCE_COUNT] as number,
    cellBase: HEADER_FLOATS,
    resourceBase: HEADER_FLOATS + cellCount * CELL_FLOATS,
  };
}

export function cellOffset(index: number): number {
  return HEADER_FLOATS + index * CELL_FLOATS;
}

export function resourceOffset(index: number): number {
  return buffer === null
    ? 0
    : HEADER_FLOATS + (buffer[H.CELL_COUNT] as number) * CELL_FLOATS + index * RESOURCE_FLOATS;
}

export { CELL, RES, CELL_FLOATS, RESOURCE_FLOATS };
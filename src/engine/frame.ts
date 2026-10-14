/**
 * Cell to Mind — kare paylaşımı.
 *
 * Worker'dan gelen `Float32Array` tek bir yer tutucuda saklanır; sahne
 * bileşenleri `useFrame` içinde okur. React durumu KARE BAŞINA GÜNCELLENMEZ.
 */

import { CELL, CELL_FLOATS, RES, RESOURCE_FLOATS } from '../worker/protocol.ts';

let buffer: Float32Array | null = null;

export function setFrame(data: Float32Array): void {
  buffer = data;
}

/** Son kareye erişim. Kare yoksa null döner. */
export function getFrame(): Float32Array | null {
  return buffer;
}

export { CELL, RES, CELL_FLOATS, RESOURCE_FLOATS };
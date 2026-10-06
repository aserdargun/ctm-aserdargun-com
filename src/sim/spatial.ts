/**
 * Cell to Mind — uzamsal indeks (uniform grid hash).
 *
 * Komşu aramaları (yapışma, avcı tespiti, beslenme teması) hücre sayısıyla
 * doğrusal olmamalıdır. Izgara, her tick bir kez hücre konumlarından yeniden
 * kurulur; sorgular yalnızca 27 komşu hücreyi tarar.
 */

import type { Vec3 } from './types.ts';

export class SpatialGrid {
  private readonly cellSize: number;
  private readonly inv: number;
  private readonly nx: number;
  private readonly ny: number;
  private readonly nz: number;
  private readonly buckets: Map<number, number[]> = new Map();
  private readonly size: Vec3;

  constructor(size: Vec3, cellSize: number) {
    this.size = size;
    this.cellSize = cellSize;
    this.inv = 1 / cellSize;
    this.nx = Math.max(1, Math.ceil(size.x / cellSize));
    this.ny = Math.max(1, Math.ceil(size.y / cellSize));
    this.nz = Math.max(1, Math.ceil(size.z / cellSize));
  }

  private indexOf(pos: Vec3): number {
    const ix = Math.min(this.nx - 1, Math.max(0, Math.floor(pos.x * this.inv)));
    const iy = Math.min(this.ny - 1, Math.max(0, Math.floor(pos.y * this.inv)));
    const iz = Math.min(this.nz - 1, Math.max(0, Math.floor(pos.z * this.inv)));
    return (iz * this.ny + iy) * this.nx + ix;
  }

  /** Izgarayı verilen konumlarla yeniden kurar. */
  rebuild(positions: readonly Vec3[]): void {
    this.buckets.clear();
    for (let i = 0; i < positions.length; i++) {
      const key = this.indexOf(positions[i] as Vec3);
      const bucket = this.buckets.get(key);
      if (bucket) bucket.push(i);
      else this.buckets.set(key, [i]);
    }
  }

  /**
   * Verilen merkeze `radius` uzaklıktaki tüm nokta indekslerini toplar.
   * Sonuç kovalama kutusunun indeksleridir; kesin mesafe filtresi çağıranın
   * sorumluluğundadır (böylece farklı yarıçaplı hücreler için tek tarama yeter).
   */
  queryRadius(center: Vec3, radius: number): number[] {
    const r = Math.max(1, Math.ceil(radius / this.cellSize));
    const ix = Math.min(this.nx - 1, Math.max(0, Math.floor(center.x * this.inv)));
    const iy = Math.min(this.ny - 1, Math.max(0, Math.floor(center.y * this.inv)));
    const iz = Math.min(this.nz - 1, Math.max(0, Math.floor(center.z * this.inv)));
    const out: number[] = [];
    for (let dz = -r; dz <= r; dz++) {
      const cz = iz + dz;
      if (cz < 0 || cz >= this.nz) continue;
      for (let dy = -r; dy <= r; dy++) {
        const cy = iy + dy;
        if (cy < 0 || cy >= this.ny) continue;
        for (let dx = -r; dx <= r; dx++) {
          const cx = ix + dx;
          if (cx < 0 || cx >= this.nx) continue;
          const bucket = this.buckets.get((cz * this.ny + cy) * this.nx + cx);
          if (bucket) out.push(...bucket);
        }
      }
    }
    return out;
  }

  /** Sınırların dışına çıkan konumu içeriye alır (kapalı habitat). */
  clamp(pos: Vec3): void {
    const r = 0.05;
    if (pos.x < r) pos.x = r;
    if (pos.y < r) pos.y = r;
    if (pos.z < r) pos.z = r;
    if (pos.x > this.size.x - r) pos.x = this.size.x - r;
    if (pos.y > this.size.y - r) pos.y = this.size.y - r;
    if (pos.z > this.size.z - r) pos.z = this.size.z - r;
  }

  bounds(): { min: Vec3; max: Vec3 } {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { ...this.size },
    };
  }
}

/** Önceden hesaplanmış karesel mesafe. */
export function dist2(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt(dist2(a, b));
}
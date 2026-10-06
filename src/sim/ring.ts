/**
 * Cell to Mind — sabit boyutlu halk tampon (ring buffer).
 * Olay geçmişi ve ölçüm geçmişi sınırsız büyüyemez (bellek dayanıklılığı).
 */
export class RingBuffer<T> {
  private items: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    if (capacity <= 0) throw new Error('RingBuffer kapasitesi pozitif olmalı');
    this.items = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    this.items[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  get size(): number {
    return this.count;
  }

  /** En yeni öğe. */
  last(): T | undefined {
    if (this.count === 0) return undefined;
    return this.items[(this.head - 1 + this.capacity) % this.capacity];
  }

  /** En eski → en yeni sırasıyla kopyalar. */
  toArray(): T[] {
    const out: T[] = [];
    const start = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) out.push(this.items[(start + i) % this.capacity] as T);
    return out;
  }

  /** En yeni `n` öğe (en eskiden en yeniye). */
  recent(n: number): T[] {
    const take = Math.min(n, this.count);
    const out: T[] = [];
    const start = (this.head - take + this.capacity) % this.capacity;
    for (let i = 0; i < take; i++) out.push(this.items[(start + i) % this.capacity] as T);
    return out;
  }

  clear(): void {
    this.items = new Array<T | undefined>(this.capacity);
    this.head = 0;
    this.count = 0;
  }

  set(contents: readonly T[]): void {
    this.clear();
    for (const item of contents) this.push(item);
  }
}

/** Deterministik tamsal karma → [-1, 1]. RNG akışı tüketmez. */
export function hashNoise(a: number, b: number, c: number): number {
  let h = (Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 2147483648 - 1;
}
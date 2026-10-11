/**
 * Cell to Mind — tohumlu (seeded) rastgele sayı üretimi.
 *
 * Tasarım kararı: simülasyonun üç ayrı rastgele akışı vardır
 * (`env`, `inherit`, `action`) ve bunlar ayrı tohumlanır. Böylece A/B deney
 * dallarında farklı politikaların rastgele sayı tüketimi hava ya da kaynak
 * olaylarını kaydıramaz.
 *
 * `normal()` bilinçli olarak Box–Muller değil, Irwin–Hall (12 üniform toplamı
 * eksi 6) kullanır: yalnızca toplama ve çarpma içerir, dolayısıyla `Math.log`
 * veya `Math.cos` gibi motora/kütüphaneye bağlı transcendentaller yoktur. Bu,
 * determinizmi güçlendirir (aynı JS motorunda bit düzeyinde aynı sonuç).
 */

export type StreamName = 'env' | 'inherit' | 'action' | 'evolve';

/** mulberry32 — hızlı, 32-bit durumlu, test tohumlarında iyi davranışlı PRNG. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    // Tohumu uint32 aralığına indirger.
    this.s = seed >>> 0;
  }

  /** Ham uint32. */
  nextUint32(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** [0, 1) aralığında ondalık. */
  float(): number {
    return this.nextUint32() / 4294967296;
  }

  /** [min, max) aralığında ondalak. */
  range(min: number, max: number): number {
    return min + this.float() * (max - min);
  }

  /** 0..n-1 arasında tam sayı. */
  int(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.float() * n) % n;
  }

  /**
   * Yaklaşık standart normal (Irwin–Hall, k=12).
   * Ortalama 0, varyans 1; kuyrukları gerçek Gauss dağılımından daha hafif.
   * Mutasyon, ödül gürültüsü ve gözlem jitte'ı için yeterlidir.
   */
  normal(): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += this.float();
    return sum - 6;
  }

  /** Standart normalı `scale` ile ölçekler. */
  normalScaled(scale: number): number {
    return this.normal() * scale;
  }

  /** Diziden bir eleman seçer. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)] as T;
  }

  /** Durumu dışa aktarır (kayıt/geri yükleme için). */
  getState(): number {
    return this.s >>> 0;
  }

  /** Durumu geri yükler. */
  setState(state: number): void {
    this.s = state >>> 0;
  }

  /** Türetilmiş akış: ana tohumu karıştırır. */
  fork(salt: number): Rng {
    const mixed = (Math.imul(this.s ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35)) >>> 0;
    return new Rng(mixed);
  }
}

/**
 * Üç bağımsız akışı bir arada tutan kapsayıcı. Tohum tek bir sayıdan türetilir.
 */
export class RngBundle {
  readonly env: Rng;
  readonly inherit: Rng;
  readonly action: Rng;
  /**
   * Üstel arama pertürbasyonları (S-4). Ayrı akış olması **şarttır**: ES
   * gürültüsü dünyanın kendi rastgeleliğini kaydırırsa, çatallanan dünyalar
   * yanlış sebeple farklılaşır ve ölçüm anlamını yitirir.
   */
  readonly evolve: Rng;

  constructor(seed: number) {
    const base = seed >>> 0;
    this.env = new Rng((base ^ 0x243f6a88) >>> 0);
    this.inherit = new Rng((base ^ 0xb7e15162) >>> 0);
    this.action = new Rng((base ^ 0xdeadbeef) >>> 0);
    this.evolve = new Rng((base ^ 0x165667b1) >>> 0);
  }

  stream(name: StreamName): Rng {
    return this[name];
  }

  getState(): { env: number; inherit: number; action: number; evolve: number } {
    return {
      env: this.env.getState(),
      inherit: this.inherit.getState(),
      action: this.action.getState(),
      evolve: this.evolve.getState(),
    };
  }

  setState(state: { env: number; inherit: number; action: number; evolve?: number }): void {
    this.env.setState(state.env);
    this.inherit.setState(state.inherit);
    this.action.setState(state.action);
    // Eski snapshot'lar `evolve` taşımaz; o durumda akış başlangıçta kalır.
    if (state.evolve !== undefined) this.evolve.setState(state.evolve);
  }
}
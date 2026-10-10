/**
 * Cell to Mind — deney istatistiği.
 *
 * Bu modül, `docs/ROADMAP.md` Faz A2'nin çekirdeğidir. Tasarım kararı:
 *
 * **Nokta tahmin ve eşik testi yoktur.** Raporlanan her şey bir aralıktır.
 *
 * Gerekçe (literatür, `docs/LITERATURE.md` §5):
 *  - Henderson vd. (2018) ve Agarwal vd. (NeurIPS 2021): derin RL sonuçları
 *    tohumlar arası yayılır; "en iyi koşu" seçmek yaygın bir hatadır ve
 *    nokta tahminleri güven aralığı olmadan anlamsızdır.
 *  - JMLR 2024 (Empirical Design in RL): **tohum bir hiperparametre değildir.**
 *    Bu yüzden burada hiçbir "en iyi yapılandırma seçme" adımı yoktur; her
 *    koşu rapora girer.
 *  - Eşik ("15/20 tohumda geçti") Goodhart tuzağıdır: başarı ile şans
 *    ayrılamaz. Bunun yerine **farkın** güven aralığı raporlanır.
 *
 * Bağımlılık politikası: **harici istatistik kütüphanesi yoktur.** Bootstrap
 * tohumlu `Rng` ile yapılır, dolayısıyla her koşu bit düzeyinde tekrarlanabilir.
 * Bu, `src/sim/` altındaki tüm kodla aynı determinizm kuralını paylaşır.
 *
 * T-DİSTRIBÜSYONU YOK: t-dağılımının kuyruk olasılıkları için gereken
 * tamamlanmamış beta fonksiyonu elle yazılmaz. Bunun yerine **bootstrap
 * hipotez testi** kullanılır: veriler 0 etrafında merkezlenerek gözlenen
 * farkın şansa karşı ne kadar olağandışı olduğu doğrudan ölçülür. Bu,
 * parametrik varsayım gerektirmez ve n=20 gibi küçük örneklemlerde t-testine
 * göre daha güvenlidir.
 */

import { Rng } from './rng.ts';

// ------------------------------------------------------------------ temel

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Örneklem standart sapması (n-1 paylı). n < 2 ise NaN. */
export function stdDev(values: readonly number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  let acc = 0;
  for (const v of values) {
    const d = v - m;
    acc += d * d;
  }
  return Math.sqrt(acc / (values.length - 1));
}

export function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

/**
 * Çeyreklikler arası ortalama (IQM).
 *
 * Agarwal vd. (2021) ortalama ve medyanın ikisini de kuyruk duyarlı bulur ve
 * IQM'yi önerir. IQM medyandan daha verimli, ortalamadan daha dayanıklıdır.
 */
export function iqm(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const q1 = quantileSorted(s, 0.25);
  const q3 = quantileSorted(s, 0.75);
  const mid = s.filter((v) => v >= q1 && v <= q3);
  return mid.length > 0 ? mean(mid) : median(s);
}

/** Doğrusal interpolasyonlu kuantil (tür 7). Girdi kopyalanır/sıralanır. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  return quantileSorted([...values].sort((a, b) => a - b), q);
}

function quantileSorted(sorted: readonly number[], q: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0] as number;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo] as number;
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (pos - lo);
}

// ------------------------------------------------------------------ bootstrap

export interface Interval {
  /** Nokta tahmin (bu hâlâ raporlanır, ama tek başına anlam taşımaz). */
  estimate: number;
  /** Alt sınır. */
  lower: number;
  /** Üst sınır. */
  upper: number;
  /** Güven düzeyi (0.95 gibi). */
  level: number;
}

export interface BootstrapOptions {
  /** Yeniden örnekleme sayısı. Varsayılan 10.000. */
  resamples?: number;
  /** Güven düzeyi. Varsayılan 0.95. */
  level?: number;
  /** Tohum — aynı tohum aynı sonucu verir. */
  seed?: number;
  /** İstatistik. Varsayılan `mean`. */
  statistic?: (values: readonly number[]) => number;
}

const DEFAULT_RESAMPLES = 10_000;
const DEFAULT_LEVEL = 0.95;

/**
 * Yüzdelik bootstrap güven aralığı.
 *
 * **Eşleştirilmiş tasarımda doğru kullanım:** Eşleştirilmiş bir deneyde
 * bootstrap birimı *farktır*, ham koşuların ortalaması değil. Yani
 * `bootstrapCI(differences)` çağrılır; `bootstrapCI(a)` ve `bootstrapCI(b)`
 * ayrı ayrı çağrılıp karşılaştırılmaz. Bu, koşular arası ortak varyansı
 * doğru biçimde iptal eder.
 *
 * **Ayrıklık uyarısı:** Yüzdelik bootstrap aralığı *ayrık* bir nesnedir.
 * Küçük örneklemde (n ≲ 12) 2.5. yüzdelik çoğu zaman aynı ayrık değere
 * düşer ve iki farklı tohum **aynı** aralığı üretebilir. Bu bir hata değildir;
 * raporlanan aralığın kesinliği örneklem büyüklüğüyle sınırlıdır.
 */
export function bootstrapCI(values: readonly number[], options: BootstrapOptions = {}): Interval {
  const resamples = options.resamples ?? DEFAULT_RESAMPLES;
  const level = options.level ?? DEFAULT_LEVEL;
  const stat = options.statistic ?? mean;
  const rng = new Rng(options.seed ?? 1);

  if (values.length === 0) {
    return { estimate: Number.NaN, lower: Number.NaN, upper: Number.NaN, level };
  }
  // Tek koşuda bootstrap anlamlı değildir; aralık nokta tahminle aynıdır ve
  // bu durum **rapor edilebilir** olmalıdır, gizlenmemelidir.
  if (values.length === 1) {
    const only = stat(values);
    return { estimate: only, lower: only, upper: only, level };
  }

  const n = values.length;
  const draws: number[] = new Array(resamples);
  const idx = new Array<number>(n);
  for (let b = 0; b < resamples; b++) {
    for (let i = 0; i < n; i++) idx[i] = rng.int(n);
    const sample = new Array<number>(n);
    for (let i = 0; i < n; i++) sample[i] = values[idx[i] as number] as number;
    draws[b] = stat(sample) as number;
  }
  draws.sort((a, c) => a - c);

  const alpha = 1 - level;
  return {
    estimate: stat(values),
    lower: quantileSorted(draws, alpha / 2),
    upper: quantileSorted(draws, 1 - alpha / 2),
    level,
  };
}

// ------------------------------------------------------------ hipotez testi

export interface HypothesisTest {
  /** Gözlenen ortalama fark. */
  observed: number;
  /**
   * Merkezlenmiş bootstrap p-değeri.
   *
   * Yorum: H0 ("gerçek fark sıfırdır") altında gözlenen farkın **bu kadar
   * ya da daha büyük** mutlak değerinin olasılığı. Küçükse gözlenen fark
   * şansa açıklanamaz.
   */
  pValue: number;
  /** İki taraflı. */
  twoSided: boolean;
  /** Bootstrap sırasında farkın > 0 çıktığı pay (tek taraflı iyileşme olasılığı). */
  probabilityOfImprovement: number;
  resamples: number;
}

/**
 * Bootstrap hipotez testi — parametrik varsayım yok.
 *
 * Yöntem: veriler gözlenen ortalama kadar kaydırılır (H0 altında fark sıfırdır),
 * bu merkezlenmiş veriden çok sayıda yeniden örnekleme yapılır ve sıfırı aşan
 * mutlak değerlerin oranı p-değeri olarak alınır.
 *
 * p < 0.05 ise "farkın sıfır olması makul değil" demektir.
 * p < 0.05 **olmadığı** hâlde bulgu yoktur; bu modül "anlamlı değil" ile
 * "etkisiz" ayrımını yapmaya çalışmaz (Agarwal vd. 2021 uyarısı).
 * Etkisizlik kanıtı için ek olarak `meanDifferenceInterval` raporlanmalıdır.
 *
 * **İki ayrı yeniden örnekleme geçişi yapılır.** `probabilityOfImprovement`
 * merkezlenmemiş veriden hesaplanır; merkezlenmiş veriden hesaplanırsa her
 * zaman ≈ 0.5 döner ve hiçbir bilgi taşımaz.
 */
export function bootstrapTest(
  differences: readonly number[],
  options: { resamples?: number; seed?: number; twoSided?: boolean } = {},
): HypothesisTest {
  const resamples = options.resamples ?? DEFAULT_RESAMPLES;
  const twoSided = options.twoSided ?? true;
  const rng = new Rng(options.seed ?? 7);
  const observed = mean(differences);

  if (differences.length < 2) {
    return {
      observed,
      pValue: Number.NaN,
      twoSided,
      probabilityOfImprovement: Number.NaN,
      resamples,
    };
  }

  const n = differences.length;
  // H0 altındaki veri: gözlenen fark kadar geriye kaydırılmış.
  const centered = differences.map((d) => d - observed);
  let exceed = 0;
  let positive = 0;

  const idx = new Array<number>(n);

  // Geçiş 1 — p-değeri: H0 altında (merkezlenmiş).
  for (let b = 0; b < resamples; b++) {
    for (let i = 0; i < n; i++) idx[i] = rng.int(n);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += centered[idx[i] as number] as number;
    const m = sum / n;
    if (twoSided ? Math.abs(m) >= Math.abs(observed) : m >= observed) exceed++;
  }

  // Geçiş 2 — iyileşme olasılığı: gözlenen veriden (merkezlenmemiş).
  for (let b = 0; b < resamples; b++) {
    for (let i = 0; i < n; i++) idx[i] = rng.int(n);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += differences[idx[i] as number] as number;
    if (sum / n > 0) positive++;
  }

  return {
    observed,
    pValue: (exceed + 1) / (resamples + 1),
    twoSided,
    probabilityOfImprovement: positive / resamples,
    resamples,
  };
}

// ------------------------------------------------------------------ raporlama

export interface Summary {
  n: number;
  mean: number;
  median: number;
  iqm: number;
  stdDev: number;
  min: number;
  max: number;
}

export function summarize(values: readonly number[]): Summary {
  if (values.length === 0) {
    return { n: 0, mean: Number.NaN, median: Number.NaN, iqm: Number.NaN, stdDev: Number.NaN, min: Number.NaN, max: Number.NaN };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    n: values.length,
    mean: mean(values),
    median: median(values),
    iqm: iqm(values),
    stdDev: stdDev(values),
    min,
    max,
  };
}

/** Sabit ondalık basamakla biçimlendirme (NaN/Infinity "—" olarak). */
export function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

/** `x ± y` biçiminde ortalama ve güven aralığı genişliği. */
export function fmtInterval(interval: Interval, digits = 3): string {
  return `${fmt(interval.estimate, digits)} [${fmt(interval.lower, digits)}, ${fmt(interval.upper, digits)}]`;
}

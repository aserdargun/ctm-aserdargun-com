/**
 * Cell to Mind — çekirdek tipler.
 *
 * Ölçü birimi: **model birimi (mb)**. Bu birim fiziksel bir birim değildir ve
 * `docs/MODEL.md` içinde açıkça böyle tanımlanır. Enerji birimi: `e` (enerji).
 * Zaman birimi: `tick` (sabit 50 ms'lik adım).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

/** İki kaynak türü. Gizli "faydalı/zararlı" etiketi YOKTUR. */
export type ResourceKind = 'A' | 'B';
export const RESOURCE_KINDS: readonly ResourceKind[] = ['A', 'B'];

export interface ResourceNode {
  id: number;
  kind: ResourceKind;
  pos: Vec3;
  /** Sonlu rezerv. Beslenme bu rezervden düşer → enerji yaratılmaz. */
  reserve: number;
  /** Kapasite: rezervin üst sınırı. */
  capacity: number;
  /** Oyuncu tarafından dış girdi olarak eklenen toplam (raporlama için). */
  externalInput: number;
  /** Doğal yenilenme (varsayılan kapalı; açılırsa dış girdi olarak raporlanır). */
  regenPerTick: number;
  radius: number;
}

export interface Rock {
  id: number;
  pos: Vec3;
  radius: number;
  /** Görsel varyant indeksi (Blender'dan gelen GLB). */
  variant: number;
}

export interface Cell {
  id: number;
  /** Bağlı bulunduğu organizma. */
  organismId: number;
  pos: Vec3;
  vel: Vec3;
  /** Hücrenin mevcut enerjisi (e). */
  energy: number;
  /** Organizmanın enerji kapasitesiyle normalize edilmiş enerji (0..1). */
  energyNorm: number;
  /** Tick cinsinden yaş. */
  ageTicks: number;
  /** Kümülatif hasar (0..1; 1 = ölüm). */
  damage: number;
  /** Hücre yarıçapı (mb). */
  radius: number;
  /** Bu hücrenin bağ id'leri. */
  bonds: number[];
  /** Hareket hedefi birim vektörü (son hesaplanan). */
  heading: Vec3;
  alive: boolean;
}

export interface Bond {
  id: number;
  a: number;
  b: number;
  /** Genomdan gelen temel dayanım. */
  strength: number;
  /** Kalan bütünlük; 0'a düşünce bağ kopar. */
  integrity: number;
  /** Uzama oranı (dinamik gerilim). */
  strain: number;
  restLength: number;
}

/**
 * Kalıtsal parametre vektörü. Gerçek DNA dizisi değildir; sınırlı sayıda
 * kalıtsal parametredir. Her parametrenin bir metabolik maliyeti vardır
 * (`energy.ts` içindeki `basalCostFor`), bu yüzden "avantajın maliyeti" kuralı
 * formüllerle zorunlu kılınır.
 */
export interface Genome {
  /** Yavrunun anneye bağlı kalma olasılığı (0..1). */
  bondAffinity: number;
  /** Bağ temel dayanımı (0.15..1). */
  bondStrength: number;
  /** Hareket kapasitesi (0..1). */
  motility: number;
  /** Algı yarıçapı (mb, 2.0..7.0). */
  senseRadius: number;
  /** Bağ boyunca kaynak paylaşma verimi (0..0.6). */
  shareEfficiency: number;
  /** A kaynağına uyum (0..1) — avcıdan kaçınma baskısından gelir. */
  toleranceA: number;
  /** B kaynağına uyum (0..1). */
  toleranceB: number;
  /** Öğrenme plastisitesi (0..1) — öğrenme metabolik maliyeti doğurur. */
  plasticity: number;
}

export interface NeuralState {
  /** Kalıtsal başlangıç ağırlıkları. Yavru bunun mutasyonlu kopyasıyla doğar. */
  thetaInherited: Float64Array;
  /** Bu yaşam boyunca kullanılan ve öğrenilen ağırlıklar. */
  thetaLive: Float64Array;
  /** Hareketli baseline (eylemden bağımsız). */
  baseline: number;
  /** Önceki gerçekleşmiş, ölçeklenmiş ödül. */
  prevReward: number;
  /** Önceki kararın girdisi (yoksa null). */
  prevObs: Float64Array | null;
  /** Önceki kararın eylemi. */
  prevAction: number;
  /** Önceki kararın log olasılığı. */
  prevLogProb: number;
  /** Önceki kararın alındığı andaki baseline. */
  prevBaseline: number;
  hasPrev: boolean;
}

export interface TrajectoryStep {
  obs: Float64Array;
  action: number;
  logProb: number;
  /** Karar anındaki baseline; avantaj `G_t - baseline` olarak hesaplanır. */
  baseline: number;
  /** Bu adımda oluşan ödül. */
  reward: number;
}

/** Organizma doğuş nedeni. Hücre bölünmesi organizma nesli sayılmaz. */
export type BirthMode = 'genesis' | 'bud' | 'fragment';

export interface Organism {
  id: number;
  /** Soy kimliği (tür/hat). Parçalanma soyu değiştirmez. */
  lineageId: number;
  /** Organizma doğum sayacı (bölünme sayacı DEĞİL). */
  generation: number;
  birthMode: BirthMode;
  bornTick: number;
  parentOrganismId: number | null;
  genome: Genome;
  cells: number[];
  neural: NeuralState;
  /** Yaşam boyu biriken ödül (raporlama). */
  lifetimeReward: number;
  /** Kümülatif ölçüm: üreme başarısı. */
  offspringProduced: number;
  /** Ölüm nedeni (ölümde dolar). */
  deathCause: DeathCause | null;
  alive: boolean;
  /** Bu organizmanın bölünmüş koloni üreme nesli sayacı (deney ölçümü). */
  completedColonyGenerations: number;
}

export type DeathCause = 'starvation' | 'predation' | 'age' | 'experiment-end' | null;

export interface Lineage {
  id: number;
  /** Kurucu organizma. */
  founderOrganismId: number;
  founderTick: number;
  /** Soy etiketi (G1, G2 ...). */
  label: string;
  /** Bu soydan doğan organizmalar. */
  organismIds: number[];
  /** Soyun ortalama genomu (uyarlanma gözlemi için). */
  meanGenome: Genome;
}

export interface Predator {
  pos: Vec3;
  vel: Vec3;
  /** Avcının enerji stoğu (e) — öldürdüğü hücrelerden gelir, kapalı sistem. */
  energy: number;
  radius: number;
  alive: boolean;
}

export interface HabitatSettings {
  /** Habitat kutu boyutları (mb). */
  size: Vec3;
  /** Su akışı şiddeti (mb/tick). */
  currentStrength: number;
  /** Işık (0..1) — enerji üretmez, yalnızca görsel ve algısal bağlam. */
  light: number;
  /** Seçilim baskısı (0..1) — avcı baskısı; "öğrenen avcı" değildir. */
  selectionPressure: number;
  /** Oyuncu tarafından eklenen besin (dış girdi, raporlanır). */
  nutrientA: number;
  nutrientB: number;
  /** Öğrenme açık mı? Kapalıyken ağırlıklar değişmez. */
  learningEnabled: boolean;
}

export type SimEventType =
  | 'genesis'
  | 'cell-division'
  | 'organism-birth'
  | 'bud-separation'
  | 'bond-formation'
  | 'bond-break'
  | 'fragmentation'
  | 'death'
  | 'predation'
  | 'learning-update'
  | 'nutrient-added'
  | 'intervention'
  | 'experiment-start'
  | 'experiment-end'
  | 'branch-created'
  | 'save-loaded';

export interface SimEvent {
  id: number;
  tick: number;
  type: SimEventType;
  organismId?: number;
  lineageId?: number;
  cellId?: number;
  /** Ölçülebilir sayılar: `metricRef -> { value, unit }`. */
  metrics?: Record<string, { value: number; unit: string }>;
  detail?: Record<string, string | number | boolean>;
}

export interface MetricsSample {
  tick: number;
  population: number;
  organismCount: number;
  meanEnergy: number;
  totalEnergy: number;
  largestColonySize: number;
  multiCellOrganisms: number;
  bondCount: number;
  predatorEnergy: number;
  /** İşletimsel eşik: 4+ hücreli yapı. */
  coloniesOverFourCells: number;
  learningUpdates: number;
  maxGeneration: number;
}

/** Oyuncu müdahalesi — kayıtta ve gözlemci kanıtında yer alır. */
export interface Intervention {
  id: number;
  tick: number;
  kind: 'nutrient' | 'light' | 'current' | 'pressure' | 'learning' | 'experiment';
  target: string;
  value: number;
  note?: string;
}
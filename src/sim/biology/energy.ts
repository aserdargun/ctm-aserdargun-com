/**
 * Cell to Mind — açık enerji formülleri.
 *
 * TASARIM İLKESİ: Enerji paylaşımı enerji **yaratmaz**. Her hücreler arası,
 * hücre–kaynak, hücre–avcı aktarımı toplamı değiştirmez. Metabolik olarak
 * harcanan her miktar `ledger.dissipate()` ile kayıt altına alınır; böylece
 * şu değişmez denetlenebilir hâle gelir:
 *
 *     (hücreler + kaynaklar + avcı) + harcanan  ==  başlangıç + dışGirdi
 *
 * Dış girdi yalnızca iki yoldan gelir ve ikisi de `externalInput` olarak
 * raporlanır: kaynak rejenerasyonu ve oyuncunun besin eklemesi.
 */

import type { Genome, Vec3 } from '../types.ts';

/** Tüm ayarlar tek yerde; `docs/MODEL.md` bu değerleri belgeler. */
export const C = {
  /** Sabit simülasyon adımı (ms). */
  TICK_MS: 50,
  /** Karar güncelleme aralığı (tick). 50 ms × 10 = 500 ms ≈ 2 Hz ... aşağıda. */
  DECISION_EVERY_TICKS: 10,

  /** Hücre başına enerji kapasitesi (e). */
  CELL_CAPACITY: 100,
  /** Başlangıçtaki hücre enerjisi (e). */
  INITIAL_CELL_ENERGY: 55,
  /** Standart habitat hücre sayısı. */
  DEFAULT_POPULATION: 48,
  /** Standart kapasite (performans bütçesi). */
  STANDARD_CAPACITY: 256,
  /** Küçük mobil habitat kapasitesi. */
  MOBILE_CAPACITY: 96,

  /** Bölünme eşiği (e). */
  DIVIDE_THRESHOLD: 70,
  /** Bölünme maliyeti (e) — toplamdan düşülür, yok edilmez. */
  DIVISION_COST: 8,
  /** Bölünmede annenin aldığı pay. */
  MOTHER_SHARE: 0.55,
  /** Bölünmede yavrunun aldığı pay. */
  DAUGHTER_SHARE: 0.45,
  /** Bir organizmanın en büyük hücre sayısı. */
  MAX_ORGANISM_CELLS: 24,
  /** Bölünme için minimum yaş (tick). */
  DIVIDE_MIN_AGE: 40,

  /** Tam temas + tam rezerv + tolerans 1 için emilim hızı (e/tick). */
  INTAKE_RATE: 0.22,
  /** Temel bazal tüketim (e/tick/hücre). */
  BASE_BASAL: 0.007,
  /** Algı yarıçapı maliyeti katsayısı (e/tick/hücre). */
  SENSORY_COST_K: 6e-5,
  /** Yüzey/bakım maliyeti katsayısı (e/tick/hücre, r² ile çarpılır). */
  MAINTENANCE_COST_K: 4e-5,
  /** Bağ başına bakım maliyeti katsayısı (e/tick/bond × strength). */
  BOND_MAINTENANCE_K: 8e-5,
  /** Plastisite metabolik maliyeti (e/tick/hücre). */
  PLASTICITY_COST_K: 1e-5,
  /** Hareket maliyeti katsayısı (e/tick; r³·v² ile çarpılır). */
  MOVE_COST_K: 0.01,
  /** Karar başına algı maliyeti katsayısı (e/karar × algı yarıçapı). */
  PERCEPTION_COST_K: 1.2e-4,
  /** Karar başına öğrenme maliyeti katsayısı (e/karar × plastisite). */
  LEARNING_COST_K: 6e-4,

  /** Temel hücre yarıçapı (mb). */
  BASE_RADIUS: 0.3,
  /** Koloni büyüdükçe yarıçap artışı (karekök ölçekli). */
  SIZE_GROWTH_K: 0.11,

  /** Temel azami hız (mb/tick); genom ve yarıçap ölçekler. */
  BASE_SPEED: 0.35,
  /** Dönüş hızı (1/tick). */
  TURN_RATE: 0.16,

  /** Bağ dinlenme uzunluğu (mb). */
  BOND_REST_LENGTH: 0.62,
  /** Bağ kopma mesafesi (mb) — yapışkanlık kuvvetinin tolerans payı. */
  BOND_BREAK_DISTANCE: 1.9,
  /** Uzama başına bütünlük kaybı katsayısı. */
  STRAIN_DECAY_K: 0.02,
  /** Bağın her tick doğal zayıflaması (dayanıklı bir bağ ~30000 tick yaşar). */
  BOND_FATIGUE: 2e-5,

  /**
   * Yoğunluğa bağlı rekabet maliyeti katsayısı.
   *
   * Habitatın taşıma kapasitesi sınırlıdır; kalabalıkla birlikte hücre başına
   * yaşam maliyeti artar (yer ve besin rekabeti):
   *
   *     maliyetÇarpanı = 1 + DENSITY_COST_K * (popülasyon / STANDART_CAPACITY)²
   *
   * Bu bir performans kırpması DEĞİLDİR ve hücre silmez; popülasyonu taşıma
   * kapasitesinin altında tutan gerçek bir biyolojik geri beslemedir. Kaynak
   * tükenmesinin yanı sıra dengeyi kuran ikinci mekanizmadır.
   */
  DENSITY_COST_K: 4,

  /** Paylaşma: ideal seviyenin üstündeki fazlanın aktarılma oranı. */
  SHARE_RATE: 0.25,
  /** Paylaşma verimi (genom shareEfficiency ile çarpılır). */
  TRANSPORT_EFFICIENCY: 0.72,
  /**
   * Bağ üzerinden dengeleme seviyesi (kapasite oranı).
   *
   * Bu değer `DIVIDE_THRESHOLD`'un ÜSTÜNDE olmak zorundadır: eğer paylaşma
   * bölünme eşiğinin altında bir denge noktasına çekseydi, kolonideki hiçbir
   * hücre bölünme eşiğine ulaşamaz ve çok hücrelilik hiç başlamazdı.
   */
  SHARE_IDLE_LEVEL: 0.82,

  /** Tomurcuk ayrılması: organizma başına tick olasılığı tabanı. */
  BUD_BASE_RATE: 2e-4,
  /** Tomurcuk en büyük hücre sayısı. */
  BUD_MAX_CELLS: 3,
  /** Tomurcuk için minimum organizma boyutu. */
  BUD_MIN_CELLS: 6,

  /** Avcı temel yarıçapı (mb). */
  PREDATOR_BASE_RADIUS: 0.55,
  /** Avcı enerji kapasitesi (e) — fazlası depolanmaz. */
  PREDATOR_CAPACITY: 2400,
  /** Avcı enerji tüketimi (e/tick) — taban. */
  PREDATOR_BASAL: 0.03,
  /**
   * Avcı metabolizmasının enerji kütlesine oranı (tick başına).
   *
   * Bu katsayı, avcı-popülasyonu arasındaki geri beslemeyi sağlar: avcı
   * büyüdükçe daha fazla enerji harcar, av azalınca açlıkla ölür ve av
   * toparlanır. Sabit bir bazal tüketimle avcı, avı tükenene kadar büyür ve
   * tüm ekosistemi çökertirdi.
   */
  PREDATOR_METABOLIC_RATE: 0.0012,
  /** Avcı temel hızı (mb/tick). Avdan YAVAŞ olmalı; av kaçabilmelidir. */
  PREDATOR_SPEED: 0.2,
  /** Avcının avını arama yönü gücü (akışa göre). */
  PREDATOR_HUNT_WEIGHT: 1.6,

  /**
   * Yakalama yoğunluk katsayısı — avcının doygun (tip II) işlevsel yanıtı.
   *
   * Tick başına yakalama olasılığı:
   *     p = 1 - exp( -CAPTURE_DENSITY_K * pressure * erişimdekiHücreSayısı )
   *
   * Neden bu biçim: her organizma için bağımsız zar atmak, avcıyı seyrek
   * popülasyonda bile mutlak bir katil hâline getiriyordu (48 hücrelik başlangıç
   * popülasyonu tükeniyordu). Doygun yanıt, av seyrekken baskıyı düşük,
   * av yoğunken yüksek tutar: gerçek bir avcı–av geri beslemesi.
   */
  CAPTURE_DENSITY_K: 0.0006,
  /** Yakalama yarıçapı tabanı (mb). */
  CAPTURE_RADIUS: 3.2,

  /** Kaynak rezervi yenilenmesi varsayılan KAPALI (kapalı enerji sistemi). */
  DEFAULT_REGEN: 0,

  /** İşletimsel çok hücrelilik eşiği (oyunun ölçümü, biyolojik tanım değil). */
  MULTICELL_THRESHOLD: 4,
  /** Raporlanan koloni üreme nesli hedefi. */
  COLONY_GENERATION_TARGET: 3,

  /** Yörünge uzunluğu sınırı. */
  TRAJECTORY_LIMIT: 64,
  /** İndirim faktörü (sabit sonlu ufuk). */
  GAMMA: 0.95,
  /** Temel öğrenme hızı. */
  LEARN_RATE: 0.02,
  /** Baseline hareketlilik katsayısı (politika güncellemesinden sonra tazelenir). */
  BASELINE_BETA: 0.25,
  /** Gradyan normu sınırı (NaN/Infinity savunması). */
  GRAD_CLIP: 5,
} as const;

/**
 * Enerji muhasebesi defteri. Aktarımlar buraya yazılmaz (toplamı değiştirmez),
 * yalnızca "harcanan" (metabolik ısı) birikir.
 */
export class EnergyLedger {
  /** Biriken başlangıç enerjisi (e). */
  initialTotal = 0;
  /** Oyuncu/kaynak kaynaklı dış girdi (e). */
  externalInput = 0;
  /** Metabolik olarak harcanan ve yok edilen (e). */
  dissipated = 0;

  reset(initialTotal: number): void {
    this.initialTotal = initialTotal;
    this.externalInput = 0;
    this.dissipated = 0;
  }

  /** Enerjiyi sistemden çıkarır (harcanan). */
  dissipate(amount: number): void {
    if (amount > 0) this.dissipated += amount;
  }

  /** Dış girdi kaydeder (rejenerasyon, oyuncu besini). */
  addExternal(amount: number): void {
    if (amount > 0) this.externalInput += amount;
  }

  /** Bakiye farkı (kabul testleri için ~0 olmalı). */
  residual(systemTotal: number): number {
    return systemTotal + this.dissipated - (this.initialTotal + this.externalInput);
  }
}

/** Koloni hücre sayısına göre hücre yarıçapı (mb). */
export function radiusForCount(cellCount: number): number {
  return C.BASE_RADIUS * (1 + C.SIZE_GROWTH_K * Math.sqrt(Math.max(0, cellCount - 1)));
}

/** Koloni büyüklüğünün azami hıza etkisi: büyük kütle daha yavaş. */
export function speedScaleForRadius(radius: number): number {
  return 1 / (1 + 0.25 * (radius / C.BASE_RADIUS - 1));
}

/** Temel azami hız (mb/tick). */
export function maxSpeedFor(genome: Genome, radius: number): number {
  return C.BASE_SPEED * (0.4 + 0.6 * genome.motility) * speedScaleForRadius(radius);
}

/**
 * Tick başına toplam bazal tüketim (e).
 * `bondCount` organizmanın bağ sayısıdır; bağ başına bakım maliyeti
 * genomun `bondStrength` değeriyle ölçeklenir.
 * `densityFactor` yoğunluk rekabeti çarpanıdır (bkz. `DENSITY_COST_K`).
 */
export function basalCostFor(
  genome: Genome,
  radius: number,
  bondCount: number,
  densityFactor = 1,
): number {
  const surface = (radius / C.BASE_RADIUS) ** 2;
  const maintenance = C.MAINTENANCE_COST_K * surface;
  const sensory = C.SENSORY_COST_K * genome.senseRadius;
  const plasticity = C.PLASTICITY_COST_K * genome.plasticity;
  const bonds = C.BOND_MAINTENANCE_K * bondCount * (0.5 + 0.5 * genome.bondStrength);
  return (C.BASE_BASAL + maintenance + sensory + plasticity + bonds) * densityFactor;
}

/** Verilen popülasyon için yoğunluk rekabeti çarpanı. */
export function densityFactorFor(population: number, capacity = C.STANDARD_CAPACITY): number {
  const ratio = Math.max(0, population) / Math.max(1, capacity);
  return 1 + C.DENSITY_COST_K * ratio * ratio;
}

/** Hareket maliyeti (e/tick): kütle ∝ r³, güç ∝ v². */
export function moveCostFor(radius: number, speed: number): number {
  return C.MOVE_COST_K * (radius / C.BASE_RADIUS) ** 3 * speed * speed;
}

/** Karar anındaki algı maliyeti (e). */
export function perceptionCostFor(genome: Genome): number {
  return C.PERCEPTION_COST_K * genome.senseRadius;
}

/** Karar anındaki öğrenme maliyeti (e). Plastisite metabolik bedel öder. */
export function learningCostFor(genome: Genome): number {
  return C.LEARNING_COST_K * genome.plasticity;
}

/**
 * Bir hücrenin temsil ettiği toplam enerji kapasitesi (e).
 * Kolonideki hücreler bağlar boyunca paylaşabildiği için toplam tampon
 * hücre sayısıyla artar — bu, "beden büyüklüğü korunmayı etkiler" kuralının
 * mekanizmasıdır (gizli bonus değil, paylaşılabilir hacim).
 */
export function organismCapacityFor(cellCount: number): number {
  return C.CELL_CAPACITY * Math.max(1, cellCount);
}

/**
 * Avcının bir tick'te yakalama olasılığı — doygun (tip II) işlevsel yanıt.
 *
 *     p = 1 - exp( -CAPTURE_DENSITY_K * pressure * erişimdekiHücreSayısı )
 *
 * Artan, doymaya yaklaşan bir yanıttır: av seyrekken baskı düşük, av yoğunken
 * yüksektir. Bu, seçilim baskısının gerçek bir avcı–av dinamiği üretmesini
 * sağlar; sabit bir olasılık başlangıç popülasyonunu yok ederdi.
 */
export function captureChance(pressure: number, inRange: number): number {
  if (pressure <= 0 || inRange <= 0) return 0;
  return 1 - Math.exp(-C.CAPTURE_DENSITY_K * pressure * inRange);
}

/** Avcının hücreyi fark ettiği yarıçap (mb). Baskı arttıkça genişler. */
export function captureRadiusFor(pressure: number, predatorRadius: number): number {
  return C.CAPTURE_RADIUS * (0.6 + 0.8 * Math.max(0, pressure)) + predatorRadius;
}

/** Kaynak temas katsayısı: merkezde 1, sınırda 0. */
export function contactFactor(distance: number, cellRadius: number, nodeRadius: number): number {
  const reach = cellRadius + nodeRadius;
  if (distance >= reach) return 0;
  return 1 - distance / reach;
}

/**
 * Bir tick'te emilen enerji (e). Rezervden düşülür; enerji yaratılmaz.
 * `tolerance` genomden gelir (A/B ayrımı), bu bir "gizli etiket" değildir:
 * organizma kaynağın **ağırlığını** önceden biliyordur, dünyanın konumunu değil.
 */
export function intakeFor(
  genome: Genome,
  kind: 'A' | 'B',
  cellRadius: number,
  nodeRadius: number,
  distance: number,
  reserveFraction: number,
): number {
  const contact = contactFactor(distance, cellRadius, nodeRadius);
  if (contact <= 0) return 0;
  const tolerance = kind === 'A' ? genome.toleranceA : genome.toleranceB;
  const area = (cellRadius / C.BASE_RADIUS) ** 2;
  return C.INTAKE_RATE * contact * tolerance * area * Math.max(0, Math.min(1, reserveFraction));
}

/**
 * Paylaşma: bağ boyunca sınırlı hızda enerji aktarımı.
 *
 * Donör bağ üzerinden `drawn` kadar enerji çeker, alıcıya `delivered` kadar
 * ulaşır. Aradaki `drawn - delivered` taşıma kaybı **gerçekten harcanmıştır**
 * ve defterde `dissipate()` ile kaydedilir — böylece toplam korunur.
 * (Önceki taslakta verim kaybı hiçbir yerden düşülmediği için enerji
 * yaratıyordu; bu düzeltildi.)
 */
export function shareAlongBond(
  donorEnergy: number,
  receiverEnergy: number,
  genome: Genome,
): { drawn: number; delivered: number } {
  const ideal = C.CELL_CAPACITY * C.SHARE_IDLE_LEVEL;
  const surplus = donorEnergy - ideal;
  const deficit = ideal - receiverEnergy;
  if (surplus <= 0 || deficit <= 0) return { drawn: 0, delivered: 0 };
  const rate = Math.min(surplus, deficit) * C.SHARE_RATE * (0.25 + genome.shareEfficiency);
  return { drawn: rate, delivered: rate * C.TRANSPORT_EFFICIENCY };
}

/** Analitik, pahalı olmayan su akışı vektör alanı (mb/tick). */
export function currentAt(pos: Vec3, timeSec: number, strength: number): Vec3 {
  const t = timeSec * 0.08;
  return {
    x: Math.sin(pos.y * 0.21 + t) * Math.cos(pos.z * 0.17 - t * 0.7) * strength,
    y: Math.sin(pos.z * 0.13 - t * 0.5) * Math.cos(pos.x * 0.19 + t * 0.3) * 0.35 * strength,
    z: Math.sin(pos.x * 0.23 + t * 0.9) * Math.cos(pos.y * 0.15 + t * 0.4) * strength,
  };
}
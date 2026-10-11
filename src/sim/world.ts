/**
 * Cell to Mind — dünya: simülasyonun TEK yazarı.
 *
 * Bu modül saf TypeScript'tir. React, DOM veya three.js bağımlılığı YOKTUR;
 * bu yüzden bir Dedicated Web Worker içinde ve Vitest (node) altında aynı
 * şekilde çalışır.
 *
 * Öncelik sırası her tick'te sabittir ve enerji muhasebesi bu sıraya göre
 * kapatılır. Her enerji çıkışı `ledger.dissipate()` ile kaydedilir.
 */

import {
  C,
  EnergyLedger,
  basalCostFor,
  captureChance,
  captureRadiusFor,
  currentAt,
  densityFactorFor,
  intakeFor,
  learningCostFor,
  moveCostFor,
  perceptionCostFor,
  radiusForCount,
  shareAlongBond,
  speedScaleForRadius,
} from './biology/energy.ts';
import { chooseIdentityComponent, connectedComponents } from './biology/connectivity.ts';
import { NeuralPolicy, type DecisionInfo } from './behavior/policy.ts';
import { computeObservation } from './behavior/perception.ts';
import { createTheta, initTheta, MLP_SHAPE } from './behavior/mlp.ts';
import { clampGenome, createLineage, founderGenomes, meanGenome, mutateGenome } from './genome.ts';
import { RingBuffer, hashNoise } from './ring.ts';
import { RngBundle } from './rng.ts';
import { SpatialGrid, dist2 } from './spatial.ts';
import type {
  Bond,
  Cell,
  DeathCause,
  Genome,
  HabitatSettings,
  Intervention,
  Lineage,
  MetricsSample,
  Organism,
  Predator,
  ResourceNode,
  Rock,
  TrajectoryStep,
  SimEvent,
  SimEventType,
  Vec3,
} from './types.ts';

export const SIM_VERSION = '1.0.0';

export interface WorldOptions {
  seed: number;
  population?: number;
  capacity?: number;
  /** Habitat kutu boyutu (mb). */
  size?: Vec3;
  /** Kaynak sayısı. */
  resourceCount?: number;
  /** Hazır öğretici habitat adı. */
  preset?: string;
  light?: number;
  currentStrength?: number;
  selectionPressure?: number;
  learningEnabled?: boolean;
  /**
   * Duyarlılık analizi kancası: bir gradyan adımı için toplanacak karar
   * sayısı. Verilmezse `C.TRAJECTORY_LIMIT` kullanılır. Ürün davranışı
   * değişmez; yalnız deney motoru bu ekseni ölçebilir.
   */
  trajectoryLimit?: number;
  /**
   * Duyarlılık analizi kancası: gradyan adım büyüklüğü. Verilmezse
   * `C.LEARN_RATE` kullanılır. Ürün davranışı değişmez.
   */
  learnRate?: number;
  /**
   * Duyarlılık analizi kancası: avantajları z-skoruna çevir. Varsayılan **kapalı**.
   * Bkz. `VALIDATION.md` §4.7–4.9. Ürün davranışı değişmez.
   */
  normalizeAdvantage?: boolean;
  /**
   * Duyarlılık analizi kancası: avantajın yalnız işaretini kullan. Varsayılan
   * **kapalı**. Bkz. `VALIDATION.md` §4.7–4.9. Ürün davranışı değişmez.
   */
  signAdvantage?: boolean;
  /**
   * Duyarlılık analizi kancası: **bağ yorgunluğu** (tick başına bütünlük kaybı).
   * Verilmezse `C.BOND_FATIGUE` kullanılır. Ürün davranışı değişmez.
   *
   * Gerekçe (`docs/VALIDATION.md` §5): ölçüldü ki koloniler kaynak bitmeden
   * bağ yorgunluğuyla dağılıyor; koptukları andaki medyan uzama yalnız 0.079.
   * Yani sınırlayıcı olan **bağ ömrü**, geometri değil.
   */
  bondFatigue?: number;
  /**
   * Duyarlılık analizi kancası: **uzamaya bağlı bütünlük kaybı** katsayısı.
   * Verilmezse `C.STRAIN_DECAY_K` kullanılır. Ürün davranışı değişmez.
   */
  strainDecayK?: number;
  /**
   * **S-4 kancası — çatallanmış ortamda yaşam içi üstel arama.** Varsayılan **kapalı**.
   *
   * Gerekçe (`VALIDATION.md` §6.5, §6.10): REINFORCE ve popülasyon-ES başarısız
   * çünkü ikisi de **kredi ataması** yapamıyor — ödül epimizik toplamda mükemmel
   * (r = 0.70) ama tek adıma dağıtılınca kayboluyor. Gerçek ES kredi ataması
   * yapmaz: θ etrafında pertürbasyon üretir, her birini **ayrı çatallanmış
   * dünyada** değerlendirir, θ'yi getiriye ağırlıklı pertürbasyon ortalaması
   * boyunca kaydırır.
   *
   * Çatallamanın hem mümkün hem ucuz olduğu **ölçüldü** (bir çatal ≈ 25 tick,
   * §6.9). Maliyet yine de ürün için belirleyicidir; varsayılan kapalıdır ve
   * `VALIDATION.md` §7'de tarayıcı etkisi ayrıca ölçülür.
   *
   * Parametreler (`null`/undefined ise aşağıdaki varsayılanlar):
   *   esInterval       — kaç tick'te bir arama (varsayılan 500)
   *   esPerturbations  — kaç pertürbasyon (varsayılan 8)
   *   esEvaluateTicks — her dal kaç tick ilerletilir (varsayılan 60)
   *   esSigma         — pertürbasyon ölçeği (varsayılan 0.05)
   *   esLearningRate  — adım büyüklüğü (varsayılan 0.02)
   */
  esInterval?: number;
  esPerturbations?: number;
  esEvaluateTicks?: number;
  esSigma?: number;
  esLearningRate?: number;

  /**
   * **Popülasyon-ES kancası.** Varsayılan **kapalı**.
   *
   * Gerekçe (`VALIDATION.md` §4.12–4.13): yaşam içi REINFORCE'ın başarısız
   * olmasının nedeni ödül değil **kredi ataması**: epimizik toplam performansla
   * güçlü biçimde korele (r = 0.70) ama bu toplamı 64 adımlık yörüngeye yayarken
   * bilgi kayboluyor. Evrimsel arama ise yalnızca epimizik toplamı kullandığı
   * için aynı görevde +0.161 buldu.
   *
   * Popülasyon-ES aynı ilkeyi **yaşam içinde** uygular: birey kendi ağırlıklarını
   * doğrudan değiştirmez; onun yerine, *son dönem getiri hızı* popülasyondaki
   * eşitlerine göre sıralandığında, ağırlıklarının **getiriye ağırlıklı popülasyon
   * ortalamasına** doğru çekilir. Adım-içi kredi ataması hiç yapılmaz.
   */
  populationUpdate?: boolean;
  /** Çekme katsayısı (temel değer; plastisite ile ölçeklenir). Varsayılan 0.06. */
  populationUpdateRate?: number;
  /** Kaç tick'te bir güncelleme. Varsayılan 500. */
  populationUpdateInterval?: number;
  /**
   * **Y-2 kancası — bağ yorgunluğunu genoma bağla.** Varsayılan **kapalı**.
   *
   * Gerekçe (`docs/VALIDATION.md` §5): uzama terimi `bond.strength` ile
   * çarpılıyor, **yorgunluk terisi hiç genoma bakmıyor** — her bağ, sahibi ne
   * genom taşırsa taşısın aynı yorulma hızına sahip. Yani bağ ömrünün bir
   * kısmı kalıtsız. Bu kanca açıldığında yorgunluk da `bond.strength` ile
   * çarpılır ve bağ ömrü seçilime açık hâle gelir.
   *
   * Ölçüm amaçlı: seçilim dayanıklılığı artırıyor mu? Bkz.
   * `experiments/ecology.ts → experimentBondLifeHeritability`.
   */
  coupleFatigueToGenome?: boolean;
  bondsEnabled?: boolean;
  /** Deney kısıtları. */
  growthEnabled?: boolean;
  reproductionEnabled?: boolean;
  mutationEnabled?: boolean;
  /** Kaynak rejenerasyonu (varsayılan kapalı → kapalı enerji sistemi). */
  resourceRegen?: number;
}

export interface ExperimentConstraints {
  growthEnabled: boolean;
  reproductionEnabled: boolean;
  mutationEnabled: boolean;
  learningEnabled: boolean;
  bondsEnabled: boolean;
  /** Karar bütçesi: aşıldığında öğrenme kapanır (önceden sabitlenir). */
  decisionBudget: number;
}

const DEFAULT_SIZE: Vec3 = { x: 16, y: 8, z: 11 };

export class World {
  version = SIM_VERSION;
  tick = 0;
  settings: HabitatSettings;
  constraints: ExperimentConstraints;

  rng: RngBundle;
  readonly ledger = new EnergyLedger();

  cells = new Map<number, Cell>();
  /** Artan kimlik sırasıyla bakılır (deterministik yineleme). */
  cellIds: number[] = [];
  bonds = new Map<number, Bond>();
  organisms = new Map<number, Organism>();
  policies = new Map<number, NeuralPolicy>();
  lineages = new Map<number, Lineage>();

  resources: ResourceNode[] = [];
  rocks: Rock[] = [];
  predator: Predator;

  readonly events = new RingBuffer<SimEvent>(2000);
  readonly metricsHistory = new RingBuffer<MetricsSample>(600);
  interventions: Intervention[] = [];

  private nextCellId = 1;
  private nextBondId = 1;
  private nextOrganismId = 1;
  private nextResourceId = 1;
  private nextRockId = 1;

  private nextEventId = 1;
  private nextInterventionId = 1;

  private grid: SpatialGrid;
  /** Organizma başına karar aralığı biriktiricileri (ödül geçmişe karşılık gelir). */
  private pendingEnergy = new Map<number, number>();
  private pendingDamage = new Map<number, number>();
  private pendingMoveCost = new Map<number, number>();
  /** Bu karar aralığında seçilen eylem (motor uygulaması için). */
  private intents = new Map<number, { dir: Vec3; action: number; speedScale: number }>();
  /** Organizma başına son GERÇEK karar (mikroskop yalnızca bunu gösterir). */
  private lastDecisions = new Map<number, DecisionInfo>();
  private decisionTick = 0;
  private metricTick = 0;
  /** Canlı hücre sayısı (yoğunluk maliyeti için, tick başına tazelenir). */
  private livePopulation = 0;
  /**
   * Yaşayan organizma kimliklerinin sıralı önbelleği.
   *
   * `organismOrder()` her tick birçok kez çağrılır ve önceden `[...map.keys()]`
   * + `sort()` yapmak, ölü organizmalar biriktiğinde O(n log n) maliyet
   * üretiyordu. Önbellek yalnız organizma yapısı değiştiğinde (doğum/ölüm)
   * geçersizleşir.
   */
  private aliveOrderCache: number[] | null = null;

  /**
   * Duyarlılık analizi kancaları. Verilmezse `undefined` kalır ve her
   * `NeuralPolicy` model sabitlerini kullanır — yani oyunun davranışı
   * etkilenmez. Yalnız deney motoru bunları doldurur.
   */
  /** Popülasyon-ES ayarları (kapalıysa alanlar undefined). */
  private readonly populationUpdateConfig: {
    enabled: boolean;
    rate: number;
    interval: number;
  };
  /** Popülasyon-ES için son kontrol noktasındaki kümülatif ödül. */
  private readonly esCheckpointReward = new Map<number, number>();
  /** Popülasyon-ES tarafından son güncellemede çekilen organizma sayısı (ölçüm). */
  private populationUpdateCount = 0;

  /** S-4 üstel arama ayarları (kapalıysa enabled=false). */
  private readonly esConfig: {
    enabled: boolean;
    interval: number;
    perturbations: number;
    evaluateTicks: number;
    sigma: number;
    learningRate: number;
  };
  /** S-4 tarafından yapılan arama sayısı (ölçüm). */
  private esUpdateCount = 0;
  /** S-4'ün harcadığı toplam süre (ms, ölçüm). */
  private esSpentMs = 0;
  /** S-4'ün en son adımda bulduğu gerçek kazanç (ölçüm). */
  private esLastGain = 0;

  private readonly bondTuning: {
    bondFatigue?: number;
    strainDecayK?: number;
    coupleFatigueToGenome?: boolean;
  };
  private readonly policyTuning: {
    trajectoryLimit?: number;
    learnRate?: number;
    normalizeAdvantage?: boolean;
    signAdvantage?: boolean;
  };

  constructor(options: WorldOptions) {
    this.rng = new RngBundle(options.seed);
    this.esConfig = {
      enabled: options.esInterval !== undefined || options.esPerturbations !== undefined,
      interval: Math.max(1, options.esInterval ?? 500),
      perturbations: Math.max(1, options.esPerturbations ?? 8),
      evaluateTicks: Math.max(1, options.esEvaluateTicks ?? 60),
      sigma: options.esSigma ?? 0.05,
      learningRate: options.esLearningRate ?? 0.02,
    };
    this.populationUpdateConfig = {
      enabled: options.populationUpdate ?? false,
      rate: options.populationUpdateRate ?? 0.06,
      interval: Math.max(1, options.populationUpdateInterval ?? 500),
    };
    this.bondTuning = {
      ...(options.bondFatigue === undefined ? {} : { bondFatigue: options.bondFatigue }),
      ...(options.strainDecayK === undefined ? {} : { strainDecayK: options.strainDecayK }),
      ...(options.coupleFatigueToGenome === undefined ? {} : { coupleFatigueToGenome: options.coupleFatigueToGenome }),
    };
    this.policyTuning = {
      ...(options.trajectoryLimit === undefined ? {} : { trajectoryLimit: options.trajectoryLimit }),
      ...(options.learnRate === undefined ? {} : { learnRate: options.learnRate }),
      ...(options.normalizeAdvantage === undefined ? {} : { normalizeAdvantage: options.normalizeAdvantage }),
      ...(options.signAdvantage === undefined ? {} : { signAdvantage: options.signAdvantage }),
    };
    this.rng = new RngBundle(options.seed);
    const size = options.size ?? DEFAULT_SIZE;
    this.settings = {
      size: { ...size },
      currentStrength: options.currentStrength ?? 0.045,
      light: options.light ?? 0.62,
      selectionPressure: options.selectionPressure ?? 0.18,
      nutrientA: 0,
      nutrientB: 0,
      learningEnabled: options.learningEnabled ?? true,
    };
    this.constraints = {
      growthEnabled: options.growthEnabled ?? true,
      reproductionEnabled: options.reproductionEnabled ?? true,
      mutationEnabled: options.mutationEnabled ?? true,
      learningEnabled: options.learningEnabled ?? true,
      bondsEnabled: options.bondsEnabled ?? true,
      decisionBudget: Number.POSITIVE_INFINITY,
    };

    this.grid = new SpatialGrid(size, 1.2);
    this.predator = {
      pos: { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 },
      vel: { x: 0, y: 0, z: 0 },
      energy: C.PREDATOR_CAPACITY * 0.02,
      radius: C.PREDATOR_BASE_RADIUS,
      alive: true,
    };

    this.seedRocks(options.preset ?? 'standard');
    this.seedResources(options.resourceCount ?? 34, options.resourceRegen ?? C.DEFAULT_REGEN, options.preset ?? 'standard');
    this.seedPopulation(options.population ?? C.DEFAULT_POPULATION, options.preset ?? 'standard');
    this.assignFounderLineages();

    // Kapalı enerji sistemi başlangıç bakiyesi.
    this.ledger.reset(this.systemEnergyTotal());
  }

  // ---------------------------------------------------------------- üretim

  private seedRocks(preset: string): void {
    const rng = this.rng.env;
    const count = preset === 'crowded' ? 7 : 5;
    for (let i = 0; i < count; i++) {
      const pos = {
        x: rng.range(this.settings.size.x * 0.12, this.settings.size.x * 0.88),
        y: rng.range(this.settings.size.y * 0.1, this.settings.size.y * 0.5),
        z: rng.range(this.settings.size.z * 0.12, this.settings.size.z * 0.88),
      };
      this.rocks.push({ id: this.nextRockId++, pos, radius: rng.range(0.5, 1.15), variant: rng.int(4) });
    }
  }

  private seedResources(count: number, regen: number, preset: string): void {
    const rng = this.rng.env;
    for (let i = 0; i < count; i++) {
      const kind: 'A' | 'B' = i % 2 === 0 ? 'A' : 'B';
      const capacity = kind === "A" ? rng.range(2600, 4400) : rng.range(2200, 3400);
      const pos = {
        x: rng.range(this.settings.size.x * 0.08, this.settings.size.x * 0.92),
        y: rng.range(this.settings.size.y * 0.08, this.settings.size.y * 0.92),
        z: rng.range(this.settings.size.z * 0.08, this.settings.size.z * 0.92),
      };
      this.resources.push({
        id: this.nextResourceId++,
        kind,
        pos,
        reserve: capacity,
        capacity,
        externalInput: 0,
        regenPerTick: regen,
        // Kaynaklar görünür besin alanlarıdır; yarıçap habitatın önemli bir
        // kısmını kaplar, aksi halde rastgele politikalarla hiçbir hücre beslenemez.
        radius: kind === 'A' ? 1.35 : 1.15,
      });
    }
    // "tepelik" (gradient-rich) habitat: kaynakları birbirine daha yakın koy.
    if (preset === 'gradient-rich') {
      for (let i = 0; i < 6; i++) {
        const r = this.resources[i % this.resources.length];
        if (!r) continue;
        r.pos.x = this.settings.size.x * (0.25 + 0.1 * (i % 3));
        r.pos.y = this.settings.size.y * (0.3 + 0.2 * ((i + 1) % 3));
        r.pos.z = this.settings.size.z * (0.3 + 0.15 * ((i + 2) % 3));
      }
    }
  }

  private seedPopulation(population: number, preset: string): void {
    const rng = this.rng.env;
    const genomes = founderGenomes(rng, population);
    for (let i = 0; i < population; i++) {
      const genome = clampGenome(genomes[i] as Genome);
      const pos = this.randomSpawnPosition(rng);
      const org = this.createOrganism(genome, null, 0, 'genesis');
      // Kurucu popülasyon tek hücrelidir: çok hücrelilik bölünmeyle kazanılır.
      this.spawnCell(org.id, pos, C.INITIAL_CELL_ENERGY, { x: rng.range(-1, 1), y: 0, z: rng.range(-1, 1) });
      if (preset === 'crowded') {
        // Sıkışık habitat: birkaç kurucu çift hücreli başlar (eşik denetimi için).
        if (i % 6 === 0) {
          const neighbor = this.findNearbySpawn(pos);
          this.spawnCell(org.id, neighbor, C.INITIAL_CELL_ENERGY * 0.8, { x: 1, y: 0, z: 0 });
          this.tryBond(org.id, [...org.cells].slice(-2), 1);
        }
      }
    }
    this.pushEvent('genesis', undefined, undefined, undefined, {
      population,
      preset,
      seed: rng.int(1_000_000),
    });
  }

  private randomSpawnPosition(rng: RngBundle['env']): Vec3 {
    for (let attempt = 0; attempt < 40; attempt++) {
      const pos = {
        x: rng.range(0.8, this.settings.size.x - 0.8),
        y: rng.range(0.8, this.settings.size.y - 0.8),
        z: rng.range(0.8, this.settings.size.z - 0.8),
      };
      if (this.isBlocked(pos)) continue;
      return pos;
    }
    return {
      x: this.settings.size.x * 0.5,
      y: this.settings.size.y * 0.5,
      z: this.settings.size.z * 0.5,
    };
  }

  private findNearbySpawn(origin: Vec3): Vec3 {
    const rng = this.rng.env;
    for (let attempt = 0; attempt < 30; attempt++) {
      const pos = {
        x: origin.x + rng.range(-0.6, 0.6),
        y: origin.y + rng.range(-0.5, 0.5),
        z: origin.z + rng.range(-0.6, 0.6),
      };
      this.grid.clamp(pos);
      if (!this.isBlocked(pos)) return pos;
    }
    return { ...origin };
  }

  /** Kaya içinde mi? (kayalar temel olarak görsel + çarpışma engelidir) */
  isBlocked(pos: Vec3): boolean {
    for (const rock of this.rocks) {
      const r = rock.radius * 1.05;
      if (dist2(rock.pos, pos) < r * r) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ yaşam döngüsü

  private createOrganism(
    genome: Genome,
    parentId: number | null,
    generation: number,
    mode: Organism['birthMode'],
  ): Organism {
    const id = this.nextOrganismId++;
    const rng = this.rng;
    const theta = initTheta(() => rng.inherit.float());
    const policy = new NeuralPolicy(theta, this.policyTuning);
    const org: Organism = {
      id,
      lineageId: 0,
      generation,
      birthMode: mode,
      bornTick: this.tick,
      parentOrganismId: parentId,
      genome,
      cells: [],
      // `neural` ve `policy.state` AYNI nesnedir: öğrenilen ağırlıklar
      // organizma kaydına da yansır (ayrı nesneler kullanılırsa öğrenme
      // kaydı kaybolur).
      neural: policy.state,
      lifetimeReward: 0,
      offspringProduced: 0,
      deathCause: null,
      alive: true,
      completedColonyGenerations: 0,
    };
    this.organisms.set(id, org);
    this.policies.set(id, policy);
    this.invalidateOrganismOrder();
    return org;
  }

  private spawnCell(organismId: number, pos: Vec3, energy: number, heading: Vec3): Cell {
    const org = this.organisms.get(organismId);
    const radius = radiusForCount(org ? org.cells.length + 1 : 1);
    const cell: Cell = {
      id: this.nextCellId++,
      organismId,
      pos: { ...pos },
      vel: { x: 0, y: 0, z: 0 },
      energy,
      energyNorm: energy / C.CELL_CAPACITY,
      ageTicks: 0,
      damage: 0,
      radius,
      bonds: [],
      heading: normalize(heading) ?? { x: 1, y: 0, z: 0 },
      alive: true,
    };
    this.cells.set(cell.id, cell);
    this.cellIds.push(cell.id);
    org?.cells.push(cell.id);
    return cell;
  }

  // ---------------------------------------------------------------- ana tick

  step(): void {
    this.tick++;
    const t = this.tick;

    this.rebuildGrid();
    const decision = this.tick % C.DECISION_EVERY_TICKS === 0;

    if (decision) this.decisionPhase();
    this.intentPhase();
    this.motionPhase();
    this.structurePhase();
    this.feedingPhase();
    this.metabolicPhase();
    this.bondPhase();
    this.sharingPhase();
    this.predationPhase();
    if (this.constraints.growthEnabled) this.divisionPhase();
    if (this.constraints.reproductionEnabled) this.buddingPhase();
    this.deathPhase();
    this.resourceRegenPhase();
    if (this.populationUpdateConfig.enabled) this.populationUpdatePhase();
    if (this.esConfig.enabled) this.esUpdatePhase();

    if (decision) this.rewardPhase();
    this.recordMetrics(t);
    if (this.tick % 200 === 0) this.compact();
  }

  private rebuildGrid(): void {
    const positions: Vec3[] = [];
    for (const id of this.cellIds) {
      const cell = this.cells.get(id);
      if (cell?.alive) positions.push(cell.pos);
    }
    this.grid.rebuild(positions);
  }

  /** Karar anı: ödül kapatma + algı + eylem örnekleme. */
  private decisionPhase(): void {
    this.decisionTick++;
    for (const orgId of this.organismOrder()) {
      const org = this.organisms.get(orgId);
      if (!org || !org.alive || org.cells.length === 0) continue;
      const policy = this.policies.get(orgId);
      if (!policy) continue;

      // Önceki kararın ödülünü kapat (gecikmiş ödül doğru adıma yazılır).
      const pendingE = this.pendingEnergy.get(orgId) ?? 0;
      const pendingD = this.pendingDamage.get(orgId) ?? 0;
      const pendingM = this.pendingMoveCost.get(orgId) ?? 0;
      if (policy.state.hasPrev && (pendingE !== 0 || pendingD !== 0 || pendingM !== 0)) {
        const reward = pendingE * REWARD_ENERGY_SCALE - pendingD * REWARD_DAMAGE_SCALE - pendingM * REWARD_MOVE_SCALE;
        policy.closeStep(reward);
        org.lifetimeReward += policy.state.prevReward;
      }
      this.pendingEnergy.set(orgId, 0);
      this.pendingDamage.set(orgId, 0);
      this.pendingMoveCost.set(orgId, 0);

      // Algı + öğrenme maliyeti (karar başına, hücre sayısı ölçekli).
      // ÖNEMLİ: bu maliyet hücrelerden GERÇEKTEN düşülür; yalnız defterde
      // "harcanmış" işaretlemek enerji yaratırdı (korunum ihlali).
      const cells = this.organismCells(org);
      const perceptionCost = perceptionCostFor(org.genome) * cells.length;
      const learningCost = learningCostFor(org.genome) * cells.length;
      this.chargeOrganism(org, perceptionCost + learningCost);
      this.pendingMoveCost.set(orgId, (this.pendingMoveCost.get(orgId) ?? 0) + learningCost);

      const centroid = this.centroidOf(org);
      let totalEnergy = 0;
      for (const id of org.cells) totalEnergy += this.cells.get(id)?.energy ?? 0;

      const obs = computeObservation({
        energyNorm: totalEnergy / (C.CELL_CAPACITY * cells.length),
        sizeNorm: (cells.length - 1) / Math.max(1, C.MAX_ORGANISM_CELLS - 1),
        genome: org.genome,
        pos: centroid,
        senseRadius: org.genome.senseRadius,
        nearbyResources: this.resources,
        predator: this.predator.alive ? { pos: this.predator.pos, radius: this.predator.radius } : null,
        selectionPressure: this.settings.selectionPressure,
        prevReward: policy.state.prevReward,
      });

      const info = policy.beginStep(obs, this.rng.action.float());
      // Mikroskop yalnızca GERÇEKTEN oluşmuş kararı gösterir.
      this.lastDecisions.set(orgId, info);
      this.intents.set(orgId, this.resolveIntent(org, info.action, obs));

      // Öğrenme açıksa ve bütçe dolmadıysa yörünge sınırında güncelle.
      if (this.constraints.learningEnabled && this.tick <= this.constraints.decisionBudget) {
        const update = policy.maybeUpdate(true, org.genome.plasticity);
        if (update?.applied) {
          this.pushEvent('learning-update', orgId, org.lineageId, undefined, {
            steps: update.steps,
            meanAdvantage: round(update.meanAdvantage, 5),
            gradNorm: round(update.gradNorm, 5),
            baseline: round(update.baselineAfter, 5),
          });
        }
      }
    }
  }

  /** Eylemi motor komutuna çevirir (organizma düzeyi niyet). */
  private resolveIntent(org: Organism, action: number, obs: Float64Array): { dir: Vec3; action: number; speedScale: number } {
    let dir: Vec3 | null;
    let speedScale: number;
    switch (action) {
      case 0: // A gradyanına yönel
        dir = { x: obs[2] as number, y: obs[3] as number, z: obs[4] as number };
        speedScale = 1;
        break;
      case 1: // B gradyanına yönel
        dir = { x: obs[5] as number, y: obs[6] as number, z: obs[7] as number };
        speedScale = 1;
        break;
      case 2: {
        // Keşfet: akış alanı + deterministik gürültü (RNG akışı tüketmez).
        const flow = currentAt(this.centroidOf(org), this.tick * C.TICK_MS / 1000, 1);
        const j = (k: number) => hashNoise(org.id, this.decisionTick, k);
        dir = normalize({
          x: flow.x + j(1) * 0.8,
          y: flow.y + j(2) * 0.5,
          z: flow.z + j(3) * 0.8,
        });
        speedScale = 0.8;
        break;
      }
      default: // Dinlen
        dir = { x: 0, y: 0, z: 0 };
        speedScale = 0.08;
        break;
    }
    return { dir: dir ?? { x: 0, y: 0, z: 0 }, action, speedScale };
  }

  /** Her hücre kendi yerel ayrışma kuvvetiyle niyeti uygular. */
  private intentPhase(): void {
    const timeSec = this.tick * (C.TICK_MS / 1000);
    for (const orgId of this.organismOrder()) {
      const org = this.organisms.get(orgId);
      if (!org || !org.alive) continue;
      const intent = this.intents.get(orgId);
      if (!intent) continue;
      const cells = this.organismCells(org);
      const radius = radiusForCount(cells.length);
      const maxSpeed = C.BASE_SPEED * (0.4 + 0.6 * org.genome.motility) * speedScaleForRadius(radius) * intent.speedScale;
      const flow = currentAt(this.centroidOf(org), timeSec, this.settings.currentStrength);

      for (const cellId of org.cells) {
        const cell = this.cells.get(cellId);
        if (!cell?.alive) continue;
        // Ayrışma kuvveti: komşu hücrelerden uzaklaş.
        const sep = this.separationVector(cell);
        // Yapışkanlık kuvveti: bağlı hücreler birbirini korur.
        const coh = this.cohesionVector(cell, org);
        const desired = normalize({
          x: intent.dir.x * 1.0 + sep.x * 0.85 + coh.x * 3.0 + flow.x * 0.9,
          y: intent.dir.y * 1.0 + sep.y * 0.85 + coh.y * 3.0 + flow.y * 0.9,
          z: intent.dir.z * 1.0 + sep.z * 0.85 + coh.z * 3.0 + flow.z * 0.9,
        }) ?? { x: 0, y: 0, z: 0 };
        cell.heading = desired;
        this.targetSpeed.set(cellId, maxSpeed * (0.55 + 0.45 * cell.energyNorm));
      }
    }
  }

  private targetSpeed = new Map<number, number>();

  /**
   * Yapışkanlık kuvveti: bağlı hücreler birbirini korur.
   *
   * Bu kuvvet olmadan "bağlı kalma" yalnızca bir olasılık değildir: hücreler
   * bağ kurar kurmaz kopar. Genomdaki `bondStrength` hem bağın kopma eşiğini
   * hem de bu kuvvetin şiddetini belirler — yani güçlü bağ hem dayanıklı hem
   * daha çok enerji harcar (`basalCostFor` içindeki bağ bakım maliyeti).
   */
  private cohesionVector(cell: Cell, org: Organism): Vec3 {
    if (cell.bonds.length === 0) return { x: 0, y: 0, z: 0 };
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const bondId of cell.bonds) {
      const bond = this.bonds.get(bondId);
      if (!bond) continue;
      const partnerId = bond.a === cell.id ? bond.b : bond.a;
      const partner = this.cells.get(partnerId);
      if (!partner?.alive) continue;
      const dx = partner.pos.x - cell.pos.x;
      const dy = partner.pos.y - cell.pos.y;
      const dz = partner.pos.z - cell.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-6) continue;
      // Dinlenme uzaklığına göre çekme/itme; kuvvet bağ dayanımıyla ölçeklenir.
      const over = (d - bond.restLength) / Math.max(0.2, bond.restLength);
      const pull = over > 0 ? Math.min(1.6, over * 2.2) : Math.max(-1.2, over * 3.0);
      const w = pull * (0.4 + 0.6 * bond.strength) * (0.4 + 0.6 * org.genome.bondStrength);
      sx += (dx / d) * w;
      sy += (dy / d) * w;
      sz += (dz / d) * w;
    }
    return { x: sx, y: sy, z: sz };
  }

  private separationVector(cell: Cell): Vec3 {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const near = this.grid.queryRadius(cell.pos, cell.radius * 2.6);
    for (const idx of near) {
      const otherId = this.cellIds[idx];
      if (otherId === undefined || otherId === cell.id) continue;
      const other = this.cells.get(otherId);
      if (!other?.alive || other.organismId === cell.organismId) continue;
      const dx = cell.pos.x - other.pos.x;
      const dy = cell.pos.y - other.pos.y;
      const dz = cell.pos.z - other.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const reach = (cell.radius + other.radius) * 1.15;
      if (d2 > reach * reach || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      const push = (reach - d) / reach;
      sx += (dx / d) * push;
      sy += (dy / d) * push;
      sz += (dz / d) * push;
    }
    return { x: sx, y: sy, z: sz };
  }

  private motionPhase(): void {
    for (const id of this.cellIds) {
      const cell = this.cells.get(id);
      if (!cell?.alive) continue;

      const targetSpeed = this.targetSpeed.get(id) ?? 0;
      const desiredVel = {
        x: cell.heading.x * targetSpeed,
        y: cell.heading.y * targetSpeed,
        z: cell.heading.z * targetSpeed,
      };
      // Sınırlı dönüş hızı: kütle ataletli davranış.
      cell.vel.x += (desiredVel.x - cell.vel.x) * C.TURN_RATE;
      cell.vel.y += (desiredVel.y - cell.vel.y) * C.TURN_RATE;
      cell.vel.z += (desiredVel.z - cell.vel.z) * C.TURN_RATE;

      cell.pos.x += cell.vel.x;
      cell.pos.y += cell.vel.y;
      cell.pos.z += cell.vel.z;

      // Kaya çarpışması: itme.
      for (const rock of this.rocks) {
        const dx = cell.pos.x - rock.pos.x;
        const dy = cell.pos.y - rock.pos.y;
        const dz = cell.pos.z - rock.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        const minD = rock.radius * 1.05 + cell.radius;
        if (d2 < minD * minD && d2 > 1e-9) {
          const d = Math.sqrt(d2);
          const push = (minD - d) / d;
          cell.pos.x += dx * push;
          cell.pos.y += dy * push;
          cell.pos.z += dz * push;
        }
      }

      this.grid.clamp(cell.pos);
      cell.ageTicks++;
      cell.energyNorm = cell.energy / C.CELL_CAPACITY;
    }
    this.targetSpeed.clear();
  }

  /** Beslenme: emilen enerji doğrudan kaynak rezervinden gelir. */
  private feedingPhase(): void {
    let aliveCount = 0;
    for (const id of this.cellIds) {
      const cell = this.cells.get(id);
      if (!cell?.alive) continue;
      aliveCount++;
      const org = this.organisms.get(cell.organismId);
      if (!org) continue;

      for (const node of this.resources) {
        if (node.reserve <= 1e-9) continue;
        const d = Math.sqrt(dist2(cell.pos, node.pos));
        const contact = intakeFor(org.genome, node.kind, cell.radius, node.radius, d, node.reserve / node.capacity);
        if (contact <= 0) continue;
        const gain = Math.min(contact, node.reserve, C.CELL_CAPACITY - cell.energy);
        if (gain <= 0) continue;
        cell.energy += gain;
        node.reserve -= gain;
        this.pendingEnergy.set(cell.organismId, (this.pendingEnergy.get(cell.organismId) ?? 0) + gain);
      }
      cell.energyNorm = cell.energy / C.CELL_CAPACITY;
    }
    this.livePopulation = aliveCount;
  }

  /** Bazal tüketim + hareket maliyeti: harcanan olarak kaydedilir. */
  private metabolicPhase(): void {
    const densityFactor = densityFactorFor(this.livePopulation);
    for (const id of this.cellIds) {
      const cell = this.cells.get(id);
      if (!cell?.alive) continue;
      const org = this.organisms.get(cell.organismId);
      if (!org) continue;

      const basal = basalCostFor(org.genome, cell.radius, cell.bonds.length, densityFactor);
      const speed = Math.sqrt(cell.vel.x ** 2 + cell.vel.y ** 2 + cell.vel.z ** 2);
      const move = moveCostFor(cell.radius, speed);

      // Hücre elindeki enerjiden fazlasını ödeyemez: ödenen miktar harcanır,
      // ödenemeyen kısım "borç" olarak yaratılmaz. Bu, korunum değişmezini
      // negatif enerji üretmeden korur.
      const cost = basal + move;
      const paid = Math.min(cell.energy, cost);
      cell.energy -= paid;
      this.ledger.dissipate(paid);
      this.pendingMoveCost.set(cell.organismId, (this.pendingMoveCost.get(cell.organismId) ?? 0) + paid);

      if (cell.energy <= 0) {
        cell.energy = 0;
        cell.damage = Math.max(cell.damage, 0.5);
      }
      cell.energyNorm = cell.energy / C.CELL_CAPACITY;
    }
  }

  /** Bağ bakımı: uzama, yorgunluk, kopma → parçalanma. */
  private bondPhase(): void {
    const toRemove: number[] = [];
    for (const bond of this.bonds.values()) {
      const a = this.cells.get(bond.a);
      const b = this.cells.get(bond.b);
      if (!a?.alive || !b?.alive) {
        toRemove.push(bond.id);
        continue;
      }
      const d = Math.sqrt(dist2(a.pos, b.pos));
      const strain = Math.max(0, (d - bond.restLength) / bond.restLength);
      bond.strain = strain;
      // Uzama bütünlüğü daha hızlı yiyip, bağ temel dayanımına göre dayanır.
      const strainK = this.bondTuning.strainDecayK ?? C.STRAIN_DECAY_K;
      const fatigue = this.bondTuning.bondFatigue ?? C.BOND_FATIGUE;
      bond.integrity -= strain * strainK * (1.6 - bond.strength);
      // Y-2 kancası: kapalıyken yorgunluk genenden bağımsızdır (ürün davranışı).
      bond.integrity -= this.bondTuning.coupleFatigueToGenome
        ? fatigue * (1.6 - bond.strength)
        : fatigue;
      if (bond.integrity <= 0 || d > C.BOND_BREAK_DISTANCE) {
        toRemove.push(bond.id);
      }
    }

    if (toRemove.length > 0) {
      const affected = new Set<number>();
      for (const bondId of toRemove) {
        const bond = this.bonds.get(bondId);
        if (!bond) continue;
        affected.add(bond.a);
        affected.add(bond.b);
        this.pushEvent('bond-break', this.cells.get(bond.a)?.organismId, undefined, bond.a, {
          peer: bond.b,
          strength: round(bond.strength, 4),
          integrity: round(Math.max(0, bond.integrity), 4),
          strain: round(bond.strain, 4),
        });
        this.destroyBond(bondId);
      }
      // Parçalanan organizmaları yeniden bileşenlere ayır.
      this.resolveFragmentation(affected);
    }
  }

  private destroyBond(bondId: number): void {
    const bond = this.bonds.get(bondId);
    if (!bond) return;
    const a = this.cells.get(bond.a);
    const b = this.cells.get(bond.b);
    if (a) {
      const idx = a.bonds.indexOf(bondId);
      if (idx >= 0) a.bonds.splice(idx, 1);
    }
    if (b) {
      const idx = b.bonds.indexOf(bondId);
      if (idx >= 0) b.bonds.splice(idx, 1);
    }
    this.bonds.delete(bondId);
  }

  /**
   * Bağ kopunca bağlı bileşenleri yeniden hesaplar.
   * En büyük bileşen mevcut kimliği sürdürür (eşitlikte kararlı sıra);
   * diğer canlı parçalar bağımsız yavru organizmalar olur.
   */
  private resolveFragmentation(affectedCellIds: ReadonlySet<number>): void {
    const orgIds = new Set<number>();
    for (const cellId of affectedCellIds) {
      const cell = this.cells.get(cellId);
      if (cell?.alive) orgIds.add(cell.organismId);
    }

    for (const orgId of orgIds) {
      const org = this.organisms.get(orgId);
      if (!org || !org.alive) continue;
      const aliveCells = org.cells.filter((id) => this.cells.get(id)?.alive);
      if (aliveCells.length <= 1) continue;

      const aliveBondIds = new Set<number>();
      for (const cellId of aliveCells) {
        for (const bondId of this.cells.get(cellId)?.bonds ?? []) aliveBondIds.add(bondId);
      }
      const relevantBonds: Bond[] = [];
      for (const bondId of aliveBondIds) {
        const bond = this.bonds.get(bondId);
        if (bond) relevantBonds.push(bond);
      }

      const components = connectedComponents(aliveCells, relevantBonds, (id) => this.bonds.has(id));
      if (components.length <= 1) continue;

      const keepIdx = chooseIdentityComponent(components);
      org.cells = (components[keepIdx] as { cells: number[] }).cells;

      for (let i = 0; i < components.length; i++) {
        if (i === keepIdx) continue;
        const part = components[i] as { cells: number[] };
        // Parçalanan doku genomu **birebir** devralır (mutasyon yoktur:
        // budalaşma/bağımsız doğum mutasyonlu olabilir, parçalanma olmaz).
        const child = this.createOrganism(clampGenome(org.genome), org.id, org.generation + 1, 'fragment');
        child.lineageId = org.lineageId;
        const childPolicy = this.policies.get(child.id);
        if (childPolicy) {
          // Parçalanan doku genomu birebir devralır; yeni canlı kendi
          // kalıtsal ağıyla ve SIFIR öğrenilmiş farkla başlar.
          childPolicy.resetWeights(org.neural.thetaInherited);
          child.neural = childPolicy.state;
        }
        for (const cellId of part.cells) {
          const cell = this.cells.get(cellId);
          if (!cell) continue;
          cell.organismId = child.id;
          child.cells.push(cellId);
        }
        this.lineageOf(child).organismIds.push(child.id);
        this.pushEvent('fragmentation', child.id, child.lineageId, undefined, {
          parentOrganismId: org.id,
          cells: part.cells.length,
          generation: child.generation,
        });
      }
      this.pushEvent('fragmentation', org.id, org.lineageId, undefined, {
        role: 'identity-retained',
        cells: org.cells.length,
      });
    }
  }

  /**
   * Yapısal düzeltme: bağlar bir "yay" gibi davranır.
   *
   * Yönlendirme (steering) tek başına yeterli değildir: iki hücre benzer
   * yöne baktığı halde farklı hızda ilerlediği için aralarındaki açıklık
   * zamanla artar ve bağ gerilimle kopar. Burada konum doğrudan, dinlenme
   * uzaklığına doğru yumuşak biçimde çekilir; böylece "bağlı kalmak" yalnız
   * olasılık değil, mekanik bir gerçek olur.
   *
   * Ek olarak çok hücreli organizmaların hücreleri merkeze doğru hafifçe
   * çekilir — koloninin tek bir gövde gibi davranmasını sağlar.
   */
  private structurePhase(): void {
    for (const bond of this.bonds.values()) {
      const a = this.cells.get(bond.a);
      const b = this.cells.get(bond.b);
      if (!a?.alive || !b?.alive) continue;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const dz = b.pos.z - a.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const over = d - bond.restLength;
      if (over <= 1e-6) continue;
      const stiffness = 0.1 * (0.5 + 0.5 * bond.strength);
      // Aşımın en fazla %20'si tek tick'te kapatılır (ani ıraksama olmaz).
      const corr = Math.min(over * stiffness, over * 0.2) * 0.5;
      const nx = (dx / d) * corr;
      const ny = (dy / d) * corr;
      const nz = (dz / d) * corr;
      a.pos.x += nx;
      a.pos.y += ny;
      a.pos.z += nz;
      b.pos.x -= nx;
      b.pos.y -= ny;
      b.pos.z -= nz;
    }

    // Çok hücreli gövdeler hafifçe merkeze çekilir (beden bütünlüğü).
    for (const orgId of this.organismOrder()) {
      const org = this.organisms.get(orgId);
      if (!org?.alive || org.cells.length < 3) continue;
      const centroid = this.centroidOf(org);
      const pull = 0.05 * (0.4 + 0.6 * org.genome.bondStrength);
      for (const cellId of org.cells) {
        const cell = this.cells.get(cellId);
        if (!cell?.alive) continue;
        cell.pos.x += (centroid.x - cell.pos.x) * pull;
        cell.pos.y += (centroid.y - cell.pos.y) * pull;
        cell.pos.z += (centroid.z - cell.pos.z) * pull;
        this.grid.clamp(cell.pos);
      }
    }
  }

  /**
   * Organizmadan maliyet tahsil eder.
   *
   * Hücrelerden düşülen miktar kadar `dissipate` edilir — böylece maliyet
   * hem biyolojik olarak (hücre enerjisi azalır) hem de muhasebesel olarak
   * (sistem toplamı azalır, harcanan artar) tutarlıdır. Hücrenin ödeyemediği
   * kısım borç olarak yaratılmaz.
   */
  private chargeOrganism(org: Organism, total: number): number {
    let remaining = total;
    let paid = 0;
    for (const cellId of org.cells) {
      const cell = this.cells.get(cellId);
      if (!cell?.alive) continue;
      const take = Math.min(cell.energy, remaining);
      cell.energy -= take;
      paid += take;
      remaining -= take;
      cell.energyNorm = Math.max(0, cell.energy / C.CELL_CAPACITY);
      if (remaining <= 1e-12) break;
    }
    this.ledger.dissipate(paid);
    return paid;
  }

  /** Bağlar boyunca sınırlı hızda enerji paylaşımı. */
  private sharingPhase(): void {
    for (const orgId of this.organismOrder()) {
      const org = this.organisms.get(orgId);
      if (!org || !org.alive || org.cells.length < 2) continue;
      const genome = org.genome;
      const transfers: { from: number; to: number; drawn: number; delivered: number }[] = [];

      for (const cellId of org.cells) {
        const a = this.cells.get(cellId);
        if (!a?.alive) continue;
        for (const bondId of a.bonds) {
          const bond = this.bonds.get(bondId);
          if (!bond) continue;
          const other = this.cells.get(bond.a === a.id ? bond.b : bond.a);
          if (!other?.alive) continue;
          const donor = a.energy >= other.energy ? a : other;
          const receiver = donor === a ? other : a;
          const { drawn } = shareAlongBond(donor.energy, receiver.energy, genome);
          if (drawn <= 0) continue;
          const delivered = drawn * C.TRANSPORT_EFFICIENCY;
          transfers.push({ from: donor.id, to: receiver.id, drawn, delivered });
        }
      }

      for (const t of transfers) {
        const from = this.cells.get(t.from);
        const to = this.cells.get(t.to);
        if (!from?.alive || !to?.alive) continue;
        if (from.energy < t.drawn || to.energy + t.delivered > C.CELL_CAPACITY) continue;
        from.energy -= t.drawn;
        to.energy += t.delivered;
        // Taşıma verim kaybı gerçekten harcanır → kapalı sistem korunur.
        this.ledger.dissipate(t.drawn - t.delivered);
      }
    }
  }

  /** Avcı: yerel seçilim baskısı. Öğrenen bir tür DEĞİLDİR. */
  private predationPhase(): void {
    const predator = this.predator;
    const pressure = this.settings.selectionPressure;
    if (!predator.alive || pressure <= 0) return;

    const timeSec = this.tick * (C.TICK_MS / 1000);
    const flow = currentAt(predator.pos, timeSec, this.settings.currentStrength * 1.6);
    // Avcı avını arar: en yakın yoğun organizma kümelerine doğru yönelir.
    // Bu bir öğrenme değil, düz bir avlanma davranışıdır.
    const hunt = this.huntDirection();
    const speed = C.PREDATOR_SPEED * (1 + 0.4 * Math.min(1, predator.energy / C.PREDATOR_CAPACITY));
    predator.vel.x += ((flow.x + hunt.x * C.PREDATOR_HUNT_WEIGHT) * speed - predator.vel.x) * 0.06;
    predator.vel.y += ((flow.y + hunt.y * C.PREDATOR_HUNT_WEIGHT) * speed - predator.vel.y) * 0.06;
    predator.vel.z += ((flow.z + hunt.z * C.PREDATOR_HUNT_WEIGHT) * speed - predator.vel.z) * 0.06;
    predator.pos.x += predator.vel.x;
    predator.pos.y += predator.vel.y;
    predator.pos.z += predator.vel.z;
    this.grid.clamp(predator.pos);

    const basal = Math.min(
      Math.max(C.PREDATOR_BASAL, predator.energy * C.PREDATOR_METABOLIC_RATE),
      predator.energy,
    );
    predator.energy -= basal;
    this.ledger.dissipate(basal);
    // Avcı açlığa düştüyse ölür: bu, avın toparlanmasını sağlayan
    // geri beslemedir. Yeniden sokulması oyuncunun ayrı bir müdahalesidir ve
    // enerjisi dış girdi olarak kaydedilir.
    if (predator.energy <= 1e-6) {
      predator.energy = 0;
      predator.alive = false;
      this.pushEvent('death', undefined, undefined, undefined, { entity: 'predator', cause: 'starvation' });
      return;
    }

    const captureRadius = captureRadiusFor(pressure, predator.radius);
    // Doygun (tip II) yanıt: erişimdeki hücre sayısı arttıkça yakalama olasılığı
    // artar, ancak bir tick'te en fazla bir hücre yakalanır (işleme süresi).
    // Her organizma için bağımsız zar atmak avcıyı seyrek popülasyonda bile
    // mutlak katil yapıyordu; bu biçim gerçek bir avcı-av geri beslemesidir.
    let target: Cell | null = null;
    let inRange = 0;
    for (const id of this.cellIds) {
      const cell = this.cells.get(id);
      if (!cell?.alive) continue;
      if (dist2(cell.pos, predator.pos) > captureRadius * captureRadius) continue;
      inRange++;
      if (!target || cell.radius > target.radius) target = cell;
    }
    if (!target || inRange === 0) return;

    const chance = captureChance(pressure, inRange);
    if (this.rng.env.float() >= chance) return;

    const orgId = target.organismId;
    const gain = target.energy;
    const room = C.PREDATOR_CAPACITY - predator.energy;
    const stored = Math.min(gain, Math.max(0, room));
    const excess = gain - stored;
    predator.energy += stored;
    target.energy -= gain;
    if (excess > 0) this.ledger.dissipate(excess);
    target.damage = Math.min(1, target.damage + 0.5);
    this.pendingDamage.set(orgId, (this.pendingDamage.get(orgId) ?? 0) + 0.5);
    predator.radius = C.PREDATOR_BASE_RADIUS * (1 + 0.35 * Math.sqrt(Math.max(0, predator.energy / C.PREDATOR_CAPACITY)));
    this.pushEvent('predation', orgId, this.organisms.get(orgId)?.lineageId, target.id, {
      pressure,
      inRange,
      captured: round(gain, 4),
      predatorEnergy: round(predator.energy, 3),
    });
    if (target.energy <= 0 || target.damage >= 1) {
      this.killCell(target);
      // Avcı öldürmesi de bağları koparır → parçalanma yeniden hesaplanmalıdır.
      // Aksi halde kopmuş hücreler "tek organizma" sayılmaya devam ederdi.
      this.finalizeOrganism(orgId, 'predation');
    }
  }

  /** Avcının avlanma yönü: yakındaki en değerli hücre kümelerine doğru birim vektör. */
  private huntDirection(): Vec3 {
    let bx = 0;
    let by = 0;
    let bz = 0;
    const reach = 9;
    for (const id of this.cellIds) {
      const cell = this.cells.get(id);
      if (!cell?.alive) continue;
      const dx = cell.pos.x - this.predator.pos.x;
      const dy = cell.pos.y - this.predator.pos.y;
      const dz = cell.pos.z - this.predator.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > reach * reach || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      // Yakın ve enerjili hücreler daha çekici.
      const w = (cell.energy + 8) / (d * d);
      bx += (dx / d) * w;
      by += (dy / d) * w;
      bz += (dz / d) * w;
    }
    const m = Math.sqrt(bx * bx + by * by + bz * bz);
    if (m < 1e-9) return { x: 0, y: 0, z: 0 };
    return { x: bx / m, y: by / m, z: bz / m };
  }

  /** Hücre bölünmesi: enerji korunur, organizma nesli DEĞİŞMEZ. */
  private divisionPhase(): void {
    const organisms: number[] = [];
    for (const orgId of this.organismOrder()) {
      const org = this.organisms.get(orgId);
      if (org?.alive) organisms.push(orgId);
    }

    for (const orgId of organisms) {
      const org = this.organisms.get(orgId);
      if (!org || !org.alive || org.cells.length >= C.MAX_ORGANISM_CELLS) continue;
      // Enerjisi en yüksek hücre bölünür (kolonide dengeli dağılım).
      let mother: Cell | null = null;
      for (const cellId of org.cells) {
        const cell = this.cells.get(cellId);
        if (!cell?.alive) continue;
        if (!mother || cell.energy > mother.energy) mother = cell;
      }
      if (!mother) continue;
      if (mother.energy < C.DIVIDE_THRESHOLD || mother.ageTicks < C.DIVIDE_MIN_AGE) continue;

      // Yavrunun anneye bağlı kalma olasılığı genomun `bondAffinity` değeridir.
      // Karar YAVRU DOĞURULMADAN verilir, çünkü bağlı doğan yavru daha yakın
      // konumlanmalıdır (aksi halde bağ doğar doğmaz kopar).
      const attached =
        this.constraints.bondsEnabled && this.rng.inherit.float() < org.genome.bondAffinity;
      const rest = C.BOND_REST_LENGTH * (1 + 0.35 * org.genome.bondStrength);

      const totalAfterCost = mother.energy - C.DIVISION_COST;
      if (totalAfterCost <= 0) continue;
      const motherEnergy = totalAfterCost * C.MOTHER_SHARE;
      const daughterEnergy = totalAfterCost * C.DAUGHTER_SHARE;

      const spawn = attached
        ? this.adjacentSpawn(mother.pos, mother.heading, rest * 0.82)
        : this.findNearbySpawn(mother.pos);
      const daughter = this.spawnCell(orgId, spawn, daughterEnergy, mother.heading);
      mother.energy = motherEnergy;
      this.ledger.dissipate(C.DIVISION_COST);

      this.refreshOrganismRadii(org);
      this.pushEvent('cell-division', orgId, org.lineageId, daughter.id, {
        motherEnergy: round(mother.energy, 5),
        daughterEnergy: round(daughter.energy, 5),
        cost: C.DIVISION_COST,
        cells: org.cells.length,
        attached,
      });

      if (attached) {
        this.createBond(mother.id, daughter.id, org.genome.bondStrength);
      } else {
        // Bağlanmayan yavru bağımsız bir organizma olur (budalaşma).
        this.splitOff(org, [daughter.id], 'bud');
      }
    }
  }

  /** Belirtilen yönde, belirtilen uzaklıkta geçerli bir konum bulur. */
  private adjacentSpawn(origin: Vec3, heading: Vec3, distance: number): Vec3 {
    const dir = normalize(heading) ?? { x: 1, y: 0, z: 0 };
    const jitter = () => hashNoise(Math.round(origin.x * 1000), Math.round(origin.z * 1000), Math.round(distance * 1000));
    const pos = {
      x: origin.x + dir.x * distance + jitter() * 0.12,
      y: origin.y + dir.y * distance + jitter() * 0.12,
      z: origin.z + dir.z * distance + jitter() * 0.12,
    };
    this.grid.clamp(pos);
    return pos;
  }

  /** Koloni düzeyinde tomurcuk ayrılması: canlı bağımsız yavru. */
  private buddingPhase(): void {
    for (const orgId of this.organismOrder()) {
      const org = this.organisms.get(orgId);
      if (!org?.alive || org.cells.length < C.BUD_MIN_CELLS) continue;
      let totalEnergy = 0;
      for (const cellId of org.cells) totalEnergy += this.cells.get(cellId)?.energy ?? 0;
      const rate = C.BUD_BASE_RATE * (totalEnergy / (C.CELL_CAPACITY * org.cells.length));
      if (this.rng.inherit.float() >= rate) continue;

      const size = Math.min(C.BUD_MAX_CELLS, org.cells.length - 2);
      if (size < 1) continue;
      const budCells = org.cells.slice(-size);
      this.splitOff(org, budCells, 'bud');
    }
  }

  /**
   * Verilen hücreleri organizmadan ayırıp bağımsız yavur çevirir.
   * Genom kopyalanır ve `mutationEnabled` açıksa sınırlar içinde mutasyona uğrar.
   * Organizma nesli bir artar.
   */
  private splitOff(org: Organism, cellIds: readonly number[], mode: Organism['birthMode']): void {
    if (org.cells.length - cellIds.length <= 0) return;

    const genome = this.constraints.mutationEnabled
      ? mutateGenome(org.genome, this.rng.inherit, 0.18, 1)
      : clampGenome(org.genome);

    // Yavrunun kalıtsal ağı: ebeveynin `thetaInherited` değerlerinden mutasyonla.
    const thetaChild = this.constraints.mutationEnabled
      ? NeuralPolicy.inheritedForChild(org.neural, this.rng.inherit, 0.12, 0.06)
      : org.neural.thetaInherited.slice();

    const child = this.createOrganism(genome, org.id, org.generation + 1, mode);
    child.lineageId = org.lineageId;
    const childPolicy = this.policies.get(child.id);
    if (childPolicy) {
      childPolicy.resetWeights(thetaChild);
      child.neural = childPolicy.state;
    }

    org.cells = org.cells.filter((id) => !cellIds.includes(id));
    org.offspringProduced++;
    org.completedColonyGenerations++;
    child.parentOrganismId = org.id;

    for (const cellId of cellIds) {
      const cell = this.cells.get(cellId);
      if (!cell) continue;
      cell.organismId = child.id;
      child.cells.push(cellId);
    }
    this.refreshOrganismRadii(org);
    this.refreshOrganismRadii(child);
    this.lineageOf(child).organismIds.push(child.id);

    this.pushEvent('bud-separation', child.id, child.lineageId, undefined, {
      parentOrganismId: org.id,
      cells: child.cells.length,
      generation: child.generation,
      mode,
    });
  }

  /** Ölüm temizliği: açlık, hasar, avcı. */
  private deathPhase(): void {
    const doomed: { cell: Cell; cause: NonNullable<DeathCause> }[] = [];
    for (const id of this.cellIds) {
      const cell = this.cells.get(id);
      if (!cell?.alive) continue;
      if (cell.energy <= 0) doomed.push({ cell, cause: 'starvation' });
      else if (cell.damage >= 1) doomed.push({ cell, cause: 'predation' });
    }
    if (doomed.length === 0) return;

    const causes = new Map<number, NonNullable<DeathCause>>();
    for (const { cell, cause } of doomed) {
      // Ölü hücrede kalan enerji havuza döner: harcanan olarak kaydedilir,
      // böylece sistemden sessizce kaybolmaz.
      if (cell.energy > 0) {
        this.ledger.dissipate(cell.energy);
        cell.energy = 0;
      }
      this.killCell(cell);
      if (!causes.has(cell.organismId)) causes.set(cell.organismId, cause);
    }
    for (const [orgId, cause] of causes) this.finalizeOrganism(orgId, cause);
  }

  private killCell(cell: Cell): void {
    if (!cell.alive) return;
    cell.alive = false;
    cell.energy = 0;
    for (const bondId of [...cell.bonds]) this.destroyBond(bondId);
  }

  /** Organizmanın son hücresi öldüyse kimliği kapat ve yörüngeyi bitir. */
  private finalizeOrganism(orgId: number, cause: NonNullable<DeathCause> = 'starvation'): void {
    const org = this.organisms.get(orgId);
    if (!org || !org.alive) return;
    org.cells = org.cells.filter((id) => this.cells.get(id)?.alive);
    if (org.cells.length > 0) {
      this.refreshOrganismRadii(org);
      // Ölü hücre bağları kopmuş olabilir: kalan hücreler artık bağlı değilse
      // aynı organizma sayılmaya devam etmemelidir (parçalanma kuralı).
      this.resolveFragmentation(new Set(org.cells));
      return;
    }
    org.alive = false;
    org.deathCause = cause;
    this.invalidateOrganismOrder();
    const policy = this.policies.get(orgId);
    if (policy) {
      // Ölümde kalan yörünge kapatılır ve güncelleme yapılır.
      if (this.constraints.learningEnabled) policy.onDeath(true, org.genome.plasticity);
      this.policies.delete(orgId);
    }
    this.pendingEnergy.delete(orgId);
    this.pendingDamage.delete(orgId);
    this.pendingMoveCost.delete(orgId);
    this.intents.delete(orgId);
    this.pushEvent('death', orgId, org.lineageId, undefined, {
      cause,
      generation: org.generation,
      lifetimeReward: round(org.lifetimeReward, 3),
      offspring: org.offspringProduced,
    });
  }

  private resourceRegenPhase(): void {
    for (const node of this.resources) {
      if (node.regenPerTick <= 0) continue;
      const amount = Math.min(node.regenPerTick, node.capacity - node.reserve);
      if (amount <= 0) continue;
      node.reserve += amount;
      this.ledger.addExternal(amount);
    }
  }

  /**
   * **Popülasyon-ES — adım-içi kredi ataması olmadan yaşam içi öğrenme.**
   *
   * Her `interval` tick'te:
   *   1. Her canlı organizmanın **son dönem getiri hızı** ölçülür
   *      (`Δ(lifetimeReward) / interval`). Kümülatif ödül kullanılmaz: o
   *      ölçüt yaşamayı ödüllendirir ve seçilim yanlılığı yaratır.
   *   2. Hızlar softmax ile ağırlıklandırılır (yüksek hız → yüksek ağırlık).
   *   3. Ağırlıklanmış popülasyon ortalaması θ* hesaplanır.
   *   4. Her organizma kendi ağırlıklarını θ*'ye doğru çeker:
   *      `θ ← θ + η·(0.25 + 0.75·plastisite)·(θ* − θ)`
   *
   * Bu bir **anti-drift** mekanizmasıdır: kötüye giden bir organizma iyi
   * eşitlerinin ağırlıklarına geri çekilir. Kredi ataması yoktur; tek kullanılan
   * sinyal epimiziktir.
   *
   * **Enerji muhasebesini etkilemez:** yalnız ağırlık değişir, enerji
   * yaratılmaz veya harcanmaz.
   */
  private populationUpdatePhase(): void {
    const { rate, interval } = this.populationUpdateConfig;
    if (this.tick % interval !== 0) return;

    const alive: { id: number; speed: number }[] = [];
    for (const id of this.organismOrder()) {
      const org = this.organisms.get(id);
      if (!org || !org.alive || org.cells.length === 0) continue;
      const prev = this.esCheckpointReward.get(id) ?? org.lifetimeReward;
      alive.push({ id, speed: (org.lifetimeReward - prev) / interval });
      this.esCheckpointReward.set(id, org.lifetimeReward);
    }
    if (alive.length < 2) return;

    // Softmax ağırlıkları. Sapma çok küçükse dağılım tek noktaya çöker;
    // bunu önlemek için sapma tabanı kullanılır.
    let meanSpeed = 0;
    for (const a of alive) meanSpeed += a.speed;
    meanSpeed /= alive.length;
    let variance = 0;
    for (const a of alive) variance += (a.speed - meanSpeed) ** 2;
    const sd = Math.sqrt(variance / alive.length);
    const denom = Math.max(sd, 1e-6);

    let sumWeight = 0;
    const weights: number[] = [];
    for (const a of alive) {
      // z-skoru [-3, 3] aralığına kırp → aşırı baskın birey olamaz.
      const z = Math.max(-3, Math.min(3, (a.speed - meanSpeed) / denom));
      const w = Math.exp(z);
      weights.push(w);
      sumWeight += w;
    }
    if (sumWeight <= 0) return;

    // Ağırlıklı popülasyon ortalaması.
    const target = new Float64Array(MLP_SHAPE.PARAM_COUNT);
    for (let i = 0; i < alive.length; i++) {
      const entry = alive[i] as { id: number; speed: number };
      const policy = this.policies.get(entry.id);
      if (!policy) continue;
      const share = (weights[i] as number) / sumWeight;
      const theta = policy.state.thetaLive;
      for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
        target[p] = (target[p] as number) + share * (theta[p] as number);
      }
    }

    // Her organizmayı hedefe çek.
    for (let i = 0; i < alive.length; i++) {
      const entry = alive[i] as { id: number; speed: number };
      const policy = this.policies.get(entry.id);
      const org = this.organisms.get(entry.id);
      if (!policy || !org) continue;
      const eta = rate * (0.25 + 0.75 * org.genome.plasticity);
      const theta = policy.state.thetaLive;
      for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
        theta[p] = (theta[p] as number) + eta * ((target[p] as number) - (theta[p] as number));
      }
    }
    this.populationUpdateCount++;
  }

  /** Kaç kez popülasyon-ES güncellemesi yapıldı (ölçüm). */
  populationUpdatesApplied(): number {
    return this.populationUpdateCount;
  }


  /**
   * Kendi snapshot'ını kurar.
   *
   * Neden burada: `persistence/snapshot.ts` bu modülü içe aktarıyor, dolayısıyla
   * `world.ts` onu içe aktaramaz (döngüsel bağımlılık). Aynı sebeple
   * `restorePolicyFromSnapshot` da bu dosyada kopyalanmış durumda.
   * `World.fromState` yapısal bir tip beklediği için bu yeterlidir.
   */
  private serializeSelf(): Parameters<typeof World.fromState>[0] {
    const organisms = [...this.organisms.values()].map((o) => ({
      id: o.id,
      lineageId: o.lineageId,
      generation: o.generation,
      birthMode: o.birthMode,
      bornTick: o.bornTick,
      parentOrganismId: o.parentOrganismId,
      genome: { ...o.genome },
      cells: [...o.cells],
      neural: {
        thetaInherited: Array.from(o.neural.thetaInherited),
        thetaLive: Array.from(o.neural.thetaLive),
        baseline: o.neural.baseline,
        prevReward: o.neural.prevReward,
        prevObs: o.neural.prevObs ? Array.from(o.neural.prevObs) : null,
        prevAction: o.neural.prevAction,
        prevLogProb: o.neural.prevLogProb,
        prevBaseline: o.neural.prevBaseline,
        hasPrev: o.neural.hasPrev,
      },
      lifetimeReward: o.lifetimeReward,
      offspringProduced: o.offspringProduced,
      deathCause: o.deathCause,
      alive: o.alive,
      completedColonyGenerations: o.completedColonyGenerations,
      trajectory: [],
      decisionCount: this.policies.get(o.id)?.decisionCount ?? 0,
      updateCount: this.policies.get(o.id)?.updateCount ?? 0,
    }));

    return {
      tick: this.tick,
      settings: { ...this.settings, size: { ...this.settings.size } },
      constraints: { ...this.constraints },
      rng: this.rng.getState(),
      ledger: {
        initialTotal: this.ledger.initialTotal,
        externalInput: this.ledger.externalInput,
        dissipated: this.ledger.dissipated,
      },
      counters: {
        nextCellId: this.nextCellId,
        nextBondId: this.nextBondId,
        nextOrganismId: this.nextOrganismId,
        nextResourceId: this.nextResourceId,
        nextRockId: this.nextRockId,
        nextEventId: this.nextEventId,
        nextInterventionId: this.nextInterventionId,
      },
      cells: [...this.cells.values()].map((c) => ({
        ...c,
        pos: { ...c.pos },
        vel: { ...c.vel },
        heading: { ...c.heading },
        bonds: [...c.bonds],
      })),
      cellIds: [...this.cellIds],
      bonds: [...this.bonds.values()].map((b) => ({ ...b })),
      organisms,
      lineages: [...this.lineages.values()].map((l) => ({
        ...l,
        organismIds: [...l.organismIds],
        meanGenome: { ...l.meanGenome },
      })),
      resources: this.resources.map((r) => ({ ...r, pos: { ...r.pos } })),
      rocks: this.rocks.map((r) => ({ ...r, pos: { ...r.pos } })),
      predator: { ...this.predator, pos: { ...this.predator.pos }, vel: { ...this.predator.vel } },
      events: this.events.recent(this.events.size ? this.events.size : 0),
      metrics: this.metricsHistory.recent(this.metricsHistory.size ? this.metricsHistory.size : 0),
      interventions: this.interventions.map((i) => ({ ...i })),
      pending: {
        energy: [...this.pendingEnergy.entries()],
        damage: [...this.pendingDamage.entries()],
        moveCost: [...this.pendingMoveCost.entries()],
      },
    };
  }

  /**
   * **S-4 · Çatallanmış ortamda yaşam içi üstel arama.**
   *
   * Kredi ataması **yoktur**. Algoritma:
   *   1. Uygun bir organizma seçilir (plastisitesi olan yaşayanlar arasından).
   *   2. Dünya **bir kez** snapshot'lanır; N+1 dal bu tek snapshot'tan açılır.
   *   3. Her dalda organizmanın ağırlıkları `θ + σξ` ile pertürbe edilir,
   *      dal `evaluateTicks` kadar ilerletilir ve uygunluk ölçülür
   *      (organizmanın toplam hücre enerjisi).
   *   4. `A_i = R_i − mean(R)`; θ, getiriye ağırlıklı pertürbasyon ortalaması
   *      boyunca kaydırılır: `θ ← θ + α/N · Σ A_i ξ_i`.
   *
   * Maliyet tek snapshot sayesinde N−1 snapshot tasarrufu sağlar ve §6.9'da
   * ölçülen ≈25 tick/çatal değeriyle bütçelenebilir.
   *
   * **Enerji muhasebesini etkilemez:** dallar ayrı dünyalardır; yaşayan dünyada
   * yalnız ağırlıklar değişir.
   */
  private esUpdatePhase(): void {
    const cfg = this.esConfig;
    if (this.tick % cfg.interval !== 0) return;

    // 1) Uygunluk: yaşayan ve plastisitesi olan organizmalar.
    const eligible: number[] = [];
    for (const id of this.organismOrder()) {
      const org = this.organisms.get(id);
      if (!org || !org.alive || org.cells.length === 0) continue;
      if (org.genome.plasticity <= 0) continue;
      eligible.push(id);
    }
    if (eligible.length === 0) return;
    // En eski uygun bireyden başlayarak sırayla tüm uygunları kapsar.
    const targetId = eligible[this.esUpdateCount % eligible.length] as number;
    const targetPolicy = this.policies.get(targetId);
    const targetOrg = this.organisms.get(targetId);
    if (!targetPolicy || !targetOrg) return;

    const theta0 = Float64Array.from(targetPolicy.state.thetaLive);
    const started = performance.now();

    // 2) Tek snapshot → N+1 dal
    const snapshot = this.serializeSelf();
    /**
     * Uygunluk: pencerede **kazanılan** net enerji (bitiş − başlangıç).
     *
     * ⚠️ Anlık enerji seviyesi **kullanılamaz**: doygun bir organizma kapasiteye
     * yakınken hangi eylemi seçtiğinden bağımsız olarak aynı değeri verir ve
     * tüm çatallar berabere kalır (ölçüldü: üç farklı pertürbasyon 16 haneli
     * aynı sonucu verdi). Kazanç ölçümü doymaz ve davranışa duyarlıdır.
     */
    const energyOf = (w: World, id: number): number => {
      const org = w.organisms.get(id);
      if (!org) return Number.NEGATIVE_INFINITY;
      let energy = 0;
      for (const cellId of org.cells) {
        const c = w.cells.get(cellId);
        if (c?.alive) energy += c.energy;
      }
      return energy;
    };

    const fitnessOf = (theta: Float64Array | null): number => {
      const fork = World.fromState(snapshot);
      if (theta) {
        const fp = fork.policies.get(targetId);
        if (fp) {
          fp.state.thetaLive.set(theta);
          fp.state.thetaInherited.set(theta);
          const fo = fork.organisms.get(targetId);
          if (fo) fo.neural.thetaLive.set(theta);
        }
      }
      const before = energyOf(fork, targetId);
      for (let t = 0; t < cfg.evaluateTicks; t++) fork.step();
      if (!fork.organisms.get(targetId)?.alive) return Number.NEGATIVE_INFINITY;
      return energyOf(fork, targetId) - before;
    };

    const baseline = fitnessOf(null);
    const r: number[] = [];
    const perturbations: Float64Array[] = [];
    const noise = this.rng.evolve;
    for (let i = 0; i < cfg.perturbations; i++) {
      const xi = new Float64Array(MLP_SHAPE.PARAM_COUNT);
      const theta = new Float64Array(MLP_SHAPE.PARAM_COUNT);
      for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
        const e = cfg.sigma * noise.normal();
        xi[p] = e;
        theta[p] = (theta0[p] as number) + e;
      }
      perturbations.push(xi);
      r.push(fitnessOf(theta));
    }

    // 4) Avantajlar ve adım
    let meanR = 0;
    for (const v of r) meanR += v;
    meanR /= Math.max(1, r.length);

    const step = (cfg.learningRate * (0.25 + 0.75 * targetOrg.genome.plasticity)) / r.length;
    for (let i = 0; i < r.length; i++) {
      const advantage = (r[i] as number) - meanR;
      if (advantage === 0) continue;
      const xi = perturbations[i] as Float64Array;
      for (let p = 0; p < MLP_SHAPE.PARAM_COUNT; p++) {
        targetPolicy.state.thetaLive[p] = (targetPolicy.state.thetaLive[p] as number) + step * advantage * (xi[p] as number);
      }
    }

    this.esUpdateCount++;
    this.esSpentMs += performance.now() - started;
    this.esLastGain = meanR - baseline;
  }

  /** S-4 üstel arama ölçümleri (raporlama). */
  evolutionSearchStats(): { updates: number; spentMs: number; lastGain: number } {
    return { updates: this.esUpdateCount, spentMs: this.esSpentMs, lastGain: this.esLastGain };
  }

  /** Ödül kapanışı yalnızca karar adımında yapılır (decisionPhase içinde). */
  private rewardPhase(): void {
    // Karar fazında zaten kapatıldı; burada yalnız bütçe kontrolü yapılır.
    if (this.tick > this.constraints.decisionBudget && this.constraints.learningEnabled) {
      this.constraints.learningEnabled = false;
      this.settings.learningEnabled = false;
      this.recordIntervention('learning', 'global', 0, 'karar bütçesi doldu — öğrenme kapatıldı');
    }
  }

  // -------------------------------------------------------------- kayıt/olay

  private recordMetrics(_t: number): void {
    if (this.tick % 20 !== 0) return;
    this.metricTick++;
    let totalEnergy = 0;
    let largestColony = 0;
    let multiCell = 0;
    let coloniesOverFour = 0;
    let maxGeneration = 0;

    for (const org of this.organisms.values()) {
      if (!org.alive) continue;
      const n = org.cells.filter((id) => this.cells.get(id)?.alive).length;
      if (n === 0) continue;
      if (n > largestColony) largestColony = n;
      if (n > 1) multiCell++;
      if (n >= C.MULTICELL_THRESHOLD) coloniesOverFour++;
      if (org.generation > maxGeneration) maxGeneration = org.generation;
    }
    let population = 0;
    for (const cell of this.cells.values()) {
      if (!cell.alive) continue;
      population++;
      totalEnergy += cell.energy;
    }

    this.metricsHistory.push({
      tick: this.tick,
      population,
      organismCount: this.aliveOrganismCount(),
      meanEnergy: population > 0 ? totalEnergy / population : 0,
      totalEnergy,
      largestColonySize: largestColony,
      multiCellOrganisms: multiCell,
      bondCount: this.bonds.size,
      predatorEnergy: this.predator.energy,
      coloniesOverFourCells: coloniesOverFour,
      learningUpdates: this.learningUpdateCount(),
      maxGeneration,
    });
  }

  private pushEvent(
    type: SimEventType,
    organismId?: number,
    lineageId?: number,
    cellId?: number,
    detail?: Record<string, string | number | boolean>,
  ): void {
    this.events.push({
      id: this.nextEventId++,
      tick: this.tick,
      type,
      ...(organismId !== undefined ? { organismId } : {}),
      ...(lineageId !== undefined ? { lineageId } : {}),
      ...(cellId !== undefined ? { cellId } : {}),
      ...(detail ? { detail } : {}),
    });
  }

  // -------------------------------------------------------------- dış müdahale

  addNutrient(kind: 'A' | 'B', amount: number): void {
    let remaining = amount;
    const nodes = this.resources.filter((n) => n.kind === kind);
    if (nodes.length === 0) return;
    const share = amount / nodes.length;
    for (const node of nodes) {
      const added = Math.min(share, node.capacity - node.reserve);
      node.reserve += added;
      node.externalInput += added;
      remaining -= added;
    }
    this.ledger.addExternal(amount - Math.max(0, remaining));
    this.recordIntervention('nutrient', kind, amount, `${round(amount, 3)} e dış girdi eklendi`);
  }

  setSetting(
    key: 'light' | 'currentStrength' | 'selectionPressure',
    value: number,
  ): void;
  setSetting(key: 'learningEnabled', value: boolean): void;
  setSetting(key: 'light' | 'currentStrength' | 'selectionPressure' | 'learningEnabled', value: number | boolean): void {
    if (key === 'learningEnabled') {
      const on = Boolean(value);
      this.settings.learningEnabled = on;
      this.constraints.learningEnabled = on;
      this.recordIntervention('learning', 'global', on ? 1 : 0, on ? 'öğrenme açıldı' : 'öğrenme kapatıldı');
      return;
    }
    const numeric = Number(value);
    this.settings[key] = numeric;
    this.recordIntervention(
      key === 'selectionPressure' ? 'pressure' : key === 'currentStrength' ? 'current' : 'light',
      'global',
      numeric,
    );
  }

  recordIntervention(kind: Intervention['kind'], target: string, value: number, note?: string): void {
    this.interventions.push({
      id: this.nextInterventionId++,
      tick: this.tick,
      kind,
      target,
      value,
      ...(note ? { note } : {}),
    });
    if (this.interventions.length > 400) this.interventions.shift();
    this.pushEvent('intervention', undefined, undefined, undefined, {
      kind,
      target,
      value: round(value, 5),
    });
  }

  // ------------------------------------------------------------------ sorgular

  /** Yaşayan organizma kimlikleri (artan sırada, önbellekli). */
  organismOrder(): number[] {
    if (this.aliveOrderCache === null) {
      const alive: number[] = [];
      for (const [id, org] of this.organisms) if (org.alive) alive.push(id);
      alive.sort((a, b) => a - b);
      this.aliveOrderCache = alive;
    }
    return this.aliveOrderCache;
  }

  /** Organizma eklendiğinde/öldüğünde sıralama önbelleğini düşürür. */
  private invalidateOrganismOrder(): void {
    this.aliveOrderCache = null;
  }

  aliveOrganismCount(): number {
    let n = 0;
    for (const org of this.organisms.values()) if (org.alive) n++;
    return n;
  }

  learningUpdateCount(): number {
    let n = 0;
    for (const orgId of this.organisms.keys()) n += this.policies.get(orgId)?.updateCount ?? 0;
    return n;
  }

  systemEnergyTotal(): number {
    let total = this.predator.energy;
    for (const cell of this.cells.values()) if (cell.alive) total += cell.energy;
    for (const node of this.resources) total += node.reserve;
    return total;
  }

  population(): number {
    let n = 0;
    for (const cell of this.cells.values()) if (cell.alive) n++;
    return n;
  }

  centroidOf(org: Organism): Vec3 {
    return this.centroidOfCells(org.cells);
  }

  private centroidOfCells(cellIds: readonly number[]): Vec3 {
    let x = 0;
    let y = 0;
    let z = 0;
    let n = 0;
    for (const id of cellIds) {
      const cell = this.cells.get(id);
      if (!cell?.alive) continue;
      x += cell.pos.x;
      y += cell.pos.y;
      z += cell.pos.z;
      n++;
    }
    return n === 0 ? { x: 0, y: 0, z: 0 } : { x: x / n, y: y / n, z: z / n };
  }

  organismCells(org: Organism): Cell[] {
    const out: Cell[] = [];
    for (const id of org.cells) {
      const cell = this.cells.get(id);
      if (cell?.alive) out.push(cell);
    }
    return out;
  }

  private refreshOrganismRadii(org: Organism): void {
    const n = org.cells.length;
    if (n === 0) return;
    const radius = radiusForCount(n);
    for (const id of org.cells) {
      const cell = this.cells.get(id);
      if (cell) cell.radius = radius;
    }
  }

  /** Bir hücrenin bağ yaratmasını dener (kalıtsal eğilime göre). */
  private tryBond(organismId: number, cellIds: readonly number[], force: number): void {
    const org = this.organisms.get(organismId);
    if (!org) return;
    const [a, b] = cellIds;
    if (a === undefined || b === undefined) return;
    const ca = this.cells.get(a);
    const cb = this.cells.get(b);
    if (!ca?.alive || !cb?.alive) return;
    if (this.rng.inherit.float() > force) return;
    this.createBond(a, b, org.genome.bondStrength);
  }

  createBond(cellA: number, cellB: number, strength: number): Bond {
    const id = this.nextBondId++;
    const bond: Bond = {
      id,
      a: cellA,
      b: cellB,
      strength: Math.max(0.05, Math.min(1, strength)),
      integrity: 1,
      strain: 0,
      restLength: C.BOND_REST_LENGTH * (1 + 0.35 * Math.max(0, strength)),
    };
    this.bonds.set(id, bond);
    this.cells.get(cellA)?.bonds.push(id);
    this.cells.get(cellB)?.bonds.push(id);
    this.pushEvent('bond-formation', this.cells.get(cellA)?.organismId, undefined, cellA, {
      peer: cellB,
      strength: round(bond.strength, 4),
    });
    return bond;
  }

  private lineageOf(org: Organism): Lineage {
    let lineage = this.lineages.get(org.lineageId);
    if (!lineage) {
      lineage = createLineage(org.lineageId, org.id, org.bornTick, org.genome);
      this.lineages.set(org.lineageId, lineage);
    }
    return lineage;
  }

  /** Kurucu organizmaların soy kimliğini ata (ilk kurulumda çağrılır). */
  assignFounderLineages(): void {
    const founders: Organism[] = [];
    for (const org of this.organisms.values()) {
      if (org.birthMode === 'genesis' && org.parentOrganismId === null) founders.push(org);
    }
    founders.sort((a, b) => a.id - b.id);
    // 12 kurucu soy; her soy bir grup organizma barındırır.
    const perLineage = Math.max(1, Math.ceil(founders.length / 12));
    let lineageIndex = -1;
    for (let i = 0; i < founders.length; i++) {
      if (i % perLineage === 0) {
        lineageIndex++;
        const lineage = createLineage(lineageIndex, (founders[i] as Organism).id, this.tick, (founders[i] as Organism).genome);
        this.lineages.set(lineageIndex, lineage);
      }
      const org = founders[i] as Organism;
      org.lineageId = lineageIndex;
      this.lineages.get(lineageIndex)?.organismIds.push(org.id);
    }
    // Soy ortalama genomlerini tazele.
    for (const lineage of this.lineages.values()) {
      const genomes = lineage.organismIds
        .map((id) => this.organisms.get(id))
        .filter((o): o is Organism => !!o)
        .map((o) => o.genome);
      lineage.meanGenome = meanGenome(genomes);
    }
  }

  latestMetrics(): MetricsSample | undefined {
    return this.metricsHistory.last();
  }

  /** Seçili organizmanın son gerçek kararı (yoksa undefined). */
  lastDecision(organismId: number): DecisionInfo | undefined {
    return this.lastDecisions.get(organismId);
  }

  /** Kararı yeniden oku: bir sonraki karar tick'inde tazelenir. */
  pendingDecisionCount(): number {
    return this.lastDecisions.size;
  }

  recentEvents(n: number): SimEvent[] {
    return this.events.recent(n);
  }

  /** Temizlik: ölü hücreleri ve ölü organizmaları listeden düşürür. */
  compact(): void {
    if (this.cellIds.length > 0) {
      this.cellIds = this.cellIds.filter((id) => this.cells.get(id)?.alive);
      for (const [id, cell] of [...this.cells]) if (!cell.alive) this.cells.delete(id);
    }
    for (const [id, org] of [...this.organisms]) {
      if (!org.alive && this.tick - org.bornTick > 600) {
        this.organisms.delete(id);
        this.invalidateOrganismOrder();
      }
    }
  }

  // --------------------------------------------------------- kayıt/geri yükleme

  nextCellIdForSnapshot(): number {
    return this.nextCellId;
  }
  nextBondIdForSnapshot(): number {
    return this.nextBondId;
  }
  nextOrganismIdForSnapshot(): number {
    return this.nextOrganismId;
  }
  nextResourceIdForSnapshot(): number {
    return this.nextResourceId;
  }
  nextRockIdForSnapshot(): number {
    return this.nextRockId;
  }
  nextEventIdForSnapshot(): number {
    return this.nextEventId;
  }
  nextInterventionIdForSnapshot(): number {
    return this.nextInterventionId;
  }
  pendingEnergySnapshot(): [number, number][] {
    return [...this.pendingEnergy.entries()];
  }
  pendingDamageSnapshot(): [number, number][] {
    return [...this.pendingDamage.entries()];
  }
  pendingMoveCostSnapshot(): [number, number][] {
    return [...this.pendingMoveCost.entries()];
  }

  /**
   * Doğrulanmış bir snapshot'tan dünya kurar (kurucu simülasyonu çalıştırmadan).
   * `snapshot.ts` içindeki `validateSnapshot` önceden çağrılmalıdır.
   */
  static fromState(
    snapshot: {
      tick: number;
      settings: HabitatSettings;
      constraints: ExperimentConstraints;
      rng: { env: number; inherit: number; action: number };
      ledger: { initialTotal: number; externalInput: number; dissipated: number };
      counters: Record<string, number>;
      cells: Cell[];
      cellIds: number[];
      bonds: Bond[];
      organisms: SnapshotOrganismLike[];
      lineages: Lineage[];
      resources: ResourceNode[];
      rocks: Rock[];
      predator: Predator;
      events: SimEvent[];
      metrics: MetricsSample[];
      interventions: Intervention[];
      pending: { energy: [number, number][]; damage: [number, number][]; moveCost: [number, number][] };
    },
    options: Partial<WorldOptions> = {},
  ): World {
    const size = snapshot.settings.size;
    // Kurucu döngüyü atlamak için bayt düzeyinde boş bir dünya oluşturulur.
    //
    // ⚠️ `Object.create(World.prototype)` **constructor'ı çağırmaz**, bu yüzden
    // sınıf alan başlatıcıları (`readonly ledger = new EnergyLedger()` gibi)
    // HİÇ çalışmaz ve alanlar `undefined` kalır. Aşağıdaki blok onları açıkça
    // kurar. Bu blok olmadan ilk `world.ledger.reset(...)` çağrısı TypeError
    // atıyor ve **snapshot'tan dünya kurma (ve dolayısıyla `branch`) tamamen
    // bozuk** oluyordu. Test: `tests/world.test.ts` → "snapshot → dünya".
    const world = Object.create(World.prototype) as World;
    const init = world as unknown as {
      ledger: EnergyLedger;
      events: RingBuffer<SimEvent>;
      metricsHistory: RingBuffer<MetricsSample>;
      nextCellId: number;
      nextBondId: number;
      nextOrganismId: number;
      nextResourceId: number;
      nextRockId: number;
      nextEventId: number;
      nextInterventionId: number;
      pendingEnergy: Map<number, number>;
      pendingDamage: Map<number, number>;
      pendingMoveCost: Map<number, number>;
      intents: Map<number, { dir: Vec3; action: number; speedScale: number }>;
      lastDecisions: Map<number, DecisionInfo>;
      targetSpeed: Map<number, number>;
      decisionTick: number;
      metricTick: number;
      livePopulation: number;
      aliveOrderCache: number[] | null;
      esCheckpointReward: Map<number, number>;
      populationUpdateCount: number;
      esConfig: {
        enabled: boolean;
        interval: number;
        perturbations: number;
        evaluateTicks: number;
        sigma: number;
        learningRate: number;
      };
      esUpdateCount: number;
      esSpentMs: number;
      esLastGain: number;
      bondTuning: {
        bondFatigue?: number;
        strainDecayK?: number;
        coupleFatigueToGenome?: boolean;
      };
      populationUpdateConfig: { enabled: boolean; rate: number; interval: number };
    };
    init.ledger = new EnergyLedger();
    init.events = new RingBuffer<SimEvent>(2000);
    init.metricsHistory = new RingBuffer<MetricsSample>(600);
    init.nextCellId = 1;
    init.nextBondId = 1;
    init.nextOrganismId = 1;
    init.nextResourceId = 1;
    init.nextRockId = 1;
    init.nextEventId = 1;
    init.nextInterventionId = 1;
    init.pendingEnergy = new Map();
    init.pendingDamage = new Map();
    init.pendingMoveCost = new Map();
    init.intents = new Map();
    init.lastDecisions = new Map();
    init.targetSpeed = new Map();
    init.decisionTick = 0;
    init.metricTick = 0;
    init.livePopulation = 0;
    init.aliveOrderCache = null;
    init.esCheckpointReward = new Map();
    init.populationUpdateCount = 0;
    // S-4 **bilinçli olarak kapalı** başlatılır: `esUpdatePhase` dalları
    // `World.fromState` ile kurar; dallarda arama yeniden çalışırsa sonsuz
    // özyineleme olur. Arama yalnız yaşayan dünyada, kurucu seçenekleriyle açılır.
    init.esConfig = {
      enabled: options.esInterval !== undefined || options.esPerturbations !== undefined,
      interval: Math.max(1, options.esInterval ?? 500),
      perturbations: Math.max(1, options.esPerturbations ?? 8),
      evaluateTicks: Math.max(1, options.esEvaluateTicks ?? 60),
      sigma: options.esSigma ?? 0.05,
      learningRate: options.esLearningRate ?? 0.02,
    };
    init.esUpdateCount = 0;
    init.esSpentMs = 0;
    init.esLastGain = 0;
    // Duyarlılık kancaları boş bırakılırsa `C` sabitlerine düşer → ürün
    // davranışı korunur. Snapshot'ta saklanmıyorlar çünkü ölçüm aracıdırlar.
    init.bondTuning = {};
    init.populationUpdateConfig = {
      enabled: options.populationUpdate ?? false,
      rate: options.populationUpdateRate ?? 0.06,
      interval: Math.max(1, options.populationUpdateInterval ?? 500),
    };

    world.version = SIM_VERSION;
    world.tick = snapshot.tick;
    world.settings = { ...snapshot.settings, size: { ...size } };
    world.constraints = { ...snapshot.constraints };
    world.rng = new RngBundle(1);
    world.rng.setState(snapshot.rng);
    world.ledger.reset(snapshot.ledger.initialTotal);
    world.ledger.externalInput = snapshot.ledger.externalInput;
    world.ledger.dissipated = snapshot.ledger.dissipated;

    world.cells = new Map();
    world.cellIds = [...snapshot.cellIds];
    world.bonds = new Map();
    world.organisms = new Map();
    world.policies = new Map();
    world.lineages = new Map();
    world.resources = snapshot.resources.map((r) => ({ ...r, pos: { ...r.pos } }));
    world.rocks = snapshot.rocks.map((r) => ({ ...r, pos: { ...r.pos } }));
    world.predator = { ...snapshot.predator, pos: { ...snapshot.predator.pos }, vel: { ...snapshot.predator.vel } };

    for (const cell of snapshot.cells) {
      world.cells.set(cell.id, {
        ...cell,
        pos: { ...cell.pos },
        vel: { ...cell.vel },
        heading: { ...cell.heading },
        bonds: [...cell.bonds],
      });
    }
    for (const bond of snapshot.bonds) world.bonds.set(bond.id, { ...bond });

    for (const snap of snapshot.organisms) {
      const org: Organism = {
        id: snap.id,
        lineageId: snap.lineageId,
        generation: snap.generation,
        birthMode: snap.birthMode as Organism['birthMode'],
        bornTick: snap.bornTick,
        parentOrganismId: snap.parentOrganismId,
        genome: { ...snap.genome },
        cells: [...snap.cells],
        neural: {
          thetaInherited: Float64Array.from(snap.neural.thetaInherited),
          thetaLive: Float64Array.from(snap.neural.thetaLive),
          baseline: snap.neural.baseline,
          prevReward: snap.neural.prevReward,
          prevObs: snap.neural.prevObs ? Float64Array.from(snap.neural.prevObs) : null,
          prevAction: snap.neural.prevAction,
          prevLogProb: snap.neural.prevLogProb,
          prevBaseline: snap.neural.prevBaseline,
          hasPrev: snap.neural.hasPrev,
        },
        lifetimeReward: snap.lifetimeReward,
        offspringProduced: snap.offspringProduced,
        deathCause: (snap.deathCause ?? null) as Organism['deathCause'],
        alive: snap.alive,
        completedColonyGenerations: snap.completedColonyGenerations,
      };
      const policy = restorePolicyFromSnapshot(snap);
      org.neural = policy.state;
      world.organisms.set(org.id, org);
      world.policies.set(org.id, policy);
    }
    for (const lineage of snapshot.lineages) {
      world.lineages.set(
        lineage.id,
        { ...lineage, organismIds: [...lineage.organismIds], meanGenome: { ...lineage.meanGenome } },
      );
    }

    world.events.set(snapshot.events);
    world.metricsHistory.set(snapshot.metrics);
    world.interventions = snapshot.interventions.map((i) => ({ ...i }));

    world.pendingEnergy = new Map(snapshot.pending.energy);
    world.pendingDamage = new Map(snapshot.pending.damage);
    world.pendingMoveCost = new Map(snapshot.pending.moveCost);
    world.intents = new Map();
    world.targetSpeed = new Map();

    world.nextCellId = snapshot.counters.nextCellId ?? 1;
    world.nextBondId = snapshot.counters.nextBondId ?? 1;
    world.nextOrganismId = snapshot.counters.nextOrganismId ?? 1;
    world.nextResourceId = snapshot.counters.nextResourceId ?? 1;
    world.nextRockId = snapshot.counters.nextRockId ?? 1;
    world.nextEventId = snapshot.counters.nextEventId ?? 1;
    world.nextInterventionId = snapshot.counters.nextInterventionId ?? 1;
    world.decisionTick = 0;
    world.metricTick = 0;
    world.aliveOrderCache = null;
    world.livePopulation = snapshot.cells.filter((c) => c.alive).length;
    world.grid = new SpatialGrid(size, 1.2);

    void options;
    return world;
  }
}

const REWARD_ENERGY_SCALE = 1 / (2 * C.BASE_BASAL);
const REWARD_DAMAGE_SCALE = 2.5;
const REWARD_MOVE_SCALE = 0.5;

/** Snapshot organizma kaydının dünya modülündeki minimal şekli. */
interface SnapshotOrganismLike {
  id: number;
  lineageId: number;
  generation: number;
  birthMode: string;
  bornTick: number;
  parentOrganismId: number | null;
  genome: Genome;
  cells: number[];
  neural: {
    thetaInherited: number[];
    thetaLive: number[];
    baseline: number;
    prevReward: number;
    prevObs: number[] | null;
    prevAction: number;
    prevLogProb: number;
    prevBaseline: number;
    hasPrev: boolean;
  };
  lifetimeReward: number;
  offspringProduced: number;
  deathCause: string | null;
  alive: boolean;
  completedColonyGenerations: number;
  trajectory: { obs: number[]; action: number; logProb: number; baseline: number; reward: number }[];
  decisionCount: number;
  updateCount: number;
}

/**
 * Snapshot'tan bir NeuralPolicy kurar.
 * (Bu, `persistence/snapshot.ts` içindeki eşdeğerden bağımsız kopyadır;
 *  modüller arasında döngüsel içe aktarmım olmaması için burada durur.)
 */
function restorePolicyFromSnapshot(snap: SnapshotOrganismLike): NeuralPolicy {
  const theta = Float64Array.from(snap.neural.thetaInherited);
  const policy = new NeuralPolicy(theta);
  policy.state.thetaLive = Float64Array.from(snap.neural.thetaLive);
  policy.state.baseline = snap.neural.baseline;
  policy.state.prevReward = snap.neural.prevReward;
  policy.state.prevObs = snap.neural.prevObs ? Float64Array.from(snap.neural.prevObs) : null;
  policy.state.prevAction = snap.neural.prevAction;
  policy.state.prevLogProb = snap.neural.prevLogProb;
  policy.state.prevBaseline = snap.neural.prevBaseline;
  policy.state.hasPrev = snap.neural.hasPrev;
  policy.pushTrajectory(
    snap.trajectory.map(
      (t): TrajectoryStep => ({
        obs: Float64Array.from(t.obs),
        action: t.action,
        logProb: t.logProb,
        baseline: t.baseline,
        reward: t.reward,
      }),
    ),
  );
  policy.decisionCount = snap.decisionCount;
  policy.updateCount = snap.updateCount;
  return policy;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function normalize(v: Vec3 | null): Vec3 | null {
  if (!v) return null;
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m < 1e-9) return null;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

/** Türetilmiş sıfır ağırlıklı başlangıç (deney kontrol kolları için). */
export function zeroTheta(): Float64Array {
  return createTheta();
}

/** MLP parametre sayısı doğrulaması (dokümantasyon ve testler için). */
export const MLP_PARAMS = MLP_SHAPE.PARAM_COUNT;
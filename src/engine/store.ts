/**
 * Cell to Mind — arayüz durum deposu.
 *
 * Kare verisi BURAYA yazılmaz; kare, doğrudan sahne bileşenlerine akar.
 * Depo yalnız düşük frekanslı arayüz durumunu tutar (seçim, paneller, ayarlar).
 */

import { create } from 'zustand';
import type { DecisionSnapshot, EvidencePack, LineageSummary, OrganismSummary, SpeedMultiplier } from './client.ts';
import type { ClientStatus } from './client.ts';
import type { LocalSummary } from '../worker/evidence.ts';
import type { LifeSnapshot } from '../sim/lab/lifeMap.ts';
import type { SimEvent } from '../sim/types.ts';

export type Language = 'tr' | 'en';
export type PanelId =
  | 'inspector'
  | 'microscope'
  | 'lineage'
  | 'experiments'
  | 'evolution'
  | 'lifemap'
  | 'events'
  | 'observer'
  | 'data'
  | 'settings'
  | null;

export interface HabitatState {
  size: { x: number; y: number; z: number };
  rocks: { id: number; pos: { x: number; y: number; z: number }; radius: number; variant: number }[];
}

export interface SettingsState {
  light: number;
  currentStrength: number;
  selectionPressure: number;
  learningEnabled: boolean;
}

/** Evrim Atölyesi durumu — kullanıcının tetiklediği, ilerlemesi izlenen iş. */
export interface EvolutionState {
  /** Çalışıyor mu. */
  running: boolean;
  organismId: number | null;
  /** Tamamlanan nesil sayısı (ilerleme çubuğu). */
  generation: number;
  /** Planlanan toplam nesil. */
  total: number;
  /** Nesil nesil en iyi skor (eğri). */
  history: number[];
  /** Sonuç geldi mi? */
  finished: boolean;
  /** Sonuç özeti. */
  result: EvolutionResult | null;
}

export interface EvolutionResult {
  organismId: number;
  applied: boolean;
  startScore: number;
  bestScore: number;
  randomBaseline: number;
  startHoldout: number;
  bestHoldout: number;
  holdoutGain: number;
  history: number[];
  evaluations: number;
  spentMs: number;
}

export interface Notice {
  id: number;
  kind: 'info' | 'error' | 'success';
  message: string;
  at: number;
}

interface StoreState {
  status: ClientStatus;
  error: string | null;
  ready: boolean;
  simVersion: string;
  habitat: HabitatState | null;

  running: boolean;
  speed: SpeedMultiplier;
  tick: number;
  simTime: number;
  population: number;
  /** Kaynak düğümü sayısı — 3B görünüm tavanı denetimi için. */
  resourceCount: number;
  systemEnergy: number;
  externalInput: number;
  dissipated: number;
  initialEnergy: number;
  largestColony: number;
  coloniesFour: number;
  bondCount: number;
  energyResidual: number;
  light: number;
  predator: { active: boolean; energy: number; x: number; y: number; z: number; radius: number };

  settings: SettingsState;
  organisms: OrganismSummary[];
  lineages: LineageSummary[];
  selectedId: number | null;
  decision: DecisionSnapshot | null;
  evidence: EvidencePack | null;

  // --- Evrim Atölyesi (S-3) ---
  evolution: EvolutionState;
  // --- Yaşam haritası (Faz D) ---
  lifeMap: LifeSnapshot | null;
  /**
   * Olay günlüğü. `listEvents` komutu uzun süredir gönderiliyor ama
   * **hiçbir yerden çağrılmıyordu** ve yanıtı da işlenmiyordu — simülasyonun
   * kaydı üretiliyor ve kayboluyordu. Artık panele bağlı.
   */
  events: SimEvent[];
  /** Halka tamponundaki toplam olay sayısı (gösterilen değil, arka plan). */
  eventsTotal: number;
  localSummary: LocalSummary | null;
  modelReport: unknown | null;
  modelState: 'idle' | 'loading' | 'done' | 'error' | 'no-key';
  modelError: string | null;

  panel: PanelId;
  language: Language;
  reducedMotion: boolean;
  muted: boolean;
  notices: Notice[];
  activeBranch: string | null;

  setStatus: (status: ClientStatus, error?: string | null) => void;
  setReady: (version: string, habitat: HabitatState) => void;
  setRunning: (running: boolean) => void;
  setSpeed: (speed: SpeedMultiplier) => void;
  setTelemetry: (t: {
    tick: number;
    simTime: number;
    population: number;
    resourceCount: number;
    systemEnergy: number;
    externalInput: number;
    dissipated: number;
    initialEnergy: number;
    largestColony: number;
    coloniesFour: number;
    bondCount: number;
    light: number;
    predatorActive: boolean;
    predatorEnergy: number;
    px: number;
    py: number;
    pz: number;
    pr: number;
  }) => void;
  setSettings: (patch: Partial<SettingsState>) => void;
  setOrganisms: (organisms: OrganismSummary[]) => void;
  setLineages: (lineages: LineageSummary[]) => void;
  select: (id: number | null) => void;
  setDecision: (decision: DecisionSnapshot | null) => void;
  setEvidence: (pack: EvidencePack) => void;

  // --- Evrim Atölyesi eylemleri ---
  evolutionStart: (organismId: number, total: number) => void;
  evolutionProgress: (generation: number, best: number) => void;
  evolutionDone: (result: EvolutionResult) => void;
  evolutionReset: () => void;
  setLifeMap: (snapshot: LifeSnapshot) => void;
  setEvents: (events: SimEvent[], totalKnown: number) => void;
  clearEvents: () => void;
  setLocalSummary: (summary: LocalSummary) => void;
  setModelState: (state: StoreState['modelState'], error?: string | null) => void;
  setModelReport: (report: unknown) => void;
  setPanel: (panel: PanelId) => void;
  togglePanel: (panel: Exclude<PanelId, null>) => void;
  setLanguage: (lang: Language) => void;
  setReducedMotion: (value: boolean) => void;
  setMuted: (value: boolean) => void;
  notify: (kind: Notice['kind'], message: string) => void;
  dismissNotice: (id: number) => void;
  setBranch: (name: string | null) => void;
  /**
   * Her başarılı kayıttan sonra artar.
   *
   * ⚠️ Neden var: kaydetme işlemi **asenkron ve panel dışında** tamamlanıyor
   * (`client.snapshot` worker'a mesaj atar, yanıt `App.tsx`te işlenir ve
   * orada `saveRecord` çağrılır). Bu yüzden "Kayıt" paneli kaydetme
   * düğmesine basıldığını öğrenemiyordu ve `useEffect(refresh, [])`
   * yalnız bir kez çalıştığı için **kayıt listesi hiç tazelenmiyordu** —
   * kullanıcı kaydediyor, listede hiçbir şey görünmüyordu. Silme düğmesi
   * `.then(refresh)` çağırdığı için bu asimetri sessizce geçiyordu.
   * Yoklama yerine kaydedilen olayın kendisi sinyaldir.
   */
  recordVersion: number;
  bumpRecordVersion: () => void;
}

let noticeId = 0;

function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem('ctm.language');
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {
    /* localStorage yoksa varsayılan */
  }
  return 'tr'; // Türkçe varsayılan
}

/**
 * Gözlemci susturma tercihi — başlangıç değeri.
 *
 * ⚠️ Bu tercih önce **hiç saklanmıyordu**: kullanıcı susturdu, sayfayı
 * yenileyince susturma kalkıyordu. `language` ve `reducedMotion` saklandığı
 * için üç tercihten ikisi kalıcıydı — aynı sınıftan bir tutarsızlık.
 */
function loadMuted(): boolean {
  try {
    return localStorage.getItem('ctm.muted') === '1';
  } catch {
    /* localStorage yoksa susturulmamış */
  }
  return false;
}

/**
 * Azaltılmış hareket başlangıç değeri.
 *
 * Öncelik sırası: **kullanıcının kendi seçimi → işletim sistemi tercihi →
 * kapalı.** Kullanıcı düğmeye bir kez dokunduysa seçimi kalıcıdır ve sistem
 * tercihi onu EZMEMEZ — aksi hâlde her açılışta ayar kullanıcının kararını
 * geçersiz kılardı.
 *
 * ⚠️ Bu satır önceden yoktu: `localStorage` boşken doğrudan `false`
 * dönülüyordu, yani `prefers-reduced-motion: reduce` ayarlı bir kullanıcı
 * tam animasyonlu sahneyi görüyordu. `systemPrefersReducedMotion()` zaten
 * yazılıydı ama HİÇ ÇAĞRILMIYORDU — erişilebilirlik tercihi sessizce yok
 * sayılıyordu.
 */
function loadReducedMotion(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('ctm.reducedMotion');
  } catch {
    stored = null;
  }
  if (stored === '1') return true;
  if (stored === '0') return false;
  return systemPrefersReducedMotion();
}

export const useStore = create<StoreState>((set, get) => ({
  status: 'idle',
  error: null,
  ready: false,
  simVersion: '',
  habitat: null,

  running: true,
  speed: 1,
  tick: 0,
  simTime: 0,
  population: 0,
  resourceCount: 0,
  systemEnergy: 0,
  externalInput: 0,
  dissipated: 0,
  initialEnergy: 0,
  largestColony: 0,
  coloniesFour: 0,
  bondCount: 0,
  energyResidual: 0,
  light: 0.62,
  predator: { active: true, energy: 0, x: 0, y: 0, z: 0, radius: 0.55 },

  settings: { light: 0.62, currentStrength: 0.045, selectionPressure: 0.18, learningEnabled: true },
  organisms: [],
  lineages: [],
  selectedId: null,
  decision: null,
  evidence: null,

  evolution: {
    running: false,
    organismId: null,
    generation: 0,
    total: 0,
    history: [],
    finished: false,
    result: null,
  } as EvolutionState,
  lifeMap: null,
  events: [],
  eventsTotal: 0,
  localSummary: null,
  modelReport: null,
  modelState: 'idle',
  modelError: null,

  panel: null,
  language: loadLanguage(),
  reducedMotion: loadReducedMotion(),
  muted: loadMuted(),
  notices: [],
  activeBranch: null,

  setStatus: (status, error) => set({ status, error: error ?? get().error }),
  setReady: (version, habitat) => set({ ready: true, simVersion: version, habitat, status: 'running' }),
  setRunning: (running) => set({ running }),
  setSpeed: (speed) => set({ speed }),
  setTelemetry: (t) =>
    set({
      tick: t.tick,
      simTime: t.simTime,
      population: t.population,
      resourceCount: t.resourceCount,
      systemEnergy: t.systemEnergy,
      externalInput: t.externalInput,
      dissipated: t.dissipated,
      initialEnergy: t.initialEnergy,
      largestColony: t.largestColony,
      coloniesFour: t.coloniesFour,
      bondCount: t.bondCount,
      // Korunum değişmezi: (sistem + harcanan) − (başlangıç + dış girdi)
      energyResidual:
        t.systemEnergy + t.dissipated - (t.initialEnergy + t.externalInput),
      light: t.light,
      predator: {
        active: t.predatorActive,
        energy: t.predatorEnergy,
        x: t.px,
        y: t.py,
        z: t.pz,
        radius: t.pr,
      },
    }),
  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
  setOrganisms: (organisms) => set({ organisms }),
  setLineages: (lineages) => set({ lineages }),
  select: (id) => set({ selectedId: id, decision: null }),
  setDecision: (decision) => set({ decision }),
  evolutionStart: (organismId: number, total: number) =>
    set({
      evolution: { running: true, organismId, generation: 0, total, history: [], finished: false, result: null },
    }),
  evolutionProgress: (generation: number, best: number) =>
    set((st) => ({
      evolution: {
        ...st.evolution,
        generation,
        history: [...st.evolution.history, best],
      },
    })),
  evolutionDone: (result: EvolutionResult) =>
    set((st) => ({
      evolution: { ...st.evolution, running: false, finished: true, result },
    })),
  evolutionReset: () =>
    set({
      evolution: { running: false, organismId: null, generation: 0, total: 0, history: [], finished: false, result: null },
    }),

  setLifeMap: (snapshot) => set({ lifeMap: snapshot }),

  setEvents: (events, eventsTotal) => set({ events, eventsTotal }),
  clearEvents: () => set({ events: [], eventsTotal: 0 }),

  setEvidence: (pack) => set({ evidence: pack, localSummary: null, modelReport: null, modelState: 'idle' }),
  setLocalSummary: (summary) => set({ localSummary: summary }),
  setModelState: (modelState, error) => set({ modelState, modelError: error ?? null }),
  setModelReport: (modelReport) => set({ modelReport }),
  setPanel: (panel) => set({ panel }),
  togglePanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
  setLanguage: (language) => {
    try {
      localStorage.setItem('ctm.language', language);
      document.documentElement.lang = language;
    } catch {
      /* yok sayılır */
    }
    set({ language });
  },
  setReducedMotion: (value) => {
    try {
      localStorage.setItem('ctm.reducedMotion', value ? '1' : '0');
    } catch {
      /* yok sayılır */
    }
    set({ reducedMotion: value });
  },
  setMuted: (muted) => {
    // ⚠️ Bu tercih **kaydedilmiyordu**: kullanıcı susturdu, sayfayı yenileyince
    // susmuş kalmıyordu. `language` ve `reducedMotion` kaydedildiği için aynı
    // sınıftan bir tutarsızlıktı — üç tercihten ikisi kalıcıydı.
    try {
      localStorage.setItem('ctm.muted', muted ? '1' : '0');
    } catch {
      /* yok sayılır */
    }
    set({ muted });
  },
  notify: (kind, message) =>
    set({ notices: [...get().notices.slice(-4), { id: ++noticeId, kind, message, at: Date.now() }] }),
  dismissNotice: (id) => set({ notices: get().notices.filter((n) => n.id !== id) }),
  setBranch: (activeBranch) => set({ activeBranch }),
  recordVersion: 0,
  bumpRecordVersion: () => set((s) => ({ recordVersion: s.recordVersion + 1 })),
}));

/** Sistem hareket azaltma tercihi (kullanıcı ayarı ile birleştirilir). */
export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
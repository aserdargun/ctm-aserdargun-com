/**
 * Cell to Mind — arayüz metinleri.
 *
 * Varsayılan dil TÜRKÇE'dir; tam İngilizce seçenek bulunur.
 * Türkçe karakterleri (ğ, ü, ş, ı, ö, ç) doğru görünsün diye yığın fontu
 * kullanılır (bkz. styles.css).
 */

import type { Language } from '../engine/store.ts';

export const tr = {
  title: 'Cell to Mind',
  subtitle: 'Yaşam evrilir. Zihinler belirir.',

  hud: {
    tick: 'Tick',
    simTime: 'Simülasyon süresi',
    population: 'Canlı hücre',
    organisms: 'Organizma',
    colonies: 'Bağlı küme',
    energy: 'Sistem enerjisi',
    external: 'Dış girdi',
    dissipated: 'Harcanan',
    residual: 'Muhasebe farkı',
    light: 'Işık',
    current: 'Akıntı',
    pressure: 'Seçilim baskısı',
    learning: 'Öğrenme',
    speed: 'Hız',
    pause: 'Duraklat',
    resume: 'Devam',
    paused: 'Duraklatıldı',
    running: 'Çalışıyor',
  },

  actions: {
    inspector: 'İnceleme',
    microscope: 'Sinir ağı mikroskobu',
    lineage: 'Soy defteri',
    experiments: 'Deneyler',
    evolution: 'Evrim Atölyesi',
    lifemap: 'Yaşam Haritası',
    observer: 'AI Gözlemci',
    data: 'Kayıt',
    settings: 'Ayarlar',
    close: 'Kapat',
    selectOrganism: 'Canlı seç',
    follow: 'Takip et',
    unfollow: 'Takibi bırak',
    addNutrientA: 'A besini ekle',
    addNutrientB: 'B besini ekle',
    revivePredator: 'Avcıyı geri getir',
    save: 'Kaydet',
    export: 'JSON dışa aktar',
    import: 'JSON içe aktar',
    branch: 'Dal oluştur',
    reset: 'Yeniden başlat',
    language: 'Dil',
    reducedMotion: 'Hareketi azalt',
    silent: 'Sessiz kullanım',
  },

  inspector: {
    title: 'Canlı incelemesi',
    empty: 'Bir canlı seçin. Klavye ile listeden seçebilirsiniz (↑ ↓ Enter).',
    id: 'Kimlik',
    lineage: 'Soy',
    generation: 'Nesil',
    birthMode: 'Doğuş biçimi',
    birthModeValue: { genesis: 'Kurucu', bud: 'Tomurcuk', fragment: 'Parçalanma' },
    cells: 'Hücre sayısı',
    totalEnergy: 'Toplam enerji',
    parent: 'Ebeveyn',
    offspring: 'Ürettiği yavru',
    deaths: 'Ölüm nedeni',
    genome: 'Kalıtsal parametreler',
    learned: 'Bu yaşamda öğrenilen fark (‖θ_canlı − θ_kalıtsal‖)',
    updates: 'Politika güncellemesi',
    threshold: 'Oyunun işletimsel çok hücrelilik eşiği: 4+ hücreli yapı. Bu biyolojik tanım değil, ölçümdür.',
  },

  microscope: {
    title: 'Sinir ağı mikroskobu',
    empty: 'Bir canlı seçin.',
    architecture: 'Mimari: 12 → 8 (tanh) → 4 (softmax) · 140 parametre · 128 ağırlıklı bağlantı · 12 bias · 24 birim',
    inputs: 'Girdiler',
    hidden: 'Gizli aktivasyonlar',
    output: 'Logits ve eylem olasılıkları',
    action: 'Seçilen eylem',
    greedy: 'Greedy eylem',
    baseline: 'Baseline (karar anında)',
    reward: 'Son ödül',
    logProb: 'log π(a|x)',
    inherited: 'Kalıtsal başlangıç',
    live: 'Güncel ağ',
    delta: 'Bu yaşamda öğrenilen fark',
    step: 'Tek karar adımı ilerlet',
    ablate: 'Gizli birimi sustur (karşı-olgusal)',
    ablateNote:
      'Susturma bir TAHMİNDİR: aynı ağın aynı gözlemle maskelenmiş hâlini hesaplar. Gerçek bir simülasyon kararı değildir.',
    resetMask: 'Maskeyi temizle',
    evidenceWarning:
      'Aktivasyon grafiği bilinç veya öğrenme başarısı kanıtı DEĞİLDİR.',
  },

  lineage: {
    title: 'Soy defteri',
    empty: 'Henüz soy kaydı yok.',
    founder: 'Kurucu',
    organisms: 'Organizma',
    maxGeneration: 'En yüksek nesil',
    distance: 'Atasal → torun genom uzaklığı',
    note: 'Uyarlanma yalnız ortalama gen değişiminden ilan edilmez; ortak ortam deneyi gerekir.',
  },

  experiments: {
    title: 'Deneyler',
    hint: 'Üç deney uygulamada çalışır. Her deney tek değişkenli olacak şekilde tasarlanmıştır.',
    togetherness: '1 · Birlikte kalmak',
    togethernessDesc: 'Aynı kayıttan iki dal; yalnız bağlı kalma eğilimi değişir, baskı sabit.',
    adaptation: '2 · Adaptasyon',
    adaptationDesc: 'Atasal ve torun genotipleri ortak ortamda; öğrenme ve yeni mutasyon kapalı.',
    learning: '3 · Öğrenme',
    learningDesc: 'Aynı kalıtsal ağ; büyüme ve mutasyon kapalı, nihai değerlendirmede tüm güncellemeler kapalı.',
    run: 'Çalıştır',
    running: 'Çalışıyor…',
    result: 'Sonuç',
    seeds: 'Tohumlar',
    trainSeeds: '1–20',
    evalSeeds: '1001–1020',
    budget: 'Bütçe: 2.000 eğitim + 1.000 değerlendirme kararı',
    ablation: 'Ablasyon',
    ablationDesc: 'Eğitilmiş ağın bir gizli birimi susturulur; eğitim kapalıyken etkisi ölçülür.',
    notYetRun: 'Bu deney henüz çalıştırılmadı.',
    honestNote:
      'Kabul hedefi (20 tohumun en az 15\'inde eğitilmiş politika kontrolü aşar) bir ÜRÜN HEDEFİDİR; gerçekleşmiş sonuç değildir.',
  },

  observer: {
    title: 'AI Gözlemci',
    hint: 'Gözlemci canlıların içindeki 140 parametreli ağdan AYRIDIR. Dünyayı değiştiremez, hazır cevap veremez.',
    ask: 'Soru sor',
    prompts: {
      tell: 'Bana anlat',
      lineage: 'Bu soy nasıl değişti?',
      learned: 'Bu canlı gerçekten öğrendi mi?',
      next: 'Sırada neyi test edelim?',
    },
    ask_placeholder: 'Örn. Bu soy nasıl değişti?',
    observations: 'Gözlemler',
    interpretations: 'Yorumlar',
    uncertainties: 'Belirsizlikler',
    nextExperiment: 'Sonraki deney',
    evidence: 'Kanıt kimlikleri',
    measurements: 'Ölçümler',
    sourceLocal: 'Yerel kural özeti — dil/görsel model kullanılmadı',
    sourceModel: 'Dil modeli yanıtı',
    sourceVision: 'Görsel destekli analiz',
    unverifiedNumbers: 'Doğrulanamayan sayılar çıkarıldı.',
    modelUnavailable: 'API erişimi yok — yerel kural özeti üretildi. Sahte model yanıtı gösterilmez.',
    timeout: 'Model zaman aşımına uğradı; oyun devam ediyor.',
  },

  data: {
    title: 'Kayıt',
    save: 'IndexedDB\'ye kaydet',
    saveAndContinue: 'Kaydet ve devam et',
    load: 'Kaydı yükle',
    export: 'JSON dışa aktar',
    import: 'JSON içe aktar',
    list: 'Kayıtlı oturumlar',
    empty: 'Henüz kayıt yok.',
    loaded: 'Kayıt yüklendi',
    saved: 'Kayıt alındı',
    corrupt: 'Bozuk kayıt reddedildi — mevcut dünya korundu.',
    storageError: 'Depolama hatası: kayıt yazılamadı.',
    branchCreated: 'Dal oluşturuldu',
  },

  settings: {
    title: 'Ayarlar',
    language: 'Dil',
    turkish: 'Türkçe',
    english: 'English',
    reducedMotion: 'Hareketi azalt',
    reducedMotionHint: 'Kamera sallanması ve parçacık hareketi kapanır.',
    silent: 'Sessiz kullanım',
    silentHint: 'Görsel uyarılar ve otomatik kaydırma kapatılır.',
    webglMissing: 'WebGL2 bulunamadı. Simülasyon metin olarak çalışmaya devam eder.',
    contextLost: 'Grafik bağlamı kayboldu — sahne yeniden kuruluyor.',
  },

  list: {
    title: 'Canlılar',
    empty: 'Yaşayan canlı yok.',
    columns: ['Kimlik', 'Soy', 'Nesil', 'Hücre', 'Enerji'],
    search: 'Canlı ara (kimlik veya soy)',
  },

  status: {
    starting: 'Simülasyon başlatılıyor…',
    error: 'Hata',
    unsupported: 'Desteklenmiyor',
    idle: 'Beklemede',
  },

  units: {
    e: 'e',
    mb: 'mb',
    tick: 'tick',
    cells: 'hücre',
    seconds: 's',
  },
};

// `as const` KULLANILMAZ: aksi halde Türkçe metinler değişmez literal tipine
// düşer ve İngilizce sözlük atanamaz. Anahtar yapısı yine de çıkarılır.
export type Strings = typeof tr;

const en: Strings = {
  ...tr,
  title: 'Cell to Mind',
  subtitle: 'Life evolves. Minds emerge.',
  hud: {
    tick: 'Tick',
    simTime: 'Simulated time',
    population: 'Living cells',
    organisms: 'Organisms',
    colonies: 'Bonded cluster',
    energy: 'System energy',
    external: 'External input',
    dissipated: 'Dissipated',
    residual: 'Ledger residual',
    light: 'Light',
    current: 'Current',
    pressure: 'Selection pressure',
    learning: 'Learning',
    speed: 'Speed',
    pause: 'Pause',
    resume: 'Resume',
    paused: 'Paused',
    running: 'Running',
  },
  actions: {
    inspector: 'Inspector',
    microscope: 'Neural microscope',
    lineage: 'Lineage ledger',
    experiments: 'Experiments',
    evolution: 'Evolution Lab',
    lifemap: 'Life Map',
    observer: 'AI Observer',
    data: 'Records',
    settings: 'Settings',
    close: 'Close',
    selectOrganism: 'Select organism',
    follow: 'Follow',
    unfollow: 'Unfollow',
    addNutrientA: 'Add nutrient A',
    addNutrientB: 'Add nutrient B',
    revivePredator: 'Reintroduce predator',
    save: 'Save',
    export: 'Export JSON',
    import: 'Import JSON',
    branch: 'Create branch',
    reset: 'Restart',
    language: 'Language',
    reducedMotion: 'Reduce motion',
    silent: 'Silent use',
  },
  inspector: {
    title: 'Organism inspection',
    empty: 'Select an organism. Use the keyboard in the list (↑ ↓ Enter).',
    id: 'Identity',
    lineage: 'Lineage',
    generation: 'Generation',
    birthMode: 'Birth mode',
    birthModeValue: { genesis: 'Founder', bud: 'Bud', fragment: 'Fragmentation' },
    cells: 'Cell count',
    totalEnergy: 'Total energy',
    parent: 'Parent',
    offspring: 'Offspring produced',
    deaths: 'Cause of death',
    genome: 'Heritable parameters',
    learned: 'Learned this lifetime (‖θ_live − θ_inherited‖)',
    updates: 'Policy update',
    threshold:
      "The game's operational multicellularity threshold is a 4+ cell structure. This is a measurement, not a biological definition.",
  },
  microscope: {
    title: 'Neural microscope',
    empty: 'Select an organism.',
    architecture:
      'Architecture: 12 → 8 (tanh) → 4 (softmax) · 140 parameters · 128 weighted connections · 12 biases · 24 units',
    inputs: 'Inputs',
    hidden: 'Hidden activations',
    output: 'Logits and action probabilities',
    action: 'Chosen action',
    greedy: 'Greedy action',
    baseline: 'Baseline (at decision)',
    reward: 'Last reward',
    logProb: 'log π(a|x)',
    inherited: 'Inherited initial',
    live: 'Current network',
    delta: 'Learned this lifetime',
    step: 'Advance one decision',
    ablate: 'Silence hidden unit (counterfactual)',
    ablateNote:
      'Ablation is an ESTIMATE: it computes what the same network would do on the same observation with the unit masked. It is not a real simulated decision.',
    resetMask: 'Clear mask',
    evidenceWarning: 'An activation plot is NOT evidence of consciousness or learning success.',
  },
  lineage: {
    title: 'Lineage ledger',
    empty: 'No lineage records yet.',
    founder: 'Founder',
    organisms: 'Organisms',
    maxGeneration: 'Highest generation',
    distance: 'Ancestor → descendant genome distance',
    note: 'Adaptation is never declared from mean gene change alone; a common-garden experiment is required.',
  },
  experiments: {
    title: 'Experiments',
    hint: 'Three experiments run in-app. Each is designed to change a single variable.',
    togetherness: '1 · Staying together',
    togethernessDesc: 'Two branches from one record; only attachment tendency changes, pressure fixed.',
    adaptation: '2 · Adaptation',
    adaptationDesc: 'Ancestral and descendant genotypes in a common environment; learning and new mutation off.',
    learning: '3 · Learning',
    learningDesc: 'Same inherited network; growth and mutation off, all updates disabled at final evaluation.',
    run: 'Run',
    running: 'Running…',
    result: 'Result',
    seeds: 'Seeds',
    trainSeeds: '1–20',
    evalSeeds: '1001–1020',
    budget: 'Budget: 2,000 training + 1,000 evaluation decisions',
    ablation: 'Ablation',
    ablationDesc: 'One hidden unit of the trained network is silenced; its effect is measured with training off.',
    notYetRun: 'This experiment has not been run yet.',
    honestNote:
      'The acceptance target (trained policy beats control on at least 15 of 20 seeds) is a PRODUCT TARGET, not a measured result.',
  },
  observer: {
    title: 'AI Observer',
    hint: 'The observer is separate from the 140-parameter network inside the organisms. It cannot change the world or hand out answers.',
    ask: 'Ask',
    prompts: {
      tell: 'Tell me',
      lineage: 'How has this lineage changed?',
      learned: 'Did this organism really learn?',
      next: 'What should we test next?',
    },
    ask_placeholder: 'e.g. How has this lineage changed?',
    observations: 'Observations',
    interpretations: 'Interpretations',
    uncertainties: 'Uncertainties',
    nextExperiment: 'Next experiment',
    evidence: 'Evidence IDs',
    measurements: 'Measurements',
    sourceLocal: 'Local rule summary — no language/vision model used',
    sourceModel: 'Language model answer',
    sourceVision: 'Vision-assisted analysis',
    unverifiedNumbers: 'Unverifiable numbers were removed.',
    modelUnavailable: 'No API access — a local rule summary was produced. No fake model answer is shown.',
    timeout: 'The model timed out; the game keeps running.',
  },
  data: {
    title: 'Records',
    save: 'Save to IndexedDB',
    saveAndContinue: 'Save and continue',
    load: 'Load record',
    export: 'Export JSON',
    import: 'Import JSON',
    list: 'Saved sessions',
    empty: 'No records yet.',
    loaded: 'Record loaded',
    saved: 'Record saved',
    corrupt: 'Corrupt record rejected — the current world was preserved.',
    storageError: 'Storage error: the record could not be written.',
    branchCreated: 'Branch created',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    turkish: 'Türkçe',
    english: 'English',
    reducedMotion: 'Reduce motion',
    reducedMotionHint: 'Camera sway and particle motion are disabled.',
    silent: 'Silent use',
    silentHint: 'Visual alerts and auto-scrolling are disabled.',
    webglMissing: 'WebGL2 not found. The simulation continues as text.',
    contextLost: 'Graphics context lost — rebuilding the scene.',
  },
  list: {
    title: 'Organisms',
    empty: 'No living organisms.',
    columns: ['ID', 'Lineage', 'Gen', 'Cells', 'Energy'],
    search: 'Search organism (id or lineage)',
  },
  status: {
    starting: 'Starting simulation…',
    error: 'Error',
    unsupported: 'Unsupported',
    idle: 'Idle',
  },
  units: { e: 'e', mb: 'mb', tick: 'tick', cells: 'cells', seconds: 's' },
};

const DICTIONARIES: Record<Language, Strings> = { tr, en };

export function useStrings(): Strings {
  return DICTIONARIES.tr;
}

export function getStrings(lang: Language): Strings {
  return DICTIONARIES[lang] ?? tr;
}

export const ACTION_LABELS_TR = ['A gradyanına yönel', 'B gradyanına yönel', 'Keşfet', 'Dinlen'] as const;
export const ACTION_LABELS_EN = ['Toward A', 'Toward B', 'Explore', 'Rest'] as const;

export function actionLabels(lang: Language): readonly string[] {
  return lang === 'tr' ? ACTION_LABELS_TR : ACTION_LABELS_EN;
}

export const GENOME_LABELS_TR: Record<string, string> = {
  bondAffinity: 'Bağlı kalma',
  bondStrength: 'Bağ dayanımı',
  motility: 'Hareket',
  senseRadius: 'Algı yarıçapı',
  shareEfficiency: 'Paylaşma',
  toleranceA: 'A uyumu',
  toleranceB: 'B uyumu',
  plasticity: 'Plastisite',
};

export const GENOME_LABELS_EN: Record<string, string> = {
  bondAffinity: 'Attachment',
  bondStrength: 'Bond strength',
  motility: 'Motility',
  senseRadius: 'Sense radius',
  shareEfficiency: 'Sharing',
  toleranceA: 'Tolerance A',
  toleranceB: 'Tolerance B',
  plasticity: 'Plasticity',
};

export function genomeLabels(lang: Language): Record<string, string> {
  return lang === 'tr' ? GENOME_LABELS_TR : GENOME_LABELS_EN;
}

export const INPUT_LABELS_TR = [
  'Normalize enerji',
  'Normalize hücre sayısı',
  'A gradyanı x',
  'A gradyanı y',
  'A gradyanı z',
  'B gradyanı x',
  'B gradyanı y',
  'B gradyanı z',
  'Yerel seçilim baskısı',
  'Önceki ödül',
  'A teması',
  'B teması',
] as const;

export const INPUT_LABELS_EN = [
  'Normalized energy',
  'Normalized cell count',
  'A gradient x',
  'A gradient y',
  'A gradient z',
  'B gradient x',
  'B gradient y',
  'B gradient z',
  'Local selection pressure',
  'Previous reward',
  'Contact A',
  'Contact B',
] as const;

export function inputLabels(lang: Language): readonly string[] {
  return lang === 'tr' ? INPUT_LABELS_TR : INPUT_LABELS_EN;
}
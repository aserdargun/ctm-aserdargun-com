/**
 * Cell to Mind — arayüz metinleri.
 *
 * Varsayılan dil TÜRKÇE'dir; tam İngilizce seçenek bulunur.
 * Türkçe karakterleri (ğ, ü, ş, ı, ö, ç) doğru görünsün diye yığın fontu
 * kullanılır (bkz. styles.css).
 */

import type { Language } from '../engine/store.ts';
import type { GenomeKey } from '../sim/genome.ts';
import { OBSERVER_SUMMARY_EN, OBSERVER_SUMMARY_TR } from './observerSummary.ts';

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
    renderLimit: 'Görünüm sınırı',
    renderLimitNote:
      '3B görünüm en fazla {shown} hücre gösterir; {total} hücre var, {hidden} hücre görünmüyor.',
    resourceLimit: 'Kaynak sınırı',
    resourceLimitNote:
      '3B görünüm en fazla {shown} kaynak gösterir; {total} kaynak var, {hidden} kaynak görünmüyor.',
  },

  actions: {
    inspector: 'İnceleme',
    microscope: 'Sinir ağı mikroskobu',
    lineage: 'Soy defteri',
    experiments: 'Deneyler',
    evolution: 'Evrim Atölyesi',
    lifemap: 'Yaşam Haritası',
    events: 'Olay Günlüğü',
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
    on: 'Açık',
    off: 'Kapalı',
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
    allLineages: 'tüm soylar',
    eventType: {
      genesis: 'kuruluş',
      'cell-division': 'hücre bölünmesi',
      'bud-separation': 'tomurcuk ayrılması',
      'bond-formation': 'bağ kuruldu',
      'bond-break': 'bağ koptu',
      fragmentation: 'parçalanma',
      death: 'ölüm',
      predation: 'avlanma',
      'learning-update': 'öğrenme güncellemesi',
      intervention: 'oyuncu müdahalesi',
    },
    cells: 'Hücre sayısı',
    totalEnergy: 'Toplam enerji',
    parent: 'Ebeveyn',
    offspring: 'Ürettiği yavru',
    deaths: 'Ölüm nedeni',
    genome: 'Kalıtsal parametreler',
    learned: 'Bu yaşamda öğrenilen fark (‖θ_canlı − θ_kalıtsal‖)',
    updates: 'Politika güncellemesi',
    threshold:
      'Oyunun işletimsel çok hücrelilik eşiği: {n}+ hücreli yapı. Bu biyolojik tanım değil, ölçümdür.',
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
    truncated: 'İlk {shown} / {total} soy gösteriliyor.',
  },

  events: {
    recordNote:
      'Simülasyonun kaydı. Bu veri zaten üretiliyordu; panel onu görünür kılıyor.',
    shown: 'Son {shown} olay gösteriliyor ({total} kayıtlı).',
  },
  evolution: {
    generationCurve: 'nesil eğrisi',
    reset: 'Evrim atölyesi sıfırlandı',
    applied: 'Bulunan politika organizmaya yazıldı.',
    dryRunOnly: 'Yalnız denendi, organizma değiştirilmedi.',
    heldOut: 'Kazanç yalnız görülmemiş tohumlarda raporlanır; arama bunları görmedi.',
    holdoutNotice: 'Evrim atölyesi: görülmemiş tohumlarda {gain}',
  },
  lifeMap: {
    axis: { speed: 'hız', size: 'boyut', range: 'menzil' },
    organisms: 'organizma',
    bestEnergy: 'en iyi enerji',
    lineage: 'soy',
    speed: 'hız',
    empty: 'boş',
    clippedNote:
      'Üst sınırın altındaki tüm gözlemler üst kutuya kırpılır; sıfır olması bir bulgu değil, ölçüm sınırıdır.',
  },
  experiments: {
    title: 'Deneyler',
    hint: 'Üç deney, npm run experiments ile Node\'da koşar (tarayıcıdan tetiklenmez).',
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
    trainSeedsLabel: 'Eğitim tohumları',
    trainSeeds: '1–20',
    evalSeedsLabel: 'Değerlendirme tohumları',
    evalSeeds: '1001–1020',
    budget: 'Bütçe (tohum başına): 600 eğitim + 400 değerlendirme kararı',
    ablation: 'Ablasyon',
    ablationDesc: 'Eğitilmiş ağın bir gizli birimi susturulur; eğitim kapalıyken etkisi ölçülür.',
    notYetRun: 'Bu deney henüz çalıştırılmadı.',
    notWired: 'Tarayıcıdan tetikleme BAĞLI DEĞİL. Bu düğme deneyi çalıştırmaz; sonuçlar docs/EXPERIMENTS.md içinde, npm run experiments ile üretilir.',
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
    notMeasured: {
      free: 'Ücretsiz — gözlemci karesi tarayıcı tarafında yakalanır',
      fixedStep: 'Simülasyon 50 ms sabit adımla ilerler; olaylar tick kimliğiyle eşleşir',
      reserves: 'Kaynak rezervleri sonludur; enerji paylaşımı enerji üretmez',
      regeneration: 'Rejenerasyon ve oyuncu besini dış girdidir ve ölçülür',
      control: 'Kontrol deneyi yapılmadan nedensellik iddiası kurulamaz',
      consciousness: 'Bilinç veya genel zekâ ölçülmez',
      visualCounting: 'Görsel sayım telemetrinin yerine geçmez',
      readOnly: 'Gözlemci canlılara hazır cevap veremez; ağırlıkları düzenleyemez',
      listNote: 'Ölçülmemiş her şey `uncertainties` içinde listelenir.',
    },
    sourceModel: 'Dil modeli yanıtı',
    sourceVision: 'Görsel destekli analiz',
    numberCheck:
      'Model yanıtındaki sayılar — kanıt paketiyle eşleşenler ✓ işaretlidir; eşleşmeyenler ✗.',
    preparing: 'JSON hazırlanıyor…',
    measurementsTruncated: 'İlk {shown} / {total} ölçüm gösteriliyor.',
    claimsTruncated: 'İlk {shown} / {total} sayı iddiası gösteriliyor.',
    summary: OBSERVER_SUMMARY_TR,
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
    preparing: 'JSON hazırlanıyor…',
    branchCreated: 'Dal oluşturuldu',
  },

  settings: {
    title: 'Ayarlar',
    language: 'Dil',
    turkish: 'Türkçe',
    english: 'English',
    reducedMotion: 'Hareketi azalt',
    on: 'Açık',
    off: 'Kapalı',
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
    truncated: 'İlk {shown} / {total} kayıt gösteriliyor.',
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
    renderLimit: 'View limit',
    renderLimitNote:
      'The 3D view shows at most {shown} cells; {total} exist, {hidden} are not shown.',
    resourceLimit: 'Resource limit',
    resourceLimitNote:
      'The 3D view shows at most {shown} resources; {total} exist, {hidden} are not shown.',
  },
  actions: {
    inspector: 'Inspector',
    microscope: 'Neural microscope',
    lineage: 'Lineage ledger',
    experiments: 'Experiments',
    evolution: 'Evolution Lab',
    lifemap: 'Life Map',
    events: 'Event Log',
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
    on: 'On',
    off: 'Off',
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
    allLineages: 'all lineages',
    eventType: {
      genesis: 'genesis',
      'cell-division': 'cell division',
      'bud-separation': 'bud separation',
      'bond-formation': 'bond formed',
      'bond-break': 'bond broken',
      fragmentation: 'fragmentation',
      death: 'death',
      predation: 'predation',
      'learning-update': 'learning update',
      intervention: 'player intervention',
    },
    cells: 'Cell count',
    totalEnergy: 'Total energy',
    parent: 'Parent',
    offspring: 'Offspring produced',
    deaths: 'Cause of death',
    genome: 'Heritable parameters',
    learned: 'Learned this lifetime (‖θ_live − θ_inherited‖)',
    updates: 'Policy update',
    threshold:
      "The game's operational multicellularity threshold is a {n}+ cell structure. This is a measurement, not a biological definition.",
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
    truncated: 'Showing first {shown} of {total} lineages.',
  },
  events: {
    recordNote:
      "The simulation's own record. This data was already produced; the panel makes it visible.",
    shown: 'Showing last {shown} events ({total} recorded).',
  },
  evolution: {
    generationCurve: 'generation curve',
    reset: 'Evolution lab reset',
    applied: 'The found policy was written to the organism.',
    dryRunOnly: 'Dry run only; the organism was not changed.',
    heldOut:
      'The gain is reported only on held-out seeds; the search did not see them.',
    holdoutNotice: 'Evolution lab: on held-out seeds {gain}',
  },
  lifeMap: {
    axis: { speed: 'speed', size: 'size', range: 'range' },
    organisms: 'organisms',
    bestEnergy: 'best energy',
    lineage: 'lineage',
    speed: 'speed',
    empty: 'empty',
    clippedNote:
      'All observations below the upper bound are clipped into the top box; a zero is a measurement limit, not a finding.',
  },
  experiments: {
    title: 'Experiments',
    hint: 'Three experiments run in Node via npm run experiments (not from the browser).',
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
    trainSeedsLabel: 'Eğitim tohumları',
    trainSeeds: '1–20',
    evalSeedsLabel: 'Değerlendirme tohumları',
    evalSeeds: '1001–1020',
    budget: 'Budget (per seed): 600 training + 400 evaluation decisions',
    ablation: 'Ablation',
    ablationDesc: 'One hidden unit of the trained network is silenced; its effect is measured with training off.',
    notYetRun: 'This experiment has not been run yet.',
    honestNote:
      'The acceptance target (trained policy beats control on at least 15 of 20 seeds) is a PRODUCT TARGET, not a measured result.',
    notWired: 'Browser triggering is NOT WIRED. This button does not run the experiment; results live in docs/EXPERIMENTS.md, produced by npm run experiments.',
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
    notMeasured: {
      free: 'Free — the observer frame is captured in the browser',
      fixedStep: 'The simulation advances in fixed 50 ms steps; events match by tick identity',
      reserves: 'Source reservoirs are finite; energy sharing does not create energy',
      regeneration: 'Regeneration and player feed are external inputs and are measured',
      control: 'No causal claim without a control experiment',
      consciousness: 'Consciousness or general intelligence is not measured',
      visualCounting: 'Visual counting does not replace telemetry',
      readOnly: 'The observer cannot answer for the organisms; it cannot edit their weights',
      listNote: 'Everything not measured is listed in `uncertainties`.',
    },
    sourceModel: 'Language model answer',
    sourceVision: 'Vision-assisted analysis',
    numberCheck:
      'Numbers in the model reply — those matching the evidence pack are marked ✓; unmatched ones ✗.',
    preparing: 'Preparing JSON…',
    measurementsTruncated: 'Showing first {shown} of {total} measurements.',
    claimsTruncated: 'Showing first {shown} of {total} number claims.',
    summary: OBSERVER_SUMMARY_EN,
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
    preparing: 'Preparing JSON…',
    branchCreated: 'Branch created',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    turkish: 'Türkçe',
    english: 'English',
    reducedMotion: 'Reduce motion',
    on: 'On',
    off: 'Off',
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
    truncated: 'Showing first {shown} of {total}.',
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

export function getStrings(lang: Language): Strings {
  return DICTIONARIES[lang] ?? tr;
}

/**
 * Şablon doldurma: `{ad}` yerine değer yazar.
 *
 * Neden gerekli: Sayaç içeren metinler (kırpma uyarıları) **sözlükte**
 * kalmalı ki iki dil eşitlenmiş olsun. Sözlük dışına düşen metinler
 * (`EventsPanel`deki gibi bileşen içinde yazılanlar) bir gün yarı
 * çevrilmiş kalır — çünkü çeviri yapacak ikinci bir göz görmez.
 *
 * Bilinmeyen anahtar **yerinde bırakılır** (sessizce boş dize dönmez):
 * eksik bir değişken "…" gibi görünmemeli, hatta görünmelidir.
 */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export const ACTION_LABELS_TR = ['A gradyanına yönel', 'B gradyanına yönel', 'Keşfet', 'Dinlen'] as const;
export const ACTION_LABELS_EN = ['Toward A', 'Toward B', 'Explore', 'Rest'] as const;

export function actionLabels(lang: Language): readonly string[] {
  return lang === 'tr' ? ACTION_LABELS_TR : ACTION_LABELS_EN;
}

/**
 * Genom parametrelerinin görünen adları.
 *
 * ⚠️ Tip **gevşek** (`Record<string, string>`) olsaydı eksik bir üye derleyiciye
 * yakalanmazdı: `cooperation` eklenirken buraya yazılmadı ve soy defteri panelinde
 * o parametrenin satırı **boş** göründü. `Record<GenomeKey, string>` ile bir
 * eksik üye artık **derleme hatası** olur.
 */
export const GENOME_LABELS_TR: Record<GenomeKey, string> = {
  bondAffinity: 'Bağlı kalma',
  bondStrength: 'Bağ dayanımı',
  motility: 'Hareket',
  senseRadius: 'Algı yarıçapı',
  shareEfficiency: 'Paylaşma',
  toleranceA: 'A uyumu',
  toleranceB: 'B uyumu',
  plasticity: 'Plastisite',
  cooperation: 'İşbirliği',
};

export const GENOME_LABELS_EN: Record<GenomeKey, string> = {
  bondAffinity: 'Attachment',
  bondStrength: 'Bond strength',
  motility: 'Motility',
  senseRadius: 'Sense radius',
  shareEfficiency: 'Sharing',
  toleranceA: 'Tolerance A',
  toleranceB: 'Tolerance B',
  plasticity: 'Plasticity',
  cooperation: 'Cooperation',
};

export function genomeLabels(lang: Language): Record<GenomeKey, string> {
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
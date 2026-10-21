/**
 * Gözlemci panelinin **bilimsel özet metinleri** — iki dil.
 *
 * ⚠️ Bu metinler önce `src/worker/evidence.ts` içinde **Türkçe sabit**
 * yazılmıştı ve kanıt paketinin `language` alanı da sabit `'tr'` idi. Yani
 * dil İngilizce'ye geçse bile panelin **tamamı** Türkçe kalıyordu.
 *
 * Şablonlar `{ad}` yer tutucu taşır; `format()` ile doldurulur.
 */

export const OBSERVER_SUMMARY_TR = {
  simProgress:
    'Simülasyon {tick} tick ({seconds} s) ilerlemiş; dünya {events} olay kaydı tutuyor (son {sampled} incelendi).',
  population: 'Canlı hücre sayısı: {value}.',
  largestColony: 'En büyük bağlı küme: {value} hücre.',
  multiCell:
    '{threshold}+ hücreli yapı sayısı: {value} (oyunun işletimsel eşiği, biyolojik tanım değil).',
  bonds: 'Aktif hücre bağı sayısı: {value}.',
  predatorEnergy: 'Avcı enerjisi: {value} e (yerel seçilim baskısı).',
  learningUpdates: 'Tamamlanmış politika güncellemesi: {value}.',
  residualViolation: 'Enerji muhasebesinde {value} e fark var — korunum ihlali işareti.',
  residualOk: 'Enerji muhasebesi korunuyor (bakiye farkı ihmal edilebilir).',
  interventions:
    'Kayıtta {value} oyuncu müdahalesi var; müdahalesiz karşılaştırma için uygun değil.',
  multicellObserved:
    'Bağlı kümeler oluştuğu için çok hücreli yapılar gözlenmiş sayılır; bu yalnız gözlemdir, nedensellik değildir.',
  multicellNotObserved:
    'Şu ana kadar {threshold} eşiğin üzerinde bağlı küme yok. Bu "henüz gözlenmedi" demektir; olmayan bir sonuç değildir.',
  deepestLineage:
    'En derin soy {label} ({generation}. nesil); atasal–torun genom uzaklığı {distance}. Bu bir gözlemdir, adaptasyon kanıtı değildir.',
  networkDelta:
    'Seçili canlının ağında bu yaşamda öğrenilmiş fark sıfırdan büyük; bu, ağırlıkların değiştiğini gösterir. Öğrenmenin BAŞARILI olduğunu göstermez — başarı için ayrılmış tohumlarda kontrol deneyi gerekir.',
  noControl:
    'Kontrol dalı olmadan nedensellik kurulamadı; gözlemler yalnızca birliktelik düzeyindedir.',
  populationDynamics:
    'Popülasyon dinamiği kaynak rezervlerinin sonluluğuyla sınırlıdır; dış girdi müdahaleleri ölçümü değiştirebilir.',
  rewardSignal:
    'Ödül sinyali net enerji/hasar/maliyetlerden üretilir; kaynağın "doğru" olduğuna dair gizli etiket kullanılmaz.',
  noNetworkSummary:
    'Bu soru için seçili bir canlının ağ özeti yok; mikroskop verisi üretilmedi.',
  nextTogether:
    'Deney 1 (Birlikte kalmak): aynı kayıttan iki dal aç; yalnız bağlı kalma eğilimini değiştir, baskıyı sabit tut. Koloni üreme neslini karşılaştır.',
  nextAdaptation:
    'Deney 2 (Adaptasyon): atasal ve torun genotiplerini aynı ortamda, öğrenme ve yeni mutasyon kapalıyken karşılaştır.',
  nextPressure:
    'Seçilim baskısını düşür, aynı tohumla tekrar etkileşimi ve koloni kalıcılığını ölç (tek değişkenli).',
  nextLearning:
    'Deney 3 (Öğrenme): aynı kalıtsal ağla eğitilmiş/eğitilmemiş politikayı, büyüme ve mutasyon kapalıyken ayrılmış tohumlarda karşılaştır.',
}

export const OBSERVER_SUMMARY_EN = {
  simProgress:
    'Simulation advanced {tick} ticks ({seconds} s); the world holds {events} event records (the last {sampled} were examined).',
  population: 'Living cells: {value}.',
  largestColony: 'Largest bonded cluster: {value} cells.',
  multiCell:
    '{threshold}+ cell structures: {value} (the game’s operational threshold, not a biological definition).',
  bonds: 'Active cell bonds: {value}.',
  predatorEnergy: 'Predator energy: {value} e (local selection pressure).',
  learningUpdates: 'Completed policy updates: {value}.',
  residualViolation: 'The energy ledger differs by {value} e — a conservation-violation marker.',
  residualOk: 'The energy ledger is conserved (the balance difference is negligible).',
  interventions:
    'The record has {value} player interventions; not suitable for an intervention-free comparison.',
  multicellObserved:
    'Bonded clusters formed, so multicellular structures count as observed; this is an observation, not causality.',
  multicellNotObserved:
    'No bonded cluster above the {threshold} threshold so far. That means "not observed yet", not a missing result.',
  deepestLineage:
    'Deepest lineage {label} (generation {generation}); ancestor–descendant genome distance {distance}. This is an observation, not evidence of adaptation.',
  networkDelta:
    'The selected organism’s network shows a non-zero learned difference this life; that shows the weights changed. It does NOT show learning succeeded — that needs a control experiment on held-out seeds.',
  noControl:
    'Without a control arm, causality cannot be established; observations are correlational only.',
  populationDynamics:
    'Population dynamics are limited by source reservoir depletion; external input interventions can change the measurement.',
  rewardSignal:
    'The reward signal is produced from net energy/damage/costs; no hidden label of what is "correct" is used.',
  noNetworkSummary:
    'No network summary for a selected organism for this question; microscope data was not produced.',
  nextTogether:
    'Experiment 1 (staying together): open two branches from the same record; change only the bonding tendency, keep pressure fixed. Compare colony reproduction generation.',
  nextAdaptation:
    'Experiment 2 (adaptation): compare ancestor and descendant genotypes in the same environment, with learning and new mutation disabled.',
  nextPressure:
    'Lower the selection pressure, re-measure interaction and colony persistence with the same seed (single variable).',
  nextLearning:
    'Experiment 3 (learning): compare trained/untrained policies from the same inherited network, with growth and mutation disabled, on held-out seeds.',
}

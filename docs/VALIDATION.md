# Cell to Mind — Doğrulama Raporu

**Tarih:** 10 Ekim 2026
**Ortam:** macOS (darwin 27.0.0, arm64) · Node v22.23.1 · npm 10.9.8
**Tarayıcı doğrulaması:** Chromium (chrome-devtools MCP), headless masaüstü
**Simülasyon sürümü:** `1.0.0` · **Şema:** `ctm.world.snapshot` v1

Bu raporda **yalnızca gerçekten çalıştırılan** kontroller yer alır.
Çalıştırılmayan hiçbir şey "başarılı" olarak yazılmamıştır.

---

## 1. Otomatik testler — `npm test`

```
Test Files  4 passed (4)
     Tests  126 passed (126)
```

### 1.1 MLP sayısal doğruluğu (`tests/mlp.test.ts`, 14 test)

| Kontrol | Sonuç |
|---|---|
| Parametre sayısı = 140 | ✅ |
| Birim = 24, ağırlıklı bağlantı = 128, bias = 12 | ✅ |
| Gizli aktivasyonlar tanh aralığında | ✅ |
| Olasılıklar toplamı 1 (hassasiyet 1e-10) | ✅ |
| Softmax kararlılığı (logit ±5000 → NaN yok) | ✅ |
| **Analitik gradyan ↔ merkezi sonlu fark (eps=1e-5)**, 4 eylemin tamamında, 140 parametrede, tolerans **2e-6** | ✅ |
| 5 farklı rastgele ağ × girdi ile tekrarlama | ✅ |
| Gradyan NaN → sıfırlanır | ✅ |
| Gradyan normu sınıra kırpılır | ✅ |
| Yanlış boyutlu girdi/parametre reddi | ✅ |

### 1.2 Simülasyon çekirdeği (`tests/world.test.ts`, 22 test)

| Kontrol | Sonuç |
|---|---|
| Başlangıç bakiyesi = sistem toplamı | ✅ |
| **3000 tick enerji korunumu** (her 500 tick'te, |residüel| < 1e-3) | ✅ |
| Beslenme rezervden düşer, dış girdi yokken korunum | ✅ |
| Baskı 0.9'da 2500 tick korunumu | ✅ |
| Dış besin: kapasite doluyken **enerji yaratmaz** | ✅ |
| Dış besin: kapasite açıldıktan sonra kaydedilir | ✅ |
| Varsayılan rejenerasyon = 0, 2000 tick dış girdi yok | ✅ |
| Rejenerasyon açıkken korunum | ✅ |
| **Bölünme: anne + yavru = eşik − maliyet**, oran 0.55/0.45 | ✅ |
| **Hücre bölünmesi organizma neslini artırmaz** | ✅ |
| Bağsız dünyada her organizma tek hücre | ✅ |
| **Bağlı dünyada çok hücreli yapılar + 4+ hücreli yapılar oluşur** | ✅ |
| **Her 4+ hücreli yapı bağ grafiğiyle bağlı** (uç sayısı ≥ 2(N−1)) | ✅ |
| Bağımsız doğum: nesil +1, soy korunur, ebeveyn kaydı | ✅ |
| Yavrunun kalıtsal ağı ebeveynin `thetaInherited`'ına **daha yakın** (ortalama) | ✅ |
| **Yeni doğan: `thetaLive == thetaInherited`, baseline/ödül/yörünge sıfır** | ✅ |
| **Ebeveynin öğrenilmiş farkı yavruya aktarılmaz** (fark > 0 iken denetlendi) | ✅ |
| **Öğrenme kapalıyken ağırlıklar hiç değişmez** (0 güncelleme) | ✅ |
| Öğrenme açıkken ağırlıklar değişir **ve organizma kaydına yansır** | ✅ |
| Determinizm: aynı tohum → aynı sonuç (popülasyon, enerji, güncelleme sayısı) | ✅ |
| Farklı tohum → farklı yol | ✅ |
| **10.000 tick boyunca NaN/çökme yok**, enerji ≥ 0 | ✅ |
| Olay geçmişi ≤ 2000, ölçüm geçmişi ≤ 600 (sınırsız büyüme yok) | ✅ |

### 1.3 İstatistik katmanı (`tests/stats.test.ts`, 24 test)

| Kontrol | Sonuç |
|---|---|
| Ortalama, n−1 paylı standart sapma, medyan (bilinen cevaplı örnekler) | ✅ |
| Kuantil tür 7 interpolasyonu | ✅ |
| IQM tek dev outlier'dan etkilenmez | ✅ |
| **Bootstrap determinizmi** (aynı tohum → bit düzeyinde aynı aralık) | ✅ |
| Aralık nokta tahmini içerir; sabit veride çöker | ✅ |
| Yüksek güven düzeyi → daha geniş aralık | ✅ |
| Tek koşuda aralık = nokta tahmin (gizlenmez) | ✅ |
| Bootstrap aralığının **ayrıklığı** (n ≲ 12) dokümana bağlandı ve test edildi | ✅ |
| Çok güçlü pozitif farkta küçük p; sıfıra yakın farkta yüksek p | ✅ |
| `probabilityOfImprovement` pozitif/negatif farkta uçlara gider | ✅ |
| p-değeri asla 0 değildir (düzeltme terimi) | ✅ |
| **Eşleştirilmiş fark aralığı, ayrı kol aralıklarından daha dar** | ✅ |
| `mean(differences) == mean(treatment) − mean(control)` | ✅ |

### 1.4 Deney altyapısı (`tests/experiments.test.ts`, 62 test)

Bunlar kütüphaneyi değil **deney yükünün doğruluğunu** doğrular. Yanlış çalışan
bir deney kodu, yanlış sayılar üretir ve bu rapor yanıltıcı hâle gelir.

| Kontrol | Sonuç |
|---|---|
| Arena ve koloni: aynı girdi → **bit düzeyinde** aynı sonuç | ✅ |
| Farklı tohum → farklı dünya (kolay yanlış-pozitif koruması) | ✅ |
| Aynı seed → aynı başlangıç ağı (eşleştirmenin temeli) | ✅ |
| Öğrenme kapalıyken ‖Δθ‖ **tam olarak 0**, güncelleme sayısı 0 | ✅ |
| Öğrenme açıkken ‖Δθ‖ > 0 | ✅ |
| Ağırlık enjeksiyonu politikaya gerçekten uygulanıyor | ✅ |
| Farklı ağırlık → farklı skor (deney gerçekten müdahale edebiliyor) | ✅ |
| Yanlış boyutlu θ açık hata verir | ✅ |
| **Enerji korunumu: arena ve koloni, |residüel| < 1e-6** | ✅ |
| Ölçüm skoru [0, 1] aralığında | ✅ |
| Ölüm kaydı tutulur; ölümden sonra katkı 0'dır (ölüm cezadır) | ✅ |
| `bondAffinity` müdahalesi bağ sayısını gerçekten değiştirir | ✅ |
| `genomeDistance` simetrik, özdeşlikte 0 | ✅ |
| Tüm değişmez kontroller geçer | ✅ |
| Zorluk kalibrasyonu azalan headroom eğrisi verir | ✅ |
| **Enjeksiyonsuz öğrenme koşusunda da ağırlık kayması ölçülür** (regresyon koruması) | ✅ |
| Değerlendirme koşusunda (öğrenme kapalı) ağırlık kayması 0 kalır | ✅ |
| Öğrenme zorluk taraması her noktada geçerli aralık üretir | ✅ |
| Zorluk taramasında headroom kaynak azaldıkça artar | ✅ |
| Tarama biçimlendirmesi satır başına bir nokta üretir | ✅ |
| Deney 3 raporu ezber karşılaştırmasını içerir; daralma = ezber − genelleşme | ✅ |
| Eğitim ve değerlendirme tohumları ayrık kalır (1001+ ) | ✅ |

---

## 2. Ekolojik davranış — ölçülen, varsayılmayan

Headless ölçüm (`vite-node`), 48 kurucu organizma, standart habitat:

| Tick | Sim süresi (1×) | Popülasyon | En büyük küme | 4+ hücreli yapı | Bağ |
|---|---|---|---|---|---|
| 2.000 | 100 s | 225 | **9** | **11** | 78 |
| 6.000 | 300 s | 216 | 4 | 1 | 6 |
| 12.000 | 600 s | 129 | 2 | 0 | 1 |
| 20.000 | 1.000 s | 78 | 2 | 0 | 1 |

**Okuma:**
- Çok hücrelilik **100 saniyede** (4× hızda ~25 s) gözlenir. Görev hedefi olan
  "ilk dakikalarda bölünme ve bağlı koloniler görülmesi" karşılanıyor.
- Taşıma kapasitesi (256) aşılmıyor; yoğunluk rekabeti dengeyi kuruyor.
- **Dürüstlük notu:** 6.000 tick sonrasında kolonilerin çoğu dağılıyor. Bu
  olgu gizlenmedi; kaynak tükenmesi ve avcı baskısıyla uzun vadeli gerilim
  beklenen bir sonuçtur. Kolonileri sürdürmek oyuncunun müdahale alanıdır.
- 20.000 tick'te hâlâ 78 canlı hücre yaşıyor; sistem çökmüyor.
- **Deneyler bu eğrinin kaybolduğu bölgeyi tarıyor:** §4'teki koloni
  deneyleri 4.000 tick ile burada duruyor. Yani uzun vadeli sönümlenme bu
  deneylerin penceresinin **dışında** kalıyor; bulgular "sistem sürüyor" değil
  "sistem ilk 4.000 tick'te şöyle davranıyor" demektir.

---

## 3. Performans (ölçülen)

`vite-node` ile, aynı makinede:

| Aralık | Popülasyon | ms/tick |
|---|---|---|
| tick 2.000–3.000 | 283 | **0.565** |
| tick 6.000–7.000 | 167 | **0.379** |

Bu, 1× hızda (20 tick/sn) saniyede ~8–11 ms CPU demektir; 60 FPS bütçesinde
anlamlı bir pay bırakır. 256 hücrelik standart kapasitede 60 FPS **hedef**
olarak konuldu; tarayıcıda kare hızı ölçülmedi (bkz. §8 açık doğrulamalar).

Optimizasyon notu: yaşayan organizma sırası önbelleklendi, uzamsal ızgara
3.2 → 1.2 mb sıklaştırıldı. Bu iki değişiklik birlikte ~0.76 → ~0.38 ms/tick
getirdi.

Deney paketinin tam koşumu **108 simülasyon, 84.4 saniye** sürdü (bkz. §4).

---

## 4. Deney paketi — gerçekten koşuldu

**Komut:** `npm run experiments` (headless, `vite-node`)
**Kapsam:** 56.159 simülasyon · 325.6 s · 5 değişmez kontrol · 3 deney + kalibrasyon + 5 tarama + ödül teşhisi + evrimsel karşılaştırma + Faz B teşhisi
**Tam rapor (ham koşu değerleri dâhil):** `docs/EXPERIMENTS.md`

### 4.1 Değişmez kontroller — 5/5 geçti

| Kontrol | Sonuç |
|---|---|
| Enerji korunumu (arena) | ✅ en büyük \|rezidüel\| = 0.000000000 e |
| Enerji korunumu (koloni) | ✅ en büyük \|rezidüel\| = 0.000000000 e |
| Öğrenme kapalıyken ağırlıklar sabit | ✅ ‖Δθ‖ = 0, güncelleme = 0 |
| Determinizm (arena + koloni, bit düzeyinde) | ✅ |
| Ağırlık enjeksiyonu uygulanıyor | ✅ |

Deneylerin en büyük gözlenen rezidüelleri: arena 0.0 e, koloni **1.7e-8 e**.
Bu, 108 koşunun enerji muhasebesinin simülasyon hassasiyetinde bozulmadığını
gösterir.

### 4.2 Arena zorluk kalibrasyonu — ölçüm headroom'u

Bu kalibrasyon, öğrenme deneyinin okunabilir olup olmadığını **önceden**
belirlemek için koşuldu. Rastgele politikanın skoru kaynak sayısıyla tırmanır;
headroom azaldıkça ölçüm tavana yapışır ve hiçbir iyileşme görünemez.

| Habitat kaynağı | Kontrol skoru (rastgele politika) | Headroom (1 − skor) | Hayatta kalma |
|---|---|---|---|
| 4 | 0.538 | 0.462 | %100 |
| 8 | 0.677 | 0.323 | %100 |
| **14** | **0.794** | **0.206** | %100 |
| 22 | 0.873 | 0.127 | %100 |
| **34 (oyun varsayılanı)** | **0.928** | **0.072** | %100 |

**Bulgu (ürün için de geçerli):** Oyunun varsayılan habitatı **çok kolay.**
Rastgele bir politika bile 0.928 ortalama enerjiyle neredeyse tavan yapıyor ve
hiç ölmiyor. Bu, "her şey iyi gidiyor" değil, **"burası ölçüm yapılamayacak kadar
kolay"** demektir. `docs/ROADMAP.md` Faz B1'in kaynak tükenmesi teşhisiyle
birlikte okunmalıdır: sorun yalnız kaynak miktarı değil, kaynak erişilebilirliği.

Öğrenme deneyi bu yüzden **14 kaynaklık** habitatta koşuldu (headroom 0.206).

### 4.3 Deney 1 — Bağ gücü kolonileri büyütüyor mu?

**Protokol:** Eşleştirilmiş. 12 tohum. Aynı seed iki kolda; tek fark kurucu
genomlarının `bondAffinity` değeri (0.05 ↔ 0.90). Mutasyon kapalı → değer soy
boyunca birebir korunur, etki diğer değişkenlerden arındırılamaz.
**Birincil ölçüm:** pencerede görülen en büyük bağlı küme.

| | Değer |
|---|---|
| Kontrol (bondAffinity 0.05) | 2.33 [2.08, 2.58] |
| Tedavi (bondAffinity 0.90) | **21.25** [18.67, 23.42] |
| **Fark** | **+18.92** [16.42, 21.00] |
| Bootstrap p | **< 0.0001** |
| İyileşme olasılığı | %100 |

| İkincil | Kontrol | Tedavi |
|---|---|---|
| Zirve 4+ hücreli yapı sayısı | 0.0 | 31.3 |
| Pencere sonu bağ sayısı | 1.3 | 91.6 |
| Pencere sonu popülasyon | 232.8 | 267.1 |

**Okuma — güçlü pozitif, ama nüanslı.** Çok hücrelilik tek bir kalıtsal
parametreyle üst üste büyük bir etkiyle kontrol ediliyor. Ancak `bondAffinity`
0.05 bağ kurmayı neredeyse tamamen engelliyor: kontrol kolunda 4+ hücreli yapı
**sıfır**. Yani karşılaştırma "ince ayar" değil, **"koloni var mı yok mu"**
karşılaştırmasıdır. Oyunun varsayılan kurucu popülasyonu bu iki uç arasında
bir yerde duruyor ve §2'deki "en büyük küme 9" değeriyle tutarlı.

### 4.4 Deney 2 — Mutasyon + seçilim popülasyonu iyileştiriyor mu?

**Protokol:** Eşleştirilmiş. 12 tohum. Aynı seed iki kolda; tek fark
`mutationEnabled`. 4.000 tick.
**Birincil ölçüm:** pencere sonu ortalama normalize enerji.

| | Değer |
|---|---|
| Kontrol (donmuş) | 0.342 [0.307, 0.377] |
| Tedavi (evrilen) | 0.353 [0.325, 0.382] |
| **Fark** | +0.011 [−0.001, +0.025] |
| Bootstrap p | **0.097** |
| İyileşme olasılığı | %96 |

| İkincil | Kontrol | Tedavi |
|---|---|---|
| Genom kayması (`genomeShift`) | 0.007 | 0.006 |
| Ulaşılan en yüksek nesil | 2.92 | 2.92 |
| Zirve en büyük küme | 12.67 | 12.25 |
| Pencere sonu 4+ hücreli yapı | 3.08 | 2.25 |

**Okuma — belirsiz, ve nedeni ölçülmüş.** Farkın yönü olumlu ama güven aralığı
sıfırı içeriyor; p = 0.097 ile bu deney **sonuçsuzdur**. İkincil ölçüm daha
önemli: mutasyon açıkken genom kayması donmuş koldan **daha büyük değil**
(0.006 ↔ 0.007) ve iki kol **aynı nesle** ulaşıyor (2.92).

Bu, evrimin işe yaramadığı anlamına **gelmez**. Pencerede yalnızca ~3 nesil
geçiyor; 3 nesilde genetik ayrışma oluşması beklenmez. Bu bir **tasarım
sınırlaması** bulgusudur ve şu anlama gelir: evrimsel iddialar için ya pencer
uzatılmalı ya da nesil sayısı deneyin birincil ekseni yapılmalıdır.

### 4.5 Deney 3 — Yaşam içi öğrenme politikayı iyileştiriyor mu?

**Protokol (sonuçtan önce sabitlendi):**
1. **Eğitim:** tohum 1..20, öğrenme AÇIK, 6.000 tick. Koşu sonu `thetaLive` saklanır.
2. **Değerlendirme:** tohum 1001..1020, öğrenme KAPALI, iki kol:
   kontrol = o dünyanın kendi rastgele başlangıç ağı; tedavi = eğitilmiş politika.
   Aynı seed → aynı kaynak düzeni ve başlangıç konumu.
3. Eğitim ve değerlendirme tohum kümeleri **ayrık** → sonuç ezber değil,
   **genelleşme** ölçüsüdür.

| | Değer |
|---|---|
| Kontrol (rastgele ağ) | 0.826 [0.778, 0.869] |
| Tedavi (eğitilmiş politika) | 0.847 [0.805, 0.884] |
| **Fark** | +0.020 [−0.022, +0.061] |
| Bootstrap p | **0.333** |
| İyileşme olasılığı | %83.3 |

| İkincil | Değer |
|---|---|
| Kontrol kolunun headroom'u | 0.174 |
| **EZBER KONTROLÜ — eğitim dünyasındaki fark** | **−0.000** |
| Ezber farkı − genelleşme farkı | −0.021 |
| Değerlendirmede hayatta kalma (iki kol) | %100 / %100 |
| **Eğitimde politika güncellemesi sayısı** | **9.0** |
| **Eğitimde ağırlıkların kaydığı (‖Δθ‖)** | **0.003** |
| Eğitim koşularında hayatta kalma | %0 |

**Okuma — negatif sonuç, teşhisi ölçülmüş olarak verildi.**

Yön olumlu, iyileşme olasılığı %83, ama güven aralığı sıfırı içeriyor. **Bu
koşullarda ölçülebilir bir öğrenme etkisi yoktur.** `docs/PROGRESS.md` §2.1'deki
eski kabul hedefi ("20 tohumun en az 15'i") bu raporla **geçersiz kılındı:**
eşik testi başarı ile şansı ayıramaz ve artık kullanılmıyor.

**Ezber kontrolü belirleyicidir.** Eğitilmiş politika, **eğitildiği dünyada**
kontrolü geçmiyor (fark −0.000). Yani sonuç "ezber" değil: ne ezber ne de
kısmi öğrenme. Dokuz adımlık öğrenme hiçbir ortamda davranışı değiştirmiyor.

Üç ölçülmüş neden, hepsi aynı yere işaret ediyor:

1. **Öğrenme neredeyse hiç gerçekleşmiyor.** `DECISION_EVERY_TICKS = 10` ve
   `TRAJECTORY_LIMIT = 64` birlikte bir politikaya 640 tick'te **bir** gradyan
   adımı veriyor. 6.000 tick'lik bir yaşam boyu = **9 güncelleme**.
2. **Adım boyutu çok küçük.** Güncelleme ölçeği
   `LEARN_RATE × (0.25 + 0.75 × plasticite) / adım_sayısı` ile hesaplanıyor;
   64'e bölme ve `LEARN_RATE = 0.02` birlikte 9 adımın toplam ağırlık
   hareketini **‖Δθ‖ = 0.003**'e düşürüyor. 140 parametre üzerinden bu,
   parametre başına ortalama 2.5e-4 kayma demek — karar sınırlarını geçmeye
   yetmez.
3. **Görev ölçüm için kolay.** İki kol da %100 hayatta kaldı; fark yalnız
   beslenme kalitesinde aranıyor (headroom 0.174).

**Bu bulgular, projenin "yaşam öğrenir" iddiasının şu anda kanıtlanmadığı
anlamına gelir.** Uygulama öğrenmeyi gerçekten uygular (ağırlıklar değişir,
gradyanlar doğrulanmıştır) ama 6.000 tick'lik bir yaşamda öğrenmenin davranışa
yansıyacak kadar hareket üretmediği **ölçülmüştür.**

### 4.6 Öğrenme · zorluk taraması (önceden kaydedilmiş eksen)

Varsayılan habitatta ölçüm mümkün değildi: headroom 0.072. Bu tarama soruyu
**ölçerek** yanıtlar: *headroom açıldığında öğrenme etkisi beliriyor mu?*
Her noktada tam protokol koşar (12 eşleştirilmiş tohum, ayrık eğitim/değerlendirme
tohumları, bootstrap aralığı). **Tüm eğri raporlanır**, yalnız elverişli nokta
seçilmez.

| Kaynak | Headroom | Kontrol | Tedavi | Fark [95% CI] | p | İyileşme olasılığı |
|---|---|---|---|---|---|---|
| **4** | 0.429 | 0.571 | 0.551 | [−0.050, +0.005] | 0.171 | **%7.0** |
| 8 | 0.357 | 0.643 | 0.682 | [−0.006, +0.091] | 0.108 | %95.4 |
| 14 | 0.181 | 0.819 | 0.821 | [−0.059, +0.060] | 0.952 | %52.7 |
| 22 | 0.116 | 0.884 | 0.891 | [−0.030, +0.038] | 0.698 | %66.7 |
| 34 | 0.068 | 0.932 | 0.937 | [−0.005, +0.015] | 0.386 | %80.4 |

**Okuma — bu tarama bir aday kararı çürüttü.** En açık zorlukta (4 kaynak,
headroom 0.429) öğrenme farkı **negatif** ve iyileşme olasılığı **%7**.
Headroom açmak öğrenmeyi ölçülebilir kılmıyor.

İyileşme olasılığının monoton olmaması (%7 → %95 → %53 → %67 → %80) ek bir
gösterge: bu bir etki değil, **gürültüdür.** Gerçek bir etki zorluk ekseninde
düzenli bir eğri izlerdi.

**Sonuç: habitat zorluğunu değiştirmek öğrenme iddiasını kurtarmaz.** Ürünün
gözle görünür halini, ölçülebilir bir fayda olmadan değiştirmiş olurduk.

---

### 4.7 Öğrenme sinyali duyarlılığı — teşhisin doğrulanması

§4.5–4.6 iki olası açıklamayla geliyordu: (a) görev ölçüm için çok kolay,
(b) gradyan adımı çok küçük. Bu tarama ikisini ayırır: güncelleme sıklığını
ve adım büyüklüğünü ayrı ayrı değiştirip **ağırlık hareketinin hangi
büyüklükte davranışa yansıdığını** ölçer.

Model sabitlerinin **varsayılanları değişmemiştir**; bu bir duyarlılık
analizidir, ürün kararı değildir. Oyun her zaman varsayılanlarla çalışır.

| Ufuk | lr | Güncelleme | ‖Δθ‖ | Fark [95% CI] | p | İyileşme |
|---|---|---|---|---|---|---|
| **64 (varsayılan)** | **0.02 (varsayılan)** | **9** | **0.003** | [−0.077, +0.088] | 0.869 | %57.4 |
| 64 | 0.10 | 9 | 0.014 | [−0.076, +0.087] | 0.826 | %60.7 |
| 64 | 0.50 | 9 | 0.068 | [−0.117, +0.075] | 0.827 | %43.6 |
| 16 | 0.02 | 37 | 0.027 | [−0.136, +0.053] | 0.482 | %24.6 |
| 16 | 0.10 | 37 | 0.141 | [−0.139, +0.057] | 0.614 | %33.1 |
| 16 | 0.50 | 37 | 0.556 | [−0.222, +0.008] | 0.080 | %4.0 |
| 8 | 0.10 | 75 | 0.457 | [−0.234, −0.028] | **0.010** | %0.4 |
| 8 | 0.50 | 75 | **1.571** | **[−0.401, −0.209]** | **0.0001** | **%0.0** |

**Okuma — bu, teşhisi tersine çevirdi.**

Ağırlık hareketi **570×** büyütüldü (0.003 → 1.571) ve gradyan adımı sayısı
**8×** arttı (9 → 75). Beklenen iyileşme yerine, davranış farkı **güçlü biçimde
negatif** oldu: −0.401, p = 0.0001, iyileşme olasılığı **%0.0**.

Ezber kontrolü bunu doğruluyor: en büyük adımda eğitim dünyasındaki fark da
**−0.275**. Eğitilmiş politika, eğitildiği dünyada bile kontrolün belirgin
biçimde altında.

Bu, "adım çok küçük" teşhisinin yanlış olduğunu gösterir. Doğru yorum şudur:
**gradyan burada pratik olarak gürültüdür; adımı büyütmek gürültüyü
büyütür.** Varsayılan ayarlar (64 / 0.02) ölçülen ızgarada **en zararsız**
noktadır — yani ürünün şu anki sabitleri yanlış değildir, aksine en iyi
mevcut seçimdir.

**Gerçek darboğaz ödül sinyalidir.** §4.2 ve §4.6 birlikte bunu gösteriyor:
organizma besleniyor ve hayatta kalıyor (iki kol da %100), dolayısıyla ödül
neredeyse sabit. Sabit bir ödülde avantaj ≈ 0, gradyan ≈ 0, REINFORCE'in
yüksek varyansı ise gürültü olarak kalır. Bu, Skalse vd.'in biçimselleştirdiği
"bir ödül işlevi kaçınılmaz olarak hacklenebilir" değil, onun daha zayıf bir
hali: **ödül, politikanın kararlarına duyarlı değil.**

Sonuç: öğrenme sistemi doğru yazılmış ve gradyanları doğrulanmış, ancak
**sinyalsiz bırakılmış.** Çözüm yeni bir öğrenme algoritması değil; ödülün
davranışa duyarlı ve doygunlaşmayan hâle getirilmesi — ki bu da §4.6'daki
zorluk ekseniyle aynı kökten çıkar.


### 4.8 Politika uzayı araştırması — darboğazın son ayrımı

§4.5–4.7'ye kadar iki açıklama yarışıyordu: politika **öğrenemiyor**, yoksa
politika sınıfı **zaten tıkanmış**. 160 rastgele (eğitimsiz) politika örneklenerek
ikisi ayrıldı.

| Ölçüm | Değer |
|---|---|
| Örnek | 160 rastgele politika, 14 kaynaklı habitat |
| Minimum | 0.520 |
| Çeyreklik | 0.775 |
| **Medyan** | **0.854** |
| Üst çeyreklik | 0.901 |
| Maksimum | **0.963** |
| Ortalama | 0.826 |
| **Öğrenilebilir açıklık** (en iyi %10 ortalaması − genel ortalama) | **0.118** |

**Okuma — politika sınıfı tıkanmamış, geniş açık.**

Rastgele seçimle bile 0.137 puanlık bir yayılım var (0.826 → 0.963). Yani
**öğrenilecek davranış mevcut ve fazlasıyla erişilebilir.** Bu şu anlama gelir:
öğrenmenin başarısızlığı görevden, habitat zorluğundan veya model kapasitesinden
**değil**, öğrenme algoritmasından kaynaklanıyor.

Bu, §4.7'deki bulguyu tamamlar ve sonucu kesinleştirir:

| Aday açıklama | Durum | Kanıt |
|---|---|---|
| Görev ölçüm için çok kolay | **Kısmen doğru** — varsayılan habitatta evet | §4.2 (headroom 0.072) |
| Habitat zorluğu çözüm | **Elendi** — zorluk artınca etki belirmiyor | §4.6 (4 kaynakta iyileşme %7) |
| Adım boyutu çok küçük | **Elendi** — 570× büyütünce politika kötüleşiyor | §4.7 (p = 0.0001, iyileşme %0.0) |
| Politika sınıfı tıkanmış | **Elendi** — 0.118'lik açıklık var | §4.8 |
| **REINFORCE tahmin edicisi gürültü baskın** | **Kalan açıklama** | §4.5 + §4.7 birlikte |

**Kalan sonuç:** Doğru yazılmış ve gradyanı doğrulanmış bir REINFORCE
uygulaması, bu görevde **yüksek varyansı nedeniyle** sinyalin üzerine çıkamıyor.
Amaçlandığından çok daha küçük gradyan adımlarıyla ilerlemek (mevcut 0.003),
daha büyük adımlarla ilerlemekten (1.571) **daha az zararlı** — bu da doğrudan
"gradyan yönü gürültü" teşhisinin işaretidir.

Bu, bir sonraki adım için ölçülmüş bir zemin: sorun performans ya da model
değil, **öğrenme algoritmasının varyansı.**


### 4.9 Evrimsel politika araması — karar verici karşılaştırma

§4.8 politika sınıfında 0.118'lik öğrenilebilir açıklık olduğunu ölçtü, §4.5–4.7
yaşam içi REINFORCE'ın bu açıklığa ulaşamadığını gösterdi. Bu bölüm ayırıcı
soruyu yanıtlar: **açıklık aramayla bulunabiliyor mu?**

**Protokol:** (μ+λ) elitist seçilim, μ=8 ebeveyn, λ=3 çocuk, 12 nesil, ağırlık
uzayında Gauss mutasyonu. Evrim **1..6 tohumlarında** arar; bulunan politika
**1001..1006 tohumlarında** (hiç görülmemiş) ölçülür — yani Deney 3 ile birebir
aynı tohum ayrımı. Aynı arena, aynı ölçüm, aynı skor tanımı. Tek fark: **arama
yöntemi.**

| Nesil | En iyi | Ortalama |
|---|---|---|
| 0 | 0.927 | 0.808 |
| 1 | 0.927 | 0.905 |
| 4 | 0.931 | 0.918 |
| 9 | 0.931 | 0.916 |

| | Skor | Rastgele taban |
|---|---|---|
| Eğitim tohumları (1..6) — bulunan | 0.931 | 0.735 |
| **Değerlendirme (1001..1006, görülmemiş) — bulunan** | **0.916** | 0.755 |
| **Kazanım** | **+0.161** | — |

**Okuma — evrim bulur, REINFORCE bulamaz.**

| Yöntem | Görülmemiş dünyalardaki kazanç | Kanıt |
|---|---|---|
| Yaşam içi REINFORCE (9 güncelleme) | +0.020 [−0.022, +0.061] | p = 0.333 — etki yok |
| Yaşam içi REINFORCE (75 güncelleme, 570× adım) | **−0.234** | p = 0.010 — zararlı |
| **Evrimsel arama (12 nesil)** | **+0.161** | görülmemiş tohumlarda |

Evrim, eğitilmediği dünyalarda **REINFORCE'un bulduğunun sekiz katı** kazancı
buluyor. Popülasyon ortalamasının da yükseldiği (0.808 → 0.916) elitizmin
gerçekten seçim yaptığını gösteriyor.

Bu, teşhisi kapatır: **görev öğrenilebilir, politika sınıfı yeterli, arama
çözümü buluyor — ve aynı ölçümde yaşam içi REINFORCE bulamıyor.** Darboğaz
kesin olarak öğrenme algoritmasının kendisindedir (yüksek varyans), görevde
veya temsil kapasitesinde değil.

**Dürüstlük notları:**
- Değerlendirme penceresi evrim için 3.000 tick, Deney 3 için 4.000 tick'tir.
  Bu küçük fark 8 katlık farkı açıklamaz, ama kesin bir eşitlik iddiası da
  değildir.
- Evrim 2 tohumla koştuğunda **aşırı uyum** yapıyor ve kazanç negatife dönüyor
  (ölçüldü, `tests/experiments.test.ts`). Bu yüzden üretim ayarı 6 tohum; düşük
  tohum sayısının aşırı uyum riski belgelenmiştir.
- Evrim araması **görsel üründe kullanılmıyor.** Bu bir laboratuvar kontrolüdür.

---


### 4.10 S-1 · Varyans azaltma deneyi — **başarısız**

**Önceden kaydedilen hipotez:** darboğaz ölçek değil **varyans**; dolayısıyla
avantaj dönüşümü (z-skor veya işaret) gradyanın sinyal/gürültü oranını
artıracak ve ölçülebilir iyileşme doğracak.

**Önceden kaydedilen başarı ölçütü:** en az bir varyantta farkın güven aralığı
sıfırdan ayrışmalı (**p < 0.05**) ve iyileşme olasılığı **> %80** olmalı.

**Kritik tasarım:** tarama `TRAJECTORY_LIMIT` ve `LEARN_RATE`'i **varsayılanlarda
tutar** (64 / 0.02). §4.7'de adımı büyütmenin kötüleştirdiği ölçüldüğü için,
varyans azaltmanın başarısı ölçek değiştirilmeden gösterilmelidir.

| Varyant | Güncelleme | ‖Δθ‖ | Fark [95% CI] | p | İyileşme | Ezber |
|---|---|---|---|---|---|---|
| Temel (dönüşüm yok) | 9 | 0.0027 | [−0.022, +0.062] | 0.325 | %83.5 | 0.017 |
| z-skor avantaj | 9 | 0.0035 | [−0.021, +0.067] | 0.320 | %84.8 | 0.014 |
| İşaret avantajı | 9 | 0.0025 | [−0.020, +0.064] | 0.278 | %85.9 | 0.017 |
| **İşaret + z-skor** | 9 | 0.0031 | [−0.014, +0.067] | **0.167** | **%91.1** | 0.016 |

**Sonuç: S-1 BAŞARISIZ. Hiçbir varyant p < 0.05 sağlamadı.**

Bu bir başarısızlık kaydıdır; önceden kaydedilmiş ölçüt böyleydi ve sonuç
olduğu gibi yazıldı.

**Yönde tutarlılık var, ama yeterli değil.** İyileşme olasılığı dört varyantta
monoton artıyor (83.5 → 84.8 → 85.9 → 91.1) ve en iyi varyantın güven aralığı
en dar. Yani varyans azaltma doğru yönde çalışıyor — ama etkisi, gürültüyü
azaltmaya yetmiyor.

**Neden yetmiyor.** Varsayılan ayarlarda politika yalnızca **9** güncelleme
alıyor. Avantaj dönüşümü gradyanın *ölçeğini* düzeltir; 9 adımlık bir toplam
hareketin içinden 140 parametreli bir politikada anlamlı bir davranış değişimi
çıkarmak için gereken sinyal/gürültü oranını sağlamaz.

Ezber kontrolü bunu doğruluyor: dört varyantta da eğitim dünyasındaki fark
**0.014–0.017** aralığında, yani sıfıra yakın. Eğitilmiş politika eğitildiği
dünyada bile kontrolü geçmiyor.

**S-1'in yanlışlanması ne öğretiyor.** §4.7 "daha büyük adım kötüleştiriyor"
dedi, §4.10 "daha iyi avantaj yetmiyor" diyor.

> ⚠️ Aşağıdaki paragraftaki "sınırlayıcı olan toplam gradyan örnek sayısı"
> çıkarımı **sonradan yanlışlanmıştır** (§4.12). Gözlemler geçerlidir,
> çıkarım değildir.

**Ölçülmemiş tek kalan bileşim:** varyans azaltma + *ölçülü* adım artışı.
§4.7'de büyütme denendi ama o deneme avantaj dönüşümü olmadan yapıldı.
İşaret avantajı gradyan büyüklüğünü sınırladığı için, dönüşümlü hâlde büyük
adımın gürültüyü değil sinyali büyütmesi mümkündür. Bu, tarama listesinde
**yapılmamış** bir denemedir ve S-2'ye geçmeden test edilmelidir.

---


### 4.11 S-1b · İşaret avantajı + ölçülü adım artışı — **başarısız (koruma doğrulandı)**

**Önceden kaydedilen hipotez:** §4.7'de büyük adım **dönüşümsüz** gradyanla
kötüleşti; §4.10'da dönüşüm tek başına yetmedi. Bu ikisinin **birleşimi**
denenmemişti. İşaret avantajı gradyan büyüklüğünü sınırladığı için büyük adımın
gürültüyü değil sinyali ölçeklemesi bekleniyordu.

**Önceden kaydedilen başarı ölçütü:** S-1 ile **aynı eşik** — en az bir noktada
p < 0.05 ve iyileşme olasılığı > %80.

Ufk 64 (varsayılan), 20 eşleştirilmiş tohum, işaret avantajı açık:

| lr | ‖Δθ‖ | Fark [95% CI] | p | İyileşme | Ezber |
|---|---|---|---|---|---|
| 0.02 (varsayılan) | 0.0025 | [−0.019, +0.064] | 0.276 | **%86.0** | 0.017 |
| 0.1 | 0.0122 | [−0.029, +0.050] | 0.552 | %73.3 | 0.011 |
| 0.5 | 0.0626 | [−0.037, +0.059] | 0.548 | %73.6 | −0.004 |
| 2.0 | 0.2670 | [−0.060, +0.041] | 0.785 | %40.3 | −0.030 |

**Sonuç: S-1b BAŞARISIZ. Hiçbir nokta p < 0.05 sağlamadı.**

**Ama hipotezin koruyucu yarısı doğrulandı.** Aynı lr = 0.5 noktası, iki
kurulumun karşılaştırması:

| Kurulum | Fark [95% CI] | Aralık genişliği | İyileşme |
|---|---|---|---|
| §4.7 · dönüşüm yok | [−0.117, +0.075] | 0.192 | %43.6 |
| §4.11 · işaret avantajı | [−0.037, +0.059] | **0.096** | **%73.6** |

İşaret avantajı, büyük adımın verdiği hasarı **yarıya indirdi**: güven aralığı
yarıya, iyileşme olasılığı 43.6%'dan 73.6%'ya çıktı. Beklenen mekanizma doğrulandı.

**Neden yine de yetmedi.** Koruma hasarı sınırlıyor, **kazanç yaratmıyor.**
Adım büyüdükçe (0.02 → 2.0) iyileşme olasılığı 86.0 → 40.3'e düşüyor ve ezber
farkı 0.017'den −0.030'a gidiyor: yani hareket arttıkça politika giderek
kötüleşiyor, sadece daha yavaş.

**Bu, teşhisi keskinleştirir.** Üç ölçüm birleşiyor:

1. Adım artışı **zarar** veriyor (§4.7).
2. Zararı sınırlamak **yetmiyor** (§4.10, §4.11).
3. Aynı görevde arama **+0.161** buluyor (§4.9).

Eğer gradyan yalnızca **yüksek varyanslı** olsaydı, varyans azaltma ile kazanç
ortaya çıkardı. Çıkmıyor. Bu, gradyanın yalnız gürültülü değil, **büyük ölçüde
bilgi taşımayan** olduğuna işaret eder — yani iyileştirme yönü ile davranış
kalitesi arasında bağ kurulamıyor.

**Kalan ölçülmemiş bileşen tek bir şey:** ödülün kendisi. `pendingE` (karar
aralığı boyunca emilen enerji) kaynak bolken eylemden bağımsız; ödül, politikanın
kararlarına duyarlı olmayabilir. S-2 tam olarak bunu ölçecek. S-1, S-1b ve §4.7
birlikte **optimizer tarafındaki tüm açıklamaları tüketti**: ne ölçek, ne ufuk,
ne avantaj dönüşümü sorunu çözmüyor.

---


### 4.12 S-2 teşhisi · Ödül sinyali — **önceki teşhisi çürüttü**

§4.10–4.11 sonrası "optimizer tarafı tükendi, sorun ödülde" denmişti. Bu bölüm
o çıkarımı **ölçerek yanlışladı.**

Buraya kadar yalnızca *sonuçlar* ölçülmüştü (politika daha mı iyi davranıyor).
Öğrenmenin çalışıp çalışmadığını belirleyen ise **sinyalin kendisidir**: ödül,
politikanın kararlarına duyarlı mı?

48 politika, her biri 2 dünyada, öğrenme kapalı koşuldu:

| Ölçüm | Değer |
|---|---|
| Ödül (karar başına) — min | 1.197 |
| Ödül — medyan | 2.043 |
| Ödül — maks | **3.290** |
| **Ödül ↔ gerçek performans, Pearson** | **0.696** |
| **Ödül ↔ performans, Spearman** | **0.733** |
| **Politikaya bağlı ödül varyansı payı** | **%97.9** |

**Sonuç: ödül mükemmel bir sinyal.** Ödül, politikalar arasında 2.75× aralıkta
değişiyor, toplam varyansın %97.9'u politika farklarından geliyor ve gerçek
performansla güçlü biçimde korele (r = 0.70). Ödülde sorun **yok.**

### Geriye kalan tek açıklama: kredi ataması

| Ölçüm | Nerede | Ne söyledi |
|---|---|---|
| Ödül politikaya duyarlı mı? | §4.12 | **Evet, çok.** %97.9, r = 0.70 |
| Epimizik toplamı optimize eden yöntem işe yarıyor mu? | §4.9 | **Evet.** Evrim +0.161 |
| Adım-içi avantaj kullanan yöntem işe yarıyor mu? | §4.5, §4.7, §4.10, §4.11 | **Hayır.** Dört ayrı deneme |

Bu üçü tek bir cümlede buluşuyor: **sorun ödül değil, kredi atamasıdır.**

Ödül, *epimizik toplam* olarak mükemmel bir tahmin edicidir. REINFORCE ise bu
toplamı 64 adımlık bir yörüngeye yayıp **her adıma** atamak zorundadır — ve
bilgi tam olarak bu dağıtımda kayboluyor. Her adımın avantajı, o adımdaki
kararın sonucu mu yoksa 30 adım sonraki tesadüfi bir kaynakla mı karşılaştığı
ayırt edilemiyor.

**Bu, §4.7/§4.10/§4.11'i açıklar:** varyans azaltma ve adım ayarı, *adım-içi*
avantajlarda çalışan kaldıraçlardı. Adım-içi avantaj bilgi taşımadığı için
hiçbiri işe yaramadı. Doğru kaldıraç değil.

**Evrim neden çalışıyor:** §4.9'daki arama **hiçbir zaman adım-içi kredi
ataması yapmıyor.** Yalnızca epimizik toplamı artırdığı için, sorunun kendisini
atlar. Bu yüzden +0.161 buluyor.

### Düzeltilen çıkarım

Bu bölüm, bu raporun kendi önceki bölümlerinden birini yanlışlar:
§4.11'in sonunda yazılan "sorun ödüldedir, S-2 bir düzeltme adımı değil kök
nedendir" ifadesi **yanlıştır.** Ödül ölçüldü ve sağlam çıktı. Doğru ifade:
**sorun kredi atamasındadır; ödül zaten yeterlidir.**

Bu düzeltme bir sonraki adımı da değiştirir: "ödülü karar-bağımlı yapma" (S-2)
gereksizdir. Ödül zaten karar-bağımlı.

### Kalan seçenekler

| Seçenek | Durum |
|---|---|
| S-1 varyans azaltma | ❌ adım-içi avantajda çalışıyor, sinyali taşımıyor |
| S-1b işaret + adım | ❌ aynı |
| **S-2 ödülü değiştir** | **❌ gereksiz — ödül ölçüldü ve yeterli** |
| **S-3 kredi ataması olmayan yöntem** | ✅ evrim +0.161 çalıştı; ES/bandit benzeri RL de aynı yapıdadır |

**S-3 artık bir "geri çekilme" değil, yapıya uyan yöntemdir.** Ürüne alınması
hâlinde "yaşam öğrenir" anlatısının değişmesi bir bedeldir; ama bu bedel artık
teknik bir zorunluluk değil, **bilinçli bir seçimdir** — çünkü ölçüldü.

---


## 5. Faz B1 · Ekolojik sönümlenme teşhisi

**Komut:** `npm run experiments` · `src/sim/experiments/ecology.ts`
**Kural:** `docs/ROADMAP.md` Faz B1 — *ayrım yapılmadan hiçbir parametre
değiştirilmez.* Beş rakip açıklama, beş ölçümle ayrıldı.

### 5.1 Zaman serisi (tohum 11, 12.000 tick)

| Tick | Pop | Org | Küme | 4+ | Bağ | Bütünlük | Uzama | Rezerv% | Ölüm: açlık / avcı |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 48 | 48 | 0 | 0 | 0 | — | — | 100.0 | 0 / 0 |
| 1.000 | 100 | 72 | 3 | 0 | 28 | 0.782 | 0.026 | 96.7 | 0 / 0 |
| 2.000 | 157 | 107 | 4 | 1 | 50 | 0.642 | 0.012 | 91.4 | 0 / 0 |
| **3.200** | — | — | **8 (zirve)** | — | — | 0.561 | 0.018 | ~85 | 0 / 0 |
| 4.000 | 254 | 198 | 8 | 6 | 56 | 0.530 | 0.017 | 74.9 | 3 / 2 |
| 5.000 | 247 | 219 | 5 | 2 | 28 | 0.414 | 0.011 | 67.9 | 12 / 2 |
| 6.000 | 217 | 207 | 3 | 0 | **10** | **0.208** | 0.029 | 62.8 | 37 / 3 |
| 7.000 | 175 | 174 | 2 | 0 | 1 | — | — | 59.0 | 73 / 10 |
| 8.400 | — | — | **1 (sönümlenme)** | 0 | **0** | — | — | **54.7** | — |
| 12.000 | 130 | 129 | 2 | 0 | 1 | — | — | 46.5 | 95 / 40 |

### 5.2 Hipotezlerin ayrımı

| Hipotez | Beklenen işaret | Gözlenen | Sonuç |
|---|---|---|---|
| Kaynak tükenmesi | Rezerv sönümlenmede ~0 | Rezerv **%54.7** | ❌ **elen** |
| Avcı baskısı | Ölümlerin çoğu avcı | Avcı **%30**, ve ancak 7.000 tick'ten sonra | ❌ **elen** |
| Enerji bütçesi | Açlık ölümleri baskın | Açlık %70 — **ama kaynak varken** | ⚠️ sonuç, neden değil |
| Bağ mekaniği | Bütünlük düşer, bağ azalır | 0.782 → 0.208, bağ 77 → 0 | ✅ **baskın** |

**Zincir öyle kuruluyor:** bağ bütünlüğü düşüyor → koloniler parçalanıyor →
yalnız kalan hücreler paylaşamıyor → kaynak %55 doluyken açlıkla ölüyorlar →
popülasyon 254 → 130 düşüyor. **Kaynak tükenmesi sonuçtur, neden değil.**

### 5.3 Mekanizma: bağ ömrü

Bütünlük iki terimle erir:
`integrity -= strain × STRAIN_DECAY_K × (1.6 − strength)` ve `integrity -= BOND_FATIGUE`.

**Ölçüm hatası ve düzeltmesi.** Önce hayatta kalan bağların ortalama uzamasını
ölçtüm: **0.010–0.029**, yani bağlar dinlenme uzunluğunun ~%1'i kadar açık.
Bu, "uzama açıklamadır" izlenimi verdi. **Yanlıştı — seçilim yanlılığı:** gerilmiş
bağlar zaten koptuğu için hayatta kalanlar seçilmiş olarak düşük gerilimlidir.
Doğru soru "hayatta kalanlar ne kadar gerilmiş?" değil, **"kıranlar ne kadar
gerilmişti?"** sorusudur. `bond-break` olayı zaten `detail.strain` taşıyor;
oradan toplandı:

| Ölçüm | Değer |
|---|---|
| Kopan bağ sayısı | 83 |
| **Bütünlüğü tükenerek koptu** | **83 (%100)** |
| Uzama sınırını aşarak koptu | 0 (%0) |
| Koptukları andaki medyan uzama | **0.079** |
| Koptukları andaki medyan dayanım | 0.450 |
| Yorgunluk tek başına 12.000 tick'te açıklayabileceği kayıp | **0.24** |

Medyan dayanım 0.450 ve düşük uzama ile tick başına kayıp ≈
`0.02 × 0.02 × 1.15 + 2e-5 ≈ 4.8e-4` → bağ ömrü ≈ **2.100 tick**.

**Teşhis: sınırlayıcı olan bağ ömrüdür.** Bağlar ~2.000–3.000 tick sonra tükenir;
koloniler bu kaybı sürekli yeniden üretmek zorundadır ve üretemez. Geometri
açıklama değildir, avcı değildir, kaynak değildir.

### 5.4 Teşhisin doğrudan sınaması — bağ ömrü duyarlılığı

Önceden kaydedilen ölçüt: yorgunluk ve strain katsayısı düşürüldüğünde
pencerenin **sonunda 4+ hücreli yapıların sıfırdan çıkması** (varsayılan
ayarlarda pencerenin sonunda 0).

| strainK | yorgunluk | Bağ ömrü (tick) | Zirve küme | Son çeyrek küme | **Son 4+ yapı** | Son pop | Son rezerv | Kalıcı |
|---|---|---|---|---|---|---|---|---|
| **0.020 (varsayılan)** | 2e-5 | **2.083** | 17 | 2 | **0.00** | 128.5 | %36.2 | **HAYIR** |
| 0.010 | 1e-5 | 4.167 | 24 | 3 | **0.00** | 128.3 | %35.1 | **HAYIR** |
| **0.005** | 5e-6 | **8.333** | 24 | **10** | **0.25** | 131.5 | %35.0 | **evet** |
| 0.002 | 1e-6 | 21.277 | 24 | 6 | 0.25 | 128.3 | %34.6 | evet |

**Ölçüt KARŞILANDI.** Bağ ömrü 2.083 → 8.333 arasında (×4) koloniler kalıcı hâle
geliyor: pencerenin sonunda 4+ hücreli yapı **0 → 0.25**.

**Bu etki özgüldür.** Popülasyon tüm satırlarda ~128–131, son rezerv ~%35.
Değişen tek şey kolonilerin **kalıcılığı**; bu bir "daha çok hücre" değil,
"daha uzun yaşayan çok hücreli yapı" etkisi.

Geçiş 4.167 ile 8.333 arasındadır ve **monoton değildir** (0.005'te son çeyrek
kümesi 10, 0.002'de 6) — yani bir optimum var, "ne kadar dayanıklı olursa olsun
iyidir" değil.

### 5.5 Bu ne demek, ne demek değil

**Demin:** bağ ömrünün koloni kalıcılığını belirlediği **ölçüldü** ve varsayılan
ayarlarda yetersiz olduğu gösterildi. Varsayılan `STRAIN_DECAY_K` / `BOND_FATIGUE`
değerleri, kolonilerin ilk ~2.000–3.000 tick'te görünmesi için seçilmişti
(§2'deki tablo bunu doğruluyor: zirve 3.200'de).

**Değil:** modelin "yanlış" olduğu. Bu, bir **gözlem penceresi ile bağ ömrü
arasındaki kalibrasyon uyumsuzluğu.** 12.000–20.000 tick'lik bir pencerede
bakmak istiyorsak bağlar o ölçekte yaşamalı; ya da bağ ömrü bir **genom
parametresi** olup seçilime açılmalı (ikinci yol, evrimsel bir soru — aşağıda).

**Sıradaki iki yol (henüz uygulanmadı):**
- **Y-1 Kalibrasyon:** varsayılan katsayıları ölçülen optimuma taşımak.
  Ürün davranışını değiştirir; gerekçesi ölçülmüştür ama **ürün kararıdır.**
- **Y-2 Seçilime açmak:** `strainDecayK`/`bondFatigue` sabit olmaktan çıkıp
  `bondStrength` genomuna bağlanırsa bağ ömrü **evrimsel değişken** olur.
  Daha derli toplu, "koloniler neden daha dayanıklı olmadı" sorusunu ölçülebilir
  kılar — ve yalnız kalibrasyonla gelmeyen bilgi verir.


### 5.6 Y-2 · Bağ ömrünü seçilime açmak — **başarısız**

§5.4'te bağ ömrünün koloni kalıcılığını belirlediği ölçüldü. Bu, doğrudan bir
mühendislik sorusu doğuruyor: bağ ömrü **seçilime açık mı?**

### 5.7 Koddaki boşluk

`world.ts` `bondPhase()`:

```
bond.integrity -= strain * STRAIN_DECAY_K * (1.6 - bond.strength);
bond.integrity -= BOND_FATIGUE;          // ← genoma HİÇ bakmıyor
```

Uzama terimi kalıtsal (`bond.strength` genomdan gelir), **yorgunluk terisi
değil**. Yani bağ ömrünün bir kısmı genoma bağlı değil ve seçilimin ona erişim
yolu yok. `bondStrength` zaten kalıtsaldır (0.15–1); kopan yer burasıdır.

**Y-2 kancası** (`coupleFatigueToGenome`, **varsayılan kapalı** — ürün davranışı
değişmedi, 126 test yeşil): yorgunluk da `bond.strength` ile çarpılır.

### 5.8 Deney ve sonuç

İki kol **aynı** kalıcı-bağ ayarını kullanır (`strainDecayK = 0.005`, ikisi de
kolonileri ayakta tutar). Tek fark kalıtılabilirliktir. 6 eşleştirilmiş tohum,
40.000 tick, mutasyon açık.

| Kol | Kurucu bondStrength | Hayatta kalan | **Seçilim kayması** |
|---|---|---|---|
| Kontrol (kalıtsız) | 0.4489 | 0.4378 | −0.0112 |
| **Tedavi (kalıtsal)** | 0.4489 | 0.4434 | **−0.0056** [−0.0140, +0.0021] |

İki kol farkı: +0.0056 [−0.0044, +0.0180], **p = 0.343**.

**Başarı ölçütü KARŞILANMADI.** Tedavi kolunun kayması sıfırdan ayrışmıyor.

### 5.9 Sınırlama mı, sonuç mu? — ölçüm düzeltmesi

İlk yorumum "pencere çok kısa, üç nesil yetmez" oldu. Bu **yanlıştı ve
ölçüm hatasından kaynaklanıyordu:** kullandığım `maxGeneration`, yaşayan
popülasyondaki anlık en yüksek nesildir ve **uzun koşularda düşebilir** —
ölçüldü: 10.000 tick → 3.0, 100.000 tick → 1.3. Doğru ölçü kümülatif doğum
sayısıdır (`nextOrganismIdForSnapshot() − 1`).

| Pencere | Üreme çevrimi (kurucu başına) | Kümülatif doğum |
|---|---|---|
| 10.000 | 5.46 | 262 |
| 40.000 | **5.85** | 281 |

**Pencereyi 4 katına çıkarmak üreme çevrimini 5.46'dan yalnız 5.85'e çıkarıyor**
(19 ek doğum). Popülasyon ~5.5 çevrimde **üreme durağanlığına** ulaşıyor:
kurucuların torunları zaten doygunluğu doldurmuş, daha uzun koşu neredeyse hiç
bir şey eklemiyor.

Yani düzeltilmiş sınırlama "3 nesil" değil, **"≈5.5 üreme çevrimi"** — ve bu
bir ölçüm artefaktı değil.

> ⚠️ **DÜZELTME (§5.11):** Bu paragraftaki "durağanlık" yorumu **yanlıştır.**
> Kümülatif doğumun yataylaması doygunluğu değil, **doğumların durmasını**
> gösterir. Popülasyon durağan değil, **çöküyor** (166 → 41). Aşağıdaki
> gözlemler geçerlidir; "durağanlık" yorumu değildir.

### 5.10 Sonuç ve anlamı

**Y-2 başarısız: bağ ömrünü seçilime açmak tek başına yeterli değil.**

Bu, §5.4'teki kalibrasyon bulgusunu güçlendiriyor: bağ ömrü koloni kalıcılığını
belirliyor, ama **bu ölçülebilir bir seçilim baskısı haline gelmiyor.** İki
olası açıklama, ikisi de test edilmemiş:

1. **Seçilim şiddeti zayıf.** 5.5 çevrimde `bondStrength` üzerindeki
   farklılıkların hayatta kalma farkı yaratması için yetersiz — ancak
   §5.11'e göre bu çevrim sayısı bir "doygunluk" değil, **çöken bir
   popülasyonun sonucudur.** Yani seçilim zayıflığı da çöküşün bir sonucu.
2. **Bağ ömrü tek başına belirleyici değil.** §5.4 bağ ömrünün *gerekli* olduğunu
   gösterdi, *yeterli* olduğunu göstermedi; kolonilerin kalıcılığı başka
   faktörlerle birlikte belirleniyor olabilir.

Bu bulgu, **yol planındaki B3'ü (somatik mutasyon / hileci deneyi) yeniden
önceliklendirir:** organizma içi seçilimin çalışması için yeterli çevrim
yok demek — ama §5.11'e göre bu çevrim sayısının **kendisi** çöküşün sonucu. Bu yüzden B3'ün de nesil derinliğine bağlı olması
muhtemel — ve bu, projedeki **en derin yapısal kısıt** adayıdır: evrimsel
süreçler bu modelde yeterli nesil derinliğine ulaşamıyor.


### 5.11 Üreme tıkanması — "durağanlık" yorumu **çürütüldü**

§5.9'da pencerenin 4 katına çıkması üreme çevrimini 5.46'dan 5.85'e çıkarmadığı
için "popülasyon üreme durağanlığına ulaşıyor" denmişti. Bu yorum **yanlıştı** ve
ölçümden kaynaklanıyordu: kümülatif doğum sayısının yataylaması "doygunluk"
değil, **doğumların durması** demektir.

Kümülatif sayı, doğum *devam ettiği* sürece artar. Yataylaması çevrim bitti
demektir. İki ölçüm birlikte okunmalıydı.

| Tick | Pop | Org | Küm. doğum | Bud | Frag | Küme |
|---|---|---|---|---|---|---|
| 0 | 48 | 48 | 48 | 0 | 0 | 0 |
| 8.000 | **166** | 121 | 201 | 101 | 15 | 5 |
| 16.000 | 106 | 103 | 240 | 110 | 2 | 2 |
| 24.000 | 72 | 70 | 244 | 112 | 0 | 2 |
| 32.000 | 56 | 56 | 246 | 112 | 0 | 1 |
| **40.000** | **41** | 41 | **246** | 112 | 0 | **1** |

**Doğum hızı çöktü:** ilk çeyrekte 169, **son çeyrekte 1** doğum. Tomurcuklama
112 kez gerçekleşti ve koloni üreme nesli zirvede 80'e çıktı — **sonra geri
düştü.** Yani üreme bir süre çalışıyor, sonra tümüyle duruyor.

Popülasyon durağan değil: **çöküyor.** 166 → 41.

### 5.12 40.000 tick'e uzun bakış: ekosistem sönüyor

Varsayılan ayarlarda 40.000 tick (tohum 11):

| Tick | Pop | Küme | Bağ | Rezerv% | Sistem enerjisi | Açlık ölümü | Avcı ölümü |
|---|---|---|---|---|---|---|---|
| 4.000 | **254** | 8 | 56 | 74.9 | 90.161 | 3 | 2 |
| 8.000 | 163 | 2 | 1 | 55.6 | 64.176 | 78 | 19 |
| 16.000 | 103 | 2 | 1 | 40.4 | 46.136 | 109 | 57 |
| 24.000 | 74 | 1 | **0** | 32.8 | 37.137 | 119 | 80 |
| 32.000 | 44 | 1 | 0 | 29.0 | 32.024 | 127 | 102 |
| **40.000** | **36** | 1 | **0** | **26.7** | 29.333 | 131 | 107 |

Zincir tam: bağlar 24.000 tick'te **tamamen yok** → çok hücrelilik bitmiş →
hücreler paylaşamıyor → tek tek açlık → popülasyon zirvenin **%14'üne** düşüyor.

Avcı ölümleri 2'den 107'ye çıkıyor: uzun vadede avcı ikinci sıradaki katil
hâline geliyor (%45). Kaynak **bitmiyor** (%26.7) — yani kaynak tükenmesi uzun
vadede de açıklama değil.

### 5.13 §5.4'ün genellenip genellenmediği — **genellenmiyor**

§5.4'te bağ dayanıklılığının 4+ hücreli yapıları geri getirdiği **ölçülmüştü ve
önceden kaydedilen ölçütü karşılamıştı.** Bu, kendi bulgumu sınayan bir ölçüm:

| strainK | Bağ ömrü | Son pop | Çöküş oranı | Son çeyrek ort. küme | Son 4+ yapı | Son bağ | Son rezerv | **Geç açlık %** | **Geç avcı %** |
|---|---|---|---|---|---|---|---|---|---|
| **0.020 (varsayılan)** | 2.083 | 36 | 7.1× | 1.0 | 0 | 0 | %26.7 | 37.5 | **62.5** |
| 0.005 | 8.333 | 35 | 7.3× | 1.0 | 0 | 0 | %26.6 | 45.5 | **54.5** |
| **0.002** | 21.277 | **52** | 4.9× | **3.7** | 0 | **13** | %22.9 | **100.0** | **0.0** |

**İki ayrı sonuç var ve ikisi de doğru:**

**1. Kalibrasyon çöküşü engellemiyor.** 10× dayanıklılık son popülasyonu
36'dan 52'ye çıkarıyor (+%44) ve son çeyrek kümesi 1.0 → 3.7 oluyor — **kısmi
hafifletme.** Ama 4+ hücreli yapılar yine sıfır ve popülasyon hâlâ zirvenin
beşte biri.

**2. Kalibrasyon ölüm rejimini değiştiriyor.** Son çeyrek ölüm payları:

| Bağ ömrü | Baskın ölüm nedeni |
|---|---|
| 2.083 (varsayılan) | **avcı %62.5** |
| 8.333 | avcı %54.5 |
| 21.277 | **avcı %0.0** — tamamen açlık |

10× dayanıklı bağlarla **geç dönem avcı ölümleri sıfırlanıyor.** Bu, "yalnız
geciktirme" değil, **mekanizma değişimi:** koloniler ayakta kaldığında avcı artık
ölümcül değil. Bu gözlem §5.12'deki "avcı ölümleri 2 → 107" satırının nedenini
açıklıyor — avcı baskısı, çok hücrelilik dağıldıktan sonra devreye giriyor.

> **Mekanizma yorumu (ölçülmüş, spekülasyon değil ama henüz kanıtlanmamış):**
> avcının yakalama mantığı bireysel hücreler üzerinde çalışıyor. Bağlı bir
> kolonide avcı, tek bir hücreyi koparıp **organizmayı bölmediği** için öldürmüyor.
> Doğrulamak için avcının yakalama/bölme kuralı ölçülmeli — **yapılmadı**.

> **Bu, §5.4'teki ölçütün pencereye bağlı olduğunun kanıtıdır.** Ölçüt 12.000
> tick'te karşılandı ve bu doğruydu; ama karşılanması etkinin **kalıcı**
> olduğunu göstermiyor. Pencereyi sınamadan "düzeltildi" demek yanlış olurdu.

### 5.14 Güncel durum ve açık soru

| Bulgu | Durum |
|---|---|
| Bağ ömrü kolonilerin **kısa vadede** kalıcılığını belirliyor | ✅ ölçüldü (§5.4) |
| Bağ ömrü **uzun vadeli** çöküşü önlemiyor | ✅ ölçüldü (§5.13) |
| Y-2 (dayanıklılığı seçilime açmak) tek başına yetmiyor | ✅ ölçüldü (§5.8) |
| **Açık:** 40.000 tick'te sınırlayıcı olan ne? | ⬜ ölçülmedi |

Açık sorunun adayları (üçü de test edilmemiş):
1. **Avcı dinamiği** — avcı ölümleri 2 → 107; avcının kendi dengesi yok mu?
2. **Enerji muhasebesi** — sistem enerjisi 108.763 → 29.333; bu düşüşün
   bileşenleri (bazal + hareket + avcı hasarı) ölçülmedi.
3. **Doğum/ölüm dengesi** — son çeyrekte 1 doğum; neden üreme tamamen duruyor?

**B3 (somatik mutasyon) bu soru yanıtlanmadan yapılmamalı:** 5.5 üreme çevrimi
bir pencerenin artefaktı değil, **çöken bir popülasyonun sonucu.**


## 6. Tarayıcı akışı — gerçekten yapıldı

Chromium'da `vite preview` (port 4188) üzerinden doğrulandı:

| Kontrol | Gözlem |
|---|---|
| Uygulama açılıyor, WebGL2 sahne kuruluyor | ✅ |
| Worker modülü yükleniyor, dünya başlıyor | ✅ |
| HUD türkçe, tick artıyor | ✅ tick 374'te ölçüldü |
| Canlı listesi doluyor, 59 organizma listeleniyor | ✅ |
| **Çok hücreli organizmalar listede görünüyor** (`#7 → 2 hücre`, `#9 → 2 hücre`, …) | ✅ |
| **Muhasebe farkı ≈ 0.004 e** (ölçüm sonrası −0.001…0.004) | ✅ |
| Kayalar, kaynak düğümleri, besin alanı küreleri, avcı, ışık huzmeleri, deniz karı çiziliyor | ✅ |
| Boş hücre listesi / konsol hatası yok | ✅ |

Tarayıcıda doğrulanmayanlar: mikroskop panelinin etkileşimi, dal oluşturma,
JSON içe/dışa aktarma, IndexedDB kayıt/yükleme, gözlemci panelinin model
çağrısı. Bunlar **test edilmedi** (§8).

---

## 7. Gözlemci sunucusu

`node server/index.ts` ile gerçekten çalıştırıldı:

| İstek | Sonuç |
|---|---|
| `GET /api/observer/health` | `200` `{"hasKey":false,"provider":"minimax",...}` |
| `POST /api/observer` (anahtar yok) | **`503`** + `sourceMode: "local-summary"` |

İstemci 503 aldığında yerel kural özetine düşer ve oyun durmaz.
Anahtar **yalnız sunucu ortamından** okunur; istemci paketine girmez.

**Canlı sağlayıcı çağrısı YAPILMADI.** Hiçbir API anahtarı bulunmadığı için
MiniMax'e gerçek bir istek gönderilmedi. Bu nedenle:
- Sağlayıcının güncel görsel istek şeması canlı olarak doğrulanmadı.
- Adaptörün OpenAI uyumlu `/chat/completions` şekliyle yazıldığı doğrulanmış bir
  yanıt değil, **yapılandırılmış varsayımdır**.
- Gözlemci panelinde **sahte model yanıtı gösterilmez**; anahtar yokken
  "Yerel kural özeti — dil/görsel model kullanılmadı" etiketi görünür.

---

## 8. Doğrulanmayanlar — açıkça

Bu maddeler **yapılmadı** ve dokümana sayı uydurulmadı:

1. **Öğrenmenin davranışa yansıdığı.** Deney motoru artık var ve koşuyor
   (§4), ancak sonuç **negatif**: 6.000 tick'te ölçülebilir iyileşme yok
   (p = 0.333). Öğrenme mekanizması çalışıyor ve test ediliyor; **etkisi
   kanıtlanmamıştır.** Nedenleri §4.5–4.7'de ölçülmüş olarak veriliyor:
   öğrenme sinyali **davranışa duyarlı değil**, ve gradyan pratik olarak
   gürültü — adımı 570× büyütmek davranışı iyileştirmek yerine kötüleştiriyor
   (p = 0.0001, iyileşme olasılığı %0.0).
2. **Evrimin genetik ayrışma üretmesi.** Deney 2 sonuçsuz (p = 0.097) ve genom
   kayması mutasyonla **artmadı**. Pencere ~3 nesle yetiyor (§4.4).
3. **Görüntü/görsel model analizi.** Uygulama görüntüsü gözlemciye gönderilmiyor;
   `imageHint` yalnız tick/kamera bilgisini taşıyor.
4. **30 dakikalık kesintisiz tarayıcı koşusu.** Dayanıklılık 10.000 tick ile
   headless doğrulanmış (≈ 8 dakika 20 saniye, 1×); etkileşimli 30 dakikalık koşu
   yapılmadı.
5. **Kare hızı (FPS) ölçümü.** Tarayıcıda kare süresi ölçülmedi. Mobil GPU
   kanıtı yoktur; mobil emülasyonu mobil GPU kanıtı sayılmaz.
6. **Kaydet/yükle bit düzeyi eşdeğerliği.** Şema doğrulama, bozuk kayıt reddi ve
   ölçek sınırı **yazıldı**, ancak IndexedDB üzerinden kaydet→yükle→aynı koşu
   eşitliği test edilmedi. Aynı ortamda bit düzeyi eşitlik de vaat edilmiyor.
7. **Dal bağımsızlığı.** `branch` komutu snapshot kopyalıyor; iki dalın
   birbirinden bağımsız olduğu test edilmedi.
8. **Erişilebilirlik denetimi.** Klavye gezinme, görünür odak, `aria` işaretleri
   kodda var; ekran okuyucu ile uçtan uca denendi ama **sistematik test yapılmadı**.
9. **Çapraz cihaz determinizmi.** Test edilmedi, vaat edilmiyor. Bu nedenle
   tüm deneyler §4 **Node'da** koşuyor; tarayıcıda tohumlu istatistik üretilmiyor.
10. **Tarayıcıda deney paneli.** Deney motoru headless Node'da çalışıyor; worker
    komutlarıyla tarayıcı içinden tetiklenen deneyler **bağlanmadı.**

---

## 9. Geliştirme sırasında yakalanan gerçek hatalar

Bunlar testlerin bulduğu, düzeltildiği ve **yeniden test edildiği** hatalardır:

| # | Hata | Belirti | Düzeltme |
|---|---|---|---|
| 1 | `Organism.neural` ile `NeuralPolicy.state` **ayrı nesneydi** | Öğrenme gerçekleşiyordu ama mikroskop/organizma kaydı "hiç öğrenmemiş" gösteriyordu (ölçülen sapma: **0.0000**) | Tek kaynak yapıldı; sapma **0.0035** oldu |
| 2 | Algı + öğrenme maliyeti **hücrelerden düşülmeden** defterde harcanmış sayılıyordu | Her karar aralığında **0.0189 e** enerji yaratılıyordu | `chargeOrganism()` ile hücrelerden tahsil edildi; rezidüel **0.0000** |
| 3 | Avcı öldürmeleri parçalanmayı tetiklemiyordu | Kopmuş hücreler "tek organizma" sayılıyordu | `finalizeOrganism` avcı yoluna da bağlandı |
| 4 | Paylaşma denge seviyesi (60) **bölünme eşiğinin (78) altındaydı** | Kolonideki hiçbir hücre bölünemiyordu; çok hücrelilik hiç başlamıyordu | Denge seviyesi 82'ye çekildi |
| 5 | Bağ kuruluyor ama ~40 tick içinde kopuyordu (yönlendirme tek başına yetmiyor) | `bonds=0`, hiçbir koloni yok | Yapısal konum yayı + vücut merkezi çekimi eklendi |
| 6 | Avcı seyrek popülasyonda da mutlak katildi | 48 hücre 6.000 tick'te tükendi | Doygun (tip II) işlevsel yanıt |
| 7 | Kaynak instancing sayacı iki kez artıyordu | Kaynak düğümleri hiç çizilmiyordu | Döngü yeniden yazıldı |
| 8 | Worker kare paketi istemci dinleyicisine hiç ulaşmıyordu | HUD tick 0'da takılı, telemetri ölüydü | Erken dönüş kaldırıldı |
| 9 | Karede başlangıç enerjisi yoktu | HUD "muhasebe farkı" 109.632 e gösteriyordu (anlamsız) | Başlık genişletildi, rezidüel ≈ 0.004 e |
| 10 | `exp2` sis yoğunluğu (0.052) sahneyi tamamen karartıyordu | Ekranda neredeyse hiçbir şey görünmüyordu | 0.016 + aydınlatma artışı |
| 11 | `probabilityOfImprovement` **merkezlenmiş** veriden hesaplanıyordu | Her koşuda ≈ 0.5 dönüyor, hiçbir bilgi taşımıyordu | İkinci bir yeniden örnekleme geçişi merkezlenmemiş veriye ayrıldı |
| 12 | Deney altyapısı `vite-node`'u paket içinden değil `npx` üzerinden çözüyordu | `npm run experiments` → `vite-node: command not found` | `vite-node@6.0.0` devDependency olarak sabit sürümle eklendi |
| 13 | Deney betiği `node` ile çalışmıyordu | `ring.ts` parametre özelliği kullanıyor; Node'un strip-only modu desteklemiyor | `vite-node` beyan edildi (bkz. #12) |
| 17 | Kümülatif doğumun yataylaması **"doygunluk"** sanıldı | Yataylama, doğumların **durduğu** anlamına gelir; popülasyon doygunluğa değil **çöküşe** gidiyordu (166 → 41). İki ölçüm birlikte okunmalıydı (§5.11) |
| 16 | `maxGeneration` **nesil derinliği** sanılıyordu | Yaşayan popülasyondaki anlık en yüksek nesildir ve uzun koşularda **düşüyor** (ölçüldü: 10k tick → 3.0, 100k tick → 1.3). "Pencere çok kısa" gerekçesi bu hatadan kaynaklanmış ve kaldırıldı | `cumulativeBirths` (`nextOrganismIdForSnapshot() − 1`) eklendi; gerçek üreme çevrimi **≈5.5** ve durağanlıkta (§5.9) |
| 15 | Bağ uzaması **hayatta kalanların** ortalamasıyla ölçülüyordu | Değer 0.010–0.029 çıktı ve "uzama açıklama değil" izlenimi verdi. Gerçekte **seçilim yanlılığı**: gerilmiş bağlar zaten koptuğu için hayatta kalanlar seçilmiş olarak düşük gerilimli. `bond-break.detail.strain` üzerinden kırılma anı ölçülünce medyan 0.079 çıktı ve kırılmaların %100'ü bütünlük tükenmesiyle olduğu görüldü (§5.3) |
| 14 | `probabilityOfImprovement` **ikinci kez** yanlış veriyle hesaplanıyordu | Değerlendirme koşularında öğrenme kapalı olduğu için metrik tanım gereği hep 0 dönüyordu; rapor "öğrenme ağırlıkları hiç hareket ettirmiyor" izlenimi veriyordu, oysa eğitimde hareket ediyordu | `learnedDeltaNorm` artık koşunun **kendi başlangıç ağırlıklarına** göre ölçülüyor; `thetaInjected` alanı eklendi; regresyon testi yazıldı |

---

## 10. Tekrarlanabilirlik

```bash
npm ci
npm test                      # 126 test (4 dosya)
npm run typecheck             # tsc --noEmit, temiz
npm run build                 # vite build, başarılı
npm run experiments:quick     # deney paketi duman testi (~7 s)
npm run experiments           # tam deney paketi (56.159 koşu, ~326 s)
npm run assets:build          # Blender 5.1.1 ile 10 varlık üretir
npm run dev                   # geliştirme sunucusu (port 5183)
npm run server                # gözlemci sunucusu (port 8787) — anahtar yoksa 503
```

Deneyler **deterministiktir**: aynı tohum aynı sonucu verir ve bootstrap
aralıkları sabit bootstrap tohumuyla tekrarlanabilir. `npm run experiments`
`docs/EXPERIMENTS.md` dosyasını ham koşu değerleriyle yeniden üretir.

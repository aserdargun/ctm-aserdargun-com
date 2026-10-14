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
     Tests  151 passed (151)
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

### 1.4 Deney altyapısı (`tests/experiments.test.ts`, 71 test)

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
olarak konuldu; tarayıcıda kare hızı ölçülmedi (bkz. §9 açık doğrulamalar).

Optimizasyon notu: yaşayan organizma sırası önbelleklendi, uzamsal ızgara
3.2 → 1.2 mb sıklaştırıldı. Bu iki değişiklik birlikte ~0.76 → ~0.38 ms/tick
getirdi.

Deney paketinin tam koşumu **108 simülasyon, 84.4 saniye** sürdü (bkz. §4).

---

## 4. Deney paketi — gerçekten koşuldu

**Komut:** `npm run experiments` (headless, `vite-node`)
**Kapsam:** 1.920 simülasyon · 429 sn (standart pencere, 22 bölüm)n (standart pencere) · 5 değişmez kontrol ·
3 deney + kalibrasyon + 5 tarama + ödül teşhisi + evrimsel karşılaştırma +
Faz B teşhisleri (sönümlenme, üreme tıkanması, uzun vadeli dayanıklılık,
kaynak rejenerasyonu)
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
| 4 | 0.501 | 0.499 | %100 |
| 8 | 0.657 | 0.343 | %100 |
| **14** | **0.753** | **0.247** | %100 |
| 22 | 0.855 | 0.145 | %100 |
| **34 (oyun varsayılanı)** | **0.922** | **0.078** | %100 |

> **Kaynak:** `docs/EXPERIMENTS.md` "Arena zorluk kalibrasyonu (headroom)".
> Tablo `766e0b9` öncesinden kalıyordu (0.538 / 0.794 / 0.928) ve tazelendi.

**Bulgu (ürün için de geçerli):** Oyunun varsayılan habitatı **çok kolay.**
Rastgele bir politika bile 0.922 ortalama enerjiyle neredeyse tavan yapıyor ve
hiç ölmiyor. Bu, "her şey iyi gidiyor" değil, **"burası ölçüm yapılamayacak kadar
kolay"** demektir. `docs/ROADMAP.md` Faz B1'in kaynak tükenmesi teşhisiyle
birlikte okunmalıdır: sorun yalnız kaynak miktarı değil, kaynak erişilebilirliği.

Öğrenme deneyi bu yüzden **14 kaynaklık** habitatta koşuldu (güncel taramada
headroom **0.167**; eski metindeki 0.206 bayattı).

### 4.3 Deney 1 — Bağ gücü kolonileri büyütüyor mu?

**Protokol:** Eşleştirilmiş. 12 tohum. Aynı seed iki kolda; tek fark kurucu
genomlarının `bondAffinity` değeri (0.05 ↔ 0.90). Mutasyon kapalı → değer soy
boyunca birebir korunur, etki diğer değişkenlerden arındırılamaz.
**Birincil ölçüm:** pencerede görülen en büyük bağlı küme. **Pencere 4.000 tick.**

| | Değer |
|---|---|
| Kontrol (bondAffinity 0.05) | 2.083 [2.000, 2.250] |
| Tedavi (bondAffinity 0.90) | **19.167** [16.833, 21.333] |
| **Fark** | **+17.083** [14.833, 19.167] |
| Bootstrap p | **0.0001** |
| İyileşme olasılığı | %100 |

| İkincil | Kontrol | Tedavi |
|---|---|---|
| Zirve 4+ hücreli yapı sayısı | 0.000 | 28.917 |
| Pencere sonu bağ sayısı | 0.583 | 83.917 |
| Pencere sonu popülasyon | 206.750 | 241.917 |

> **Kaynak:** `docs/EXPERIMENTS.md` "Bağ gücü koloni büyüklüğünü artırıyor mu?"
> (4.000 tick, 12 eşleştirilmiş tohum). Bu tablodaki sayılar **dokuz
> parametreli** güncel genomdan gelir; `766e0b9`'dan önceki koşunun sayıları
> (2,33 → 21,25) burada **yanlış** olarak duruyordu ve düzeltildi.

**Okuma — güçlü pozitif, ama nüanslı.** Çok hücrelilik tek bir kalıtsal
parametreyle üst üste büyük bir etkiyle kontrol ediliyor. Ancak `bondAffinity`
0.05 bağ kurmayı neredeyse tamamen engelliyor: kontrol kolunda 4+ hücreli yapı
**sıfır**. Yani karşılaştırma "ince ayar" değil, **"koloni var mı yok mu"**
karşılaştırmasıdır. Oyunun varsayılan kurucu popülasyonu bu iki uç arasında
bir yerde duruyor ve §2'deki "en büyük küme 9" değeriyle tutarlı.

### 4.4 Deney 2 — Mutasyon + seçilim popülasyonu iyileştiriyor mu?

**Protokol:** Eşleştirilmiş. 12 tohum. Aynı seed iki kolda; tek fark
`mutationEnabled`. **Pencere 4.000 tick.**
**Birincil ölçüm:** pencere sonu ortalama normalize enerji.

| | Değer |
|---|---|
| Kontrol (donmuş) | 0.358 [0.328, 0.387] |
| Tedavi (evrilen) | 0.350 [0.319, 0.379] |
| **Fark** | **−0.008** [−0.024, +0.008] |
| Bootstrap p | **0.3035** |
| İyileşme olasılığı | %15.4 |

| İkincil | Kontrol | Tedavi |
|---|---|---|
| Genom kayması (`genomeShift`) | 0.005 | 0.005 |
| Ulaşılan en yüksek nesil | 2.75 | 2.75 |
| Zirve en büyük küme | 9.33 | 11.92 |
| Pencere sonu 4+ hücreli yapı | 1.50 | 2.92 |

> **Kaynak:** `docs/EXPERIMENTS.md` "Mutasyon + seçilim popülasyonu iyileştiriyor
> mu?" (4.000 tick, 12 eşleştirilmiş tohum).
>
> ⚠️ **Bu tablo düzeltildi ve yön değişti.** Önceden burada `+0.011`,
> p = 0.097, iyileşme %96, genom kayması 0.007/0.006 ve zirve küme 12,67/12,25
> yazıyordu; bunlar **`766e0b9`'dan önceki** koşudan geliyordu.
>
> **Pencere notu:** bu deney 4.000 tick koşar (`scale.colonyTicks`) ve `--deep`
> ile değişmez; 40.000 tick yalnız `longTicks` kullanan ekoloji bölümlerine
> uygulanır. Bu yüzden sığ ve derin rapor bu deneyde **aynı** sayıları verir.

**Okuma — sonuçsuz; artık farkın yönü de negatif.** p = 0.3035 ile güven aralığı
sıfırı içeriyor, iyileşme olasılığı %15,4 — yani belirgin bir etki **yok** ve
nokta tahmini hafifçe aşağı yönde. İkincil ölçüm daha önce bağlayıcıydı ve
öyledir kalıyor: mutasyon açıkken genom kayması donmuş koldan **daha büyük
değil** (0.005 ↔ 0.005) ve iki kol **aynı nesle** ulaşıyor (2.75).

Bu, evrimin işe yaramadığı anlamına **gelmez**. Pencerede yalnızca ~3 nesil
geçiyor; 3 nesilde genetik ayrışma oluşması beklemez. Bu bir **tasarım
sınırlaması** bulgusudur ve şu anlama gelir: evrimsel iddialar için ya pencere
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
| Kontrol (rastgele ağ) | 0.840 [0.797, 0.878] |
| Tedavi (eğitilmiş politika) | 0.841 [0.792, 0.885] |
| **Fark** | **+0.001** [−0.037, +0.037] |
| Bootstrap p | **0.9764** |
| İyileşme olasılığı | %51.8 |

| İkincil | Değer |
|---|---|
| Kontrol kolunun headroom'u | 0.160 |
| **EZBER KONTROLÜ — eğitim dünyasındaki fark** | **−0.003** (kontrol 0.833 · tedavi 0.830) |
| Ezber farkı − genelleşme farkı | −0.004 |
| Değerlendirmede hayatta kalma (iki kol) | %100 / %100 |
| **Eğitimde politika güncellemesi sayısı** | **9.0** |
| **Eğitimde ağırlıkların kaydığı (‖Δθ‖)** | **0.003** |
| Eğitim koşularında hayatta kalma | %100 |

> **Kaynak:** `docs/EXPERIMENTS.md` "Yaşam içi öğrenme politikayı iyileştiriyor
> mu?" (20 eşleştirilmiş tohum) ve "Arena zorluk kalibrasyonu" habitat taraması.
>
> ⚠️ **Bu tablo düzeltildi.** Önceden `+0.020`, p = 0.333, iyileşme %83,3,
> headroom 0.174 ve ezber farkı −0.000 yazıyordu; bunlar dokuz parametre öncesi
> koşulardan geliyordu. Habitat başlığının "headroom 0.206" iddiası da eskiydi:
> güncel taramada 14 kaynaklık habitat headroom'u **0.167** (deney satırında
> 1 − 0.840 = 0.160).

**Okuma — etki yok; daha önce yazılan "negatif" etiketi de yanlıştı.**

Fark **+0.001**, güven aralığı sıfırı içeriyor, iyileşme olasılığı **%51,8**
(para mı üst mü). p = 0.9764 ile **ölçülebilir bir öğrenme etkisi yoktur** —
"negatif" değil, **hiç etki yok**. `docs/PROGRESS.md` bu deneyi "❌ negatif"
diye etiketliyordu; bu etiket hem taze ölçümle hem de **kendi alıntıladığı**
sayılarla çelişiyordu (alıntıladığı fark +0.020, iyileşme %83 — ikisi de
pozitif yöndeydi). Düzeltildi.

`docs/PROGRESS.md` §2.1'deki eski kabul hedefi ("20 tohumun en az 15'i") bu
raporla **geçersiz kılındı**: eşik testi başarı ile şansı ayıramaz ve artık
kullanılmıyor.

**Ezber kontrolü yine belirleyici.** Eğitilmiş politika, **eğitildiği dünyada**
kontrolü geçmiyor (fark −0.003). Yani sonuç "ezber" değil: ne ezber ne de
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
   beslenme kalitesinde aranıyor (headroom 0.160).

**Bu bulgular, projenin "yaşam öğrenir" iddiasının şu anda kanıtlanmadığı
anlamına gelir.** Uygulama öğrenmeyi gerçekten uygular (ağırlıklar değişir,
gradyanlar doğrulanmıştır) ama 6.000 tick'lik bir yaşamda öğrenmenin davranışa
yansıyacak kadar hareket üretmediği **ölçülmüştür.**

### 4.6 Öğrenme · zorluk taraması (önceden kaydedilmiş eksen)

Varsayılan habitatta ölçüm mümkün değildi: headroom 0.078. Bu tarama soruyu
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
| Görev ölçüm için çok kolay | **Kısmen doğru** — varsayılan habitatta evet | §4.2 (headroom 0.078) |
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
| **3.200** | — | — | **8 (zirve)** | — | — | 0.561 | 0.018 | (~81)† | 0 / 0 |
| 4.000 | 254 | 198 | 8 | 6 | 56 | 0.530 | 0.017 | 74.9 | 3 / 2 |
| 5.000 | 247 | 219 | 5 | 2 | 28 | 0.414 | 0.011 | 67.9 | 12 / 2 |
| 6.000 | 217 | 207 | 3 | 0 | **10** | **0.208** | 0.029 | 62.8 | 37 / 3 |
| 7.000 | 175 | 174 | 2 | 0 | 1 | — | — | 59.0 | 73 / 10 |
| 8.400 | — | — | **1 (sönümlenme)** | 0 | **0** | — | — | **54.7** | — |
| 12.000 | 130 | 129 | 2 | 0 | 1 | — | — | 46.5 | 95 / 40 |

**(†)** 3.200 tick ölçüm noktası değildir (örnekleme 2.000'dir); 3.000 (%83.6)
ve 4.000 (%74.9) arasındaki değer kabaca enterpolasyonla üretilmiştir.

**(°)** Bu tick'te yalnız **1 bağ** kaldığı için ortalama bütünlük ve uzama
tek bir bağdan hesaplanır; istatistik olarak anlamsızdır ve `—` olarak
gösterilir. Aynı satır raporda 0.820 / 0.000 basıyor.

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

> ⚠️ **Pencere notu:** §5.11–§5.16 **40.000 tick'lik derin profilin**
> (`npm run experiments -- --deep`) bulgularıdır. Standart profil
> (12.000 tick) ekolojik çöküşü **görmez** ve bu bölümlerdeki sonuçları
> üretmez. Ham çıktı: `docs/EXPERIMENTS-DEEP.md`.

§5.9'da pencerenin 4 katına çıkması üreme çevrimini 5.46'dan 5.85'e çıkarmadığı
için "popülasyon üreme durağanlığına ulaşıyor" denmişti. Bu yorum **yanlıştı** ve
ölçümden kaynaklanıyordu: kümülatif doğum sayısının yataylaması "doygunluk"
değil, **doğumların durması** demektir.

Kümülatif sayı, doğum *devam ettiği* sürece artar. Yataylaması çevrim bitti
demektir. İki ölçüm birlikte okunmalıydı.

| Tick | Pop | Org | Küm. doğum | Bud | Frag | Kol. nesil | Küme |
|---|---|---|---|---|---|---|---|
| 0 | 48 | 48 | 48 | 0 | 0 | 0 | 0 |
| 16.000 | **106** | 103 | 240 | 108 | 9 | 57 | 2 |
| 32.000 | 56 | 56 | 246 | 110 | 1 | 27 | 1 |
| **40.000** | **41** | 41 | **246** | 110 | 0 | 18 | **1** |

**Doğum hızı çöktü:** ilk çeyrekte **144**, **son çeyrekte 1** doğum. Tomurcuklama
toplam **110** kez gerçekleşti; koloni üreme nesli örneklenen satırlarda 57'den
18'e düştü. Yani üreme bir süre çalışıyor, sonra tümüyle duruyor.

Popülasyon durağan değil: **çöküyor.** 166 → 41.

### 5.12 40.000 tick'e uzun bakış: ekosistem sönüyor

Varsayılan ayarlarda 40.000 tick (tohum 11):

| Tick | Pop | Küme | Bağ | Rezerv% | Sistem enerjisi | Açlık ölümü | Avcı ölümü |
|---|---|---|---|---|---|---|---|
| 4.000 | **254** | 8 | 56 | 74.9 | 90.161 | 3 | 2 |
| 8.000 | 163 | 2 | 1 | 55.6 | 64.176 | 78 | 19 |
| 12.000 | 130 | 2 | 1 | 46.5 | 53.355 | 95 | 40 |
| 20.000 | 89 | 2 | 1 | 35.7 | 41.100 | 114 | 69 |
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
| **0.020 (varsayılan)** | 2.083 | 36 | 7.1× | 1.20 | 0 | 0 | %26.7 | 37.5 | **62.5** |
| 0.005 | 8.333 | 35 | 7.4× | 1.00 | 0 | 0 | %26.6 | 45.5 | **54.5** |
| **0.002** | 21.277 | **52** | 4.9× | **4.08** | 0 | **13** | %22.9 | **100.0** | **0.0** |

**İki ayrı sonuç var ve ikisi de doğru:**

**1. Kalibrasyon çöküşü engellemiyor.** 10× dayanıklılık son popülasyonu
36'dan 52'ye çıkarıyor (+%44) ve son çeyrek kümesi 1.20 → 4.08 oluyor — **kısmi
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


### 5.15 40.000 tick sınırı: erişilebilirlik mi, avcı mı?

> Derin profil (`--deep`). Standart profilde bu tablo üretilmez.

Dayanıklı bağlarla (strainK 0.002), 40.000 tick:

| Tick | Pop | Ort. hücre enerjisi | Açlık % | Medyan kaynak uzaklığı | Yakın % | Rezerv % | **Avcı enerjisi** |
|---|---|---|---|---|---|---|---|
| 0 | 48 | 55.0 | 0.0 | 1.73 | 39.6 | 100.0 | 4.4 |
| 4.000 | 248 | 40.0 | 1.2 | 1.17 | 71.4 | 76.2 | 21.9 |
| 8.000 | 165 | 32.5 | 7.9 | 1.30 | 58.2 | 55.0 | 25.6 |
| 16.000 | 103 | 29.6 | 12.6 | 1.57 | 46.6 | 38.9 | 16.3 |
| 24.000 | 81 | 30.7 | 13.6 | 1.45 | 50.6 | 31.3 | **0.0** |
| 40.000 | 52 | 26.7 | 13.5 | 1.78 | 40.4 | 22.9 | **0.0** |

**İki gözlem, ikisi de çürütücü:**

1. **Avcı ~24.000 tick'te açlıktan ölüyor** (enerji 0'a düşüyor ve kalıcı olarak
   orada kalıyor). Yani geç dönemde avcı yok; §5.13'teki "geç avcı ölümü %0"
   bunun sonucu.
2. **Hücreler ploya yapıyor, ölmüyor:** enerji 55 → 26.7 e'de kararlı kalıyor,
   açlıktaki hücre payı ~%13. Yani "kaynak erişilemiyor" teşhisi de **tam
   değil** — geç dönemde hücrelerin ~%40'ı kaynağa 1.5 mb içinde.

### 5.16 Kaynak rejenerasyonu A/B — ve bir muhasebe hatasının bulunması

> Derin profil (`--deep`).

`C.DEFAULT_REGEN = 0`: kaynak **hiç yenilenmiyor.** Kapalı enerji sistemi
40.000 tick'te rezervini %100 → %23'e tüketiyor. Soru: bu tükenme mi sınırlıyor?

| regen | Zirve pop | Son pop | Son çeyrek pop | Son rezerv | Ort. enerji | Açlık öl. | Avcı öl. | **Avcı öldü (tick)** |
|---|---|---|---|---|---|---|---|---|
| 0 | 248 | 52 | 58.0 | %22.9 | 26.7 | 169 | 25 | 23.406 |
| 0.002 | 252 | **35** | 37.3 | %28.0 | 19.3 | 134 | 54 | 33.970 |
| 0.01 | 245 | 42 | 46.3 | %34.1 | 35.8 | 123 | **54** | 38.931 |

**Sonuç: rejenerasyon popülasyonu kurtarmıyor** — hatta orta değerde kötüleştiriyor.
Ama **mekanizmayı değiştiriyor:** enerji arttıkça avcı daha uzun yaşıyor
(23.406 → 38.931) ve avcı kaynaklı ölümler 25 → 54'e çıkıyor.

**Yani kümülatif kaynak tükenmesi sınırlayıcı değil.** Rezerv %23'te kalırken
popülasyon düşüyor; enerji artırılınca avcı canlanıyor ve avcı daha çok öldürüyor.

> **Bu, §5.13'teki avcı yorumunu güçlendiriyor:** avcı enerji yetersizliği
> nedeniyle erken ölüyordu. Enerji verildiğinde devreye giriyor ve avcı baskısı
> **uzun vadeli sınırlayıcı** oluyor.

### 5.17 Bulunan muhasebe ölçüm hatası — kendi kodumda

Bu tarama ilk çalıştırmada **−26.958 e** enerji rezidülü gösterdi (regen = 0.01).
İlk okuma "enerji korunumu bozuluyor" oldu. **Yanlıştı: hata benim ölçüm
formülümdeydi.**

Doğru denklem (`energy.ts → Ledger.residual()`):

```
current + dissipated = initialTotal + externalInput
```

Benim yazdığım:

```
initialTotal − current − externalInput − dissipated     ← externalInput İŞARETİ TERS
```

`externalInput` zaten `current`in içinde olduğu için iki kez ters yönde
sayılıyordu.

**Bu hata neden 20+ deneyde görünmedi:** `DEFAULT_REGEN = 0` olduğu için
`externalInput` her zaman 0'dı ve işaret hatası sıfırla örtüşüyordu. Rejenerasyonu
açan denemede ortaya çıktı.

**Simülasyonda hata yok.** Düzeltme sonrası her rejenerasyon değerinde rezidül
< 1e-4 ve düzeltilmiş formül üç deney dosyasında (`arena`, `colony`, `ecology`)
uygulandı; regresyon koruması testi eklendi.

### 5.14'ün güncel cevabı

| Soru | Cevap | Kanıt |
|---|---|---|
| Kaynak erişilebilirliği mi? | Kısmen — uzaklık 1.4→2.0, ama hücrelerin yarısı kaynağa yakın | §5.15 |
| Avcı dinamiği mi? | **Evet, enerji yeterli olduğunda** — avcı daha uzun yaşıyor ve daha çok öldürüyor | §5.16 |
| Kümülatif kaynak tükenmesi mi? | **Hayır** — rejenerasyon popülasyonu kurtarmıyor | §5.16 |

**Sistemin uzun vadeli düzenleyicisi avcıdır.** Ama avcının kendisi enerji
kısıtıyla sınırlı: kapalı sistemde erken ölür, enerji verilirse devreye girer ve
avcı baskısı hızlanır. Bu, sistemde **çift yönlü** bir düzenleme üretir ve
kolonilerin kalıcılığı ile avcı baskısı arasındaki dengeye bağlıdır.

B3 (somatik mutasyon) için önkoşul hâlâ: yeterli üreme çevrimi. Ancak bu kez
sebep "nesil derinliği yok" değil, **avcının popülasyonu düzenlemesi**.


## 6. Popülasyon-ES — seçilen öğrenme yönünün testi

**Komut:** `npm run experiments` · `src/sim/experiments/ecology.ts` · `src/sim/world.ts`

### 6.1 Neden bu yöntem

§4.12–4.13'ün kızdığı teşhis şuydu: **ödül sinyali sağlam** (epimizik toplam
performansla r = 0.70, toplam varyansın %97.9'u politika farklarından), **ama
REINFORCE onu kullanamıyor** çünkü 64 adımlık yörüngeye yayarken bilgi
kaybediyor. Evrimsel arama ise yalnızca epimizik toplamı kullandığı için aynı
görevde +0.161 buldu.

Popülasyon-ES aynı ilkeyi **yaşam içinde** uygulamayı dener: birey kendi
ağırlıklarını doğrudan değiştirmez, onun yerine *son dönem getiri hızı*
popülasyondaki eşitlerine göre sıralandığına göre ağırlıklarının
**getiriye ağırlıklı popülasyon ortalamasına** doğru çekilir. Adım-içi kredi
ataması hiç yapılmaz.

Kanca `populationUpdate` **varsayılan kapalıdır**; 137 test ürün davranışının
değişmediğini doğruluyor.

### 6.2 Tasarım

- **REINFORCE her iki kolda da kapalı.** Ölçülen fark yalnız popülasyon-ES'in.
- **Eşleştirilmiş:** aynı tohum, iki kol.
- **Birincil ölçüm — ödül hızı** (`lifetimeReward / yaş`). Kümülatif ödül
  kullanılmaz: o ölçüt yaşamayı ödüllendirir ve §5.9'daki hatanın aynısıdır.
- Güncelleme her 500 tick'te, `η = 0.06 × (0.25 + 0.75 × plastisite)` ile.

### 6.3 Sonuç — **başarısız**

8 eşleştirilmiş tohum, 20.000 tick, 12 kaynaklı habitat (rejenerasyon 0.002):

| | Ödül hızı (e/tick) | Ort. enerji | Popülasyon | En büyük küme |
|---|---|---|---|---|
| Kontrol (yok) | 0.32958 | 0.304 | 89.4 | 2 |
| Tedavi (var) | 0.32808 | 0.318 | 90.0 | 2 |

**Eşleştirilmiş fark: −0.00150 [−0.00430, +0.00174], p = 0.339,
iyileşme olasılığı %16.5.** Uygulanan güncelleme: 40.
Önceden kaydedilen ölçüt (güven aralığı sıfırdan ayrışmalı) **karşılanmadı.**

### 6.4 Neden? — iki açıklama, bir ölçümle ayrıldı

Başarısızlığın iki açıklaması vardı:

- **(a)** Paylaşılan dünyada bireylerin getirileri ayrışmaz (konum şansı baskın),
  dolayısıyla ağırlıklandırma anlamsızlaşır.
- **(b)** Sinyal vardır ama **ortalama alma** onu harcamaz: popülasyon mevcut
  ortalamasına yakınsar ve ortalama, ortalamanın en iyisini bulamaz.

| Ölçüm | Değişim katsayısı |
|---|---|
| Paylaşılan dünyada bireyler arası | **%9.0** |
| Bağımsız dünyalar arasında | %7.4 |

**Paylaşılan dünya sinyali silmiyor** — hatta yayılım bağımsız dünyalardan
*daha yüksek* (1.22×). **(a) yanlıştır.**

### 6.5 Doğru teşhis: formülasyonum bir arama yöntemi değil

> **Sonradan ölçülen tamamlama (§6.10):** mimari kısıt ifadesi "dünya
> çatallanamaz" idi. §6.7–6.10 çatallamanın hem mümkün hem de **ucuz** olduğunu
> gösterdi; kısıt çatallamanın teknik zorluğunda değil, mantıksal biçimindeydi.

Uyguladığım güncelleme **anti-drift** mekanizmasıdır: kötüye giden bireyi iyi
eşitlerine çeker, çeşitliliği azaltır, **korur**. Arama yapmaz.

Bunu bir evrimsel strateji (ES) olarak adlandırmam hataydı. Gerçek ES şunu
yapar:
1. θ etrafında **pertürbasyonlar** üretir,
2. her birini **ayrı ortamda** değerlendirir,
3. θ'yi getiriye ağırlıklı pertürbasyon ortalaması boyunca kaydırır.

**2. adım tek organizma için imkânsızdır.** Tek bir canlı, kendisinin
değiştirilmiş kopyalarını ayrı dünyalarda çalıştıramaz — dünyayı çatallayamaz.

Bu tam olarak gözlemi açıklıyor:

| Yöntem | Dünya çatallıyor mu? | Sonuç |
|---|---|---|
| Evrimsel arama (μ+λ) | **Evet** — her aday ayrı koşu | ✅ +0.161 |
| Popülasyon-ES (bu) | **Hayır** — ağırlık ortalaması | ❌ etkisiz |
| REINFORCE | Hayır — ama adım-içi gradyan kullanıyor | ❌ etkisiz |

**Mimari sonuç:** yaşam içi öğrenme, yalnızca **epimizik** getiriyi kullanarak
arama yapamaz; çünkü arama için kendi kopyalarını değerlendirecek ortam
çatallaması gerekir. Bu, `docs/ROADMAP.md` Faz E'deki önerilerin aksine
mimari bir kısıttır ve tasarım kararı gerektirir.

### 6.6 Bu turda düzeltilen bir yanlış açıklama

Bu bölümü yazarken popülasyon-ES'in başarısızlığını "paylaşılan dünyada
sinyal zayıflıyor" diye açıkladım. **§6.4 ölçümü bunu çürüttü** ve gerçek
sebep formülasyonun kendisiydi. Yanlış açıklama hiçbir yere yazılmadı;
ölçüm yapılmadan önce elde edildiği için düzeltilecek bir metin de olmadı.


### 6.7 Dal (branch) doğruluğu — **ölçüm bir ürün hatası buldu**

§9 madde 7 şunu açıkça listeliyordu: *"branch komutu snapshot kopyalıyor; iki dalın
birbirinden bağımsız olduğu test edilmedi."* Bu ölçüm, ikinci seçeneği
(çatallanabilir ortam üzerinden yaşam içi arama) varsayımdan ölçülebilir bir
seçeneğe çevirmek için yapıldı.

### 6.8 Bulunan ürün hatası — `branch` **hiç çalışmıyordu**

Ölçüm ilk denemede çöktü:

```
TypeError: Cannot read properties of undefined (reading 'reset')
    at World.fromState (src/sim/world.ts)
```

**Kök neden:** `World.fromState` kurucu döngüyü atlamak için
`Object.create(World.prototype)` kullanıyor. Bu **constructor'ı çağırmaz**, dolayısıyla
sınıf alan başlatıcıları (`readonly ledger = new EnergyLedger()` gibi) **hiç
çalışmaz** ve alanlar `undefined` kalır. İlk `world.ledger` erişiminde TypeError.

Aynı şekilde `events`, `metricsHistory`, `nextCellId`, `nextBondId`,
`nextOrganismId`, `pendingEnergy`, `bondTuning` ve diğer alanlar da kurulmuyordu.

**Etki:** `deserializeWorld` her çağrıldığında patlıyordu — yani **snapshot'tan
dünya kurma ve dolayısıyla `branch` özelliği tamamen bozuktu.** Ürünün ana döngüsünde
("koşulu değiştir → kontrol dalıyla karşılaştır") kullanılan yol.

**Neden yakalanmadı:** bu yolda test yoktu. `docs/PROGRESS.md` ve
`VALIDATION.md` "snapshot şeması yazıldı, tip denetimi geçiyor" diyordu — ama
**çalıştırılmamıştı.** Yazılmış olmak, çalışıyor olmak değildir.

**Dü��eltme:** `fromState` artık tüm alanları açıkça kuruyor (dokümanlı bir blok).
Duyarlılık kancaları boş bırakılıp `C` sabitlerine düşürülüyor, böylece ürün
davranışı korunuyor. **Üç regresyon testi** eklendi (`tests/world.test.ts`).

### 6.9 Düzeltme sonrası — çatallama doğru **ve ucuz**

| Ölçüm | Değer |
|---|---|
| Snapshot boyutu (3.000 tick'te) | 2,54 MB |
| Bir dal açmak | **21,3 ms** |
| Bir simülasyon adımı | **0,852 ms** |
| **Bir çatalın karşılığı** | **≈ 25 tick** |
| İki dal bit düzeyinde aynı ilerliyor mu? | **Evet** |
| Müdahale diğerine sızmıyor mu? | **Evet** |
| Müdahale gerçekten etkili mi? | **Evet** |

**Müdahale testi nasıl yapılmalıydı:** üç dal gerekir. İki dalın da müdahale
edilmeden ilerlemesi yeterli değildir — ikisi de ilerlediği için enerjileri
değişir. Doğrusu, hiç müdahale edilmemiş bir **referans** dalla karşılaştırmaktır.
(İlk yazdığım test iki dalı karşılaştırıyordu ve yanlışlıkla "çapraz karışma"
raporluyordu; ikinci denemede referans dalı ilk döngüde ilerletmeyi unuttum.
İkisi de düzeltildi.)

### 6.10 Bu ölçüm kararı nasıl değiştiriyor

Mimari kısıt §6.5'te şuydu: *yaşam içi öğrenme arama yapamaz, çünkü dünyayı
çatallayamaz.* Bu ölçüm ikinci yarısını da doğruluyor — **çatallama ucuz ve güvenilir.**

| | Değer |
|---|---|
| 500 tick'te bir, 16 pertürbasyonlu arama | **≈ %80 ek yük** |
| 500 tick'lik simülasyonun kendisi | 500 × 0,852 ms ≈ 426 ms |
| 16 çatalın toplam maliyeti | ≈ 341 ms |

**Sonuç: yaşam içi üstel arama bütçelenebilir.** Bu, §6.5'teki "çatallama
imkânsız" sonucunun **çürütülmesi** değil, **tamamlanmasıdır:** asıl kısıt
çatallamanın *mantıksal* zorluğuydu; teknik olarak değil.

**Dürüstlük notu:** bu maliyet 3.000. tick'te ölçüldü ve snapshot boyutuyla
ölçeklenir. Geç pencerelerde farklı olabilir ve **ölçülmedi.**


### 6.11 S-4 · Çatallanmış ortamda yaşam içi üstel arama

Seçilen yön. REINFORCE ve popülasyon-ES **kredi ataması** yapamadığı için
başarısızdı (§4.5, §6.3). Gerçek ES kredi ataması yapmaz:

1. Uygun organizma seçilir (plastisitesi olan yaşayanlar arasından sırayla).
2. Dünya **bir kez** snapshot'lanır; N+1 dal bu tek snapshot'tan açılır.
3. Her dalda organizmanın ağırlıkları `θ + σξ` ile pertürbe edilir, dal
   `evaluateTicks` kadar ilerletilir, uygunluk ölçülür.
4. `A_i = R_i − mean(R)`; `θ ← θ + α/N · Σ A_i ξ_i`.

Kanca `esInterval` ile açılır; **varsayılan kapalıdır** ve ürün davranışını
değiştirmez.

**Kritik ölçüm hatası ve düzeltmesi.** İlk uygulamada uygunluk, organizmanın
penceresondaki **anlık enerjisi** idi. Ölçümde üç farklı pertürbasyon
(`|Δθ|₁ ≈ 5.5`) **16 haneye kadar aynı** sonucu verdi. Neden: doygun bir
organizma kapasiteye yakınken hangi eylemi seçtiğinden bağımsız aynı değeri
verir — uygunluk **doygunlaşıyor**, tüm çatallar berabere, gradyan sıfır.
Düzeltme: pencere içinde **kazanılan net enerji** (bitiş − başlangıç).

Ayrıca `evaluateTicks: 20` yetersizdi: karar 10 tick'te bir olduğu için bu
yalnız **2 karar** demek, farklı politikaların neredeyse aynı geleceği
üretmesi anlamına geliyordu.

### 6.12 Ölçülen sonuç

**Boru hattından (standart profil, 3 tohum, 4.000 tick, 4 pertürbasyon × 120 tick,
seyrek dünya: pop 6, kaynak 6):**

| Dünya | θ hareketi (medyan ‖Δθ‖) | Performans farkı | Ek yük |
|---|---|---|---|
| **Seyrek (pop 6, kaynak 6)** | **0.0010** — arama θ'yı hareket ettirdi | **0.000, p = 1.000** | **≈2198 tick** |
| *Kalabalık (pop 24, kaynak 34) — yardımcı ölçüm* | *0.00000 — fitnessler hep berabere* | *0.000, p = 1.000* | *≈1882 tick* |

*İkinci satır boru hattının parçası değildir: kalabalık dünya teşhis için
yardımcı olarak koşuldu ve yalnız "θ hiç hareket etmiyor" gözlemini
sabitler. Kaynak: `VALIDATION.md` §6.11'de açıklanan doygunluk hatası.*

**Mekanizma doğru çalışıyor, kazanç yok.**

- Kalabalık dünyada arama **hiç hareket üretmiyor:** birey doyuyor, davranışı
  sonucu belirlemiyor, tüm çatallar aynı uygunluğu alıyor.
- Seyrek dünyada arama **hareket üretiyor** ama ölçülebilir performans kazancı
  yok (medyan organizma enerjisi değişmiyor).

**Maliyet kabul edilemez:** arama, koşunun toplam bütçesinin yaklaşık **%60'ını**
tüketiyor (≈1800 tick'lik eşdeğer). Gerçek zamanlı bir tarayıcı ürünü için bu,
kare hızını düşüren bir maliyettir.

### 6.13 Bu neden S-3'e işaret ediyor

Çevrimiçi (μ+λ) evrimsel aramanın aynı görevde **+0.161** bulmasının
karşısında, yaşam içi ES'in bulduğu: hareket var mı yok, kazanç yok, maliyet
çok yüksek.

Fark şurada: çevrimiçi arama **seçim yapıyor** — her nesilde en iyisi tutuluyor,
12 nesil boyunca küçük davranış farkları birikir. Yaşam içi ES ise bir bireyin
**tek yaşamında** tek bir güncelleme yapar; küçük farklar birikemez.

**Sonuç: S-4 mekanik olarak mümkün, pratikte başarısız.** Ölçüm zinciri
burada da tamamlandı ve kalan tek seçenek yine **S-3**.


### 6.14 S-3 hazırlığı · in-world arama denendi ve **reddedildi**

S-3'ü ürüne almadan önce kanıtlı +0.161 sonucunun (arena, §4.9) **canlı dünyanın
bir dalında** da üretilip üretilmediği soruldu. `evolvePolicy`'ye isteğe bağlı bir
değerlendirici kancası eklenerek (seçim/mutasyon mantığı aynen korunarak) canlı
dünya dalında arama koşuldu.

**İki ölçüm hatası bulundu ve düzeltildi:**

1. **Doygunluk / yanlış normalleştirme.** Uygunluk organizmanın *toplam*
   enerjisiydi; bu, hücre sayısıyla artar. `generations: 0` (hiç arama yok)
   kontrol kolunda bile **74 birimlik sahte "kazanç"** çıktı — arama
   yapılmamışken. Toplam yerine **hücre başına** enerjiye çevrildi.
2. **Rastgele tabanların karşılaştırılamazlığı.** İki kolun rastgele taban
   değerleri farklı çıktı (48.954 vs 34.153): arama RNG akışının farklı
   noktalarında çekildikleri için aynı örneklem değiller. Taban, kol bağımsız
   **aynı** politik kümesinden alınmalı.

| Kol | Rastgele taban | Bulunan | Fark |
|---|---|---|---|
| Kontrol (**hiç arama yok**) | 48.954 | 55.887 | +6.933 |
| Evrim (8 nesil) | 34.153 | 69.021 | +34.867 |

Kontrol kolunun +6.933'ü saf "rastgele altıdan en iyisini seç" etkisidir; evrimin
üstüne düşen **gerçek** artış bundan küçüktür. Rakamlar bu haliyle
**karşılaştırılabilir değildir** ve S-3'ün kanıtı olarak kullanılamaz.

### 6.15 Tasarım sonucu: arama arenada yapılmalı, dünyada değil

Bu iki hatadan çıkan tasarım kararı nettir:

**S-3, canlı dünyanın dalında değil, arenada çalışmalı.**

| Özellik | Arena (ölçülmüş, §4.9) | Canlı dünya dalı (denendi) |
|---|---|---|
| Birey sayısı | 1 — davranış sonucu belirler | ~250 — birey doyuyor, davranış etkisiz |
| Uygunluk | Hücre başına normalize | Doygunluk ve temel yanlılığı |
| Eğitim/değerlendirme | Ayrık tohum kümeleri | Aynı dünya, ayrışmıyor |
| Sonuç | **+0.161, p = 0.343 üstü ama CI ayrışıyor** | Karşılaştırılamaz |

Arena tek bireyli ve kaynak kısıtlı olduğu için **politikanın davranışı gerçekten
belirliyor.** Canlı dünyada bireyler birbirini doyuruyor; S-4'te de aynı şey
ölçülmüştü (§6.12: kalabalık dünyada θ hiç hareket etmiyor).

**Ürün kararı:** "Evrim Atölyesi" adıyla, kullanıcı bir organizmanın
politikasını arenaya gönderir, (μ+λ) arama çalışır, nesil eğrisi gösterilir ve
kazanan politika seçilen organizmaya uygulanır. Bu hem ölçülmüş yoldur hem de
kullanıcıya **görünür, denetlenebilir bir öğrenme süreci** sunar.

**Maliyet uyarısı:** ölçülen arama süresi tek koşuda **~123 saniye** (8 nesil).
Bu ürün içinde **otomatik** çalışmaz; kullanıcı tetiklediği, ilerlemesi
gösterilen, iptal edilebilen bir işlem olmalıdır.


### 6.16 S-3 · Evrim Atölyesi — **ürün özelliği olarak kuruldu ve tarayıcıda doğrulandı**

**Ne yapıyor:** Kullanıcı bir organizma seçer, "Bulunanı uygula" der; seçili
organizmanın politikası **arena** üzerinde (μ+λ) aramayla geliştirilir, nesil
eğrisi çizilir, kazanan politika organizmanın ağırlıklarına yazılır.

**Dürüstlük tasarımı — Jensen–Wald ayrımı:**
- **Eğitim tohumları:** arama bunları puanlayarak "görür".
- **Tutulmuş tohumlar:** ne arama ne seçim bunları görmez.
- **Raplanan kazanç YALNIZCA tutulmuş tohumlardadır.**

Bu ayrım olmadan "genelleşme" iddiası ölçülemez; §6.14'teki hatanın tam olarak
bu eksiklikti.

**Ölçülen (tarayıcıda, organizma #11):**

| | Değer |
|---|---|
| Eğitim tohumları | 0.834 → 0.890 |
| Rastgele taban | 0.789 |
| **Görülmemiş tohumlar** | **0.742 → 0.777** |
| **Gerçek kazanç** | **+0.035** |
| Değerlendirme sayısı | 122 |
| **Süre** | **0.4 sn** |

Headless doğrulama (organizma #1, daha büyük bütçe): eğitim 0.8331 → 0.9026,
görülmemiş 0.7504 → 0.8221, kazanç **+0.0717**, 122 değerlendirme, **0.6 sn**.

**Maliyet notu:** §6.15'te tam dünya dalında tek arama ~123 sn sürdü; arena tek
birey olduğu için **0.4–0.6 saniyeye** iniyor. Bu yüzden özellik **etkileşimli
olarak kullanılabilir** ve ürüne alınabilir.

**Tarayıcı doğrulaması (Chromium, `vite preview`):**
- HUD'dan "Evrim Atölyesi" paneli açılıyor
- Organizma seçiliyor, arama çalışıyor, ilerleme ve eğri görünüyor
- Kazanç bildirimi çıkıyor: *"görülmemiş tohumlarda +0.035"*
- "Bulunan politika organizmaya yazıldı" onayı
- Simülasyon kesintisiz sürüyor (tick 884), **konsol hatası yok**


### 6.17 Faz B3 · Somatik mutasyon / hileci deneyi

> ⚠️ **DÜZELTME (§6.20):** Bu bölümün ilk yazımı **yanlış bir bulgu** içeriyordu
> ("paylaşma mekaniği ölü kod"). Yanlışlık ölçüm aracındaydı ve §6.20'de
> düzeltildi. Aşağıdaki metin **düzeltilmiş hâlidir.**

Yol planının B3'ü: hileci mutasyonun yayılıp yayılmadığını ölçmek.

**Mimari bulgu (bu hâlâ geçerli):** `world.ts → sharingPhase()` paylaşım oranını
**organizmanın genomünden** alır:

```js
shareAlongBond(donor.energy, receiver.energy, org.genome)
```

Bir organizmanın tüm hücreleri aynı genomu paylaşır. Dolayısıyla **hücreler
arasında davranış farkı yoktur**; bir hücre "çok paylaşan", diğeri "az
paylaşan" olamaz. **Hilecin tanımı bu modelde yoktur.**

### 6.18 Paylaşma mekaniği **çalışıyor** — ve eşiği düşürmek **zararlı**

Varsayılan ayarlarda (boşta eşiği 82 e, 8.000 tick, 3 tohum, `strainK 0.005`):

| Eşik | Eşik (e) | Aktarım | Görülen maks. fazla | Zirve küme | Son küme | **Son 4+ yapı** | Son pop | Son enerji | Rezidüel |
|---|---|---|---|---|---|---|---|---|---|
| **0,82 (varsayılan)** | 82 | 2.262 | 14,23 | **24** | **5** | **4,67** | 176 | 0,297 | −4,8e−8 |
| 0,60 | 60 | 366.660 | 10,22 | 10 | 3 | 0,33 | 173 | 0,325 | −4,1e−8 |
| 0,50 | 50 | 287.912 | 20,38 | 9 | 4 | 0,67 | 177 | 0,318 | −5,0e−8 |
| 0,40 | 40 | 255.748 | 30,23 | 14 | 3 | 0,33 | 177 | 0,302 | −4,0e−8 |
| 0,30 | 30 | 84.236 | 39,05 | 16 | 3 | 2,33 | 168 | 0,301 | −5,2e−8 |

**İki sonuç, ikisi de önemli:**

1. **Mekanizma canlı.** Varsayılan ayarlarda 8.000 tick'te **2.262** gerçek
   paylaşım gerçekleşiyor. `shareEfficiency` genom parametresi etkisiz **değil**.
2. **Varsayılan eşik (0,82) en iyisi.** Eşiği düşürmek kolonileri **çökertiyor**:
   zirve küme 24 → 10, pencerenin sonundaki 4+ hücreli yapılar 4,67 → 0,33.
   Yüksek eşik, yalnız gerçekten zengin hücreleri iyi beslenmiş seviyeye
   *eşitleyen* bir ayarlama; düşük eşik kolonileri açlığa pompalıyor.

Enerji korunumu her satırda korunuyor (|rezidüel| < 5,2e−8) — taşıma kaybı
gerçekten harcanıyor.

### 6.19 Doğrulama

- **Sayaç artabiliyor:** varsayılan ayarlarda `transfers > 0`. Bu, §6.20'deki
  hatayı bir daha yakalayan regresyon korumasıdır.
- **Mekanizma doğrudur:** eşiği aşan/altında kalan çiftte aktarım olur, ikisi de
  altındayken olmaz.
- **Enerji korunumu** paylaşma açıkken de sağlam.

### 6.20 Düzeltme kaydı — "ölü kod" bulgusu **yanlıştı**

Önceki düzenlemede şu yazılmıştı: *"paylaşma mekaniği tamamen atıl kod,
`shareEfficiency` hiçbir şey yapmıyor."* Bu **yanlıştı.**

**Hata zinciri:**

1. `World.sharingStats()` alanı eklendi ama `sharingPhase()` içine
   **artırma satırı konulmadı.** Sayaç yapısal olarak daima 0 döndü.
2. Doğrulayan test `expect(transfers).toBe(0)` yazdı — ve **boşuna geçti.**
3. Ayrıca paylaşma bir "anda" elle örneklenmişti (2 bağ, 0 aktarım); bu da
   hiçbir zaman tetiklenmediği anlamına gelmez.

Gerçekte varsayılan ayarlarda 8.000 tick'te **2.262** aktarım oluyor.

**Asıl ders:** Hiç artmayan bir sayaç, hiçbir şey yapamayan bir ölçüm
aletinden kötüdür — senin beklentinle her zaman aynı şeyi söyler ve
"doğruluyormuş" gibi görünür.

**B3 için sonuç değişmedi, gerekçesi değişti:** hileci hâlâ tanımsız, ama
nedeni artık "ölü kod" değil — **politikanın hücre düzeyinde olmaması.**
Düzeltilmesi gereken, eşik değil; B3'ün önkoşulu **işbirliği aktı** (örn. hücre
enerji harcayarak bağını yenilemesi) eklemektir.

### 6.21 Faz C1 · MODES açık uçluluk metrikleri

Literatür taraması (`docs/LITERATURE.md` §1) açık uçluluğun **ölçülebilir**
olmasını şart koşuyor: Dolson vd. (2019) çerçevesinde değişim, yenilik,
çeşitlilik, karmaşıklık ve aktivite. Buraya kadar bu depo "yaşam sürüyor / ölmüyor"
diyordu; MODES metrikleri daha kesin bir dille soruyor: **popülasyon değişiyor
ve yeni biçimler üretiyor mu?**

**Ölçüm (tohum 11, 12.000 tick, `strainK 0.005`):**

| Tick | Pop | Değişim | Yenilik % | Çeşitlilik | Karmaşıklık | Aktivite | Tür |
|---|---|---|---|---|---|---|---|
| 0 | 48 | 0.0000 | 100,0 | 0,798 | 0,000 | 0 | 12 |
| 2.000 | 157 | 0,0043 | 37,4 | 0,858 | 0,376 | 2.410 | 12 |
| 4.000 | **248** | 0,0021 | 17,2 | 0,892 | **0,426** | 7.390 | 12 |
| 6.000 | 217 | 0,0004 | 3,4 | 0,904 | 0,415 | 10.176 | 12 |
| 8.000 | 166 | 0,0000 | 0,0 | 0,760 | 0,346 | 10.325 | 12 |
| 12.000 | 134 | 0,0001 | 0,9 | 0,772 | 0,226 | 11.493 | 12 |

**Sonuç: bu açık uçluluk değil, yakınsama.**

Yenilik **%37 → %0,9**'a düşüyor, değişim sıfıra yaklaşıyor, karmaşıklık
4.000 tick'te zirve yapıp (0,426) sonra yarıya iniyor (0,226). Tür sayısı 12'de
sabit. Pencere boyunca 125 benzersiz genom imzası görüldü — yani bir keşif
yaşandı, **sonra popülasyon daralmaya geçti.**

Bu, literatürdeki "açık uçluluk geçicidir ve baskın desenlere çöker"
bulgusunun (Faldor vd. 2023, büyük ölçekli açık uçlu Lenia) bu modeldeki
karşılığıdır.

**İki ölçüm hatası bulundu ve düzeltildi (yazımdan önce):**

1. **Değişim endeksle eşleştiriliyordu** (`prev[i] ↔ curr[i]`). Organizma listesi
   her örnekte kayar; aynı indeks farklı bireyi gösterir ve sonuç yapısal olarak
   ~0 çıkar. Doğrusu: her güncel genomün **kendisine en yakın önceki genoma**
   uzaklığı. Düzeltmeden önce 6.000 tick'te "değişim 0.068" görünüyordu,
   düzeltmeden sonra **0.0004** — yani ölçüm 170 kat şişmiş bir sayıyı
   küçümsüyordu.
2. **Eğilim tick 0'ı karşılaştırmaya katıyordu.** Tick 0'da tüm kurucular tek
   hücrelidir (karmaşıklık = 0) ve popülasyon kurucu kümesidir (yenilik =
   %100); bunları karşılaştırmak "rising" diye yanlış bir eğilim üretiyordu.
   İlk ve son örnekler çıkarıldı, **yayıncının haklı olduğu ortaya çıktı.**

**Ölçüm aracı:** `measureModes()` — beş metrik + tür sayısı + pencere boyunca
benzersiz imza sayısı. Ek simülasyon maliyeti yoktur; tümü mevcut dünya
verisinden türetilir.

### 6.22 Bu bulgu yol haritasına ne söylüyor

Açık uçluluk ölçümü artık **mevcut** ve cevabı şu: sistem kısa bir keşif
yapıp sonra yakınsıyor. Bu, yol planının Faz D'siyle (kalite-çeşitlilik
arşivi / MAP-Elites yaşam haritası) doğrudan ilgili: **arşiv olmadan popülasyon
tek bir çukura düşüyor.** MAP-Elites tam olarak bu çukuru kaçınan yöntemdir —
farklı davranış nişlerini ayrı ayrı korur.

### 6.23 Faz D · Niş kapsama — **önce ölçüm hatası bulundu**

§6.22 "arşiv olmadan popülasyon tek çukura düşüyor" diyordu ama **tek çukur
nerede** olduğu belirsizdi. MAP-Elites çekirdeği olan bir ızgara kuruldu:
üç ölçülebilir betimleyici (hız, boyut, duyu menzili), 3×3×3 kutu.

İlk çalıştırma "5/27 kutu dolu, en yoğun kutuda **%83** organizma" dedi. Bu
sayı **kullanılamazdı** — ve iki ayrı ölçüm hatasından geliyordu:

| Hata | Belirti | Kanıt |
|---|---|---|
| **Birim hatası** | Hız, iki örnek arasındaki *yer değiştirme* olarak ölçülüyor, ama `SPEED_MAX = 0.08` **mb/tick** idi. Dağılımın **1581/1582**'si tavanın üstündeydi. | Aynı gözlemler doğru birimde (`/tick`) karşılaştırılınca **0/1582** tavanı aşıyor. |
| **Yanlış üst sınır** | Boyut tavanı `log2(48)` idi; en büyük organizma **8 hücre**. 3. kutu en az 13 hücre istiyor → **yapısal olarak erişilemez**. | Kalibrasyon koşusunda bu tavan (24 hücre) gerçekten erişildi. |
| **Bozuk ilk örnek** | Döngüden önce örnek alınıyordu; hiç adım atılmadığı için herkes "sıfır hız" kutusuna düşüyor, seri küçük başlıyordu. | 4 örneklik seri `[2, 5, 4, 4]` → "2.0 → 4.0 **genişledi**"; aynı koşu 7 örnekte daralma gösteriyordu. **Aynı ölçüm, iki zıt yön.** |

**Bunların hiçbiri kendini belli etmiyordu.** Hepsi makul görünen sayılar
üretti. Kırık bir eksen, ızgarayı taşımadığı hâlde doluluk yüzdesi yazmaya
devam ediyordu.

### 6.24 Düzeltme ve ölçülen sonuç

Üç düzeltme:

1. **Hız birimi.** Betimleyici artık **yol uzunluğu / tick**; her tick
   merkez konumu ölçülüp yol biriktiriliyor. Bu tanım örnekleme aralığına
   bağlı değil (önceki tanım 20 tick'te medyan 0.057, 200 tick'te 0.019
   veriyordu — rastgele yürüyüşte yer değiştirme √Δt ile büyür). Her tick
   ölçmenin maliyeti ölçüldü: 3000 tick'te `step` yalnız 907 ms, merkez de
   eklenince 863 ms — gürültü içinde, yani bedava.
2. **Kalibre edilmiş sabit tavanlar.** `NICHE_SPEED_MAX = 0.12` ve
   `NICHE_SIZE_MAX = log2(MAX_ORGANISM_CELLS)`; ikisi de
   `tools/calibrate-niche-axes.ts` çıktısından. Kalibrasyon **ayrı, çok
   tohumlu ve uzun** bir koşu — ölçümle aynı pencerede yapılırsa eksenler
   ölçülen dünyaya göre kayar ve ölçüm kendini doğrular.
3. **Döngü öncesi örnek kaldırıldı**, kısa seride eğilim iddiası hiç kurulmuyor.

Düzeltilmiş ölçüm (tohum 11, 12.000 tick, ızgara 3×3×3):

| | hız | boyut | menzil |
|---|---|---|---|
| Üst sınır | 0.120 | 4.585 | 5.000 |
| Gözlem | 1534 | 1534 | 1534 |
| **Tavana kırpılan** | **0 (%0.0)** | **0 (%0.0)** | **0 (%0.0)** |
| **Dolu kutu** | **3/3** | 2/3 | 2/3 |

**Sonuç (düzeltilmiş):** 7/27 kutu dolu (%26), en yoğun kutuda **%52**
organizma birikmiş (kutu 2/0/1 — hızlı, tek hücreli, orta menzilli).
Dolu kutu sayısı ilk üçte 5.3 → son üçte 4.3.

> Düzeltme kaydı: §6.22'deki "%83 tek kutuya birikmiş" sayısı **kırık bir
> aletle** alınmıştı ve **bu sayı geçersizdir**. Doğru ölçüm %52'dir.
> **Yön değişmedi** — yakınsama gerçek — ama sayı ve doluluk farklı.

Boyut ve menzil eksenlerinde 3. kutu seyrek doludur. Bu **arıza ilan edilmedi**:
organizmaların çoğu gerçekten 1–2 hücreli ve menzilleri ortada, yani eksik
kutu ölçülen biyolojidir, alet hatası değildir.

### 6.25 Ölçüm aletinin kendi kendini denetlemesi

Bu, bu turda çıkan asıl ders ve kalıcı bir değişikliktir. `NicheReport` artık
her koşuda **eksen sağlığını** raporluyor: üst sınıra kırpılan gözlem sayısı,
kaç kutunun gerçekten dolduğu, gözlenen en küçük değer.

Çökme kuralı **yalnız güvenilir sinyale** bakar — `binsReached < 2` ya da
>%90 kırpma. "Bazı kutular hiç dolmadı" **tek başına arıza sayılmaz**; yalnız
`binsReached` olarak raporlanır. Çünkü bir kutuya hiç düşmemiş olmak, aletin
çöktüğünü değil **dünyanın orada boş olduğunu** gösterir; ikisini karıştırmak
ölçülen bir gerçeği gizlemek olurdu.

**Denetleyicinin kendisi de test edilir.** "Çökme dedektörü gerçekten
tetiklenebiliyor" testi ızgarayı kasıtlı olarak tek kutuya indirip dedektörün
patladığını doğruluyor. Aksi hâlde dedektör sessizce hiç yanlsa hep boş döner
ve yeşil görünür — en tehlikeli ölçüm aleti budur.


### 6.28 Faz D · Arşivin seçilime katılması (ε > 0) — **başarısız, ve nedeni yapısal**

Arşiv şimdiye kadar yalnız ölçtü. Asıl soru: MAP-Elites kuralı **işe yarar
mı**? Yani boş nişlere o nişte arşivlenen en iyi bireyin yavrusu enjekte
edildiğinde (ε > 0) çukur dolar mı?

Protokol: iki kol, **aynı 4 tohum** (eşleştirilmiş). Kontrol ε = 0, tedavi
ε > 0 (250 tick'te bir tarama). Bootstrap güven aralığı + eşleştirilmiş p.
**Başarı ölçütü sonuçtan ÖNCE kaydedildi:** dolu kutu sayısı artmalı.

| | kontrol (ε = 0) | tedavi (ε > 0) |
|---|---|---|
| Dolu kutu (/27) | 10,50 | **10,50** |
| Yoğunlaşma | %50 | %51 |
| Canlı popülasyon | 119 | 174 |
| Hücre enerjisi (e) | 3.667 | 4.653 |
| Enjeksiyon (adet) | 0 | 205 |

Eşleştirilmiş fark **0,00** [−2,75, +2,75], **p = 1,0000**.

Tohum başına eşleştirilmiş farklar (dolu kutu): `[-2, 2, 2, 0]`.
**İşaret tohumlar arasında bile değişiyor** — biri artı, biri eksi. Yani deney
"hep çalışmıyor" değil, "**rastgele** çalışıyor"; ortalama etki sıfır.
Bu, sonraki bölümdeki mekanizma teşhisini destekliyor.

**Sonuç: başarısız.** Doluluk artmadı. Canlı sayısı ve toplam hücre enerjisi
arttı, yani enjeksiyon gerçekten canlı üretiyor — ama ürettiği bireyler
çukura geri kayıyor.

Enerji muhasebesi sağlam (rezidül ~8e-8 e), yani sonuç geçerli.

### 6.29 Neden başarısız — iki yapısal sınır

Negatif sonuç yetmez; **niye** sorusu ölçülerek yanıtlandı.

**1. Boyut ekseni kalıtsal değil.** Enjeksiyon yolu `createOrganism` +
`spawnCell` ile **tek hücreli** bir organizma doğurur. Ölçüldü (tohum 9101,
12.000 tick, ε > 0):

| Boyut kutusu | Arşivde (tarihsel) | Canlıda (şimdi) |
|---|---|---|
| 0 (tek hücre) | 1.942.903 | **172** |
| 1 (2–8 hücre) | 97.568 | **0** |
| 2 (9–24 hücre) | 3.039 | **0** |

Canlıların **%100'ü tek hücreli**. Büyük organizmalar tarihte var olmuş,
sonra **yok olmuş**. Genomda gövde boyutu yoktur — büyüme bir olaydır,
kalıtsal bir özellik değil. Bu yüzden MAP-Elites'in "elitini koru" mantığı
boyut ekseninde **hiçbir şey koruyamaz**: enjekte edilen elit, tanımı gereği
tek hücreli doğar ve o an daima alt bin yer alır.

**2. Seçilim anlık boşluğa enjekte eder.** Kural, "arşivde var ama şu an
canlıda yok" olan kutuları hedefler. O an hedef kutu zaten boş olduğu için,
elit nereden gelirse gelsin gireceği yer boştur. Tohumlar arasındaki fark
işaret değiştiriyor (+1, −4, +4, −1) — bu dağınıklığı gösteriyor.

Birinci sınır mutlaka çürütülebilir bir açıklamadır: MAP-Elites'in kendi
varsayımı **betimleyicinin kalıtsal olmasıdır** (Picbreeder'da "boy" =
seçilim nesnesi). Burada üç betimleyiciden biri (`boyut`) ölçülebilir ama
**kalıtsal değildir**. Bu yüzden "boş kutu doldur" vaadi boyut ekseninde
yapısal olarak yerine getirilemez.

> Hipotez olarak önce "elit mutasyonla bozuluyor" düşünüldü ve **ölçülerek
> çürütüldü**: mutasyon kapalıyken de doluluk artmadı (11/27'ye karşı
> 12/27'ye, tek tohum, gürültü düzeyinde). Yanlış açıklama, doğrulamadan
> önce kaydedildi.

### 6.30 Tasarım sonucu

Arşiv **üründe ölçüm olarak kalıyor** (`ε = 0`, varsayılan). Seçilim kancası
ölçüm aracı olarak duruyor ama **açılmıyor** — çünkü ölçüldü ve işe
yaramadı. Kalıtsal olmayan bir betimleyici üzerinden seçilim yapmak,
yöntemin varsayımına aykırıdır.

Faz D'nin bugünkü durumu: **çukur ölçüldü, görselleştirildi, ve doldurulması
denendi — başarısız.** Bir sonraki adım ancak kalıtsal bir betimleyici
eklenirse anlamlı olur (örneğin genomdaki bir özellik), çünkü o zaman
seçilim gerçekten bir şey koruyabilir.

### 6.32 Faz C2 · Gözlemci — **ölçülebilir kısım ölçüldü, canlı çağrı anahtar bekliyor**

Gözlemci paneli iddiası daha önce hiç doğrulanmamıştı. Bu turda üç şey
**ölçüldü**; biri gerçek bir hata çıkardı.

#### (a) Kanıt denetimi hiç test edilmemişti

Model yanıtındaki sayıları kanıt paketine karşı denetleyen üç fonksiyon
(`extractNumericClaims`, `verifyNumericClaims`, `buildLocalSummary`) **sıfır
teste** sahipti. Onlar olmadan panel, model halüsinasyonlarını "doğrulanmış"
diye sunabilirdi. 16 test yazıldı; ağırlıklı olarak **reddetme** yönünde,
çünkü dürüst modelde denetimin işe yaramadığını görmek kolay, reddedemeyen
denetimlemsizin de kolay görünmesidir.

Denetim kırık mıydı? Kısmen. Zorlayan probe şunu yakaladı:

> "Bu **3 organizma** bağ kurdu." → 3 sayısı `bondCount = 3` ile eşleşiyor
> ve **doğrulanmış** geçiyor. Ama iddia *bağ* değil *organizma* sayısı
> hakkındaydı.

Bu bir **yanlış kabul**dir ve panelde "3 bağ ✓" olarak görünür — yani
kullanıcı, iddiayı kanıtlanmış sanar. Denetim **değer** karşılaştırır,
**anlam** karşılaştırmaz.

Çözüm metin bağlamını kırılgan ayrıştırmak değil, **eşleşmeyi görünür
kılmak**: sonuç artık `matchedMetric` taşıyor ve panel "3 ← bondCount"
yazıyor. Ölçülen gerçeği saklamak yerine gösteriyor.

#### (b) Gözlemci rotası üretim yapısında **erişilemez**di

`vite dev` `/api`'yi 8787'ye proxy'lıyordu ama `preview` (yani `npm run build`
sonrası üretim yapısı) **proxy'sizdi**. Ölçüldü:

| Yapılandırma | `POST /api/observer` | Anlamı |
|---|---|---|
| `preview` (önce) | **502** | Rota hiç yok — gözlemci sunucusuna hiç ulaşılmıyor |
| `preview` (sonra) | **503** | Rota var, sunucu dürüstçe "anahtar yok" diyor |

Bu bir belirsizlik değil, yapısal bir eksiklikti: **üretim yapısında dil
modeli yolu hiçbir ortamda çalışmıyordu.** `preview.proxy` eklendi.

#### (c) Anahtarsız yol uçtan uca doğrulandı

Gerçek model çağrısı `CTM_API_KEY` gerektiriyor ve bu anahtar **yalnız
sunucu ortamında** okunuyor. Anahtarsız yol tamamen doğrulanabilir:

```
GET  /api/observer/health  → 200 {"provider":"minimax","model":"MiniMax-M2.1","hasKey":false,…}
POST /api/observer         → 503 {"error":"api anahtarı yok","hint":"CTM_API_KEY …","sourceMode":"local-summary"}
```

Tarayıcıda gözlemlendi: panel açıldı, "Yerel kural özeti — dil/görsel model
kullanılmadı" yazdı, gözlemler/yorumlar/belirsizlikler/sonraki deney ve 13
ölçüm listelendi. Konsoldaki tek hata **503**'tür — yani rota **ulaşıldı**
ve sunucu nedenini dürüstçe bildirdi (önceki 502 "rota yok"du). Oyun akışı
kesilmedi.

#### Doğrulanmayan ( dürüstçe)

- **Gerçek sağlayıcı çağrısı yapılmadı** — `CTM_API_KEY` yok. Bu, bu turun
  bulgusu değil, kullanıcının sağlayacağı bir eksiktir.
- `vision-assisted` yolu (gerçek kare) hiç çalıştırılmadı.
- MiniMax'in güncel görsel istek şeması canlı belgeden doğrulanmadı.

> Denetim düzeltmesi **ölçüldü**: sahte sayılar reddediliyor (480, 19, 12,7,
> 2026, 47), dürüst sayılar kabul ediliyor, ve yanlış kabul artık eşleşen
> ölçümün adıyla görünür durumda.

### 6.26 Faz D ürün tarafı — **Yaşam Haritası paneli**

Ölçüm artık üründe. HUD'da "Yaşam Haritası" düğmesi, 3×3×3 ızgara
menzil katmanları hâlinde: renk yoğunluğu = kutudaki en iyi bireyin enerjisi,
sayı = o kutuda görülen organizma.

**Tasarım kararı — tek kaynak.** Betimleyici hesabı hem deney altyapısında
hem üründe kullanıldığı için `src/sim/lab/lifeMap.ts` tek kaynak yapıldı;
`ecology.ts` sabitleri buradan alıyor. İki kopya zamanla ayrışır ve **ayrışan
iki ölçüm aynı sayıyı iki farklı yorumla üretir** — §6.23'te yaşanan hatanın
yapısal nedeni buydu.

**Seçilim `ε = 0`.** Arşiv her kutuda en iyi bireyi saklar ama seçilime
katılmaz; canlı dünya panel açıkken de değişmez. Testle korunuyor: aynı
tohumda takipçili ve takipçisiz iki dünya bit düzeyinde aynı ilerliyor ve
enerji korunumu bozulmuyor.

**Maliyet ölçüldü, tahmin edilmedi.** Takipçi her tick `centroidOf` çağırır;
3000 tick'te `step` yalnız 907 ms, merkez konumu eklenince 863 ms. Kare
başına gönderim yok; panel açıkken 1500 ms'de bir tek anlık görüntü istenir.

### 6.27 Tarayıcıda doğrulama — dedektör **gerçekten** ateşledi

`vite preview` (port 4188) üzerinde gözlemlendi:

| Tick | Görünüm | Panel |
|---|---|---|
| 263 | 6/27 kutu · %66 · 12.617 gözlem | ⚠️ **"Eksen çöktü: boyut"** |
| 941 | 8/27 kutu · %77 · 58.624 gözlem | uyarı **kayboldu** |
| 1422 | 9/27 kutu · %75 · 107.021 gözlem | uyarı yok |

Bu, §6.25'te yazılan dersin üründe de geçerli olduğunun kanıtı: dedektör
"her zaman yeşil" değil. Tick 263'te bütün organizmalar tek hücreliydi, boyut
ekseni gerçekten ayrım üretmiyordu ve panel bunu **dürüstçe** söyledi.
Organizmalar büyüdükçe uyarı kendiliğinden temizlendi — yani uyarı bir
ölçüm değil, anlık gerçeği yansıtıyor.

Muhasebe farkı panel açıkken de korundu (−0,001 e). Konsol hatası **0**;
tek mesaj önceden var olan `THREE.Clock` kullanımdan kaldırma uyarısı.

Chromium'da `vite preview` (port 4188) üzerinden doğrulandı:

| Kontrol | Gözlem |
|---|---|
| Uygulama açılıyor, WebGL2 sahne kuruluyor | ✅ |
| Worker modülü yükleniyor, dünya başlıyor | ✅ |
| HUD türkçe, tick artıyor | ✅ tick 278 ölçüldü |
| Canlı listesi doluyor | ✅ 59 organizma |
| **Çok hücreli organizmalar listede** (`#7 → 4 hücre`, `#23 → 3`, `#31 → 3`, `#33 → 3`) | ✅ |
| **Muhasebe farkı** | ✅ 0,004 e |
| Kayalar, kaynak düğümleri, besin alanı küreleri, avcı, ışık huzmeleri, deniz karı çiziliyor | ✅ |
| **Konsol hatası yok** | ✅ 0 hata |
| **"Dal oluştur" butonu çalışıyor** | ✅ "Dal oluşturuldu" bildirimi |
| Dal sonrası simülasyon kesintisiz sürüyor | ✅ tick 474 → 765 |
| **Yaşam Haritası düğmesi** | ✅ panel açıldı |
| **Izgara doluyor** | ✅ 9/27 kutu, 107.021 gözlem |
| **Eksen çökme dedektörü canlı** | ✅ tick 263'te "boyut" uyarısı, tick 941'de kendiliğinden temizlendi |
| **Muhasebe farkı panel açıkken** | ✅ −0,001 e |

### 6.31 Panel, başarısız yolu saklamıyor

Arşivin seçilime katılması denendi ve **başarısız** oldu (§6.28). Panelin
tuzganı şudur: kullanıcı ızgarayı görüp "boş kutu = fırsat" diye okur ve
doldurulması beklenen bir boşluk sanır. Oysa bu boşluk doldurulamaz.

Bu yüzden panelin altına ölçülmüş sonuç açıkça yazıldı:
*"Bu ızgarayı seçilimle doldurma denendi ve işe yaramadı (dolu kutu
değişmedi, p = 1,00). Nedeni: boyut kalıtsal değil — enjekte edilen her
organizma tek hücreli doğar."*

Tarayıcıda gözlemlendi (tick 240, konsol hatası 0):

```
6/27 kutu · en yoğun kutu %65 · 11.472 gözlem
⚠️ Eksen çöktü: boyut. Bu eksen ızgarayı taşımıyor; doluluk sayısı bu haliyle yorumlanamaz.
Bu ızgarayı seçilimle doldurma denendi ve işe yaramadı (dolu kutu değişmedi,
p = 1,00). Nedeni: boyut kalıtsal değil — enjekte edilen her organizma tek hücreli doğar.
```

### 6.33 Belge denetimi — "belge ölçümle uyuşmalı" kuralı **testle** zorlanıyor

Bu projenin bütün disiplini şudur: belge ölçümle uyuşmalı. Ama ölçüm kodunu
değiştirdiğinde `docs/EXPERIMENTS.md` kendiliğinden güncellenmez ve yazılı
sayı **sessizce bayatlar**. Hiçbir şey bunu yakalamıyordu.

`tests/docs.test.ts` (8 test) iki somut boşluğu kapatıyor:

1. **Bayat rapor.** Ölçüm kodu (`run-experiments.ts`, `experiments/*.ts`,
   `stats.ts`) rapordan sonra değişmişse test **kırmızı** döner.
2. **Düzeltme kaydının bozulması.** Üretilmiş rapordaki eşleştirilmiş fark
   dizisi ile `VALIDATION.md`'deki aynı dizi karşılaştırılır. Sessizce geri
   dönülürse (kırık %83 geri gelirse) test düşer.

**Test yazarken gerçek bir boşluk bulundu:** §6.28'deki ε>0 bölümünde tohum
başına fark dizisi **hiç yazılmamıştı** — raporda `[-2, 2, 2, 0]` vardı,
belgede yoktu. Bu, "farklar işaret değiştiriyor" gözlemini taşıyan kanıttı;
eksikti, eklendi.

Karşılaştırma tire kodunu normalleştiriyor (rapor ASCII `-4`, elle yazılan
belge tipografik `−4` kullanıyor). Test **belgenin okunurluğunu bozmamak**
için eşitliği ölçüyor, biçimi değil.

**Bayat rapor dedektörü gerçekten ateşledi.** Ölçüm koduna kasıtlı bir
değişiklik yapılıp test çalıştırıldı:

```
× rapor, üretim kodundan sonra yeniden üretilmiş 47ms
```

Yani dedektör kırılmış değil — istendiğinde kırmızıya dönüyor. Bu, "denetleyicinin
kendisini de test et" ilkesinin belge katmanındaki karşılığıdır.

### 6.35 `npm run e2e` **kırıktı** — ve ölçülebilir tarayıcı kanıtı eksikti

Bu projede tarayıcı doğrulaması hep **elle** yapıldı. Oturumda iki kez güvenilmez
çıktı: sekme bayatladı ("ölü alet") ve konsol okunamadı. Elle yapılan kanıt
dosyada kalmıyor.

`package.json`'da `"e2e": "playwright test"` **vardı**, `@playwright/test` bağımlılığı
**vardı** — ama `playwright.config.ts` **yoktu** ve test dosyası **yoktu**.
Çalıştırıldığında:

```
Error: No tests found          (exit 1)
```

Çünkü yapılandırma olmadığı için Playwright `tests/` dizinini tarıyor, vitest
dosyalarını yüklemeye çalışıyor ve patlıyordu. Yani **bildirilen bir betik
çalışmıyordu** — projenin kendi "yazıldı ≠ çalışıyor" sınıfından.

`playwright.config.ts` ve `e2e/sim.spec.ts` (6 test) yazıldı:

| Test | Ne doğrular |
|---|---|
| dünya kurulur, tick ilerler, konsol temiz | temel akış |
| enerji muhasebesi korunuyor | korunum değişmezi |
| yaşam haritası kutuları doluyor + başarısız yolu saklamıyor | Faz D |
| denetleyici yanlış pozitif üretmiyor | panel açıkken korunum |
| Evrim Atölyesi "çalışıyor" diye yalan söylemiyor | dürüst durum |
| Gözlemci yerel kural özeti üretiyor | anahtarsız dürüst yol |

### 6.36 Yapılandırma sınamasında **ikinci** hata çıktı

Kardeş projelerin iş akışını örnek alıp web sunucusunu `npm exec vite --` ile
başlattım. Bu **dev sunucusunu** açar — kaynak modülleri anında dönüştürür —
yani testin konusu olan şey (derlenmiş paket, gerçek worker çözümlemesi,
gerçek asset yolları) hiç test edilmiyordu.

Belirti headless'ta tuhaftı: uygulama ya hiç render olmuyordu ya da tick 0'da
kalıyordu (`TİCK 0`, `SİSTEM ENERJİSİ 0 e`) ve sayfa konsolunda
`pageerror: Unexpected token ']'` çıkıyordu. **Worker hiç oluşmuyordu.**

Doğru çözüm: `vite preview` — `dist/` klasörünü sunar.

| Yapılandırma | Worker | Durum |
|---|---|---|
| `npm exec vite --` (dev) | oluşmuyor | ❌ sözdizimi hatası, dünya başlamıyor |
| `npm exec vite -- preview` | `assets/sim.worker-*.js` | ✅ **tick 160, 48 canlı, 109.550 e** |

Ayrıca öğrenilen: **worker içindeki hatalar sayfa konsoluna düşmez.**
`page.on('console')` ve `pageerror` bunları yakalamaz; `page.on('worker')`
kullanılmalı. Bu yüzden ilk teşhiste "hata yok" görünüyordu.

Bu iki bulgu, elle yapılan tarayıcı doğrulamasının neden güvenilmez olduğunu
gösteriyor: **ölü alet (bayat sekme) ve ölü hata raporu (worker hatası görünmez).**
Testle değiştirilen şey kanıtın kalıcılığı.

### 6.37 Bu proje **hiç yayınlanmamış**

Ölçüldü: depoda `.github/workflows/` yok, git geçmişinde deploy/hosting ile
ilgili **hiçbir commit** yok, `dist/` gitignore'da.

Karşılaştırma — `~/Documents/minimax/` altındaki kardeş projelerde:

| Proje | İş akışı |
|---|---|
| adp, agr, aia, aos, arl, **cld**, ctx, cul, cvl, … | `deploy-swa-<proje>.yml` (Azure Static Web Apps) |
| **ctm-aserdargun-com** | **yok** |

Yani bu proje, kardeşlerinin aksine **hiç dağıtılmamış**. Bu, kullanıcının
kalıcı kuralıyla (aserdargun statik projeleri her iş sonunda deploy edilir,
URL doğrulanır) çelişen bir eksiktir.

**Neden bu turda dağıtılmadı:** Azure SWA deploy iş akışı repo gizli
anahtarına bağlıdır
(`AZURE_STATIC_WEB_APPS_API_TOKEN_SWA_<PROJE>`). Bu anahtarı ve/veya ilgili
Azure kaynağını oluşturmak kullanıcının işi; sahte bir iş akışı eklemek
"dağıtıldı" izlenimi verirdi ve ilk çalıştırmada token hatasıyla düşerdi.

⚠️ **Yayınlanırken gözden geçirilmesi gereken mimari sınırlama:**
`server/index.ts` bir **Node sunucusudur** (gözlemci rotası). Azure Static Web
Apps **statik** barındırmadır; `/api/observer` orada çalışmaz. Yani yayınlanan
sitede gözlemci paneli yalnız yerel kural özetini üretir. Bu, kasıtsız
değil dürüstçe kabul edilmeli — panel bunu zaten yazıyor.

**Bu turda yapılan:** dağıtım öncesi kapılar kuruldu —
- e2e altyapısı: `npm run e2e` vardı ama **çalışmıyordu**; düzeltildi, 6 test yazıldı (§6.35–6.36)
- CI: `master` + PR'da tip + 202 birim + 6 e2e, **ubuntu'da yeşil** (§6.39, §6.40)

Yani proje yayınlanmaya hazır; eksik olan yalnız barındırma.

#### Kullanıcı kararı (2026-10-13): **yayınlama, sadece kayıtta kalsın**

İki yol sunuldu:

| seçenek | durum |
|---|---|
| Azure SWA iş akışı (aile kalıbı, `ctm.aserdargun.com`) | ⏸️ ertelendi — repo gizli anahtarı gerekiyor |
| `website_deploy` ile hemen herkese açık URL | ⏸️ ertelendi |
| Hiçbir şey yayınlama | ✅ **seçildi** |

Karar: **şimdilik yayınlama yok.** Bu bilinçli bir ertelemedir, bir eksik
değil; §6.37'deki tespit kayıtta duruyor ve koşullar sağlandığında tek adım
iş akışını eklemek.

> Not: Bu, kullanıcının kalıcı "her iş sonunda deploy et" kuralından bilinçli
> bir sapmadır ve burada kayıt altındadır. Erişilebilir olduğunda tek bir
> commit + push + URL doğrulaması yeterlidir; kod tarafında hiçbir şey eksik
> değildir.

### 6.39 CI eklendi — ve bayat rapor denetimi CI'da **ölü**ydü

CI iş akışı yazıldı (`master` + PR'da `npm run check` = tip + 201 birim + 6 e2e).
Yazarken bir şey dikkatimi çekti: **bayat rapor testi git'e dayanıyor** ve CI'da
`actions/checkout` varsayılan olarak **derinlik 1 (sığ klon)** ile gelir.

Ölçtüm. Gerçek bir sığ klon (`--depth 1 --no-local`, 1 commit):

| Sorgu | Sığ klon (1 commit) | Tam klon (19 commit) |
|---|---|---|
| `git log -1 --format=%ct -- package.json` (HEAD'de var) | HEAD zamanı | HEAD zamanı |
| `git log -1 --format=%ct -- ecology.ts` (**HEAD'de yok**) | **yine bir tarih** ❌ | önceki gerçek commit'in zamanı ✅ |

Yani sığ klanda yol filtresi **çalışmıyor**; sığ klonun sınırından bir tarih
dönüyor. Sonuç: bayat rapor denetimi CI'da **anlamsız** değerlerle koşar ve her
şeyi geçer görünür — yani o denetim orada sessizce ölürdü.

⚠️ İlk koruma denemesi de **başarısız oldu ve bu ölçülerek anlaşıldı**: "tarih
0 ise hata ver" yazdım. Sığ klon 0 değil, sığ sınırdan geçerli bir tarih
döndürdüğü için test yine sessizce geçti (8/8). Doğru tespit "depo sığ mı"
sorusudur, `git rev-parse --is-shallow-repository`.

İki düzeltme birlikte:
1. CI'da `fetch-depth: 0`.
2. Test artık sığ klonu **açıkça hata** ile reddediyor.

Sınandı — sığ klon koşulunda:

```
× rapor, üretim kodundan sonra yeniden üretilmiş
Error: Depo sığ klon (shallow): git yol filtresi güvenilir çalışmıyor …
   CI'da actions/checkout'a `fetch-depth: 0` ekleyin.
```

Tam klanda yeşil. Yani denetim artık iki koşulda da **gerçekten çalışıyor**.

> Ders: bir denetimin doğru çalıştığını "yeşil" olması kanıtlamaz —
> **kötü koşulda kırmızıya döndüğünü** görmek gerekir. Bu turda ikisi de ölçüldü:
> bayat rapor (kod değişti → kırmızı) ve sığ klon (geçmiş yok → kırmızı).

### 6.40 CI **düştü** — ve iki test tohuma kırılganmış

İş akışını push'tan sonra kontrol ettim (`gh run list`) — "yeşil olacak" diye
tahmin etmeyerek. Koşu **başarısız** bitti:

```
× Paylaşma mekaniği > sayaç gerçekten artabiliyor — REGRESYON KORUMASI
    AssertionError: expected 0 to be greater than 0
× Paylaşma mekaniği > eşiği düşürmek kolonileri çökertiyor — varsayılan en iyisi
    AssertionError: expected 0 to be greater than 0
```

201 testin 199'u geçti; **iki test yerelde yeşildi, CI'da düştü.**

#### Teşhis

Varsayılan paylaşma eşiğinde `transfers > 0` **her koşuda gerçekleşmiyor**.
10 tohum ölçüldü (macOS, yerel):

| eşik | `transfers > 0` olan tohum |
|---|---|
| **0,82 (varsayılan)** | **3/10** ❌ |
| 0,70 | 10/10 ✅ |
| 0,60 | 10/10 ✅ |
| 0,50 | 10/10 ✅ |

Test `seed: 3001` kullanıyordu ve 3001 **şanslı** bir tohumdu. Yerelde bütün
`npm run check` koşuları yeşildi; CI'da aynı test düştü çünkü yörünge orada
farklı bir yere gidiyor.

> Yani bu bir **platform determinizmi** bulgusu değil; testin **yanlış bir
> özellik iddia etmesi**. "Sayacın artabildiği" doğru ama "her zaman artabildiği"
> yanlış — ve test ikincisini ölçüyordu.

Zaman serisi de bunu gösteriyor (seed 3001): 1000 ve 2000 tick'te `transfers = 0`,
3000'te 2262'ye çıkıyor, sonra **12000 tick'te bile 2262** kalıyor.

#### Düzeltme

1. "Sayaç artabiliyor" testi artık mekanizmanın **güvenilir tetiklendiği** bir
   eşik (0,70) kullanıyor ve **beş tohumla** doğruluyor. Konusu mekanizma;
   ürünün varsayılan davranışını sınamıyor.
2. **Yeni dürüst sınır testi:** varsayılan 0,82'de paylaşmanın seyrek
   tetiklendiği artık **açıkça** ölçülüyor. "Paylaşma çalışıyor" iddiası
   böylece abartılmıyor.
3. "Eşiği düşürmek kolonileri çökertiyor" testinden kırılgan
   `dflt.transfers > 0` iddiası kaldırıldı; o testin konusu zaten koloni
   büyüklüğü.

> Not: `VALIDATION.md` §6.18 "eşiği düşürmek **zararlı**" diyordu ve bu ölçüm
> bunu **doğruluyor** (koloniler gerçekten daha küçük). Ama aynı eşiğin
> bir **etkinlik payı** de doğurduğu görülüyor: 0,82'de paylaşma çoğu koşuda
> hiç tetiklenmiyor, 0,70'te neredeyse her koşuda tetikleniyor. Bu, "paylaşma
> zararlı" ile "paylaşma neredeyse hiç çalışmıyor" arasındaki ayrım ve
> ayrıca incelenmeli.

#### Düzeltme 2 — CI ikinci kez düştü, ikinci bir yanlış iddia bulundu

Paylaşma sayacı testi düzeldi ve geçti; CI bu kez **başka** bir iddiada düştü:

```
× eşiği düşürmek kolonileri çökertiyor — varsayılan en iyisi
    AssertionError: expected 12 to be greater than 24
```

Bu test de **tek tohumla** yazılmıştı (`seed: 3001`) ve §6.18'in "eşiği
düşürmek zararlı" iddiasını tek koşuda garanti ediyordu.

Ölçtüm — 10 tohum, tepe küme büyüklüğü:

| tohum | 0,82 | 0,60 | kazanan |
|---|---|---|---|
| 3001 | 24 | 10 | 0,82 |
| 3002 | 6 | 6 | berabere |
| 3003 | 7 | 9 | **0,60** |
| 3004 | 24 | 11 | 0,82 |
| 3005 | 24 | 11 | 0,82 |
| 7 | 7 | 7 | berabere |
| 42 | 12 | 10 | 0,82 |
| 91 | 24 | 24 | berabere |
| 123 | 6 | 6 | berabere |
| 2026 | 12 | 16 | **0,60** |

| | ortalama tepe | medyan |
|---|---|---|
| **0,82 (varsayılan)** | **14,60** | 12 |
| 0,60 | 11,00 | 10 |

**Dürüst okuma:** "varsayılan en iyisi" **eğilim olarak** doğru (ortalama ve
medyan lehinde), ama **tek koşuda garanti değil** — varsayılan 10 tohumun 4'ünde
kazanıyor, 2'sinde kaybediyor, 4'ünde berabere.

§6.18'in rakamları (zirve 24'e karşı 10) **tek koşunun** sonucuydu ve genellenmiş
eğilim gibi yazılmıştı. Şimdi hem aralık hem ortalama paylaşıldı.

Test artık çok tohumlu ortalamayı iddia ediyor (sonuçtan önce sabitlenmiş ilk beş
tohum), tek bir şanslı tohumla değil.

#### Ders

İki test, iki ayrı yanlış iddia, ikisi de **tek tohumdan** geliyordu. Yerelde
yeşil olan bir test **taşınabilir** değildir: tek tohumla kurulan iddia, özelliğin
nadir gerçekleştiği ya da yönünün zayıf olduğu durumda şanslı koşuyla geçer ve
başka bir platformda düşer. CI'nin asıl katkısı yeni bir hata bulmak değil,
**yeşil olan ama yanlış olan** testleri ortaya çıkarmak oldu.

#### CI kapısı yeşile döndü — ölçülerek

```
success  |  İkinci yanlış test iddiası: "varsayılan en iyisi" tek tohumda garanti…
failure  |  CI düştü: iki test tohuma kırılganmış — düzeltildi
failure  |  CI eklendi — ve bayat rapor denetimi CI'da sessizce ÖLÜYDÜ
```

İlk iki koşu düştü ve ikisi de **yeşil görünen ama yanlış** testleri ortaya
çıkardı. Üçüncü koşu yeşil: tip denetimi + 202 birim + 6 tarayıcı testi CI'da
**ubuntu** üzerinde geçiyor.

Bu aynı zamanda `tests/docs.test.ts` bayat rapor denetiminin CI'da **gerçekten
çalıştığını** kanıtlar: `fetch-depth: 0` olmadan o denetim anlamsız
değerlerle geçiyordu; şimdi tam geçmişle koşuyor.

> Genel kural: kaotik bir sistemde tek tohumla kurulan test, özelliğin nadir
> olduğu ya da yönünün zayıf olduğu durumda **yanlış özellik ölçer**.
> Karşılaştırma iddiaları **çok tohumlu toplam** üzerinden yazılmalı —
> ya da, olgu seyrekse, "10 tohumun 3'ünde" biçiminde bir **oran**.

### 6.42 Tek tohumlu iddia taraması — kalan üç test **sağlam** çıktı

CI iki yanlış test buldu; kalan yerlerde de aynı sınıftan iddia var mı diye
tarama yapıldı. Üç şüpheli bulundu, üçü de **World** kurup tek tohumla
"en az bir kez oldu" diyen iddialar:

| test | ölçüm (10 tohum) | sonuç |
|---|---|---|
| bud-separation doğumu | 85–133 olay | ✅ 10/10 |
| yeni doğan (θ farkı sıfır) | 135–180 | ✅ 10/10 |
| öğrenen ebeveyn (karşılaştırılabilir) | 10–23 | ✅ 10/10 |

Üçü de **10/10 tohumda** tetikleniyor ve sınırın çok üstünde (pay geniş).
Yani CI'ın bulduğu iki test istisnaymış; geri kalanlar kırılgan değil.

Denetim notları teste içine yazıldı: gelecekteki okuyucu bunları yeniden
ölçmek zorunda kalmasın, ve "tek tohumlu" görünüp çürütülmüş sanılmasın.

> ⚠️ **Tarama sırasında bir ölçüm hatası yapıldı ve düzeltildi.** Üçüncü
> sütunu ölçerken yazdığım koşullu ifade (`seed === 4321 ? seed : 4321`) her
> zaman 4321 döndürüyordu; yani "10 tohumlu tarama" değil, **aynı tohumun on
> kez ölçümü**ydü ve sütun tohumdan bağımsız görünüyordu. Gerçek tarama
> yeniden yapıldı → 10/10.

Bu, projenin kendi disiplininin gereği: "geçici ölçüm de ölçümdür" —
yazılan şeyin ölçüldüğüğünden emin olmadan onu kanıt saymamak.

### 6.44 Paylaşma mekaniği varsayılan ayarda **etkisiz** — sert ölçüm

§6.40'ta "ayrıca incelenmeli" notu düşülmüştü. İncelendi.

**Yöntem:** Eşik, hiçbir hücrenin fiziksel olarak aşamayacağı **1,50**'ye
çekildi → paylaşma **matematiksel olarak imkânsız**. Bu kol, varsayılan
0,82 ile **aynı tohumlarda, aynı pencerede** karşılaştırıldı. Tek değişen
paylaşma eşiği.

> ⚠️ **Bu ölçüm birim testi değildir** ve ilk denemede yanlış yere kondu.
> 12 tohum × 2 kol × 8000 tick = 24 dünya koşusu vitest'in 120 sn test sınırını
> aşıyor ve CI'da `Error: Test timed out in 120000ms` olarak düştü. Doğru yer
> pipeline'dır: `experimentSharingEffect()` (`src/sim/experiments/ecology.ts`),
> `npm run experiments` içinde **26. bölüm**. Aşağıdaki sayılar oradan gelir.

12 tohum, 8000 tick, `strainK 0,005`:

| eşik | tetiklenen | ort. aktarım | ort. **tepe** | medyan | min–max |
|---|---|---|---|---|---|
| **0,82 (varsayılan)** | **3/12** | 538 | **15,00** | 12 | 6–24 |
| 1,50 (imkânsız → kapalı) | 0/12 | 0 | **15,00** | 12 | 6–24 |
| 0,70 | 12/12 | 3167 | 14,92 | 16 | 6–24 |
| 0,60 | — | — | 11,08 | 10 | 6–24 |
| 0,50 | — | — | 7,08 | 6 | 5–11 |

**Eşleştirilmiş fark (0,82 − imkânsız): tepe koloni farkı [0, 0].** 12 tohumun
hiçbirinde fark yok — paylaşma 3 tohumda **gerçekten** tetiklenmiş (2262,
2272, 1918 aktarım) olmasına rağmen tepe büyüklüğü değişmemiş.

Son popülasyonda fark yalnız tetiklenen 3 tohumda görüldü: +20, −1, +2.

> **Sonuç: varsayılan ayarda enerji paylaşması koloni yapısını ölçülebilir
> biçimde değiştirmiyor.** Mekanizma çalışıyor (aktarım sayısı artıyor) ama
> sonucu değiştirmiyor.

### 6.46 Ölü mekanizma denetimi — **6 olay türü hiç üretilmiyordu**

Paylaşmanın ölü çıkması şu soruyu açtı: **başka hangi mekanizmalar gerçekten çalışıyor?**

Ölçüm: 5 tohum × 8000 tick, olay günlüğündeki türlerin sayımı.

| olay türü | toplam | tetiklenen tohum |
|---|---|---|
| `learning-update` | 7.088 | 5/5 |
| `cell-division` | 708 | 5/5 |
| `death` | 603 | 5/5 |
| `fragmentation` | 538 | 5/5 |
| `bond-formation` | 413 | 5/5 |
| `bud-separation` | 302 | 5/5 |
| `predation` | 263 | 5/5 |
| `bond-break` | 85 | 5/5 |
| `organism-birth`, `nutrient-added`, `experiment-start`, `experiment-end`, `branch-created`, `save-loaded` | **0** | **0/5** |

Üretici taraması altısını da doğruladı: `src/` ağacında **sıfır `pushEvent`**,
ve UI/deney tarafında **sıfır tüketici**.

**Bu bir boşluk değil, ölü beyan.** Doğumlar zaten `bud-separation` ile
kaydediliyor; besin ekleme (`addNutrient`) ve dal oluşturma ise
`World.recordIntervention()` kanalına yazılıyor — kanıt paketi
(`evidence.ts`) o kanaldan okuduğu için **kanıt izinde eksik yok**. Boş olan
yalnız `SimEventType` birleşimindeki altı isimdi.

> Sınıf: bu, projede üçüncü "ölü alet" örneği (§6.20 sayaç, §6.23 eksen,
> §6.46 bildirim). Üçü de **çalışma zamanında görünmez**; üçü de "yanlış özellik
> ölçme" ya da "kalıcı olarak boş dinleyici" üretiyor.

#### Düzeltme ve kalıcı koruma

1. Altı ölü beyan `SimEventType`'tan **kaldırıldı** — liste artık gerçeği
   birebir yansıtıyor (10 tür).
2. `tests/events.test.ts` (3 test) kalıcı koruma sağlıyor:
   - her bildirilen türün **en az bir üreticisi** var mı,
   - testin bildirdiği küme, kaynaktaki `SimEventType` ile aynı mı,
   - `pushEvent` gerçekten kullanılıyor mu.

Denetleyici **doğrulandı**: yazıldığında kırmızı döndü ve altı ölü türü adlarıyla
söyledi; beyanlar temizlenince yeşile döndü. Yani ileride yeni bir tür eklenip
bağlanmazsa CI onu yakalar.

### 6.47 Ölçüm anahtarı denetimi — **temiz sonuç** (olay türü değil)

§6.46'daki denetimin ikinci kategorisi: beyan edilen **ölçüm anahtarları**
(`metricRef`).

Ölçüm: `evidence.ts` 15 anahtar üretiyor. Bunların kaçı gerçekten tüketiliyor?

| | anahtar sayısı |
|---|---|
| üretilen (`push(...)`) | 15 |
| **adıyla** okunan (`metric('…')`) | 7 |
| adıyla okunmayan | 8 |

Adıyla okunmayanlar: `systemEnergy`, `externalInput`, `dissipatedEnergy`,
`tick`, `simTime`, `organismCount`, `meanCellEnergy`, `maxGeneration`.

**Sonuç: ölü bildirim YOK.** Bu anahtarlar `verifyNumericClaims` tarafından
**genel olarak** geziliyor (tüm `measurements` dizisini tarıyor) ve kanıt paketi
tablosunda listeleniyor. Yani hepsi ürün yüzeyine ulaşıyor.

> **Denetimin kendisi de denetlendi:** `systemEnergy` anahtarını bilerek
> bozduğumda test **kırmızı** döndü, geri alınca yeşile döndü. Metin taramasıyla
> değil, **çalıştırarak** doğrulandı.

Bu, önemli bir ayrım: §6.46'daki ölü beyan sorunu **sistemik değil, olay
türlerine özgüydü**. Aynı denetimi diğer kategorilere uygulamak doğru bir adımdı
ve **negatif sonuç** üretti — yani tarama rastgele değil, seçici.

### 6.49 README'deki elle yazılmış sayılar bayatlamıştı

Aynı sınıf sorunun üçüncü hâli: **belgede elle yazılmış sayı** üretim
çıktısından kopuyor. Taramada bulunanlar:

| README'de | gerçek |
|---|---|
| "(56.159 koşu)" | **1.921** koşu |
| "25 bölüm, 1.921 koşu" | **26 bölüm** |
| "Vitest — 201 test" | **211** test |

Üçü de "makul görünen" yanlış sayılar — 56.159 koşu bile bir yerde gerçekmiş
gibi duruyordu.

#### Düzeltme ve kalıcı koruma

README'deki sayılar **kaynağa bağlandı**: koşu ve bölüm sayısı
`docs/EXPERIMENTS.md` başlığından okunuyor (rapor yeniden üretildiğinde değer
kendiliğinden güncellenir), test sayısı ise `tests/` dizinindeki gerçek `it(`
satırlarından sayılıyor.

#### Bu işi yaparken üçüncü bir hata — ölçüm aracı **kendi dokümanını sayıyordu**

İlk tarama regex'i `\bit\(` idi ve 213 dedi; gerçek sayı 211. Fark 2: **test
dosyasının kendi açıklama yorumları** `it('…')` kalıbını içeriyordu ve
tarayıcı onları test sayıyordu.

> Yani düzeltmeye çalıştığım şeyin ta kendisi bu sınıftaydı: bayatlamayı
> yakalamak için yazılan ölçüm aracı, **kendi yorumunu kanıt sayıyordu.**
> Düzeltme: satır başı girinti zorunlu (`^\s+it\(`) — yorumlar eşleşmiyor.

Ayrıca ilk denetim "makul aralık"a bakıyordu (sayı ≥ dosya sayısı) ve bu,
sayının bayatlamasına **izin veriyordu**. Denetim kaynağa bağlandı.

### 6.51 README "Beş unsur" tablosu ölçümle **çelişiyordu**

Aynı dosyanın **içinde** iki tablo birbirine zıt konuşuyordu:

| yer | iddia |
|---|---|
| sonuç tablosu | "Yaşam içi öğrenme → davranış \| **❌ etki yok** (p = 0.333)" |
| "Beş unsur" tablosu | "Gerçek ANN ile öğrenme \| **✅ çalışıyor**, gradyan test edildi" |

İkisi de teknik olarak doğru, ama okuyucuya **çelişkili** geliyor. Gerçek
durum: *mekanizma çalışıyor, **sonuç üretildiği gösterilmemiş**.*

Aynı sınıf hata — ölçülmemiş bir şey varmış gibi sunulması — bu kez
**durum işaretinde**. Üç satır düzeltildi:

| unsur | eski | yeni |
|---|---|---|
| Tek hücreli → çok hücreli | ✅ çalışıyor | ⚠️ mekanizma çalışıyor, koloniler uzun vadede sönümleniyor |
| Kalıtım, mutasyon, uyarlanma | ✅ çalışıyor | ⚠️ uyarlanma **gösterilmedi** (p = 0.097) |
| Gerçek ANN ile öğrenme | ✅ çalışıyor | ⚠️ ağırlıklar değişiyor ama **davranışa etkisi yok** (p = 0.333) |

Test yazarken **iki denetim hatası** yapıldı ve ikisi de ölçüldü:
1. Bölüm ayrıştırması (`indexOf`) yanlış bloğu aldı.
2. Anahtar kelime filtresi önce **meşru** değişmez kontrolleri ("Öğrenme
   kapalıyken ağırlıklar sabit \| ✅"), sonra **ölçülmüş kazanımları**
   ("Evrim Atölyesi \| ✅") yakaladı.

Doğru yaklaşım: **yasaklanan satırları birebir** adlandırmak — hem daha
sağlam, hem de neyi neden yasakladığını kendisi anlatıyor.

### 6.52 Bayatlık ve abartı sınıfları — genel tablo

Bu seansta bulunan dört sınıf, hepsi aynı kökten: **beyan edilen ile gerçekte
olan arasındaki fark zorlanmıyordu.**

| # | sınıf | örnek | durum |
|---|---|---|---|
| 1 | hiç artmayan sayaç | `sharingPhase()` sayacı | test `toBe(0)` yüzünden yeşildi |
| 2 | ölçülemez alet | niş ölçümü hız ekseni | tüm gözlemler tavana kırpıldı |
| 3 | ölü beyan | 6 olay türü | hiç üretilmemiş, sıfır tüketici |
| 4 | bayat sayı / abartı | README'de 56.159 koşu, "✅ çalışıyor" | kaynağa bağlandı, satırlar düzeltildi |

Dördü de artık CI'da zorlanıyor.

| denetim | bulgu | durum |
|---|---|---|
| olay türleri (`SimEventType`) | 16 beyan, **6 ölü** | kaldırıldı + test |
| ölçüm anahtarları (`metricRef`) | 15 beyan, 0 ölü | test |
| README elle yazılmış sayılar | **3 bayat** | kaynağa bağlandı + test |

| kategori | beyan | ölü bulunan | durum |
|---|---|---|---|
| olay türleri (`SimEventType`) | 16 | **6** | ✅ kaldırıldı, testle korunuyor |
| ölçüm anahtarları (`metricRef`) | 15 | 0 | ✅ zaten sağlıklı, testle korunuyor |
| protein mimarisi (kod) | — | — | kapsam dışı |

### 6.50 Ölü beyan denetimi — özet tablosu

| kategori | beyan | ölü bulunan | durum |
|---|---|---|---|
| olay türleri | 16 | 6 | kaldırıldı, testle korunuyor |
| ölçüm anahtarları | 15 | 0 | zaten sağlıklı, testle korunuyar |

### 6.53 Protokol denetimi — **5 bağlanmamış üyə**

§6.46'daki denetimin dördüncü kategorisi: `Command` ve `WorkerResponse`
birleşimleri.

Ölçüm — her üyenin üreticisi (gönderilen komut / gönderilen yanıt) ve
tüketicisi (işleyen `case`) sayıldı:

| üye | tür | durum |
|---|---|---|
| `listEvents` | komut | ⚠️ **hiç çağrılmıyor** |
| `events` | yanıt | ⚠️ **hiç işlenmiyor** |
| `ping` | komut | ⚠️ istemci hiç göndermiyor |
| `pong` | yanıt | ⚠️ hiç işlenmiyor |
| `ack` | yanıt | ⚠️ gönderiliyor ama hiç okunmuyor |

`App.tsx` şu yanıtları işliyor: `decision`, `error`, `evidence`,
`evolutionProgress`, `evolutionResult`, `frame`, `lifeMapResult`, `lineages`,
`organisms`, `ready`, `snapshot`.

#### En somut olanı: olay günlüğü arayüze hiç bağlanmamış

`SimClient.listEvents()` var, komutu gönderiyor; worker `events` yanıtını
üretiyor — ama **hiçbir yerden bu komut çağrılmıyor** ve **hiçbir yerde
`events` yanıtı işlenmiyor.** Yani simülasyonun olay günlüğü (7.088 öğrenme
güncellemesi, 603 ölüm, 302 tomurcuk ayrılması…) üretiliyor ve kayboluyor.

> ⚠️ Ölçüm sırasında bir kendi yanlışımı düzelttim: ilk tarama
> `experimentResult`'ı tüketicisiz saydı, oysa `App.tsx` işliyor. Filtre
> yeniden incelendi; sonuç yukarıdaki.

Bu bir **ürün kararı** gerektiriyor: ya olay günlüğü arayüze bağlanır,
ya da `listEvents`/`events` kaldırılır. `ping`/`pong` bir sağlık kontrolü
çiftidir ve hiç bağlanmamıştır; `ack` ise genel altyapıdır ve okunmaz.

**Karar kullanıcıya bırakıldı** — bu turda ürün yüzeyi değiştirilmedi.

### 6.55 Faz B3 · **İşbirliği aktı** — mekanizma çalışıyor, kazancı yok

Paylaşmanın ölü çıkmasından sonra (bkz. §6.44) eklendi. Paylaşmadan farkı
şu: paylaşma **genomdan** geliyordu (hücre düzeyinde çeşitlilik yok, hileci
tanımsız); burada bağ bütünlüğü eşiğin altına düşünce **bağın iki ucundaki
hücreler birlikte** enerji harcayarak bağı yeniler. Bedel **ortak** olduğu için
ödemeyen hücre de yararlanır — yani **hileci artık tanımlanabilir**.

Kanca `coopRenewal > 0` iken etkin; **varsayılan 0 = kapalı**.

#### Ölçüm (12 tohum, 8000 tick, eşleştirilmiş, k = 0,002)

| ölçüm | sonuç | yorum |
|---|---|---|
| **son bağ sayısı farkı** | ort **+11,4** | akt bağları sona kadar yaşatıyor |
| **tepe bağ sayısı farkı** | ort **+0,6** | ⚠️ **bağlar zirvede zaten bol** |
| **tepe küme farkı** | p ≈ 0,85 | ❌ koloni kazancı yok |

Tek kutu sayısı: 8 tohumda artış yok, 2 artış, 2 düşüş. Maliyet önemsiz:
işbirliğine harcanan 15,7 e, toplam erimiş 57.734 e'nin binde 0,3'ü.

> ⚠️ İlk yorum ("mekanizma çalışıyor") **eksik**ti: ölçtüğüm +12,5 koşu
> **sonundaki** bağ sayısıydı, tepe değil. Tepe bağ sayısı neredeyse aynı.
> Tam teşhis: **§6.57**.

**Kapalıyken ürün davranışı bit düzeyinde aynı** (ölçüldü: iki koşunun enerjisi
5807.873723 = 5807.873723, bağ 71 = 71).

#### ⚠️ Kendi kendini çürüten bir ölçüm

İlk ölçüm **ortalama** tepe artışı bildirdi (14,50 → 16,13, "+%11") ve ben
önce "başarılı" diye yazdım. **Eşleştirilmiş ölçüm bunu çürüttü:** tohum başına
farklar [-5, +11], yalnız 4/10 artıyor.

> **Ders: ortalama tek başına kanıt değildir.** Dağılım tutarlı değilse kazanç
> iddiası kurulamaz. Bu, `VALIDATION.md` §5.11'deki "tek pencereye bağlı sonuçlar
> genellenmez" ilkesinin yeni bir örneği — ve bu sefer tuzak **benim** kendi
> ölçümümdü.

#### Mekanizmanın karakteri: **geç uyanır**

Bağ bütünlüğü ~0,9'dan yavaş düşüyor ve eşik (0,28) ancak geçiliyor:

| tohum | 2000 tick | 4000 tick | 8000 tick |
|---|---|---|---|
| 11 | 0 yenileme | 0 | **40.969** |
| 3001 | 0 | **1.354** | 82.993 |
| 42 | 0 | 1.100 | 74.806 |

Testte erken pencere seçilip "mekanizma çalışmıyor" sanılmıştı; **kod doğruydu,
test koşulu yanlıştı.**

### 6.56 Hileci tanımı — yapısal olarak tanımlı, deneysel olarak sınanmadı

(Bu bölüm §6.58 ile güncellendi: kullanıcı kararıyla genom parametresi
**eklendi**, dolayısıyla hileci artık seçilebilirdir. Sonuç: seçilim yön vermedi.)

### 6.58 `genome.cooperation` eklendi — hileci artık **seçilebilir**

Kullanıcı kararıyla genoma **dokuzuncu** parametre eklendi.

| zincir | değişiklik |
|---|---|
| `types.ts` | `Genome.cooperation: number` (0..1) |
| `genome.ts` | `GENOME_BOUNDS`, `MUTATION_SCALE`, `founderGenomes` (0,5), boş ortalama |
| `energy.ts` | `COOPERATION_COST_K = 3,2e-3` → `basalCostFor` |
| `world.ts` | yenileme katılımı `genome.cooperation` ile ölçeklenir |

#### Neden metabolik maliyet şart

Proje kuralı: **hiçbir özellik bedelsiz avantaj sağlamaz.** İşbirliği bedelsiz
olsaydı, düşük işbirliği her zaman kazanırdı (aynı fayda, daha az maliyet) ve
"hileci" deneyi anlamsızlaşırdı.

Ölçüldü: kurucu `cooperation ≈ 0,57` → metabolik maliyet **bazalin %26'sı**.
Yani bedelsiz değil, ihmal de edilemez.

#### "Hileci" nasıl tanımlandı

Düşük `cooperation` = daha az öder, ama bedel **ortak** olduğu için
yenilenen bağlardan aynı ölçüde yararlanır. Yani hileci, ödeyen kardeşinin
yararına bedelsiz binen hücredir.

#### Ölçülen seçilim sonucu: **yön yok**

3 tohum, 16.000 tick, ak açık ve ak kapalı kollar:

| | ak açık | ak kapalı |
|---|---|---|
| başlangıç ort. işbirliği | ~0,494 | ~0,494 |
| bitiş ort. işbirliği | ~0,487 | ~0,486 |
| kayma | **−0,007** | **−0,008** |

Değişim min 0,26 · maks 0,60–0,69 aralığında kaldı: **çeşitlilik var ama yön
yok.** Bu, "mutasyon + seçilim → uyarlanma"nın sonuçsüz olduğu eski bulgusuyla
(p = 0,097, ~3 nesle yetmiyor) tutarlıdır.

> **Değişikliğin bedeli:** yeni parametre metabolik bütçeyi değiştirdiği için
> **tüm deney ölçümleri geçersizleşti** ve baştan koşuldu. Bu, parametre
> eklemeden önce söylenen riskti; kabul edildi.

### 6.59 Varsayılan davranış korundu mu

Kanca **hâlâ kapalı** (`coopRenewal = 0`): iki koşu bit düzeyinde aynı
(enerji 6399.903235 = 6399.903235, bağ 70 = 70) ve enerji korunumu 0.

> Dikkat: `COOPERATION_COST_K` **her koşuda** aktiftir — yani ürünün enerji
> bütçesi değişti. Bu kasıtsız değil, parametrenin tanımı gereği; ama
> "ürün davranışı bit düzeyinde aynı" iddiası yalnız **yenileme kancası**
> için geçerlidir, genom değişikliği için değil.

### 6.60 Parametre değişikliğinin ölçümlere etkisi — **iki bulgu**

Beklenen bedel gerçekleşti: iki test düştü ve ikisi de **test hatası değil,
gerçek sonuçtu**.

#### (a) Koloni sönümlenmesi **geçti**

| pencere | collapseTick | zirve | çöküş |
|---|---|---|---|
| 12.000 | **null** | t2400: küme 7 | — |
| 20.000 | **13.400** | t2400: küme 7 | t13400: küme 1 |
| 30.000 | 13.400 | t2400: küme 7 | t13400: küme 1 |
| 40.000 | 13.400 | t2400: küme 7 | t13400: küme 1 |

Sönümlenme **kaybolmadı, geçti.** Yeni enerji bütçesi kolonilerin biraz daha
uzun dayanmasını sağlıyor. Testin penceresi 12.000 → 20.000'e çıkarıldı.

> Bu, §5.12–5.16'daki uzun vadeli bulguların da **yeniden ölçülmesi**
> gerektiği anlamına gelir: 12.000 tick'lik pencereler artık sönümlenmeyi
> göremiyor.

#### (b) Hız ekseninde 2 gözlem tavana kırpılıyor

Kalibrasyon **yeniden koşuldu** (yeni genom):

```
hız (yol uzunluğu/tick): p50=0,0626 · p99=0,0948 · p99,9=0,1038 · maks=0,1117
→ NICHE_SPEED_MAX = 0,120 geçerli (gözlenen maksın üzerinde)
```

Yani sınır doğru; 5 tohumluk kalibrasyonda görülmeyen bir uç değer var. Test
`clamped === 0` gibi **kırılgan bir mutlak** koyduğu için düştü.

Düzeltme: mutlak yerine **oran** denetleniyor (`kırpılan / toplam < %1`).
Bu, §6.40'ın öğrettiği dersin aynısı: "nadir" olan bir özelliği `0` gibi
garanti etmek yanlıştır.

#### Yeniden ölçüm gerekenler

Genom değişikliği **tüm deney paketini geçersizleştirdi**; `npm run experiments`
baştan koşuldu. Özellikle 12.000 tick'e dayalı bütün sonuçlar yeniden
yorumlanmalı — sönümlenme artık o pencerenin dışında kalıyor.

#### #### İkinci ölü ölçüm kapsamı: `genomeSignature`

`genomeDistance` düzeltilirken tarama yapıldı ve **ikinci** bir elle liste
çıktı: `genomeSignature()`, yani **benzersiz genom / çeşitlilik** sayımı.

Bu ölçümün etkisi doğrudan ölçüldü (12.000 tick, canlı organizmalar):

| tohum | 8-parametreli imza | 9-parametreli imza (doğru) |
|---|---|---|
| 11 | 61 benzersiz | **62** |
| 3001 | 50 | 50 |
| 42 | 58 | **60** |

Yani çeşitlilik **sistematik olarak küçük hesaplanıyordu** — `cooperation` farkı
olan iki organizma "aynı genom" sayılıyordu. Aynı sınıf, aynı sessizlik:
ölçüm çalışıyor, sayı üretiyor, p-değeri hesaplıyor, yalnız kapsamı eski.

#### Koruma ve dedektörün kendi hatası

`tests/measurement.test.ts` artık elle listeleri reddediyor. **Koruma yazarken
üç kez yanlış pozitif ürettim** ve ölçütü her seferinde daralttım:

1. "satırda ≥3 parametre" → `Pick<Genome,…>` (tip kısıtı) ve genom nesne
   literalinin alanları. Meşru — **değer yazmak** zorundayız.
2. "parametre iki kez geçiyor" → `const plasticity = K * genome.plasticity`.
   Meşru — orada **tek** parametre var.
3. Doğru ölçüt: aynı parametrenin **farklı alıcılarda** karşılaştırılması
   (`a.plasticity` + `b.plasticity`) — yani bir çiftin tüm üyelerini tek tek
   sayan elle liste.

#### Üçüncü ölü kapsam: **i18n genom etiketleri kullanıcıya görünüyordu**

`GENOME_LABELS_TR/EN` bir zamanlar `Record<string, string>` idi — **gevşek
tip**. `cooperation` eklendiğinde etiketi yazılmadı, derleyici **sessiz**
kaldı ve soy defteri panelinde o parametrenin satırı **boş** göründü.

Bu, sınıfın en "zararsız görünen" hâli: derleme yeşil, testler yeşil, ekran
büyük ölçüde doğru — yalnız **bir satır boş**.

Düzeltme: tip `Record<GenomeKey, string>` yapıldı ve `cooperation` etiketleri
eklendi (`İşbirliği` / `Cooperation`). Sıkı tip, tüketim yerlerindeki darboğazı
da ortaya çıkardı (`Object.entries` indekslemesi `string` ile yapılıyordu) ve o
noktalar `GenomeKey` ile işaretlendi.

Doğrulama: `cooperation` etiketi geçici olarak silindi → **derleme hatası**;
geri alındı → temiz. Artık eksik etiket sessizce geçmiyor.

> **Genel kural:** bir sözlük/harita için `Record<string, X>` kullanma. Anahtar
> kümesi kesin biliniyorsa (`GenomeKey`, `SimEventType`) tipi **o küme** yap;
> eksik üye o zaman **derleme hatası** olur.

> Bir denetleyicinin "tutarlı" olması yetmez; **kötü durumda neyi yakaladığını**
> bilmelisin. Her yanlış pozitif, ölçütün yanlış olduğunun kanıtıdır.

| bulgu | yeni genomle |
|---|---|
| Paylaşma varsayılan ayarda etkisiz | ✅ **ayakta** — 12 tohumun hepsinde fark 0 (ort. tepe 14,58 = 14,58) |
| Koloni sönümlenmesi | ⚠️ **geçti** — 13.400 tick (12.000'de görünmüyor) |
| Hız ekseni kalibrasyonu | ✅ geçerli — gözlenen maks 0,1117, tavan 0,120; 2 uç gözlem nadir |

#### Doğrulama: hangi bulgular ayakta kaldı?

Hilecin varlığı **kavramsal** olarak tanımlıdır: bedeli ödemeyen hücre de
organizmanın yenilenmiş bağlarından yararlanır. Ancak **kalıtsal değil** —
ölçülebilir çeşitlilik için genoma parametre eklemek gerekir ve bu, tüm
önceki ölçümleri geçersizleştirir. Kullanıcının kararına bırakıldı.

### 6.57 Neden işe yaramadı — **ölçtüğüm sayı yanlış yeri gösteriyormuş**

Negatif sonuç yetmez; **niye** sorusu ölçülerek yanıtlandı ve ölçüm bir
şeyi yanlış gösteriyormuş.

#### Önce bir ölçüm hatası bulundu ve düzeltildi

Teşhisi rapora eklerken deneyin `run()` fonksiyonunda **döngü iki kez
kopyalanmıştı**: dünya 8000 yerine **16.000 tick** işliyordu ve "tepe bağ
sayısı" koşunun **ikinci yarısından** geliyordu. Raporda "tepeBağ farkı 12,8"
yazıyordu — o sayı aslında **son** bağ farkıydı.

Belirti: bağımsız ölçüm betiğim **0,4** derken rapor **12,8** diyordu. İki
ölçümün uyuşmaması aramayı başlattı. **Raporu şüpheliye alan** taraf kazandı.

Düzeltilmiş ve yeniden üretilmiş ölçüm:

| | kapalı (ε = 0) | açık (k = 0,002) |
|---|---|---|
| **son** bağ sayısı | 36,6 | 48,0 (**+11,4**) |
| **tepe** bağ sayısı | **110,4** | **111,0** (+0,6) |
| tepe küme | 15,00 | 14,33 |
| tepe popülasyon | 286,9 | 286,6 |
| ortalama hücre enerjisi | 29,94 | 29,80 |
| **işbirliğine harcanan** | **0** | **15,7 e** |
| erimiş enerji (toplam) | 57.734 | 57.734 |

Önceki bölümde "bağ farkı **+12,5**, p = 0,0001 → mekanizma çalışıyor"
yazmıştım. Bu sayı **koşu sonundaki** bağ sayısıydı. **Zaman içindeki tepe bağ
sayısı neredeyse aynı** (104,7 → 105,1).

> **Yani akt, koloninin zirvelendiği anda değil, sonradan boşalan yerde işe
> yarıyor.** Koloni büyürken bağlar zaten bol; akt o anda hiçbir şey kazandırmıyor,
> çünkü ihtiyaç duyulmuyor.

#### Maliyet de önemsiz

İşbirliğine harcanan 15,7 e, toplam erimiş enerjinin (57.734) binde 0,3'ü.
Yani akt hem **ucuz** hem **işe yaramaz** — zarar da vermiyor, fayda da etmiyor.

Bu, hileci için genom parametresi kararını da değiştirir: **seçilebilir bir
işbirliği eğilimi eklemek, hiçbir şey kazandırmayan bir davranışı seçilebilir
kılırdı.** Parametre eklemenin maliyeti (tüm ölçümlerin geçersizleşmesi) bu
yüzden bir kazana karşılık getirmiyor. Karar kullanıcıya bırakıldı.

Hilecin varlığı artık **kavramsal olarak** tanımlı: bedeli ödemeyen hücre de
organizmanın yenilenmiş bağlarından yararlanır.

⚠️ **Ama ölçülmedi.** Hilecin **kalıtsal** olması için genoma bir parametre
eklenmesi gerekiyordu (o sırada genomda 8 parametre vardı) — §6.58'de eklendi.
Bu, modelin biyolojisini değiştiren bir adımdır ve **kullanıcının kararına**
bırakıldı. Şu an ölçülen şey aktının kendisi, hilecin değil.

### 6.45 §6.18'in iddiası **düzeltildi** — yönü doğru, gerekçesi yanlış

§6.18 diyordu: *"eşiği düşürmek zararlı, varsayılan en iyisi"* ve bunu
**3 tohumla** destekliyordu (zirve 24'e karşı 10).

Çok tohumlu ölçüm **yönü doğruluyor** ama iki düzeltme getiriyor:

| | §6.18 (3 tohum) | 12 tohum |
|---|---|---|
| 0,82 → zirve | 24 | **15,00** |
| 0,60 → zirve | 10 | **11,08** |

1. **Rakamlar tek koşunun sonucuydu.** Gerçek fark 24 → 10 değil, 15,00 → 11,08.
   Etki **yönü** anlamlı ama büyüklüğü çok daha küçük.
2. **Gerekçe değişiyor.** "Paylaşma zararlı" değil, **çok düşük eşik enerjiyi
   sürekli çekiyor**. Çünkü:

| eşik | paylaşma sıklığı | ort. tepe |
|---|---|---|
| 0,82 | 3/12 (seyrek) | 15,00 |
| 0,70 | **12/12 (daima)** | **14,92** |

Paylaşma **daima** çalışırken bile tepe 14,92 — yani etkisiz. Sadece 0,60'ın
altına inildiğinde (0,60 → 11,08, 0,50 → 7,08) zarar başlıyor. Yani suçlu
"paylaşmanın kendisi" değil, **enerjiyi sürekli boşaltan eşik**.

> Düzeltilen karar: Eşiği 0,82'de tutmanın gerekçesi *"paylaşma zararlı"* değil.
> Doğru gerekçe: *"paylaşma bu modelde zaten etkisiz; düşük eşik onu zararlı
> hale getiriyor."* Kararın kendisi (0,82'de kal) aynı, gerekçesi düzeldi.

Bu bulgu doğrudan **işbirliği aktı** kararını da aydınlatıyor: paylaşma
şu an ölü bir mekanizma; eklenecek gerçek işbirliği aktı "çalışan bir şeyi
değiştirmek" değil, **ölü bir mekanizmayı etkinleştirmek** olur.

| iş | sonuç |
|---|---|
| CI eklendi | ✅ `master` + PR'da tip + 202 birim + 6 e2e |
| `fetch-depth` tuzağı | ✅ bulundu, `fetch-depth: 0` ile kapatıldı |
| iki yanlış test iddiası | ✅ bulundu (paylaşma sayacı, varsayılan eşik) |
| kalan tek tohumlu iddialar | ✅ tarandı, 3/3 sağlam çıktı |
| üçüncü CI koşusu | ✅ yeşil (ubuntu) |
| paylaşmanın varsayılan ayardaki etkisi | ⚪ **ölçülebilir etki yok** (§6.44) |
| §6.18 iddiası | 🔄 **düzeltildi** — yön doğru, rakam ve gerekçe değişti (§6.45) |

### 6.38 Belgeler gerçekliğe hizalandı

Ölçümler geldi, **belgeler geride kalmıştı**. Üç yanlış iddia düzeltildi:

| Belge | Önceki iddia | Gerçek |
|---|---|---|
| `ROADMAP.md` | Faz D "çeşitlilik çöküşünü tek hamlede çözer" | ❌ harita dolmadı (p = 1,0000) |
| `ROADMAP.md` | D kapanış kriteri: "yaşam haritası doluyor" | ❌ gerçekleşmedi, gerekçesi ölçüldü |
| `PROGRESS.md` | S-4 "yeni açıldı", çatallama kısıtı kaldırdı | ❌ S-4 denendi ve **başarısız** (p = 1,0000) |

`VALIDATION.md` §9'a iki yeni madde eklendi: ε>0'un başarısızlığı ve
gözlemcinin gerçek sağlayıcı çağrısının yapılmamış olması.

### 7.1 `branch` yolu uçtan uca doğrulandı

Bu, §6.8'de bulunan ve düzeltilen `fromState` hatasının **gerçek üründe**
çalıştığının kanıtıdır. Üç regresyon testi yeşil olmak yetmezdi; buton
tıklandı ve davranış tarayıcıda gözlemlendi.

Tarayıcı doğrulaması sırasında bulunan ikinci küçük kusur: `/favicon.ico`
404'ü (konsoldaki tek hata). `index.html`'e gömülü SVG favicon eklendi; istek
başına dosya okunmuyor ve konsol **tamamen temiz**.

Tarayıcıda doğrulanmayanlar: mikroskop panelinin etkileşimi, JSON içe/dışa
aktarma, IndexedDB kaydet/yükle, gözlemci panelinin model çağrısı. Bunlar
**test edilmedi** (§9).

## 8. Gözlemci sunucusu

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

## 9. Doğrulanmayanlar — açıkça

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
7. ~~**Dal bağımsızlığı.**~~ ✅ **ÇÖZÜLDÜ — ve gerçek bir hata bulundu.**
   `branch` **hiç çalışmıyordu**: `World.fromState` `Object.create(World.prototype)`
   kullandığı için constructor çalışmıyor, sınıf alan başlatıcıları hiç
   çalışmıyor, `ledger` `undefined` kalıyor ve ilk erişimde TypeError atılıyordu.
   Düzeltildi, üç regresyon testi eklendi, dalların bağımsız ve bit düzeyinde
   aynı ilerlediği **ölçüldü** ve çatallamanın ucuz olduğu gösterildi
   (§6.7–6.10).
8. **Erişilebilirlik denetimi.** Klavye gezinme, görünür odak, `aria` işaretleri
   kodda var; ekran okuyucu ile uçtan uca denendi ama **sistematik test yapılmadı**.
9. **Çapraz cihaz determinizmi.** Test edilmedi, vaat edilmiyor. Bu nedenle
   tüm deneyler §4 **Node'da** koşuyor; tarayıcıda tohumlu istatistik üretilmiyor.
   ⚠️ **Kısmi kanıt (§6.40):** CI ilk koşusunda iki test düştü. Teşhis: platform
   determinizmi değil, **testler tohuma kırılganmış** — varsayılan paylaşma
   eşiğinde özellik yalnız 10 tohumun 3'ünde gerçekleşiyor ve test şanslı bir
   tohumla geçiyordu. Testler sağlamlaştırıldı; ancak **yörüngelerin platformlar
   arasında bit düzeyinde aynı olduğu hâlâ ölçülmedi.** Rastgele erişimli bir
   testin başka platformda düşmesi, yörüngenin orada ayrışmış olabileceğinin
   dolaylı işaretidir; bu tesadüf de olabilir ve **ayrıştırılmamıştır.**
10. **Tarayıcıda deney paneli.** Deney motoru headless Node'da çalışıyor; worker
    komutlarıyla tarayıcı içinden tetiklenen deneyler **bağlanmadı.**
11. **Gözlemcinin gerçek sağlayıcı çağrısı.** `CTM_API_KEY` olmadığı için
    MiniMax'e hiç gidilmedi. Ölçülebilir olan kısım ölçüldü: kanıt denetimi
    test edildi (16 test), yanlış kabul bulundu ve düzeltildi (§6.32), ve
    `/api/observer` rotası üretim yapısında **erişilemez** olduğu için
    düzeltildi. Anahtarsız yol uçtan uca doğrulandı (503 + dürüst neden).
    Gerçek çağrı, `vision-assisted` yolu ve görsel şemasının canlı
    doğrulaması **yapılmadı**.
12. **Arşivin seçilime katılması (ε > 0).** Denendi ve **başarısız** oldu
    (§6.28): dolu kutu değişmedi (p = 1,0000). MAP-Elites'in "elitini koru"
    mantığı bu modelde işe yaramıyor çünkü üç betimleyiciden biri (boyut)
    **kalıtsal değil** (§6.29). Yanlış açıklama ("elit mutasyonla bozuluyor")
    önce yazıldı, sonra ölçülerek çürütüldü.

---

## 10. Geliştirme sırasında yakalanan gerçek hatalar

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
| 21 | Tarayıcı konsolunda `/favicon.ico` **404** veriyordu | Tek konsol hatasıydı; sekme ikonu kırıktı. `index.html`'e gömülü SVG favicon eklendi, istek başına dosya okunmuyor | `index.html` |
| 20 | Dal testi **iki dalı** karşılaştırıyordu | İkisi de ilerlediği için enerjileri zaten değişir → yanlış "çapraz karışma" raporlanıyordu. Doğrusu üçüncü bir referans dal; ayrıca referans dal ilk döngüde ilerletilmemişti | `verifyBranchIndependence` |
| 19 | Belge sayıları **raporun üretmediği koşulardan** alınmıştı | §5.11'in bud sayıları 112/169 derken rapor 110/144 diyordu: sayılar daha ince örnekleme (2000 tick) ile ad-hoc koşulmuş bir versiyondan gelmişti. Bağımsız denetim yakaladı; tümü `docs/EXPERIMENTS-DEEP.md`ye hizalandı |
| 18 | Enerji rezidülü **formülünde `externalInput` işareti tersti** | Doğru denklem `current + dissipated = initialTotal + externalInput`. Yazdığım `initialTotal − current − externalInput − dissipated` **20+ deneyde görünmedi**, çünkü `DEFAULT_REGEN = 0` olduğu için `externalInput` hep 0'dı. Rejenerasyon açılınca −26.958 e sahte ihlal göründü. Üç dosyada düzeltildi, regresyon testi eklendi (§5.17) |
| 17 | Kümülatif doğumun yataylaması **"doygunluk"** sanıldı | Yataylama, doğumların **durduğu** anlamına gelir; popülasyon doygunluğa değil **çöküşe** gidiyordu (166 → 41). İki ölçüm birlikte okunmalıydı (§5.11) |
| 16 | `maxGeneration` **nesil derinliği** sanılıyordu | Yaşayan popülasyondaki anlık en yüksek nesildir ve uzun koşularda **düşüyor** (ölçüldü: 10k tick → 3.0, 100k tick → 1.3). "Pencere çok kısa" gerekçesi bu hatadan kaynaklanmış ve kaldırıldı | `cumulativeBirths` (`nextOrganismIdForSnapshot() − 1`) eklendi; gerçek üreme çevrimi **≈5.5** ve durağanlıkta (§5.9) |
| 15 | Bağ uzaması **hayatta kalanların** ortalamasıyla ölçülüyordu | Değer 0.010–0.029 çıktı ve "uzama açıklama değil" izlenimi verdi. Gerçekte **seçilim yanlılığı**: gerilmiş bağlar zaten koptuğu için hayatta kalanlar seçilmiş olarak düşük gerilimli. `bond-break.detail.strain` üzerinden kırılma anı ölçülünce medyan 0.079 çıktı ve kırılmaların %100'ü bütünlük tükenmesiyle olduğu görüldü (§5.3) |
| 14 | `probabilityOfImprovement` **ikinci kez** yanlış veriyle hesaplanıyordu | Değerlendirme koşularında öğrenme kapalı olduğu için metrik tanım gereği hep 0 dönüyordu; rapor "öğrenme ağırlıkları hiç hareket ettirmiyor" izlenimi veriyordu, oysa eğitimde hareket ediyordu | `learnedDeltaNorm` artık koşunun **kendi başlangıç ağırlıklarına** göre ölçülüyor; `thetaInjected` alanı eklendi; regresyon testi yazıldı |
| 22 | **`genomeDistance` adıyla üç ayrı tanım** yaşıyordu | Arayüz ve kanıt paketi **ham** toplam kullanıyordu, ölçüm **normalize** toplamı. Ham sürüm `senseRadius` (2..7) ile `motility` (0..1)'yi eşit tartıyor. Ölçüldü: 93 soy çifti, 8 tohum × 6.000 tick → büyüklükler neredeyse aynı (**ham/normalize ≈ 1,02**) ama **sıralamanın %76'sı değişiyor**, en büyük kayma **32 basamak**. Yani hata büyüklükte değil **bakış açısında** görünüyor. Arayüz etiketi ("Atasal → torun genom uzaklığı") hangi tanımı kastettiğini söylemediği için iki yüzey sessizce ayrışmıştı | Tek kanonik tanım `sim/genome.ts` içinde; `colony.ts` yalnızca yeniden dışa aktarıyor, arayüz ve kanıt paketi aynı fonksiyonu çağırıyor. Beş koruma testi eklendi (§10.1) |
| 23 | Worker protokolünde **dört genom alanı** `Record<string, number>` idi | Gevşek tip, worker sınırında eksik bir genom parametresinin sessizce taşınmasına izin veriyordu; soy paneli `labels[k] ?? k` yüzünden eksik satırı ham anahtarla gösterirdi. **Bu bir canlı hata değildi** — üretici (`genomeSummary`) eksiksiz çalışıyordu — tip güvenlik açığıydı | Alanlar `Genome` tipine bağlandı; eksik parametre artık derleme hatası |
| 24 | `sim/genome.ts` başlığı **"Sekiz kalıtsal parametredir"** diyordu | Genom dokuz parametreye çıktığında güncellenmemişti; modül kanonik tanımın evi olduğu için buradaki yanlış sayı özellikle yanıltıcıydı | "Dokuz" olarak düzeltildi; kaynak dokümanındaki parametre sayısı artık testle korunuyor |
| 25 | Rapor tazelik denetimi **commit edilmemiş** değişiklikleri görmüyordu | `colony.ts` değiştirilip rapor üretilmeden koşan `npm run check` **yeşil** geçti; aynı commit CI'da **kırmızı** oldu. Yerel kapı, tam da uyarması gerektiği yerde sessizdi — çünkü tarihi `git log`'dan okuyor | Denetim artık **değiştirilmiş** dosyada dosya mtime'ını esas alıyor. Yalnız *değiştirilmiş* dosyada: `actions/checkout` her dosyaya taze mtime verdiği için, mtime her zaman esas alınsa temiz bir CI klonunda denetim **daima** kırmızı olurdu |
| 26 | **Anlatı belgeleri dokuz parametre öncesinden** sayılar taşıyordu | `766e0b9` tüm ölçümleri geçersiz kıldı ve kabul edilen riskti; ama `VALIDATION.md` §4.2–4.5 ve `PROGRESS.md` deney tablosu eski koşuların sayılarını taşımaya devam ediyordu, **hiçbir denetim bakmıyordu**. En ciddisi: `PROGRESS.md` öğrenmeyi "❌ **negatif**" diye etiketliyordu ama kendi alıntıladığı `+0.020` fark ve `%83` iyileşme **pozitif** yöndeydi — etiket kendi kanıtıyla çelişiyordu. Taze ölçüm: fark **+0.001**, p **0,9764**, iyileşme **%51,8** = etki yok | Üç deneyin tablosu ve §4.2 habitat tablosu `EXPERIMENTS.md`'den yeniden yazıldı; kaynak ve pencere notları eklendi. Değerler artık **rapordan türetilen**, bölüm kapsamlı bir denetimle korunuyor |
| 27 | `EXPERIMENTS-DEEP.md` **2,9 gün** bayattı | Son üretim `1791719188`, dokuz parametreli genom ise `1791967248`'de geldi. Raporda "cooperation"/"işbirliği" geçişi **0** kez — yani **var olmayan bir genomu** raporluyordu. Tazelik denetimi yalnız `EXPERIMENTS.md`'yi izliyordu | Derin paket yeniden üretildi (2.072 koşu, 912 sn). Denetim, **genom tanımı** (`types.ts` + `genome.ts`) değiştiyse DEEP'i bayat sayacak biçimde eklendi — 40 dk'lık üretimin her kod değişikliğinde istenmesi denetimi işe yaramaz hâle getirirdi |

### 10.1 `genomeDistance` — aynı ad, üç tanım

Bu bulgu "ölü alet" sınıfının yeni bir hâli: **ölü beyan**. Kod çalışıyor,
sayı üretiyor, makul görünüyor — yalnız **bu sayının ne olduğu** konusunda
kod tabanında üç farklı fikir var.

| yüzey | tanım | kime gidiyor |
|---|---|---|
| `sim/genome.ts` | ham `Σ\|a−b\| / 9` | kanıt paketi (`ancestorToLatestDistance`) |
| `sim/experiments/colony.ts` | normalize `Σ\|a−b\|/span / 9` | `EXPERIMENTS.md` (`genomeShift`) |
| `ui/Panels.tsx` (satır içi `reduce`) | ham `Σ\|a−b\| / 9` | soy paneli, "genom uzaklığı" etiketiyle |

Ham tanım **yanlıştır**: `motility`'nin tamamı 1 birim, `senseRadius`'un tamamı
5 birim. Ham ölçekte 1 birimlik kaymalar eşit sayılır; oysa biri parametrenin
**tamamı**, öteki beşte biri.

**Ölçüm (93 soy çifti, 8 tohum × 6.000 tick):**

| | değer |
|---|---|
| büyüklük farkı (ham/normalize ortalaması) | **1,02** — neredeyse aynı |
| sırası değişen soy | **71 / 93 (%76)** |
| en büyük sıra kayması | **32 basamak** |
| baskın parametre | hamda her örnekte `senseRadius`; normalize'da `motility`, `toleranceA/B`, `bondStrength` |

1,02'lik büyüklük oranı hatayı gizler: sayılar "doğru" görünür. Hata yalnız
**hangi soyun daha çok uzaklaştığını** sorduğunda ortaya çıkar.

Düzeltmenin bir yan etkisi **bilinçlidir**: kanıt paketindeki
`ancestorToLatestDistance` ve soy panelindeki sayı artık **değişir** (rapordaki
`genomeShift` **değişmez** — zaten normalize olandan kopyası kaldırıldı).

#### Koruma: beş test, ve hepsi sınandı

1. **Sayısal** — eşit göreli kayma eşit katkı vermeli (`senseRadius` 2→4,5 ile
   `motility` 0→0,5 → ikisi de 0,5/9). Ham sürümde bu test kırmızıdır:
   ölçüldü **0,2778 ↔ 0,0556** (tam 5 kat).
2. **Tek tanım** — `src/` altında `genomeDistance` tanımı yalnız
   `sim/genome.ts` içinde olmalı.
3. **Ürün yüzeyleri** — panel ve kanıt paketi kanonik fonksiyonu çağırıyor;
   panel genom alanlarını elle toplamıyor.
4. **Protokol sıkılığı** — dört genom alanı `Genome`, `Record<string, number>` değil.
5. **Bayat sayı** — modül başlığı dokuz parametre diyor.

> **Koruma yazarken dördüncü kez yanlış pozitif ürettim.** "Kanonik tanım
> normalize ediyor" denetlemesini dosyanın **tamamında** `GENOME_BOUNDS[key]`
> arayarak yazdım; o satır `clampGenome`/`mutateGenome`/`randomGenome` içinde de
> geçtiği için denetleme **hiç ateşlenemiyordu** — yani varlığını kanıtladığı
> hatayı yakalayamıyordu. Fonksiyonun **kendi gövdesine** kısıtlayınca
> ateşlendi. Ateşlenemeyen bir denetleme, hiç olmayandan kötüdür: yanlış güvence
> üretir.

---

## 11. Tekrarlanabilirlik

```bash
npm ci
npm test                      # 151 test (4 dosya)
npm run typecheck             # tsc --noEmit, temiz
npm run build                 # vite build, başarılı

npm run experiments           # standart paket (12.000 tick pencereleri, ~9 dk)
npm run experiments -- --deep # derin paket (40.000 tick — ekolojik çöküş görünür, yavaş)
npm run experiments:quick     # duman testi (~40 sn)
npm run assets:build          # Blender 5.1.1 ile 10 varlık üretir
npm run dev                   # geliştirme sunucusu (port 5183)
npm run server                # gözlemci sunucusu (port 8787) — anahtar yoksa 503
```

Deneyler **deterministiktir**: aynı tohum aynı sonucu verir ve bootstrap
aralıkları sabit bootstrap tohumuyla tekrarlanabilir. `npm run experiments`
`docs/EXPERIMENTS.md` dosyasını ham koşu değerleriyle yeniden üretir.

**Üç kademe var** ve süreler dürüstçe ölçülmüştür:

| Kademe | Komut | Süre | Pencere |
|---|---|---|---|
| Duman testi | `npm run experiments:quick` | ~40 sn | küçük örneklem, tüm bölümler |
| **Standart** | `npm run experiments` | **~9 dk** | 12.000 tick |
| Derin | `npm run experiments -- --deep` | ~20 dk | 40.000 tick (ekolojik çöküş görünür) |

12.000 tick'lik standart pencere kısa vadeli bulguları (§5.4) kapsar;
**uzun vadeli çöküşü (§5.12–5.16) görmek için `--deep` gerekir.** Bu ayrım
bilinçlidir: §5.11'de öğrenildiği gibi tek pencereye bağlı sonuçlar genellenmez.


#### Kalıcı koruma: `tests/measurement.test.ts`

Aynı alışkanlığın ikinci kez kurulmasını engellemek için üç denetim:
1. Deney dosyalarında **ardışık iki ölçüm döngüsü** deseni yok.
2. `experimentCooperation.run()` **tek** ölçüm döngüsü içerir.
3. Üretim kodunda süşeli dengesi (bozuk sözdizimi göstergesi).

Denetleyici **doğrulandı**: §6.57'deki hata geçici olarak geri kondu ve
**iki test kırmızı** döndü; geri alınınca yeşile döndü.

> İlk koruma denemesinde "step çağrısı = döngü × 2" gibi bir **tahmin**
> yazdım ve yanlış çıktı (dosyada farklı desenler var). Doğru ölçüt
> **fonksiyon bazlı**.

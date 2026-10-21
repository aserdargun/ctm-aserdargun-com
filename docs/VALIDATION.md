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
Test Files  12 passed (12)
     Tests  327 passed (327)
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

### 1.2 Simülasyon çekirdeği (`tests/world.test.ts`, 30 test)

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

### 1.4 Deney altyapısı (`tests/experiments.test.ts`, 94 test)

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

> ⚠️ **Köken notu (14 Ekim 2026):** bu tablo **elle koşulmuş** bir ölçüm —
> `npm run experiments` pipeline'ının ürettiği bir bölüm **değil**. Bu yüzden
> §4'teki üç deney gibi üretilmiş rapora bağlanamaz ve otomatik bir denetim
> tarafından korunamaz. Buradaki sayıların güncel genomla (dokuz parametre)
> tutarlı olduğu **doğrulanmadı**; doğrulama kanıtı olmadığı için değiştirilmedi.
> `docs/ROADMAP.md` bu tablonun bir kopyasını taşır ve aynı sınırlamaya tabidir.
> Yeniden ölçmek için tohum ve yapılandırma kaydedilmelidir.

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
| 0 | 0.930 | 0.811 |
| 1 | 0.930 | 0.908 |
| 4 | 0.935 | 0.928 |
| 9 | 0.937 | 0.930 |

| | Skor | Rastgele taban (en iyi) | Ortalama |
|---|---|---|---|---|
| Eğitim tohumları — bulunan | 0.937 | 0.892 | 0.859 |
| **Değerlendirme (görülmemiş) — bulunan** | **0.926** | **0.894** | 0.855 |
| **Kazanım** | **+0.032** | — | — |

> ⚠️⚠️ **Bu tablo iki kez düzeltildi ve kazanç üçte birine indi.**
>
> | sürüm | taban | kazanç | neden |
> |---|---|---|---|
> | belgede yazan | 0.755 | **+0.161** | ne güncel raporla ne kendinden önceki raporla uyuşmuyordu — bölüm zaten bayattı |
> | 1. düzeltme | 0.855 (ort.) | **+0.071** | taban örneği **aramanın RNG akışından** çiziliyordu; keyfî ve zayıf bir örnekleme oluşuyordu |
> | 2. düzeltme | 0.894 (en iyi) | **+0.032** | arama **maksimum** döndürüyor; taban da maksimum olmalı |
>
> **Bulunan politika hiç değişmedi** (eğitim 0.937, değerlendirme 0.926, nesil
> eğrisi birebir aynı). Değişen tek şey **referans çizgisi**ydi ve her düzeltme
> onu daha adil hâle getirdi. İddia yanlışlanmadı — **ciddi biçimde zayıfladı.**

**Okuma — evrim daha çok buluyor, ama "kanıtlanmış" artık söylenemez.**

| Yöntem | Görülmemiş dünyalardaki kazanç | Ölçüm |
|---|---|---|
| Yaşam içi REINFORCE (9 güncelleme) | **+0.001** [−0.037, +0.037] | p = 0.9764 · **20 tohum** (§4.5, güncel) |
| Yaşam içi REINFORCE (75 güncelleme, 570× adım) | **−0.234** | p = 0.010 — zararlı · **pipeline dışı ölçüm**, `EXPERIMENTS*.md`'de üretilmiyor ve yeniden üretilemiyor (§4.6–4.7) |
| **Evrimsel arama** | **+0.032** | güven aralığı **hesaplanmadı** · **6 tohum** |

> ⚠️ **Bu karşılaştırma tablosu da düzeltildi.** REINFORCE satırı **eski
> 6 tohumlu** koşumu (+0.020, p = 0.333) veriyordu ve güncel sunuluyordu.
> §4.5 artık **20 tohum** kullanıyor: **+0.001, p = 0.9764**. Yani aynı yöntemin
> güncel ölçümü sıfıra yakın.
>
> **Dolayısıyla "1,6 kat" ifadesi de düşürüldü.** Evrim 6 tohumla, REINFORCE
> 20 tohumla ölçülüyor; farklı örneklem büyüklüklerini böyle bir orana
> çevirmek sağlam değil. Satır 2 (75 güncelleme) ise güncel raporda **yok** —
> §4.6–4.7'nin ayrı ölçümü; rapordan türetilemediği için dokunulmadı ama
> **korumasız** olduğu not düşüldü.
>
> Doğru ifade şudur: *güncel ölçümde evrim +0.032, yaşam içi REINFORCE +0.001.
> Arama bir yönde hareket ediyor, RL etmiyor — ama evrim de küçük bir sayı
> buluyor ve güven aralığı hesaplanmıyor.*

Bu yüzden teşhis **tam kapatılmış sayılmaz**. Ölçülen şu: politika sınıfında
açıklık var (0.118), evrim araması onun bir kısmını buluyor (+0.032), REINFORCE
bulamıyor (+0.020, güven aralığı sıfırı içeriyor). Darboğazın öğrenme
algoritmasının **varyansı** olduğu teşhisi ayakta kalıyor; ama "arama çözümü
buluyor, RL bulamıyor" ayrımı artık ölçümle **kesin olarak desteklenmiyor**.

Popülasyon ortalamasının yükseldiği (0.811 → 0.930) elitizmin gerçekten seçim
yaptığını gösteriyor; bu ayrı ve hâlâ geçerli bir gözlem.

**Dürüstlük notları:**
- Değerlendirme penceresi evrim için 3.000 tick, Deney 3 için 4.000 tick'tir.
  Bu küçük fark katlar arası farkı açıklamaz, ama kesin bir eşitlik iddiası da
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
3. Aynı görevde arama **+0.032** buluyor (§4.9).

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
| Epimizik toplamı optimize eden yöntem işe yarıyor mu? | §4.9 | **Kısmen.** Evrim +0.032, ama CI yok ve fark REINFORCE ile dar |
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
atlar. Bu yüzden +0.032 buluyor.

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
| **S-3 kredi ataması olmayan yöntem** | ✅ evrim +0.032 çalıştı; ES/bandit benzeri RL de aynı yapıdadır |

**S-3 artık bir "geri çekilme" değil, yapıya uyan yöntemdir.** Ürüne alınması
hâlinde "yaşam öğrenir" anlatısının değişmesi bir bedeldir; ama bu bedel artık
teknik bir zorunluluk değil, **bilinçli bir seçimdir** — çünkü ölçüldü.

### 4.13 Paylaşma eşiği duyarlılık taraması — **rapora yeni girdi**

**Komut:** `npm run experiments` · `src/sim/experiments/ecology.ts`
**Durum:** Bu deney daha önce **rapora hiç bağlı değildi** (ölü). Kullanıcı
kararıyla "kendi sınırlarıyla" rapora alındı.

Paylaşma mekanizmasının tetiklendiği boşta eşiğini tarar: eşik düşürülürse
mekanizma ne kadar sık çalışır ve **ürün değişir mi?**

| Sınır | Değer |
|---|---|
| Tasarım | **Eşleştirilmiş** — her eşik noktası aynı tohum kümesini kullanır (3001+i) |
| Güven aralığı | **YOK** — bu bir tarama, fark testi değil |
| Taban çizgisi | Varsayılan ayar (0,82 e); oyun varsayılanı **değişmez** |

**Bulgu ve sınırı:** eşik **çok** değişken — paylaşma mekanizmasının tetiklenme
sıklığı eşikle birkaç yüz kat değişiyor. Buna karşılık **zirve koloni
büyüklüğü her eşikte aynı** (24 hücre) — yani *tetikleme eşiği değişken, sonuç
değişmiyor*. Bu, "paylaşma mekanizması işe yaramıyor" demek **değildir**;
"mekanizmanın sıklığı ürünün başarısını ölçmüyor" demektir.

**Dürüstlük notu:** tarama "fark ne kadar büyük, güvenilir mi" sorusuna
**cevap vermez**. Yalnız "hangi eşikte mekanizma ne kadar sık çalışır ve
ürün değişir mi" sorusuna cevap verir.

### 4.14 Dünya içi evrim (canlı dünyanın dalında) — **rapora yeni girdi**

**Komut:** `npm run experiments` · `src/sim/experiments/index.ts`
**Durum:** Bu deney de daha önce **rapora hiç bağlı değildi** (ölü). Aynı
kararla, kendi sınırlarıyla rapora alındı.

§4.9'daki arena araması öğrenmenin üst sınırını aradı; bu ölçüm aynı yöntemin
**canlı dünyanın anlık görüntüsünden açılan bir dalda** da çalışıp çalışmadığını
sorar.

| Sınır | Değer |
|---|---|
| Tohum | **TEK** (11) — tekrar yok |
| Güven aralığı | **YOK** |
| Karşılaştırma | Eşleştirilmiş iki kol (kontrol: arama yok / tedavi: arama var) |
| Ölçülen | Değerlendirme **skoru**; canlı dünya çıktısı ayrıca raporlanır |

**Bulgu:** arama, canlı dünyanın dalında da skoru yükseltiyor. Ama ölçülen
kazanç **değerlendirme skorkasında**; iki kolun **canlı dünya sonucu**
(population, koloni sayısı, organizma enerjisi) ölçüldüğü gibi **aynıdır**.
Yani mekanizma uçtan uca çalışıyor (protokol doğrulaması) — ama bundan
"canlı dünyada öğrenme işe yarıyor" sonucu **çıkmaz**.

**Bu bölüm rapora alınırken iki gerçek hata bulundu ve düzeltildi:**

1. **Kontrol kolunun "kazancı" gürültüydü.** Kontrol kolu (arama **yok**)
   kazanç olarak −17,7 üretiyordu — çünkü taban örneği aramanın RNG akışından
   ayrı çekildiği için "bulunan" ile taban **farklı rastgele örneklemlerden**
   geliyor. Yani arama yapılmadığı halde fark sıfır değil, **örnekleme
   gürültüsü** — ve bu gürültü tedavi kolunun ham kazancından (+3,3) **büyüktü**.
   Ham rakam gürültü tabanından küçükse anlam taşımaz. Düzeltme: etki =
   tedavi kazancı − **gürültü tabanı**; net etki **+21,1** (ölçülen) ve iki
   farklı yapılandırmada kararlı (+21,1 ve +21,9).
2. **Bayat okuma metni.** Taramanın okumasında "Varsayılan 0,82'de aktarım
   **0**" diye **sert kodlanmış** ve artık **yanlış** bir cümle vardı; üstelik
   kendi cümlesiyle çelişiyordu ("0,82 ilk kez tetikleniyor … 0,82'de aktarım
   0"). Okuma artık **ölçülen veriden** türer ve her eşikte "kaç tohumda
   tetiklendiğini" bildirir.

**Sınırlar gizlenmedi:** tek tohum, güven aralığı yok ve "işe yarıyor" hükmü
**mekanizmanın çalıştığına** dairdir, genellenebilir bir etkiye değil. Bu
bölüm §9'un "Doğrulanmayanlar" listesinin parçasıdır.

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
| Koptukları andaki medyan uzama | **0.066** |
| Koptukları andaki medyan dayanım | 0.450 |
| Yorgunluk tek başına 12.000 tick'te açıklayabileceği kayıp | **0.24** |

> ⚠️ Medyan uzama **0,079 → 0,066** düzeltildi. Bu tablo rapordan alıntıdır;
> 0,079 eski bir koşudan kalıyordu. Tablo artık `EXPERIMENTS.md` ile eşleşiyor
> ve bir koruma testiyle bağlandı.

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
| Kontrol (kalıtsız) | 0.4476 | 0.4514 | **+0.0037** |
| **Tedavi (kalıtsal)** | 0.4476 | 0.4559 | **+0.0083** [0.0026, 0.0145] |

İki kol farkı: **+0.0046** [−0.0056, +0.0131], **p = 0.3302**.

**Başarı ölçütü KARŞILANDI (40.000 tick'te):** tedavi kolunun kayması
**sıfırdan ayrışıyor** — aralık [0.0026, 0.0145] sıfırı içermiyor. Bağ ömrü
seçilime açıldığında koloniler daha uzun yaşayabiliyor. *İki kolun farkı*
hâlâ anlamlı değil (p = 0.3302); ayrışan şey **tedavi kolunun kendi kayması**.

> ⚠️ **Bu bölüm iki kez bayatlamıştı ve son hali ters yöndeydi.** Önceden
> kontrol −0.0112, tedavi −0.0056 [−0.0140, +0.0021] yazıyordu ve hüküm
> "ölçüt karşılanmadı" idi. Güncel derin ölçüm **kaymaların işaretini bile
> tersine çeviriyor**: her iki kol da **pozitif** ve tedavi kolununki sıfırdan
> ayrışıyor. Denetim bu sayıyı yakalayamıyordu çünkü **yalnız standart
> pencereye (12.000 tick) bakıyordu** — 40.000 tick'lik ölçüm yalnız
> `EXPERIMENTS-DEEP.md`'de üretiliyor.

**Pencere bağımlılığı (ölçüldü):**

| Pencere | Tedavi kayması | Hüküm |
|---|---|---|
| 12.000 tick | −0.0006 [−0.0042, +0.0019] | sıfırdan **ayrışmıyor** |
| 40.000 tick | +0.0083 [0.0026, 0.0145] | sıfırdan **ayrışıyor** |

Yani Y-2'nin sonucu **pencereye bağlıdır**; kalıtılabilirlik etkisi kısa
pencerede görünmüyor, uzun pencerede ortaya çıkıyor. README'deki "❌
başarısız" satırı **yalnız 12.000 tick'i** anlatır ve pencere notuyla
verilmelidir.

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
| 16.000 | **98** | 95 | 228 | 96 | 7 | 60 | 2 |
| 32.000 | 32 | 32 | 235 | 98 | 1 | 27 | 1 |
| **40.000** | **29** | 28 | **235** | 98 | 0 | 25 | **2** |

**Doğum hızı çöktü:** ilk çeyrekte **120**, **son çeyrekte 1** doğum. Tomurcuklama
toplam **98** kez gerçekleşti; koloni üreme nesli örneklenen satırlarda 60'den
25'e düştü. Yani üreme bir süre çalışıyor, sonra tümüyle duruyor.

Popülasyon durağan değil: **çöküyor.** Zirve **213** (tick 4.000) → 29, yani
zirvenin **%14'üne**.

> ⚠️ **Bu tablo 14 Ekim'de bayattı ve sessizce düzeldi.** `EXPERIMENTS-DEEP.md`
> 14 Ekim'de yeniden üretildiğinde bu sayılar 41/246/110/18'den
> **29/235/98/25'e** değişti; bölüm güncellenmedi. Denetim, DEEP'in yalnız
> *genom şeklini* izlediği için bunu yakalayamamıştı. Aynı bölümün metni
> ayrıca kendi tablosuyla çelişiyordu: "4+ hücreli yapılar yine sıfır"
> deniyordu, kendi tablosu 13 yazıyordu (§5.13).

### 5.12 40.000 tick'e uzun bakış: ekosistem sönüyor

Varsayılan ayarlarda 40.000 tick (tohum 11):

| Tick | Pop | Küme | Bağ | Rezerv% | Sistem enerjisi | Açlık ölümü | Avcı ölümü |
|---|---|---|---|---|---|---|---|
| 4.000 | **213** | 4 | 44 | 77.8 | 91.357 | 5 | 2 |
| 8.000 | 153 | 2 | 6 | 59.8 | 68.183 | 53 | 27 |
| 12.000 | 115 | 2 | 3 | 50.7 | 57.715 | 78 | 48 |
| 20.000 | 82 | 2 | 1 | 39.8 | 45.171 | 92 | 76 |
| 24.000 | 64 | 1 | **0** | 36.9 | 41.113 | 101 | 85 |
| 32.000 | 39 | 1 | 2 | 32.8 | 35.913 | 112 | 104 |
| **40.000** | **33** | 1 | **0** | **30.2** | 33.031 | 116 | 105 |

Zincir tam: bağlar 24.000 tick'te **tamamen yok** → çok hücrelilik bitmiş →
hücreler paylaşamıyor → tek tek açlık → popülasyon zirvenin **%15'ine** düşüyor.

Avcı ölümleri 2'den 105'e çıkıyor: uzun vadede avcı ikinci sıradaki katil
hâline geliyor (ölümlerin **%48'i**). Kaynak **bitmiyor** (%30.2) — yani kaynak
tükenmesi uzun vadede de açıklama değil.

### 5.13 §5.4'ün genellenip genellenmediği — **genellenmiyor**

§5.4'te bağ dayanıklılığının 4+ hücreli yapıları geri getirdiği **ölçülmüştü ve
önceden kaydedilen ölçütü karşılamıştı.** Bu, kendi bulgumu sınayan bir ölçüm:

| strainK | Bağ ömrü | Son pop | Çöküş oranı | Son çeyrek ort. küme | Son 4+ yapı | Son bağ | Son rezerv | **Geç açlık %** | **Geç avcı %** |
|---|---|---|---|---|---|---|---|---|---|
| **0.020 (varsayılan)** | 2.083 | **33** | **6.5×** | 1.39 | 0 | 0 | %30.2 | 50.0 | **50.0** |
| 0.005 | 8.333 | 25 | 9.1× | **2.10** | 0 | **1** | %25.6 | 75.0 | **25.0** |
| **0.002** | 21.277 | 26 | 8.8× | 1.00 | 0 | 0 | %26.4 | 64.7 | 35.3 |

> ⚠️ **Bu bölümün hükmü tersine döndü.** Tablo 14 Ekim'den beri bayattı ve o
> gün **ters yönü** gösteriyordu: 10× dayanıklı bağlar son popülasyonu 36'dan
> **52'ye çıkarıyor** (+%44) ve 4+ yapı **13** bulunuyordu. Güncel ölçümde
> 10× dayanıklılık son popülasyonu 33 → **26** düşürüyor (−%21), 4+ yapı **0**,
> son çeyrek kümesi 1.39 → **1.00**. Yani "kısmi hafifletme" değil, **hafif
> zarar**. Aynı şekilde "geç dönem avcı ölümleri sıfırlanıyor" iddiası da
> düştü: en dayanıklı bağda avcı payı artık **%35.3**, sıfır değil.

**İki ayrı sonuç var ve ikisi de doğru:**

**1. Kalibrasyon çöküşü engellemiyor — hatta hafifçe kötüleştiriyor.** 10×
dayanıklılık son popülasyonu 33'den 26'ya düşürüyor (−%21) ve son çeyrek kümesi
1.39 → 1.00 oluyor. 4+ hücreli yapılar **hiçbir kademede** geri gelmiyor. Yani
bağ ömrünü 10 kat artırmak uzun vadeli çöküşü geciktirmiyor; en iyi ihtimalle
etkisiz, bu ölçümde **zararlı**.

**2. Ölüm rejimi bağ ömrüyle monoton değişmiyor.** Son çeyrek ölüm payları:

| Bağ ömrü | Baskın ölüm nedeni |
|---|---|
| 2.083 (varsayılan) | avcı %50.0 |
| 8.333 | **avcı %25.0** — en düşük |
| 21.277 | avcı %35.3 |

En dayanıklı bağ **en düşük avcı payını** taşımıyor; en düşük payı orta kademe
(8.333) taşıyor. Yani "dayanıklılık → avcı ölümünün sıfırlanması" gibi düzgün
bir ilişki **bu ölçümde yok**. Rastgele salınım olabilir; ayırt etmek için
tohum tekrarları gerekir — **yapılmadı**.

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
1. **Avcı dinamiği** — avcı ölümleri 2 → 105; avcının kendi dengesi yok mu?
2. **Enerji muhasebesi** — sistem enerjisi 108.763 → 33.031; bu düşüşün
   bileşenleri (bazal + hareket + avcı hasarı) ölçülmedi.
3. **Doğum/ölüm dengesi** — son çeyrekte 1 doğum; neden üreme tamamen duruyor?

**B3 (somatik mutasyon) bu soru yanıtlanmadan yapılmamalı:** 5.5 üreme çevrimi
bir pencerenin artefaktı değil, **çöken bir popülasyonun sonucu.**


### 5.15 40.000 tick sınırı: erişilebilirlik mi, avcı mı?

> Derin profil (`--deep`). Standart profilde bu tablo üretilmez.

Dayanıklı bağlarla (strainK 0.002), 40.000 tick:

| Tick | Pop | Ort. hücre enerjisi | Açlık % | Medyan kaynak uzaklığı | Yakın % | Rezerv % | **Avcı enerjisi** |
|---|---|---|---|---|---|---|---|
| 0 | 48 | 55.0 | 0.0 | 1.90 | 31.3 | 100.0 | 4.4 |
| 4.000 | 226 | 39.7 | 4.0 | 1.22 | 67.3 | 76.1 | 16.3 |
| 8.000 | 156 | 35.1 | 5.8 | 1.34 | 55.1 | 56.1 | 32.4 |
| 16.000 | 101 | 27.3 | 16.8 | 1.76 | 43.6 | 40.0 | 11.0 |
| 24.000 | 66 | 25.9 | 15.2 | 1.95 | 40.9 | 32.2 | 9.4 |
| 40.000 | **26** | 26.9 | 15.4 | 1.57 | 42.3 | **26.4** | **0.0** |

**İki gözlem, ikisi de çürütücü:**

1. **Avcı ~35.000 tick'te açlıktan ölüyor** (enerji 32.000'de 4.4, 36.000'de 0.0
   ve orada kalıyor). Yani geç dönemde avcı yok. Bu §5.13'teki geç dönem avcı
   ölüm paylarının **düşük** (25–50%) kalmasıyla tutarlı — ama §5.13'teki
   "en dayanıklı bağda avcı %0" ifadesi bu ölçümle **çelişiyor** ve düzeltildi.
2. **Hücreler ploya yapıyor, ölmüyor:** enerji 55.0 → 26.9 e'de kararlı kalıyor,
   açlıktaki hücre payı ~%15. Yani "kaynak erişilemiyor" teşhisi de **tam
   değil** — geç dönemde hücrelerin ~%42'si kaynağa 1.6 mb içinde.

> ⚠️ **Bu yorum DEEP'in kendi hüküm satırıyla çelişiyor ve not düşüldü.**
> `EXPERIMENTS-DEEP.md` bu taramanın hükmünü **"sınırlayıcı: kaynak
> erişilebilirliği"** olarak veriyor (yakınlık 1.48 → 2.16 mb, 1.46× büyüme;
> rezerv %26.4'te kalıyor). Yukarıdaki 2. gözlem ise erişilebilirliğin
> **tam açıklama olmadığını** söylüyor. İkisi aynı veriye bakıyor; ayrışma
> yorum katmanında. Hangisinin doğru olduğu **ayrı bir ölçümle** sınanmadı —
> erişilebilirliği tek başına değiştiren bir deney yok.

### 5.16 Kaynak rejenerasyonu A/B — ve bir muhasebe hatasının bulunması

> Derin profil (`--deep`).

`C.DEFAULT_REGEN = 0`: kaynak **hiç yenilenmiyor.** Kapalı enerji sistemi
40.000 tick'te rezervini %100 → %26.4'e tüketiyor. Soru: bu tükenme mi sınırlıyor?

| regen | Zirve pop | Son pop | Son çeyrek pop | Son rezerv | Ort. enerji | Açlık öl. | Avcı öl. | **Avcı öldü (tick)** |
|---|---|---|---|---|---|---|---|---|
| 0 | 226 | 26 | 29.0 | %26.4 | 26.9 | 157 | 37 | 33.424 |
| 0.002 | 207 | 38 | 35.7 | %32.0 | 36.9 | 110 | 56 | 33.893 |
| 0.01 | 215 | **55** | 52.3 | %35.4 | 32.8 | 98 | 50 | 33.254 |

> ⚠️ **Bu bölümün hükmü de tersine döndü.** 14 Ekim'den beri bayat olan tablo
> "**rejenerasyon popülasyonu kurtarmıyor**" diyordu: regen 0 → son pop 52,
> regen 0.01 → 42, yani daha fazla enerji **daha az** popülasyon. Güncel
> ölçümde bunun **tam tersi**: regen 0 → son pop 26, regen 0.01 → **55**, yani
> **+%112**. Açlık ölümleri de 157 → 98 ile tutarlı biçimde azalıyor.

**Sonuç: rejenerasyon popülasyonu kurtarıyor.** Kaynak tükenmesi **kısmen
sınırlayıcıdır** — kapatıldığında son popülasyon 26'ya düşüyor, açıldığında 55'e
çıkıyor. Ancak **zamanlama değişmiyor:** avcı her üç koşuluda da ~33.300'de
ölüyor (33.424 / 33.893 / 33.254) ve avcı kaynaklı ölümler monoton değil
(37 → 56 → 50). Yani enerji **kurtarıcı**, ama avcı dinamiğini değiştirmiyor.

**Avcı yorumu zayıfladı.** Önceki metin "avcı enerji verildiğinde daha uzun
yaşıyor (23.406 → 38.931)" diyordu; bu ölçümde avcı ölüm tick'i üç koşuluda da
**aynı**. Önceki fark, enerjinin verildiği koşulda avcının geç değil **erken**
öldüğünü gösteriyordu — yani "enerji verilince avcı canlanır" yorumu bu veriyle
**desteklenmiyor**.

> ⛔ **Bu vurgu blokta geri çekildi.** "Avcı enerji verildiğinde devreye girer
> ve baskısı hızlanır" iddiası güncel veriyle **desteklenmiyor**: avcı ölüm
> tick'i üç rejenerasyon koşulunda da ~33.300'de sabit. Blok, 14 Ekim'den
> önce ölçülmüş bayat bir tabloya dayanıyordu.

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
| Kaynak erişilebilirliği mi? | Kısmen — uzaklık 1.48→2.16 mb (1.46×), ama hücrelerin %42'si kaynağa 1.6 mb içinde | §5.15 |
| Avcı dinamiği mi? | **Hayır** — enerji verilse de avcı ölüm tick'i ~33.300'de **değişmiyor**; avcı kaynaklı ölümler monoton değil | §5.16 |
| Kümülatif kaynak tükenmesi mi? | **Evet, kısmen** — rejenerasyon son popülasyonu 26 → 55 yapıyor (**+%112**) | §5.16 |

**Sistemin uzun vadeli düzenleyicisi avcı değil, kaynak erişimi.** ⚠️ Bu cevap
**tersine döndü**: önceki metin avcıyı düzenleyici ilan ediyordu ve bunu
"kapalı sistemde avcı erken ölür, enerji verilirse devreye girer" ile
gerekçelendiriyordu. Güncel ölçümde avcı ölüm zamanı enerji koşulundan
**bağımsız**; buna karşılık kaynak rejenerasyonu popülasyonu iki katından fazla
artırıyor. "Çift yönlü düzenleme" anlatısı da bu veriyle kurulmuyor.

B3 (somatik mutasyon) için önkoşul hâlâ: yeterli üreme çevrimi. Ancak bu kez
sebep "nesil derinliği yok" değil, **kaynak erişilebilirliği ve üreme
dengesinin kaynakla birlikte çözülmemesi**.


## 6. Deney günlüğü — **tarihsel kayıt**

> ⚠️ **BU BÖLÜM TARİHSEL BİR GÜNLÜKTÜR, GÜNCEL SONUÇ TABLOSU DEĞİLDİR.**
>
> Buradaki sayılar **kendi tarihindeki ölçümlerdir** ve bilinçli olarak
> değiştirilmez — bir deneyin geçmişini silmek, ne ölçüldüğünü gizlemektir.
> Bu nedenle buradaki `p = 0,097`, `p = 0,333` gibi değerler güncel raporda
> **yoktur**; onların bugünkü karşılıkları §4.4 ve §4.5'te ve
> `docs/EXPERIMENTS.md`'de durur.
>
> **Ölçülen sürüklenme (15 Ekim 2026):** §4.9'daki karşılaştırma tablosu
> "eski 6 tohumlu" REINFORCE satırını güncel diye sunuyordu; §4.5 artık
> **20 tohum** kullanıyor. Aynı hatanın bu bölümdeki kopyaları **tarihsel
> çerçeveleme sayesinde** ayırt edilebildi — tarihsel olanlar "eski bulgusuyla
> tutarlıdır" diyor, bayat olan güncel tabloydu.
>
> GÜNCEL SONUÇ İÇİN: §4 (deney sonuçları) + `docs/EXPERIMENTS.md`.
> §4.2–4.5, §4.9 ve §5.3 rapordan **türetilen** sayılarla korunuyor; §4.9'daki
> 75 güncelleme kolu raporda **yok** ve korumasız olduğu not düşüldü.

### 6.0 Popülasyon-ES — seçilen öğrenme yönünün testi

**Komut:** `npm run experiments` · `src/sim/experiments/ecology.ts` · `src/sim/world.ts`

### 6.1 Neden bu yöntem

§4.12–4.13'ün kızdığı teşhis şuydu: **ödül sinyali sağlam** (epimizik toplam
performansla r = 0.70, toplam varyansın %97.9'u politika farklarından), **ama
REINFORCE onu kullanamıyor** çünkü 64 adımlık yörüngeye yayarken bilgi
kaybediyor. Evrimsel arama ise yalnızca epimizik toplamı kullandığı için aynı
görevde +0.032 buldu.

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
| Evrimsel arama (μ+λ) | **Kısmen** — her aday ayrı koşu | ✅ +0.032 (zayıf) |
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

**Düzeltme:** `fromState` artık tüm alanları açıkça kuruyor (dokümanlı bir blok).
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

Çevrimiçi (μ+λ) evrimsel aramanın aynı görevde **+0.032** bulmasının
karşısında, yaşam içi ES'in bulduğu: hareket var mı yok, kazanç yok, maliyet
çok yüksek.

Fark şurada: çevrimiçi arama **seçim yapıyor** — her nesilde en iyisi tutuluyor,
12 nesil boyunca küçük davranış farkları birikir. Yaşam içi ES ise bir bireyin
**tek yaşamında** tek bir güncelleme yapar; küçük farklar birikemez.

**Sonuç: S-4 mekanik olarak mümkün, pratikte başarısız.** Ölçüm zinciri
burada da tamamlandı ve kalan tek seçenek yine **S-3**.


### 6.14 S-3 hazırlığı · in-world arama denendi ve **reddedildi** (⚠️ **hüküm sonradan düzeltildi** — §4.14)

S-3'ü ürüne almadan önce ölçülen +0.032 sonucunun (arena, §4.9) **canlı dünyanın
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

| Özellik | Arena (ölçülmüş, §4.9) | Canlı dünya dalı (§6.14'teki hâli) |
|---|---|---|
| Birey sayısı | 1 — davranış sonucu belirler | ~250 — birey doyuyor, davranış etkisiz |
| Uygunluk | Hücre başına normalize | Doygunluk ve temel yanlılığı |
| Eğitim/değerlendirme | Ayrık tohum kümeleri | Aynı dünya, ayrışmıyor |
| Sonuç | **+0.032, p = 0.343 üstü ama CI ayrışıyor** | Karşılaştırılamaz |

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

#### ⚠️ Düzeltme (19 Ekim 2026): karar duruyor, **gerekçesi değişti**

Yukarıdaki "Canlı dünya dalı" sütunu §6.14'teki **hatalı ölçümün** özetidir ve
artık **doğru değildir**. O ölçümdeki iki hata (§6.14) sonradan **düzeltildi**:

1. uygunluk **hücre başına** enerjiye çevrildi (doygunluk yanlılığı gitti),
2. iki kol **aynı** rastgele tabanı paylaşıyor (karşılaştırılabilirlik gitti),
3. ve bu turda ek olarak: hüküm artık **gürültü tabanını** düşüyor —
   kontrol kolunun (arama yok) kendi kazancı ölçüldü.

Düzeltilmiş hâliyle ölçüm **karşılaştırılabilir** ve olumlu: kontrol kolu
**−17,7** (gürültü), tedavi kolu **+3,3**, **net etki +21,1** (§4.14). Yani
**mekanizma canlı dünyanın dalında da çalışıyor** — §6.14'teki "reddedildi"
hükmü artık geçerli değil.

**Karar yine de aynı, ama gerekçesi değişti:** canlı dünyada arama
**ölçülebilir** bir dünya sonucu **üretmiyor**. İki kolun canlı dünya çıktısı
(popülasyon 212, 4+ koloni 1, organizma enerjisi 58 e) **birebir aynıdır**;
fark yalnız *değerlendirme skorkasında* görünür. Yani canlı dünyada çalışan
arama "dünyayı değiştirdi" iddiasını desteklemiyor, yalnız "skoru yükseltti"
diyor — ve arena, tutulmuş tohumlarla **genellenebilir** bir kazanç ölçtüğü
için (§6.16: +0,035) doğru yoldur.

**Yani:** "ölçülemezdi" → "ölçülebilir ama dünyayı değiştirmiyor".


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
   tohumla geçiyordu. Testler sağlamlaştırıldı.

   **ÖLÇÜLDÜ (19 Ekim 2026) — soru artık açık değil, cevap "ayrışıyor".**
   Aynı kod, aynı tohum (20261006), 12.000 tick, iki platform:

   | | macOS/arm64 | Linux/x64 (CI) |
   |---|---|---|
   | hız örneklem sayısı | 1.158 | 1.183 |
   | en büyük hız | 0.1117 | 0.1014 |
   | en büyük organizma | **20 hücre** | **24 hücre** |
   | kalibrasyon tavan payı | %6,9 | %15,5 |

   Maks hücre sayısının **20 ↔ 24** olması yalnız kayan nokta gürültüsü değil:
   Linux'de bir organizma yapısal tavana (`MAX_ORGANISM_CELLS = 24`) ulaşıyor,
   macOS'ta hiçbiri 20'yi geçmiyor. Örneklem sayısının 1.158 ↔ 1.183 olması da
   yalnız "farklı ölçüm" değil, **ölçülecek organizmaların sayısının** farklı
   olduğunu gösteriyor. Aynı platform içinde ise sonuç **bit düzeyinde tekrarlanıyor**
   (iki ardışık koşu: 1.727 / 129 / 9 ve pop 113 — birebir aynı).

   **Sonuç:** yörüngeler platformlar arasında bit düzeyinde aynı **değildir** ve
   bu **vaat edilmiyor**. Üretilen raporların sayıları onları üreten makineye
   bağlıdır; bu yüzden rapor başlığına artık `Ortam` satırı yazılıyor. Testler
   tohum kırılganlığından arındırıldı ve platform ayrışması da kayda geçti.
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
13. **Kanıt denetimi anlam denetimi YAPMIYOR.** `verifyNumericClaims` bir
    model yanıtındaki sayıları kanıt paketindeki ölçümlerle **değer olarak**
    karşılaştırır; sayının **neyi** saydığını anlamaz. Ölçülen sınır: "Bu 3
    organizma bağ kurdu" cümlesindeki **3**, `bondCount = 3` ile eşleşip
    **doğrulanmış** geçiyor — ama iddia bağ değil *organizma* sayısı hakkında.
    Bu bir **yanlış kabul**dir ve gözlemci panelinde "doğrulanmış" rozetiyle
    görünür. Aynı şekilde birimin yanlış olması da yakalanmaz: dönen `unit`
    **ölçümün** birimidir, iddianınki değil. Anlam denetimi için kanıt paketine
    ölçümün **adı/niceliği** de taşınıp metinle karşılaştırılmalı; bu **yapılmadı**
    ve **vaat edilmiyor**. Kayıt buraya, §6.32'deki düzeltme kaydının yanına
    eklendi çünkü sınır yalnız kod yorumunda yazılıydı.
14. **Görüntüleme tavanlarının "asla aşılmaz" garantisi YOK.** 3B hücre tavanı
    (512) ve canlı listesi tavanı (300) **görüntüleme** sınırlarıdır; simülasyon
    onları aşabilir. Ölçülen durum: 40.000 tick, 14 + 9 senaryoda tepe canlı
    hücre **266**, tepe canlı organizma **252** — yani ölçülen aralıkta ikisi de
    aşılmıyor (paylar %48 ve %16). Ama bu bir **örnekleme** sonucu: "hiçbir
    koşuda aşılmaz" iddiası **yapılmadı** ve **vaat edilmiyor**. `tests/caps.test.ts`
    bu ölçümü 12.000 tick'lik iki tohumla **yeniden yapar** ve tavan aşılırsa
    kırmızıya döner — yani denetim **örnekleme** üzerinedir, kanıt üzerine
    değil. Aşılırsa ürün yanlış olmaz (kırpma **görünür** hâle gelir: HUD'da
    "Görünüm sınırı" göstergesi ve listede "İlk 300 / N kayıt" notu çıkar),
    ama tavan gözden geçirilmelidir.
    ⚠️ **Üçüncü sınır (soy paneli, 12) farklı temele oturur:** soy sayısı
    simülasyonda **yapısal** olarak belirlenir (soylar kuruluşta doğar, sonradan
    doğmaz), yani orada örneklemeye değil **yapıya** dayanan bir garanti
    vardır; ölçüm (40.000 tick, 7 senaryo → tepe 12) bunu doğruluyor.
15. **Dünya içi evrimin etkisi **TEK tohumla** ölçüldü.** §4.14: arama canlı
    dünyanın dalında skoru yükseltiyor (net +21,1), ama bu **tek tohum**, **güven
    aralığı yok** bir ölçüm ve ölçülen kazanç **değerlendirme skorkasında** —
    iki kolun canlı dünya çıktısı (popülasyon, koloni, organizma enerjisi)
    ölçüldüğü gibi **aynıdır**. Yani "canlı dünyada öğrenme işe yarıyor"
    sonucu **çıkmaz**; yalnız "mekanizma uçtan uca çalışıyor" doğrulanır.
    Tekrarlama (birden çok tohum) **yapılmadı** ve **vaat edilmiyor**.
16. **Paylaşma eşiği taraması bir fark testi DEĞİLDİR.** §4.13: eşleştirilmiş
    tasarımlı bir tarama (her eşik noktası aynı tohum kümesi) ve **güven aralığı
    yok**. "Eşik farkı ne kadar büyük ve güvenilir mi" sorusuna cevap vermez;
    yalnız "hangi eşikte mekanizma ne kadar sık çalışır" sorusuna cevap verir.
    Taramadaki okuma metni **ölçülen veriden** türer (sert kodlanmış bir
    "varsayılan eşikte aktarım 0" iddiası kaldırıldı — §10/70).

---

## 10. Geliştirme sırasında yakalanan gerçek hatalar

Bunlar testlerin bulduğu, düzeltildiği ve **yeniden test edildiği** hatalardır:

| # | Hata | Belirti | Düzeltme |
|---|---|---|---|
| 76 | Snapshot, dünyanın **gerçek tohumu yerine `0`** yazıyordu | `serializeWorld` snapshot'ın `seed` alanına sabit `0` koyuyordu — çünkü dünya tohumu hiç saklanmıyordu (`World` yalnız `options.seed`'i `RngBundle`'a veriyordu). Yani kullanıcının **dışa aktardığı kayıt dosyasında** `"seed": 0` görünüyordu: **yanlış bilgi**. Alan hiç okunmadığı için "zararsız" görünüyordu, ama bir kayıt dosyasındaki yanlış sayı sessizce yanlış bilgi taşır (ve snapshot başlığı "her şey serileştirilir" diyor) | `World` artık `readonly seed` tutuyor; `serializeWorld` **gerçek** tohumu yazıyor; `fromState` tohumu snapshot'tan geri yükler (`options.seed` açıkça verilmişse o üstün gelir). Doğrulama da eklendi (`num(s.seed, 'seed')`). **Uyumluluk bozulmadı:** eski kayıtlarda `seed: 0` vardı ve `0` sonlu bir sayı olduğu için yine yükleniyor; şema sürümü **değişmedi** (sürümü yükseltmek mevcut kullanıcı kayıtlarını reddetirdi). Koruma: snapshot gerçek tohumu yazıyor ve geri yükleme tohumu koruyor; mutasyonla doğrulandı (`seed: 0` geri konunca kırmızı) |
| 75 | Arena başlığı **uygulanmayan bir sözleşme** vaat ediyordu: "sıfırdan farklı bir rezidüel deney sonucunu geçersiz kılar" | `src/sim/experiments/arena.ts` başlığının 4. tasarım kararı: "Her koşu muhasebe rezidüelini raporlar; **sıfırdan farklı bir rezidüel deney sonucunu geçersiz kılar**." İlk kısım doğruydu, **ikincisi hiçbir yerde uygulanmıyordu** — rezidüel her bölümde raporlanıyordu (bazıları 1e-11, en büyüğü 7,5e-8 e) ama **hiçbir yerde denetlenmiyordu**. Yani enerji korunumunun kırılması sonuçları geçersiz kılmaz, yalnızca not edilir. Projenin **temel değişmezi** olan enerji korunumu için bu, "ölü bir beyan"dır | `scripts/run-experiments.ts`e bir **kapı** eklendi: eşik (1e-3 e) aşılırsa süreç **EXIT=1** verir, ihlal eden bölümleri **adıyla** listeler ve **rapor yazılmaz** ("Rapor YAZILMADI") — yani geçersiz sayılar **yayımlanmaz**. Değişmez kontroller kapısıyla aynı davranış. Ölçülen en büyük rezidüel **7,5e-8 e** (eşiğin ~13.000 katı altında) ve hızlı pakette ölçülen en büyük 1,4e-8 e. **Mutasyonla doğrulandı:** eşik 1e-30'a çekilince hızlı paket EXIT=1 verdi, yedi bölümü adıyla listeledi ve raporu yazmadı. Koruma: kapı var mı, eşiği doğru mu (1e-3, `worker/evidence.ts`teki "korunum ihlali" eşiğiyle aynı), ihlalde rapor yazılmıyor mu — ve rapordaki **ölçülmüş** rezidüller eşiğin altında mı |
| 76 | Gözlemci panelinin **başlığı tablonun tersini** söylüyordu | Başlık "**Doğrulanamayan sayılar çıkarıldı**" diyordu; ama panel doğrulanamayanları hemen altta **listeliyordu** (✓/✗ ile). Yani başlık "gizlendi" diyordu, tablo "işte buradalar" diyordu. Tasarımın kendisi doğru (eşleşmeyi gizlemek yerine **göstermek** isteniyor) — yanlış olan **başlık**tı | Başlık artık tablonun ne yaptığını söylüyor: "Model yanıtındaki sayılar — kanıt paketiyle eşleşenler ✓ işaretlidir; eşleşmeyenler ✗." Anahtar da `unverifiedNumbers` → `numberCheck` olarak düzeltildi. Koruma: başlık "çıkarıldı" demeyi yasaklıyor ve panelin sayıları listelediğini doğruluyor |
| 75 | Yayımlanan rapora **kırık bir değer** sızdı (`undefined kaynak`) | Anlatıdaki headroom sayısını türetirken alan adı yanlış yazıldı (`resources` yerine `resourceCount`) ve **`as` cast'ı tip hatasını gizledi**: derleyici de yakalamamıştı. Rapor "Varsayılan habitatta (**undefined** kaynak) …" diye yayımlandı — sayı doğruydu, kaynak sayısı **yoktu** | Alan adı düzeltildi, gerekçesiz `as` cast'ı kaldırıldı. Koruma **genel**: yayımlanan rapor **hiçbir yerde** `NaN` içeremez ve `undefined` yalnız satır içi kod parçası olarak geçebilir (tarihsel bir cümlenin açıklaması). Böylece bir alan adı yazım hatası ya da ölü bir interpolasyon **yayımlanamaz** |
| 77 | Rapor **anlatısındaki** sayılar **sert kodlanmıştı** ve biri **yanlıştı** | (a) "Varsayılan habitatta (34 kaynak) ölçüm headroom u yalnız **0.072** olduğu için" cümlesi **sert kodlanmıştı**; ölçülen headroom **0,078**'di. Yani rapor kendi kalibrasyon tablosuyla **çelişiyordu**. (b) "(varsayılan ayarlarda pencerenin sonunda 0)" ve "(64 / 0.02)" de aynı sınıftandı — ölçüm sonuçları ve sabitler elle yazılmıştı | Üçü de **ölçümden/koddan türdür**: headroom kalibrasyon eğrisinin en kalabalık noktasından, "sonunda 0" varsayılan ayarların satırından, "(64 / 0.02)" ise `C.TRAJECTORY_LIMIT` / `C.LEARN_RATE` sabitlerinden okunuyor. ⚠️ **Ölçüt eşiği sayıları** (p < 0.05, %80) sabit **kalabilir** — onlar ölçümden önce yazılmış ölçütlerdir, ölçüm sonucu değil. Koruma bu ayrımı koruyor |
| 74 | **Ölü bir komut** ve **tüketilmeyen** bir hata yolu vardı; bilinmeyen komut **sessizce** yutuluyordu | Ölçülen: (a) `select` komutu protokolda beyan edilmiş ve worker'da karşılanıyordu ama **istemci hiç göndermiyordu** — seçim tamamen istemci tarafında, worker'a gidişi gereksiz bir turdu. (b) Worker'ın `default:` dalı bilinmeyen komuta `{ type: 'ack', command: 'unknown' }` basıyordu; ama istemci `ack`'i **hiçbir yerde işlemiyordu** — yani eski (önbelleklenmiş) bir worker yeni bir komutu tanımadığında kullanıcı **hiçbir şey olmadığını** sanıyordu, hata da görmüyordu. (c) `ack` mesajı tümüyle tüketilmeyen altyapıydı (denetimde istisnaydı) | `select` komutu protokolden ve worker'dan kaldırıldı; `ack` mesajı da protokolden silindi. Bilinmeyen komut artık `fail()` ile **hata kanalına** gider → istemci `error`'ı işler → `App.tsx` görünür bir bildirim gösterir. Koruma **genel ve iki yönlü**: arayüzün gönderdiği her komut worker'da karşılanmalı **ve** protokolde beyan edilmeli; worker'daki her işleyici istemci tarafından gönderilmeli (ölü işleyici yok). Ayrıca `ack` istisnası denetimden kaldırıldı — artık istisna gereken bir mesaj kalmadı |
| 73 | **Ölü dışa aktarımlar** üç taneydi; biri tamamen çağrılmayan bir **fonksiyon**du | `C.MOBILE_CAPACITY` ve `C.COLONY_GENERATION_TARGET` (sabitler) yanında: `randomGenome` (**hiç çağrılmıyordu**), `LifeDescriptors` ve `ExperimentSuiteReport` (tipler). Kullanılmayan bir dışa aktarım, "varmış gibi duran" bir özellik vaadidir — `LifeDescriptors`'ın yorumu üstelik **"üç betimleyici"** derken dört alan taşıyordu. `randomGenome` "rastgele başlangıç genomu" üretiyordu ama kurucu genomlar **başka** bir yolla üretiliyor (sabit taban + mutasyon), yani işlev hiçbir yerde kullanılmıyordu | Üçü de kaldırıldı. Koruma **genel**: `src/` altındaki **hiçbir** dışa aktarım kullanılmıyor olmalı; kullanılmayan bir dışa aktarım eklenirse test kırmızıya döner ve **adını** yazar. ⚠️ Korumanın **ilk sürümü kendi yorumuyla kandırıldı**: ölü tipin adı denetimin açıklama metninde geçtiği için "kullanılıyor" sayılıyordu — yorum bir **bağ** değildir, ölü kodu belgelemek onu yaşatmaz. Sayım artık **yorumlar temizlenmiş** koddan yapılıyor |
| 72 | Kaynak görüntüleme tavanı **7 yerde** elle yazılmıştı; `x > 0 ? 64 : 64` gibi **ölü bir koşul** vardı | `src/scene/Props.tsx` kaynak instancing kapasitesini `64` diye yazıyordu (4 `args`, 1 koşul, 2 `Math.min`) ve ayrıca `const maxField = fieldGeo.attributes.position.count > 0 ? 64 : 64;` ile `void maxField;` / `void base;` taşıyordu — yani **iki dalı da aynı** olan bir koşul. Tavan aşılırsa kaynak düğümleri **sessizce** düşüyordu. Ölçülen sınır: kod tabanında kullanılan en büyük `resourceCount` **34** (dünya varsayılanı) → tavan 64, pay %47, yani bugün bağlayıcı değil | Tavan `MAX_RENDER_RESOURCES` olarak `src/engine/limits.ts`e taşındı ve yedi yerde tek sabitten okunuyor. Ölü koşul ve `void` ifadeleri kaldırıldı. Tavanın yeterliliği **ölçümle** denetleniyor (dünya 34 kaynak üretiyor, tavan 64) ve tavan aşılırsa HUD'da **görünür** bir uyarı çıkıyor (telemetriye `resourceCount` eklendi) — hücre tavanıyla aynı davranış |
| 71 | Başlangıç popülasyonu ve **kullanıcıya görünen** eşik sayısı kaynaktan gelmiyordu | (a) `App.tsx` başlangıç popülasyonunu `48` diye yazıyordu; `C.DEFAULT_POPULATION` da 48 — iki bağımsız sayı. (b) İnceleme panelinin metni "4+ hücreli yapı" diyordu; eşik `C.MULTICELL_THRESHOLD` (4) — yani **eşik değişseydi arayüz yanlış sayı yazardı** | (a) `population: C.DEFAULT_POPULATION`. (b) Metin artık `{n}` yer tutucusu taşıyor ve render yeri `C.MULTICELL_THRESHOLD` ile dolduruyor. Koruma ikisini de denetliyor; mutasyonla doğrulandı (elle yazılan hâlleri geri konunca kırmızı) |
| 70 | İki **ölü deney** rapora alınırken **iki gerçek hata** bulundu | (a) `sweepShareThreshold`in okuma metni "Varsayılan 0,82'de aktarım **0**" diye **sert kodlanmıştı** ve artık yanlıştı: ölçümde 0,82 eşiğinde 4 tohumda **2.140 aktarım** vardı. Dahası cümle **kendi kendisiyle çelişiyordu** ("0,82 ilk kez tetikleniyor … 0,82'de aktarım 0"). (b) `experimentInWorldEvolution`ın **kontrol kolu** (arama **YOK**) kazanç olarak **−17,7** üretiyordu — yani gürültü, hatta negatif; tedavi kolunun ham kazancı ise yalnız **+3,3**, yani **gürültü tabanından küçüktü**. Sebep: taban örneği aramanın RNG akışından ayrı çekildiği için "bulunan" ile taban **farklı rastgele örneklemlerden** geliyor. Bu, §10/31'deki "maksimum yerine ortalama" hatasının **aynı sınıfı**, ters yönde | (a) Okuma artık **ölçülen veriden** türer: her eşikte "kaç tohumda tetiklendi" yazar (`liveSeeds`), tetikleme eşiğinin duyarlılığını **ölçülen** bir oranla bildirir ve zirve koloni sabitse "**tetikleme eşiği değişken, sonuç değişmiyor**" der. (b) Hüküm **net etkiye** bakar: etki = tedavi kazancı − **gürültü tabanı** (kontrol kolunun kendi kazancı). Ölçülen net etki **+21,1** ve iki farklı yapılandırmada kararlı (+21,1 / +21,9). Koruma: hüküm, kontrolün gürültüsü tedavi kazancından büyükse "işe yarıyor" **demez**; okuma metnindeki **yön** ile verideki yön aynı olmalıdır. Üç mutasyonla doğrulandı |
| 71 | Raporun **ilerleme numaraları** birbiriyle tutarsızdı | Koşucunun satırlarında elle yazılmış, birbiriyle **çelişen** paydalar vardı: "1/22 … 8/8 … 14/14 … 23/23". "14/14" **iki kez** geçiyordu (Faz B1b ve Faz C1) ve "22/22 dal" satırı "28/28"den **sonra** geliyordu. Yani paket kaç adımdan oluşuyordu, ilerleme çıktısı **söylemiyordu** — ve yeni bir bölüm eklemek elle 30+ satırı yeniden numaralamak demekti | Sayaç artık **kendini artırıyor** (`progress(...)`), payda tek yerde (`TOTAL_STEPS`) yazılı. Koruma: `TOTAL_STEPS` ile `progress(` çağrısı sayısı **eşleşmek zorunda** — mutasyonla doğrulandı (31 → 30 yapıldı → kırmızı) |
| 72 | Negatif sayılar raporda **çift işaret** üretiyordu | "kazanç +…" elle yazılınca negatif değerde "**+-12.739**" oluyordu (`fmt()` negatif sayıyı `-12.739` verir, metindeki "+" eklenir). Sessiz bir biçim hatası: okuyucu "12,739 kazanç" sanabilir | `stats.ts`e **işaretli** biçimlendirici (`fmtSigned`) eklendi ve kazanç gösteren yerlerde kullanıldı. Koruma: çift işaret (`+-`, `++`) üretilemez |
| 69 | `VALIDATION.md` §1 — **kendi test paketini anlatan bölüm** 145 test bayattı | §1'in başındaki özet blok "Test Files 4 passed (4) / Tests 151 passed (151)" diyordu. Bu blok, test dosyası sayısı 4 iken kopyalanmış bir **terminal çıktısıydı** ve o günden beri güncellenmemişti: gerçekte 12 dosya / 298 test. Aynı sınıftan §1.2 `tests/world.test.ts` için "22 test" diyordu, dosyada 29 vardı. Bu, projenin en görünür kendi-kendini-denetleyen bölümü — sayının bayatlaması orada en çok zarar verir | Sayılar kaynağa bağlandı: (a) §1 özet bloğunun dosya ve test sayısı, (b) her §1.x alt başlığının dosya bazlı test sayısı, (c) alt başlıkların anmadığı dosya adları **gerçekten var mı** — üçü de denetleniyor. Düzeltme elle değil `tools/sync-test-counts.mjs` ile yapılıyor: araç README, PROGRESS.md **ve** VALIDATION.md §1'i kaynaktan türetilen sayılarla yazıyor. İki mutasyonla doğrulandı (§1 özet bloğu 11'e, §1.2 sayısı 22'ye çevrildi → ikisi de kırmızı) |
| 68 | Ağ parametre sayısı **belgelerde** korunmuyordu — kullanıcıya görünen metin dâhil | `tests/mlp.test.ts` koddaki 140 sayısını ve formülü doğru koruyor, ama **belgeler** korunmuyordu. "140" **beş** yerde elle yazılıydı: `MODEL.md` (formülle birlikte), `PROGRESS.md`, `ROADMAP.md`, `VALIDATION.md` ve — **kullanıcıya görünen** — gözlemci panelinin i18n metni ("Gözlemci canlıların içindeki **140** parametreli ağdan AYRIDIR"). Mimari değişseydi (örn. girdi sayısı 12→14) hepsi sessizce yanlış olurdu; en kötüsü **arayüzün** kullanıcıya yanlış mimari anlatması | Koruma: sayı artık **koddan** (`MLP_SHAPE.PARAM_COUNT`) türetiliyor ve dört belge ile i18n metniyle karşılaştırılıyor; ayrıca `MODEL.md`deki formülün **her sayısı** (12·8 + 8 + 8·4 + 4) koddaki topolojiden türüyor. İki mutasyonla doğrulandı (belge ve arayüz metni 120'ye çevrildi → ikisi de kırmızı) |
| 67 | RNG akış sayısı **dört** idi, belgeler **üç** diyordu | `src/sim/rng.ts` başlığı "simülasyonun **üç** ayrı rastgele akışı vardır (`env`, `inherit`, `action`)" diyordu; `RngBundle` ise **dört** akış taşıyor: `env`, `inherit`, `action` ve **`evolve`**. Eksik olan akış, rastgele bir akış değil: `evolve` üstel arama pertürbasyonlarını taşıyor ve ayrı olması **şart** (`world.ts:2056` → `this.rng.evolve`; kod yorumu: "Ayrı akış olması **şarttır** … çatallanan dünyalar yanlış sebeple farklılaşır"). Yani yanlış sayı, **deney geçerliliğini** ilgilendiren bir alanda sessizce eksik bir akışı gizliyordu. Aynı yanlış sayı `docs/MODEL.md` §6 (Determinizm), `docs/ROADMAP.md` G3 ve `src/sim/experiments/index.ts`te (dünya akışları listesi) de vardı | Beş yerde de "dört" yapıldı ve `evolve` akışının **neden ayrı olması gerektiği** yazıldı. Koruma **genel**: akış sayısı artık **koddan** (`StreamName` birleşimi + `RngBundle` alanları) türetiliyor ve `MODEL.md`, `ROADMAP.md` ile kaynak modülün yazdığı sayıyla karşılaştırılıyor; ayrıca kanonik yerler akış **adlarını** da listelemek zorunda. İki mutasyonla doğrulandı (kaynak modül ve `MODEL.md` sırasıyla "üç"e döndürüldü → ikisi de kırmızı). ⚠️ Korumayı yazarken **iki tuzak** çıktı: (a) `/i` bayrağı yakalanan kelimeyi özgün büyük harfle döndürüyor ("Dört" → sözlükte yok), (b) `ROADMAP.md` tek satırlık bir özet olduğu için akış adlarını listelemiyor — kural dosyaya göre ayrıldı |
| 66 | Gözlemci panelindeki **iki tablo** sessizce kırpılıyordu | (a) Kanıt ölçümleri tablosu `measurements.slice(0, 24)` ile, (b) modelden çıkarılan sayı iddiaları `claims.slice(0, 20)` ile kırpılıyordu — **ikisinde de** kullanıcıya hiçbir şey söylenmiyordu. (b) gerçekten bağlayıcı olabilir: `extractNumericClaims` model metnindeki **her** sayıyı çeker, yani uzun bir yanıt 20'den fazla sayı üretebilir; kullanıcı "doğrulanamayan sayılar çıkarıldı" başlığı altında 20 satır görür ve bunların **hepsi** olduğunu sanar. Oysa "çıkarıldı" başlığı zaten bir kesme iddiası taşıyor | İkisi de ortak sabitlere (`OBSERVER_MEASUREMENT_LIMIT`, `OBSERVER_CLAIM_LIMIT`) bağlandı ve kırpma **görünür** kılındı ("İlk 20 / 47 sayı iddiası gösteriliyor"). Ölçüm: kanıt paketi bugün **14** ölçüm üretiyor (24'lük sınır bağlayıcı değil) — koruma bunu da ölçüyor. Koruma ayrıca panellerin **elle** sınır yazmadığını denetliyor; mutasyonla doğrulandı |
| 65 | Soy panelinin gösterim sınırı **simülasyondan bağımsız** yazılmıştı | `src/ui/Panels.tsx` soy listesini `lineages.slice(0, 12)` ile kırpıyordu; simülasyon ise soy sayısını `Math.ceil(founders.length / 12)` ile belirliyordu. İki "12" **ayrı ayrı** yazılmıştı ve hiçbir yerde birbirine bağlı değildi. Bugün panel kırpma yapmıyor — çünkü iki sayı da tesadüfen aynı — ama simülasyondaki tavan değişseydi panel **sessizce** kırpmaya başlardı ve kullanıcı "tüm soylar" sanardı | **ÖLÇÜLDÜ** (`tools/measure-lineage-cap.ts`; 40.000 tick, 7 senaryo: 5 tohum × p=48 ve 2 × p=192): tepe soy sayısı **12** — hiçbir koşuda 13 olmadı. Simülasyon soy sayısını **yapısal** olarak belirler (soylar kuruluşta doğar, sonradan doğmaz). Sayı artık tek yerden geliyor: `FOUNDER_LINEAGE_GROUPS` (`sim/genome.ts`) → simülasyonun gruplaması **ve** `LINEAGE_DISPLAY_LIMIT` (`engine/limits.ts`) → panelin gösterim sınırı. Kırpma yine de **görünür** kılındı ("İlk 12 / N soy gösteriliyor"). Koruma: (a) beş popülasyonda simülasyonun ürettiği soy sayısı panelin sınırını aşmıyor (anlık denetim — soylar kuruluşta doğar), (b) panel ve simülasyon **elle** sayı yazmıyor. İkisi de mutasyonla doğrulandı |
| 60 | Gözlemci özetinde **eşik sayısı kaybolmuştu** (bozuk karakter) | `src/worker/evidence.ts` içindeki "Şu ana kadar ␣ eşiğin üzerinde bağlı küme yok" cümlesinde `C.MULTICELL_THRESHOLD` (4) **yerine U+FFFD** vardı. Kullanıcıya **görünen** bilimsel metin "␣ eşiği" diyordu — yani eşiğin sayısı hiçbir yerde görünmüyordu. Aynı sınıftan ikinci bozulma `docs/VALIDATION.md` §6.8'deydi ("Dü␣eltme"). İkisi de **ilk commit'ten** (`636167c`) beri vardı; test hiç bu dala girmiyordu: `largestColonySize = 7` ≥ eşik 4 olduğu için bozuk metin üreten dal **hiç çalışmıyordu** | Sayı geri kondu; metin artık `${C.MULTICELL_THRESHOLD}` yazıyor, yani **kaynak sabitten** türer. Koruma **genel**: projedeki hiçbir metin dosyası U+FFFD içeremez (`tests/encoding.test.ts`, tüm ağaç taranır) + eşik dalının sayıyı içerdiğine dair doğrudan denetim. İkisi de mutasyonla doğrulandı (bozuk karakter geri konunca kırmızı; sabit sayı yazılınca kırmızı). ⚠️ Koruma **ilk çalıştırmada kendini yakaladı**: test dosyasının kendi yorumunda ham U+FFFD yazılıydı — yorum kaçışlı yazıldı |
| 61 | `C` kümesinde **iki ölü sabit** vardı; bir `WorldOptions` alanı **hiç okunmuyordu** | `MOBILE_CAPACITY` (96, "küçük mobil habitat kapasitesi") ve `COLONY_GENERATION_TARGET` (3, "raporlanan koloni üreme nesli hedefi") **hiçbir yerde kullanılmıyordu**; `WorldOptions.capacity` de bildirilmiş ama **hiç okunmuyordu** (geçen çağıran da yok). `energy.ts` başlığı "Tüm ayarlar tek yerde; MODEL.md bu değerleri belgeler" diyor — ama kullanılmayan bir sabit, **varmış gibi duran bir özellik** vaatidir: biri "mobil habitat 96 hücrelik" diye okur, diğeri "koloni 3. nesle kadar raporlanıyor" diye okur. İkisi de **yok** | Üçü de kaldırıldı. Koruma **genel**: `C` kümesindeki **hiçbir** sabit ölü olamaz — kullanılmayan bir sabit eklenirse test kırmızıya döner ve adını yazar. Mutasyonla doğrulandı (`MOBILE_CAPACITY` geri konunca kırmızı). Raporlar yeniden üretildi: sayılar **birebir aynı** çıktı, yani kaldırma davranışsal olarak nötrdü |
| 62 | **Görüntüleme sınırları sessizce kırpıyordu** | İki tavan vardı ve ikisi de **görünmez** bir kırpma üretiyordu. (a) `src/scene/Cells.tsx` karedeki hücreleri `Math.min(512, cellCount)` ile kırpar; HUD ise gerçek sayıyı yazar → **HUD ile sahne ayrışır**, kullanıcı farkına varamaz. (b) `Hud.tsx` canlı listesini `slice(0, 300)` ile kırpar ve başlıktaki sayaç **kırpılmış** sayıyı gösterir ("300" yazar, gerçekte 412 vardır) → kullanıcı "tüm canlılar" sanır. **ÖLÇÜLDÜ** (40.000 tick; 14 + 9 senaryo: 5 tohum × varsayılan p=48, p=192, yüksek rejenerasyon, besin ekleme, ikisinin birleşimi): en yüksek canlı hücre **266** (tavanın %52'si, pay %48), en yüksek canlı organizma **252** (tavanın %84'ü, pay **%16** — sıkı) | Tavanlar `src/engine/limits.ts` içinde **tek kaynağa** taşındı (sahne ve HUD aynı sayıyı okur; ikisi ayrı yazılırsa ayrışırlar). Kırpma artık **görünür**: HUD'da tavan aşılınca kırmızı "Görünüm sınırı" göstergesi (hover'da kaç hücrenin görünmediği), listede "İlk 300 / 412 kayıt gösteriliyor" notu. Tavanların yeterliliği `tests/caps.test.ts` ile **ölçümle** denetlenir: 12.000 tick'lik iki tohumda tepe ölçülür, tavan aşılırsa test kırmızıya döner ve gözden geçirme ister. Korumaların **beşi de mutasyonla kırıldı** (tavanlar küçültüldü → kırmızı) |
| 63 | Kanıt panelindeki avcı eşiği **izlenemeyen bir sabitti** | `src/worker/evidence.ts` içinde "yüksek seçilim baskısı" dalı `predator > 400` diye yazılmıştı; oysa avcı kapasitesi `C.PREDATOR_CAPACITY = 2400`. Sayının hiçbir sabitle ilişkisi yoktu: kapasite değişse bile eşik değişmezdi. **ÖLÇÜLDÜ** (40.000 tick, 9 senaryo): avcı enerjisi ortalama **108–187 e**, tepe **600 e** (kapasitenin %25'i) — yani dal **ölü değil**, gerçekten tetikleniyor; ama eşiğin dayanağı yoktu | Eşik `C.PREDATOR_CAPACITY / 6` olarak **türetildi** (2400/6 = 400, yani **değer korunur** — davranış değişmiyor, sayı artık izlenebilir). Ölçülen temel yorumda yazılı |
| 64 | Olay panelindeki "120" **üç ayrı yerde** yazılıydı | `EventsPanel` son 120 olayı gösteriyor, koşulu `> 120` ile yazıyor ve kullanıcıya "Son 120 olay gösteriliyor" diyor — üçü de **ayrı ayrı** yazılmıştı. Biri değişse diğer ikisi **yalan** olurdu (örn. dilim 400'e çıkarsa metin hâlâ "120" der) | Üçü de tek sabitten (`SHOWN_EVENTS`) türer |
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
| 15 | Bağ uzaması **hayatta kalanların** ortalamasıyla ölçülüyordu | Değer 0.010–0.029 çıktı ve "uzama açıklama değil" izlenimi verdi. Gerçekte **seçilim yanlılığı**: gerilmiş bağlar zaten koptuğu için hayatta kalanlar seçilmiş olarak düşük gerilimli. `bond-break.detail.strain` üzerinden kırılma anı ölçülünce medyan 0.066 çıktı ve kırılmaların %100'ü bütünlük tükenmesiyle olduğu görüldü (§5.3) |
| 14 | `probabilityOfImprovement` **ikinci kez** yanlış veriyle hesaplanıyordu | Değerlendirme koşularında öğrenme kapalı olduğu için metrik tanım gereği hep 0 dönüyordu; rapor "öğrenme ağırlıkları hiç hareket ettirmiyor" izlenimi veriyordu, oysa eğitimde hareket ediyordu | `learnedDeltaNorm` artık koşunun **kendi başlangıç ağırlıklarına** göre ölçülüyor; `thetaInjected` alanı eklendi; regresyon testi yazıldı |
| 22 | **`genomeDistance` adıyla üç ayrı tanım** yaşıyordu | Arayüz ve kanıt paketi **ham** toplam kullanıyordu, ölçüm **normalize** toplamı. Ham sürüm `senseRadius` (2..7) ile `motility` (0..1)'yi eşit tartıyor. Ölçüldü: 93 soy çifti, 8 tohum × 6.000 tick → büyüklükler neredeyse aynı (**ham/normalize ≈ 1,02**) ama **sıralamanın %76'sı değişiyor**, en büyük kayma **32 basamak**. Yani hata büyüklükte değil **bakış açısında** görünüyor. Arayüz etiketi ("Atasal → torun genom uzaklığı") hangi tanımı kastettiğini söylemediği için iki yüzey sessizce ayrışmıştı | Tek kanonik tanım `sim/genome.ts` içinde; `colony.ts` yalnızca yeniden dışa aktarıyor, arayüz ve kanıt paketi aynı fonksiyonu çağırıyor. Beş koruma testi eklendi (§10.1) |
| 23 | Worker protokolünde **dört genom alanı** `Record<string, number>` idi | Gevşek tip, worker sınırında eksik bir genom parametresinin sessizce taşınmasına izin veriyordu; soy paneli `labels[k] ?? k` yüzünden eksik satırı ham anahtarla gösterirdi. **Bu bir canlı hata değildi** — üretici (`genomeSummary`) eksiksiz çalışıyordu — tip güvenlik açığıydı | Alanlar `Genome` tipine bağlandı; eksik parametre artık derleme hatası |
| 24 | `sim/genome.ts` başlığı **"Sekiz kalıtsal parametredir"** diyordu | Genom dokuz parametreye çıktığında güncellenmemişti; modül kanonik tanımın evi olduğu için buradaki yanlış sayı özellikle yanıltıcıydı | "Dokuz" olarak düzeltildi; kaynak dokümanındaki parametre sayısı artık testle korunuyor |
| 25 | Rapor tazelik denetimi **commit edilmemiş** değişiklikleri görmüyordu | `colony.ts` değiştirilip rapor üretilmeden koşan `npm run check` **yeşil** geçti; aynı commit CI'da **kırmızı** oldu. Yerel kapı, tam da uyarması gerektiği yerde sessizdi — çünkü tarihi `git log`'dan okuyor | Denetim artık **değiştirilmiş** dosyada dosya mtime'ını esas alıyor. Yalnız *değiştirilmiş* dosyada: `actions/checkout` her dosyaya taze mtime verdiği için, mtime her zaman esas alınsa temiz bir CI klonunda denetim **daima** kırmızı olurdu |
| 26 | **Anlatı belgeleri dokuz parametre öncesinden** sayılar taşıyordu | `766e0b9` tüm ölçümleri geçersiz kıldı ve kabul edilen riskti; ama `VALIDATION.md` §4.2–4.5 ve `PROGRESS.md` deney tablosu eski koşuların sayılarını taşımaya devam ediyordu, **hiçbir denetim bakmıyordu**. En ciddisi: `PROGRESS.md` öğrenmeyi "❌ **negatif**" diye etiketliyordu ama kendi alıntıladığı `+0.020` fark ve `%83` iyileşme **pozitif** yöndeydi — etiket kendi kanıtıyla çelişiyordu. Taze ölçüm: fark **+0.001**, p **0,9764**, iyileşme **%51,8** = etki yok | Üç deneyin tablosu ve §4.2 habitat tablosu `EXPERIMENTS.md`'den yeniden yazıldı; kaynak ve pencere notları eklendi. Değerler artık **rapordan türetilen**, bölüm kapsamlı bir denetimle korunuyor |
| 27 | `EXPERIMENTS-DEEP.md` **2,9 gün** bayattı | Son üretim `1791719188`, dokuz parametreli genom ise `1791967248`'de geldi. Raporda "cooperation"/"işbirliği" geçişi **0** kez — yani **var olmayan bir genomu** raporluyordu. Tazelik denetimi yalnız `EXPERIMENTS.md`'yi izliyordu | Derin paket yeniden üretildi (2.072 koşu, 912 sn). Denetim eklendi — **ancak yanlış kapsamda:** genom **şeklini** izleyecek biçimde. O gerekçe ("40 dk'lık üretimin her kod değişikliğinde istenmesi denetimi işe yaramaz hâle getirirdi") **bu satırda da geçersizdir ve 43. satırda düzeltildi**: gerekli olan "her değişiklik" değil, "rapora giren değişiklik" idi |
| 28 | Telemetri alanı `resourcesLeft` **ölü ve yanlış**ydı | Her kare `Math.max(0, cellCount)` ile yazılıyordu — yani alan "kalan kaynak" adını taşıyordu ama **hücre sayısı** tutuyordu. Üstelik **hiçbir panelde okunmuyordu** (telemetrinin sıfır tüketiciye sahip tek alanı). Gerçek kaynak alanları `H.RESOURCE_COUNT`/`H.ROCK_COUNT` ve yalnız çizimde kullanılıyor | Alan kaldırıldı. `tsc` kullanılmayan `cellCount` yerelini de yakaladı — sıkı tip burada işe yaradı |
| 30 | Bir deney **ölçümü olmadan** "işe yarıyor" diyordu | `experimentInWorldEvolution` rapora **hiç bağlı değil** (ölü). Koşturulunca `forkScore`'un sentinel davranışı ortaya çıktı: organizma yoksa `-Infinity` dönüyor. Rastgele tabanda **tek bir** ölüm yeter → ortalama `-Infinity`, kazanç `+Infinity`, `Infinity > 0` **doğru** → deney "canlı dünyanın dalında da işe yarıyor" diyordu. **ÖLÇÜLDÜ** (tohum 11, `generations: 0`): taban `-Infinity`, kazanç `+Infinity`, hüküm **olumlu** — ölçümün kendisi yoktu | Hüküm saf bir fonksiyona çıkarıldı (`readInWorldEvolution`) ve sonlu olmayan değerde **hüküm vermeyi reddediyor**. Aynı yapılandırma sonrası: "ÖLÇÜLEMEDİ ... aritmetik artefakttır, kanıt değildir". 3 test (NaN / ±Infinity / sonlu-pozitif / sonlu-negatif) |
| 34 | Erişilebilirlik tercihi **sessizce yok sayılıyordu** | `systemPrefersReducedMotion()` yazılıydı ama **hiç çağrılmıyordu**: `localStorage` boşken doğrudan `false` dönülüyordu. Yani `prefers-reduced-motion: reduce` ayarlı kullanıcı **tam animasyonlu** sahneyi görüyordu. Özelliğin kendisi (ayarlar düğmesi, shader 0,15× yavaşlatma, efekt kapısı) çalışıyordu — yalnız başlangıç değeri sistemden gelmiyordu | `loadReducedMotion()` artık öncelik sırasını uyguluyor: **kullanıcının kayıtlı seçimi → sistem tercihi → kapalı.** Kullanıcı bir kez dokunduysa seçimi kalıcıdır ve sistem tercihi onu **ezmemeli**. Koruma testi eklendi ve bozularak doğrulandı |
| 37 | Deney düğmeleri **çalıştırmıyor** ama çalışıyormuş gibi gösteriyordu | Worker'daki `runExperiment` yalnızca `{ queued: true }` yankılıyor; hiçbir deneyi başlatmıyor ve `experimentResult` mesajının **hiçbir abonelisi yok**. Buna rağmen panel "Üç deney uygulamada çalışır" diyordu, düğme 400 ms sahte "Çalışıyor…" gösteriyordu ve sonuç alanına aynı anda **"Çalışıyor… Bu deney henüz çalıştırılmadı."** yazılıyordu — kendi kendini çürüten bir iddia | İlerleme taklidi kaldırıldı, `hint` ve yeni `notWired` metni gerçeği söylüyor: deneyler `npm run experiments` ile Node'da koşar. Koruma **koşulsuz**; worker'ı bağlayan kişi onu bilerek güncellemek zorunda |
| 42 | **Sözleşme doğrulanamıyordu:** "her parametre bedeli var" | `MODEL.md` "Her parametrenin metabolik maliyeti vardır (`basalCostFor`)" diyor — ama `bondAffinity` `basalCostFor` içinde **YOK**. Doğrulayan biri onu arar ve bulamaz, sözleşmenin yalan olduğunu sanır. Gerçek: maliyeti **dolaylı** — daha çok bağ kuruluyor (`rng.float() < genome.bondAffinity`) ve bağ başına bakım enerjisi ödeniyor. Yani bedeli var, ama kendi satırında değil | İfade düzeltildi ve kural **korundu**: her genom parametresi ya `basalCostFor` içinde doğrudan maliyetli olmalı ya da gerekçeli muafiyet listesinde (şu an yalnız `bondAffinity`) bulunmalı. Mutasyonla doğrulandı: sahte bir 10. parametre eklendi → "hiçbir yerde maliyeti olmayan genom parametresi: denemeParametresi" |
| 43 | `EXPERIMENTS-DEEP.md` tazelik denetimi **yanlış bağımlılığı** izliyordu | Denetim, genom **şeklini** izliyordu (`types.ts` + `genome.ts`) ve **yeşildi** (1791967248 / 1791990294 < DEEP 1791993714). Gerçek bayatlık ise ölçüm kodundaydı: `scripts/run-experiments.ts` ve `src/sim/experiments/*`, DEEP üretiminden 2 gün sonra değişmişti. Sonuç: DEEP, bu oturumda **iki kez yanlışlanmış** bir kazancı (**0.215**) yayımlıyordu; güncel değer 0.032. Gerekçe "40 dk'da her kod değişikliğinde yeniden üret" idi — bu, **ölçüm kapsamı ile kod kapsamını karıştırmaktı** | Denetim artık **türetilmiş ölçüm kümesini** izliyor (`reportInputFiles()` — `src/ui/`, `src/scene/`, `src/engine/`, `src/worker/` dışarıda). Mutasyonla doğrulandı: eski küçük küme yeşil, yeni küme kırmızı |
| 44 | §5.11–§5.16 **iki gündür** DEEP'ten ayrılmıştı; **iki hüküm ters döndü** | 14 Ekim'de DEEP yeniden üretildi, §5.11–§5.16 **güncellenmedi**. §5.11 tablosu hiçbir sütunda uyuşmuyordu (40k: 41/246/110/18 ↔ 29/235/98/25). **§5.13** "10× dayanıklılık son popülasyonu 36→52 yapıyor (+%44)" diyordu, gerçek **33→26 (−%21)**. **§5.16** "rejenerasyon popülasyonu kurtarmıyor" diyordu, gerçek **26→55 (+%112)**. §5.13 metni ayrıca **kendi tablosuyla çelişiyordu** ("4+ yapılar sıfır" ↔ tablo 13). §5.14'ün "güncel cevabı" tablosundaki üç satırın üçü de yanlıştı | Dördü de yeniden ölçüme göre yazıldı ve **ters dönen hükümler açıkça geri çekildi**. Bağ için koruma: §5.11 tam tablo eşlemesiyle, §5.12/§5.13/§5.15/§5.16 nüfus sütunuyla DEEP'e bağlandı. Dördü de mutasyonla doğrulandı (dört sayı `99` yapıldı → dört kırmızı) |
| 45 | Üretilmiş raporda **aynı cümle iki kez** geçiyordu | `run-experiments.ts`in "Uzun vadeli dayanıklılık" metin dizisinde 548. ve 549. satır aynı cümleydi; dizi boşlukla birleştirildiği için **her iki raporda** cümle iki kez çıktı. Sayısal hata değil — üretilmiş belgenin kendisi çürüktü | Satır silindi. Koruma: raporun anlatı satırlarında **önceki satırın sonu** olan bir satır varsa denetim kırmızı. Korumanın **kendisi de** boştu: `expect` döngü içindeydi, ilk raporda fırlatıp DEEP'e bakmayı kesiyordu; iki rapor birden toplanıp tek seferde doğrulanıyor |
| 59 | Kanıt denetiminin **anlam sınırı gizli kalmıştı**: §9 listesinde yoktu | `verifyNumericClaims` model yanıtındaki sayıları kanıt paketiyle **değer** olarak karşılaştırır; sayının **neyi** saydığını anlamaz. Ölçülen sınır: "Bu 3 organizma bağ kurdu" cümlesindeki 3, `bondCount = 3` ile eşleşip **doğrulanmış** geçiyor. Dönen `unit` de ölçümün birimi, iddianınki değil — yanlış birim da yakalanmıyor. Yani "doğrulanmış" rozeti, iddianın **anlamının** doğruluğunu değil yalnız **sayısal** eşleşmesini anlatıyor. Kod yorumu bunu açıkça "sessiz yanlış kabul" diye yazıyordu — ama sınır **yalnız orada** ydı; §9 "Doğrulanmayanlar" listesinde yoktu ve README "eksik doğrulamalar gizlenmedi" diyordu. | §9'a 13. madde eklendi: ne yapılmadığı (kanıt paketine ölçümün adı/niceliği de taşınıp metinle karşılaştırılmalı) ve vaat edilmediği açıkça yazıldı. Koruma bu maddeyi **zorunlu kılıyor** ve `evidence.ts`deki sınır notunun kaybolmamasını da denetliyor. Genel desen: bir ölçüm sınırı **kod yorumunda gizliyse**, o sınır yapılmamış bir ölçüm gibi davranır |
| 58 | README projenin **kendi kapısını** yanlış anlatıyordu | "Sürekli doğrulama" bölümü "tip denetimi + **201 birim testi + 6 tarayıcı testi**" diyordu; gerçekte **276 + 11** ve `npm run check` ayrıca `npm run calibrate` adımını da çalıştırıyor. Yani projenin doğrulama kapısını anlatan metin, kapının kendisinden geride kalmıştı. | Koruma iki şeyi türetiyor: (a) tarayıcı testi sayısını `e2e/*.spec.ts` içindeki `test(` tanımlarından sayıyor ve README ile karşılaştırıyor, (b) `package.json`daki `check` script'ini `&&` ile bölüp **her adımın** README'de anıldığını doğruluyor — yani kapıya eklenen bir adım sessizce belgelenmeden kalamıyor. Mutasyonla doğrulandı (11 → 9 yazıldı → "e2e dosyalarında 11 var"). Aynı taramada kalan iki panel de denetlendi ve **temiz** çıktı: `LineagePanel` kanonik `genomeDistance`'ı kullanıyor ve sabit sayı taşımıyor, `InspectorPanel`da sabit sayı yok |
| 57 | Deney panelindeki **bütçe sayıları hiçbir yerden türetilemiyordu** ve kullanıcıya yanlış gösteriliyordu | Panel "Bütçe: 2.000 eğitim + 1.000 değerlendirme kararı" diyordu. Ölçüldü: sweep tam koşuda **6.000 eğitim + 4.000 değerlendirme tick** kullanıyor ve `DECISION_EVERY_TICKS = 10` olduğundan karar sayısı 6.000/10 = **600** ve 4.000/10 = **400**. Yani gösterilen iki sayı da yanlıştı; hiçbir yapılandırmadan türetilemiyorlardı. Bu kez kusur bir yorumda değil **kullanıcıya gösterilen metinde**. | İki dilde gerçek değerlerle değiştirildi ("tohum başına"). Koruma sayıyı artık **koddan türetiyor**: `DECISION_EVERY_TICKS` ve `sweepLearning`'in tick ayarları okunup bölünüyor ve panel metni bu türetilmiş sayıları taşımak zorunda. Mutasyonla doğrulandı (`DECISION_EVERY_TICKS` 10 → 20 yapıldı → beklenen 300/200 çıktı, paneldeki 600/400 uyuşmadı). ⚠️ Korumayı yazarken ilk regex `sweepLearning`in **quick dalını** (900/600) yakalayıp 90/60 türetiyordu; artık tüm çağrılar taranıp **en büyük eğitim tick'li** blok (tam koşu) seçiliyor |
| 56 | Deney panelinde tohum satırının **etiketi değerinin aynısıydı** | `ExperimentsPanel` tohum tablosunda `<dt>` (etiket) ve `<dd>` (değer) **aynı** anahtarı basıyordu; ekranda "1–20   1–20" ve "1001–1020   1001–1020" görünüyordu. Yani okuyucu hangisinin **eğitim**, hangisinin **değerlendirme** tohumu olduğunu göremiyordu. Etiket anahtarları (`trainSeedsLabel`, `evalSeedsLabel`) i18n'de **hiç yazılmamıştı**; değerlerin kendisi doğruydu (VALIDATION §4: eğitim tohum 1..20, değerlendirme 1001..1020) | İki dilde etiket anahtarları eklendi ve `<dt>` etiketleri kullanıyor. Koruma: `<dt>`/`<dd>` **farklı** anahtar kullanmalı ve etiket anahtarı `Label` ile bitmeli — yani yazının varlığını değil **ayrılmasını** denetliyor. Mutasyonla doğrulandı (etiket anahtarı geri alındı → "aynı anahtarı kullanıyor: etiket okunmuyor"). Aynı denetimde panelin **"bu düğme deneyi çalıştırmaz"** iddiası da doğrulandı: `run()` yalnız `setResult(notWired)` çağırıyor, hiçbir şey göndermiyor — iddia doğru |
| 55 | Olay panelinin yorumunda **kaynağı olmayan** üç sayı vardı | `EventsPanel` başlığı "12.000 tick'te 7.088 öğünme güncellemesi, 603 ölüm, 302 tomurcuk ayrılması" diyordu. **Üçü de ölçüldüğünde yanlış çıktı** (varsayılan ayarlar, tohum 20261006, 12.000 tick): `learning-update` **1.727**, `death` **129**, `bud-separation` **9**. Ayrıca hiçbiri raporda **izlenemiyordu** (`7.088` iki raporda da 0 kez) — yani kaynağı yoktu, elle yazılmış birer uydurma sayıydı. İkinci hata türü daha ince: sayılar "üretilen toplam" izlenimi veriyordu, oysa halk tamponu 2000 kapasiteli (`world.events`) ve 12.000 tick'te çoktan sarılmıştı; ölçülen toplam tam olarak **2000**. | Yorum ölçülen değerlerle ve **sarma uyarısıyla** yeniden yazıldı. Aynı taramada `genome.ts:176`'daki "93 soy çifti, %76 sıralama değişimi" iddiası denetlendi: **izlenebilir** (VALIDATION §10, 22. satır) — dokunulmadı. `mlp.ts`'in 140 parametre / 128 ağırlık sayıları da aritmetik olarak doğrulandı (12×8+8+8×4+4 = 140) |
| 54 | "Temizle" düğmesi **kalıcı değildi**: olay listesi ~1,2 saniyede geri doluyordu | `EventsPanel` 8 panelden biri ve **hiçbir test onu açmıyordu**. Düğme yalnız istemci deposunu sıfırlıyordu, oysa günlüğün sahibi **worker**'dı (`world.events`, `RingBuffer<SimEvent>(2000)`) ve panel 1.200 ms'de `listEvents` gönderiyordu. Kullanıcı "Olay listesi temizlendi" bildirimini görüyor, ~1,2 sn sonra liste **doluydu**. "Kaydet" düğmesinin görünür iz bırakmamasıyla **aynı sınıf** | Temizlik worker'a taşındı: protokolde `clearEvents`, `SimClient.clearEvents()`, worker'da `w.events.clear()` + anında boş yanıt. Mutasyonla kanıtlandı (`client.clearEvents()` kaldırıldığında kırmızı). ⚠️⚠️ **Bu turda testi DÖRT kez yanlış kurdum — hepsi teste yazıldı.** (1) "liste hep boş kalır": ürün böyle davranmamalı, CI'da kırıldı. (2) "eski kayıtlar görünmüyor": hızlı koşuda eski kayıt zaten görünen 120'lik listeden **kayıp gidiyor**, mutasyonda yeşil kaldı. (3) `eventsTotal` "azaldı": düğme depoları iyimser sıfırladığı için sayaç **zaten** 0'a düşüyor. (4) Hız bağımlı karşılaştırma: CI'da temizlikten sonra 4 sn'de sayaç 47 → 74 büyüdü ve test kırıldı — **ürün doğruydu**, ölçüm yanlıştı. Son çözüm: **simülasyonu durdurarak** ölçmek. Duraklatılmış halkta yeni olay üretilmediği için "temizlikten sonra sayaç 0'da kalır" iddiası belirlenimci ve hızdan bağımsız. Duraklatmadan önce ≥10 olay biriktiriliyor ki kanıt marjı 1'e düşmesin. Ayrıca kanıtlanamayan bir `seq` koruması eklenmişti; o yarış **yok** (worker tek iş parçacıklı, `postMessage` sırayı korur) ve karmaşıklık olarak geri alındı |
| 53 | **Kabul edilmiş ama görünmez** bir istisna vardı; artık belgede işaretli | §4.6–4.12 taramasında tek izlenemeyen değer, "Yaşam içi REINFORCE (75 güncelleme)" satırının **p = 0.010**'u. Bu ölçüm pipeline'ın **dışında** elle ad-hoc yapılmış ve belgede "**raporda YOK**" diye yazılmıştı — yani dürüstlük zaten vardı, ama **makine tarafından görünmüyordu**: hiçbir denetim "bu satır istisna" diyemiyor, dolayısıyla ileride aynı türden ikinci bir kaynak kaybı sessizce geçerdi. Satır artık kalıcı bir işaret taşıyor: **`pipeline dışı ölçüm`** | Genel p-değeri denetiminin kapsamı §4.6–§4.12'yi de kapsıyor ve bu işareti tanıyor — yani "açıklanmamış kaynak" ile "belgelenmiş istisna" ayrımı otomatik. Muafiyet böylece **görünür** kalıyor: işareti kaldırıldığında denetim kırmızıya döndü (mutasyonla doğrulandı) |
| 52 | §5.8 **hükmü ters yöne** kaymıştı: bölüm yalnız standart pencereye bakıyordu | §5.8 Y-2'nin **40.000 tick'lik** ölçümünü anlatıyor, ama denetim ve düzeltme **yalnız 12.000 tick'lik** (`EXPERIMENTS.md`) pencereye bakıyordu; derin ölçüm `EXPERIMENTS-DEEP.md`'de üretiliyor ve bölüm onu hiç görmemişti. Ölçülen fark: bölüm **kontrol −0.0112 / tedavi −0.0056** ve hüküm "ölçüt karşılanmadı" diyordu; DEEP'te **kontrol +0.0037 / tedavi +0.0083** [0.0026, 0.0145], fark +0.0046 [−0.0056, +0.0131], p = 0.3302 ve hüküm **"ölçüt KARŞILANDI — kayma sıfırdan ayrışıyor"**. Yani bölüm sayıyı, **yönü** ve **hükmü** yanlış taşıyordu. Gerçek bulgu: Y-2'nin sonucu **pencereye bağlı** — 12.000 tick'te ayrışmıyor, 40.000 tick'te ayrışıyor | §5.8 derin sayılarla yeniden yazıldı, **pencere bağımlılığı tablo hâlinde** açıkça gösterildi ve README'nin "❌ başarısız" satırı pencere notuyla güncellendi (⚪ pencereye bağlı). Koruma eklendi: §5.8'in farkı, aralığı ve p-değeri DEEP'in Y-2 satırından türetiliyor. Mutasyonla doğrulandı (eski değerler yazıldı → kırmızı). ⚠️ Korumayı yazarken **virgül normalizasyonu** aralık ayracını bozdu (`[−0.0056, +0.0131]` → `[-0.0056. +0.0131]`); virgül aynı zamanda liste ayracı olduğu için bu bölümde çevrilmiyor |
| 51 | **`PROGRESS.md` de** rapora bağlı değildi; yedi bayat sayı taşıyordu | README tablosu düzeltilirken (50. kayıt) fark edildi: ikinci anlatı belgesi **aynı hastalığı** taşıyordu — mutasyon+seçilim **p 0,097 → 0,3035**, popülasyon-ES **fark −0.00065, p 0.80 → −0.00244, p 0.1288**, işbirliği kaymaları **−0,007/−0,008 → −0,0063/−0,0072**, yaşam haritası **7/27, %52 → 8/27, %50**, üreme **166 → 41 → 213 → 29** (iki yerde), Y-2 **p 0.343** (güncel raporda p-değeri **yok**, aralık sıfırı içeriyor). En kötüsü: 12 tohumluk ölçüm tablosunun **üç sayısının hiçbiri** (`+12,5`, `−0,67`, `p = 0,59`) güncel raporda bulunmuyordu — yani ölçüm artık **hiç üretilmeyen** bir deneydi; güncel ölçüm tepe küme farkını tam **0,00** buluyor | Tümü rapora karşı yeniden ölçüldü ve düzeltildi. Koruma: README için yazılan p-değeri izlenebilirliği denetimi **PROGRESS'a da** uygulandı. ⚠️ İlk denemede koruma **kendi yazdığı düzeltme notunu** ("önceden … p = 0,59 yazıyordu") yakaladı — yani düzelttiğim hatayı geri getirmiş gibi gördü. Depodaki kırık "%83" korumasının çözümü uygulandı: **refutasyon işareti taşıyan paragraflar** (önceden/bayattı/geçersiz/düzelt) denetimin dışında. Mutasyonla doğrulandı: uydurma `p = 0,0999` yazıldı → kırmızı |
| 50 | **README'nin iddia tablosu** rapora hiç bağlı değildi; **dokuz** sayı bayattı | Bu tablo projenin en görünür sayı kaynağı ve `VALIDATION.md`'deki düzeltmelerden **hiç etkilenmiyordu**. Ölçülen sapma: evrimsel arama **+0.161 → +0.032** (manşet satırı), yaşam haritası **7/27,%52 → 8/27,%50**, üreme çöküşü **pop 166→41 → 213→29**, uzun vadeli kalibrasyon **"kısmi hafifletiyor" → "hafifçe kötüleştiriyor"** (yön bile değişti), mutasyon+seçilim **p 0.097 → 0.3035**, yaşam içi öğrenme **p 0.333 → 0.9764** (fark +0.001), Popülasyon-ES **p 0.80 → 0.1288**, bağ gücü **"2.33→21.25" → 2.08→19.17** (eski sayılar aslında **güven aralığının üst sınırlarıydı**, nokta tahminleri değil), B1b **"ölçüt karşılandı, 4+ yapı 0→0.25" → ölçüt karşılanmadı, dört kademede de 0.000**, işbirliği aktı **+11,4/+0,6 → +10.9/+0.1**, cooperation kayması **−0.007/−0.008 → −0.0063/−0,0072**, MODES yenilik **%37→%0,9 → %40→%4,6**, Y-2 **"kayma −0.006, p=0.343" → −0.0006** ve raporda **p-değeri hiç yok**. Hiçbiri bir denetime bağlı olmadığı için sessizce kalmıştı | (1) README'nin evrimsel kazancı, yaşam haritası doluluğu ve üreme son popülasyonu **rapordan türetilerek** karşılaştırılıyor. (2) Tablodaki **her p-değeri** raporda sayısal olarak izlenebilmeli — biçim farkı için basamağa yuvarlama toleransı var (`p = 1,00` ↔ rapor `1.0000`); ilk sürüm dize eşleştiriyordu ve ikisini de "izlenemeyen" sayıyordu, ikinci sürüm tabloyu `\| ⚪ \|` diye arıyordu ve **0 satır** bulup sessizce geçiyordu. İkisi de mutasyonla yakalandı. Ayrıca bayat sayı üç **kod yorumunda** da vardı (`evolutionLab.ts`, `world.ts`, `experiments/index.ts`) — `src/sim/` altındaki bu dosyalar **hiçbir testin ulaşmadığı** için yorumları da denetlenmiyordu |
| 49 | IndexedDB deposu **hiç test edilmemişti**; üç sessiz hata vardı | `src/engine/storage.ts` ne `tests/` ne `e2e/` tarafından bir satırına dokunuluyordu; §7.1 de "IndexedDB kaydet/yükle tarayıcıda doğrulanmadı" diyordu. **(a) `tx()` bağlantıyı yalnız `oncomplete`'te kapatıyordu** — iptal edilen işlemde `oncomplete` tetiklenmez, `db.close()` hiç çağrılmaz, **bağlantı sızıntısı** olur (kota/kısıt hatalarında tekrarlayan yazmalar havuzu tüketir). **(b) `pickJsonFile()` kullanıcı pencereyi iptal ederse söz hiç çözülmüyordu** — `oncancel` yoktu, `await` sonsuza dek asılı kalıyordu. **(c) "IndexedDB'ye kaydet" düğmesi listeyi tazelemiyordu**: kaydetme worker mesajıyla **panel dışında** tamamlanıyor, `useEffect(refresh, [])` boş bağımlılıkla yalnız bir kez çalışıyor — kullanıcı kaydediyor, listede **hiçbir şey görünmüyor**. Silme düğmesi `.then(refresh)` çağırdığı için bu asimetri sessizce geçiyordu | (a) bağlantı `complete`, `abort` ve `error` üç yolunda da kapatılıyor (IDB kuralı: bir işlem tam olarak biri). (b) `input.oncancel` eklendi. (c) store'a `recordVersion` sayacı eklendi, `App.tsx` başarılı kayıtta artırıyor, panel `useEffect(refresh, [recordVersion])` ile tazeleniyor — yoklama yok, olayın kendisi sinyal. `e2e/storage.spec.ts` (3 test): **eylem gerçek arayüzle, doğrulama ham IndexedDB ile** (React durumu değil). İlk deneme modülü `import('/src/engine/storage.ts')` ile çağırmayı denedi ve **çalışmadı**: e2e `vite preview` üzerinden üretim yapısını sunuyor, ayrıca `tsconfig` `e2e/`'yi kapsadığı için o satır **build'i** düşürüyordu. İki mutasyonla sınandı: `oncancel` kaldırıldı → yalnız ilgili test kızardı; kaydetme sinyali boşaltıldı → kaydetme testleri kızardı. **Dürüstlük notu:** bağlantı sızıntısı düzeltmesi (a) e2e ile **kanıtlanmıyor** — başarılı işlemlerde `oncomplete` de ateşlediği için düzeltme geri alınsa da testler yeşil kalır; iptal yolunu tarayıcıda güvenilir tetiklemek pahalı. Dayanak kural bazlı, sınır testte açıkça yazılı |
| 48 | Niş kalibrasyon aracı **kaynak gibi gösteriliyordu ama hiçbir şeyi beslemiyordu** | `tools/calibrate-niche-axes.ts` başlığı "`ecology.ts` içindeki `NICHE_SPEED_MAX`/`NICHE_SIZE_MAX` sabitleri **bu dosyanın çıktısından** gelir" diyordu. **Doğru değildi:** `ecology.ts:2856-2857` bu ikisini `LIFE_SPEED_MAX`/`LIFE_SIZE_MAX`'a **takma ad** yapıyor, asıl sabitler `lifeMap.ts:31-33`'te elle yazılmış. Daha kötüsü araç `NICHE_SPEED_MAX = 0.12` değerini **şablonda sabit** basıp "gözlenen maks X üzerinde" diye **doğrulanmayan** bir yorum yayımlıyordu — dağılım yukarı kayarsa aynı yanlış cümleyi basmaya devam ederdi | Araç artık iddia eden bir yazı değil **denetim**: gerçek sabitleri `lifeMap.ts`'ten içe aktarıyor, ölçülen dağılımla **karşılaştırıyor** ve bulgu varsa **çıkış 1** veriyor. Boş küme `-Infinity` yapıp geçmesin diye sonlu olma da ayrıca denetleniyor. **ÖLÇÜLDÜ** (5 tohum × 12.000, macOS/arm64): gözlenen maks **0.1117**, tavan 0.12 → pay **%6,9**; raporun kendisi o koşuda **tavana kırpılan 2 gözlem (%0,1)** yazıyor. `npm run calibrate` ile **kapıya bağlandı** (CI `npm run check` kullandığı için otomatik). Mutasyonla doğrulandı: tavan 0.09 yapıldı → gözlemlerin %3,02'si tavana ulaşıyor → çıkış 1; yapısal sayaç da sınır düşürülerek ayrıca sınandı (2 organizma → çıkış 1). **⚠️ Kendi denetimim ilk sürümde yanlıştı ve CI onu yakaladı:** boyut kontrolü `Math.log2(s) >= LIFE_SIZE_MAX` idi; oysa `LIFE_SIZE_MAX = log2(MAX_ORGANISM_CELLS)`, yani tam sınırda olmak **kırpma değil tasarımdır**. Linux/x64 koşusunda 9 organizma tam 24 hücreye ulaştı ve "tavan aşıldı" sanıldı; macOS/arm64'de ulaşan yoktu (maks 20) — yani denetim **platforma göre farklı hüküm** veriyordu. Düzeltildi: ölümcül olan artık *yapısal sınırın aşılması* (deterministik kural, tek biri bile hata) ve *hız kırpmasının %1'i aşması*; tavan payı yalnız uyarı. **ÖLÇÜLEN PLATFORM FARKI** (aynı tohum/tick/kod): macOS/arm64 n=1158 · maks hız 0.1117 · maks boyut 20 — Linux/x64 n=1183 · maks hız 0.1014 · maks boyut 24. Ölçüm platformlar arasında **birebir aynı değildir** (transcendental fonksiyonlar); değişmez kontroller arena/koloni'yi kapsayıp bu yola uzanmıyor, eşikler buna göre seçildi |
| 47 | Gözlemci sunucusu **hiç test edilmemişti**; içinde iki sessiz hata vardı | `server/index.ts` ne `tests/` ne `e2e/` tarafından bir satırına dokunuluyordu ve `src/`/`scripts/` dışında olduğu için içe aktarma grafiği denetimi de onu görmüyordu. **(a) Yanlış etiket:** `sourceMode: PROVIDER === 'local' ? 'local-summary' : 'language-model'` yazıyordu ama `callProvider` her durumda koşuyordu — yani sunucu dil modelini çağırıp yanıtı *yerel özet diye* etiketliyordu. `CTM_PROVIDER` belgelerde hiç geçmiyordu. **(b) Sunucu tüm arayüzlere açıktı:** `server.listen(PORT)` host vermezse Node `::`/`0.0.0.0`'a bağlanır; README ve başlangıç günlüğü ise `http://127.0.0.1:8787` diyordu. Aynı ağdaki biri bu dosyanın "bypass edilemez" dediği API anahtarını kullandırabiliyordu | Sunucu `'127.0.0.1'`'e sabitlendi; `sourceMode` koşulsuz `'language-model'` oldu. `tests/server.test.ts` yazıldı (7 test): gerçek alt süreç, sahte OpenAI-uyumlu sağlayıcı, anahtarsız 503 yolu, anahtarın istemciye sızmaması, istemcinin sağlayıcı/model belirleyememesi ve **ağ bağlama** iddiası. İkisi de mutasyonla doğrulandı: etiket geri alındı → kırmızı; bağlama geri alındı → "sunucu 192.168.1.43 üzerinden ERİŞİLEBİLİR" kırmızısı |
| 46 | §1.4 deney testi sayısı **23 eksik** sayılıyordu | Bölüm "`tests/experiments.test.ts`, 94 test" diyordu; dosyada **94** vardı. Bölümün konusu zaten "deney yükünün doğruluğunu doğrular" olduğuna göre kendi kanıt sayısının bayat kalması tam olarak bu bölümün iddiasını yanlış gösteriyordu. Aynı sınıfın bir başka örneği: §4.2'nin arena headroom tablosu da `EXPERIMENTS.md`nin bir **elle kopyasıydı** ve koruması yoktu (şu an uyuşuyor) | Sayı kaynağa bağlandı: denetim `it(` sayımını yapıyor (koşucuyla birebir: 94). §4.2 de rapora bağlandı. İkisi de mutasyonla doğrulandı — sayı `71` ve kontrol skoru `0.999` yapıldı → ikisi de kırmızı |
| 41 | **Eksik kapı:** değişmez kontroller kırıkken 22 deney yine koşuyordu | `runInvariants()` "sayılar bu kontrollerden biri kırıkken **geçerli sayılmaz**" diyor; pipeline ise yalnızca **yazdırıyor**, `passed` alanına bakmıyordu. Kırık bir değişmez olsa süreç sıfırla çıkıp 22 deneyin sayıları rapora giriyordu. ✗ raporda görünür olsa da **kapı yoktu** — görünürlük kötülük değil, kapı eksikliğiydi. Üstelik onu koruyan test de BOŞTU: `expect(`${c.name}: ${c.detail}`).toBe(`${c.name}: ${c.detail}`)` — aynı ifadeyi kendisiyle karşılaştırıyordu | Pipeline artık kırık değişmezde **çıkış 1** ile duruyor ve hangi kontrolün kırık olduğunu stderr'e yazıyor. Teşhis için `--allow-invariant-failure` kaçışı var; o zaman da gürültülü uyarıyla devam ediyor. Test artık `passed` alanını gerçekten kontrol ediyor. İkisi de mutasyonla doğrulandı |


| 40 | **Boş koruma:** "halka tamponu sınırsız büyümüyor" **kıramıyordu** | Ölçüldü: 3.000 tick sonrası olay sayısı **728**, kapasite **2000**. Tampon sınırına hiç ulaşmıyor; sınırsız büyüseydi bile 728 < 2000 olurdu. Dahası `RingBuffer.count` zaten kapasitede sınırlı olduğu için o doğrulama **sınıfın kendisi tarafından garanti** ediliyordu. Test yorumu "3000 tick kapasiteyi aşar" diye yazılmıştı; bu varsayım yanlıştı | Koruma yeniden yazıldı: doğrudan `RingBuffer` üzerinde **hangi** öğelerin tutulduğu sınanıyor (kapasite 3'e 5 öğe → `[3,4,5]`, en eski düşer), ayrıca dolmadan sıra korunumu ve geçersiz kapasite reddi. Dünya düzeyindeki bağlantı sınaması ayrı ve dürüst adıyla tutuldu. Mutasyonla doğrulandı |
| 39 | Ölü deney boru hattının **tamamı** kaldırıldı | Sahte `runExperiment` komutu, `experimentResult` mesajı, protokol üyeleri ve istemci metodu — dördü de hiçbir işe yaramıyordu. Worker artık "sıraya alındı" yalanını hiç söylemiyor; düğme yalnız gerçeği söylüyor | Yeni koruma: **worker'ın ürettiği her mesajın bir tüketicisi olmalı** (bu sınıfın iki üyesi vardı: `events` ve `experimentResult`). `ack`/`pong` işlenmemiş altyapı olduğu için gerekçeyle istisna. Mutasyonla doğrulandı |
| 38 | Korumanın kendisi **boş çıktı** (mutasyonla yakalandı) | "Worker gerçekten koşuyorsa atla" diye koşullu yazılan denetimde koşul **her zaman yanlış** dönüyordu: mesaj adı `experimentResult` içinde "experiment" kelimesi geçtiği için "gerçek koşum yok" tespiti hiç tutmuyordu. Denetim hiç çalışmıyordu — varlığının tek kanıtı yeşil testti | Koşullu çıkarıldı; artık koşulsuz ve mutasyonla doğrulandı (`setRunning` geri konunca kırmızı) |
| 36 | **İkinci düzeltme:** IndexedDB kayıt özelliği "bağlanmamış" sayılmıştı — o da YANLIŞTI | `getRecord`/`estimateUsage` ölü çıktı ve ben bundan "UI düğmesi yok" sonucunu çıkardım. Oysa **özellik bağlı**: `ExperimentPanels.tsx` kayıt listesi çiziyor (`listRecords`, `saveRecord`, `deleteRecord`, `pickJsonFile`), `App.tsx` `downloadJson` kullanıyor. Yalnız iki yardımcı boşta | Aynı hata iki kez yapıldı: ölü dışa aktarımı "özellik eksik" diye okumak. Kayıt gerekçeleri düzeltildi |
| 35 | **Düzeltme:** erişilebilirlik "ürün kararı" diye listelenmişti — bu YANLIŞTI | Ölü dışa aktarım taraması "hiç çağrılmıyor" dedi (doğruydu) ve bundan "özellik uygulanmıyor" sonucu çıkarıldı. Oysa özellik **başka bir değişkenle** (`store.reducedMotion`) uygulanıyordu. Ölçümü okumak yetmişti; yorum yanlıştı | Düzeltme tek satırlık bir başlangıç değeri değişikliğine indi — özellik kurma değil, **sistem tercihini başlangıca bağlama** |
| 33 | **Temiz sonuç:** `sweepShareThreshold` üç ölçüm hata sınıfına da girmiyor | Rapora bağlı olmayan ikinci deney, evrimsel aramadaki üç hatanın (sentinel / maksimum−ortalama / RNG akışı) peşinden tarandı: (a) toplayıcılarda sonlu olmayan değer yok, (b) `maxSurplus`/`peakColony` tanımlayıcı metrikler — kol karşılaştırması değil, (c) her noktada `new World({ seed: 3001 + i })` — tüm eşik noktaları **aynı tohum kümesini** kullanıyor, yani eşleştirilmiş tasarım | Denenmediği bırakılmadı: hata sınıfları denendi ve bulunmadığı **kayda geçti**. Deney hâlâ rapora bağlı değil; bağlanması bir kapsam kararı |
| 32 | Taban örneği **aramanın RNG akışından** çiziliyordu | `randomThetas`, nesil döngüsünden SONRA ve aynı `search` akışından çekiliyordu. Döngü kaç kez `search.normal()` tükettiyse taban o kadar kayıyordu — yani **iki kol farklı rastgele örneklemi karşılaştırıyordu** ve `generations: 0` geçerli bir kontrol olmaktan çıkıyordu. **ÖLÇÜLDÜ:** kontrol taban(ort) 48.378 · evrim kolu 48.386 — aynı seed, aynı population | Taban çizimi aramadan **ayrı bir akışa** taşındı (`baselineThetas`). Ölçüldü: iki kol artık **birebir aynı** tabanı paylaşıyor (65.027 / 43.773), kaç nesil koşulursa koşulsun. Koruma: aynı seed → aynı örneklem, farklı seed → farklı örneklem |
| 31 | Arama **maksimum** döndürüyor, taban **ortalama**ydı | Kazanç yapısal olarak şişik: en büyük > ortalama olduğu için `generations: 0`'da (arama **hiç** çalışmadı) bile kazanç **+21,286** çıkıyordu. **ÖLÇÜLDÜ:** ortalama tabanla +21,286 → **eşleşen (en iyi) tabanla +8,676**. Yani ortalama karşılaştırma kazancı **2,45 kat** şişiriyormuş | Taban artık `randomBaselineMax`; ortalama yalnız bilgi için (`baselineMean`) ve **taban ölüm oranı** (`0/4`) raporlanıyor. Ölümden gelen sentinel'ler maksimumdan da çıkarılıyor. Artık maksimum–maksimum karşılaştırılıyor |
| 29 | `splitsIntoMultiple` ve `maxSpeedFor` **ölü**, formülleri satır içi yaşıyordu | İkisi de hiç çağrılmıyordu; buna karşılık `world.ts` aynı formülleri elle yazmıştı (`components.length <= 1`, `BASE_SPEED * (0.4 + 0.6*motility) * …`). Yani kural "adıyla" değil, kopyasıyla yaşıyordu | İkisi de bağlandı; satır içi kopyalar kaldırıldı. **Ölçüldü:** rapor yeniden üretildi ve simülasyon sayıları birebir aynı çıktı — yani bağlama anlamsal olarak nötrdü |

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

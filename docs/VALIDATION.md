# Cell to Mind — Doğrulama Raporu

**Tarih:** 6 Ekim 2026
**Ortam:** macOS (darwin 27.0.0, arm64) · Node v22.23.1 · npm 10.9.8
**Tarayıcı doğrulaması:** Chromium (chrome-devtools MCP), headless masaüstü
**Simülasyon sürümü:** `1.0.0` · **Şema:** `ctm.world.snapshot` v1

Bu raporda **yalnızca gerçekten çalıştırılan** kontroller yer alır.
Çalıştırılmayan hiçbir şey "başarılı" olarak yazılmamıştır.

---

## 1. Otomatik testler — `npm test`

```
Test Files  2 passed (2)
     Tests  36 passed (36)
  Duration  22.94s
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

---

## 3. Performans (ölçülen)

`vite-node` ile, aynı makinede:

| Aralık | Popülasyon | ms/tick |
|---|---|---|
| tick 2.000–3.000 | 283 | **0.565** |
| tick 6.000–7.000 | 167 | **0.379** |

Bu, 1× hızda (20 tick/sn) saniyede ~8–11 ms CPU demektir; 60 FPS bütçesinde
anlamlı bir pay bırakır. 256 hücrelik standart kapasitede 60 FPS **hedef**
olarak konuldu; tarayıcıda kare hızı ölçülmedi (bkz. §6 açık doğrulamalar).

Optimizasyon notu: yaşayan organizma sırası önbelleklendi, uzamsal ızgara
3.2 → 1.2 mb sıklaştırıldı. Bu iki değişiklik birlikte ~0.76 → ~0.38 ms/tick
getirdi.

---

## 4. Tarayıcı akışı — gerçekten yapıldı

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
çağrısı. Bunlar **test edilmedi** (§6).

---

## 5. Gözlemci sunucusu

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

## 6. Doğrulanmayanlar — açıkça

Bu maddeler **yapılmadı** ve dokümana sayı uydurulmadı:

1. **Üç deneyin gerçek çalıştırılması.** Deney paneli düğmeleri bulunuyor ve
   worker'a komut gönderiyor, ancak deney motoru (`src/sim/experiments/`)
   **yazılmadı**. Sonuç alanı "henüz gözlenmedi" gösteriyor. Ayrılmış tohumlarda
   öğrenme/kontrol karşılaştırması **yapılmadı**; kabul hedefi (20 tohumun en az
   15'inde kontrolü aşma) **gerçekleşmiş bir sonuç DEĞİLDİR**.
2. **Görüntü/görsel model analizi.** Uygulama görüntüsü gözlemciye gönderilmiyor;
   `imageHint` yalnız tick/kamera bilgisini taşıyor.
3. **30 dakikalık kesintisiz tarayıcı koşusu.** Dayanıklılık 10.000 tick ile
   headless doğrulandı (≈ 8 dakika 20 saniye, 1×); etkileşimli 30 dakikalık koşu
   yapılmadı.
4. **Kare hızı (FPS) ölçümü.** Tarayıcıda kare süresi ölçülmedi. Mobil GPU
   kanıtı yoktur; mobil emülasyonu mobil GPU kanıtı sayılmaz.
5. **Kaydet/yükle bit düzeyi eşdeğerliği.** Şema doğrulama, bozuk kayıt reddi ve
   ölçek sınırı **yazıldı**, ancak IndexedDB üzerinden kaydet→yükle→aynı koşu
   eşitliği test edilmedi. Aynı ortamda bit düzeyi eşitlik de vaat edilmiyor.
6. **Dal bağımsızlığı.** `branch` komutu snapshot kopyalıyor; iki dalın
   birbirinden bağımsız olduğu test edilmedi.
7. **Erişilebilirlik denetimi.** Klavye gezinme, görünür odak, `aria` işaretleri
   kodda var; ekran okuyucu ile uçtan uca denendi ama **sistematik test yapılmadı**.
8. **Çapraz cihaz determinizmi.** Test edilmedi, vaat edilmiyor.

---

## 7. Geliştirme sırasında yakalanan gerçek hatalar

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

---

## 8. Tekrarlanabilirlik

```bash
npm ci
npm test              # 36 test
npm run typecheck     # tsc --noEmit, temiz
npm run build         # vite build, başarılı
npm run assets:build  # Blender 5.1.1 ile 10 varlık üretir
npm run dev           # geliştirme sunucusu (port 5183)
npm run server        # gözlemci sunucusu (port 8787) — anahtar yoksa 503
```
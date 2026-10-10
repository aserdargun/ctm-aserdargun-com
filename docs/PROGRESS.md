# Cell to Mind — Geliştirme Durumu

**Son güncelleme:** 10 Ekim 2026

Bu belge, görev sınırına yaklaşıldığı noktada **çalışan kodun** durumunu,
kalan somut eksikleri ve sonraki adımı yazar. Kodun ortasında kullanılamaz taslak
bırakılmamıştır: her yaşayan dosya ya tip denetiminden geçer ya da testle
doğrulanmıştır.

---

## 1. Çalışan ve doğrulanmış olanlar

| Alan | Durum | Kanıt |
|---|---|---|
| Saf TS simülasyon çekirdeği | ✅ | 112 test, 4 dosya, ~24 sn |
| Enerji korunumu (kapalı sistem) | ✅ | rezidüel = **0.0000** (arena'da 0.0 e, kolonide 1.7e-8 e) |
| Bölünme / parçalanma / paylaşım muhasebesi | ✅ | testler |
| Bağ grafiği → gerçek çok hücrelilik | ✅ | 4+ hücreli yapılar test edildi |
| Organizma kimliği / soy / nesil | ✅ | testler |
| 12→8→4 MLP + doğrulanmış gradyan | ✅ | 140 parametre, 2e-6 tolerans |
| REINFORCE + hareketli baseline | ✅ | ağırlıklar değişiyor (ölçüldü) |
| `thetaInherited` / `thetaLive` ayrımı | ✅ | testler |
| Öğrenme kapalıyken ağırlıklar sabit | ✅ | test + deney değişmez kontrolü |
| Determinizm (aynı ortamda) | ✅ | bit düzeyinde, arena ve koloni |
| 10.000 tick dayanıklılık | ✅ | test |
| Snapshot şeması + doğrulama + boyut/değer kontrolü | ✅ (yazıldı) | tip denetimi |
| Worker: tek yazar, sabit adım, komutlar | ✅ | tarayıcıda |
| IndexedDB deposu + JSON dışa/içe aktarım | ✅ (yazıldı) | tip denetimi |
| 3B sahne (shader'lar, GLB varlıklar, kamera) | ✅ | tarayıcıda |
| TR/EN arayüz | ✅ | tarayıcıda (TR) |
| Gözlemci kanıt paketi + yerel kural özeti | ✅ | tarayıcıda |
| Gözlemci sunucu rotası (anahtar sunucuda) | ✅ (503 doğrulandı) | curl |
| Prodüksiyon derlemesi | ✅ | `vite build` başarılı |
| **Deney motoru (arena + koloni koşucuları)** | ✅ | 48 test |
| **İstatistik katmanı (bootstrap CI, IQM, bootstrap test)** | ✅ | 24 test |
| **3 deney + 5 tarama + ödül teşhisi + evrimsel karşılaştırma + 5 değişmez kontrol** | ✅ | 4.128 koşu, 105.6 sn, `docs/EXPERIMENTS.md` |

---

## 2. Somut eksikler

### 2.1 Deney motoru artık var — ama öğrenme iddiası **kanıtlanmadı**

`src/sim/experiments/` modülü **yazıldı** ve gerçekten koşuyor. Artık eksik olan
kod değil, **modelin davranışıdır.** Tam sonuçlar `VALIDATION.md` §4 ve
`docs/EXPERIMENTS.md` içindedir.

| Deney | Sonuç | Nerede |
|---|---|---|
| **1 · Bağ gücü** | ✅ **güçlü pozitif.** En büyük küme 2.33 → **21.25**, fark [16.42, 21.00], p < 0.0001, %100 iyileşme. 4+ hücreli yapı 0 → 31.3 | `VALIDATION.md` §4.3 |
| **2 · Evrim** | ⚪ **sonuçsuz.** Fark +0.011 [−0.001, +0.025], p = 0.097. Mutasyon genom kaymasını **artırmadı** (0.006 ↔ 0.007) | §4.4 |
| **3 · Öğrenme** | ❌ **negatif.** Fark +0.020 [−0.022, +0.061], p = 0.333, %83 iyileşme olasılığı | §4.5 |
| **Zorluk kalibrasyonu** | 📐 Varsayılan habitat **çok kolay**: rastgele politika 0.928, headroom yalnız 0.072 | §4.2 |

**Eski kabul hedefi geçersiz kılındı.** "20 tohumun en az 15'i" eşik testi
artık kullanılmıyor: başarı ile şansı ayıramaz. Yerine bootstrap güven aralığı
ve bootstrap hipotez testi var (`src/sim/stats.ts`).

**Öğrenme neden başarısız — ölçülmüş olarak, iki adımda:**

**Adım 1 — teşhis.** Politika 6.000 tick'te yalnız **9** gradyan adımı alıyor ve
`‖Δθ‖ = 0.003`. Ezber kontrolü belirleyici: eğitilmiş politika **eğitildiği
dünyada da** kontrolü geçmiyor (fark −0.000). Yani ne ezber ne kısmi öğrenme.

**Adım 2 — teşhisin sınanması (duyarlılık analizi).** Ağırlık hareketi ve
güncelleme sayısı ızgara üzerinde **570×** büyütüldü (‖Δθ‖ 0.003 → 1.571,
güncelleme 9 → 75). Beklenen iyileşme yerine davranış farkı **güçlü biçimde
negatif** oldu: −0.401, p = 0.0001, iyileşme olasılığı **%0.0**.

**Sonuç: gradyan burada pratik olarak gürültüdür; adımı büyütmek gürültüyü
büyütür.** Varsayılan ayarlar (ufuk 64 / lr 0.02) ölçülen ızgarada **en zararsız**
noktadır — yani ürünün mevcut sabitleri yanlış değildir.

**Gerçek darboğaz ödül sinyalidir.** Organizma besleniyor ve hayatta kalıyor
(iki kol da %100), dolayısıyla ödül neredeyse sabit → avantaj ≈ 0 → gradyan ≈ 0.
Ödül, **politikanın kararlarına duyarlı değil.** Öğrenme sistemi doğru yazılmış
ve gradyanları doğrulanmış, ancak sinyal yoksun bırakılmış.

Ayrıca **habitat zorluğunu değiştirmek (eski "B" adayı) işe yaramıyor:**
zorluk taramasında 4 kaynak (headroom 0.429) altında fark **negatif**, iyileşme
olasılığı %7.

**Adım 3 — darboğazın kesin ayrımı.** 160 rastgele politika örneklendi:
medyan 0.854, maksimum 0.963, **öğrenilebilir açıklık 0.118**. Politika sınıfı
geniş açık; öğrenilecek davranış bol miktarda mevcut.

| Aday açıklama | Durum |
|---|---|
| Görev çok kolay (varsayılan habitat) | kısmen doğru — §4.2 |
| Habitat zorluğu çözüm | **elendi** — §4.6 |
| Gradyan adımı çok küçük | **elendi** — §4.7 (büyütünce kötüleşiyor) |
| Varyans azaltma / işaret avantajı | **elendi** — §4.10, §4.11 |
| Politika sınıfı tıkanmış | **elendi** — §4.8 (0.118 açıklık var) |
| Görev/algı yetersiz | **elendi** — §4.9 (arama +0.161 buldu) |
| **Ödül sinyalsiz** | **elendi — %97.9 politika-bağımlı, r = 0.70** (§4.12) |
| **Kredi ataması (adım-içi)** | **KALAN AÇIKLAMA** | (§4.12) |

### Doğru teşhis

Ödül **epimizik toplam** olarak mükemmel bir tahmin edicidir. REINFORCE bu
toplamı 64 adımlık yörüngeye yayıp her adıma atamak zorunda; bilgi tam olarak
bu dağıtımda kayboluyor. Varyans azaltma ve adım ayarı **adım-içi** avantajda
çalışan kaldıraçlardı — sinyal taşımadıkları için işe yaramadılar.

Evrimsel arama hiç kredi ataması yapmaz; yalnızca epimizik toplamı artırır.
Bu yüzden +0.161 buluyor.

> Bu, raporun §4.11'deki "sorun ödüldedir" çıkarımını **çürüttü.** Ödül
> ölçüldü ve sağlam çıktı. `VALIDATION.md` §4.12 bu düzeltmeyi kaydeder.

Tam çıktı: `VALIDATION.md` §4.5–4.9.

### 2.2 Gözlemci: canlı model doğrulanmadı

- Hiçbir API anahtarı yoktu; **gerçek bir sağlayıcı çağrısı yapılmadı**.
- MiniMax'in güncel görsel istek şeması canlı belgeden doğrulanmadı.
- Görüntü gözlemciye **gönderilmiyor** (`imageHint` yalnız tick/kamera taşıyor).
- Sonraki adım: `CTM_API_KEY` ile gerçek çağrı, şemanın resmî belgeden
  doğrulanması, `sourceMode: "vision-assisted"` yolunun gerçek kareyle çalıştırılması.

### 2.3 Tarayıcıda test edilmemiş yollar

Mikroskop etkileşimi (gizli birim susturma, tek karar adımı), dal oluşturma,
JSON içe/dışa aktarma, IndexedDB kaydet/yükle, gözlemci paneli. Kod yazılı, tipleri
geçiyor, **kullanıcı akışı olarak denenmedi**.

### 2.4 Ölçülmemiş performans

Tarayıcıda kare hızı ölçülmedi. Simülasyonun CPU payı ölçüldü (0.38–0.57 ms/tick)
ama GPU/çizim maliyeti ile toplam FPS ölçülmedi.

### 2.5 Deneyler tarayıcıya bağlı değil

Deney motoru headless Node'da koşuyor (`npm run experiments`). Worker komutlarıyla
tarayıcı içinden tetiklenen deneyler **bağlanmadı** — panel düğmeleri hâlâ
`queued: true` dönüyor.

---

## 3. Sonraki adım

Teşhis tamamlandı ve **S-2 gereksiz çıktı:** ödül zaten yeterli
(`VALIDATION.md` §4.12). Yeni fark şu — sorun **kredi atamasında**, yani
`pendingE` ödülünü 64 adımlık yörüngeye yayma adımında. Bunu düzeltmek iki
yol ister:

| Seçenek | Ne yapar | Bedeli | Kanıt durumu |
|---|---|---|---|
| **R-1 · Epimizik toplamı doğrudan kullanan yöntem** | Evolution strategies / popülasyon tabanlı gradyan: adım-içi avantaj yerine toplam getiri | Düşük-orta | **Evrim +0.161 ile çalıştığı ölçüldü** (§4.9) |
| **R-2 · Yörüngede tek atım** | Yörüngedeki **ilk** eyleme tüm getiriyi atamak (bandit benzeri, kredi ataması yok) | Orta; `MODEL.md` §4 ve `tests/mlp.test.ts` güncellenir | Denenmedi — en ucuz ilk adım |
| **R-3 · Ürüne evrimsel arama** | §4.9'daki (μ+λ) arama organizmaların ağırlıklarını iyileştirir | **"yaşam öğrenir" anlatısı değişir** | Çalıştığı kanıtlandı |

**Önerilen sıra: R-2 → R-1 → (anlatı değişikliği kabul edilirse) R-3.**

R-2 en ucuzdur ve "yaşam öğrenir" anlatısını korur: hâlâ yaşam içi öğrenme
vardır, yalnızca kredi ataması basitleştirilir.

R-3 artık bir geri çekilme değil, ölçümle desteklenen bir seçenektir: ödül ve
görev sağlam çıktığı için, kredi ataması yapmayan yöntemlerin burada çalışması
**beklenen** sonuçtur.

**Her adım önceden kaydedilmiş hipotez + başarı ölçütüyle** ve aynı protokolle
raporlanmalı. Şimdiye kadarki disiplinin bu aşamada ne kadar gerekli olduğu
kanıtlandı: iki yanlış çıkarım (§4.11'in ödül teşhisi) yalnızca ölçümle
yakalandı.

---

## 4. Bilinçli olarak yapılmayanlar

| Karar | Gerekçe |
|---|---|
| Boş "yaklaşımda" deney ekranları | Görev, çalışıyormuş gibi görünen boş ekranları açıkça yasaklıyor. Deneyler artık **gerçekten koşuyor** ve panel bu sonuçları gösterebilir. |
| CLIP / V-JEPA / dünya modeli ekranları | MVP kapsamı dışı; belgelenmiş sonraki sürüm planı (`MODEL.md` §9). `LITERATURE.md` §8 bu ölçekte dünya modelini önermiyor. |
| Performer tarafından hücre silme | Görev açıkça yasaklıyor. Hücre sayısı yoğunluk rekabetiyle **biyolojik** olarak dengeleniyor. |
| Türkçe metinlerde CSS ile sahte 3B | Görev açıkça yasaklıyor. Sahne gerçek WebGL2, gerçek x/y/z. |
| Sahte model yanıtı | Görev açıkça yasaklıyor. Anahtar yokken dürüst yerel özet. |
| `Math.sin` tabanlı RNG | `normal()` için Irwin–Hall seçildi; determinizm motorlara bağlı olmaz. |
| **Öğrenme yokluğunu "eğilim" diye sunmak** | Negatif sonuç olduğu gibi yazıldı. Kolay habitat seçilip yalnız onu raporlamak, Goodhart tuzağıdır. |
| **S-1'in başarısız olduğunu yumuşak geçmek** | Önceden kaydedilen ölçüt karşılanmadı; §4.10 başarısızlığı olduğu gibi kaydeder. |

---

## 5. Bilinen riskler

1. **Koloni kalıcılığı:** ~6.000 tick sonrası bağlı yapılar çoğunlukla dağılıyor.
   Kaynak tükenmesi ve avcı baskısıyla açıklanıyor; **ölçüldü ve gizlenmedi**.
   Oyuncu müdahalesiyle sürdürülebiliyor.
2. **Ekosistem yavaş sönümleniyor:** 20.000 tick'te 78 hücre. Kapalı enerji
   sisteminde bu beklenen; dış besin eklemek mümkün ve defterde kaydediliyor.
3. **Varsayılan habitat ölçüm için çok kolay:** rastgele politika 0.928. Ürün
   açısından "rahat", deney açısından "ölçülemez". İkisini aynı anda optimize
   etmek mümkün değil — bu bilinçli bir karar noktası.
4. **Öğrenme darboğazı: REINFORCE varyansı.** Ölçüm zinciri darboğazı
   **öğrenme algoritmasına** indirdi (`VALIDATION.md` §4.5–4.9): güncelleme
   sıklığı değil (570× büyütülünce kötüleşiyor), habitat zorluğu değil
   (elendi), politika sınıfı değil (0.118'lik açıklık var). Karar verici
   test: aynı ölçümde **evrimsel arama +0.161** kazandı, REINFORCE +0.020
   (gürültü). Yaşam içi öğrenme iddiası bu haliyle **kanıtlanmıyor**.
5. **Ağır paket:** ana paket ~1.29 MB (gzip ~360 KB). Code splitting yapılmadı.
6. **Gözlemci varsayılan sağlayıcısı** yapılandırılmış bir varsayımdır; anahtar
   olmadan doğrulanamaz.
# Cell to Mind — Geliştirme Durumu

**Son güncelleme:** 16 Ekim 2026

> ⚠️ **Bu belgede ve `VALIDATION.md` §5.11–§5.16'da iki gündür (14 Ekim)
> sessizce bayat sayılar vardı.** `EXPERIMENTS-DEEP.md` 14 Ekim'de yeniden
> üretildiğinde derin profilin bulguları değişti, anlatı belgeleri
> güncellenmedi. Bunun sonucu iki **hüküm ters döndü**:
> `VALIDATION.md` §5.13 "10× dayanıklılık son popülasyonu 36→52 yapıyor"
> derken gerçek **33→26 (−%21)**; §5.16 "rejenerasyon popülasyonu
> kurtarmıyor" derken gerçek **26→55 (+%112)**. Sebep, DEEP'in tazelik
> denetiminin ölçüm kodunu değil yalnız *genom şeklini* izlemesiydi.
> Denetim artık raporun gerçek girdi kümesini izliyor ve §5.11–§5.16
> DEEP'e bağlandı. Ayrıntı: `VALIDATION.md` §10, 43–45. satırlar.

Bu belge, görev sınırına yaklaşıldığı noktada **çalışan kodun** durumunu,
kalan somut eksikleri ve sonraki adımı yazar. Kodun ortasında kullanılamaz taslak
bırakılmamıştır: her yaşayan dosya ya tip denetiminden geçer ya da testle
doğrulanmıştır.

---

## 1. Çalışan ve doğrulanmış olanlar

| Alan | Durum | Kanıt |
|---|---|---|
| Saf TS simülasyon çekirdeği | ✅ | 277 test, 10 dosya, ~95 sn |
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
| Gözlemci sunucu rotası (anahtar sunucuda) | ✅ (7 otomatik test) | `tests/server.test.ts` |
| Prodüksiyon derlemesi | ✅ | `vite build` başarılı |
| **Deney motoru (arena + koloni koşucuları)** | ✅ | 48 test |
| **İstatistik katmanı (bootstrap CI, IQM, bootstrap test)** | ✅ | 24 test |
| **3 deney + 5 tarama + ödül teşhisi + evrimsel karşılaştırma** | ✅ | `docs/EXPERIMENTS.md` |
| **Faz B1 · ekolojik sönümlenme teşhisi + bağ ömrü duyarlılığı** | ✅ | `VALIDATION.md` §5 |
| **Dal (branch) doğrulaması — ürün hatası bulundu ve düzeltildi** | ✅ | `VALIDATION.md` §6.7–6.10 |

---

## 2. Somut eksikler

### 2.1 Deney motoru artık var — ama öğrenme iddiası **kanıtlanmadı**

`src/sim/experiments/` modülü **yazıldı** ve gerçekten koşuyor. Artık eksik olan
kod değil, **modelin davranışıdır.** Tam sonuçlar `VALIDATION.md` §4 ve
`docs/EXPERIMENTS.md` içindedir.

| Deney | Sonuç | Nerede |
|---|---|---|
| **1 · Bağ gücü** | ✅ **güçlü pozitif.** En büyük küme 2.083 → **19.167**, fark **+17.083** [14.833, 19.167], p = 0.0001, %100 iyileşme. 4+ hücreli yapı 0 → 28.9 | `VALIDATION.md` §4.3 |
| **2 · Evrim** | ⚪ **sonuçsuz.** 0.358 → 0.350, fark −0.008 [−0.024, +0.008], p = 0.3035, %15.4 iyileşme. Mutasyon genom kaymasını **artırmadı** (0.005 ↔ 0.005) | §4.4 |
| **3 · Öğrenme** | ⚪ **etki yok.** 0.840 → 0.841, fark +0.001 [−0.037, +0.037], p = 0.9764, %51.8 iyileşme olasılığı | §4.5 |
| **Zorluk kalibrasyonu** | 📐 Varsayılan habitat **çok kolay**: rastgele politika 0.922, headroom yalnız 0.078 | §4.2 |

> ⚠️ **Bu tablo 14 Ekim'de düzeltildi.** Üç deneyin de sayıları `766e0b9`'dan
> (dokuzuncu parametre eklendi) **önceki** koşulardan geliyordu. En ciddisi
> öğrenme deneyi: "❌ negatif" etiketi hem taze ölçümle (fark +0.001,
> %51.8 iyileşme) hem de **kendi alıntıladığı sayılarla** çelişiyordu —
> alıntıladığı +0.020 fark ve %83 iyileşme, pozitif yöndeydi. Doğrusu "etki
> yok". Kaynak: `docs/EXPERIMENTS.md` (koloni deneyleri 4.000 tick — `--deep`
> bunları değiştirmez).

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
| Görev/algı yetersiz | **elendi** — §4.9 (arama +0.032 buldu) |
| **Ödül sinyalsiz** | **elendi — %97.9 politika-bağımlı, r = 0.70** (§4.12) |
| **Kredi ataması (adım-içi)** | **KALAN AÇIKLAMA** | (§4.12) |

### Doğru teşhis

Ödül **epimizik toplam** olarak mükemmel bir tahmin edicidir. REINFORCE bu
toplamı 64 adımlık yörüngeye yayıp her adıma atamak zorunda; bilgi tam olarak
bu dağıtımda kayboluyor. Varyans azaltma ve adım ayarı **adım-içi** avantajda
çalışan kaldıraçlardı — sinyal taşımadıkları için işe yaramadılar.

Evrimsel arama hiç kredi ataması yapmaz; yalnızca epimizik toplamı artırır.
Bu yüzden +0.032 buluyor.

> Bu, raporun §4.11'deki "sorun ödüldedir" çıkarımını **çürüttü.** Ödül
> ölçüldü ve sağlam çıktı. `VALIDATION.md` §4.12 bu düzeltmeyi kaydeder.

Tam çıktı: `VALIDATION.md` §4.5–4.9.

### 2.2 Koloni sönümlenmesi — teşhis edildi, düzeltme **kararı bekliyor**

Faz B1 (`VALIDATION.md` §5) beş rakip açıklamayı ayırdı:

| Hipotez | Sonuç |
|---|---|
| Kaynak tükenmesi | ❌ elendi — sönümlenmede rezerv **%54.7** |
| Avcı baskısı | ❌ elendi — ölümlerin %30'u, 7.000 tick'ten sonra |
| Enerji bütçesi | ⚠️ sonuç (kaynak varken açlık), neden değil |
| **Bağ ömrü** | ✅ **baskın** |

Bağlar ~2.100 tick sonra bütünlüklerini yitiriyor (kopanların **%100'ü**
tükenerek, medyan uzama 0.079). Koloniler bu kaybı yeniden üretemiyor.

**Doğrulama:** bağ ömrü ×4 uzatıldığında (2.083 → 8.333) pencerenin sonunda
4+ hücreli yapılar **0 → 0.25** çıkıyor. Popülasyon (~128) ve rezerv (~%35)
değişmiyor — etki özgül olarak koloni kalıcılığında.

**İki yol, ikisi de uygulanmadı:**

| Yol | Ne yapar | Bedeli |
|---|---|---|
| **Y-1 Kalibrasyon** | Varsayılan `STRAIN_DECAY_K`/`BOND_FATIGUE` değerlerini ölçülen optimuma taşımak | Ürünün görünür davranışı değişir; gerekçesi ölçülmüş ama **ürün kararıdır** |
| **Y-2 Seçilime açmak** | Bağ ömrünü sabit olmaktan çıkarıp `bondStrength` genomuna bağlamak | Daha derli toplu; kolonilerin neden daha dayanıklı olmadığını **ölçülebilir** kılar |

**Y-2 denendi ve BAŞARISIZ oldu** (`VALIDATION.md` §5.6–5.10). Bağ yorgunluğunu
genoma bağlayan kanca eklendi (varsayılan **kapalı**, ürün davranışı aynı),
ancak seçilim `bondStrength` yükseltmedi: kayma −0.0006 [−0.0042, +0.0019].
Geçerli rapor bu ölçüm için **p-değeri üretmiyor** — aralık sıfırı içeriyor,
yani kayma sıfırdan ayrışmıyor.

Sınırlama ölçüldü ve **pencere artefaktı değil** — ama sebebi sandığımdan farklı.
Pencereyi 4 katına çıkarmak çevrimi 5.46'dan yalnız 5.85'e çıkarıyor;
kümülatif doğumun yataylaması **doygunluk değil, doğumların bitmesi**
(§5.11: son çeyrekte 1 doğum, popülasyon 213 → 29).

**En derin yapısal kısıt adayı (düzeltilmiş):** evrimsel süreçler yetersiz
nesil derinliğine ulaşamıyor — ama **sebebi pencere değil, popülasyonun
çökmesi.** §5.11–5.12: popülasyon 8.000 tick'te 166'dan çıkıp 40.000 tick'te
**41'e** düşüyor; son çeyrekte **1 doğum** var. Kümülatif doğumun 246'da
yataylaması "doygunluk" değil, **doğumların bitmesi.**

**Ve §5.4'ün etkisi 40.000 tick'e genellenmiyor** (§5.13): 10× dayanıklı bağ
son popülasyonu 36'dan 52'ye çıkarıyor, son çeyrek kümesi 1.0 → 3.7 oluyor —
kısmi hafifletme, ama 4+ hücreli yapılar yine sıfır ve popülasyon zirvenin
beşte biri. Kalibrasyon sönümlenmeyi **geciktiriyor**, çöküşü **engellemiyor.**

**Açık soru YANITLANDI** (`VALIDATION.md` §5.15–5.16): sınırlayıcı **avcı
dinamiği**, ama avcının kendisi enerji kısıtıyla sınırlı.

| Ölçüm | Sonuç |
|---|---|
| Avcı enerjisi | ~24.000 tick'te **0'a düşüyor**, kapalı sistemde erken ölüyor |
| Rejenerasyon açıkken avcı | 38.931 tick'e yaşıyor, avcı ölümleri 25 → **54** |
| Rejenerasyon popülasyonu kurtarıyor mu? | **Hayır** (son pop 52 → 35 → 42) |

Yani kümülatif kaynak tükenmesi sınırlayıcı değil; sistemde **çift yönlü bir
düzenleme** var. Avcı enerji yetersizliğiyle erken ölüyor; enerji verilirse
devreye girip daha çok öldürüyor.

**Bu tur bulunan ölçüm hatası (2):** (a) enerji rezidülü formülümde
`externalInput` işareti terstiydi; (b) belgedeki bazı sayılar pipeline'ın
üretmediği ad-hoc koşulardan geliyordu — bağımsız denetim yakaladı, hepsi
`docs/EXPERIMENTS-DEEP.md`ye hizalandı. `DEFAULT_REGEN = 0` olduğu için **20+ deneyde görünmemiş**;
rejenerasyonu açan denemede −26.958 e sahte bir korunum ihlali gösterdi.
Simülasyonda hata yoktu; üç deney dosyasında düzeltildi ve regresyon testi eklendi.

Y-1 kalibrasyon "çözüm" değil, kısmi hafifletme olarak yeniden çerçevelendi.

### 2.2b Faz B3 — hileci deneyi: hilecin tanımı yok

(`VALIDATION.md` §6.17–6.20)

**Geçerli bulgu:** `sharingPhase` paylaşım oranını **organizmanın genomünden**
alıyor. Tüm hücreler aynı genomu paylaştığı için hücreler arasında davranış
farkı yok — biri "çok paylaşan", diğeri "az paylaşan" olamaz. **Hilecin tanımı
bu modelde yoktur.**

**Düzeltilen bulgu:** Önceki sürüm "paylaşma ölü kod, `shareEfficiency` hiçbir
şey yapmıyor" diyordu — **yanlıştı.** Ölçüm aracı hatalıydı:
`World.sharingStats()` alanı eklenmiş ama `sharingPhase()` içine artırma satırı
konmamıştı; sayaç daima 0 dönüyordu ve onu "doğrulayan" test de boşuna geçiyordu.
Gerçekte varsayılan ayarlarda 8.000 tick'te **2.262 aktarım** oluyor.

**Duyarlılık taraması — eşik zaten doğruymuş:**

| Eşik | Aktarım | Zirve küme | Son 4+ yapı |
|---|---|---|---|
| **0,82 (varsayılan)** | 2.262 | **24** | **4,67** |
| 0,60 | 366.660 | 10 | 0,33 |
| 0,30 | 84.236 | 16 | 2,33 |

Eşiği düşürmek kolonileri **çökertiyor** (zirve 24 → 10). "Kalibrasyon"
önerisi ölçümle çürütüldü; iyi ki varsayılan değiştirilmeden sınandı.

**B3'ün önkoşulu:** eşik değil, **işbirliği aktı** eklemek (örn. hücre enerji
harcayarak bağını yenilemesi). Ancak bu modelin felsefesini değiştiren bir
karar ve kullanıcının onayına bağlı.

### 2.2c Faz C1 · MODES açık uçluluk ölçümü — **yakınsama, açık uçluluk değil**

(`VALIDATION.md` §6.21–6.22)

| Tick | Pop | Yenilik % | Çeşitlilik | Karmaşıklık | Tür |
|---|---|---|---|---|---|
| 0 | 48 | 100,0 | 0,798 | 0,000 | 12 |
| 2.000 | 157 | 37,4 | 0,858 | 0,376 | 12 |
| **4.000** | **248** | 17,2 | 0,892 | **0,426** | 12 |
| 8.000 | 166 | **0,0** | 0,760 | 0,346 | 12 |
| 12.000 | 134 | **0,9** | 0,772 | 0,226 | 12 |

Yenilik **%37 → %0,9**, karmaşıklık 0,43 → 0,23, tür sayısı sabit 12.
Pencere boyunca 125 benzersiz genom imzası görüldü — **bir keşif yaşandı, sonra
popülasyon daralmaya geçti.**

Bu, literatürdeki "açık uçluluk geçicidir, baskın desenlere çöker"
(Faldor vd. 2023) bulgusunun bu modeldeki karşılığıdır.

**Yol haritasına doğrudan etkisi:** Faz D (MAP-Elites yaşam haritası) artık
"güzel bir özellik" değil — **arşiv olmadan popülasyon tek bir çukura düşüyor.**

**İki ölçüm hatası yazımdan önce yakalandı:**
1. "Değişim" endeksle eşleştiriliyordu; organizma listesi her örnekte kaydığı için
   sonuç 170 kat şişmiş çıkıyordu (0,068 → gerçek 0,0004). Doğrusu: her genomün
   kendisine en yakın önceki genoma uzaklığı.
2. Eğilim hesabı tick 0'ı karşılaştırmaya katıyordu; kurucular tek hücreli
   olduğu için "rising" diye **yanlış** bir açık uçluluk işareti üretiyordu.
   Yayıncının haklı olduğu ortaya çıktı: gerçek eğilim **falling**.

### 2.2d Faz D · Niş kapsama — yakınsamanın **yeri** ölçüldü

(`VALIDATION.md` §6.23–6.25)

Çukur olduğu biliniyordu ama nerede olduğu bilinmiyordu. Üç ölçülebilir
betimleyici (hız, boyut, duyu menzili) üzerine 3×3×3 ızgara kuruldu.

**Bu ölçüm ilk çalıştırmada kırıktı ve üç ayrı hata vardı:**

1. **Birim hatası** — hız yer değiştirme olarak ölçülüp `mb/tick` tavanıyla
   karşılaştırılıyordu; gözlemlerin **1581/1582**'si tavana kırpılıyor,
   hız ekseni **hiçbir bilgi taşımıyordu**. Doğru birimde aynı gözlemlerde
   kırpma **0/1582**.
2. **Ulaşılamayan tavan** — boyut tavanı 48 hücreydi, en büyük organizma
   8 hücre; 3. kutu yapısal olarak **erişilemez**di.
3. **Bozuk ilk örnek** — döngüden önce örnek alındığı için seri küçük
   başlıyordu. 4 örnekli seri "**genişliyor**", aynı koşu 7 örnekte
   "**daralıyor**" diyordu. Aynı ölçüm, iki zıt yön.

Hiçbiri kendini belli etmiyordu; üçü de makul görünen sayılar üretti.

Düzeltilmiş ölçüm (tohum 11, 12.000 tick): **8/27 kutu dolu**, en yoğun kutuda
**%50** organizma (kutu 2/0/1 — hızlı, tek hücreli, orta menzilli), dolu kutu
5.0 → 3.5.

> **Düzeltme kaydı:** önceki "%83 tek kutuya birikmiş" sayısı kırık bir aletle
> alınmıştı ve **geçersizdir**. Yön değişmedi — yakınsama gerçek — sayı %50'dir.

**Kalıcı değişiklik:** `NicheReport` artık her koşuda **eksen sağlığını**
raporluyor (kaç gözlem tavana kırpıldı, kaç kutu doldu). Çökme kuralı yalnız
güvenilir sinyale bakar; eksik kutu arıza değildir, ölçülen biyolojidir.
Denetleyicinin kendisi de testle doğrulanıyor — aksi hâlde hep boş dönüp yeşil
görünürdü.

**Yol haritasına etkisi:** Faz D'nin ürün tarafı (görsel yaşam haritası +
arşiv) hâlâ açık. Ölçüm artık **hangi** nişlerin boş olduğunu gösterdiği için
arşiv nereye yazılacak bellidir: yavaş/tek hücreli uçlar.

### 2.2e Faz D ürün tarafı — Yaşam Haritası paneli **yayında**

(`VALIDATION.md` §6.26–6.27)

HUD'da yeni düğme. 3×3×3 ızgara menzil katmanları hâlinde çiziliyor;
renk yoğunluğu kutudaki en iyi bireyin enerjisi.

**Betimleyici hesabı tek kaynağa taşındı** (`src/sim/lab/lifeMap.ts`).
Deneyler ve ürün aynı sabitleri kullanıyor. İki kopya ayrışırsa aynı sayı
iki farklı yorumla raporlanır — §2.2d'deki hatanın yapısal nedeni buydu.

**Seçilim `ε = 0`:** arşiv her kutudaki en iyi bireyi saklıyor ama seçilime
katılmıyor; canlı dünya değişmiyor. Test bunu doğruluyor (takipçili ve
takipçisiz dünya bit düzeyinde aynı, enerji korunumu bozulmuyor).

**Tarayıcıda en değerli gözlem:** eksen çökme dedektörü **gerçekten ateşledi**.
Tick 263'te bütün organizmalar tek hücreliydi, boyut ekseni ayrım üretmiyordu
ve panel dürüstçe uyardı; organizmalar büyüdükçe (tick 941) uyarı kendiliğinden
kayboldu. Yani panel ölü bir yeşil değil — anlık gerçeği yansıtıyor.

Maliyet ölçüldü: her tick `centroidOf` çağrısı 3000 tick'te 907 ms → 863 ms.
Kare başına gönderim yok, panel açıkken 1500 ms'de bir anlık görüntü istenir.

### 2.2f Faz D · Arşivin seçilime katılması (ε > 0) — **başarısız**

(`VALIDATION.md` §6.28–6.30)

MAP-Elites kuralı denendi: boş nişlere o nişin en iyi bireyinin yavrusu
enjekte ediliyor. Eşleştirilmiş 4 tohum, 12.000 tick.

| | ε = 0 | ε > 0 |
|---|---|---|
| Dolu kutu (/27) | 10,50 | **10,50** |
| Canlı popülasyon | 119 | 174 |
| Hücre enerjisi (e) | 3.667 | 4.653 |

Fark **0,00** [−2,75, +2,75], **p = 1,0000**. Enjeksiyon gerçekten canlı
üretiyor ama ürettiği bireyler çukura geri kayıyor.

**Neden — yapısal, ölçülmüş:** boyut ekseni **kalıtsal değil**. Enjeksiyon
tek hücreli organizma doğurur; 12.000 tick sonunda canlıların **%100'ü tek
hücreli**, arşivdeki 97 bin büyük-organizma gözlemi ise artık **0**. MAP-Elites
"elitini koru" mantığı burada bir şey koruyamaz çünkü elit de küçük doğuyor.

İlk hipotez ("elit mutasyonla bozuluyor") **ölçülerek çürütüldü**: mutasyon
kapalıyken de doluluk artmadı. Yanlış açıklama doğrulamadan önce yazıldı.

**Sonuç:** seçilim kancası ölçüm aracı olarak duruyor ama **açılmıyor**.
Arşiv üründe ölçüm olarak kalıyor (ε = 0). Faz D'nin bugünkü hali: çukur
ölçüldü, görselleştirildi, doldurulması denendi — başarısız.

### 2.2g Paylaşma mekaniği varsayılan ayarda **etkisiz** (ölçüldü)

(`VALIDATION.md` §6.44–6.45)

Eşik, hiçbir hücrenin aşamayacağı **1,50**'ye çekildi → paylaşma
matematiksel olarak imkânsız. Varsayılan 0,82 ile **aynı 12 tohumda**
karşılaştırıldı:

| eşik | tetiklenen | ort. tepe |
|---|---|---|
| 0,82 (varsayılan) | 3/12 | **15,00** |
| 1,50 (imkânsız) | 0/12 | **15,00** |
| 0,70 | 12/12 | 14,92 |

**Eşleştirilmiş tepe farkı [0, 0].** Paylaşma 3 tohumda gerçekten tetiklenmiş
(2262/2272/1918 aktarım) ama tepe küme hiçbirinde değişmemiş.

Yani **varsayılan ayarda paylaşma çalışıyor ama hiçbir şeyi değiştirmiyor.**

**§6.18'in iddiası düzeltildi.** "Eşiği düşürmek zararlı" yönü doğru ama
rakamları tek koşunun sonucuydu: gerçek fark 24→10 değil, **15,00 → 11,08**.
Ve gerekçe değişiyor: paylaşma 0,70'te **daima** çalışmasına rağmen tepe
14,92 (yani etkisiz); sadece 0,60'ın altında (11,08) ve 0,50'de (7,08) zarar
başlıyor. Suçlu paylaşmanın kendisi değil, **enerjiyi sürekli boşaltan eşik**.

**İşbirliği aktı kararını bu aydınlatıyor:** paylaşma şu an ölü bir mekanizma.
Eklenecek gerçek işbirliği aktı "çalışan bir şeyi değiştirmek" değil,
**ölü bir mekanizmayı etkinleştirmek** olur — yani riski düşük, kazancı da
belirsiz bir başlangıç.

### 2.2h Faz B3 · **İşbirliği aktı eklendi** — mekanizma çalışıyor, kazanç yok

(`VALIDATION.md` §6.55–6.56)

Bağ bütünlüğü eşiğin altına düşünce bağın **iki ucundaki hücreler birlikte**
enerji harcayarak bağı yeniler. Bedel **ortak** olduğu için ödemeyen hücre de
yararlanır — yani hileci **kavramsal olarak** tanımlanır. Varsayılan **kapalı**;
kapalıyken ürün davranışı bit düzeyinde aynı (ölçüldü).

| ölçüm (12 tohum, eşleştirilmiş) | sonuç |
|---|---|
| bağ sayısı farkı | ort **+10,9** [6,3; 15,5], **p = 0,0001** → mekanizma çalışıyor |
| tepe küme farkı | ort **0,00** [0,00; 0,00], **p = 1,0000** → **koloni kazancı yok** |

> ⚠️ Bu tablo da bayattı ve yeniden ölçüldü. Önceden bağ farkı **+12,5**
> [9,0; 16,1], tepe küme farkı **−0,67** [−3,08; +1,50] `p = 0,59` yazıyordu —
> bu üç sayının hiçbiri güncel raporda **bulunmuyordu**, yani ölçüm artık
> üretilmeyen bir deneydi. Güncel ölçüm tepe küme farkını tam olarak sıfır
> buluyor: tek bir tohumda bile artış yok.

⚠️ Bu turun kendi kendini çürüten ölçümü: ilk ölçüm ortalamada "+%11" kazanç
bildirdi ve "başarılı" yazıldı; eşleştirilmiş ölçüm bunu çürüttü (farklar
[-5, +11], yalnız 4/10 artıyor). **Ortalama tek başına kanıt değildir.**

**Kalan adım (kullanıcı kararı):** hilecin **kalıtsal** olması için genoma bir
işbirliği parametresi eklenmeli. Bu; `Genome` tipi, sınırlar, mutasyon ölçeği,
**metabolik maliyet** ve kurucu genomlar zincirini değiştirir ve **tüm önceki
ölçümleri geçersizleştirir**. Tek taraflı yapılmadı.

### 2.2i `genome.cooperation` **eklendi** (kullanıcı kararı)

(`VALIDATION.md` §6.58–6.59)

Genom 8 → **9** parametreye çıktı. `cooperation` (0..1), bağ yenilemeye
katılım oranı ve **metabolik maliyetli** (bazalin ~%26'sı — proje kuralı:
hiçbir özellik bedelsiz avantaj sağlamaz).

**"Hileci" tanımı tamamlandı:** düşük `cooperation` daha az öder ama bedel
ortak olduğu için yenilenen bağlardan aynı ölçüde yararlanır.

**Ölçülen seçilim sonucu: YÖN YOK.** 3 tohum, 16.000 tick:

| | ak açık | ak kapalı |
|---|---|---|
| kayma (işbirliği) | **−0,0063** | **−0,0072** |

Çeşitlilik korunuyor (min 0,26 · maks 0,60–0,69) ama yön yok. Bu, evrimsel
değişimin 3 nesle yetmediği eski bulgusuyla (p = 0,3035) tutarlı.

**Kabul edilen bedel:** metabolik bütçe değiştiği için **tüm deney ölçümleri
geçersizleşti** ve baştan koşuldu. Yenileme kancası hâlâ **kapalı** ve
kapalıyken iki koşu bit düzeyinde aynı.

> Bu ölçüm ilk önce birim testine kondu ve **CI'da zaman aşımına** düştü
> (24 dünya koşusu > 120 sn). Doğru yer deney motoruydu: `experimentSharingEffect()`,
> `npm run experiments` içinde 26. bölüm.

### 2.3 Gözlemci: anahtarsız yol doğrulandı, canlı çağrı ölçülmedi

(`VALIDATION.md` §6.32)

**1. Kanıt denetimi hiç test edilmemişti** — `verifyNumericClaims`,
`extractNumericClaims`, `buildLocalSummary`. Onlar olmadan panel model
halüsinasyonlarını doğrulanmış diye sunabilirdi. 16 test yazıldı.

**2. Yanlış kabul bulundu.** "Bu 3 organizma bağ kurdu" → 3 sayısı
`bondCount=3` ile eşleşip doğrulanmış geçiyordu; panelde "3 bağ ✓" görünüyordu.
Denetim **değer** karşılaştırır, anlam karşılaştırmaz. Artık sonuç
`matchedMetric` taşıyor ve panel "3 ← bondCount" yazıyor.

**3. Rota üretim yapısında hiç erişilemezdi.** `vite dev` proxy'liyordu,
`preview` (yani build sonrası) **proxy'sizdi**: `POST /api/observer` → **502**.
Yani dil modeli yolu hiçbir ortamda çalışmıyordu. `preview.proxy` eklendi;
artık **503** dönüyor — yani rota ulaşılıyor, sunucu dürüstçe "anahtar yok"
diyor.

**Anahtarsız yol tarayıcıda uçtan uca doğrulandı:** panel açılıyor, yerel kural
özeti + gözlemler + belirsizlikler + sonraki deney + 13 ölçüm listeleniyor,
oyun kesilmiyor, konsoldaki tek hata 503'ün kendisi (önceden 502'ydi).

**Hâlâ ölçülmedi:** gerçek sağlayıcı çağrısı (`CTM_API_KEY` yok),
`vision-assisted` yolu, MiniMax görsel şemasının canlı doğrulaması.

### 2.4 e2e altyapısı kuruldu — `npm run e2e` **kırıktı**

(`VALIDATION.md` §6.35–6.36)

`"e2e": "playwright test"` scripti vardı, `@playwright/test` bağımlılığı
vardı — ama `playwright.config.ts` ve test dosyası **yoktu**. Çalıştırınca
`Error: No tests found` (exit 1). Yapılandırma olmadığı için Playwright
`tests/` dizinini tarıyor, vitest dosyalarını yüklemeye çalışıyordu.

Yazılanlar: `playwright.config.ts` + `e2e/sim.spec.ts` (6 test).
Tümü geçti (22,6 sn). `npm run check` = tip + birim + e2e.

**Kurulum sırasında üç ayrı tuzak ölçüldü — hepsi "ölü test" üretiyordu:**

1. `npm exec vite --` **dev sunucusunu** açar, üretim yapısını değil. Test
   derlenmiş paketi/worker çözümlemesini sınamıyordu. Doğrusu `vite preview`.
2. **Worker hataları sayfa konsoluna düşmez.** `console`/`pageerror`
   yakalamaz; `page.on('worker')` gerekir. Bu yüzden ilk teşhiste "hata yok"
   görünüyordu.
3. **Görüntülenen metin ≠ DOM metni.** HUD'da `text-transform: uppercase`
   var: DOM'da "Canlılar", ekranda "CANLILAR". `innerText` dönüşümü yansıtır,
   `textContent` yansıtmaz — Playwright kaynak metne göre eşleştirir. Ayrıca
   HUD negatif işareti tipografik `−` (U+2212) basıyor ve `MUHASEBE FARKI`
   kenar çubuğunda **değil** banner'da.

### 2.5 Bu proje hiç yayınlanmamış

Kardeş projelerin çoğunda `deploy-swa-<proje>.yml` (Azure Static Web Apps)
var; **ctm'de hiçbir dağıtım izi yok** — ne iş akışı ne de deploy commit'i.

Dağıtılmadı çünkü Azure SWA gizli anahtarı ve kaynağı kullanıcının.
`VALIDATION.md` §6.37'de ayrıca not edildi: `server/index.ts` bir Node
sunucusudur ve SWA'da çalışmaz, yani yayınlanan sitede gözlemci yalnız yerel
kural özetini üretir.

**Kullanıcı kararı (2026-10-13): şimdilik yayınlama, sadece kayıtta kalsın.**
Bilinçli erteleme; eksik değil. CI kapısı yeşil (`master` + PR'da tip + 202
birim + 6 e2e, ubuntu) ve `npm run build` hazır — koşullar sağlandığında tek
commit + push + URL doğrulaması yeterli, **kod tarafında hiçbir şey eksik yok**.

### 2.6 Tarayıcıda test edilmemiş yollar

Mikroskop etkileşimi (gizli birim susturma, tek karar adımı), dal oluşturma,
JSON içe/dışa aktarma, IndexedDB kaydet/yükle, gözlemci paneli. Kod yazılı, tipleri
geçiyor, **kullanıcı akışı olarak denenmedi**.

### 2.5 Ölçülmemiş performans

Tarayıcıda kare hızı ölçülmedi. Simülasyonun CPU payı ölçüldü (0.38–0.57 ms/tick)
ama GPU/çizim maliyeti ile toplam FPS ölçülmedi.

### 2.6 Deneyler tarayıcıya bağlı değil

Deney motoru headless Node'da koşuyor (`npm run experiments`). Worker komutlarıyla
tarayıcı içinden tetiklenen deneyler **bağlanmadı** — panel düğmeleri hâlâ
`queued: true` dönüyor.

---

## 3. Sonraki adım

**Seçilen öğrenme yönü (popülasyon-ES) uygulandı ve BAŞARISIZ oldu**
(`VALIDATION.md` §6). Fark −0.00244 [−0.00563, +0.00066], p = 0.1288.

**Ölçülen sebep formülasyonun kendisiydi:** Uyguladığım güncelleme bir
**anti-drift** mekanizmasıdır (kötü bireyi iyiye çeker), bir **arama**
yöntemi değil. Gerçek ES, θ etrafında pertürbasyon üretip her birini **ayrı
ortamda** değerlendirmeyi gerektirir; tek bir canlı dünyayı çatallayamaz.

Ölçüm bunu doğruladı: paylaşılan dünyada bireyler arası ödül hızı CV'si
**%9.0**, bağımsız dünyalarda %7.4 — yani **sinyal var**, paylaşılan koşullar
onu silmiyor. Yanlış olan, onu arama için kullandığım yöntemdi.

| Yöntem | Dünya çatallıyor mu? | Sonuç |
|---|---|---|
| Evrimsel arama (μ+λ) | **Kısmen** — her aday ayrı koşu | ✅ **+0.032** (zayıf) |
| Popülasyon-ES | Hayır — ağırlık ortalaması | ❌ etkisiz |
| REINFORCE | Hayır — adım-içi gradyan | ❌ etkisiz |

### Kalan seçenekler

| Seçenek | Durum |
|---|---|
| S-1 varyans azaltma | ❌ denendi, ölçütü karşılamadı (§4.10) |
| S-1b işaret + adım | ❌ denendi, ölçütü karşılamadı (§4.11) |
| S-2 ödülü değiştir | ❌ **gereksiz** — ödül zaten yeterli (§4.12) |
| Popülasyon-ES | ❌ denendi, ölçütü karşılamadı (§6) |
| **S-3 evrimsel arama** | ✅ **çalıştığı görüldü** (+0.032) — ama kanıt zayıfladı, §4.9 |

**Mimari kısıt (yeni):** yaşam içi öğrenme yalnızca **epimizik** getiriyi
kullanarak arama yapamaz; arama için dünya çatallaması gerekir. Bu, ürün
kararını basitleştirir: ya "yaşam öğrenir" iddiasından vazgeçip evrimi
ürüne alırız, ya da çatallanabilir bir ortam (deney/branch altyapısı vardır)
üzerinden yaşam içi arama kurarız.

### Çatallama ölçüldü — ikinci seçenek de açık

`VALIDATION.md` §6.7–6.10: **ölçüm bir ürün hatası buldu.** `branch` **hiç
çalışmıyordu** — `World.fromState` `Object.create(World.prototype)` kullandığı
için constructor çalışmıyor, `ledger` `undefined` kalıyor ve ilk erişimde
TypeError atılıyordu. Düzeltildi, üç regresyon testi eklendi.

Düzeltme sonrası ölçülen: bir çatal **≈ 24 tick** maliyetinde; 500 tick'te bir
16 pertürbasyonlu arama ≈ %76 ek yük. **Çatallama hem mümkün hem ucuz.**

Bu, §6.5'teki "yaşam içi öğrenme arama yapamaz" kısıtını tamamlıyor gibi
görünüyordu. **Sonradan ölçüldü ve bu çıkarım yanlış çıktı:** çatallama
kısıtı kaldırmadı, yalnız o teknik engeli kaldırdı. Gerçek engel **kredi
ataması**ydı ve her iki yöntemde de orada kalıyor (aşağıdaki tablo).

**İki seçenek artık ikisi de açık:**

| Seçenek | Durum | Kanıt |
|---|---|---|
| **S-3** evrimsel aramayı ürüne al | ✅ **üründe** — Evrim Atölyesi | +0,035…+0,072, 0,4–0,6 sn, tarayıcıda doğrulandı |
| **S-4** çatallanmış ortamda yaşam içi arama | ❌ **denendi, başarısız** | fark 0,000, p = 1,0000; θ hareket etti, davranış kazanmadı (§6.11–6.13) |

**S-4'ün ölçülen sonucu (bayat not, düzeltildi):** Çatallama ucuz olduğu için
"yaşam içi arama teknik olarak mümkün" denmişti. Yapıldı ve **işe yaramadı**:
ağırlıklar hareket etti (‖Δθ‖ = 0,0010) ama davranış kazanmadı, ek yük ≈ 2.200
tick'lik eşdeğer oldu. Yani çatallama **zorluğu değil, problemi** çözdü:
asıl engel kredi atamasıydı ve çatallama onu aşmıyor.

Kanıtlı tek yol hâlâ **arenadaki (μ+λ) evrimsel arama**, üründe Evrim
Atölyesi olarak çalışıyor.

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

1. **Koloni kalıcılığı ve ekosistem çöküşü:** ~6.000 tick sonrası bağlı yapılar
   dağılıyor, ~8.000 tick sonrası popülasyon **çöküyor** (213 → 29 @ 40.000).
   **Teşhis edildi ve ölçüldü** (`VALIDATION.md` §5): kısa vadede sınırlayıcı
   **bağ ömrüdür** (~2.100 tick); uzun vadede sınırlayıcı **henüz belirlenmemiştir**.
   Kalibrasyon kısmi hafifletiyor, çöküşü engellemiyor.
2. **Ekosistem yavaş sönümleniyor:** 20.000 tick'te 78 hücre. Kapalı enerji
   sisteminde bu beklenen; dış besin eklemek mümkün ve defterde kaydediliyor.
3. **Varsayılan habitat ölçüm için çok kolay:** rastgele politika 0.922. Ürün
   açısından "rahat", deney açısından "ölçülemez". İkisini aynı anda optimize
   etmek mümkün değil — bu bilinçli bir karar noktası.
4. **Öğrenme darboğazı: REINFORCE varyansı.** Ölçüm zinciri darboğazı
   **öğrenme algoritmasına** indirdi (`VALIDATION.md` §4.5–4.9): güncelleme
   sıklığı değil (570× büyütülünce kötüleşiyor), habitat zorluğu değil
   (elendi), politika sınıfı değil (0.118'lik açıklık var). Karar verici
   test: aynı ölçümde **evrimsel arama +0.032** kazandı, REINFORCE +0.020
   (gürültü). Yaşam içi öğrenme iddiası bu haliyle **kanıtlanmıyor**.
5. **Ağır paket:** ana paket ~1.29 MB (gzip ~360 KB). Code splitting yapılmadı.
6. **Gözlemci varsayılan sağlayıcısı** yapılandırılmış bir varsayımdır; anahtar
   olmadan doğrulanamaz.
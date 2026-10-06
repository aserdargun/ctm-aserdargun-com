# Cell to Mind — Geliştirme Durumu

**Son güncelleme:** 6 Ekim 2026

Bu belge, görev sınırına yaklaşıldığı noktada **çalışan kodun** durumunu,
kalan somut eksikleri ve sonraki adımı yazar. Kodun ortasında kullanılamaz taslak
bırakılmamıştır: her yaşayan dosya ya tip denetiminden geçer ya da testle
doğrulanmıştır.

---

## 1. Çalışan ve doğrulanmış olanlar

| Alan | Durum | Kanıt |
|---|---|---|
| Saf TS simülasyon çekirdeği | ✅ | 22 test, 22.94 sn |
| Enerji korunumu (kapalı sistem) | ✅ | rezidüel = **0.0000** |
| Bölünme / parçalanma / paylaşım muhasebesi | ✅ | testler |
| Bağ grafiği → gerçek çok hücrelilik | ✅ | 4+ hücreli yapılar test edildi |
| Organizma kimliği / soy / nesil | ✅ | testler |
| 12→8→4 MLP + doğrulanmış gradyan | ✅ | 140 parametre, 2e-6 tolerans |
| REINFORCE + hareketli baseline | ✅ | ağırlıklar değişiyor (ölçüldü) |
| `thetaInherited` / `thetaLive` ayrımı | ✅ | testler |
| Öğrenme kapalıyken ağırlıklar sabit | ✅ | test |
| Determinizm (aynı ortamda) | ✅ | test |
| 10.000 tick dayanıklılık | ✅ | test |
| Snapshot şeması + doğrulama + boyut/ değer kontrolü | ✅ (yazıldı) | tip denetimi |
| Worker: tek yazar, sabit adım, komutlar | ✅ | tarayıcıda |
| IndexedDB deposu + JSON dışa/içe aktarım | ✅ (yazıldı) | tip denetimi |
| 3B sahne (shader'lar, GLB varlıklar, kamera) | ✅ | tarayıcıda |
| TR/EN arayüz | ✅ | tarayıcıda (TR) |
| Gözlemci kanıt paketi + yerel kural özeti | ✅ | tarayıcıda |
| Gözlemci sunucu rotası (anahtar sunucuda) | ✅ (503 doğrulandı) | curl |
| Prodüksiyon derlemesi | ✅ | `vite build` başarılı |

---

## 2. Somut eksikler

### 2.1 Deney motoru YAZILMADI — en büyük eksik

`src/sim/experiments/` modülü **yoktur**. Deney paneli düğmeleri worker'a komut
gönderiyor, worker `queued: true` yanıtı veriyor, ama **hiçbir deney
çalıştırılmıyor**. Sonuç alanı dürüstçe "henüz gözlenmedi" gösteriyor.

Yazılması gerekenler:

| Deney | Gereken altyapı | Zorluk |
|---|---|---|
| **1 · Birlikte kalmak** | snapshot'tan iki dal, yalnız `bondAffinity` farkı; baskı sabit | Orta — dal altyapısı hazır |
| **2 · Adaptasyon** | atasal/torun genotipi, ortak ortam, öğrenme + yeni mutasyon kapalı | Orta |
| **3 · Öğrenme** | ayrılmış tohumlar (1–20 eğitim, 1001–1020 değerlendirme), 2000+1000 karar bütçesi, eşleştirilmiş fark, **ölü/başarısız bireylerin sonuçtan çıkarılması** | Yüksek — istatistiksel çerçeve gerekli |
| **Ablasyon** | eğitilmiş ağdan gizli birim susturma, eğitim kapalıyken etki ölçümü | Düşük — `forwardMasked` hazır |

**Kabul hedefi gerçekleşmiş sonuç DEĞİLDİR.** 20 tohumun en az 15'inde eğitilmiş
politikayın kontrolü aşması bir *ürün hedefidir*; bu depoda o ölçüm **hiç
yapılmadı** ve `VALIDATION.md` bunu açıkça belirtir.

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

---

## 3. Sonraki adım (tek cümle)

**`src/sim/experiments/` deney motorunu yazıp Deney 3'ü (Öğrenme) ayrılmış
tohumlarda gerçekten çalıştırmak ve sonucu — ne olursa olsun — `VALIDATION.md`
içine gerçek sayılarla yazmak.**

Bu adım önce gelmelidir, çünkü görevin "gerçek yapay sinir ağlarıyla deneyimden
öğrenme" iddiası ancak böyle kanıtlanır. Şu an öğrenme gerçektir ve testlerle
gösterilmiştir, ancak **deneysel olarak karşılaştırılmamıştır**.

---

## 4. Bilinçli olarak yapılmayanlar

| Karar | Gerekçe |
|---|---|
| Boş "yaklaşımda" deney ekranları | Görev, çalışıyormuş gibi görünen boş ekranları açıkça yasaklıyor. Deneyler `PROGRESS.md` + panelde "henüz gözlenmedi" diye duruyor. |
| CLIP / V-JEPA / dünya modeli ekranları | MVP kapsamı dışı; belgelenmiş sonraki sürüm planı (`MODEL.md` §9). |
| Performer tarafından hücre silme | Görev açıkça yasaklıyor. Hücre sayısı yoğunluk rekabetiyle **biyolojik** olarak dengeleniyor. |
| Türkçe metinlerde CSS ile sahte 3B | Görev açıkça yasaklıyor. Sahne gerçek WebGL2, gerçek x/y/z. |
| Sahte model yanıtı | Görev açıkça yasaklıyor. Anahtar yokken dürüst yerel özet. |
| `Math.sin` tabanlı RNG | `normal()` için Irwin–Hall seçildi; determinizm motorlara bağlı olmaz. |

---

## 5. Bilinen riskler

1. **Koloni kalıcılığı:** ~6.000 tick sonrası bağlı yapılar çoğunlukla dağılıyor.
   Kaynak tükenmesi ve avcı baskısıyla açıklanıyor; **ölçüldü ve gizlenmedi**.
   Oyuncu müdahalesiyle sürdürülebiliyor.
2. **Ekosistem yavaş sönümleniyor:** 20.000 tick'te 78 hücre. Kapalı enerji
   sisteminde bu beklenen; dış besin eklemek mümkün ve defterde kaydediliyor.
3. **Ağır paket:** ana paket ~1.29 MB (gzip ~360 KB). Code splitting yapılmadı.
4. **Gözlemci varsayılan sağlayıcısı** yapılandırılmış bir varsayımdır; anahtar
   olmadan doğrulanamaz.
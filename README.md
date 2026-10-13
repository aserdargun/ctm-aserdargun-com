# Cell to Mind

**Yaşam evrilir. Zihinler belirir.** — *Tek hücreden öğrenen yaşama.*

Tarayıcıda çalışan 3B bilimsel ekosistem simülasyonu. Tek hücreli yaşamdan
üreyebilen çok hücreli yapılara geçer, kalıtım ve mutasyonla evrilir, **gerçek
çalışan** 12→8→4 yapay sinir ağıyla deneyimden öğrenir ve dünyasının gelişimini
kanıtlarla açıklayan bir gözlemci paneli sunar.

Varsayılan arayüz **Türkçe**; tam İngilizce seçenek vardır.

---

## Hızlı başlangıç

```bash
npm ci
npm run dev          # http://localhost:5183
```

Gözlemci sunucusu (isteğe bağlı, API anahtarı **yalnız sunucuda**):

```bash
CTM_API_KEY=… npm run server      # http://127.0.0.1:8787
```

Anahtar yoksa uygulama **çalışır** ve gözlemci panelinde dürüstçe
"Yerel kural özeti — dil/görsel model kullanılmadı" yazar.

### Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (port 5183) |
| `npm run build` | Tip denetimi + üretim derlemesi |
| `npm run preview` | Üretim çıktısını sunar (port 4173) |
| `npm test` | Vitest — 211 test |
| `npm run e2e` | Playwright — 6 tarayıcı testi (üretim yapısı üzerinden) |
| `npm run check` | Tip denetimi + birim + uçtan uca (dağıtım öncesi kapı) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run experiments` | Deney paketini headless koşar — 26 bölüm, 1.921 koşu, ~10 dk → `docs/EXPERIMENTS.md` |
| `npm run experiments -- --deep` | Derin paket: 40.000 tick pencereleri, ekolojik çöküş görünür (yavaş) |
| `npm run experiments:quick` | Deney paketinin duman testi (~40 sn) |
| `npm run assets:build` | Blender 5.1.1 ile varlıkları yeniden üretir |
| `npm run server` | Gözlemci sunucu rotası |

### Sürekli doğrulama

`master` dalına her push'ta ve her PR'da **CI koşar**: tip denetimi + 201 birim
testi + 6 tarayıcı testi (`npm run check`). Başarısızsa tarayıcı kanıtları
artifact olarak yüklenir.

> Bu depo şu an **yayınlanmıyor** (2026-10-13 tarihinde bilinçli olarak
> ertelendi). CI kapısı yeşil ve derleme hazır; eksik olan yalnız barındırma.
> Azure SWA yolu kardeş projelerle aynı kalıbı izler ve repo gizli anahtarı
> gerektirir. Ayrıca gözlemci rotası (`server/index.ts`) bir Node sunucusudur ve
> statik barındırmada çalışmaz; yayınlandığında gözlemci paneli yalnız yerel
> kural özetini üretir. Ayrıntı: `docs/VALIDATION.md` §6.37.

---

## Ana döngü

**koşulu değiştir → gözlemle → bireyi/soyu incele → hipotez kur → kontrol dalıyla
karşılaştır → keşfi kaydet**

Oyuncu canlılara komut vermez. Besin alanını, ışığı, akıntıyı ve seçilim
baskısını değiştirip sonucu izler; bir canlıyı ve soyunu takip eder.

### İlk oturum için öneri

1. **2×–4×** hıza geç. 100 saniye simülasyon (~25 s gerçek) içinde çok hücreli
   yapılar görünür.
2. Canlı listesinden `#` kimliğiyle bir organizma seç (klavye: `↑ ↓ Enter`).
3. **Sinir ağı mikroskobunu** aç: son kararın 12 girdisini, 8 gizli aktivasyonu,
   4 eylem olasılığını ve seçilen eylemi gör.
4. Bir gizli birime tıkla: aynı ağın aynı gözlemle susturulmuş hâli hesaplanır
   (**karşı-olgusal**, gerçek karar değil).
5. **Soy defterinde** atasal → torun genom uzaklığına bak.
6. Koşulu değiştir (ör. seçilim baskısını yükselt) ve farkı izle.
7. **Kayıt** panelinden IndexedDB'ye kaydet veya JSON dışa aktar.

---

## Beş unsur nerede?

| Unsur | Nerede | Durum |
|---|---|---|
| Tek hücreli → çok hücreli | Bağ grafiği, tomurcuk ayrılması, parçalanma | ✅ çalışıyor |
| Kalıtım, mutasyon, uyarlanma | `src/sim/genome.ts`, `src/sim/world.ts` | ✅ çalışıyor |
| Gerçek ANN ile öğrenme | REINFORCE + hareketli baseline | ✅ çalışıyor, gradyan test edildi |
| Algı/temsil/hafıza/dünya modeli yönü | Algı modülü gerçek; V1/V2 planı | ⚠️ kısmen (bkz. PROGRESS) |
| Dil/görsel model gözlemcisi | Kanıt paketi + yerel özet + sunucu rotası | ⚠️ yerel tam, canlı model doğrulanmadı |

**Deney paketi yazıldı ve koşuyor.** `npm run experiments` deney paketi
(1.921 koşu, 26 bölüm) headless koşturur; sonuçlar `docs/EXPERIMENTS.md` içinde ham koşu değerleriyle
durur.

| Deney | Sonuç |
|---|---|
| Bağ gücü → koloni büyüklüğü | ✅ **2.33 → 21.25**, p < 0.0001, %100 iyileşme |
| Mutasyon + seçilim → uyarlanma | ⚪ sonuçsuz (p = 0.097), 3 nesle yetmiyor |
| Yaşam içi öğrenme → davranış | ❌ **etki yok** (p = 0.333) |
| Popülasyon-ES (yaşam içi) | ❌ etkisiz — anti-drift, arama değil (p = 0.80) |
| Evrimsel politika araması (kontrol) | ✅ **+0.161** görülmemiş dünyalarda |
| **Evrim Atölyesi** (ürün özelliği, tarayıcıda doğrulandı) | ✅ görülmemiş tohumlarda **+0.035…+0.072**, 0.4–0.6 sn |
| MODES açık uçluluk metrikleri (Faz C1) | ⚪ **yakınsama**: yenilik %37 → %0,9, çeşitlilik daralıyor |
| **Yaşam haritası** (Faz D, ürün özelliği) | ⚪ **çukur ölçüldü:** 7/27 kutu, en yoğun kutuda %52 |
| Arşivin seçilime katılması (Faz D, ε > 0) | ❌ **işe yaramadı** — doluluk değişmedi (p = 1,00); boyut ekseni kalıtsal değil |
| Koloni sönümlenmesi (Faz B1) | ⚪ **teşhis edildi:** kaynak/avcı elendi, sınırlayıcı **bağ ömrü** (~2.100 tick) |
| Bağ ömrü duyarlılığı (Faz B1b) | ✅ ölçüt karşılandı: ömür ×4 → 4+ hücreli yapılar 0 → 0.25 |
| Y-2 bağ ömrünü seçilime açma | ❌ başarısız — kayma −0.006 [−0.014, +0.002], p = 0.343 |
| Üreme tıkanması | ❌ değil tıkanma, **çöküş**: son çeyrekte 1 doğum, pop 166 → 41 |
| Uzun vadeli dayanıklılık | ❌ §5.4 40.000 tick'e **genellenmiyor** — kalibrasyon kısmi hafifletiyor |
| **Bağ enerji paylaşımı** (varsayılan ayar) | ⚪ **ölçülebilir etkisi yok**: paylaşmanın matematiksel olarak imkânsız olduğu dünyayla tepe küme **birebir aynı** (fark [0, 0], 12 tohum) |

Son satır önemli: aynı ölçümde evrimsel arama +0.161 kazancı bulurken
REINFORCE +0.020 (gürültü) buluyor. Darboğaz görevde değil, **öğrenme
algoritmasında.** Tam teşhis zinciri: `docs/VALIDATION.md` §4.5–4.9.

Ayrıntı ve sonraki seçenekler: `docs/PROGRESS.md` §3.

---

## Ne yaptığımızı iddia etmiyoruz

- **Bilinç veya genel zekâ üretilmiyor.** Organizmaların içindeki ağ soyut bir
  hesaplama modelidir; fiziksel hücrelerle aynı şey değildir.
- **Görsel/grafik başarısı için sahte sayı veya ekran görüntüsü yok.**
- **Eksik doğrulamalar gizlenmedi.** `docs/VALIDATION.md` §7'de açıkça listelendi.
- **Öğrenmenin işe yaradığı iddia edilmiyor.** Mekanizma çalışıyor ve
  gradyanı doğrulanmış, ama ölçülebilir bir davranış etkisi **bulunamadı**
  (`VALIDATION.md` §4.5). Nedeni dört bağımsız ölçümle saptandı (§4.5–4.9):
  ne güncelleme sıklığı, ne habitat zorluğu, ne politika sınıfı — aynı ölçümde
  evrimsel arama +0.161 kazandığı için darboğaz REINFORCE'un kendisinde.
- **Canlı LLM/VLM çağrısı yapılmadı** (anahtar yoktu). Uyarlayıcı yapılandırılmış
  bir varsayımdır.

---

## Mimari

```
Ana iş parçacığı (React + R3F)          Dedicated Web Worker (saf TS)
─────────────────────────────           ──────────────────────────────
HUD, paneller, kamera, çizim    ◄────►  world.step() — TEK yazar
DOM olayları, seçim, komutlar           kayıt/geri yükleme, dallanma
                                  komut  (React/three bağımlılığı YOK)
```

- Kare paketi `Float32Array` olarak aktarılır; React durumuna kare başına hücre
  yazılmaz.
- Hücreler tek bir `InstancedMesh`; geometri ve malzeme paylaşılır.
- Komşu aramaları uzamsal ızgara ile.
- Üç ayrı RNG akışı (`env`, `inherit`, `action`) → A/B dalları birbirini kaydırmaz.
- Sabit 50 ms adım; 1×/2×/4× aynı adımları daha sık yürütür.

---

## Doğrulama özeti

```
Test Files  2 passed (2)
     Tests  36 passed (36)
```

| Kontrol | Sonuç |
|---|---|
| Enerji korunumu (kapalı sistem) | rezidüel = **0.0000** |
| MLP analitik gradyan ↔ sonlu fark (140 parametre) | ✅ (2e-6) |
| Yavrunun öğrenilmiş farkı sıfırlanıyor | ✅ |
| Öğrenme kapalıyken ağırlıklar sabit | ✅ |
| 10.000 tick dayanıklılık | ✅ |
| Simülasyon CPU maliyeti | 0.38–0.57 ms/tick |

Ayrıntı ve **doğrulanmayanlar**: `docs/VALIDATION.md`.

---

## Teknoloji

Sürümler canlı npm kayıt defterinden doğrulandı, sabitlendi ve `package-lock.json`
üretildi:

React 19.3.0 · three 0.186.1 · @react-three/fiber 9.8.1 · drei 10.7.9 ·
Vite 8.3.3 · Vitest 5.0.3 · TypeScript 5.9.3 · Zustand 5.0.15

3B varlıklar **Blender 5.1.1 ile prosedürel üretilir** — hiçbir dış model
indirilmez (`docs/ASSETS.md`).

---

## Belge haritası

| Dosya | İçerik |
|---|---|
| `docs/MODEL.md` | Simülasyonun ne yaptığı, tüm formüller, işletimsel tanımlar |
| `docs/VALIDATION.md` | Gerçek test sonuçları, **deney sonuçları** ve doğrulanmayanlar |
| `docs/EXPERIMENTS.md` | `npm run experiments` çıktısı — 12.000 tick, ham koşu değerleriyle (üretilmiş) |
| `docs/EXPERIMENTS-DEEP.md` | `npm run experiments -- --deep` çıktısı — 40.000 tick, ekolojik çöküşü kapsar (üretilmiş) |
| `docs/PROGRESS.md` | Ne yapıldı, ne eksik, sonraki adım |
| `docs/LITERATURE.md` | Tasarım kararlarını dayandıran literatür haritası (~45 okunmuş kaynak) |
| `docs/ROADMAP.md` | 5 fazlı geliştirme yol planı ve yapılmayacaklar listesi |
| `docs/ASSETS.md` | Varlık üretimi ve lisans kaydı |
| `CELL_TO_MIND_GELISTIRME_PLANI.md` | Uygulama planı ve teknoloji kararları |
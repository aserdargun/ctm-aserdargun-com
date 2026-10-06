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
| `npm test` | Vitest — 36 test |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run assets:build` | Blender 5.1.1 ile varlıkları yeniden üretir |
| `npm run server` | Gözlemci sunucu rotası |

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

**Üç deneyin motoru yazılmadı.** Panel düğmeleri var, sonuç alanı "henüz
gözlenmedi" diyor. Ayrıntı: `docs/PROGRESS.md`.

---

## Ne yaptığımızı iddia etmiyoruz

- **Bilinç veya genel zekâ üretilmiyor.** Organizmaların içindeki ağ soyut bir
  hesaplama modelidir; fiziksel hücrelerle aynı şey değildir.
- **Görsel/grafik başarısı için sahte sayı veya ekran görüntüsü yok.**
- **Eksik doğrulamalar gizlenmedi.** `docs/VALIDATION.md` §6'da açıkça listelendi.
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
| `docs/VALIDATION.md` | Gerçek test sonuçları **ve doğrulanmayanlar** |
| `docs/PROGRESS.md` | Ne yapıldı, ne eksik, sonraki adım |
| `docs/ASSETS.md` | Varlık üretimi ve lisans kaydı |
| `CELL_TO_MIND_GELISTIRME_PLANI.md` | Uygulama planı ve teknoloji kararları |
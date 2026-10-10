# Cell to Mind — Deney Sonuçları

**Körüldü:** 2026-10-10T20:33:53.446Z
**Toplam koşu:** 4128 · **duvar süresi:** 105.6 s
**Mod:** tam

> Bu dosya `npm run experiments` ile üretilir. Sayılar ölçülmüştür;
> hiçbir koşu düşürülmemiştir. Ham koşu değerleri aşağıdadır.

## Değişmez kontroller

```
  ✓ enerji korunumu (arena) — en büyük |rezidüel| = -0.000000000 e
  ✓ enerji korunumu (koloni) — en büyük |rezidüel| = -0.000000000 e
  ✓ öğrenme kapalıyken ağırlıklar sabit — ‖Δθ‖ = 0.000000000, güncelleme sayısı = 0
  ✓ determinizm (aynı tohum → aynı sonuç) — arena ve koloni koşuları bit düzeyinde aynı
  ✓ ağırlık enjeksiyonu uygulanıyor — enjeksiyon sonrası ağırlıklar korundu
```

## Arena zorluk kalibrasyonu (headroom)

Öğrenme deneyi ancak rastgele politika tam performans almadığında bilgi taşır.
Kaynak sayısı arttıkça kontrol kolusunun skoru tırmanır ve ölçüm tavana yapışır.

```
  kaynak= 4 → kontrol 0.538 · headroom 0.462 · hayatta kalma 100%
  kaynak= 8 → kontrol 0.677 · headroom 0.323 · hayatta kalma 100%
  kaynak=14 → kontrol 0.794 · headroom 0.206 · hayatta kalma 100%
  kaynak=22 → kontrol 0.873 · headroom 0.127 · hayatta kalma 100%
  kaynak=34 → kontrol 0.928 · headroom 0.072 · hayatta kalma 100%
```

## Öğrenme · zorluk taraması

Varsayılan habitatta (34 kaynak) ölçüm headroom u yalnız 0.072 olduğu için
deney ölçemiyordu. Aşağıdaki tarama, **önceden kaydedilmiş** zorluk ekseninde
tam protokolü koşar: her noktada ayrık eğitim/değerlendirme tohumları,
eşleştirilmiş fark ve bootstrap güven aralığı vardır. Tüm eğri raporlanır —
yalnız elverişli nokta seçilmez.

```
  kaynak  headroom   kontrol    tedavi     fark [95% CI]        p      iyileşme  günc.  ‖Δθ‖_eğt  ezber
      4  0.429362  0.57063801  0.55146240  [-0.050, 0.005]    0.171483  7.040000%  9.0000  0.00251950  -0.013523
      8  0.356925  0.64307489  0.68219633  [-0.006, 0.091]    0.108489  95.440000%  9.0000  0.00279844  -0.000436
     14  0.180968  0.81903220  0.82093471  [-0.059, 0.060]    0.951805  52.710000%  9.0000  0.00277983  0.000006
     22  0.115606  0.88439418  0.89119154  [-0.030, 0.038]    0.697630  66.650000%  9.0000  0.00271105  -0.000401
     34  0.067718  0.93228151  0.93676617  [-0.005, 0.015]    0.386261  80.370000%  9.0000  0.00260241  0.000785
```

## Öğrenme sinyali duyarlılığı

§4.5 teşhisinin doğrulaması: davranış etkisizliği ağır görevden mi yoksa
çok küçük ağırlık hareketinden mi kaynaklanıyor? Model sabitleri
**değiştirilmez** — bu bir duyarlılık analizidir, ürün kararı değildir.
Oyun her zaman varsayılan sabitlerle çalışır.

```
  ufuk  lr      günc.     ‖Δθ‖      fark [95% CI]           p       iyileşme  ezber
    64  0.020000  9.000000  0.00274625  [-0.077, 0.088]       0.868613  57.440000%  -0.00279
    64  0.100000  9.000000  0.01397606  [-0.076, 0.087]       0.826117  60.660000%  0.01714
    64  0.500000  9.000000  0.06842854  [-0.117, 0.075]       0.826717  43.590000%  -0.00426
    16  0.020000  37.000000  0.02707835  [-0.136, 0.053]       0.482352  24.600000%  -0.01662
    16  0.100000  37.000000  0.14130672  [-0.139, 0.057]       0.614239  33.080000%  -0.02895
    16  0.500000  37.000000  0.55639990  [-0.222, 0.008]       0.080492  3.980000%  -0.09311
     8  0.020000  75.000000  0.09192121  [-0.143, 0.042]       0.346265  17.220000%  -0.00784
     8  0.100000  75.000000  0.45674084  [-0.234, -0.028]      0.009699  0.360000%  -0.05449
     8  0.500000  75.000000  1.57064459  [-0.401, -0.209]      0.000100  0.000000%  -0.27454
```

## Politika uzayı araştırması (öğrenmenin üst sınırı)

"Öğrenme işe yaramıyor" iki şeyden olabilir: politika öğrenemiyor, ya da
politika sınıfı zaten tıkanmış. Rastgele (eğitimsiz) politikaların skor
dağılımı ikisini ayırır: yayılım varsa öğrenilecek bir davranış vardır.

```
  kaynak=14 · n=160 rastgele politika
    min 0.520 · q25 0.775 · medyan 0.854 · q75 0.901 · maks 0.963 · ortalama 0.826
    en iyi %10 ortalaması − genel ortalama = öğrenilebilir açıklık: 0.118
```

## Evrimsel politika araması — RL ile aynı ölçüm

Ayırıcı soru: politika sınıfındaki 0.118'lik açıklığı **arama** bulabiliyor mu?
Bulabiliyorsa RL'in kusuru kanıtlanmış olur; bulamıyorsa görev zordur.
Aynı arena, aynı ölçüm, aynı tohum ayrımı — tek fark arama yöntemi.

```
   nesil   en iyi   ortalama
       0  0.9272408  0.807978613
       1  0.9272408  0.905444167
       4  0.9306804  0.918236142
       9  0.9306804  0.916097459
  eğitim en iyi 0.931 · rastgele taban 0.735
  DEĞERLENDİRME (görülmemiş tohumlar): bulunan 0.916 · rastgele taban 0.755 · kazanç 0.161
```

## S-1 · Varyans azaltma (varsayılan adım ayarlarında)

Önceden kaydedilmiş hipotez: darboğaz ölçek değil **varyans**; avantaj
dönüşümü (z-skor / işaret) gradyanın sinyal/gürültü oranını artırır.
Tarama `TRAJECTORY_LIMIT` ve `LEARN_RATE` değerlerini **varsayılanlarda
tutar** (64 / 0.02) — §4.7 bölümünde adımı büyütmenin kötüleştirdiği
ölçüldüğü için S-1 en zor koşulda sınanır.

**Başarı ölçütü (önceden kaydedildi):** en az bir varyantta farkın güven
aralığı sıfırdan ayrışmalı (p < 0.05) ve iyileşme olasılığı > %80 olmalı.

```
  varyant                  günc.     ‖Δθ‖      fark [95% CI]           p      iyileşme  ezber
  temel (dönüşüm yok)     9.00000  0.00272571  [-0.022, 0.062]       0.325267  83.530000%  0.01657
  z-skor avantaj          9.00000  0.00348026  [-0.021, 0.067]       0.320468  84.830000%  0.01395
  işaret avantajı         9.00000  0.00252176  [-0.020, 0.064]       0.277972  85.920000%  0.01656
  işaret + z-skor         9.00000  0.00307264  [-0.014, 0.067]       0.167283  91.060000%  0.01633
```

## S-1b · İşaret avantajı + ölçülü adım artışı

§4.7 büyük adımı **dönüşümsüz**, §4.10 dönüşümü tek başına denedi.
Bileşimi listede açık olarak yazılıydı ve denenmemişti. İşaret avantajı
gradyan büyüklüğünü sınırladığı için büyük adımın gürültüyü değil sinyali
ölçeklemesi beklenir.

**Başarı ölçütü (S-1 ile aynı eşik):** en az bir noktada p < 0.05 ve
iyileşme olasılığı > %80.

```
  ufuk  lr      günc.     ‖Δθ‖      fark [95% CI]           p      iyileşme  ezber
    64  0.020000  9.000000  0.00252176  [-0.019, 0.064]       0.275972  86.040000%  0.01656
    64  0.100000  9.000000  0.01222294  [-0.029, 0.050]       0.551545  73.290000%  0.01085
    64  0.500000  9.000000  0.06256061  [-0.037, 0.059]       0.547645  73.580000%  -0.00361
    64  2.000000  9.000000  0.26703045  [-0.060, 0.041]       0.784722  40.310000%  -0.02973
```

## S-2 teşhisi · Ödül sinyali

Buraya kadar yalnızca *sonuçlar* ölçüldü (politika daha mı iyi davranıyor).
Öğrenmenin çalışıp çalışmadığını belirleyen şey **sinyalin kendisidir**:
ödül, politikanın kararlarına duyarlı mı?

**Yorum kuralı önceden yazıldı:** pay < %5 → pratikte sabit sinyal, hiçbir
optimizer çalışamaz; %5–%20 → zayıf; ≥ %20 → sinyal var, sorun optimizer tarafındadır.

```
  kaynak=14 · 48 politika × 2 dünya
    ödül (karar başına): min 1.19747 · medyan 2.04311 · maks 3.28979
    ödül ↔ performans: Pearson 0.696 · Spearman 0.733
    politikaya bağlı ödül varyansı payı: 97.92%
    → Ödülün %97.9'i politika farklarından geliyor → **sinyal var**. Sorun optimizer tarafındadır.
```

## Bağ gücü koloni büyüklüğünü artırıyor mu?

**Soru:** Aynı dünyada, aynı tohumda, yalnız kurucuların bondAffinity değeri değiştiğinde bağlı küme daha büyük mü oluyor?

**Protokol (sonuçtan önce sabitlendi):** Eşleştirilmiş tasarım. Aynı seed iki kolda kullanılır (aynı kaynak düzeni, aynı kaya düzeni, aynı başlangıç konumları). Tek fark: kurucu genomlarının bondAffinity değeri 0.05 ↔ 0.9. Mutasyon kapalı → değer soy boyunca birebir korunur. Birincil ölçüm: pencerede görülen en büyük bağlı küme. Farkın güven aralığı bootstrap ile hesaplanır.

```
── Bağ gücü koloni büyüklüğünü artırıyor mu?
   soru    : Aynı dünyada, aynı tohumda, yalnız kurucuların bondAffinity değeri değiştiğinde bağlı küme daha büyük mü oluyor?
   n       : 12 eşleştirilmiş tohum
   ölçüm   : penceredeki en büyük bağlı küme (hücre)
   kontrol : 2.333 [2.083, 2.583]
   tedavi  : 21.250 [18.667, 23.417]
   fark    : 18.917 [16.417, 21.000]   p = 0.0001
   iyileşme olasılığı (bootstrap): 100.0%
   · zirve 4+ hücreli yapı sayısı: kontrol 0.000 · tedavi 31.333 · fark 31.333
   · pencere sonu popülasyon: kontrol 232.750 · tedavi 267.083 · fark 34.333
   · pencere sonu bağ sayısı: kontrol 1.250 · tedavi 91.583 · fark 90.333
   enerji rezidüelü: 0.000000016 e
   kontrol ham : [2.0000, 2.0000, 2.0000, 3.0000, 2.0000, 3.0000, 2.0000, 2.0000, 3.0000, 2.0000, 3.0000, 2.0000]
   tedavi ham  : [17.0000, 24.0000, 22.0000, 24.0000, 24.0000, 24.0000, 24.0000, 15.0000, 24.0000, 11.0000, 24.0000, 22.0000]
```

**Notlar:**

- `bondAffinity` genetik bir parametredir; seçilim değeri değildir. Bu deney müdahale edilen bir parametrenin etkisini ölçer, seçilim gücünü değil.
- 4+ hücreli eşik `C.MULTICELL_THRESHOLD` işletimsel bir ölçüttür; biyolojik bir tanım değildir.
- Her iki kolda da popülasyon aynı çekirdekten türer; fark yalnız bağ davranışından gelir.

## Mutasyon + seçilim popülasyonu iyileştiriyor mu?

**Soru:** Aynı başlangıçtan, mutasyon açık olan popülasyon donmuş popülasyondan daha iyi besleniyor mu?

**Protokol (sonuçtan önce sabitlendi):** Eşleştirilmiş tasarım. Aynı seed iki kolda kullanılır; tek fark mutationEnabled. Birincil ölçüm: pencerenin son tick değerindeki ortalama normalize enerji (ölü hücreler ortalama dâhil hesaplanır, yani ölüm cezadır). İkincil ölçüm `genomeShift`: kurucu ortalama genomu ile hayatta kalanların ortalama genomu arasındaki ortalama mutlak kayma.

```
── Mutasyon + seçilim popülasyonu iyileştiriyor mu?
   soru    : Aynı başlangıçtan, mutasyon açık olan popülasyon donmuş popülasyondan daha iyi besleniyor mu?
   n       : 12 eşleştirilmiş tohum
   ölçüm   : pencere sonu ortalama normalize enerji (ölüm cezalı)
   kontrol : 0.342 [0.307, 0.377]
   tedavi  : 0.353 [0.325, 0.382]
   fark    : 0.011 [-0.001, 0.025]   p = 0.0967
   iyileşme olasılığı (bootstrap): 96.0%
   · genom kayması (genomeShift): kontrol 0.007 · tedavi 0.006 · fark -0.000
   · zirve en büyük küme: kontrol 12.667 · tedavi 12.250 · fark -0.417
   · pencere sonu 4+ hücreli yapı: kontrol 3.083 · tedavi 2.250 · fark -0.833
   · ulaşılan en yüksek nesil: kontrol 2.917 · tedavi 2.917 · fark 0.000
   enerji rezidüelü: 0.000000017 e
   kontrol ham : [0.3120, 0.4392, 0.2658, 0.4163, 0.3602, 0.2888, 0.4032, 0.2803, 0.4277, 0.3348, 0.2832, 0.2872]
   tedavi ham  : [0.3281, 0.4241, 0.2778, 0.4260, 0.3465, 0.3471, 0.3794, 0.3326, 0.4301, 0.3533, 0.2926, 0.2969]
```

**Notlar:**

- Bu deney **genetik uyarlanmanın dolaylı** bir ölçüsüdür: doğrudan "torun, atadan daha mı iyi" sorusu değil, mutasyonlu devralmanın popülasyon durumu iyileştirip iyileştirmediğini ölçer.
- Nesil sayısı artışı tek başına uyarlanma kanıtı değildir; aynı zamanda çoğalma hızının artışı olabilir. `genomeShift` buna karşı bir kontrol sağlar.
- Seçilim baskısı tasarımcının koyduğu bir avcı ve yoğunluk geri beslemesiyle uygulanır; rastgele yürüyüş değil.

## Yaşam içi öğrenme politikayı iyileştiriyor mu?

**Soru:** Eğitim tohumlarında öğrenmiş politika, hiç görülmemiş değerlendirme dünyalarında rastgele başlangıç ağından daha mı iyi besleniyor?

**Protokol (sonuçtan önce sabitlendi):** Eğitim tohumları 1..N, değerlendirme tohumları 1001..1000+N — kümeler ayrık ve bu ayrım sonuçtan önce sabitlendi. Eğitimde öğrenme açık; değerlendirmede öğrenme KAPALI, böylece iki kol arasındaki tek fark ağırlıklardır. Birincil ölçüm: penceredeki ortalama normalize enerji (ölümden sonra katkı 0). Analiz: indeksle eşleştirilmiş farklar üzerinde yüzdelik bootstrap güven aralığı ve bootstrap hipotez testi.

```
── Yaşam içi öğrenme politikayı iyileştiriyor mu?
   soru    : Eğitim tohumlarında öğrenmiş politika, hiç görülmemiş değerlendirme dünyalarında rastgele başlangıç ağından daha mı iyi besleniyor?
   n       : 20 eşleştirilmiş tohum
   ölçüm   : değerlendirme penceresinde ortalama normalize enerji
   kontrol : 0.826 [0.778, 0.869]
   tedavi  : 0.847 [0.805, 0.884]
   fark    : 0.020 [-0.022, 0.061]   p = 0.3327
   iyileşme olasılığı (bootstrap): 83.3%
   · kontrol kolunun headroom u (1 − kontrol skoru): kontrol 0.174 · tedavi 0.847 · fark 0.020
   · EZBER KONTROLÜ — eğitim dünyasındaki fark: kontrol 0.843 · tedavi 0.843 · fark -0.000
   · ezber farkı − genelleşme farkı (aralık daralması): kontrol -0.000 · tedavi 0.020 · fark -0.021
   · ölçüm penceresi sonuna kadar yaşama oranı: kontrol 1.000 · tedavi 1.000 · fark 0.000
   · eğitimde ortalama politika güncellemesi: kontrol 0.000 · tedavi 9.000 · fark 9.000
   · eğitimde ağırlıkların ne kadar kaydığı (‖Δθ‖): kontrol 0.000 · tedavi 0.003 · fark 0.003
   · eğitim koşularında hayatta kalma oranı: kontrol 0.000 · tedavi 1.000 · fark 1.000
   enerji rezidüelü: 0.000000000 e
   kontrol ham : [0.8192, 0.7427, 0.8975, 0.9123, 0.5692, 0.9534, 0.8950, 0.8586, 0.6682, 0.7925, 0.9156, 0.8041, 0.6205, 0.9425, 0.8726, 0.8922, 0.7821, 0.8759, 0.7992, 0.9077]
   tedavi ham  : [0.7159, 0.8793, 0.6781, 0.8877, 0.7586, 0.9545, 0.9039, 0.9277, 0.6238, 0.7484, 0.8780, 0.8954, 0.8069, 0.9432, 0.8840, 0.9112, 0.8793, 0.8536, 0.9021, 0.8994]
```

**Notlar:**

- Değerlendirmede öğrenme kapalıdır; bu, ölçtüğümüz şeyin "öğrenme" değil **"öğrenmenin ürettiği politika"** olmasını sağlar.
- Kontrol kolu, değerlendirme dünyasının kendi rastgele başlangıç ağıdır — yani "hiç eğitim almamış rastgele politika" taban çizgisidir.
- REINFORCE + sabit sonlu ufuk (bootstrap yok, γ=0.95) kullanılır; bkz. `docs/MODEL.md` §4. Yüksek varyans beklenir.
- Bu deneyin sonucu **olumlu olmak zorunda değildir**. p ≥ 0.05 çıkarsa bulgu "bu koşullarda ölçülebilir bir iyileşme yok"; bulgudur.
- Eğitim ve değerlendirme tohum kümeleri ayrık olduğu için sonuç ezber değil **genelleşme** ölçüsüdür.

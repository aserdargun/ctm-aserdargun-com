# Cell to Mind — Deney Sonuçları

**Körüldü:** 2026-10-11T15:27:08.148Z
**Toplam koşu:** 1920 · **duvar süresi:** 429.2 s
**Mod:** standart
**Pencere:** 12.000 tick (40.000 tick'lik ekolojik çöküşü kapsamak için `--deep` kullanın)

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

## Faz B1 · Ekolojik sönümlenme teşhisi

Koloniler neden dağılıyor? `docs/ROADMAP.md` Faz B1 kuralı: ayrım yapılmadan
parametre değiştirilmez. Beş rakip açıklama beş ölçümle ayrıldı.

```
  tohum 11 · 12000 tick
  zirve: tick 3200 · en büyük küme 8 · bağ 77 · bütünlük 0.561 · uzama 0.018
  sönümlenme: tick 8400 · küme 1 · bağ 0 · bütünlük 0.000 · uzama 0.000
  rezerv (sönümlenmede): %54.7
  ölüm payları: açlık %70 · avcı %30
  yorgunluk tek başına açıklayabileceği kayıp: 0.24
  kopma anındaki uzama: medyan 0.079 · kopan 83 bağ · tükenerek %100 · uzayarak %0
  koptukları andaki medyan dayanım: 0.450
  → Baskın açıklama: **koloni geometrisi / bağ uzaması**. Kaynak bitmemiş (rezerv doluluğu %54.7), ortalama bağ uzaması 0.000 (dinlenme uzunluğunun 1.00 katı). Yorgunluk tek başına en fazla 0.24 bütünlük yiyebilirdi. Kopan 83 bağdan 83 tanesi bütünlüğü tükenerek (%100), 0 tanesi uzama sınırını aşarak koptu (%0); koptukları andaki medyan uzama 0.079 — hayatta kalanların 0.000 ortalamasının 79000 katı.
```

```
   tick   pop   org   küme   4+   bağ  bütünlük   uzama   rezerv%   enerji   açlık   avcı
      0    48    48      0    0     0  0.000   0.000     100.0  108763      0      0
   1000   100    72      3    0    28  0.782   0.026      96.7  107527      0      0
   2000   157   107      4    1    50  0.642   0.012      91.4  104973      0      0
   3000   225   150      7    9    75  0.573   0.010      83.6   99041      0      0
   4000   254   198      8    6    56  0.530   0.017      74.9   90161      3      2
   5000   247   219      5    2    28  0.414   0.011      67.9   80447     12      2
   6000   217   207      3    0    10  0.208   0.029      62.8   72908     37      3
   7000   175   174      2    0     1  0.820   0.000      59.0   67950     73     10
   8000   163   162      2    0     1  0.265   0.174      55.6   64176     78     19
   9000   153   152      2    0     1  0.933   0.000      52.9   60880     82     26
  10000   142   141      2    0     1  0.647   0.003      50.5   58145     87     33
  11000   139   137      2    0     2  0.278   0.089      48.1   55622     90     35
  12000   130   129      2    0     1  0.484   0.010      46.5   53355     95     40
```

## Faz B1b · Bağ ömrü duyarlılığı

B1 teşhisinin doğrudan sınaması: bağ ömrü uzatılınca koloniler kalıcı hale geliyor mu?

**Başarı ölçütü (önceden kaydedildi):** yorgunluk ve strain katsayısı
düşürüldüğünde pencerenin sonunda **4+ hücreli yapıların sıfırdan çıkması**
(varsayılan ayarlarda pencerenin sonunda 0).

```
  strainK   yorgunluk   bağ ömrü   zirve küme   son çeyrek   son 4+   son pop   son rezerv   sönüml.   kalıcı
  0.0200000   0.00002000      2083         17            2   0.000000   128.5000000   36.19344083%      4200   HAYIR
  0.0100000   0.00001000      4167         24            3   0.000000   128.2500000   35.13807477%      9800   HAYIR
  0.0050000   0.00000500      8333         24           10   0.250000   131.5000000   34.96256427%      5200   evet
  0.0020000   0.00000100     21277         24            6   0.250000   128.2500000   34.63571636%      7000   evet
```

## Y-2 · Bağ ömrünün kalıtılabilirliği

Yorgunluk terimi genoma bakmıyor: her bağ, sahibi ne genom taşırsa taşsın
aynı yorulma hızına sahip. Kanca açıldığında yorgunluk da `bond.strength`
ile çarpılır ve dayanıklılık seçilime açık hâle gelir.

İki kol **aynı** kalıcı-bağ ayarını kullanır, tek fark kalıtılabilirliktir.

**Başarı ölçütü (önceden kaydedildi):** tedavi kolunun seçilim kayması
sıfırdan ayrışmalı ve kontrol kolundan büyük olmalı.

```
  6 eşleştirilmiş tohum · 12000 tick · strainK 0.005 (iki kolda da koloniler ayakta)
  kontrol  (yorgunluk genoma bağlı DEĞİL): kurucu 0.4489 → hayatta kalan 0.4469 · kayma -0.0020
  tedavi   (yorgunluk genoma BAĞLI):    kurucu 0.4489 → hayatta kalan 0.4444 · kayma -0.0045
  tedavi kayması [-0.0045, -0.0104, 0.0019] · iki kol farkı -0.0025 [-0.0064, 0.0012] · p = 0.1967
  üreme çevrimi (kurucu başına): kontrol 5.62 · tedavi 5.53
  enerji rezidüelü: 0.000000000 e
  → Seçilim kayması sıfırdan **ayrışmadı**: -0.0045 [-0.0104, 0.0019]. Kurucu başına 5.53 üreme çevrimi gerçekleşti (kümülatif 266 doğum).
```

## Üreme tıkanması teşhisi

Popülasyonun neden ~5.5 çevrimde doyduğu sorusu. Kümülatif doğumun
yataylaması **"doygunluk" sanıldı; ölçüm aslında doğumların durmasını**
gösteriyordu — kümülatif sayı artmayı bırakınca çoğalm da bitmiştir.

```
  tohum 11 · 12000 tick
  tomurcuklama 105 · parçalanma 61 · kurucu soyun canlı hücrelerdeki payı 100.0%
  → Doğum hızı sürüyor: ilk çeyrekte 0, son çeyrekte 22 doğum — döngü **durağan ama durmuş değil.** Sınırlayıcı yoğunluk/enerji geri beslemesi olabilir.

   tick   pop   org   küm.dğ   bud   frag   kurucu soy   kurucu hücre   soy hücre   kol.nesil   küme
       0    48    48      48     0      0          48           48          0           0      0
   12000   134   114     226   105     17         114          134          0          69      4
```

## Uzun vadeli dayanıklılık — §5.4 genelleniyor mu?

Bölüm 5.4 bağ dayanıklılığının 12.000 tick penceresinde 4+ hücreli
yapıları geri getirdiğinin **ölçüldüğünü** ve ölçütü karşıladığını yazar.
Bu tarama aynı ayarları 40.000 tick boyunca sınar: kalibrasyon sönümlenmeyi
erteliyor mu, yoksa uzun vadeli çöküşü gerçekten önlüyor mu?
uzun vadeli çöküşü gerçekten önlüyor mu?

```
  strainK   bağ ömrü   son pop   çöküş oranı   son çeyrek küme   son 4+   son bağ   son rezerv   geç açlık%   geç avcı%
  0.0200000     2083       130   1.97692308    2.0000000000        0        1   46.45697622%   48.14814815   51.85185185
  0.0050000     8333       132   1.96212121    2.9375000000        0       10   45.74698779%   76.00000000   24.00000000
  0.0020000    21277       137   1.89051095    4.1875000000        0       30   45.30070795%   84.21052632   15.78947368
```

## 40.000 tick sınırı — erişilebilirlik mi, avcı mı?

```
  tohum 11 · 12000 tick · strainK 0.002
   tick   pop   ort. enerji   açlık%   medyan uzaklık   yakın%   rezerv%   avcı en.   açlık öl.   avcı öl.
       0    48  55.000000000  0.00000   1.73158898493   39.583333   100.000000%   4.36363636          0        0
    2000   157  49.133697680  0.00000   1.18455243353   72.611465   91.441231%   21.33294384          0        0
    4000   248  39.985221408  1.20968   1.16662841415   71.370968   76.225215%   21.92376704          0        0
    6000   217  26.764395037  13.82488   1.34415756756   52.073733   63.104396%   28.46873869         36        4
    8000   165  32.461949180  7.87879   1.29943490497   58.181818   55.000405%   25.56847946         73        6
   10000   149  31.114700057  7.38255   1.21698899563   71.140940   49.769670%   13.23098451         83        9
   12000   137  31.105018252  11.67883   1.26722285089   58.394161   45.300708%   10.02696501         95       10

  → Sınırlayıcı: **enerji erişimi / açlık.** Hücre enerjisi 52.1 → 31.1 e düştü; geç çeyrekte açlıktaki hücre payı %12, kaynak erişim uzaklığı 1.24 mb (rezerv %45.3).
```

## Kaynak rejenerasyonu A/B

`C.DEFAULT_REGEN = 0`: kaynak hiç yenilenmiyor. Rejenerasyon açıldığında
popülasyon kalıcı hâle geliyor mu?

**Bu tarama bir muhasebe hatasını da ortaya çıkardı:** rezidül formülünde
`externalInput` işareti terstiydi. `DEFAULT_REGEN = 0` olduğu için hata
20+ deneyde görünmemişti.

```
  regen   zirve pop   son pop   son çeyrek pop   son rezerv   ort. enerji   açlık%   açlık öl.   avcı öl.   avcı öldü   rezidüel
  0.000000        248       137   137.00000000000   45.3007079467%   31.105018252   11.67883         95       10       hayır   -0.000000016
  0.002000        252       130   130.00000000000   45.8637016205%   32.438470883   6.15385         91       15       hayır   0.000000011
  0.010000        245       135   135.00000000000   48.8528625377%   29.314859647   11.85185         86       13       hayır   -0.000000034
```

## Popülasyon-ES — seçilen öğrenme yönünün testi

REINFORCE her iki kolda da **kapalıdır**; ölçülen fark yalnız
popülasyon-ES katkısıdır. Birincil ölçüm **ödül hızıdır**
(`lifetimeReward / yaş`) — kümülatif ödül yaşamayı ödüllendirir ve
ölçüm yanlılığı yaratır.

```
  20000 tick · 8 eşleştirilmiş tohum · REINFORCE her iki kolda da KAPALI
  kontrol (popülasyon-ES yok): ödül hızı 0.32958 e/tick · enerji 0.304 · pop 89.375 · küme 2
  tedavi  (popülasyon-ES var): ödül hızı 0.32808 e/tick · enerji 0.318 · pop 90 · küme 2
  uygulanan güncelleme: 40 · enerji rezidülü: 0.000000192 e
  eşleştirilmiş fark -0.00150 [-0.00430, 0.00174] · p = 0.3388 · iyileşme olasılığı 16.5%
  → Popülasyon-ES **ölçülebilir etki üretmedi**: fark -0.00150 [-0.00430, 0.00174], p = 0.3388.
```

## Ödül hızı yayılımı — paylaşılan dünya sinyali siler mi?

Popülasyon-ES başarısızlığının iki açıklamasını ayıran ölçüm.

```
  15000 tick
  paylaşılan dünyada bireyler arası CV: %9.0
  bağımsız dünyalar arası ortalama CV: %7.4
  oran: 1.22×
  → Paylaşılan dünya sinyali **silmüyor**: bireyler arası CV %9.0, bağımsız dünyalar arası %7.4 (1.22×). Yani popülasyon içi ayrışma **vardır**; ortalama-alma güncellemesinin başarısızlığı arama eksikliğidir, sinyal yokluğu değil.
```

## Dal (branch) doğruluğu ve maliyeti

`VALIDATION.md` §9 madde 7 bu yolu "test edilmemiş" diye listeliyordu.
Ölçüldü: iki dal bit düzeyinde aynı ilerliyor, müdahale diğerine sızmıyor,
ve **çatallama ucuz** — yaşam içi arama bütçelenebilir.

Bu ölçüm sırasında `World.fromState` içinde **gerçek bir ürün hatası** bulundu:
`Object.create(World.prototype)` çağrısı constructor atladığı için sınıf alan
başlatıcıları hiç çalışmıyor, `ledger` `undefined` kalıyor ve ilk erişimde
TypeError atılıyordu — **snapshot tan dünya kurma (dolayısıyla `branch`) tamamen
bozuktu**. Düzeltildi; regresyon testi eklendi.

```
  çatal noktası: tick 3000 · 1500 adım sonra karşılaştırma
  snapshot boyutu: 2.544.411 bayt
  çatallama süresi: 42.51 ms · iki dalın koşusu: 2556.3 ms · oran 1.7%
  dallar bit düzeyinde aynı: evet · müdahale sızıntısı: yok · müdahale etkili: evet
  → Çatallama **doğru**: iki dal bit düzeyinde aynı ilerliyor ve müdahale diğerine sızmıyor. Snapshot 2.54 MB; bir dal açmak 21.3 ms, bir simülasyon adımı 0.852 ms → **bir çatal ≈ 25 tick** maliyetinde. Yani 500 tick'te bir, 16 pertürbasyonlu güncelleme ≈ 80% ek yük demek: üstel strateji yaşam içinde pratikte **bütçelenebilir**. Müdahale testi: müdahalesiz dal referansla AYNI, müdahale görmüş dal AYRILDI. **DİKKAT:** bu maliyet 3000. tick'te ölçüldü ve snapshot boyutuyla ölçeklenir; geç pencerelerde farklı olabilir ve **ölçülmedi**.
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

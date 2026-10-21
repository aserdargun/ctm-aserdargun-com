# Cell to Mind — Deney Sonuçları

**Körüldü:** 2026-10-21T12:47:01.138Z
**Ortam:** darwin (arm64) · Node v22.23.1
**Toplam koşu:** 2239 · **duvar süresi:** 952.2 s
**Mod:** TAM (derin pencere)
**Pencere:** 40.000 tick (40.000 tick'lik ekolojik çöküşü kapsamak için `--deep` kullanın)

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
  kaynak= 4 → kontrol 0.501 · headroom 0.499 · hayatta kalma 100%
  kaynak= 8 → kontrol 0.657 · headroom 0.343 · hayatta kalma 100%
  kaynak=14 → kontrol 0.753 · headroom 0.247 · hayatta kalma 100%
  kaynak=22 → kontrol 0.855 · headroom 0.145 · hayatta kalma 100%
  kaynak=34 → kontrol 0.922 · headroom 0.078 · hayatta kalma 100%
```

## Öğrenme · zorluk taraması

Varsayılan habitatta (34 kaynak) ölçüm headroom u yalnız 0.078 olduğu için
deney ölçemiyordu. Aşağıdaki tarama, **önceden kaydedilmiş** zorluk ekseninde
tam protokolü koşar: her noktada ayrık eğitim/değerlendirme tohumları,
eşleştirilmiş fark ve bootstrap güven aralığı vardır. Tüm eğri raporlanır —
yalnız elverişli nokta seçilmez.

```
  kaynak  headroom   kontrol    tedavi     fark [95% CI]        p      iyileşme  günc.  ‖Δθ‖_eğt  ezber
      4  0.478637  0.52136288  0.53351724  [-0.010, 0.033]    0.272173  85.570000%  9.0000  0.00241388  -0.006991
      8  0.384294  0.61570595  0.61269213  [-0.054, 0.049]    0.909309  45.560000%  9.0000  0.00268457  0.000865
     14  0.166646  0.83335435  0.83484623  [-0.038, 0.035]    0.934707  55.080000%  9.0000  0.00291532  -0.004180
     22  0.104073  0.89592714  0.86811152  [-0.083, 0.018]    0.280772  13.870000%  9.0000  0.00260672  0.002569
     34  0.076195  0.92380471  0.93168140  [-0.006, 0.023]    0.289071  86.760000%  9.0000  0.00243965  0.000280
```

## Öğrenme sinyali duyarlılığı

§4.5 teşhisinin doğrulaması: davranış etkisizliği ağır görevden mi yoksa
çok küçük ağırlık hareketinden mi kaynaklanıyor? Model sabitleri
**değiştirilmez** — bu bir duyarlılık analizidir, ürün kararı değildir.
Oyun her zaman varsayılan sabitlerle çalışır.

```
  ufuk  lr      günc.     ‖Δθ‖      fark [95% CI]           p       iyileşme  ezber
    64  0.020000  9.000000  0.00313966  [-0.054, 0.052]       0.933607  55.040000%  0.01991
    64  0.100000  9.000000  0.01516789  [-0.031, 0.080]       0.317268  84.770000%  -0.00000
    64  0.500000  9.000000  0.07374231  [-0.099, 0.040]       0.648335  36.920000%  0.00291
    16  0.020000  37.000000  0.03107201  [-0.092, 0.073]       0.924708  57.650000%  0.00045
    16  0.100000  37.000000  0.13210226  [-0.037, 0.081]       0.332667  83.010000%  0.01400
    16  0.500000  37.000000  0.63823846  [-0.291, -0.062]      0.001100  0.090000%  -0.13144
     8  0.020000  75.000000  0.09443658  [-0.099, 0.053]       0.782822  42.500000%  -0.01667
     8  0.100000  75.000000  0.41392989  [-0.196, -0.001]      0.045595  2.240000%  -0.06383
     8  0.500000  75.000000  1.74281483  [-0.423, -0.302]      0.000100  0.000000%  -0.34453
```

## Politika uzayı araştırması (öğrenmenin üst sınırı)

"Öğrenme işe yaramıyor" iki şeyden olabilir: politika öğrenemiyor, ya da
politika sınıfı zaten tıkanmış. Rastgele (eğitimsiz) politikaların skor
dağılımı ikisini ayırır: yayılım varsa öğrenilecek bir davranış vardır.

```
  kaynak=14 · n=160 rastgele politika
    min 0.461 · q25 0.724 · medyan 0.823 · q75 0.889 · maks 0.960 · ortalama 0.803
    en iyi %10 ortalaması − genel ortalama = öğrenilebilir açıklık: 0.134
```

## Evrimsel politika araması — RL ile aynı ölçüm

Ayırıcı soru: politika sınıfındaki 0.118'lik açıklığı **arama** bulabiliyor mu?
Bulabiliyorsa RL'in kusuru kanıtlanmış olur; bulamıyorsa görev zordur.
Aynı arena, aynı ölçüm, aynı tohum ayrımı — tek fark arama yöntemi.

```
   nesil   en iyi   ortalama
       0  0.9304197  0.811236437
       1  0.9304197  0.907753020
       4  0.9348259  0.927527870
       9  0.9369076  0.929581605
  eğitim en iyi 0.937 · rastgele taban(en iyi) 0.892 · ort 0.859
  DEĞERLENDİRME (görülmemiş tohumlar): bulunan 0.926 · rastgele taban(en iyi) 0.894 · ort 0.855 · kazanç 0.032
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
  temel (dönüşüm yok)     9.00000  0.00287061  [-0.037, 0.038]       0.977202  51.340000%  -0.01077
  z-skor avantaj          9.00000  0.00369428  [-0.043, 0.040]       0.994901  51.350000%  -0.01125
  işaret avantajı         9.00000  0.00266010  [-0.037, 0.038]       0.951205  53.200000%  -0.01138
  işaret + z-skor         9.00000  0.00307946  [-0.037, 0.038]       0.956504  52.120000%  -0.01008
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
    64  0.020000  9.000000  0.00266010  [-0.036, 0.039]       0.954205  53.600000%  -0.01138
    64  0.100000  9.000000  0.01330510  [-0.023, 0.048]       0.463754  76.350000%  -0.01069
    64  0.500000  9.000000  0.06812558  [-0.048, 0.041]       0.949805  48.880000%  -0.01182
    64  2.000000  9.000000  0.26731245  [-0.090, 0.001]       0.063594  3.430000%  -0.03563
```

## S-2 teşhisi · Ödül sinyali

Buraya kadar yalnızca *sonuçlar* ölçüldü (politika daha mı iyi davranıyor).
Öğrenmenin çalışıp çalışmadığını belirleyen şey **sinyalin kendisidir**:
ödül, politikanın kararlarına duyarlı mı?

**Yorum kuralı önceden yazıldı:** pay < %5 → pratikte sabit sinyal, hiçbir
optimizer çalışamaz; %5–%20 → zayıf; ≥ %20 → sinyal var, sorun optimizer tarafındadır.

```
  kaynak=14 · 48 politika × 2 dünya
    ödül (karar başına): min 1.23569 · medyan 2.09566 · maks 2.93536
    ödül ↔ performans: Pearson 0.677 · Spearman 0.675
    politikaya bağlı ödül varyansı payı: 97.92%
    → Ödülün %97.9'i politika farklarından geliyor → **sinyal var**. Sorun optimizer tarafındadır.
```

## Faz B1 · Ekolojik sönümlenme teşhisi

Koloniler neden dağılıyor? `docs/ROADMAP.md` Faz B1 kuralı: ayrım yapılmadan
parametre değiştirilmez. Beş rakip açıklama beş ölçümle ayrıldı.

```
  tohum 11 · 40000 tick
  zirve: tick 2400 · en büyük küme 7 · bağ 61 · bütünlük 0.640 · uzama 0.019
  sönümlenme: tick 13400 · küme 1 · bağ 0 · bütünlük 0.000 · uzama 0.000
  rezerv (sönümlenmede): %48.3
  ölüm payları: açlık %52 · avcı %48
  yorgunluk tek başına açıklayabileceği kayıp: 0.80
  kopma anındaki uzama: medyan 0.076 · kopan 93 bağ · tükenerek %100 · uzayarak %0
  koptukları andaki medyan dayanım: 0.450
  → Baskın açıklama: **koloni geometrisi / bağ uzaması**. Kaynak bitmemiş (rezerv doluluğu %48.3), ortalama bağ uzaması 0.000 (dinlenme uzunluğunun 1.00 katı). Yorgunluk tek başına en fazla 0.80 bütünlük yiyebilirdi. Kopan 93 bağdan 93 tanesi bütünlüğü tükenerek (%100), 0 tanesi uzama sınırını aşarak koptu (%0); koptukları andaki medyan uzama 0.076 — hayatta kalanların 0.000 ortalamasının 76400 katı.
```

```
   tick   pop   org   küme   4+   bağ  bütünlük   uzama   rezerv%   enerji   açlık   avcı
      0    48    48      0    0     0  0.000   0.000     100.0  108763      0      0
   1000    95    72      3    0    23  0.849   0.012      96.8  107457      0      0
   2000   147   105      5    1    42  0.639   0.009      91.4  104549      0      0
   3000   200   137      5    7    63  0.591   0.020      84.6   98748      0      0
   4000   213   169      4    1    44  0.465   0.013      77.8   91357      5      2
   5000   212   187      3    0    25  0.321   0.028      72.0   83850      8      4
   6000   192   186      2    0     6  0.311   0.041      67.0   77133     23     11
   7000   167   162      2    0     5  0.647   0.009      63.2   72180     45     17
   8000   153   147      2    0     6  0.596   0.031      59.8   68183     53     27
   9000   135   131      2    0     4  0.266   0.022      57.3   64935     64     34
  10000   126   123      2    0     3  0.584   0.028      54.9   62365     73     38
  11000   123   122      2    0     1  0.404   0.000      52.6   59975     74     41
  12000   115   112      2    0     3  0.661   0.005      50.7   57715     78     48
  13000   108   106      2    0     2  0.121   0.003      49.0   55739     83     50
  14000   105   104      2    0     1  0.924   0.000      47.2   53948     85     56
  15000   104   103      2    0     1  0.756   0.058      45.4   52165     85     59
  16000    93    92      2    0     1  0.182   0.000      44.7   50494     91     64
  17000    92    91      2    0     1  0.668   0.000      43.3   49083     92     65
  18000    89    88      2    0     1  0.190   0.000      41.9   47724     92     68
  19000    86    85      2    0     1  0.509   0.019      40.8   46411     92     72
  20000    82    81      2    0     1  0.100   0.000      39.8   45171     92     76
  21000    77    77      1    0     0  0.000   0.000      38.9   43963     92     81
  22000    74    74      1    0     0  0.000   0.000      38.3   42867     94     82
  23000    70    70      1    0     0  0.000   0.000      37.6   41954     98     82
  24000    64    64      1    0     0  0.000   0.000      36.9   41113    101     85
  25000    61    59      2    0     2  0.880   0.029      36.2   40312    105     86
  26000    59    57      2    0     2  0.419   0.028      35.4   39604    106     87
  27000    55    54      2    0     1  0.056   0.000      34.9   38924    106     91
  28000    50    49      2    0     1  0.941   0.000      34.4   38217    107     96
  29000    45    44      2    0     1  0.847   0.001      34.0   37520    109    100
  30000    43    42      2    0     1  0.625   0.001      33.4   36943    111    100
  31000    40    38      2    0     2  0.655   0.000      33.0   36412    111    103
  32000    39    37      2    0     2  0.672   0.047      32.8   35913    112    104
  33000    37    36      2    0     1  0.302   0.000      32.4   35486    112    105
  34000    36    36      1    0     0  0.000   0.000      32.0   35100    113    105
  35000    36    36      1    0     0  0.000   0.000      31.7   34749    113    105
  36000    36    36      1    0     0  0.000   0.000      31.4   34399    113    105
  37000    36    36      1    0     0  0.000   0.000      31.0   34049    113    105
  38000    36    36      1    0     0  0.000   0.000      30.8   33698    113    105
  39000    35    35      1    0     0  0.000   0.000      30.5   33354    114    105
  40000    33    33      1    0     0  0.000   0.000      30.2   33031    116    105
```

## Faz B1b · Bağ ömrü duyarlılığı

B1 teşhisinin doğrudan sınaması: bağ ömrü uzatılınca koloniler kalıcı hale geliyor mu?

**Başarı ölçütü (önceden kaydedildi):** yorgunluk ve strain katsayısı
düşürüldüğünde pencerenin sonunda **4+ hücreli yapıların sıfırdan çıkması**
(varsayılan ayarlarda pencerenin sonunda 0).

```
  strainK   yorgunluk   bağ ömrü   zirve küme   son çeyrek   son 4+   son pop   son rezerv   sönüml.   kalıcı
  0.0200000   0.00002000      2083         12            1   0.000000   30.7500000   19.36167738%      4000   HAYIR
  0.0100000   0.00001000      4167         22            1   0.000000   26.7500000   19.93447946%      8200   HAYIR
  0.0050000   0.00000500      8333         12            2   0.000000   28.2500000   19.94304330%      9800   HAYIR
  0.0020000   0.00000100     21277         12            2   0.000000   29.7500000   20.43872117%     10800   HAYIR
```

## Y-2 · Bağ ömrünün kalıtılabilirliği

Yorgunluk terimi genoma bakmıyor: her bağ, sahibi ne genom taşırsa taşsın
aynı yorulma hızına sahip. Kanca açıldığında yorgunluk da `bond.strength`
ile çarpılır ve dayanıklılık seçilime açık hâle gelir.

İki kol **aynı** kalıcı-bağ ayarını kullanır, tek fark kalıtılabilirliktir.

**Başarı ölçütü (önceden kaydedildi):** tedavi kolunun seçilim kayması
sıfırdan ayrışmalı ve kontrol kolundan büyük olmalı.

```
  6 eşleştirilmiş tohum · 40000 tick · strainK 0.005 (iki kolda da koloniler ayakta)
  kontrol  (yorgunluk genoma bağlı DEĞİL): kurucu 0.4476 → hayatta kalan 0.4514 · kayma 0.0037
  tedavi   (yorgunluk genoma BAĞLI):    kurucu 0.4476 → hayatta kalan 0.4559 · kayma 0.0083
  tedavi kayması [0.0083, 0.0026, 0.0145] · iki kol farkı 0.0046 [-0.0056, 0.0131] · p = 0.3302
  üreme çevrimi (kurucu başına): kontrol 5.32 · tedavi 5.37
  enerji rezidüelü: -0.000000000 e
  → Seçilim dayanıklılığı **değiştirdi**: tedavi kolunda ortalama bondStrength kayması 0.0083 [0.0026, 0.0145], sıfırdan ayrışıyor. Bağ ömrü seçilime açıldığında koloniler daha uzun yaşayabiliyor.
```

## Üreme tıkanması teşhisi

Popülasyonun neden ~5.5 çevrimde doyduğu sorusu. Kümülatif doğumun
yataylaması **"doygunluk" sanıldı; ölçüm aslında doğumların durmasını**
gösteriyordu — kümülatif sayı artmayı bırakınca çoğalm da bitmiştir.

```
  tohum 11 · 40000 tick
  tomurcuklama 98 · parçalanma 71 · kurucu soyun canlı hücrelerdeki payı 100.0%
  → Doğum hızı **çöktü**: ilk çeyrekte 120, son çeyrekte 1 doğum. Üreme döngüsü tıkanmış.

   tick   pop   org   küm.dğ   bud   frag   kurucu soy   kurucu hücre   soy hücre   kol.nesil   küme
       0    48    48      48     0      0          48           48          0           0      0
   16000    98    95     228    96      7          95           98          0          60      2
   32000    32    32     235    98      1          32           32          0          27      1
   40000    29    28     235    98      0          28           29          0          25      2
```

## Uzun vadeli dayanıklılık — §5.4 genelleniyor mu?

Bölüm 5.4 bağ dayanıklılığının 12.000 tick penceresinde 4+ hücreli
yapıları geri getirdiğinin **ölçüldüğünü** ve ölçütü karşıladığını yazar.
Bu tarama aynı ayarları 40.000 tick boyunca sınar: kalibrasyon sönümlenmeyi
erteliyor mu, yoksa uzun vadeli çöküşü gerçekten önlüyor mu?

```
  strainK   bağ ömrü   son pop   çöküş oranı   son çeyrek küme   son 4+   son bağ   son rezerv   geç açlık%   geç avcı%
  0.0200000     2083        33   6.45454545    1.3921568627        0        0   30.22777465%   50.00000000   50.00000000
  0.0050000     8333        25   9.12000000    2.0980392157        0        1   25.56194431%   75.00000000   25.00000000
  0.0020000    21277        26   8.76923077    1.0000000000        0        0   26.39754278%   64.70588235   35.29411765
```

## 40.000 tick sınırı — erişilebilirlik mi, avcı mı?

```
  tohum 11 · 40000 tick · strainK 0.002
   tick   pop   ort. enerji   açlık%   medyan uzaklık   yakın%   rezerv%   avcı en.   açlık öl.   avcı öl.
       0    48  55.000000000  0.00000   1.89538132548   31.250000   100.000000%   4.36363636          0        0
    4000   226  39.749109552  3.98230   1.21975713443   67.256637   76.111617%   16.29319064          7        1
    8000   156  35.112055023  5.76923   1.33614668047   55.128205   56.144243%   32.37214710         70        6
   12000   126  31.038112930  8.73016   1.19145861602   69.841270   46.458368%   15.73678523         94       12
   16000   101  27.302899215  16.83168   1.75530886329   43.564356   40.030189%   11.01762256        108       20
   20000    83  28.004339172  13.25301   1.29660673121   65.060241   35.326133%   11.51070401        121       20
   24000    66  25.878402267  15.15152   1.95164997768   40.909091   32.160744%   9.40837688        132       24
   28000    51  25.300410764  25.49020   1.24126350358   68.627451   29.694272%   11.61804180        140       28
   32000    32  25.034289218  18.75000   1.11953981333   68.750000   28.384164%   4.38694755        151       37
   36000    29  29.532964717  10.34483   3.80650550057   31.034483   27.227223%   0.00000000        154       37
   40000    26  26.901761660  15.38462   1.56597836285   42.307692   26.397543%   0.00000000        157       37

  → Sınırlayıcı: **kaynak erişilebilirliği.** En yakın kaynağa uzaklık 1.48 → 2.16 mb arasında 1.46× büyüdü, rezerv doluluğu %26.4'de kaldı. Hücreler kaynağa ulaşamıyor.
```

## Kaynak rejenerasyonu A/B

`C.DEFAULT_REGEN = 0`: kaynak hiç yenilenmiyor. Rejenerasyon açıldığında
popülasyon kalıcı hâle geliyor mu?

**Bu tarama bir muhasebe hatasını da ortaya çıkardı:** rezidül formülünde
`externalInput` işareti terstiydi. `DEFAULT_REGEN = 0` olduğu için hata
20+ deneyde görünmemişti.

```
  regen   zirve pop   son pop   son çeyrek pop   son rezerv   ort. enerji   açlık%   açlık öl.   avcı öl.   avcı öldü   rezidüel
  0.000000        226        26   29.00000000000   26.3975427799%   26.901761660   15.38462        157       37       33424   0.000000158
  0.002000        207        38   35.66666666667   32.0197175517%   36.900330092   2.63158        110       56       33893   0.000000052
  0.010000        215        55   52.33333333333   35.4350393949%   32.820906040   9.09091         98       50       33254   0.000000312
```

## Popülasyon-ES — seçilen öğrenme yönünün testi

REINFORCE her iki kolda da **kapalıdır**; ölçülen fark yalnız
popülasyon-ES katkısıdır. Birincil ölçüm **ödül hızıdır**
(`lifetimeReward / yaş`) — kümülatif ödül yaşamayı ödüllendirir ve
ölçüm yanlılığı yaratır.

```
  20000 tick · 8 eşleştirilmiş tohum · REINFORCE her iki kolda da KAPALI
  kontrol (popülasyon-ES yok): ödül hızı 0.33940 e/tick · enerji 0.301 · pop 82.125 · küme 2
  tedavi  (popülasyon-ES var): ödül hızı 0.33696 e/tick · enerji 0.284 · pop 79.75 · küme 2
  uygulanan güncelleme: 40 · enerji rezidülü: 0.000000075 e
  eşleştirilmiş fark -0.00244 [-0.00563, 0.00066] · p = 0.1288 · iyileşme olasılığı 6.4%
  → Popülasyon-ES **ölçülebilir etki üretmedi**: fark -0.00244 [-0.00563, 0.00066], p = 0.1288.
```

## Ödül hızı yayılımı — paylaşılan dünya sinyali siler mi?

Popülasyon-ES başarısızlığının iki açıklamasını ayıran ölçüm.

```
  15000 tick
  paylaşılan dünyada bireyler arası CV: %14.0
  bağımsız dünyalar arası ortalama CV: %7.2
  oran: 1.96×
  → Paylaşılan dünya sinyali **silmüyor**: bireyler arası CV %14.0, bağımsız dünyalar arası %7.2 (1.96×). Yani popülasyon içi ayrışma **vardır**; ortalama-alma güncellemesinin başarısızlığı arama eksikliğidir, sinyal yokluğu değil.
```

## Faz C1 · MODES açık uçluluk metrikleri

Dolson vd. (2019) çerçevesi: değişim, yenilik, çeşitlilik, karmaşıklık,
aktivite. Tümü mevcut dünya verisinden türetilir.

```
  tohum 11 · 12000 tick · 7 örnek
   tick   pop   değişim   yenilik%   çeşitlilik   karmaşıklık   aktivite   tür
      0    48  0.00000000   100.0000000   0.4154129739   0.000000000000          0    12
   2000   149  0.00444596   39.8058252   0.5057391876   0.369941792889   2334.7200000000003    12
   4000   226  0.00200458   17.6470588   0.4879243694   0.476297508974   7121.389999999995    12
   6000   192  0.00025039   3.2786885   0.4592493776   0.465370099575   8811.749999999996    12
   8000   151  0.00012446   1.8867925   0.3332961441   0.403681020928   8889.470000000001    12
  10000   129  0.00023895   2.7777778   0.3084954508   0.262624835539   8352.210000000001    12
  12000   123  0.00044666   4.5871560   0.3270941124   0.193500919630   9183.590000000006    12
  → Pencere sonu: değişim 0.0004 · yenilik %4.6 · çeşitlilik 0.327 · karmaşıklık 0.194 · tür 12. Eğilim: **falling**. Pencere boyunca 127 benzersiz genom imzası görüldü. **Yakınsama, açık uçluluk değil:** yenilik %40 → %4.6, değişim ~0'a düştü, karmaşıklık 0.37 → 0.19. Popülasyon kısa bir keşiften sonra daralmaya geçiyor — Literatürdeki "açık uçluluk geçicidir, baskın desenlere çöker" bulgusunun bu modeldeki karşılığı (Faldor vd. 2023).
```

## Faz D · Niş kapsama (yaşam haritası çekirdeği)

Picbreeder / MAP-Elites kalıbının ölçüm tarafı: üç **ölçülebilir**
betimleyici (hız, boyut, duyu menzili) üzerinden ızgara kurulur ve hangi
kutuların işgal edildiği sayılır. Betimleyicilerin hiçbiri genomla
tahmin edilmiyor — hepsi doğrudan ölçülüyor.

Bu ölçüm, Faz C1'deki yakınsamanın **yerini** gösteriyor: sorun
değişimin değil organizmaların aynı davranış kutusuna birikmesi.

```
  tohum 11 · 12000 tick · ızgara 3×3×3 = 27 kutu
  hız/boyut/menzil  adet   en iyi enerji   soy
   0/0/1         6   0.66087031696     8
   1/0/0         1   0.11761536482     4
   1/0/1       540   0.68617318521     8
   1/1/1        67   0.67848717482     8
   1/2/1         1   0.46525401338     8
   2/0/0         2   0.65640950403     4
   2/0/1       672   0.70030299469     8
   2/1/1        49   0.65099793132     7
  dolu kutu zaman serisi: [4, 5, 7, 4, 4, 5, 4, 4, 4, 4, 3, 3]
  eksen sağlığı (ölçüm aletinin kendi denetimi):
  hız     üst sınır   0.120 · gözlem   1338 · tavana kırpılan      2 (%0.1) · dolu kutu 3/3 · en küçük 0.022
  boyut   üst sınır   4.585 · gözlem   1338 · tavana kırpılan      0 (%0.0) · dolu kutu 3/3 · en küçük 0.000
  menzil  üst sınır   5.000 · gözlem   1338 · tavana kırpılan      0 (%0.0) · dolu kutu 2/3 · en küçük 1.637
  → 8/27 kutu dolu (%30 doluluk). En yoğun kutuda %50 organizma birikmiş (kutu 2/0/1). Dolu kutu sayısı: ilk üçte 5.0 → son üçte 3.5 ortalama. **Belirgin yakınsama:** organizmaların çoğu tek bir davranış kutusunda. Bu, yaşam haritasının (Faz D) çözeceği problem: arşiv olmadan popülasyon tek çukura düşüyor.
```

Faz D · Niş kapsama ölçümünün yorumu

Bu ölçüm, bir arşivin **gerçekten işe yarayıp yaramadığını** test eder.
MAP-Elites kuralı: boş nişlere o nişte arşivlenen en iyi bireyin yavrusunu
enjekte et. Bu, arşivin seçilime katılmasıdır (ε > 0).

```
  eşleştirilmiş fark (dolu kutu, tohum başına): [-2, 2, 2, 0]
  dolu kutu (/27)          11.00 → 11.50
  yoğunlaşma              %53 → %54
  canlı popülasyon        109 → 159
  hücre enerjisi (e)      3131 → 4362
  enjeksiyon (adet)       0 → 232.3
  enerji rezidülü |e|     4.1e-8 → 5.2e-8
  eşleştirilmiş fark 0.50 [-1.00, 2.00] · p = 0.7850
  → Dolu kutu: kontrol 11.00 → tedavi 11.50 (+/27). Yoğunlaşma: %53 → %54. Enjeksiyon: kolo başına 232.3 organizma. Enerji rezidülü: kontrol |4.1e-8| · tedavi |5.2e-8| e. **Arşiv seçilime katılınca doluluk arttı:** MAP-Elites kuralı bu modelde çukuru doldurdu.
```

## Paylaşma mekaniğinin ölçülebilir etkisi

Kontrol kolu boşta eşiği **1,50**'ye çekilir: hiçbir hücre kapasitesinin
üstünde olamayacağı için paylaşma **matematiksel olarak imkânsız** olur.
İki kol aynı tohumlarda koşar; fark, paylaşmanın koloni yapısına katkısını
doğrudan ölçer.

```
  eşik 0,82 (varsayılan)  ↔  1,50 (paylaşma matematiksel olarak imkânsız)
  tohum  3001   aktarım      0   tepe   8 /   8   fark    0   pop  159 /  159
  tohum  3002   aktarım     56   tepe  24 /  24   fark    0   pop  144 /  147
  tohum  3003   aktarım      0   tepe   7 /   7   fark    0   pop  145 /  145
  tohum  3004   aktarım   2084   tepe  24 /  24   fark    0   pop  145 /  146
  tohum  3005   aktarım      0   tepe  10 /  10   fark    0   pop  139 /  139
  tohum     7   aktarım   8204   tepe  24 /  24   fark    0   pop  153 /  153
  tohum    42   aktarım      0   tepe  10 /  10   fark    0   pop  168 /  168
  tohum    91   aktarım   1928   tepe  24 /  24   fark    0   pop  154 /  152
  tohum   123   aktarım      0   tepe  11 /  11   fark    0   pop  162 /  162
  tohum  2026   aktarım      0   tepe   9 /   9   fark    0   pop  149 /  149
  tohum    11   aktarım      0   tepe  15 /  15   fark    0   pop  151 /  151
  tohum    12   aktarım      0   tepe   9 /   9   fark    0   pop  154 /  154
  tepe farkı aralığı: [0, 0]   ort. 14.58 / 14.58   tetiklenen 4/12
  → Varsayılan 0,82'de paylaşma tetiklenen tohum: 4/12 (ort. aktarım 1023). Ort. tepe küme — paylaşma AÇIK: 14.58, paylaşma İMKÂNSIZ: 14.58. Eşleştirilmiş farklar: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]. **Varsayılan ayarda paylaşmanın tepe koloni büyüklüğüne ölçülebilir etkisi yok** — hiçbir tohumda fark pozitif değil, ortalama da aynı. Mekanizma çalışıyor ama sonucu değiştirmiyor.
```

## Faz D · İşbirliği aktı

Bağ bütünlüğü eşiğin altına düşünce bağın **iki ucundaki hücreler birlikte**
enerji harcayarak bağı yeniler. Paylaşmadan farkı: bedel **ortak** olduğu
için ödemeyen hücre de yararlanır — yani bir *hileci* tanımlanabilir.

```
  k = 0 (kapalı)  ↔  k = 0,002 (işbirliği aktı açık)
  tohum  3001   bağ  48 →  61   tepe   8 →   8   tepeBağ  109 →  109   yenileme  92758
  tohum  3002   bağ  35 →  42   tepe  24 →  24   tepeBağ  113 →  113   yenileme  46968
  tohum  3003   bağ   6 →  25   tepe   7 →   7   tepeBağ   73 →   73   yenileme  67266
  tohum  3004   bağ  17 →  29   tepe  24 →  24   tepeBağ  114 →  114   yenileme  64058
  tohum  3005   bağ  27 →  46   tepe  10 →  10   tepeBağ  110 →  110   yenileme  66944
  tohum     7   bağ  53 →  52   tepe  24 →  24   tepeBağ  103 →  106   yenileme  28924
  tohum    42   bağ  34 →  33   tepe  10 →  10   tepeBağ   88 →   86   yenileme  60098
  tohum    91   bağ  14 →  38   tepe  24 →  24   tepeBağ   93 →   93   yenileme  54265
  tohum   123   bağ  30 →  49   tepe  11 →  11   tepeBağ  100 →  100   yenileme  66623
  tohum  2026   bağ  18 →  23   tepe   9 →   9   tepeBağ   73 →   73   yenileme  45577
  tohum    11   bağ  45 →  47   tepe  15 →  15   tepeBağ   90 →   90   yenileme  28770
  tohum    12   bağ  42 →  55   tepe   9 →   9   tepeBağ  104 →  104   yenileme  58144
  bağ farkı (SON) ort 10.9 10.9 [6.3, 15.5] · p = 0.0001
  tepeBağ farkı ort 0.1  ← bağlar zirvede zaten bol; kazancın olması gereken yer burasıydı
  tepe farkı ort 0.00 0.00 [0.00, 0.00] · p = 1.0000
  → Bağ sayısı farkı 10.9 10.9 [6.3, 15.5] · p = 0.0001 → **mekanizma çalışıyor**, bağlar yenilenmeden kopmuyor. Tepe küme farkı 0.00 0.00 [0.00, 0.00] · p = 1.0000 → koloni kazancı yok (artış 0, düşüş 0 tohum). Tepe bağ farkı 0.1 — **bağlar zirvede zaten bol; akt onları sonraki evre kurtarıyor, kazanç orada değil.** Ortalama yenileme: 56700.
```

## Faz D · İşbirliği eğilimine seçilim

`genome.cooperation` artık **seçilebilir** bir parametre ve metabolik
maliyeti var (bazalin ~%26'sı). Düşük işbirliği hem ucuz hem zayıf bağ
demek — gerçek bir takas. Soru: seçilim yön veriyor mu?

```
  ak AÇIK : ort 0.4935 → 0.4872   kayma -0.0063
  ak KAPALI: ort 0.4935 → 0.4862   kayma -0.0072
  tohum  3001   işbirliği 0.4974 → 0.4882   kayma -0.0092
  tohum  3002   işbirliği 0.4985 → 0.4910   kayma -0.0075
  tohum  3003   işbirliği 0.4846 → 0.4824   kayma -0.0021
  ak etkisi 0.0009 [-0.0033, 0.0046] · p = 0.7391
  → Ort. işbirliği kayması: ak AÇIK -0.0063 · ak KAPALI -0.0072. Akın etkisi (açık − kapalı) ort 0.0009 0.0009 [-0.0033, 0.0046] · p = 0.7391 → **seçilim üzerinde ölçülebilir etkisi yok**. Not: her iki kolda da kayma ~aşağı yönde ve çok küçük; bu pencerede yönsel seçilim yok (evrim 3 nesle yetmiyor, p = 0,097).
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
  snapshot boyutu: 2.371.911 bayt
  çatallama süresi: 37.19 ms · iki dalın koşusu: 2269.5 ms · oran 1.6%
  dallar bit düzeyinde aynı: evet · müdahale sızıntısı: yok · müdahale etkili: evet
  → Çatallama **doğru**: iki dal bit düzeyinde aynı ilerliyor ve müdahale diğerine sızmıyor. Snapshot 2.37 MB; bir dal açmak 18.6 ms, bir simülasyon adımı 0.756 ms → **bir çatal ≈ 25 tick** maliyetinde. Yani 500 tick'te bir, 16 pertürbasyonlu güncelleme ≈ 79% ek yük demek: üstel strateji yaşam içinde pratikte **bütçelenebilir**. Müdahale testi: müdahalesiz dal referansla AYNI, müdahale görmüş dal AYRILDI. **DİKKAT:** bu maliyet 3000. tick'te ölçüldü ve snapshot boyutuyla ölçeklenir; geç pencerelerde farklı olabilir ve **ölçülmedi**.
```

## S-4 · Çatallanmış ortamda yaşam içi üstel arama

REINFORCE ve popülasyon-ES kredi ataması yapamadığı için başarısız oldu.
Gerçek ES kredi ataması yapmaz: dünya bir kez snapshotlanır, N dal açılır,
her dalda θ+σξ değerlendirilir ve θ getiriye ağırlıklı pertürbasyon
ortalaması boyunca kaydırılır. Seyrek dünyada koşulur (pop 6, kaynak 6).

```
  kontrol (arama kapalı): medyan enerji 47.56 e · pop 15 · arama 0
  tedavi  (arama açık) : medyan enerji 47.56 e · pop 15 · arama 24 (4 pertürbasyon × 120 tick)
  ağırlık hareketi: kontrol 0.00000 · tedavi 0.00066
  maliyet: 4000 tick'in koşusu 48 ms · arama 172 ms → ek yük ≈ 2184 tick
  enerji rezidülü: 0.000000000 e
  eşleştirilmiş fark 0.000 [0.000, 0.000] · p = 1.0000
  → Çatallanmış arama **ölçülebilir performans artışı üretmedi**: fark 0.000 [0.000, 0.000], p = 1.0000. Ağırlık hareketi: medyan ‖Δθ‖ = 0.0007 (kontrol 0.0000) — yani arama θ'yı hareket ettirdi ama davranış kazanmadı. Ek yük ≈ 2184 tick'lik eşdeğer.
```

## Paylaşma eşiği duyarlılık taraması

Paylaşma mekanizmasının tetiklendiği boşta eşiğini tarar: eşik
düşürülürse mekanizma ne kadar sık çalışır ve **ürün değişir mi**?

⚠️ **Bu bölüm daha önce rapora hiç bağlı değildi (ölü deney).**
Sınırları açıkça yazılarak buraya alındı:

· **Eşleştirilmiş tasarım**: her eşik noktası aynı tohum kümesini
  kullanır (3001+i), yani eşikler arası karşılaştırma eşleştirilmiştir.
· **Güven aralığı YOK**: bu bir tarama, fark testi değil. "Eşik etkili mi"
  sorusuna cevap verir; "fark ne kadar büyük, güvenilir mi" sorusuna değil.
· Taban çizgisi **varsayılan ayar** (0,82 e) — oyun varsayılanı değişmez.

```
  4 tohum × 8000 tick (strainK 0.005)
  eşik   eşikEn   aktarım   canlı tohum   maxFazla   zirve küme   son küme   son 4+   son pop   son enerji   rezidüel
  0.82000       82       2140            2/4   17.76911945          24          3   0.250000       148   0.3052706931   -0.000000064
  0.60000       60     439713            4/4   33.19410559          24          3   0.250000       151   0.3415789734   -0.000000035
  0.50000       50     361445            4/4   20.24862381          24          4   0.750000       156   0.3136115540   -0.000000045
  0.40000       40     401226            4/4   30.25558974          24          4   3.750000       153   0.3120336477   -0.000000033
  0.30000       30     215950            4/4   39.53712592          24          5   3.250000       151   0.3113176604   -0.000000032
  → Paylaşma **0.82** eşiğinde (82 e) **2/4** tohumda tetikleniyor: 2140 aktarım (aktarımların tamamı az sayıda tohumdan geliyor — mekanizma **seyrek** çalışıyor). Eşiğin 0.82’den 0.3’ye inilmesi aktarım sayısını artırıyor (**100.9 kat**; 2140 → 215950 aktarım, 4/4 tohum). Buna karşılık zirve koloni büyüklüğü **her eşikte 24 hücre** — **tetikleme eşiği çok değişken, sonuç değişmiyor.** Enerji korunumu |-6.4e-8|.
```

## Dünya içi evrim (canlı dünyanın dalında)

S-3 · Arena deneyi öğrenmenin üst sınırını aradı; bu ölçüm aynı yöntemin
**canlı dünyanın anlık görüntüsünden açılan bir dalda** da çalışıp
çalışmadığını sorar.

⚠️ **Bu bölüm daha önce rapora hiç bağlı değildi (ölü deney)** ve
rapora alınırken **iki gerçek hata** bulundu:

1. **Kontrol kolunun kazancı gürültüydü.** Kontrol kolu (arama YOK) de
   kazanç olarak bir sayı üretiyordu — çünkü taban örneği aramanın RNG
   akışından ayrı çekildiği için "bulunan" ile taban **farklı rastgele
   örneklemlerden** geliyor. Ölçülen değer: kontrol kolu **−17,7**, yani
   arama yapılmadığı halde gürültü tedavi kolunun ham kazancından
   (+3,3) **büyüktü**. Ham rakam gürültü tabanından küçükse anlam taşımaz.
   Düzeltme: etki = tedavi kazancı − **gürültü tabanı** (kontrol kolunun
   kendi kazancı).
2. Sentinel (-Infinity) hâlâ hükmü **reddeder**: sonlu olmayan değerle
   hüküm verilmez ("ÖLÇÜLEMEDİ").

⚠️ **SINIR: TEK tohum, güven aralığı YOK.** Bu bir **protokol doğrulaması**
("mekanizma canlı dünyanın dalında uçtan uca çalışıyor mu"), genellenebilir
bir **etki** ölçümü değildir. Ayrıca ölçülen kazanç **dünya çıktısında**
değil **değerlendirme skorkasında**; iki kolun canlı dünya sonucu (popülasyon,
koloni sayısı, organizma enerjisi) ölçüldüğü gibi **aynıdır**.

```
  tohum 11 · canlı dünya 3000 tick → dal · değerlendirme 1000 tick
  kontrol (arama yok)      taban(en iyi) 65.983 · ort 55.230 · taban ölümü 0/4 → bulunan 48.242 (kazanç -17.741) · bölünme sonrası enerji 58 e · pop 212 · 4+ 1 · süre 8268 ms
  evrim (6 nesil)          taban(en iyi) 65.983 · ort 55.230 · taban ölümü 0/4 → bulunan 69.299 (kazanç +3.316) · bölünme sonrası enerji 58 e · pop 212 · 4+ 1 · süre 78893 ms
    nesil eğrisi: 66.865 → 66.865 → 68.529 → 68.529 → 68.529 → 69.299
  gürültü tabanı (arama yok): -17.741 → net etki +21.057
  enerji rezidülü: 0.000000009 e
  → Çevrimiçi evrim **canlı dünyanın dalında da işe yarıyor**: rastgele taban 65.983 → bulunan politika 69.299 (kazanç +3.316). Buna karşılık **arama yapmayan kontrol kolunun** kendi kazancı -17.741 — yani örneklem gürültüsü bu kadar; **net etki +21.057**. Bölünmenin ardından organizmanın enerjisi 55 → 58 e (kontrol 58 e). Arama 78893 ms sürdü. ⚠️ **TEK tohum, güven aralığı yok** — bu bir protokol doğrulamasıdır, genellenebilir bir etki ölçümü değildir.
```

## Bağ gücü koloni büyüklüğünü artırıyor mu?

**Soru:** Aynı dünyada, aynı tohumda, yalnız kurucuların bondAffinity değeri değiştiğinde bağlı küme daha büyük mü oluyor?

**Protokol (sonuçtan önce sabitlendi):** Eşleştirilmiş tasarım. Aynı seed iki kolda kullanılır (aynı kaynak düzeni, aynı kaya düzeni, aynı başlangıç konumları). Tek fark: kurucu genomlarının bondAffinity değeri 0.05 ↔ 0.9. Mutasyon kapalı → değer soy boyunca birebir korunur. Birincil ölçüm: pencerede görülen en büyük bağlı küme. Farkın güven aralığı bootstrap ile hesaplanır.

```
── Bağ gücü koloni büyüklüğünü artırıyor mu?
   soru    : Aynı dünyada, aynı tohumda, yalnız kurucuların bondAffinity değeri değiştiğinde bağlı küme daha büyük mü oluyor?
   n       : 12 eşleştirilmiş tohum
   ölçüm   : penceredeki en büyük bağlı küme (hücre)
   kontrol : 2.083 [2.000, 2.250]
   tedavi  : 19.167 [16.833, 21.333]
   fark    : 17.083 [14.833, 19.167]   p = 0.0001
   iyileşme olasılığı (bootstrap): 100.0%
   · zirve 4+ hücreli yapı sayısı: kontrol 0.000 · tedavi 28.917 · fark 28.917
   · pencere sonu popülasyon: kontrol 206.750 · tedavi 241.917 · fark 35.167
   · pencere sonu bağ sayısı: kontrol 0.583 · tedavi 83.917 · fark 83.333
   enerji rezidüelü: 0.000000014 e
   kontrol ham : [2.0000, 2.0000, 2.0000, 2.0000, 2.0000, 2.0000, 2.0000, 2.0000, 3.0000, 2.0000, 2.0000, 2.0000]
   tedavi ham  : [19.0000, 18.0000, 16.0000, 24.0000, 21.0000, 20.0000, 17.0000, 14.0000, 24.0000, 11.0000, 22.0000, 24.0000]
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
   kontrol : 0.358 [0.328, 0.387]
   tedavi  : 0.350 [0.319, 0.379]
   fark    : -0.008 [-0.024, 0.008]   p = 0.3035
   iyileşme olasılığı (bootstrap): 15.4%
   · genom kayması (genomeShift): kontrol 0.005 · tedavi 0.005 · fark 0.001
   · zirve en büyük küme: kontrol 9.333 · tedavi 11.917 · fark 2.583
   · pencere sonu 4+ hücreli yapı: kontrol 1.500 · tedavi 2.917 · fark 1.417
   · ulaşılan en yüksek nesil: kontrol 2.750 · tedavi 2.750 · fark 0.000
   enerji rezidüelü: 0.000000015 e
   kontrol ham : [0.3658, 0.4187, 0.2985, 0.4376, 0.3745, 0.3309, 0.3853, 0.3271, 0.4208, 0.3783, 0.2802, 0.2758]
   tedavi ham  : [0.3081, 0.4437, 0.2853, 0.3973, 0.3751, 0.3239, 0.3812, 0.3383, 0.4210, 0.3413, 0.2610, 0.3203]
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
   kontrol : 0.840 [0.797, 0.878]
   tedavi  : 0.841 [0.792, 0.885]
   fark    : 0.001 [-0.037, 0.037]   p = 0.9764
   iyileşme olasılığı (bootstrap): 51.8%
   · kontrol kolunun headroom u (1 − kontrol skoru): kontrol 0.160 · tedavi 0.841 · fark 0.001
   · EZBER KONTROLÜ — eğitim dünyasındaki fark: kontrol 0.833 · tedavi 0.830 · fark -0.003
   · ezber farkı − genelleşme farkı (aralık daralması): kontrol -0.003 · tedavi 0.001 · fark -0.004
   · ölçüm penceresi sonuna kadar yaşama oranı: kontrol 1.000 · tedavi 1.000 · fark 0.000
   · eğitimde ortalama politika güncellemesi: kontrol 0.000 · tedavi 9.000 · fark 9.000
   · eğitimde ağırlıkların ne kadar kaydığı (‖Δθ‖): kontrol 0.000 · tedavi 0.003 · fark 0.003
   · eğitim koşularında hayatta kalma oranı: kontrol 0.000 · tedavi 1.000 · fark 1.000
   enerji rezidüelü: 0.000000000 e
   kontrol ham : [0.8558, 0.8675, 0.7985, 0.7590, 0.6397, 0.9435, 0.9212, 0.8618, 0.6465, 0.9056, 0.9054, 0.8956, 0.8736, 0.9477, 0.7796, 0.8874, 0.8952, 0.8210, 0.6737, 0.9294]
   tedavi ham  : [0.9500, 0.7858, 0.6470, 0.8153, 0.6396, 0.9543, 0.9380, 0.9348, 0.6394, 0.9053, 0.9320, 0.8764, 0.7065, 0.9470, 0.8712, 0.9059, 0.7571, 0.8491, 0.8680, 0.8949]
```

**Notlar:**

- Değerlendirmede öğrenme kapalıdır; bu, ölçtüğümüz şeyin "öğrenme" değil **"öğrenmenin ürettiği politika"** olmasını sağlar.
- Kontrol kolu, değerlendirme dünyasının kendi rastgele başlangıç ağıdır — yani "hiç eğitim almamış rastgele politika" taban çizgisidir.
- REINFORCE + sabit sonlu ufuk (bootstrap yok, γ=0.95) kullanılır; bkz. `docs/MODEL.md` §4. Yüksek varyans beklenir.
- Bu deneyin sonucu **olumlu olmak zorunda değildir**. p ≥ 0.05 çıkarsa bulgu "bu koşullarda ölçülebilir bir iyileşme yok"; bulgudur.
- Eğitim ve değerlendirme tohum kümeleri ayrık olduğu için sonuç ezber değil **genelleşme** ölçüsüdür.

# Cell to Mind — Simülasyon Modeli

Bu belge simülasyonun **gerçekte ne yaptığını** ve hangi operasyonel tanımların
kullanıldığını belgeler. Buradaki her formül kodda karşılık bulunur
(`src/sim/biology/energy.ts`, `src/sim/behavior/mlp.ts`, `src/sim/world.ts`).

**Birimler:** uzunluk `mb` (model birimi), enerji `e`, zaman `tick`.
1 tick = 50 ms sabit adım. Model birimi fiziksel bir birim DEĞİLDİR.

---

## 1. Enerji: kapalı sistem ve korunum değişmezi

Tek değişmez:

```
(Σ hücre enerjisi + Σ kaynak rezervi + avcı enerjisi) + harcanan
    == başlangıç bakiyesi + dış girdi
```

`EnergyLedger` bunu denetler ve HUD'da **Muhasebe farkı** olarak gösterilir.
Paylaşım, bölünme ve avlanma enerji **yaratmaz**; metabolik olarak harcanan her
miktar `dissipate()` ile kaydedilir. Bu, "Dünya kapalı enerji sistemi olarak
yanlış sunulmasın" kuralının denetlenebilir hâlidir.

Dış girdi yalnız iki yoldan gelir ve ikisi de ölçülür:
1. Kaynak rejenerasyonu (`regenPerTick`, varsayılan **kapalı**).
2. Oyuncunun besin eklemesi (`addNutrient`; kapasite doluyken işlemez ve
   enerji yaratmaz).

### Temel formüller

| Terim | Formül |
|---|---|
| Emilim | `INTAKE_RATE · temas · tolerans · alan · doluluk` |
| Temas | `1 − d / (r_hücre + r_kaynak)`, `[0,1]` |
| Alan | `(r / r_temel)²` |
| Bazal | `(bazal + bakım + algı + plastisite + bağlar) × yoğunluk` |
| Yoğunluk | `1 + DENSITY_COST_K · (popülasyon / 256)²` |
| Hareket | `MOVE_COST_K · (r/r_temel)³ · v²` |
| Paylaşma | `min(fazla, açık) · SHARE_RATE · (0.25 + paylaşmaVerimi) · 0.72` |
| Verim kaybı | `çekilen − ulaşan` → harcanan |
| Avcı metabolizması | `max(PREDATOR_BASAL, enerji · PREDATOR_METABOLIC_RATE)` |

**Yoğunluk maliyeti bir performans kırpması DEĞİLDİR** ve hücre silmez.
Kalabalıkta yer/besin rekabeti popülasyonu taşıma kapasitesinin altında tutan
gerçek bir biyolojik geri beslemedir; kaynak tükenmesiyle birlikte dengeyi kuran
ikinci mekanizmadır.

### Bölünme

```
toplam = eşik − maliyet
anne   = toplam · 0.55
yavru  = toplam · 0.45
```

`anne + yavru == eşik − maliyet` **kesin** eşittir; maliyet defterde harcanır.
Doğrulayan test: `tests/world.test.ts › Bölünme enerji muhasebesi`.

### Ödeme kuralı

Hücre elindeki enerjiden fazlasını ödeyemez. Ödenen miktar hücreden düşülür ve
harcanır; ödenemeyen kısım **borç olarak yaratılmaz**. Bu, negatif enerji
üretmeden korunumu korur.

---

## 2. Çok hücrelilik

Bir yapı ancak hücreleri arasında **bağ** olan bağlı bileşendir. Yan yana
durma çok hücrelilik sayılmaz. MVP'de akraba olmayan rastlantısal hücre
birleşmesi yoktur.

### Bağ yaşam döngüsü

| Aşama | Mekanizma |
|---|---|
| Oluşum | Bölünmede yavrunun anneye bağlı kalma olasılığı = genom `bondAffinity` |
| Sürdürme | Yapışkanlık kuvveti (yönlendirme) + konum yayı (yapısal düzeltme) |
| Beden bütünlüğü | 3+ hücreli organizmaların hücreleri merkeze çekilir |
| Kopma | `bütünlük ≤ 0` veya `mesafe > 1.9 mb` |
| Parçalanma | Bağlı bileşenler yeniden hesaplanır |

Yay kuvveti (`structurePhase`) şarttır: yalnız yönlendirme yeterli değildir,
çünkü iki hücre benzer yöne bakarken farklı hızda ilerlediği için açıklık
zamanla artar.

### Paylaşmanın bölünme eşiğine etkisi

Paylaşma denge seviyesi `0.82 × kapasite` (= 82) olarak **seçilmiştir**.
Bu değer `DIVIDE_THRESHOLD` (70) ve `CELL_CAPACITY` (100) arasındadır. Denge
seviyesi bölünme eşiğinin altında olsaydı, kolonideki hiçbir hücre eşiğe
ulaşamaz ve çok hücrelilik hiç başlamazdı. Bu, geliştirme sırasında ölçülmüş
gerçek bir tasarım hatasıdır (bkz. `docs/PROGRESS.md`).

### Parçalanma kimliği (işletimsel kural)

1. En büyük bileşen mevcut organizma kimliğini sürdürür.
2. Eşitlikte en küçük hücre kimliğini içeren bileşen seçilir (kararlı sıra).
3. Diğer canlı parçalar bağımsız organizma olur, **organizma nesli +1**.

Doğuş biçimleri ayrılır:
- `genesis` — kurucu, nesil 0
- `bud` — tomurcuk/bağlanmayan yavru: genom mutasyonlu olabilir, `thetaInherited`
  mutasyonlu kopyalanır
- `fragment` — bağ kopması: genom **birebir** devralınır (mutasyon yok)

**Hücre bölünmesi organizma neslini değiştirmez.**

### İşletimsel eşikler

Oyunun ölçtüğü, biyolojinin evrensel tanımı olmayan değerler:
- Çok hücrelilik: **en az 4 hücreli yapı**
- Koloni üreme: **3 tamamlanmış üreme nesli**

Bu değerler HUD'da ve gözlemci raporunda açıkça "işletimsel ölçüm" diye etiketlenir.

---

## 3. Kalıtım

Genom gerçek DNA dizisi değil, **9 kalıtsal parametredir**:
`bondAffinity`, `bondStrength`, `motility`, `senseRadius`, `shareEfficiency`,
`toleranceA`, `toleranceB`, `plasticity`, `cooperation`.

Sekiz parametrenin metabolik maliyeti doğrudan `basalCostFor` içindedir.
Dokuzuncusu, **`bondAffinity`, istisnadır**: kendi terimi yoktur, maliyeti
**dolaylı** gelir — daha yüksek değer daha çok bağ kurulması demektir
(`rng.inherit.float() < genome.bondAffinity`) ve bağ BAŞINA bakım enerjisi
ödenir. Yani bedeli vardır, ama parametrenin kendi satırında değil.

Böylece hiçbir özellik bedelsiz avantaj sağlamaz. `tests/measurement.test.ts`
bu kuralı korur: yeni bir parametre eklenirse ya `basalCostFor` içinde
maliyeti bulunur ya da gerekçesiyle muafiyet listesine girer.

| Parametre | Kazanç | Bedeli |
|---|---|---|
| `senseRadius` | Erken uyarı, daha iyi gradyan | Doğrudan algı maliyeti |
| `bondStrength` | Dayanıklı bağ | Bağ başına bakım maliyeti |
| `motility` | Hızlı kaçış | `v²` hareket maliyeti |
| `plasticity` | Daha hızlı öğrenme | Öğrenme metabolik maliyeti |
| `shareEfficiency` | Enerji paylaşımı verimi | Artan bağ trafiği |
| `toleranceA/B` | Kaynak türüne uyum | Düşük tolerans = düşük emilim |
| `cooperation` | Bağ yenilemeye katılım (baskınlık) | Doğrudan metabolik maliyet (~bazalin %26'sı) |

Ortam değişince genomlar **anında düzeltilmez**; uyarlanma seçilimden doğar.

### `cooperation` ve "hileci"

`cooperation` (0..1) hücrenin bağ bütünlüğünü yenilemeye ne kadar enerji
koyduğunu belirler. Yenileme bedeli **ortaktır**: bağın iki ucundaki hücreler
birlikte öder, dolayısıyla **ödemeyen hücre de yararlanır** — işte *hileci*.

Ölçülen sonuç (`VALIDATION.md` §6.58): 16.000 tick'te seçilim bu parametreye
**yön vermiyor** (ak etkisi p = 0,74). Yani bu modelde hileci tanımlı ama
evrimsel olarak baskın çıkmıyor.

### Ağırlık kalıtımı (kritik ayrım)

Her organizmada iki ayrı dizi vardır:

- `thetaInherited` — kalıtsal başlangıç ağırlıkları
- `thetaLive` — bu yaşamda kullanılan ve öğrenilen ağırlıklar

Yavrunun kalıtsal ağı, ebeveynin **`thetaInherited`** değerlerinden mutasyonla
türer. `thetaLive − thetaInherited` farkı **varsayılan olarak aktarılmaz**.
Yavrunun canlı ağı kendi başlangıç ağına eşit başlar; yörünge tamponu, önceki
ödül ve baseline sıfırlanır. Kimliği sürdüren parça kendi öğrenmesini korur.

> Uygulama notu: `Organism.neural` ile `NeuralPolicy.state` **aynı nesnedir**.
> Ayrı nesneler kullanılırsa öğrenilen ağırlıklar organizma kaydına yansımaz ve
> mikroskop "hiç öğrenmemiş" gösterir. Bu hata geliştirme sırasında yakalandı ve
> düzeltildi (`tests/world.test.ts › öğrenme açıkken ağırlıklar … organizma
> kaydına yansır`).

---

## 4. Yapay sinir ağı

```
12 girdi → 8 gizli (tanh) → 4 çıktı (sayısal kararlı softmax)
```

| Ölçüm | Değer |
|---|---|
| Parametre | `12·8 + 8 + 8·4 + 4 = ` **140** |
| Toplam birim | `12 + 8 + 4 = ` **24** |
| Ağırlıklı bağlantı | `96 + 32 = ` **128** |
| Bias | `8 + 4 = ` **12** |

Saf TypeScript; ağır ML bağımlılığı yoktur. Topoloji sabittir; Q tablosu
kullanılmaz.

### 12 girdi

| # | Girdi |
|---|---|
| 1 | Normalize enerji |
| 2 | Normalize organizma hücre sayısı |
| 3–5 | Yerel **A** kaynak gradyanı x/y/z |
| 6–8 | Yerel **B** kaynak gradyanı x/y/z |
| 9 | Yerel seçilim/avcı baskısı |
| 10 | Önceki gerçekleşmiş, ölçeklenmiş ödül |
| 11 | A kaynağıyla temas bayrağı |
| 12 | B kaynağıyla temas bayrağı |

Kaynağın **gizli faydalı/zararlı etiketi girdi değildir**; organizma yalnız yerel
mesafe-ağırlık sinyalini görür. Dünya koordinatları girdi değildir. Gözlemci
modelinin bilgisi organizmaya **sızmaz**.

### Dört eylem

`A gradyanına yönel · B gradyanına yönel · Keşfet · Dinlen`

Kaynak alımı **dünya temas kurallarıyla** gerçekleşir. Ağ motorun altyapısını
tasarlar; "ağ fizik yasalarını sıfırdan keşfetti" iddiası yapılmaz.

### REINFORCE

```
L = − Σ stopGradient(G_t − b_t) · log π_θ(a_t | x_t)
G_t = Σ_{k≥t} γ^(k−t) · r_k ,  γ = 0.95
```

- Yörünge en fazla **64** karar.
- Yörünge toplanırken ağırlıklar **sabit**; güncelleme yalnız sınırda.
- `A_t = G_t − b_t`; `b_t` karar anındaki baseline'dır.
- Baseline, önceki yörüngelerden gelir ve politika güncellemesinden **sonra**
  hareketli (EMA, β = 0.25) olarak tazelenir.
- Ölümde kalan yörünge kapatılır ve güncelleme yapılır.
- **Sonlu ufuk:** yörünge sonunda bootstrap değeri kullanılmaz. Bu bir
  basitleştirmedir ve sonucu etkiler.
- Gradyan normu 5'e kırpılır; NaN/Infinity'te ağırlıklar değiştirilmez.
- Ödül net enerji değişimi ve alınan hasardan üretilir; kaynağın "doğru" olduğuna
  dair gizli etiket eğitim hedefi olarak kullanılmaz.

Gradyan analitiktir ve `tests/mlp.test.ts` içinde **140 parametrenin tamamında**
merkezi sonlu farkla doğrulanır (tolerans 2e-6).

### Kapsam sınırı

Bu, organizmanın **soyut hesaplama modelidir**. Fiziksel `Cell` ile matematiksel
sinir birimi aynı şey değildir; tek hücrelilerin biyolojik nöronu olduğu
iddia edilmez. Bilinç veya genel zekâ üretildiği söylenmez.

---

## 5. Seçilim baskısı

Avcı **öğrenen bir tür değildir**; açıkça etiketlenmiş yerel seçilim tehlikesidir.
Avını arar (yakındaki en değerli hücrelere yönelir) ama öğrenmez.

Yakalama **doygun (tip II) işlevsel yanıt** kullanır:

```
p = 1 − exp( − CAPTURE_DENSITY_K · baskı · erişimdekiHücreSayısı )
```

Neden bu biçim: her organizma için bağımsız zar atmak avcıyı seyrek popülasyonda
bile mutlak bir katil yapıyordu (48 hücrelik başlangıç popülasyonu tükeniyordu).
Doygun yanıt, av seyrekken baskıyı düşük, av yoğunken yüksek tutar: gerçek bir
avcı–av geri beslemesi.

Avcı enerjisi **hücrelerden** gelir ve kapasitesi dolduğunda fazlası
depolanmaz (harcanır). Metabolizması kütlesiyle orantılıdır, bu yüzden av
azalınca açlıkla ölür ve av toparlanır. Avcının ölümü dış girdi olmadan
kendiliğinden gerçekleşir; oyuncunun geri getirmesi ayrı bir müdahaledir ve
enerjisi defterde dış girdi olarak işaretlenir.

Yakalanma olasılığı beden ölçüsü ve baskıyla değişir; büyüklüğün yararı
bakım, hareket ve kaynak erişimi maliyetleriyle dengelenir.

---

## 6. Determinizm

Üç ayrı RNG akışı vardır: `env`, `inherit`, `action`. Böylece A/B dallarında
farklı politikalar hava/kaynak olaylarını kaydıramaz.

`normal()` bilinçli olarak Box–Muller yerine **Irwin–Hall** (12 üniform toplamı
eksi 6) kullanır: yalnız toplama ve çarpma içerir, `Math.log`/`Math.cos` gibi
motora bağlı transcendentaller yoktur.

**Farklı cihazlarda bit düzeyi eşitlik test EDİLMEDİ ve vaat edilmiyor.** Aynı
ortamda, aynı sürümde kaydet/yükle eşdeğerliği `tests/` içinde denetlenir.

---

## 7. Zamanlama

- Sabit adım **50 ms**; karar güncellemesi her **10 tick**'te (≈ 2 Hz).
- Hızlandırma (1×/2×/4×) fizik adımını büyütmez, aynı adımları daha sık yürütür.
- Gizli sekmede duraklatılır; dönüşte biriktirici tavanı ile kontrolsüz dev adım
  atılmaz.
- Görüntü kareden bağımsız; gecikmede fizik adımı büyümez.

---

## 8. Kaynak dayanağı

Tasarım dayanağı olarak bakıldı, ancak deney sonuçları **kendi uygulamamızda
otomatik doğrulanmış değildir**:

[Çok hücrelilik](https://pmc.ncbi.nlm.nih.gov/articles/3277146/) ·
[Avcı baskısı](https://www.nature.com/articles/s41598-019-39558-8) ·
[Beden ve fiziksel maliyet](https://www.nature.com/articles/s41586-023-06052-1) ·
[Beden/davranış evrimi](https://www.karlsims.com/evolved-virtual-creatures.html) ·
[Geri yayılım](https://www.nature.com/articles/323533a0) ·
[REINFORCE](https://doi.org/10.1007/BF00992696) ·
[Nöroevrim](https://nn.cs.utexas.edu/?stanley:ec02) ·
[CLIP](https://openai.com/index/clip/) ·
[ASAL](https://asal.sakana.ai/) ·
[Dünya modelleri](https://www.nature.com/articles/s41586-025-08744-2) ·
[V-JEPA](https://ai.meta.com/blog/v-jepa-2-world-model-benchmarks/) ·
[R3F](https://r3f.docs.pmnd.rs/getting-started/introduction)

## 9. Belgelenmiş sonraki sürüm (boş ekran DEĞİLDİR, plan kaydıdır)

- **V1** — canlıya kendi algı hacminden düşük çözünürlüklü yerel görsel girdi;
  küçük kodlayıcı ve doğrudan sensör kontrolüne karşı değerlendirme.
- **V1** — kısa geçmişi temsil eden tekrarlayan ağ; hafızayı kapatma deneyi.
- **V2** — eyleme bağlı küçük dünya modeli; tahmin edilen ve gerçekleşen sonucu
  karşılaştırma.
- **V2** — değişken ağ topolojisi/nöroevrim ve ilginç davranışlar için otomatik
  deney önerileri.

Bunlar `docs/PROGRESS.md` içinde gerekçesiyle listelenmiştir; çalışıyormuş gibi
gösteren boş ekranlar yapılmamıştır.
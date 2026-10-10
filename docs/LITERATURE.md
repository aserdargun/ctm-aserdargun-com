# Cell to Mind — Literatür Haritası

**Tarih:** 10 Ekim 2026
**Kapsam:** Bu depo için tasarım kararlarını etkileyen sekiz literatür ekseni.
**Yöntem:** Açık web taraması (arXiv, Nature, Science, JMLR, NeurIPS, ALife
kaynakları). Aşağıdaki her kaynak, arama sonuçlarında **gerçekten açıldı ve
okundu**; okunmadan adı geçen kaynak yoktur.

Bu belge **tasarım rehberi değil, kanıt defteridir.** Her eksende üç soru var:
literatür ne diyor, Cell to Mind'da neye denk geliyor, alınacak karar ne.
Kararların kendisi `docs/ROADMAP.md` içindedir.

> **Okuma sınırı:** Burada özetlenen çalışmaların çoğu CTM'nin ölçeğinden
> (256 hücre, tarayıcı, 12→8→4 MLP) çok büyük sistemler üzerinde çalışmıştır.
> "Literatürde X yapılıyor" cümlesi **"CTM'de de X yapılmalı"** anlamına gelmez.
> Her kararın kendi ölçeğine uygun bir gerekçesi olmalıdır; `ROADMAP.md`
> bu ayrımı faz fazla korur.

---

## 1. Açık uçluluk (open-endedness): sistemin ölçtüğü asıl şey

### Literatür

Açık uçluluğun ALife'daki kesin tanımı 2017'de Stanley ile oturdu ve 2024'te
ölçülebilir bir biçim aldı. Hughes vd., *"Position: Open-Endedness is Essential
for Artificial Superhuman Intelligence"* (PMLR v235, 2024) sistemi, **dış bir
gözlemciye göre** iki koşul arıyor:

- **Yenilik (novelty):** $t$ anına kadar çıplaklara eğitilmiş bir gözlemci
  için, gelecekte hâlâ daha az öngörülebilir çıplaklar var olmalı.
- **Öğrenilebilirlik (learnability):** Daha uzun geçmiş koşullandığında
  gözlemcinin geleceği tahmin etme yetisi **monoton artmalı**.

Bu tanım ölçüt değil ölçülebilirlik kriteridir: sistem "yenilik" ve
"öğrenilebilirlik" skorlarını raporlar. Hughes vd. ayrıca şunu ekler:
**anlaşılamayan bir sistem açık uçlu sayılamaz.** (Kaynak:
`proceedings.mlr.press/v235/hughes24a.html`, `arxiv.org/html/2502.04512v3`.)

Ölçüm tarafının standardı **MODES kutusu** (Dolson vd., *The MODES Toolbox*,
Artificial Life 25(1), 2019) dört potansiyeli ölçüyor: **değişim, yenilik,
karmaşıklık, ekoloji**. Araç *NK* peyzajları ve **Avida** üzerinde doğrulanmış;
yani ALife ölçüm aracı, ALife sistemi üzerinde sınanmış bir araç. Evrimsel
aktivite istatistikleri (Bedau & Packard 1996) ve **nötr olmayan** aktivite
(Droop & Hickinbotham 2012) bunun alt ölçütleri. Evrimsel dinamikleri dört
sınıfa ayırıyor: yok → sınırlı → sınırsız-yaratıcı → sınırsız. CTM şu an
**"sınırlı aktivite"** sınıfında; 20.000 tick'te üstelik azalan bir eğri.

Lenia ailesi bu soruna doğrudan mühendislik cevabı veriyor:

- **Akış Koruyan Lenia** (Plantec vd., arXiv:2212.07906) — kütle korumayı
  ekleyerek **evrimsel aktiviteyi** artırıyor ve parametreleri hücreye
  lokalize ederek **çok türlü** simülasyona izin veriyor.
- **Büyük ölçekli açık uçlu Lenia** (Faldor vd., arXiv:2304.05639) — JAX ile
  paralel; bulgu çok önemli: sistem önce çeşitlilik ve yaratıcılık evresinden
  geçiyor, sonra **hızlı yayılan desenlerin hakimiyetine çöküyor.** Yani
  "açık uçluluk zor, üstelik geçicidir."
- **Merak güdümlü AI bilim insanı** (Hamon vd., arXiv:2505.15998) — IMGEP
  çerçevesini sistem düzeyi ölçütlere (evrimsel aktivite, sıkıştırma karmaşıklığı,
  çok ölçekli entropi) uyarlıyor; IMGEP rastgele aramaya göre çok daha fazla
  ekoloji keşfediyor.

### CTM'deki karşılığı

CTM'nin gözlemci paneli şu an **anlatıcı**. MODES + Hughes ölçütleri onu
**ölçüme çevirir**: gözlemci bir "bulgu" değil, bir "gözlemci" olur ve çıktısı
puan olur.

Somut olarak: gözlemci modülüne (a) evrimsel aktivite, (b) yenilik, (c) ekoloji
(benzersiz soy/niş sayısı), (d) karmaşıklık (organizma boyutu dağılımının
entropisi) metrikleri eklenmeli. Bunlar tümü hesap tarafında **zaten var olan**
veriden türetilebilir; yeni simülasyon kodu gerekmez.

**Alınacak karar:** Açık uçluluk, bu depoda bir **iddia** değil, bir **ölçüm**
olmalı. "Yaşam sürüyor" yerine "yaşam 20.000 tick'te şu skoru verdi."

---

## 2. Ana evrimsel geçişler: çok hücreliliğin bedeli

Bu eksen CTM'nin en büyük bilimsel fırsatı, çünkü CTM şu anda tam olarak
buradaki deneyi **yapamıyor**.

### Literatür

Buss'in çerçevesinden bu yana ana bulgu sabit: **çakışma kontrol edilmeden
çok hücrelilik kalıcı olmaz.** Deneysel kanıtlar:

| Bulgu | Deney | Kaynak |
|---|---|---|
| **Yüksek akraba bağı** çok hücreli işbirliğini korur. Düşük akrabalıkta hileci (cheater) mutasyonları yayılır; spor verimi 3× düşer. | *Neurospora crassa*, yüksek/düşük akrabalık kolu karşılaştırması | Nature Communications, `nature.com/articles/ncomms11435` |
| **Yapılandırılmış üreme** (küçük propagül) ve **yapılandırılmış büyüme** işbirliğini korur; bu özellikler yoksa hileciler baskın olur. | Mikropal sözde-organizmalarla yaşam döngüsü koşullarını `ceteris paribus` test etme | `pmc.ncbi.nlm.nih.gov/articles/PMC3565483` |
| **Gruplama yoluyla propagül oluşumu**, avcılık olmasa bile işbirliğini sürdürür; rastgele dağılmada hileci her zaman kazanır. | Bireysel tabanlı uzamsal model | `pmc.ncbi.nlm.nih.gov/articles/PMC11101088` |
| **Hileci–dirençli eşevrimi** mümkündür: direnç, hilecilik popülasyonu silmeden önce evrimleşebilir. | *Dictyostelium discoideum*, çok düşük akrabalık | J. Exp. Biol. 28(4), `academic.oup.com/jeb/article-abstract/28/4/756/7381344` |
| Çakışma kontrol mekanizmaları: yüksek akrabalık, **akraba ayrımı**, **pleiotropi**, **çekme zarı**, **kura atama**. | *D. discoideum* gözden geçirme | `pmc.ncbi.nlm.nih.gov/articles/PMC3131822` |

Fraternal/egaliyen ayrımı (Bourke 2011) burada işe yarar: çok hücrelilik
*fraternal* (akraba olan benzer birimlerin birleşmesi), endosimbiyoz ise
*egaliyen* (farklı birimlerin birleşmesi) bir geçiş.

### CTM'deki karşılığı — bu projenin en keskin gözlemi

`docs/MODEL.md` §3, `genome.ts` ve `policy.ts` birlikte okununca şu çıkıyor:
**bir organizmanın tüm hücreleri tek bir genomu ve tek bir ağırklar dizisini
paylaşıyor.** Yani CTM'de akrabalık yapısal olarak 1'dir.

Bu, iki yönlü bir sonuç verir:

1. **İyi haber:** CTM, hileci problemini yapılandırmasıyla çözmüştür —
   literatürdeki "yüksek akrabalık" çözümünün en saf hâli. Kuram olarak tutarlı.
2. **Kötü haber:** Buna karşılık **organizma içinde hiç seçilim yok**. Çakışma,
   dolayısıyla hileci–dirençli eşevrimi, dolayısıyla çok hücreliliğin en ilginç
   kısmı **modellenemez.** Ana evrimsel geçişin statüsü sorulmadan önce çözülmüştür.

Mevcut durumda çok hücrelilik "yapısal bir sonuç" (bağ topolojisi), **seçilimsel
bir sonuç** değil. `MODEL.md` §2'deki "en az 4 hücreli yapı" işletimsel eşiği de
buna işaret ediyor.

**Alınacak karar:** Somatik mutasyon eklemek (hücre bölünürken küçük olasılıkla
genom/ağı sapması) ve organizma içi hayatta kalma rekabeti koymak. Bu, projeyi
"gösteren bir simülasyondan" **"ana evrimsel geçiş üzerine çalışan bir sisteme"
** taşır — ve tam olarak literatürün ölçtüğü şeyi ölçebilir hale gelir.

---

## 3. Kalite-çeşitlilik, keşif araması ve evrimsel arayüz

### Literatür

- **Yenilik araması** (Lehman & Stanley 2008/2011) uygunluk işlevini tamamen
  bırakır; davranış uzayında k-en yakın komşuya uzaklıkla yeni olanı ödüllendirir.
  Nedeni: *uydurma peyzajlar* (deceptive landscapes).
- **Kalite-çeşitlilik (QD)** ailesi: NSLC (Lehman & Stanley 2011) ve
  **MAP-Elites** (Mouret & Clune 2015). Gözden geçirme:
  `frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2016.00040/full`.
  Ana fikir: **bir optimum değil, bir repertuvar** — her davranış nişinde en iyi
  birey.
- QD'nin evrimsel yaratıcılardaki kökeni: `arxiv.org/pdf/2012.04375`.
- **Picbreeder** (Secretan vd., Evolutionary Computation 19(3), 2011) — 140.000
  nesilden 7.000+ yayınlanmış görsel; kullanıcılar birbirlerinin soyunu
  **dallandırarak** devam ettirdi. `stars.library.ucf.edu/cgi/viewcontent.cgi?article=2880&context=facultybib2010`
- **NA-IEC** (Lehman & Stanley 2012) — Picbreeder'ın en çarpıcı sonucu:
  insana anlamlı gelen görseller, aynı algoritmanın **hedef yapıldığında yeniden
  üretilemiyor.** `arxiv.org/html/1207.6682v1`
- **Evrimsel sanatın VLM versiyonu**: AI Picbreeder (Sakana) — arşivden seçim, VLM
  ajanların "kullanıcı" gibi davranması. `pub.sakana.ai/picbreeder-vlm/`

### CTM'deki karşılığı

CTM'nin genomu **8 skaler**. Bu, "evrim" kelimesini taşıyan ama aslında 8
boyutlu bir parametre ayarı. QD bir repertuvar istediği için 8 boyut yeterli
*olabilir* — ama şu an böyle bir repertuvar yok. Popülasyon tek bir çevreye göre
seçiliyor ve çeşitlilik çökmüyor (6000 tick sonrası en büyük küme 4'e düşüyor).

Yine de CTM'in arayüz geleneği ile doğrudan bir bağı var: **oyuncu zaten
seçim yapıyor** — koşulu değiştiriyor, bir soyu takip ediyor. Picbreeder'ın
dersi: bu seçimi **arşivle** birleştirirsen ve dallandırmaya izin verirsen,
kullanıcı sistemi kendi keşif makinesine dönüştürebilir.

**Alınacak karar:** (a) Davranış ızgarası = MAP-Elites arşivi → kullanıcıya
görünür "yaşam haritası"; (b) dal (branch) komutu bir arşiv dalı olsun, geçici
deney olmasın.

---

## 4. Gövde, öğrenme ve Baldwin etkisi

### Literatür

- **DERL / unimals** (Gupta, Savarese, Ganguli, Fei-Fei, *Nature Communications*
  2021, `nature.com/articles/s41467-021-25874-z`): evrim + PPO birlikte.
  Üç bulgu CTM için doğrudan ilgili:
  1. **Ortam karmaşıklığı morfolojik zekâyı artırır** — karmaşık ortamda evrilen
     gövdeler yeni görevleri daha hızlı ve iyi öğrenir.
  2. **Morfolojik Baldwin etkisi** gösterildi: evrim, "öğrenmesi hızlı" gövdeleri
     seçiyor — *doğrudan seçilim baskısı olmadan*.
  3. 10 nesilde ortalama öğrenme süresi **yarıya** iniyor.
- **Plastisite kurallarının evrimi** (arXiv:2303.06734): öğrenme hızının
  optimumu ortam değişkenliğine bağlı — çok yavaşsa öğrenme durur, çok hızlıysa
  öğrenme tamamen terk edilir. Bir U eğrisi.
- **Nöroevrimun biyolojik sinir hesabına katkısı** (*Science* 2025,
  `pmc.ncbi.nlm.nih.gov/articles/PMC12238971/`): kaynak kısıtları, kablolama
  uzunluğu, gövde-kontrol eşevrimi gibi biyolojik kısıtların davranışı nasıl
  belirlediğini incelemek için nöroevrimun kullanılabileceğini savunuyor.
- **Sims'ın başarısız uyarlama** (Sims 1994): yürümeyi ödüllendiren uygunluk
  fonksiyonu, hedefe **devrilerek** ulaşan uzun, rijit yaratıklar üretti. Kaynak:
  `en.wikipedia.org/wiki/Reward_hacking` içinde anlatılıyor.

### CTM'deki karşılığı

CTM'de `plasticity` genomu **zaten var** ve öğrenme maliyeti karşılığında
metabolik bedeli var (`MODEL.md` §3). Bu, DERL'in ölçtüğü şeyin birebir
karşılığı: **seçilim, daha hızlı öğrenen genomlara mı üstün geliyor?**

Bu, projedeki üç deneyten en ucuzu ve en güçlüsü:
- nesiller boyunca ortalama `plasticity` izlenir (zaten hesaplanıyor),
- her soydan alınan bireylerin *öğrenme hızı* ölçülür,
- korelasyon raporlanır.

Sonuç ne çıkarsa çıksın öğretici: **çıkarsa** Baldwin etkisinin bir kısmi
gösterimi; **çıkmazsa** doğrudan bir negatif sonuç ve bunu da yazmak gerekir.

**Alınacak karar:** Baldwin etkisi deneyi, deney motoru yazıldıktan sonra
ikinci deney olsun.

---

## 5. RL metodolojisi: projedeki en büyük metodolojik borç

Bu eksen, `docs/PROGRESS.md` §2.1'deki "Deney 3 istatistiksel çerçeve gerektiriyor"
notunun arka planı.

### Literatür

- **Henderson vd. (2018), "Deep Reinforcement Learning that Matters"**: Aynı
  algoritma, aynı hiperparametreler, farklı tohumlar → "istatistiksel olarak farklı
  görünen" dağılımlar. İnceledikleri tüm derin RL kâğıtları **5 veya daha az
  tohum** kullanıyor; bazıları en iyi koşuların ortalamasını raporluyor.
  `studylib.net/doc/28468609/`
- **Colas vd. (2020), "How Many Random Seeds?"** (arXiv:1806.08295): tohum sayısı
  ile istatistiksel hata olasılığı arasındaki ilişki; Welch's t-test önerisi;
  çoklu karşılaştırma düzeltmesi.
- **Agarwal vd. (NeurIPS 2021), "Deep RL at the Edge of the Statistical
  Precipice"** (arXiv:2108.13264): nokta tahmin yerine **tabakalı bootstrap güven
  aralığı**; IQM skoru; performans profilleri. Uyarı: "anlamlı değil" demek
  etkisizliği kanıtlamaz; sabit tohum sorunu çözmez, hatta bazı algoritmalara
  haksızlık edebilir.
- **Empirical Design in RL** (JMLR v25, 2024 —
  `jmlr.org/papers/v25/23-0183.html` / arXiv:2304.01315): en kapsamlı kaynak.
  On bir klasik hata listesi. En çok işe yarayan iki madde:
  - **Tohum bir hiperparametre değildir.**
  - **Hiperparametre iki aşamalı seçilir**: süpürme yapılır, sonra **yeni
    tohumlarla** seçilen yapılandırma değerlendirilir; en azından iki aşamanın
    kendisi dış döngüde tekrarlanmalı. Maksimum yanlılık (maximization bias)
    böyle azalır.
- **Reward hacking biçimselleştirmesi** (Skalse vd. 2022, arXiv:2209.13085): bir
  vekil ödül "hacklenemez"dir ancak **sabit** ise; yani kaçınılmazdır.

### CTM'deki karşılığı

`docs/PROGRESS.md` §2.1'deki kabul hedefi: *"20 tohumun en az 15'inde eğitilmiş
politikayın kontrolü aşması."* Bu **bir eşik testidir ve yanlış kalibre edilmiş
bir testtir.** Boş hipotez altında 20 tohumda 15+ doğru gelme olasılığı zaten
yüksektir; "başarı" ile "tesadüf" birbirine karışır. Bu tam olarak Goodhart /
maksimum yanlılık tuzağıdır.

Ayrıca **bit düzeyinde çapraz cihaz determinizmi test edilmemiştir**
(`VALIDATION.md` §6.8). Bu, tarayıcıda tohumlu deney yapmanın istatistiği
kirletmesi anlamına gelir: aynı tohum farklı makinede farklı yol bulabilir.

**Alınacak kararlar:**
1. Kabul hedefi **eşik değil, aralık** olsun: 95% bootstrap CI.
2. Deneyler **headless Node'da** koşsun (depo zaten `vite-node` ile headless
   ölçüm yapıyor), tarayıcı yalnız **izleme** arayüzü olsun.
3. **Ortak rastgele sayı** (common random numbers) ve **eşleştirilmiş çalıştırma**
   (repeated measures) kullansın; ortam tohumu ile aktör tohumu ayrı ayrı sabitlensin.

---

## 6. Fizik ve ölçek: ne zaman pahalıya değer

### Literatür

- **MPM / MLS-MPM** (Sulsky vd. 1994/95; Hu vd. 2018) — Lagrangian parçacık +
  Eulerian ızgara hibriti. Büyük deformasyon, öz-çarpışma, kopma ve **farklı
  malzemelerin etkileşimi** doğal olarak çözülür; bilgisayar grafikleri ve
  biyomekanikte standarttır.
- **GPU MPM** — MLS-MPM ile ~**1500×** hızlanma bildirilmiş (Taichi, cerrahi
  yumuşak doku; arXiv:2402.01181); çoklu GPU MPM'de tek iş istasyonunda
  5–40 milyon parçacıkta **100×+** adım hızlanma (SIGGRAPH 2020,
  `sites.google.com/view/siggraph2020-multigpu`).
- **Farklılaştırılabilir MPM** — SoftZoo (ICLR 2023,
  `openreview.net/pdf?id=Xyme9p1rpZw`), SoftZoo ile topoloji optimizasyonu +
  doğrulama (Nature Communications'daki pnömatik yumuşak robot çalışması).
- **Tarayıcı tarafında GPU hesap**: WebGPU compute shader'ları tarayıcıda
  genel amaçlı paralel hesap sunuyor. Dünya geneli destek Martısı 2026 itibarıyla
  ~%85 (caniuse verisi, `huggingface.co/docs/transformers.js/en/guides/webgpu`).
  WebGPU + R3F/three ecosystemünde particle-life ve boids örnekleri mevcut
  (`webgpu.com/tag/simulation/`).
- **Nöroevrim ölçeği**: EvoJAX, JAX üzerinde nöroevrimi tek hızlandırıcıya
  indirir, **10–20×** eğitim hızlanması. `github.com/google/evojax`

### CTM'deki karşılığı

CTM'nin hücreleri bugün **rijit parçacık + yay + temas kuralı**. Bu, bir
"oyun fiziği"idir; morfoloji yoktur, gerilme yoktur, bölünme bir enerji
eşiği olayıdır.

MPM burada iki farklı şey sunar:
1. **Görsel/duyusal gerçeklik**: hücreler gerçekten deforme olur, yapışır,
   bölünür. Kullanıcının projedeki "3B'de sprite/CSS taklidi yapma" ilkesiyle
   uyumlu, hatta onu aşan bir adım.
2. **Bilimsel içerik**: morfoloji evrime girerse (gövde de kalıtsal bir özellik
   olursa) DERL/Baldwin hikâyesi güçlenir.

**Alınacak karar:** Bu **en pahalı ve en geç** kalem. Fenomi çalışmadan MPM'e
girmek, doğru olanı yapmamak için harcamaktır. Şimdilik mimari olarak
*izin verilebilir* olmalı (worker'ın deterministik saf-TS olması korunmalı),
ama uygulanmamalı.

---

## 7. Gözlemci: anlatıcıdan ölçüme

### Literatür

- **ASAL++** (arXiv:2509.22447): ASAL'in çok modlu temel modellerle yönlendirilmiş
  açık uca benzeri arama sürümü. **Gözlemci, evrimi yönlendiren bir sinyal
  olarak** kullanılıyor — CTM'nin gözlemcisi bugün yalnız anlatıyor; bu bir
  fırsat.
- **AI Co-Scientist** (Google DeepMind, Şubat 2025,
  `research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/`):
  altı ajanlı koalisyon (Generation, Reflection, Ranking, Evolution, Proximity,
  Meta-review). Hipotezleri doğal dilde üretir, turnuva ile sıralar.
- **FunSearch** (Nature, 2024) ve **AlphaEvolve** (2025, arXiv:2506.13131):
  LLM'in *kod* evrimini yönlendirmesi. AlphaEvolve MAP-Elites ve ada popülasyonu
  esinli bir evrimsel veritabanı kullanıyor.
- **The AI Scientist** (Sakana, Nature 2024→2026) ve **Darwin Gödel Machine**
  (arXiv:2505.22954): açık uçlu kendini iyileştirme.
- **Hipotez-tahmin-uzlaştırma döngüsü** ("The Little Scientist",
  arXiv:2608.16951): saf evrimsel mutasyona karşı, ajanın **sayısal tahminini önce
  yazıp** sonra sonucu uzlaştırması; bu, FunSearch'ten daha az örnekle çalıştığı
  raporlanıyor.

### CTM'deki karşılığı

`src/worker/evidence.ts` ve `server/index.ts` zaten şemalı rapor + `metricRef`
doğrulaması yapıyor. Bu, doğru temel. Eksik olan: **görüntü gerçekten
gönderilmiyor** (`imageHint` yalnız tick/kamera taşıyor) ve hiçbir canlı sağlayıcı
çağrısı yapılmadı.

En güçlü tasarım fikri şu: **gözlemciyi "hikâye anlatıcısı" değil, "bilim insanı"
yapmak.** Yani:

1. Bir koşu başlamadan önce gözlemci **sayısal bir tahmin** yazar.
2. Koşu biter.
3. Gözlemci tahmini **ölçülen veriyle uzlaştırır**, kırmızı yemiyorsa söyler.

Bu, "dil modeli uydurdu" riskini yapısal olarak çözer ve projeyi yönergesindeki
dürüstlük kültürüyle tam uyumlu hale getirir. Aynı zamanda §1'deki
**öğrenilebilirlik** ölçütünü ölçülebilir kılar: gözlemci tarihsel bağlamla
geleceği daha iyi tahmin ediyor mu?

**Alınacak karar:** Gözlemci iki modlu olsun — **anlatıcı** (ürün, mevcut) ve
**analist** (ölçüm, yeni). Analist modu yalnız şema uyumlu, ölçülebilir çıktı
üretir ve kayıtsız iddia reddedilir.

---

## 8. Öğretilebilir arayüz: ürünün ölçülebilir tarafı

### Literatür

- **exploRNN** (arXiv:2012.06326): etkileşimli keşfedilebilir RNN görselleştirmesi,
  37 katılımcı. Metin grubu **yüzeysel** bilgide öndeyken, exploRNN grubu
  **daha derin** anlayışa sahip; algılanan zorluk **%12,71** daha düşük,
  gereksiz bilişsel yük anlamlı biçimde az. Sonuç: zor konularda
  etkileşimli görselleştirme daha derin öğrenmeyi kolaylaştırır.
- **Bilişsel yük kuramı** ve **iskelet destek (scaffolding)** üzerine gözden
  geçirme (2024, `link.springer.com/article/10.1186/s40594-024-00490-7`):
  simülasyonlar tek başına derin anlayış **garanti etmez**; kısıtlama, anında
  geri bildirim ve problem çözme görevleri tasarımın parçası olmalı.
- **Uzamsal beceri uyarısı**: bilgisayarlı görselleştirmeler, düşük uzamsal
  beceriye sahip öğrencilerde **aşırı yükleme** yapabilir; karmaşık görselleştirme
  ilk sunulduğunda sadeleştirmek gerekir. `pmc.ncbi.nlm.nih.gov/articles/PMC7688843/`
- **Sistemler düşüncesi için etkileşimli görsel öğrenme ortamı** (2025,
  karbon döngüsü üzerine): görsel temsil + etkileşim + çoklu temsil + uyarlama
  dört temel araç. `tandfonline.com/doi/full/10.1080/10494820.2025.2494161`

### CTM'deki karşılığı

CTM'nin mikroskopu tam olarak exploRNN sınıfından bir araç: 12 girdi, 8 gizli
aktivasyon, 4 eylem olasılığı, gizli birimi susturma, karşı-olgusal hesap. Bu,
projedeki en değerli öğretim yüzeyi ve **zaten çalışıyor**.

Eksik olan katman ise **mikroskop ile ekosistem arasındaki köprü**: kullanıcı
bir organizmanın kararını görüyor ama bunun popülasyon üzerindeki sonucunu
görmüyor. MODES metrikleri + yaşam haritası bu köprüyü kurar.

Ayrıca uzamsal beceri uyarısı doğrudan geçerli: 3B sahne + mikroskop + soy
defteri + deney paneli aynı anda açık olan bir arayüz, düşük uzamsal beceriye
sahip kullanıcı için yük taşıyabilir. Kademeli açılma (progressive disclosure)
ve bir **şematik 2B mod** gerekir.

**Alınacak karar:** Arayüz, "kaç panel açık" değil, "kaç soru sorulabilir"
açısından tasarlanmalı. Ana döngü (`README.md`) zaten doğru: *koşulu değiştir →
gözlemle → hipotez kur → kontrol dalıyla karşılaştır → keşfi kaydet.* Bu, ürünün
en güçlü farkı ve korunmalı.

---

## 9. Toplu zekâ ve stigmerji (kısa eksen)

### Literatür

- **Stigmergi** (Grassé 1959): bireyler doğrudan iletişim kurmadan, ortamda kalıcı
  izler bırakarak (feromon izi, hücre dışı matriks, oluk) koordinasyon sağlar.
  Bakteriyalar için `pmc.ncbi.nlm.nih.gov/articles/PMC4306409/`,
  *Myxococcus xanthus* için `pmc.ncbi.nlm.nih.gov/articles/PMC4881031/`.
- **S-MADRL**: sanal feromonla merkezsiz koordinasyon, 8 ajana kadar
  (`link.springer.com/article/10.1007/s10015-025-01089-z`).
- RL ile **kendiliğinden bencillik**: feromon izi kurma, *yaşam boyu* (tek
  nesilde) öğrenmeyle ortaya çıkabilir — arXiv:2302.14778.

### CTM'deki karşılığı

CTM'nin ortamında **sürülen hiçbir şey yok**. Kaynak düğümleri, avcı ve ışık
var; ama hücrelerin bıraktığı izler yok. Paylaşma bir bağ üzerinden enerji
aktarımı, stigmergi değil.

Bu, iki yönlü bir olanak:
1. **Gerçek bir biyolojik eksik**: gerçek çok hücreli yaşamda hücreler
   ekstraselüler matriks bırakır, bu matriks morfojen sinyali taşır ve ayrışmayı
   ve hücre ölümünü düzenler. CTM'de bağ koptuğunda **aniden** dağılıyor.
2. **Ucuz ve görünür**: basit bir "kaynak/enzim izi" alanı, kolonilerin bıraktığı
   koridorları görünür kılar ve hangi soyun hangi rotayı bulduğunu gösterir.

**Alınacak karar:** Düşük öncelik, ama yüksek görsel getiri. Faz B'nin içine,
bağ kopması yerine "programlı ayrışma" olarak eklenebilir.

---

## 10. Kaynak özeti

Taranan ve okunan çalışmaların konsolide listesi:

**Açık uçluluk ve ölçüm**
- Hughes vd. 2024, *Position: Open-Endedness is Essential for ASI* (PMLR v235)
- Dolson vd. 2019, *The MODES Toolbox*, Artificial Life 25(1)
- Droop & Hickinbotham 2012, nötr olmayan evrimsel aktivite
- Faldor vd. 2023, arXiv:2304.05639 (büyük ölçekli açık uçlu Lenia, JAX)
- Plantec vd., arXiv:2212.07906 (Flow Lenia)
- Hamon vd., arXiv:2505.15998 (merak güdümlü AI bilim insanı)
- Pugh vd. 2016; Mouret & Clune 2015 (QD / MAP-Elites)
- Lehman & Stanley 2008/2011 (yenilik araması, NSLC)

**Ana evrimsel geçişler**
- Nature Communications 2016, `ncomms11435` (akrabalık–hileci)
- `PMC3565483` (yapılandırılmış üreme/büyüme)
- `PMC11101088` (gruplama yoluyla propagül, grup seçilimi)
- J. Exp. Biol. 28(4) 2025 (hileci–dirençli eşevrimi)
- `PMC3131822` (*D. discoideum* çakışma kontrol mekanizmaları)

**Gövde, öğrenme, evrim**
- Gupta vd. 2021, Nature Communications (DERL / unimal / Baldwin)
- arXiv:2303.06734 (plastisite kurallarının evrimi)
- *Science* 2025, adp7478 (nöroevrim ve biyolojik sinir hesabı)
- Sims 1994 (evrimsel yaratıklar; uydurma uygunluk örneği)
- Lai vd. 2021, CGF (sanal yaratık morfolojisi gözden geçirmesi)

**RL metodolojisi**
- Henderson vd. 2018 (tekrar üretilebilirlik)
- Colas vd. 2020 (kaç tohum)
- Agarwal vd. NeurIPS 2021 (istatistiksel uçurum)
- JMLR v25 2024, Empirical Design in RL
- Skalse vd. 2022 (reward hacking biçimselleştirmesi)

**Fizik ve ölçek**
- Sulsky vd. 1994/95 (MPM); Hu vd. 2018 (MLS-MPM)
- arXiv:2402.01181 (MPM cerrahi, ~1500× GPU hızlanma)
- SIGGRAPH 2020 çoklu GPU MPM
- SoftZoo, ICLR 2023 (farklılaştırılabilir MPM)
- EvoJAX (github.com/google/evojax)
- WebGPU: `huggingface.co/docs/transformers.js/en/guides/webgpu`

**Gözlemci ve otomatik keşif**
- ASAL++ arXiv:2509.22447
- AI Co-Scientist, Google DeepMind 2025
- FunSearch (Nature 2024), AlphaEvolve arXiv:2506.13131
- The AI Scientist (Sakana), Darwin Gödel Machine arXiv:2505.22954
- "The Little Scientist" arXiv:2608.16951

**Etkileşimli evrim ve öğrenme arayüzü**
- Secretan vd. 2011, Evolutionary Computation (Picbreeder)
- Lehman & Stanley 2012, arXiv:1207.6682 (NA-IEC)
- Sakana, AI Picbreeder (`pub.sakana.ai/picbreeder-vlm/`)
- exploRNN arXiv:2012.06326
- Bilişsel yük + iskelet destek gözden geçirmesi (2024)
- Sistemler düşüncesi etkileşimli öğrenme ortamı (2025)

**Stigmergi**
- `PMC4306409` (bakteriyel stigmergi)
- `PMC4881031` (*M. xanthus*)
- S-MADRL (Springer 2025)

---

## 11. Bu literatürün işaret etmediği boşluklar

Dürüstlük için: şunları **aramadım** veya arayamadım.

- CTM'ye benzer, tarayıcıda çalışan, çok hücreli evrim + RL deneyleri yapan
  açık kaynak bir referans implementation'ı bulamadım. Benzer ayrışmalar
  (EVE, Flow-Lenia, Brax türevi DERL) ya masaüstü/hesaplama ağırlıklı ya da
  çok hücreli olmayan sistemler. Bu, projeye **gerçek bir referans boşluğu**
  olduğu anlamına gelir; aynı zamanda "zaten yapılmış" olma riskini de düşürür.
- Tarayıcı içi MPM uygulamasının ALife amacıyla kullanıldığı bir çalışma
  bulamadım.
- CTM'nin ölçeğinde (256 hücre, tarayıcı CPU) açık uçluluğun
  mümkün olup olmadığına dair bir üst sınır veya olumsuz sonuç bulamadım.
  Yani literatür, bu ölçekte başarısızlığı da garanti etmiyor.

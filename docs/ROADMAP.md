# Cell to Mind — Geliştirme Yol Planı

**Tarih:** 10 Ekim 2026
**Durum:** Tartışma için öneri. Hiçbir faz uygulanmadı.
**Dayanak:** `docs/LITERATURE.md` (her kararın kaynağı orada).
**Mevcut gerçekler:** `docs/PROGRESS.md`, `docs/VALIDATION.md`, `docs/MODEL.md`

---

## 0. Tek cümlelik tez

Bugün CTM **bir simülasyon**; kaynak dayanağı olan bir literatürdeki en güçlü
satır şudur: **kimseyi şaşırtmayan bir simülasyon, kiminse ilgilenmediği bir
simülasyondur.** Yol planının tamamı, projeyi "çalışan bir gösteri"den
"tartışmalı bir bilimsel iddia" taşıyan üç soruyu cevaplamak içindir:

1. **Kalıcı mı?** Koloniler neden 6.000 tick'te dağılıyor?
2. **Öğreniyor mu?** Öğrenme iddiası deneysel olarak sınandı mı?
3. **Bitmedi mi?** Sistem hiçbir noktada "bitti" demeyi bırakıyor mu?

---

## 1. Teşhis — mevcut durumun dürüst özeti

`docs/VALIDATION.md` §2'deki ölçüm:

| Tick | Popülasyon | En büyük küme | 4+ hücreli yapı |
|---|---|---|---|
| 2.000 | 225 | 9 | 11 |
| 6.000 | 216 | 4 | 1 |
| 12.000 | 129 | 2 | 0 |
| 20.000 | 78 | 2 | 0 |

### Güçlü yanlar (korunacak)

| # | Güçlü yan | Neden korunmalı |
|---|---|---|
| G1 | Kapalı enerji sistemi, rezidüel 0.0000 | Literatürde Flow-Lenia'nın aradığı tam olarak budur (kütle koruma). Rastlantı değil, tasarım. |
| G2 | 140 parametrede analitik gradyan, 2e-6 | Öğrenme iddiasının sayısal temeli. Korunursa sonraki her faz buna yaslanabilir. |
| G3 | Üç ayrı RNG akışı | A/B dallarını birbirinden kirletmiyor. Doğru ve nadir. |
| G4 | `thetaInherited` / `thetaLive` ayrımı | Yaşam içi öğrenme ile kalıtımın ayrılması. Doğru kurgu. |
| G5 | `VALIDATION.md` §6'daki dürüstlük | Projenin en değerli varlığı. Boşa harcanmasın. |

### Zayıf yanlar (düzeltilecek)

| # | Sorun | Kanıt | Etki |
|---|---|---|---|
| Z1 | **Deney motoru yok** | `src/sim/experiments/` modülü yok | Ürünün ana iddiası kanıtsız |
| Z2 | **Ekosistem sönümleniyor** | 20.000 tick'te 78 hücre, çok hücrelilik ≈ 0 | Açık uçluluk yok; "yaşam" iddiası zayıf |
| Z3 | **İstatistik yok** | Tek tohum, nokta tahmin | 15/20 eşik testi yanlış kalibre |
| Z4 | **Organizma içi seçilim yok** | Tüm hücreler tek genom + tek `thetaLive` | Ana evrimsel geçiş modellenemiyor |
| Z5 | **Gözlemci hiç çağrılmadı** | 503, anahtar yok | Anlatıcı yerine ölçücü olamıyor |
| Z6 | **Genom 8 skaler** | `genome.ts` | Evrim, açık uçlu bir genotip-haritası değil |
| Z7 | **Çapraz cihaz determinizmi test edilmemiş** | `VALIDATION.md` §6.8 | Tarayıcıda tohumlu deney kirlenir |
| Z8 | **Ortam iz bırakmıyor** | `world.ts` | Bağ kopması aniden; stigmerji yok |

---

## 2. Değişmeyecek ilkeler

Bunlar pazarlık konusu değil; her faz bunlara uymak zorunda.

1. **Ölçülmeyen hiçbir şey yazılmaz.** `VALIDATION.md` yalnız koşan şeyleri içerir.
2. **Enerji korunumu bozulmaz.** Dış girdi eklenirse defterde görünür.
3. **Eşik değil, aralık.** "15/20 tohumda geçti" bir sonuç değildir; güven
   aralığı vardır. `LITERATURE.md` §5.
4. **Analist modu anlatıcı modundan ayrıdır.** Analist yalnız ölçülebilir çıktı
   verir; anlatı modu ölçüm iddiasında bulunamaz.
5. **Kullanıcı hiçbir şeyi kontrol etmez.** Oyuncu koşulu değiştirir, canlıya
   komut vermez. Bu, ürünün farkıdır; bozulursa proje başka bir ürün olur.
6. **Her faz çalışan durumda bırakılır.** `PROGRESS.md` §1'deki kural.

---

## 3. Yol haritası — özet

| Faz | Ad | Süre | Bağımlılık | Kapanış kriteri | Durum |
|---|---|---|---|---|---|
| **A** | Ölçüm tabanı | 2 hafta | — | 3 deney gerçekten koşar, CI'lı rapor yazılır | ✅ |
| **B** | Ekoloji ve ana geçiş | 3 hafta | A | Koloniler 20.000 tick'te yaşıyor **veya** neden öldüğü kanıtlanmış | ⚪ teşhis edildi, B3 işbirliği bekliyor |
| **C** | Açık uçluluk aletleri | 2 hafta | A, B | MODES metrikleri + gözlemci puanı raporlanıyor | ⚪ metrikler ölçüldü (yakınsama), gözlemci anahtar bekliyor |
| **D** | Arama motoru | 4 hafta | B, C | Yaşam haritası (MAP-Elites arşivi) doluyor | ❌ **harita dolmadı** — varsayım çürütüldü, aşağıya bak |
| **E** | Algı, hafıza, fizik | açık uç | C, D | Yeni fazlar aşağıda ayrı | ⬜ |

**D'nin kapanış kriteri gerçekleşmedi ve bu bir başarısızlık kaydıdır, gizlenmez.**
Kapanış ölçüldü: arşivin seçilime katılması (ε > 0) dolu kutu sayısını
değiştirmedi (p = 1,0000). Nedeni **kalıtsız betimleyici**dir — boyut ekseninde
seçilim hiçbir şey koruyamaz (`VALIDATION.md` §6.28–6.30). D, ancak genomda
gerçekten var olan bir özellik tanımlayıcı olarak seçilebilir hale gelirse
yeniden açılmalıdır.

**Öneri: A ve B sırayla, C paralel başlayabilir.** C, B'nin sonucunu
beklemez; metrikleri ölçer, yorumu bekler.

---

### Faz A — Ölçüm tabanı (2 hafta)

**Amaç:** Projeyi "çalışan" durumdan "tartışılabilir" duruma taşımak.
Bu faz çalışmadan diğer hiçbir fazın ölçülebilir çıktısı yok.

#### A1 — Deney motoru (`src/sim/experiments/`)

| Deney | Tasarım | Zorluk |
|---|---|---|
| **1 · Birlikte kalmak** | Tek snapshot'tan iki dal; yalnız `bondAffinity` farkı; baskı sabit | Orta |
| **2 · Uyarlanma** | Atasal/torun genotipi karşılaştırması; öğrenme ve yeni mutasyon kapalı | Orta |
| **3 · Öğrenme** | Ayrılmış tohumlar (1–20 eğitim, 1001–1020 değerlendirme); ölü/başarısız bireyler önceden tanımlı kural ile elenir | Yüksek |
| **4 · Baldwin etkisi** (yeni) | Nesiller boyunca ortalama `plasticity` ile ölçülen öğrenme hızının korelasyonu | Orta |
| **Ablasyon** | Eğitilmiş ağdan gizli birim susturma | Düşük |

Deney 3'te "ölü birey" kuralı **rapor öncesinde** yazılmalı ve değiştirilemez.
Aksi halde sonuç, seçim kuralına göre biçimlendirilir.

#### A2 — İstatistik katmanı

- **Eşleştirilmiş çalıştırma:** aynı ortam tohumu, aynı başlangıç durumu,
  yalnız politik farkı. Rastgele değişkenler ortak (common random numbers).
- **Ortam tohumu** ve **aktör tohumu** ayrı ayrı sabitlenir.
- **Rapor:** 95% tabakalı bootstrap güven aralığı (Agarwal vd. 2021),
  nokta tahmin değil. Medyan + IQM.
- **Hiçbir koşu atılmaz.** Başarısız koşu ayrı sütun olarak raporlanır.
- **Hiperparametre iki aşamalı:** tarama varsayılan yapılandırmayla yapılır;
  seçilen yapılandırma **yeni tohumlarla** değerlendirilir (JMLR 2024).

#### A3 — Deneylerin başlıktan çalışması

Deneyler **tarayıcıda değil, headless Node'da** koşmalı. Gerekçe:
çapraz cihaz determinizmi test edilmemiştir (`VALIDATION.md` §6.8);
tarayıcı istatistiği kirletir. Depo zaten `vite-node` ile headless ölçüm
yapıyor (`VALIDATION.md` §2–3), altyapı hazır.

Arayüz yalnız sonucu gösterir ve **kaynak snapshot'ını taşır**; hesabı tekrar
çalıştırma yeteneği sunar.

**Kapanış kriteri:** `VALIDATION.md`, üç deney için **gerçek sayılar ve güven
aralıklarıyla** güncellenir — ne olursa olsun. İyi sonuç da kötü sonuç da
yazılır. Eğer Deney 3 geçmezse, bu bir başarısızlık değil, **ilk gerçek
bulgudur** ve öyle kaydedilir.

---

### Faz B — Ekoloji ve ana evrimsel geçiş (3 hafta)

**Amaç:** Kolonilerin neden 6.000 tick'te dağılıdığını bilmek ve, mümkünse,
çözmüp çözmediğini bilmek.

#### B1 — Neden dağılıyor? (ölçüm, 2 gün)

Sorgulanacak hipotezler ve her birini ayıracak ölçüm:

| Hipotez | Nasıl ayrılır |
|---|---|
| Kaynak tükenmesi | Kaynak rezervi ve kaynak yenilenme hızı grafiği |
| Avcı baskısı | Avcı-kill oranı, avcı popülasyonu grafiği |
| Enerji bütçesi | Organizma başına enerji: kazanım / harcama / aktarım ayrımı |
| Paylaşma yetersizliği | Paylaşma oranı: istenen / gerçekleşen |
| Bağ mekaniği | Bağ kopma yaşı, kopma anında yapısal gerilim dağılımı |

Bu ayrım yapılmadan hiçbir parametre değiştirilmemeli. Literatürdeki
karşılığı: Hiickinbotham/Stepney tartışması — kütle koruma tek başına
sürdürülebilir evrimsel aktivite için yeterli **değildir**.

#### B2 — Seçimsel baskınınun kaynağı (isteğe bağlı, 1 hafta)

Avcı bugün öğrenmeyen, tasarımcı tarafından konmuş yerel bir tehdittir. İki
seçenek sunulur; ikisi de test edilir:

- **(a) Baskıyı çevreselleştir:** kaynak düzeni, akıntı ve avcı yoğunluğu
  popülasyonun yoğunluğuna bağlanır → seçilim baskısı *çevreden* gelir.
- **(b) Avcıyı öğrenen yap:** avcı aynı politika mimarisini kullanır, ödülü
  farklıdır. Bu, `MODEL.md`'deki "avcı öğrenen bir tür değildir" kuralını
  değiştirir; bilinçli bir ürün kararı gerekir.

Öneri: önce (a). (b) biyolojik olarak daha ilginçtir ama iddia yükünü
değiştirir ve ayrı bir tartışma ister.

#### B3 — Somatik mutasyon ve organizma içi seçilim (1 hafta) ⭐

Bu, yol planının **en yüksek bilimsel getirili** adımıdır ve literatürün
tam ortasındadır (`LITERATURE.md` §2).

Bugün: tüm hücreler tek genom + tek `thetaLive` → akrabalık 1 → hileci
imkânsız → ama organizma içi seçilim de imkânsız.

Değişiklik:
1. Hücre bölünmesinde küçük olasılıkla **somatik mutasyon** (genom sapması).
2. Hücreler arası **rekabet** (ortam kaynakları için, mekanik olarak zaten var).
3. Bu mutasyonların **kalıcılığı** ölçülür: bir hücrenin torunlarından kaçı
   organizmada kalıyor?
4. Filtrelenmiş ölçüm: `shareEfficiency` yüksek bireyler gerçekten daha mı
   çok aktarıyor, yoksa daha mı az (çerçi/bedavarcılık)?

Beklenen çıktı: "yüksek `shareEfficiency` bedava bir avantaj değil" ya da
"bedava bir avantaj" — **ikisi de yayınlanabilir bir bulgudur.** Üçüncü
sonuç (etkisiz) de öyle.

**Kabul kriteri:** Kendiliğinden gelen bir çerci mutasyonu (paylaşmaya katılmayan,
kaynak bağımlılığı düşük) popülasyonda **yayılabiliyorsa**, bu organizmanın
şu anki "çok hücreliliği" bir işbirliği değil, bir görsel olgu demektir.
Bu bulgu çıkarsa, `MODEL.md`'nin çok hücrelilik bölümü yeniden yazılır.

#### B4 — Programlı ayrışma (stigmergi, 3 gün)

Bağ koptuğunda hücreler dağılıyor. Bunun yerine hücrelerin bıraktığı bir
**iz alanı** (enzim/koridor) eklenecek: iz, yeni hücreler için yönlendirici
sinyal ve aynı zamanda görsel bir iz. Kolonilerin bıraktığı ağ, kullanıcıya
"bu soy bu tüneli buldu" der. `LITERATURE.md` §9.

---

### Faz C — Açık uçluluk aletleri (2 hafta, B ile paralel)

**Amaç:** "Yaşam devam ediyor" yerine ölçülebilir skorlar üretmek.

#### C1 — MODES metrikleri (4 gün)

Ölçüm tarafında **zaten var olan veriden** türetilebilir; yeni simülasyon
kodu gerekmez:

| Metrik | Nasıl |
|---|---|
| **Değişim** | Popülasyonda genetik değişim (genom mesafesi) — `genomeDistance` var |
| **Yenilik** | Daha önce görülmemiş genom/sayaç kümesi |
| **Ekoloji/çeşitlilik** | Popülasyondaki bilgi miktarı; niş sayısı |
| **Karmaşıklık** | Organizma boyutu ve yapı sayısı dağılımının entropisi |
| **Aktivite** | Birim zamanda yok olan türlerin toplam ömrü |

Bunlar HUD'da ve gözlemci raporunda **işletimsel ölçüm** etiketiyle gösterilir.

#### C2 — Gözlemci: anlatıcı + analist (5 gün)

`src/worker/evidence.ts` zaten şemalı rapor + `metricRef` doğrulaması yapıyor.
Eklenen:

1. **Analist modu:** yalnız ölçülebilir çıktı; her iddia bir `metricRef` ile
   gelmeli, gelmezse reddedilir. Bu kural **zaten kodda var** ve sadece
   analist moduna uygulanacak.
2. **Hipotez döngüsü:** koşu öncesi **sayısal tahmin**, koşu sonrası
   **uzlaştırma**. Tahmin tutmazsa sistem bunu söyler. Bu, modelin uydurmasını
   yapısal olarak engeller. `LITERATURE.md` §7.
3. **Gerçek görüntü:** şu an `imageHint` yalnız tick/kamera taşıyor.
   Görüntü gerçekten gönderilmeli — `ASAL++` tam olarak bunu yapıyor.

**Kabul kriteri:** `sourceMode: "vision-assisted"` yolu gerçek bir kareyle
çalışıyor ve geçmiş bağlamla gelecek tahmini iyileştiriyor mu? Bu, Hughes vd.'nin
**öğrenilebilirlik** ölçütünün doğrudan uygulamasıdır ve literatürde eşsiz bir
kombinasyondur: ALife + gözlemci-tabanlı ölçüm.

---

### Faz D — Arama motoru (4 hafta)

**Amaç:** 8 skalerlik bir düzeltmenin ötesine geçmek.

#### D1 — MAP-Elites yaşam haritası (1,5 hafta)

Davranış tanımlayıcıları (descriptor): organizma boyutu, hareketlilik,
duyusal menzil, trofik niş. Her hücrede en iyi birey.

Bu, üç sorunu tek hamlede çözer:
- çeşitlilik çöküşü,
- kullanıcıya görünür, keşfedilebilir bir yapı,
- deneylerin "şanslı bir soydan mı çıktı" sorusunun cevabı (harita boşsa
  evrim bir şey bulmamıştır; doluysa bulmuştur).

Arayüz: **yaşam haritası** — hangi nişler dolu, hangileri hiç dolmadı, hangi
soydan geldi. Bu, Picbreeder'ın `branching` fikrinin biyolojik karşılığıdır.

> **ÖLÇÜLDÜ — ve varsayım yanlış çıktı.** Bu faz iki kez denendi:
> arşiv (ε = 0) ölçüm olarak kuruldu ve **üründe çalışıyor** (Yaşam
> Haritası paneli). Ardından arşivin seçilime katılması (ε > 0) denendi ve
> **başarısız oldu**: dolu kutu sayısı değişmedi (p = 1,0000). Nedeni
> yapısal — üç betimleyiciden biri (**boyut**) **kalıtsal değil**, çünkü
> enjekte edilen her organizma tek hücreli doğar. MAP-Elites'in temel
> varsayımı, seçilebilir betimleyicinin **kalıtsal** olmasıdır.
> Ayrıntı: `VALIDATION.md` §6.23–6.30.
>
> **Sonuç:** "çeşitlilik çöküşü tek hamlede çözülür" bu model için geçerli
> değil. D1'in çalışmayan kısmı ancak **kalıtsal** bir betimleyici
> (genomda gerçekten var olan bir özellik) eklendikten sonra anlamlı olur.

#### D2 — Dolaylı kodlama (1,5 hafta)

Genom 8 skalerdir. Indirect encoding (CPPN benzeri) ile ağ topolojisi ve
ağırlıkları küçük bir genomban üretilebilir → karmaşıklık artışı ve
sonsuz ölçeklenebilirlik. `LITERATURE.md` §3.

**Uyarı:** Bu faz, determinizmi ve enerji muhasebesini tehdit eden en büyük
mühendislik riskidir. `thetaInherited` / `thetaLive` ayrımı bozulmamalıdır.

#### D3 — Yeni ortam önerisi (1 hafta)

Dünya, mevcut popülasyon için ne çok kolay ne çok zor olan durumları kendiliğinden
önersin (IMGEP mantığı: `LITERATURE.md` §1). Oyuncu "keşfet" düğmesine
basar → dünya zorlu bir ortam üretir. Bu, oyuncunun müdahale alanını genişletir
ve "popülasyon ne yapabiliyor" sorusunu sürekli keskinleştirir.

---

### Faz E — Uzun vade (açık uç)

Sıralama önerisi, maliyet/verim oranına göre:

| # | Konu | Gerekçe | Maliyet |
|---|---|---|---|
| E1 | **Öğrenme iyileştirme: bootstrap değeri / GAE** | Mevcut 64 adımlık yörüngü **bootstrap'sız**; bilinen yanlılık. `MODEL.md` §4 bunu zaten kabul ediyor. Analitik gradyan testi bozulmaz (avantaj skaler). | Düşük |
| E2 | **Öğrenilmiş algı: duyusal salience** | 12 özellik el yazımı. Önce onların **ağırlıklarını** öğrenmeyi/evrimleştirmeyi denemek, tam görsel girdiye atlamaktan çok daha küçük ve ölçülebilir bir adım. | Orta |
| E3 | **Hafıza: tekrarlayan ağ + kapatma deneyi** | `MODEL.md` §9 V1 planında. Kapatma deneyi zaten ABLAZYON ile aynı altyapıyı kullanır. | Orta |
| E4 | **Basit bir dünya modeli** | ⚠️ **Aşağıdaki uyarıya bakın.** | Çok yüksek |
| E5 | **MPM morfojenezisi** | Hücrelerin gerçekten deforme olması. Görsel ve duyusal devrim; fiziksel gerçeklik. | Çok yüksek |

> **E4 uyarısı — burada dürüst olmak gerekiyor.**
> Dreamer/JEPA sınıfı dünya modellerini bir tarayıcı worker'ına, 4 eylemli bir
> politikanın içine koymak, literatürün gösterdiği ölçek farkı nedeniyle
> **yüksek getirili değil**. CTM'nin dünyası zaten erişilebilir ve hızlı;
> öğrenilen bir model ölçülebilir bir avantaj vermiyorsa saf maliyettir.
> Literatürde bu problem için daha ucuz ve daha uygun yol **successor
> features / options** ve küçük bir tekrarlayan durumdur. Tavsiye: E3'te
> durun, E4'ü ancak E3'ün "hafıza gerçekten işe yarıyor" kanıtını ürettikten
> sonra tartışın.

---

## 4. Bağımlılık grafiği

```
        ┌──────────────┐
        │ Faza A       │  ölçüm tabanı — HEPSİ bunu bekler
        │ deney+mistik │
        └──────┬───────┘
               │
      ┌────────┼───────────────┐
      │        │               │
┌─────▼────┐ ┌─▼──────────┐ ┌─▼────────────┐
│ Faz B    │ │ Faz C      │ │ Faz D        │
│ ekoloji  │ │ aletler    │ │ arama motoru │
│ + geçiş  │ │ (ölçer)    │ │              │
└─────┬────┘ └──┬──────┬──┘ └─┬─────────┬──┘
      │         │      │      │         │
      └─────────┴──────┴──────┘         │
                    │                   │
              ┌─────▼───────────────────▼─────┐
              │ Faz E: algı, hafıza, fizik     │
              └────────────────────────────────┘
```

**B ve C paralel yapılabilir.** D, B ve C'yi bekler.

---

## 5. Bilinçli olarak yapılmayacaklar

Bu liste, karşılaşılabilecek en güçlü "hızlı çözüm" tuzaklarını önler.

| Yapılmayacak | Neden |
|---|---|
| Enerji dışarıdan pompalanıp koloniler canlı tutulacak | Z2'yi gizler, çözmez. Kapalı sistem iyi bir varlıktır. |
| `15/20` gibi eşikler kabul kriteri olarak korunacak | Yanlış kalibre; başarı ile şans ayrılamaz. |
| Öğrenme iyileştirmesi "görünürde daha iyi davranış" diye seçilecek | Goodhart tuzağı; Skalse vd. biçimselleştirmesi. |
| Başarısız koşular tekrar çalıştırılacak | `Empirical Design in RL`'in 11 hatasından biri. |
| Gözlemci "büyük olasılıkla evrildi" tarzı cümleler kuracak | `VALIDATION.md` §5'teki kuralın ihlali. |
| Bilinç / zekâ iddiaları | Mevcut dürüstlük kültürü; kaybedilmesi projeyi ucuzlatır. |
| Dreamer sınıfı dünya modeli (E4) | Maliyet/getiri literatürle desteklenmiyor. |
| MPM, fenomi düzelmeden | Doğru olanı yapmamak. |
| Kalabalık kontrolü için "performer hücre silmesi" | Mevcut biyolojik yoğunluk geri beslemesi çalışıyor; yapay sınama bozar. |

---

## 6. Tartışma için açık karar noktaları

Bunlar benim önerim değil, **sizin kararınız** gereken konular:

1. **Sıralama.** Faz A kaçınılmaz; ama A'dan sonra B (bilim) mi, C (ölçüm +
   gözlemci, daha görünür) mi önce gelsin? C daha hızlı görünür kazandırır,
   B daha derin.

2. **Ölçek ve hedef kitle.** CTM bir *laboratuvar mı* olacak (derinlik, doğruluk)
   yoksa bir *öğrenme aracı mı* (hız, görünürlük)? İkisi farklı önceliklendirme
   ister; ikisi birden iki kat iş demektir.

3. **Avcı.** Öğrenen bir avcıya geçmeli mi (daha ilginç biyoloji, daha büyük
   iddia yükü) yoksa tasarımcı tehdidi olarak kalmalı mı (daha temiz deney
   kontrolü)?

4. **Gözlemci.** Analist modu gerçekten koşsun mu (API maliyeti + sağlayıcı
   bağımlılığı getirir) yoksa yerel kural tabanlı ölçüm yeterli mi?

5. **E4 (dünya modeli).** Literatür bu ölçekte lehine değil. Yaşam içi dünya
   modeli fikri sizin için önemli mi — yoksa "ölçülebilir bir fayda gösteremeden
   eklemeyelim" mi diyelim?

6. **Bütçe dengesinin ölçütü ne olsun?** Bu projenin başarısı neyle ölçülecek:
   daha çok doğru davranış mı, daha çok çeşitlilik mi, daha uzun süren bir
   ekosistem mi, yoksa kullanıcının "bunu anladım" dediği an mı? Bu sorunun
   cevabı yol haritasının ağırlıklarını doğrudan değiştirir.

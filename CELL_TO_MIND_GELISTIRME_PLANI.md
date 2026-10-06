# Cell to Mind — Uygulama Planı

**Ürün:** Cell to Mind · *Life evolves. Minds emerge.* · Türkçe: *Tek hücreden öğrenen yaşama.*
**Kod:** `ctm` · **Depo:** `ctm-aserdargun-com` · **Varsayılan arayüz:** Türkçe (tam İngilizce seçenek)

Bu belge uygulama planıdır. Simülasyonun gerçekte ne yaptığı ve hangi
operasyonel tanımların kullanıldığı `docs/MODEL.md` içinde belgelenir; gerçek
test sonuçları `docs/VALIDATION.md` içinde raporlanır.

---

## 0. Doğrulanmış teknoloji kararları

Tüm sürümler canlı npm kayıt defterinden doğrulandı ve `package-lock.json`
üretildi (sabit sürümler, `^` yok).

| Paket | Sürüm | Doğrulama notu |
|---|---|---|
| `react` / `react-dom` | 19.3.0 | `@react-three/fiber@9` peer aralığı `>=19 <19.4` |
| `three` | 0.186.1 | R3F `>=0.156`, drei `>=0.159` gereksinimlerini karşılıyor |
| `@react-three/fiber` | 9.8.1 | React 19 + three uyumlu |
| `@react-three/drei` | 10.7.9 | `^9.0.0` fiber peer'ı ile uyumlu |
| `vite` | 8.3.3 | Node `>=22.12` (ortam: Node 22.23.1) |
| `@vitejs/plugin-react` | 6.1.2 | peer `vite ^8`; ek peer'lar `optional` olarak işaretli |
| `vitest` | 5.0.3 | peer `vite ^6.4 \|\| ^7 \|\| ^8` |
| `typescript` | 5.9.3 | **Bilinçli sabitleme.** `latest` olan 7.0.2 yeni native port; üç/drei geniş `.d.ts` yüzeyinde 5.9.3 daha güvenli. TS yalnızca tip denetimi için kullanılır (transpile Vite'in oxc katmanında). |
| `@playwright/test` | 1.63.0 | Gerçek tarayıcı akış testi |
| `zustand` | 5.0.15 | Worker mesajları için hafif UI durum deposu |
| Blender | 5.1.1 (yerel, `/Applications`) | Prosedürel GLB varlık üretimi; Node tip soyma ile sunucu yazıldı |

Blender'ın varlık üretimi **tamamen prosedüreldir**: hiçbir dış model indirilmez,
dolayısıyla varlık lisansı riski yoktur ve `docs/ASSETS.md` kaydı üretilir.

---

## 1. Mimari karar: simülasyonun tek yazarı worker

```
Ana iş parçacığı (React + R3F)          Dedicated Web Worker (saf TS)
─────────────────────────────          ──────────────────────────────
HUD, paneller, kamera, çizim    ◄────►  world.step() — TEK yazar
DOM olayları, seçim, komutlar  komut    kayıt/geri yükleme, dallanma
                                       (React/three bağımlılığı YOK)
```

* Her tick sonucu özel bir **Float32Array paketi** olarak kopyalanır; React
  durumuna hücre başına yazılmaz (kare başına 256 hücre → 0 React render).
* Sahne, paketi doğrudan `InstancedMesh` özniteliklerine yazar.
* Çizim katmanı hiçbir oyun kuralını değiştirmez; kuralların tek yazarı worker'dır.
* Tüm simülasyon RNG akışları tohumludur ve **ayrıdır**: `env`, `inherit`,
  `action`. Böylece A/B dallarında farklı politikalar hava/kaynak olaylarını
  kaydıramaz.

## 2. Veri akışı ve kayıt sırası

```
main ──command(seq,tick)──► worker ─► duraklatma onayı ─► kayıt(tick, seq)
worker ─frame(Float32Array + durum)──► main (yalnız okuma, paylaşılan tampon)
worker ─snapshot(JSON)─────► IndexedDB + JSON dışa/içe aktarım
```

## 3. Modüller

```
src/sim/            rng, spatial, genome, world
src/sim/biology/    cell, bonds, organism (bağ kopması → yeni organizma)
src/sim/behavior/   mlp (12-8-4), policy (REINFORCE + baseline), perception
src/sim/experiments togetherness, adaptation, learning, ablation
src/sim/persistence snapshot (sürümlü şema), validate
src/worker/         protocol, sim.worker
src/engine/         worker client, zustand store
src/scene/          habitat, cells, bonds, resources, rocks, caustics, godrays, snow
src/scene/materials hücre zarı shader'ı (MeshPhysicalMaterial + onBeforeCompile)
src/ui/             hud, hud organism list, inspector, microscope, lineage,
                    experiments, observer, save, settings, errors
src/i18n/           tr (varsayılan), en
server/             gözlemci rotası, sağlayıcı bağdaştırıcısı (API anahtarı sunucuda)
tests/              vitest birim + entegrasyon
e2e/                playwright tarayıcı akışı
docs/               MODEL, VALIDATION, PROGRESS, ASSETS
```

## 4. Yapım sırası ve her adımın çıktısı

| # | Adım | Çıktı | Doğrulama |
|---|---|---|---|
| 1 | RNG + uzamsal indeks + enerji çekirdeği | `world.step` deterministik | Enerji korunumu testi |
| 2 | Hücre, bağ, çok hücrelilik, tomurcuk, parçalanma | Kimlik/soy/nesil doğru | Bağ kopma testi |
| 3 | Genom + mutasyon + kalıtım | Soy defteri | Nesil karışmama testi |
| 4 | MLP + REINFORCE + baseline | 140 parametre, gerçek öğrenme | Sonlu fark gradyan testi |
| 5 | Algı → 12 girdi, eylem → 4 | Fizik gerçek temas kuralları | Gözlemci sızıntı testi |
| 6 | Worker + komut/kayıt/dal | Tek yazar, bağımsız dallar | Dal bağımsızlığı testi |
| 7 | 3B habitat + organik hücre shader'ı + varlıklar | Yüzen, incelenebilir sahne | FPS ölçümü |
| 8 | Mikroskop, soy defteri, deney dalları | Gerçek karar verileri | Değer eşleşme testi |
| 9 | Kanıt paketi + yerel anlatım + sunucu bağdaştırıcısı | Dürüst kaynak modu | Sahte yanıt yok testi |
| 10 | TR/EN, erişilebilirlik, kalıcılık, hata durumları | | Playwright akışı |

Her adımda çalışabilir durum korunur.

## 5. Bilinçli kapsam kararları

* **MVP kapsamında:** gerçek ANN (12→8→4), gerçek çok hücrelilik, gerçek evrim,
  gerçek gözlemci rotası (anahtarla) ve anahtarsız yerel kural özeti.
* **Belgelenmiş sonraki sürüm (boş ekran değil, plan):** görsel temsil (V1),
  tekrarlayan ağ ile hafıza (V1), dünya modeli (V2), nöroevrim (V2).
  Bu ekranlar **yapılmaz**; `docs/PROGRESS.md` içinde gerekçesiyle listelenir.
* **Avcı** öğrenen bir tür değildir; açıkça etiketlenmiş yerel seçilim baskısıdır.
* **"Zekâ seviyesi satın alınmaz"**: çok hücreli olmak gizli bonus vermez.

## 6. Riskler ve önlemler

| Risk | Önlem |
|---|---|
| 256 hücrede FPS düşer | InstancedMesh, paylaşılan geometri/malzeme, uniform grid, görünürlük kısıtı |
| React her karede yeniden render | Frame paketi; React yalnız olay anlarında güncellenir |
| Ağdan gelen "zekâ" iddiası | Boyut avantajı = daha fazla enerji havuzu **ve** daha yüksek maliyet; test bunu doğrular |
| Gözlemci uydurur | Şemalı rapor + `metricRef` doğrulama + kayıtsız olay iddiası reddi |
| Anahtar sızıntısı | Anahtar yalnız sunucu `process.env`'inde; istemci paketine `VITE_` değişkeni girmez |
# Cell to Mind — Varlık Lisans Kaydı

**İlke:** Bu depodaki **hiçbir 3B varlık indirilmemiştir.** Tüm geometri ve
dokular `scripts/blender/make_assets.py` betiğiyle **prosedürel olarak** üretilir.
Böylece varlık lisansı riski ortadan kalkar ve her varlığın kökeni
kanıtlanabilirdir.

Üretim: `npm run assets:build` (Blender 5.1.1, `-b --python` modu).

---

## Üretilen varlıklar

| Dosya | Boyut | Üretim yöntemi | İçerik |
|---|---|---|---|
| `rocks/rock_01.glb` | 38.6 KiB | fraktal gürültü ile yer değiştirilmiş ikosfer (bölme 4) + 3 uydu bloğu katıldı | Pürüzlü kaya |
| `rocks/rock_02.glb` | 38.6 KiB | aynı, farklı tohum/amp/genlik | Yuvarlak kaya |
| `rocks/rock_03.glb` | 16.6 KiB | bölme 3 (düşük poligon, uzaktan kullanılır) | Kaba kaya |
| `rocks/rock_04.glb` | 38.6 KiB | farklı tohum | Yumuşak kaya |
| `props/nodule_a.glb` | 21.5 KiB | 1 çekirdek + 5 birleşik düğüm | A kaynağı biyofilm kümesi |
| `props/nodule_b.glb` | 1.5 KiB | elle tanımlı çift piramit, 5 yüz | B kaynağı mineral kristali |
| `critters/predator.glb` | 285.6 KiB | burulmuş su damlası profili, 26×18 halk, subsurf 1 | Avcı gövdesi |
| `critters/spore.glb` | 9.3 KiB | gürültü ile yer değiştirilmiş ikosfer | Serbest spor |
| `textures/sediment_n.png` | 512² | çok ölçekli değer gürültüsü → yükseklik gradyanı → normal haritası | Zemin normal haritası |
| `textures/rock_n.png` | 512² | 3 ölçekli gürültü → normal haritası | Kaya normal haritası |

## Lisans durumu

| Varlık | Lisans | Kaynak |
|---|---|---|
| Tüm GLB'ler | **CC0 / kamu malı** (bu depoda üretilmiş) | `scripts/blender/make_assets.py` |
| Tüm PNG'ler | **CC0 / kamu malı** (bu depoda üretilmiş) | aynı betik |

## Üçüncü taraf çalışma zamanı bağımlılıkları

| Paket | Sürüm | Lisans |
|---|---|---|
| three | 0.186.1 | MIT |
| @react-three/fiber | 9.8.1 | MIT |
| @react-three/drei | 10.7.9 | MIT |
| react / react-dom | 19.3.0 | MIT |
| zustand | 5.0.15 | MIT |
| vite | 8.3.3 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| vitest | 5.0.3 | MIT |
| @playwright/test | 1.63.0 | Apache-2.0 |

**Font:** Yığın fontu kullanılır (`ui-sans-serif, system-ui, …`). Web fontu
indirilmez, dolayısıyla font lisansı sorunu yoktur.

## Ses

Bu sürümde ses yoktur. Prosedürel Web Audio katmanı planlanmış ancak
**yapılmamıştır**; `docs/PROGRESS.md` içinde not düşülmüştür. Ses eklendiğinde
kayıt buraya eklenmelidir.

## Yeniden üretim

```bash
npm run assets:build
```

Betik belirlenimci (deterministik) tohumlar kullanır (`random.Random(seed)` ve
`numpy.random.default_rng(seed)`), dolayısıyla aynı Blender sürümünde **aynı
varlıklar** yeniden üretilir. Normal haritalarının piksel değerleri `numpy`
float32 işlemleriyle hesaplandığı için Blender sürümünden bağımsız olarak aynı
çıkar.
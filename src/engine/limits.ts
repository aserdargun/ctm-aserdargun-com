/**
 * Cell to Mind — görüntüleme sınırları (tek kaynak).
 *
 * Bu modüldeki sayılar **görüntüleme tavanıdır**, simülasyon limiti
 * DEĞİLDİR. Simülasyon (worker) kareyi sınırsız boyutta gönderir; bu
 * tavanlar yalnızca arayüzün gösterebileceği miktarı sınırlar.
 *
 * ⚠️ Kırpma **sessiz** olursa arayüz ile sahne ayrışır: HUD gerçek sayıyı
 * yazar, sahne daha azını gösterir. Bu yüzden:
 *   1. Tavanlar burada **tek yerde** tanımlıdır (sahne ve HUD aynı sayıyı
 *      okur; ikisi ayrı ayrı yazılırsa ayrışırlar).
 *   2. HUD, tavan aşıldığında **görünür** bir uyarı gösterir.
 *   3. Tavanların yeterliliği `tests/caps.test.ts` içinde **ölçümle**
 *      denetlenir: simülasyon büyürse test kırmızıya döner ve tavan
 *      gözden geçirilir.
 *
 * Ölçüm (2026-10-19, `tools/measure-cell-cap.ts` ve
 * `tools/measure-list-cap.ts`, 40.000 tick):
 *   - en yüksek canlı hücre: **266** (14 senaryo) → MAX_RENDER_CELLS payı %48
 *   - en yüksek canlı organizma: **252** (9 senaryo) → ORGANISM_LIST_LIMIT payı %16
 *   - en yüksek canlı soy: **12** (7 senaryo) → LINEAGE_DISPLAY_LIMIT payı %0
 */

import { FOUNDER_LINEAGE_GROUPS } from '../sim/genome.ts';

/**
 * 3B görünümün aynı anda gösterebileceği azami hücre sayısı.
 *
 * Ölçülen sınır: 14 senaryo (5 tohum × varsayılan p=48; p=192; yüksek
 * rejenerasyon; besin ekleme; ikisinin birleşimi) → tepe 266 hücre.
 */
export const MAX_RENDER_CELLS = 512;

/**
 * Canlı listesinde gösterilecek azami kayıt sayısı.
 *
 * Ölçülen sınır: 9 senaryo (varsayılan p=48; p=192; p=192 + rejenerasyon)
 * → tepe 252 organizma.
 */
export const ORGANISM_LIST_LIMIT = 300;

/**
 * Soy defteri panelinde gösterilecek azami soy sayısı.
 *
 * ⚠️ Bu, **elle yazılmış bir sayı değil**: simülasyonun kendi kurucu soy
 * gruplama sayısından gelir (`FOUNDER_LINEAGE_GROUPS`). Simülasyon yapısal
 * olarak en fazla bu kadar soy üretir, yani bugün panel kırpmaz — ama iki
 * sayı bağımsız yazılıydı ve simülasyonun tavanı değişseydi panel
 * **sessizce** kırpmaya başlardı.
 *
 * Ölçülen sınır (19 Ekim 2026, `tools/measure-lineage-cap.ts`; 40.000 tick,
 * 7 senaryo): tepe soy sayısı **12** — hiçbir koşuda 13 olmadı.
 */
export const LINEAGE_DISPLAY_LIMIT = FOUNDER_LINEAGE_GROUPS;

/**
 * Gözlemci panelinde gösterilen azami **kanıt ölçümü** sayısı.
 *
 * Kanıt paketi bugün 14 ölçüm üretiyor (9 metrik + 5 sabit), yani 24'lük
 * sınır **bağlayıcı değil**. Yine de ölçüm sayısı büyürse tablo sessizce
 * kırpılmasın diye sınır ve **görünür** kırpma notu birlikte tanımlanır.
 */
export const OBSERVER_MEASUREMENT_LIMIT = 24;

/**
 * Gözlemci panelinde gösterilen azami **model iddiası** sayısı.
 *
 * ⚠️ Model yanıtındaki sayı sayısı **sınırsızdır** (`extractNumericClaims`
 * metindeki her sayıyı çeker), yani bu sınır gerçekten bağlayıcı olabilir.
 * O yüzden burada sessiz kırpma kabul edilmiyor: kırpma **görünür** olur.
 */
export const OBSERVER_CLAIM_LIMIT = 20;

/**
 * 3B sahnenin aynı anda gösterebileceği azami **kaynak düğümü** sayısı.
 *
 * ⚠️ Aynı sınıf, hücreler gibi: simülasyon kaynak sayısını kuruluşta belirler
 * (varsayılan 34) ve sonradan kaynak **eklemez** — `addNutrient` mevcut bir
 * düğümün rezervini doldurur, yeni düğüm yaratmaz. Yani düğüm sayısı sabittir.
 *
 * Ölçülen sınır (19 Ekim 2026): kod tabanında kullanılan en büyük
 * `resourceCount` **34** (dünya varsayılanı ve arena kalibrasyonunun üst ucu).
 * Tavan 64 → pay %47, yani bugün **bağlayıcı değil**. Yine de sayı tek yerde
 * yazılıdır ve `tests/caps.test.ts` tavanın yeterliliğini ölçer.
 */
export const MAX_RENDER_RESOURCES = 64;

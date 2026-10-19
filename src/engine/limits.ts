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
 */

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

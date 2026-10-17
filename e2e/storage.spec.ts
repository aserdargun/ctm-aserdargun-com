/**
 * IndexedDB deposu — gerçek tarayıcıda, **gerçek arayüz yoluyla**.
 *
 * ⚠️ Bu modül (`src/engine/storage.ts`) oturuma kadar **hiç test edilmedi** ve
 * `VALIDATION.md` §7.1 de "IndexedDB kaydet/yükle tarayıcıda doğrulanmadı"
 * diyordu.
 *
 * ⚠️ İlk deneme modülü `page.evaluate(() => import('/src/engine/storage.ts'))`
 * ile çağırmayı, hatta yalnız IndexedDB'yi ham IDB ile sınamayı denedi.
 * İkisi de **çalışmıyor** ve ikisinin de nedeni ayrı:
 *   · e2e `vite preview` üzerinden **üretim yapısını** sunuyor (Playwright
 *     yapılandırması bunu bilerek seçiyor); `/src/...` yolu yok.
 *   · `tsconfig` `e2e/` dizinini kapsadığı için o satır ayrıca **build'i
 *     düşürüyordu** (`tsc` hatası → `npm run build` → webServer exit 2).
 * Bu yüzden test **kullanıcının gerçekten yaptığı yolu** sürüyor: HUD'daki
 * "Kayıt" düğmesi → panelde "IndexedDB'ye kaydet" → listede kayıt görünüyor.
 * Doğrulama ise React durumu değil **ham IndexedDB** üzerinden yapılıyor; yani
 * kayıt gerçekten diske yazılmış mı, yoksa yalnız arayüzde mi görünüyor.
 *
 * Bulunan ve düzeltilen iki hata:
 *  1. `tx()` bağlantıyı yalnız `oncomplete`'te kapatıyordu; **iptal edilen**
 *     işlemde `oncomplete` tetiklenmediği için bağlantı sızıntısı oluşuyordu.
 *  2. `pickJsonFile()` kullanıcı pencereyi iptal ederse **hiç çözülmüyordu**
 *     (`oncancel` yoktu) — `await` sonsuza dek asılı kalıyordu.
 */

import { expect, test, type Page } from '@playwright/test'

const DATA_PANEL = 'Kayıt'
const SAVE = "IndexedDB'ye kaydet"
const EMPTY = 'Henüz kayıt yok.'

async function openDataPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: DATA_PANEL, exact: true }).click()
  await expect(page.getByRole('button', { name: SAVE, exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

/** Ham IndexedDB — uygulama koduna dokunmadan gerçek disk durumu. */
async function rawIds(page: Page): Promise<{ ids: string[]; labels: string[]; ticks: number[] }> {
  return page.evaluate(
    () =>
      new Promise<{ ids: string[]; labels: string[]; ticks: number[] }>((resolve, reject) => {
        const req = indexedDB.open('ctm-records')
        req.onsuccess = () => {
          const db = req.result
          try {
            const store = db.transaction('sessions', 'readonly').objectStore('sessions')
            const all = store.getAll()
            all.onsuccess = () => {
              const rows = all.result as { id: string; label: string; tick: number }[]
              resolve({
                ids: rows.map((r) => r.id).sort(),
                labels: rows.map((r) => r.label).sort(),
                ticks: rows.map((r) => r.tick),
              })
              db.close()
            }
          } catch (e) {
            db.close()
            reject(e as Error)
          }
        }
        req.onerror = () => reject(new Error('IndexedDB açılamadı'))
      }),
  )
}

/**
 * Kayıt listesinin satırları.
 *
 * ⚠️ `.panel ul li` **çok geniş** bir seçici: panelde kayıt listesi dışında da
 * `<ul><li>` var ve ilk denemede 54 satır sayıldı. Kayıt satırlarını
 * ayırt eden şey **silme düğmesi**; yalnız o satırlarda bulunur.
 */
function recordRows(page: Page) {
  return page.locator('.panel ul li').filter({
    has: page.locator('button', { hasText: '×' }),
  })
}

test.describe('IndexedDB kayıt deposu', () => {
  test('kaydet → listede görünür → ham IndexedDB\'de gerçekten var → sil', async ({ page }) => {
    await page.goto('/')
    await openDataPanel(page)

    // Depo boştan başlıyor: önceki koşulardan kalan kayıtları temizle.
    await page.evaluate(async () => {
      const req = indexedDB.open('ctm-records')
      await new Promise<void>((ok, ko) => {
        req.onsuccess = () => {
          const db = req.result
          const t = db.transaction('sessions', 'readwrite')
          t.objectStore('sessions').clear()
          t.oncomplete = () => { db.close(); ok() }
          t.onerror = () => { db.close(); ko(new Error('temizlenemedi')) }
        }
        req.onerror = () => ko(new Error('açılamadı'))
      })
    })
    await page.reload()
    await openDataPanel(page)
    await expect(page.getByText(EMPTY)).toBeVisible()

    await page.getByRole('button', { name: SAVE, exact: true }).click()

    // Panelde kayıt listelenmeli.
    const item = recordRows(page).first()
    await expect(item).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(EMPTY)).toBeHidden()

    // ...ve gerçekten IndexedDB'ye yazılmış olmalı.
    const written = await rawIds(page)
    expect(written.ids.length).toBe(1)
    expect(written.ticks[0]).toBeGreaterThan(0)

    // Silme: listeden düşer ve diskte de kalmaz.
    await page.locator('.panel ul li button', { hasText: '×' }).first().click()
    await expect(page.getByText(EMPTY)).toBeVisible({ timeout: 15_000 })
    expect((await rawIds(page)).ids).toEqual([])
  })

  test('ardışık kayıtlar sıralı çalışır ve her biri diske yazılır', async ({ page }) => {
    // ⚠️ **KAPSAM SINIRI — dürüst olmak için açıkça yazılıyor.**
    // Bu test, `tx()` bağlantı sızıntısı düzeltmesini **kanıtlamaz**.
    // Başarılı işlemlerde `oncomplete` de ateşlediği için düzeltme geri
    // alınsa da bu test yeşil kalır. Sızıntı yalnız **iptal edilen**
    // işlemlerde görünür (kota, kısıt) ve tarayıcıda güvenilir biçimde
    // tetiklemek pahalı (yüzlerce MB yazmak gerekir) — bu yüzden yapılmadı.
    // Düzeltmenin dayanağı IDB işlem kuralıdır: bir işlem tam olarak biri —
    // `complete`, `abort`, `error` — tetikler, üçü birden asla.
    // Gerçek kanıt: `docs/VALIDATION.md` §10, 49. kayıt.
    await page.goto('/')
    await openDataPanel(page)

    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: SAVE, exact: true }).click()
      await expect(recordRows(page)).toHaveCount(i + 1, { timeout: 15_000 })
    }
    const stored = await rawIds(page)
    expect(stored.ids.length).toBe(6)
  })

  test('dosya seçme iptal yolu bağlı: pickJsonFile bir `oncancel` dinleyicisi kurar', async ({ page }) => {
    await page.goto('/')
    await openDataPanel(page)

    // Gerçek dosya penceresini Playwright açamaz; onun yerine **iptalin
    // kendisini** ölçüyoruz: `pickJsonFile`'ın yarattığı girişte `oncancel`
    // dinleyicisi var mı? Yoksa kullanıcı iptal ettiğinde söz hiç çözülmez.
    // Düzeltme öncesi bu değer `null` idi.
    const hasCancelHandler = await page.evaluate(async () => {
      const seen: HTMLInputElement[] = []
      const realCreate = document.createElement.bind(document)
      document.createElement = ((tag: string) => {
        const el = realCreate(tag)
        if (tag === 'input') seen.push(el as HTMLInputElement)
        return el
      }) as typeof document.createElement
      const realClick = HTMLInputElement.prototype.click
      // Dosya seçilmiyor — iptal edildi.
      HTMLInputElement.prototype.click = function patched(this: HTMLInputElement) {
        queueMicrotask(() => this.dispatchEvent(new Event('cancel')))
      }
      try {
        // "İçe aktar" düğmesi `pickJsonFile()` çağırır.
        const btn = [...document.querySelectorAll('button')].find((b) =>
          (b.textContent ?? '').includes('içe aktar'),
        )
        btn?.click()
        await new Promise((r) => setTimeout(r, 300))
        return seen.length > 0 && typeof seen[0]?.oncancel === 'function'
      } finally {
        document.createElement = realCreate
        HTMLInputElement.prototype.click = realClick
      }
    })

    expect(hasCancelHandler).toBe(true)
  })
})
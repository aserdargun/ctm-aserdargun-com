/**
 * Olay Günlüğü paneli — gerçek tarayıcıda.
 *
 * ⚠️ Bu panel 8 panelden biriydi ve **hiçbir test onu açmıyordu**. İncelendiğinde
 * "Temizle" düğmesinin **kalıcı bir etkisi olmadığı** görüldü: düğme yalnız
 * istemci deposunu sıfırlıyordu, oysa günlüğün sahibi worker'dı (`w.events`)
 * ve panel 1.200 ms'de bir yoklama yapıyordu. Kullanıcı "temizlendi" görüyor,
 * ~1,2 saniye sonra liste **doluydu** geri dönüyordu.
 *
 * Aynı sınıf hata: "Kaydet" düğmesi (bkz. `storage.spec.ts`) görünür bir iz
 * bırakmıyordu. Burada düğmenin söylediği şeyi yapması worker'a taşındı
 * (`clearEvents` komutu) ve **yoklamadan sonra da boş kaldığı** kanıtlanıyor.
 */

import { expect, test } from '@playwright/test'

const PANEL = 'Olay Günlüğü'
const CLEAR = 'Temizle'

test.describe('Olay Günlüğü paneli', () => {
  test('"Temizle" kalıcıdır: yoklama döngüsünden sonra liste geri gelmez', async ({ page }) => {
    await page.goto('/')
    // Dünya kurulsun; olay üretilsin (genesis olayı oluşturma anında doğar).
    await expect(page.locator('[aria-label="Canlılar"]').first()).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: PANEL, exact: true }).click()
    const list = page.locator('[aria-label="Olay günlüğü"]')
    await expect(list).toBeVisible({ timeout: 15_000 })

    // Liste gerçekten dolu olsun — aksi hâlde "boş kaldı" iddiası anlamsız olur.
    const items = list.locator('.events__item')
    await expect(items.first()).toBeVisible({ timeout: 20_000 })
    const before = await items.count()
    expect(before, 'olay listesi hiç dolmadı — test anlamsız kalır').toBeGreaterThan(0)

    await page.getByRole('button', { name: CLEAR, exact: true }).click()
    await expect(items).toHaveCount(0)

    // ⚠️ **Asıl kanıt.** Panel 1.200 ms'de bir yoklama yapar. Düzeltme öncesi
    // günlük worker'da durduğu için liste bu noktada **yeniden doluyordu**.
    // Bekleme penceresi yoklamayı en az iki kez kapsayacak kadar geniş.
    await page.waitForTimeout(3_000)
    await expect(items).toHaveCount(0)

    // Sayaç da sıfırlanmış olmalı (totalKnown worker'dan gelir).
    await expect(list).toContainText('0 / 0')
  })

  test('yeni olaylar temizlikten sonra da akmaya devam eder', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[aria-label="Canlılar"]').first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: PANEL, exact: true }).click()
    const list = page.locator('[aria-label="Olay günlüğü"]')
    await expect(list).toBeVisible({ timeout: 15_000 })
    const items = list.locator('.events__item')
    await expect(items.first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: CLEAR, exact: true }).click()
    await expect(items).toHaveCount(0)

    // Temizlik **sunucu tarafı bir sıfırlama**, simülasyonu durdurmuyor:
    // yeni olaylar üretilmeye ve kayda geçmeye devam etmeli.
    await expect
      .poll(async () => (await items.count()) > 0, { timeout: 30_000, intervals: [500] })
      .toBe(true)
  })
})
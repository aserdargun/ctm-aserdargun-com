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
 * (`clearEvents`) ve **yarış** da kapatıldı (monoton `seq`).
 *
 * ⚠️⚠️ İlk test sürümü **yanlış bir şey** vaat ediyordu: temizlikten sonra
 * "liste hep boş kalır" dedi. Ürün böyle davranmamalı — temizlik simülasyonu
 * **durdurmaz**, yeni olaylar akmaya devam eder. Yerelde geçti, CI'da
 * (daha hızlı koşu) 3 saniyede 26 yeni olay birikti ve test kırıldı.
 * Doğru iddia: **temizlikten ÖNCEKİ kayıtlar geri gelmemeli**.
 */

import { expect, test } from '@playwright/test'

const PANEL = 'Olay Günlüğü'
const CLEAR = 'Temizle'

/**
 * Simülasyonu **durdurur**.
 *
 * ⚠️ Ölçümü olay üretim hızından bağımsız yapmanın tek yolu. Çalışırken
 * sayaç sürekli büyüdüğü için "temizlikten sonra azaldı" iddiası hıza
 * bağlıydı: yerelde geçiyordu, CI'da 47 → 74 ile **kırılıyordu** — ürün
 * doğru çalışıyor, ölçüm yanlıştı.
 */
async function pauseSim(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Duraklat', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Devam', exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

async function openEvents(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('[aria-label="Canlılar"]').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: PANEL, exact: true }).click()
  const list = page.locator('[aria-label="Olay günlüğü"]')
  await expect(list).toBeVisible({ timeout: 15_000 })
  const items = list.locator('.events__item')
  await expect(items.first()).toBeVisible({ timeout: 20_000 })
  return { list, items }
}

test.describe('Olay Günlüğü paneli', () => {
  test('"Temizle" günlüğü gerçekten siliyor (yalnız arayüzü değil)', async ({ page }) => {
    const { list, items } = await openEvents(page)

    // ⚠️ Ayrım edici ölçüm **"gösterilen / bilinen"** sayacının paydası.
    // `eventsTotal` worker'dan gelir (`w.events.size`); düğme yalnız arayüzü
    // sıfırlarsa bu sayı **düşmez** ve olaylar akmaya devam eder.
    //
    // ⚠️ "Eski kayıtlar görünmüyor" iddiası **ayırt edici DEĞİL**: hızlı
    // koşuda iki yoklama arasında yüzlerce olay üretiliyor ve panel yalnız son
    // 120'yi çizdiği için eski kayıt **kayıp gidiyor**. Ölçen bu test, iki
    // mutasyonda da yeşil kaldı — yani hiçbir şey kanıtlamıyordu.
    const total = async (): Promise<number> =>
      Number((await list.innerText()).match(/\/\s*(\d+)/)?.[1] ?? -1);

    await expect(items.first()).toBeVisible()
    // Duraklatmadan **önce** birkaç olay biriksın: marj 1'e düşerse
    // "temizlik kalıcı değil: 1 → 1" gibi okunması zor bir kanıt kalıyor.
    await expect
      .poll(total, { timeout: 40_000, intervals: [500] })
      .toBeGreaterThanOrEqual(10)
    await pauseSim(page)

    // Duraklatılmış halkta sayı sabittir; birkaç yoklama sonra doğruluyoruz.
    await page.waitForTimeout(2_500);
    const before = await total()
    expect(before, 'olay sayacı okunamadı — test anlamsız kalır').toBeGreaterThan(0)

    await page.getByRole('button', { name: CLEAR, exact: true }).click()

    // Duraklatılmış simülasyonda **hiçbir yeni olay üretilmez**, dolayısıyla
    // temizlikten sonra sayaç 0'da kalmalı. Düğme yalnız arayüzü sıfırlıyor
    // olsaydı yoklama 1,2 sn içinde `w.events.size`'i geri getirirdi.
    await page.waitForTimeout(4_000);
    const after = await total();
    expect(after, `temizlik kalıcı değil: ${before} → ${after}`).toBe(0);
  })

  test('temizlik simülasyonu durdurmuyor: yeni olaylar akmaya devam eder', async ({ page }) => {
    const { list, items } = await openEvents(page)
    const total = async (): Promise<number> =>
      Number((await list.innerText()).match(/\/\s*(\d+)/)?.[1] ?? -1);

    // ⚠️ Bu test **simülasyonu durdurmuyor** — durdurmadığı için sayaç
    // karşılaştırması hıza bağlı olurdu (CI'da temizlikten sonra 4 sn'de
    // 47 → 74 büyüdü ve test kırıldı, ürün doğruydu). Buradaki iddia yalnız
    // şu: temizlik bir **sıfırlamadır**, akışı durdurmaz. Sayaç düşüşünün
    // ölçüldüğü yer 1. testtir ve orada simülasyon duraklatıldığı için
    // tamamen belirlenimcidir.
    await expect.poll(total, { timeout: 40_000, intervals: [500] }).toBeGreaterThan(0)

    await page.getByRole('button', { name: CLEAR, exact: true }).click()

    // Yeni olaylar üretilmeye ve **kayda geçmeye** devam etmeli.
    await expect.poll(total, { timeout: 40_000, intervals: [500] }).toBeGreaterThan(0)
    await expect(items.first()).toBeVisible({ timeout: 20_000 })
  })
})

/**
 * Cell to Mind — uçtan uca tarayıcı testleri.
 *
 * Bu testler, geliştirme sırasında **elle** yapılan doğrulamaları tekrar
 * edilebilir hâle getirir. Elle tarayıcı doğrulaması bu projede iki kez
 * güvenilmez çıktı: sekme bayatladı (ölü alet) ve konsol okunamadı. Test,
 * kanıtı dosyaya bırakır.
 *
 * Kapsam — yalnız **ölçülebilir** olanlar:
 *  - uygulama açılıyor, dünya kuruluyor, tick ilerliyor
 *  - enerji muhasebesi korunuyor
 *  - HUD düğmeleri panelleri açıyor
 *  - Yaşam Haritası paneli kutuları dolduruyor ve eksen uyarısını doğru veriyor
 *  - konsol hatası yok
 *
 * Kasıtlı **kapsam dışı**: model çağrısı (anahtar gerekir), WebGL sahne
 * içeriği, FPS. Bunlar ölçülmediği için test edilmiş gibi yazılmaz.
 */

import { expect, test, type Page } from '@playwright/test'

function collectConsoleProblems(page: Page): string[] {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
  })
  return problems
}

/**
 * HUD'dan bir sayı okur.
 *
 * ⚠️ İki tuzak var ve ikisi de ölçülerek bulundu:
 *
 *  1. **Tipografik eksi.** HUD negatif işareti ASCII `-` değil, U+2212
 *     (`−`) olarak basıyor: `s.energyResidual >= 0 ? '' : '−'`. Regex
 *     yalnız `-` kabul ederse "−0,003 e" satırı **hiç eşleşmez** ve yoksa
 *     dönen test sessizce bekler.
 *  2. **Türkçe sayı biçimi.** `fmt()` ondalık için virgül, binlik için nokta
 *     kullanıyor: `0,003` ve `109.550`. Her ikisi de ayrıştırılmalı.
 */
function parseHudNumber(text: string, label: string): number | null {
  const m = text.match(new RegExp(`${label}\\s+(−|-)?([\\d.,]+)`));
  if (!m) return null;
  const raw = m[2]!.replace(/\./g, '').replace(',', '.');
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return m[1] ? -value : value;
}

/**
 * Dünyanın kurulmasını ve canlı listesinin dolmasını bekler.
 *
 * ⚠️ `text=CANLILAR` **çalışmıyor** ve ölçülerek bulundu: HUD'da
 * `text-transform: uppercase` uygulanıyor, yani DOM'daki kaynak metin
 * "Canlılar" ama **görüntülenen** metin "CANLILAR". `innerText` dönüşümü
 * yansıtır, `textContent` yansıtmaz; Playwright kaynak metne göre eşleştirir.
 *
 * Burada kullanıcının gördüğü değil **DOM'da gerçekten bulunan** ölçüt
 * kullanılıyor: `aria-label`. Yanlışlıkla yazılan büyük harfli seçici,
 * uygulama sağlıklıyken bile testi düşürüyordu — yani **ölü bir test**.
 */
async function waitForWorld(page: Page): Promise<void> {
  await expect(page.locator('[aria-label="Canlılar"]').first()).toBeVisible({ timeout: 30_000 })
  await expect
    .poll(
      async () => {
        const txt = await page.locator('[aria-label="Canlılar"]').first().innerText()
        return Number(txt.match(/CANLILAR\s+(\d+)/)?.[1] ?? 0)
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0)
}

/**
 * HUD'daki muhasebe farkının mutlak değerini verir (e).
 *
 * ⚠️ HUD verisi **kenar çubuğunda değil**, üstteki banner'da. Kenar çubuğu
 * yalnız CANLILAR/KİMLİK/SOY/… ve organizma satırlarını taşır; TİCK ve
 * MUHASEBE FARKI orada **bulunmaz**. Yanlış öğe okuyan test, uygulama
 * sağlıklıyken de sessizce `null` döner ve bekler.
 */
async function residualOf(page: Page): Promise<number | null> {
  const txt = await page.evaluate(() => document.body.innerText)
  const v = parseHudNumber(txt, 'MUHASEBE FARKI')
  return v === null ? null : Math.abs(v)
}

/** HUD'daki tick değerini verir. */
async function tickOf(page: Page): Promise<number> {
  const txt = await page.evaluate(() => document.body.innerText)
  return parseHudNumber(txt, 'TİCK') ?? 0
}

/** HUD'daki bir panel düğmesine tıklar ve panelin açılmasını bekler. */
async function openPanel(page: Page, label: string, ariaLabel: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
  await expect(page.locator(`[aria-label="${ariaLabel}"]`)).toBeVisible({ timeout: 15_000 })
}

test.describe('temel akış', () => {
  test('dünya kurulur, tick ilerler ve konsol temiz kalır', async ({ page }) => {
    const problems = collectConsoleProblems(page)
    await page.goto('/')
    await waitForWorld(page)

    // Tick artıyor mu? İki ölçüm arası artmalı.
    const before = await tickOf(page)
    await expect
      .poll(async () => (await tickOf(page)) > before, { timeout: 30_000 })
      .toBe(true)

    expect(problems, `konsol sorunları:\n${problems.join('\n')}`).toEqual([])
  })

  test('enerji muhasebesi korunuyor', async ({ page }) => {
    await page.goto('/')
    await waitForWorld(page)

    await expect.poll(() => residualOf(page), { timeout: 30_000 }).toBeLessThan(1)
  })
})

test.describe('yaşam haritası paneli', () => {
  test('ızgara doluyor ve kutular sayı gösteriyor', async ({ page }) => {
    const problems = collectConsoleProblems(page)
    await page.goto('/')
    await waitForWorld(page)
    await openPanel(page, 'Yaşam Haritası', 'Yaşam haritası')

    // Gözlem sayısı artmalı: panel gerçekten ölçüyor.
    await expect
      .poll(
        async () => {
          const txt = await page.locator('[aria-label="Yaşam haritası"]').innerText()
          const m = txt.match(/([\d.]+)\s*gözlem/)
          return m ? Number(m[1]!.replace(/\./g, '')) : 0
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0)

    // Dolu kutu sayısı en az 1 olmalı.
    await expect
      .poll(
        async () => {
          const txt = await page.locator('[aria-label="Yaşam haritası"]').innerText()
          const m = txt.match(/(\d+)\/27 kutu/)
          return m ? Number(m[1]) : 0
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0)

    // Panel, denenen ve başarısız yolu saklamıyor.
    await expect(page.locator('[aria-label="Yaşam haritası"]')).toContainText('işe yaramadı')

    expect(problems, `konsol sorunları:\n${problems.join('\n')}`).toEqual([])
  })

  test('denetleyici yanlış pozitif üretmiyor: enerji hesabı bozulmuyor', async ({ page }) => {
    await page.goto('/')
    await waitForWorld(page)
    await openPanel(page, 'Yaşam Haritası', 'Yaşam haritası')
    // Panel açıkken de muhasebe farkı korunmalı (yalnız ölçüm iddiası).
    await expect.poll(() => residualOf(page), { timeout: 30_000 }).toBeLessThan(1)
  })
})

test.describe('diğer paneller', () => {
  test('Evrim Atölyesi açılıyor ve "çalışıyor" diye yalan söylemiyor', async ({ page }) => {
    await page.goto('/')
    await waitForWorld(page)
    await openPanel(page, 'Evrim Atölyesi', 'Evrim Atölyesi')
    // Canlı seçilmeden arama düğmeleri devre dışı olmalı.
    await expect(page.getByRole('button', { name: /Yalnız dene/ })).toBeDisabled()
  })

  test('Gözlemci paneli yerel kural özetini üretiyor', async ({ page }) => {
    await page.goto('/')
    await waitForWorld(page)
    await openPanel(page, 'AI Gözlemci', 'İnceleme')
    await page.getByRole('button', { name: 'Bana anlat', exact: true }).click()
    // API anahtarı yokken dürüstçe yerel özet yazmalı.
    await expect(page.locator('[aria-label="İnceleme"]')).toContainText('Yerel kural özeti', {
      timeout: 20_000,
    })
  })
})
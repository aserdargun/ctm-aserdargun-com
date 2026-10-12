/**
 * Cell to Mind — Playwright yapılandırması.
 *
 * ⚠️ Bu dosya olmadan `npm run e2e` **çalışmıyordu**: yapılandırma
 * bulunmadığı için Playwright `tests/` dizinini tarıyor, vitest dosyalarını
 * yüklemeye çalışıyor ve "No tests found" ile exit 1 veriyordu. Betik
 * `package.json`'da **tanımlıydı** — yani projenin kendi "yazıldı ≠ çalışıyor"
 * tuzağı.
 *
 * `testDir: './e2e'` tarama alanını açıkça ayırır: vitest `tests/`,
 * Playwright `e2e/`.
 */

import { defineConfig, devices } from '@playwright/test'

const requestedPort = process.env.CTM_E2E_PORT ?? '4173'
const e2ePort = Number(requestedPort)

if (!Number.isInteger(e2ePort) || e2ePort < 1024 || e2ePort > 65535) {
  throw new Error(`CTM_E2E_PORT must be an integer between 1024 and 65535; received ${requestedPort}`)
}

const baseURL = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    // WebGL sahne açılır; yazılım rasterleştirici CI'da yeterli olur.
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  // Üretim yapısı üzerinden çalışır: **preview**, geliştirme sunucusu değil.
  //
  // ⚠️ İlk denemede `npm exec vite --` kullanıldı; bu **dev sunucusunu**
  // başlatır ve kaynak modülleri anında dönüştürür. Testin konusu olan şey
  // (derlenmiş paket, gerçek worker çözümlemesi, gerçek asset yolları)
  // o zaman test edilmiyor. `vite preview` `dist/` klasörünü sunar.
  webServer: {
    command: `npm run build && npm exec vite -- preview --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    timeout: 180_000,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
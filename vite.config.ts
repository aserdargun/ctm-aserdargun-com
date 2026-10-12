import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cell to Mind — Vite yapılandırması.
// Not: simülasyon çekirdeği Dedicated Web Worker içinde çalışır; worker'ı ES
// modülü olarak yayınlamak için `worker.format: 'es'` zorunludur.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // GLB varlıkları `public/` altından kopyalanır, importer gerekmez.
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5183,
    strictPort: true,
    proxy: {
      // Gözlemci sunucu rotası: API anahtarı yalnızca sunucu ortamında okunur.
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    // Gözlemci rotası **yalnız** geliştirme sunucusunda proxy'leniyordu.
    // Üretim yapısı (`npm run build` + `preview`) statik dosya sunar ve
    // `/api/observer` isteği 502 alıyordu — yani gözlemci panelindeki dil
    // modeli yolu **yapılandırma dışında hiçbir yerde erişilemezdi**.
    // Aynı proxy buraya da ekleniyor; gerçek anahtar olmadan da
    // "anahtar yok" yolunun uçtan uca çalıştığı doğrulanabiliyor.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
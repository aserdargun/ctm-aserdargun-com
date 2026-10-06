import { defineConfig } from 'vitest/config';

// Simülasyon çekirdeği saf TypeScript'tir ve tarayıcıya bağımlı değildir;
// bu yüzden birim/integrasyon testleri node ortamında koşar.
// `environmentMatchGlobs` yerine tek ortam kullanıyoruz: IndexedDB testleri
// `fake-indexeddb` ile açıkça yüklenir, DOM'a ihtiyaç yoktur.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'threads',
  },
});
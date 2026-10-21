/**
 * Ölçüm: arayüzde **Türkçe sabit metin** kalmış mı?
 *
 * ⚠️ Dil değiştirme özelliği var (i18n sözlüğü tr/en). Ama bazı bileşenler
 * kendi Türkçe sözlüklerini bileşen içinde tutuyordu — dil İngilizce'ye geçtiğinde
 * o metinler Türkçe kalıyordu.
 *
 * ÖLÇÜLDÜ (19 Ekim 2026): 42 adet Türkçe sabit metin vardı — 30'u gözlemci
 * panelinin **tüm** bilimsel çıktısında, 12'si bileşenlerde. Sonradan
 * `{muted ? 'Açık' : 'Kapalı'}` gibi **tek taraflı** üçlü ifadeler de bulundu:
 * satırda hem `?` hem `:` olduğu için ilk sürüm bunları "iki dilli" sayıp
 * **kaçırdı**. Bu sürüm ikiliyi doğrudan karşılaştırıyor.
 *
 * Bu bir ölçüm aracıdır; yalnızca sayı üretir.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const files: string[] = [];
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir)) {
    const rel = join(dir, entry);
    if (statSync(resolve(ROOT, rel)).isDirectory()) walk(rel);
    else if (/\.tsx?$/.test(entry)) files.push(rel);
  }
};
walk('src/ui');
files.push('src/App.tsx', 'src/worker/evidence.ts');

/** Türkçeye özgü karakter içeren bir dizge. */
const TR = /[ğüşıİç]/;

/** Yorumları temizle: satır yorumları ve blok yorumları (JSX yorumları dâhil). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const offenders: string[] = [];
for (const rel of [...new Set(files)]) {
  const src = stripComments(readFileSync(resolve(ROOT, rel), 'utf8'));
  const lineOf = (index: number): number => src.slice(0, index).split('\n').length;
  // ⚠️ Tüm dosya **tek seferde** taranır: üçlü ifadeler çok satırlı
  // olabiliyor ("tr\n ? 'Türkçe'\n : 'English'") ve satır satır tarama
  // karşı dalı göremiyordu — böylece **zaten iki dilli** metinleri
  // "Türkçe sabit" diye **yanlış** raporluyordu.
  for (const m of src.matchAll(/(['"`])((?:(?!\1).)*)\1/g)) {
    const text = m[2] as string;
    if (text.length < 3 || !TR.test(text)) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    // **İki dilli** üçlü: bu dizgeden sonra ` : ` geliyor ve karşı dal
    // Türkçe DEĞİLSE bu dizge zaten iki dillidir.
    const alt = /^\s*:\s*(['"`])((?:(?!\1).)*)\1/.exec(src.slice(end));
    if (alt) {
      const other = alt[2] as string;
      if (!TR.test(other)) continue; // karşı dal Türkçe değil → iki dilli
      offenders.push(`${rel}:${lineOf(start)}  ${text.slice(0, 55)}  ↔  ${other.slice(0, 35)}`);
      continue;
    }
    offenders.push(`${rel}:${lineOf(start)}  ${text.slice(0, 70)}`);
  }
}

console.log(`Türkçe sabit metin sayısı: ${offenders.length}`);
for (const o of offenders) console.log('  ' + o);
if (offenders.length > 0) process.exitCode = 1;

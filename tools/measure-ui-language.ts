/**
 * Ölçüm: arayüzde **Türkçe sabit metin** kalmış mı?
 *
 * ⚠️ Dil değiştirme özelliği var (i18n sözlüğü tr/en). Ama bazı bileşenler
 * kendi Türkçe sözlüklerini bileşen içinde tutuyordu — dil İngilizce'ye
 * geçtiğinde o metinler Türkçe kalıyordu. Bu araç o sınıfı bulur.
 *
 * ÖLÇÜLDÜ (19 Ekim 2026): 42 adet Türkçe sabit metin vardı — 30'u gözlemci
 * panelinin **tüm** bilimsel çıktısında, 12'si bileşenlerde.
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
  src.split('\n').forEach((line, i) => {
    if (/^\s*import\s/.test(line)) return;
    for (const m of line.matchAll(/(['"`])([^'"`]*)\1/g)) {
      const text = m[2] as string;
      if (text.length < 3) continue;
      if (!TR.test(text)) continue;
      // İki dilliyse (tr ? ... : ...) sorun değil.
      if (line.includes('?') && line.includes(':')) continue;
      offenders.push(`${rel}:${i + 1}  ${text.slice(0, 70)}`);
    }
  });
}

console.log(`Türkçe sabit metin sayısı: ${offenders.length}`);
for (const o of offenders) console.log('  ' + o);
if (offenders.length > 0) process.exitCode = 1;

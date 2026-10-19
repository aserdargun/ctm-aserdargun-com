/**
 * Yardımcı: test sayılarını kaynaktan okuyup anlatı belgelerine yazar.
 *
 * Neden ayrı bir araç: README ve PROGRESS'teki sayılar elle yazıldığında
 * bayatlıyor (bu işte iki kez oldu). Denetim zaten sayıyı kaynaktan
 * türetiyor; bu araç aynı türetmeyi **belgeye** yazar.
 *
 * Kullanım: node tools/sync-test-counts.mjs
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

let unit = 0;
let unitFiles = 0;
for (const f of readdirSync(join(ROOT, 'tests'))) {
  if (!f.endsWith('.test.ts')) continue;
  unitFiles++;
  const src = readFileSync(join(ROOT, 'tests', f), 'utf8');
  unit += (src.match(/^\s*it\(/gm) ?? []).length;
}

let e2e = 0;
for (const f of readdirSync(join(ROOT, 'e2e'))) {
  if (!f.endsWith('.spec.ts')) continue;
  const src = readFileSync(join(ROOT, 'e2e', f), 'utf8');
  e2e += (src.match(/^\s*test\(/gm) ?? []).length;
}

const readmePath = join(ROOT, 'README.md');
let readme = readFileSync(readmePath, 'utf8');
readme = readme.replace(/Vitest — \d+ test/, `Vitest — ${unit} test`);
readme = readme.replace(/tip denetimi \+ \d+ birim/, `tip denetimi + ${unit} birim`);
readme = readme.replace(/\d+ tarayıcı testi \(üretim/, `${e2e} tarayıcı testi (üretim`);
readme = readme.replace(/testi \+ \d+ tarayıcı testi/, `testi + ${e2e} tarayıcı testi`);
writeFileSync(readmePath, readme);

const progressPath = join(ROOT, 'docs/PROGRESS.md');
let progress = readFileSync(progressPath, 'utf8');
progress = progress.replace(/\d+ test, \d+ dosya/, `${unit} test, ${unitFiles} dosya`);
writeFileSync(progressPath, progress);

console.log(`birim: ${unit} test / ${unitFiles} dosya · e2e: ${e2e} test`);
console.log('README ve PROGRESS.md güncellendi');

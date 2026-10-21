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

// `VALIDATION.md` §1 — projenin **kendi test paketini** anlatan bölüm.
// ⚠️ Buradaki sayılar elle yazılmıştı ve 145 test bayatlamıştı
// ("Test Files 4 passed (4) / Tests 151 passed (151)").
const validationPath = join(ROOT, 'docs/VALIDATION.md');
let validation = readFileSync(validationPath, 'utf8');
const before = validation;
validation = validation.replace(
  /(## 1\. [\s\S]*?```\n)Test Files\s+\d+ passed \(\d+\)\n(\s*)Tests\s+\d+ passed \(\d+\)/,
  (_m, head, indent) => `${head}Test Files  ${unitFiles} passed (${unitFiles})\n${indent}Tests  ${unit} passed (${unit})`,
);
// §1.x alt başlıklarındaki dosya bazlı sayılar.
validation = validation.replace(
  /(`tests\/([\w.]+)`, )\d+( test)/g,
  (m, prefix, file, suffix) => {
    const src = readFileSync(join(ROOT, 'tests', file), 'utf8');
    const n = (src.match(/^\s*it\(/gm) ?? []).length;
    return `${prefix}${n}${suffix}`;
  },
);
if (validation !== before) writeFileSync(validationPath, validation);

// README'nin "N bölüm, M koşu" iddiası **rapordan** türer. Bu sayı elle
// yazılmıştı ve rapor yeni bölüm aldığında sessizce bayatlıyordu.
const reportPath = join(ROOT, 'docs/EXPERIMENTS.md');
const report = readFileSync(reportPath, 'utf8');
const reportSections = (report.match(/^## /gm) ?? []).length;
const reportRuns = report.match(/\*\*Toplam koşu:\*\* (\d+)/)?.[1];
if (reportSections > 0 && reportRuns) {
  const runsTr = Number(reportRuns).toLocaleString('tr-TR');
  const before2 = readme;
  readme = readme.replace(
    /(\d+) bölüm, (\d[\d.]*) koşu/g,
    (_m, _s, _r) => `${reportSections} bölüm, ${runsTr} koşu`,
  );
  readme = readme.replace(
    /\((\d[\d.]*) koşu, (\d+) bölüm\)/g,
    (_m, _r, _s) => `(${runsTr} koşu, ${reportSections} bölüm)`,
  );
  if (readme !== before2) writeFileSync(readmePath, readme);
  console.log(`README: ${reportSections} bölüm, ${runsTr} koşu`);
}

console.log(`birim: ${unit} test / ${unitFiles} dosya · e2e: ${e2e} test`);
console.log('README, PROGRESS.md ve VALIDATION.md §1 güncellendi');

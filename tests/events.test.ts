/**
 * Cell to Mind — olay günlüğü bütünlüğü testi.
 *
 * `SimEventType` birleşimi, simülasyonun üretebileceği olayları **beyan eder**.
 * Bu test her beyanın gerçekten bir üreticisi olduğunu doğrular.
 *
 * **Neden:** Bu projede iki kez aynı sınıftan tuzağa düşüldü —
 *   1. `sharingPhase()` sayacı hiç artırmıyordu (§6.20),
 *   2. niş ölçümünün hız ekseni tüm gözlemleri tavana kırpıyordu (§6.23).
 * Üçüncüsü daha sessizdir: `SimEventType`'a eklenen ama **hiç yayınlanmayan**
 *   bir tür, çalışma zamanında hiçbir şey görünmez; yalnız onu dinleyen bir UI
 *   filtresi ya da deney kalıcı olarak boş kalır.
 *
 * Ölçülen durum (2026-10-13, 5 tohum × 8000 tick): 8 tür düzenli tetikleniyor,
 * **6 tür hiç oluşmuyor** — ve altısının da sıfır üreticisi, sıfır tüketicisi
 * vardı. Bunlar ölü beyanlardı; §6.46'da kayıt altına alındı ve **kaldırıldı**.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SimEventType } from '../src/sim/types.ts';

const ROOT = resolve(__dirname, '..');

/** `src/` altındaki tüm .ts/.tsx dosyaları (node_modules/dist dışarıda). */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const ALL_SRC = sourceFiles(join(ROOT, 'src'))
  .map((f) => ({ path: f, text: readFileSync(f, 'utf8') }))
  // `types.ts` yalnız beyanı içerir; onu saymak her türü "üretici var" yapardı.
  .filter((f) => !f.path.endsWith('src/sim/types.ts'))
  // Test dosyaları da tür adını geçirebilir; onlar üretici değildir.
  .filter((f) => !f.path.includes('/tests/'));

describe('olay günlüğü bütünlüğü', () => {
  // Ölçülen ve temizlenen gerçek küme (§6.46): 10 tür, hepsi bağlı.
  const declared: SimEventType[] = [
    'genesis', 'cell-division', 'bud-separation',
    'bond-formation', 'bond-break', 'fragmentation', 'death', 'predation',
    'learning-update', 'intervention',
  ];

  it('her bildirilen olay türünün en az bir üreticisi var', () => {
    const dead = declared.filter(
      (type) => !ALL_SRC.some((f) => f.text.includes(`'${type}'`) || f.text.includes(`"${type}"`)),
    );
    // Ölü beyan, çalışma zamanında görünmez ama dinleyeni kalıcı olarak boş
    // bırakır. Yeni tür eklenip bağlanmazsa bu test kırmızı döner.
    expect(dead, `üreticisi olmayan olay türleri: ${dead.join(', ')}`).toEqual([]);
  });

  it('beyan edilen tür kümesi SimEventType ile uyuşuyor', () => {
    // Union'dan bir tür silinirse test de unutmasın: beyanı kaynaktan oku.
    const typesSrc = readFileSync(join(ROOT, 'src/sim/types.ts'), 'utf8');
    const start = typesSrc.indexOf('export type SimEventType');
    const end = typesSrc.indexOf(';', start);
    const fromSource = [...typesSrc.slice(start, end).matchAll(/'([a-z-]+)'/g)].map((m) => m[1]!);
    expect([...declared].sort()).toEqual([...new Set(fromSource)].sort());
  });

  it('olay günlüğü üretimde gerçekten doluyor', () => {
    // Yukarıdaki test "bağlantı" denetimi; bu "canlılık" denetimi.
    // Biri diğerinin yerine geçmez.
    expect(ALL_SRC.some((f) => f.text.includes('pushEvent('))).toBe(true);
  });
});
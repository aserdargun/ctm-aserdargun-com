/**
 * Cell to Mind — görüntüleme sınırlarının yeterliliği (ÖLÇÜM tabanlı).
 *
 * İki tavan vardır:
 *   - `MAX_RENDER_CELLS` (512) — 3B sahnenin gösterdiği azami hücre
 *   - `ORGANISM_LIST_LIMIT` (300) — canlı listesinde gösterilen azami kayıt
 *
 * ⚠️ **Neden ölçüm gerekiyor:** Bu tavanlar simülasyonu sınırlamaz, yalnızca
 * **görüntülemeyi** sınırlar. Simülasyonun canlı hücre/organizma sayısı
 * tavanı aşarsa, arayüz sessizce eksik gösterir: HUD gerçek sayıyı yazar,
 * sahne daha azını çizer. Kullanıcı iki sayının çeliştiğini fark etmez.
 *
 * Ölçülen durum (2026-10-19, `tools/measure-cell-cap.ts`,
 * `tools/measure-list-cap.ts`):
 *   - en yüksek canlı hücre    : 266  → tavanın %52'si (pay %48)
 *   - en yüksek canlı organizma: 252  → tavanın %84'ü (pay %16)
 *
 * Bu test **o ölçümü yeniden yapar** ve tavanlarla karşılaştırır. Simülasyonun
 * büyüme davranışı değişirse (popülasyon artışı, daha büyük koloniler)
 * test kırmızıya döner ve tavan gözden geçirilmek üzere işaretlenir.
 *
 * ⚠️ Bu bir **kanıt değil, örneklemeye dayalı bir regresyon denetimi**dir:
 * ölçülen tepe yalnızca seçilen tohumlar ve pencere içindir. "Tavan asla
 * aşılmaz" iddiası buradan çıkarılamaz; çıkarılan iddia yalnızca şudur:
 * **bu ölçülen aralıkta tavan aşılmıyor ve sapma olursa görünür kılınıyor.**
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { World } from '../src/sim/world.ts';
import {
  LINEAGE_DISPLAY_LIMIT,
  MAX_RENDER_CELLS,
  MAX_RENDER_RESOURCES,
  OBSERVER_CLAIM_LIMIT,
  OBSERVER_MEASUREMENT_LIMIT,
  ORGANISM_LIST_LIMIT,
} from '../src/engine/limits.ts';
import { buildEvidencePack } from '../src/worker/evidence.ts';

const ROOT = resolve(__dirname, '..');

interface Peak {
  cells: number;
  organisms: number;
  tick: number;
}

/**
 * Bir tohumu belirli bir pencere boyunca sürüp canlı hücre ve organizma
 * sayılarının **tepe** değerini ölçer.
 *
 * Ölçüm 10 tick'te bir örnekleme yapar: tepe, bölünme olaylarının
 * yoğunlaştığı aralıkta (ölçümde 2.500–5.500 tick) görülür.
 */
function measurePeak(seed: number, ticks: number, population = 48): Peak {
  const world = new World({ seed, population });
  let cells = 0;
  let organisms = 0;
  let tick = 0;
  for (let t = 0; t < ticks; t++) {
    world.step();
    if (t % 10 !== 0) continue;
    const c = world.population();
    const o = world.aliveOrganismCount();
    if (c > cells) {
      cells = c;
      organisms = o;
      tick = world.tick;
    }
  }
  return { cells, organisms, tick };
}

describe('görüntüleme sınırları ölçümle denetleniyor', () => {
  // Uygulamanın gerçek başlangıç yapılandırması: `App.tsx` her zaman
  // `population: 48` ile başlatır. Pencere, raporların standardı olan
  // 12.000 tick'tir (ölçülen tepe 2.461–5.431 tick aralığında çıkıyor).
  const SEEDS = [11, 7];
  const TICKS = 12_000;
  const peaks = SEEDS.map((seed) => measurePeak(seed, TICKS));

  it('ölçüm boş değil (koruma gerçekten çalışıyor)', () => {
    expect(peaks.length).toBe(SEEDS.length);
    for (const p of peaks) {
      expect(p.cells).toBeGreaterThan(0);
      expect(p.organisms).toBeGreaterThan(0);
    }
  });

  it('ölçülen tepe hücre sayısı 3B görünüm tavanının altında', () => {
    const worst = peaks.reduce((a, b) => (b.cells > a.cells ? b : a));
    expect(
      worst.cells,
      `3B görünüm tavanı aşıldı: ${worst.cells} hücre > ${MAX_RENDER_CELLS}. ` +
        'Tavanı gözden geçir (src/engine/limits.ts) veya davranışı düzelt.',
    ).toBeLessThan(MAX_RENDER_CELLS);
  });

  it('ölçülen tepe organizma sayısı canlı listesi tavanının altında', () => {
    const worst = peaks.reduce((a, b) => (b.organisms > a.organisms ? b : a));
    expect(
      worst.organisms,
      `Canlı listesi tavanı aşıldı: ${worst.organisms} organizma > ${ORGANISM_LIST_LIMIT}. ` +
        'Tavanı gözden geçir (src/engine/limits.ts) veya davranışı düzelt.',
    ).toBeLessThan(ORGANISM_LIST_LIMIT);
  });

  it('simülasyonun ürettiği soy sayısı panelin gösterim sınırını aşmıyor', () => {
    // ⚠️ Simülasyon soy sayısını **yapısal** olarak belirler: kurucu
    // organizmalar `FOUNDER_LINEAGE_GROUPS` gruba bölünür ve her grup bir
    // soy olur. Yeni soy yalnız kurucu turlarında doğduğu için sayı sabittir.
    //
    // Bu denetim **anlıktır** (tick süresi yok): soylar kuruluşta doğar.
    // Panelin gösterim sınırı ile simülasyonun tavanı ayrışırsa panel
    // sessizce kırpmaya başlar ve kullanıcı "tüm soylar" sanar.
    for (const population of [8, 48, 100, 192, 500]) {
      const world = new World({ seed: 11, population });
      expect(
        world.lineages.size,
        `popülasyon ${population}: simülasyon ${world.lineages.size} soy üretti, ` +
          `panel sınırı ${LINEAGE_DISPLAY_LIMIT}`,
      ).toBeLessThanOrEqual(LINEAGE_DISPLAY_LIMIT);
    }
  });
});

describe('görüntüleme tavanları TEK kaynaktan okunuyor', () => {
  /**
   * Sahne ve HUD **aynı** sayıyı okumalıdır.
   *
   * ⚠️ Ayrışma riski tam olarak burada: HUD gerçek hücre sayısını yazar,
   * sahne kendi tavanıyla kırpar. İki tavan ayrı ayrı yazılırsa
   * "görünüm sınırı" göstergesi **yanlış** sayı gösterir — yani uyarının
   * kendisi yalan söyler.
   */
  it('sahne yerel tavan kopyası tanımlamıyor', () => {
    const scene = readFileSync(resolve(ROOT, 'src/scene/Cells.tsx'), 'utf8');
    expect(
      scene,
      'sahne kendi tavan sabitini tanımlıyor — tek kaynak kuralı bozuldu',
    ).not.toMatch(/const\s+MAX_CELLS\s*=|const\s+MAX_RENDER_CELLS\s*=/);
    expect(scene, 'sahne paylaşılan tavanı içe aktarmıyor').toMatch(
      /import\s*\{[^}]*MAX_RENDER_CELLS[^}]*\}\s*from\s*'\.\.\/engine\/limits\.ts'/,
    );
  });

  it('HUD yerel tavan kopyası tanımlamıyor', () => {
    const hud = readFileSync(resolve(ROOT, 'src/ui/Hud.tsx'), 'utf8');
    expect(hud, 'HUD kendi tavan sabitini tanımlıyor — tek kaynak kuralı bozuldu').not.toMatch(
      /const\s+ORGANISM_LIST_LIMIT\s*=/,
    );
    expect(hud, 'HUD paylaşılan tavanları içe aktarmıyor').toMatch(
      /import\s*\{[^}]*MAX_RENDER_CELLS[^}]*ORGANISM_LIST_LIMIT[^}]*\}\s*from\s*'\.\.\/engine\/limits\.ts'/,
    );
  });

  it('soy paneli gösterim sınırını simülasyondan alıyor (bağımsız "12" yok)', () => {
    // ⚠️ Panel `lineages.slice(0, 12)` yazıyordu ve simülasyon da
    // `founders.length / 12` ile soy grupluyordu — iki sayı **bağımsız**
    // yazılıydı. Bugün ikisi de 12 olduğu için panel kırpmıyor; ama
    // simülasyonun tavanı değişseydi panel sessizce kırpmaya başlardı.
    const panel = readFileSync(resolve(ROOT, 'src/ui/Panels.tsx'), 'utf8');
    expect(
      panel,
      'soy paneli kendi gösterim sınırını yazıyor — ortak sabit kullanmalı',
    ).not.toMatch(/lineages\.slice\(0,\s*\d+\)/);
    expect(panel, 'soy paneli paylaşılan sınırı içe aktarmıyor').toMatch(
      /import\s*\{[^}]*LINEAGE_DISPLAY_LIMIT[^}]*\}\s*from\s*'\.\.\/engine\/limits\.ts'/,
    );

    // Ve simülasyonun kendi grubu da aynı sabitten gelmeli.
    const world = readFileSync(resolve(ROOT, 'src/sim/world.ts'), 'utf8');
    expect(world, 'simülasyon soy gruplamasını elle yazıyor').not.toMatch(
      /Math\.ceil\(founders\.length\s*\/\s*\d+\)/,
    );
    expect(world, 'simülasyon ortak sabiti içe aktarmıyor').toMatch(/FOUNDER_LINEAGE_GROUPS/);
  });

  it('gözlemci paneli ölçüm tablosunda kırpma görünür', () => {
    // Kanıt paketi bugün 14 ölçüm üretiyor (24'lük sınır bağlayıcı değil),
    // ama ölçüm sayısı büyürse tablo sessizce kırpılmamalı.
    const world = new World({ seed: 11, population: 48 });
    const pack = buildEvidencePack(world, 'ne oluyor?', 'A', null, 'w');
    expect(
      pack.measurements.length,
      `kanıt paketi ${pack.measurements.length} ölçüm üretti, sınır ${OBSERVER_MEASUREMENT_LIMIT}`,
    ).toBeLessThanOrEqual(OBSERVER_MEASUREMENT_LIMIT);

    const panel = readFileSync(resolve(ROOT, 'src/ui/Panels.tsx'), 'utf8');
    expect(
      panel,
      'gözlemci paneli ölçüm tablosunu elle sınırlıyor — ortak sabit kullanmalı',
    ).not.toMatch(/measurements\.slice\(0,\s*\d+\)/);
    expect(panel, 'ölçüm tablosunda görünür kırpma notu yok').toContain(
      `evidence.measurements.slice(0, OBSERVER_MEASUREMENT_LIMIT)`,
    );
  });

  it('gözlemci paneli iddia tablosunda kırpma görünür', () => {
    // ⚠️ Model yanıtındaki sayı sayısı **sınırsızdır**; 20'lik sınır gerçekten
    // bağlayıcı olabilir. O yüzden burada sessiz kırpma kabul edilmiyor.
    expect(OBSERVER_CLAIM_LIMIT).toBeGreaterThan(0);
    const panel = readFileSync(resolve(ROOT, 'src/ui/Panels.tsx'), 'utf8');
    expect(
      panel,
      'gözlemci paneli iddia tablosunu elle sınırlıyor — ortak sabit kullanmalı',
    ).not.toMatch(/claims\.slice\(0,\s*\d+\)/);
    expect(panel, 'iddia tablosunda görünür kırpma notu yok').toContain(
      `r.claims.slice(0, OBSERVER_CLAIM_LIMIT)`,
    );
  });

  it('simülasyonun kaynak sayısı 3B görünüm tavanını aşmıyor', () => {
    // ⚠️ Kaynak sayısı **kuruluşta** belirlenir ve sonradan artmaz
    // (`addNutrient` mevcut bir düğümün rezervini doldurur, yeni düğüm
    // yaratmaz). Yani sayı sabittir — ama `World` seçeneğiyle daha yüksek
    // bir değer verilebilir, o zaman 3B sahne sessizce düşürürdü.
    const world = new World({ seed: 11, population: 48 });
    expect(
      world.resources.length,
      `dünya ${world.resources.length} kaynak üretti, görünüm tavanı ${MAX_RENDER_RESOURCES}`,
    ).toBeLessThanOrEqual(MAX_RENDER_RESOURCES);

    // Tavan tek yerde yazılıdır: sahne elle sayı yazmıyor.
    const props = readFileSync(resolve(ROOT, 'src/scene/Props.tsx'), 'utf8');
    expect(props, 'sahne kendi kaynak tavanını yazıyor — ortak sabit kullanmalı').not.toMatch(
      /args=\{\[[^\]]*,\s*\d+\]\}/,
    );
    expect(props, 'sahne paylaşılan kaynak tavanını içe aktarmıyor').toMatch(
      /import\s*\{[^}]*MAX_RENDER_RESOURCES[^}]*\}\s*from\s*'\.\.\/engine\/limits\.ts'/,
    );
  });
});

describe('ölü sabit kalmıyor', () => {  /**
   * `C` kümesindeki **her** sabit bir şey yapmalıdır.
   *
   * Ölçülen bulgu (2026-10-19): `MOBILE_CAPACITY` (küçük mobil habitat
   * kapasitesi) ve `COLONY_GENERATION_TARGET` (koloni üreme nesli hedefi)
   * **hiçbir yerde kullanılmıyordu**. `energy.ts` başlığı "Tüm ayarlar tek
   * yerde; MODEL.md bu değerleri belgeler" diyor — ama kullanılmayan bir
   * sabit, varmış gibi duran bir özellik vaadi.
   *
   * Bu denetim "ölü sabit" sınıfının **geri dönmesini** engeller: yeni bir
   * sabit eklenip kullanılmazsa test kırmızıya döner.
   */
  it('C kümesindeki hiçbir sabit ölü değil', () => {
    const energy = readFileSync(resolve(ROOT, 'src/sim/biology/energy.ts'), 'utf8');
    const names = [...energy.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1] as string);
    expect(names.length, 'C sabitleri okunamadı').toBeGreaterThan(10);

    const sources = collectSources();
    const dead = names.filter(
      (name) => !new RegExp(`\\bC\\.${name}\\b`).test(sources),
    );
    expect(
      dead,
      `Kullanılmayan C sabitleri: ${dead.join(', ')}. ` +
        'Kullanılmayan sabit "var olan ama çalışmayan" bir özellik gibi görünür — silin ya da bağla.',
    ).toEqual([]);
  });
});

/** Denetlenecek kaynak dosyaların birleşik metni. */
function collectSources(): string {
  const roots = ['src', 'scripts', 'tools', 'server', 'tests', 'e2e'];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(ROOT, dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(join(dir, entry));
      else if (['.ts', '.tsx'].includes(extname(entry))) files.push(full);
    }
  };
  for (const r of roots) walk(r);
  return files.map((f) => readFileSync(f, 'utf8')).join('\n');
}

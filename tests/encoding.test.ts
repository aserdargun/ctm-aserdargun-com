/**
 * Cell to Mind — metin bütünlüğü testleri.
 *
 * Ölçülen bulgu (2026-10-19): `src/worker/evidence.ts` içindeki gözlemci
 * özetinde **U+FFFD (REPLACEMENT CHARACTER)** vardı:
 *
 *     'Şu ana kadar \uFFFD\uFFFD eşiğin üzerinde bağlı küme yok.'
 *
 * Kaybolan şey `C.MULTICELL_THRESHOLD` (4) idi. Bu, kullanıcıya **görünen**
 * bilimsel metinde sessiz bir bozulma: panel "\uFFFD\uFFFD eşiği" yazıyordu, yani
 * eşiğin sayısı hiçbir yerde görünmüyordu. Aynı sınıftan bir bozulma
 * `docs/VALIDATION.md` §6.8'de de vardı ("Dü\uFFFD\uFFFDeltme").
 *
 * Bu test **genel**dir: projedeki hiçbir metin dosyası U+FFFD içeremez.
 * Tek tek dosya denetlemek yerine tüm ağacı taramak, aynı sınıftaki yeni
 * bozulmaları da yakalar — yani "bu dosyayı düzelttim" kaydı değil,
 * "bu sınıf artık yok" kaydı.
 *
 * ⚠️ Denetim **bayt düzeyindedir**; kod noktası U+FFFD'ye düşmüşse
 * yakalanır. Dosyanın yazılma biçimini bozan başka bir hata (örn. geçersiz
 * UTF-8) bu testte görünmez; `readFileSync` zaten onu bozuk karaktere
 * çevirir, bu yüzden kapsam **beklenmedik kod noktası** ile sınırlıdır.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { buildLocalSummary } from '../src/worker/evidence.ts';
import { C } from '../src/sim/biology/energy.ts';
import type { EvidencePack } from '../src/worker/protocol.ts';

const ROOT = resolve(__dirname, '..');

/** Taranacak metin uzantıları. */
const TEXT_EXT = new Set(['.ts', '.tsx', '.md', '.json', '.css', '.html', '.yml', '.yaml', '.mjs', '.js', '.txt', '.svg']);

/** Taranmayacak dizinler (üretilmiş ya da harici). */
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report', '.next']);

function textFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') && entry !== '.github') {
      if (SKIP_DIR.has(entry)) continue;
    }
    if (SKIP_DIR.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      textFiles(full, out);
    } else if (TEXT_EXT.has(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

describe('metin bütünlüğü', () => {
  const files = textFiles(ROOT).filter((f) => !f.includes(`${join('node_modules', '')}`));

  it('proje metin dosyalarını bulur (tarama boş değil)', () => {
    // Boş tarama "hepsi temiz" der ve sessizce hiçbir şey denetlemez —
    // daha önce yaşanan "koruma hiçbir şeyi denetlemiyor" hatasının aynısı.
    expect(files.length).toBeGreaterThan(20);
  });

  it('hiçbir dosya U+FFFD (REPLACEMENT CHARACTER) içermez', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (text.includes('\uFFFD')) {
        const line = text.split('\n').findIndex((l) => l.includes('\uFFFD')) + 1;
        offenders.push(`${file.replace(`${ROOT}/`, '')}:${line}`);
      }
    }
    expect(
      offenders,
      `Bozuk karakter (U+FFFD) bulundu — kaybolmuş metin:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('arayüzde Türkçe sabit metin kalmıyor (dil değiştirme her yere geçer)', () => {
    // ⚠️ ÖLÇÜLEN (19 Ekim 2026): uygulama iki dilli ama **42** Türkçe sabit
    // metin vardı — 30'u gözlemci panelinin **tüm** bilimsel çıktısında, 12'si
    // bileşenlerde. Dil İngilizce'ye geçtiğinde panel Türkçe kalıyordu.
    //
    // Buradaki koruma **genel**: arayüz dosyalarında (ve kanıt paketinin
    // metinlerinde) Türkçe'ye özgü karakter içeren, iki dilli olmayan sabit
    // metin kalmaz. Yorumlar temizlenir (JSX yorumları dâhil), iki dilli
    // kalıplar (`tr ? ... : ...`) muaftır.
    const UI_FILES = [
      'src/ui/EventsPanel.tsx',
      'src/ui/EvolutionPanel.tsx',
      'src/ui/LifeMapPanel.tsx',
      'src/ui/Panels.tsx',
      'src/ui/Hud.tsx',
      'src/ui/ExperimentPanels.tsx',
      'src/App.tsx',
      'src/worker/evidence.ts',
    ];
    const TR = /[ğüşıİç]/;
    const stripComments = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

    const offenders: string[] = [];
    for (const rel of UI_FILES) {
      const src = stripComments(readFileSync(resolve(ROOT, rel), 'utf8'));
      src.split('\n').forEach((line, i) => {
        if (/^\s*import\s/.test(line)) return;
        for (const m of line.matchAll(/(['"`])([^'"`]*)\1/g)) {
          const text = m[2] as string;
          if (text.length < 3 || !TR.test(text)) continue;
          // İki dilli kalıp (tr ? ... : ...) sorun değil.
          if (line.includes('?') && line.includes(':')) continue;
          offenders.push(`${rel}:${i + 1}  ${text.slice(0, 60)}`);
        }
      });
    }
    expect(
      offenders,
      `Türkçe sabit metin kalmış — dil değiştirildiğinde bu metinler Türkçe kalır:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('gözlemci özeti eşiği SAYIYLA yazar (bozuk metin yeniden dönmüyor)', () => {
    // Koruma, düzeltmenin kendisine bağlanır: eşik dalı gerçekten çalışıyor
    // mu, yoksa "düzelttim" kaydı mı tutuyor?
    //
    // ⚠️ Bu dal ÖNCEDEN hiç test edilmiyordu — `BASE` paketinde
    // `largestColonySize = 7` (eşik 4'ün üstü) olduğu için bozuk metin
    // üreten dal hiç çalışmıyordu.
    const pack: EvidencePack = {
      worldId: 'w',
      simVersion: 'test',
      tickIntervalMs: 50,
      tick: 100,
      simTimeSeconds: 5,
      question: 'q',
      language: 'tr',
      eventIds: [],
      events: [],
      measurements: [{ metricRef: 'largestColonySize', value: 1, unit: 'cells' }],
      interventions: [],
      lineage: null,
      networkSummary: null,
      imageHint: null,
      constraints: [],
      notMeasured: [],
    };
    const text = buildLocalSummary(pack).interpretations.join(' ');
    expect(text).not.toContain('\uFFFD');
    expect(text).toContain(String(C.MULTICELL_THRESHOLD));
  });
});

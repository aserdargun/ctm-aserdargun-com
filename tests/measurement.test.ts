/**
 * Cell to Mind — ölçüm kodu yapısal denetimi.
 *
 * Bu testler **kodun kendisini** denetler; simülasyonu değil.
 *
 * **Neden:** CTM'de beş ayrı "ölü alet" sınıfı çıktı ve hepsi aynı
 * biçimde sessizdi:
 *   1. hiç artmayan sayaç (§6.20)
 *   2. ölçülemez alet — tüm gözlemler tavana kırpılmış (§6.23)
 *   3. ölü beyan — üretilmeyen olay türü (§6.46)
 *   4. bayat sayı / abartılı durum işareti (§6.49, §6.51)
 *   5. **ölü denetim döngüsü** — döngünün iki kez çalışması (§6.57)
 *
 * Beşincisi en pahalısıydı: deney fonksiyonunda döngü iki kez kopyalanmış,
 * dünya 8000 yerine 16.000 tick işlemiş ve "tepe bağ" sayısı koşunun ikinci
 * yarısından gelmişti. Rapor "12,8" derken bağımsız ölçüm "0,4" diyordu;
 * **uyuşmazlık hatayı ortaya çıkardı.** Kimse fark etmemişti.
 *
 * Buradaki denetimler, aynı alışkanlığın ikinci kez kurulmasını engeller.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { GENOME_KEYS, founderGenomes, genomeDistance } from '../src/sim/genome.ts';
import { ACTION_NAMES, MLP_SHAPE } from '../src/sim/behavior/mlp.ts';
import {
  baselineThetas,
  formatInWorldEvolution,
  readInWorldEvolution,
} from '../src/sim/experiments/index.ts';
import { formatShareThreshold, sweepShareThreshold } from '../src/sim/experiments/ecology.ts';
import { fmtSigned } from '../src/sim/stats.ts';
import { medianOf } from '../src/sim/experiments/ecology.ts';
import {
  ACTION_LABELS_EN,
  ACTION_LABELS_TR,
  format,
  getStrings,
  inputLabels,
} from '../src/i18n/index.ts';
import { Rng } from '../src/sim/rng.ts';
import type { Genome } from '../src/sim/types.ts';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

function filesUnder(dir: string, filter: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

/** Bir fonksiyon gövdesindeki `for`/`while` başlangıçlarını ve gövde bloklarını bulur. */
function loopsInBlock(src: string, startIndex: number): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let i = startIndex; i < src.length; i++) {
    const c = src[i];
    const prev = src[i - 1];
    const isWordStart = /[A-Za-z]/.test(c) && !/[A-Za-z0-9_$]/.test(prev ?? ' ');
    if (isWordStart && (src.startsWith('for', i) || src.startsWith('while', i))) {
      const kw = src.startsWith('for', i) ? 'for' : 'while';
      const after = src[i + kw.length] ?? ' ';
      if (/[\s(]/.test(after)) out.push(i);
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth <= 0) break;
    }
  }
  return out;
}

describe('ölçüm kodu · ölü denetim döngüsü koruması', () => {
  it('deney dosyalarında tekrar eden ölçüm döngüsü deseni yok', () => {
    // Belirti deseni: bir fonksiyonda `for (... world.step() ...)` bloğunun
    // hemen ardından **aynı biçimde** ikinci bir döngü gelmesi. §6.57'deki
    // hata tam olarak buydu.
    const offenders: string[] = [];
    for (const file of filesUnder(join(ROOT, 'src'), (p) => p.endsWith('experiment') || p.includes('experiments'))) {
      const src = readFileSync(file, 'utf8');
      // Fonksiyon gövdelerini kabaca ayır.
      const fnStarts = [...src.matchAll(/const\s+(\w+)\s*=\s*\([^)]*\)\s*(?::[^=]+)?=>\s*\{|function\s+(\w+)\s*\([^)]*\)\s*\{/g)];
      for (const m of fnStarts) {
        const bodyStart = src.indexOf('{', m.index);
        if (bodyStart < 0) continue;
        const loops = loopsInBlock(src, bodyStart);
        for (let i = 0; i + 1 < loops.length; i++) {
          const a = src.slice(loops[i]!, loops[i + 1]!);
          // İki ardışık döngü aynı adımı (`world.step()`) çağırıyorsa şüpheli.
          const stepCalls = (s: string): number => (s.match(/\.step\(\)/g) ?? []).length;
          if (stepCalls(a) > 0 && stepCalls(a) === stepCalls(src.slice(loops[i + 1]!, loops[i + 1]! + 400))) {
            offenders.push(`${file.replace(ROOT + '/', '')}: ${m[1] ?? m[2]} — ardışık iki ölçüm döngüsü`);
          }
        }
      }
    }
    expect(offenders, `ölü denetim döngüsü deseni:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('işbirliği deneyinin koşu fonksiyonu TEK ölçüm döngüsü içerir', () => {
    // §6.57'deki hata tam olarak buradaydı: run() içinde döngü iki kez
    // kopyalanmış, dünya 8000 yerine 16.000 tick işlemiş ve tepe değerleri
    // koşunun ikinci yarısından gelmişti.
    //
    // İlk denemede tüm dosya için "step çağrısı = döngü × 2" gibi bir
    // varsayım yazdım ve **yanlış çıktı**: dosyada farklı desenler var.
    // Doğru ölçüt fonksiyon bazlıdır.
    const src = readFileSync(join(ROOT, 'src/sim/experiments/ecology.ts'), 'utf8');
    const start = src.indexOf('const run = (renewal: number, seed: number)');
    expect(start, 'cooperation run() bulunamadı').toBeGreaterThan(-1);
    const end = src.indexOf('\n  };', start);
    const body = src.slice(start, end > start ? end : start + 900);

    expect(
      (body.match(/world\.step\(\)/g) ?? []).length,
      'koşu fonksiyonu dünyayı birden çok kez adımlıyor — ölü denetim döngüsü',
    ).toBe(1);
    expect((body.match(/\bfor\s*\(/g) ?? []).length).toBe(1);
  });
});

describe('ölçüm kodu · ölü ölçüm kapsamı koruması', () => {
  // `genome.cooperation` eklenirken iki ölçüm **elle yazılmış 8 parametre
  // listesi** taşımaya devam etti:
  //   - `genomeDistance()` → uyarlanma kayması ölçümü
  //   - `genomeSignature()` → benzersiz genom / çeşitlilik sayımı
  // İkisi de çalışıyor, sayı üretiyor ve p-değeri hesaplıyor; yalnız yeni
  // parametreyi **görmüyordu**. Çeşitlilik ölçüldü: 8-parametreli imza
  // 12.000 tick'te 61/58 benzersiz genom bulurken tam imza 62/60 buluyor —
  // yani çeşitlilik sistematik olarak küçük hesaplanıyordu.
  //
  // Bu, ölçülebilir bir hatanın **sessiz** hâli; bu yüzden elle listeler
  // yasaklanır ve parametreler tek kaynaktan (`GENOME_KEYS`) okunur.
  it('elle yazılmış genom parametre listesi yok', () => {
    const offenders: string[] = [];
    for (const file of filesUnder(join(ROOT, 'src'), (p) => p.endsWith('.ts'))) {
      const src = readFileSync(file, 'utf8');
      // Gerçek kusurun şekli: **iki farklı alıcı üzerinde** aynı parametrenin
      // karşılaştırılması (`a.plasticity` ve `b.plasticity`) — yani bir
      // genom çiftinin **tüm parametrelerini tek tek sayan** elle liste.
      //
      // ⚠️ İlk iki deneme yanlış pozitif üretti:
      //   (a) "satırda ≥3 parametre" → `Pick<Genome,…>` (tip kısıtı) ve genom
      //       nesne literalinin alanları yakalandı; ikisi de meşru.
      //   (b) "parametre iki kez geçiyor" → `const plasticity = K *
      //       genome.plasticity` yakalandı; orada **tek** parametre var.
      // Doğru ölçüt: farklı alıcılarla karşılaştırma.
      const KEY =
        /\b(bondAffinity|bondStrength|motility|senseRadius|shareEfficiency|toleranceA|toleranceB|plasticity|cooperation)\b/g;
      for (const [i, line] of src.split('\n').entries()) {
        if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
        const pairs = [...line.matchAll(/([A-Za-z_$][\w$]*)\.([a-zA-Z]+)/g)].map((m) => ({
          obj: m[1]!,
          prop: m[2]!,
        }));
        const paramPairs = pairs.filter((p) => KEY.test(p.prop));
        KEY.lastIndex = 0;
        if (paramPairs.length < 2) continue;
        // Aynı parametre, FARKLI alıcılarda → elle sayım şüphesi.
        const byProp = new Map<string, Set<string>>();
        for (const p of paramPairs) {
          if (!byProp.has(p.prop)) byProp.set(p.prop, new Set());
          byProp.get(p.prop)!.add(p.obj);
        }
        const enumerated = [...byProp.values()].some((objs) => objs.size >= 2);
        if (enumerated) {
          offenders.push(`${file.replace(ROOT + '/', '')}:${i + 1}  ${line.trim().slice(0, 70)}`);
        }
      }
    }
    expect(offenders, `elle genom parametre listesi sayan satırlar:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('genom ölçümleri parametreleri tek kaynaktan okuyor', () => {
    const ecology = readFileSync(join(ROOT, 'src/sim/experiments/ecology.ts'), 'utf8');
    expect(ecology).toMatch(/GENOME_KEYS\.map\(/);
    // ⚠️ Bu döngü bir zamanlar `colony.ts` içindeydi. Kanonik tanım
    // `sim/genome.ts`'e taşındığında koruma **aynen kaldı** ve doğru şekilde
    // kırıldı: artık yanlış dosyayı gösteren bir korumadan ibaret olmasın,
    // tanımın **doğru yerde** olduğunu da doğrulasın.
    expect(readFileSync(join(ROOT, 'src/sim/genome.ts'), 'utf8')).toMatch(
      /for \(const key of GENOME_KEYS\)/,
    );
  });

  it('i18n genom etiketleri TÜM parametreleri kapsıyor', () => {
    // ⚠️ `GENOME_LABELS_*` bir zamanlar `Record<string, string>` idi — **gevşek
    // tip**. `cooperation` eklendiğinde etiketi yazılmadı ve derleyici sessiz
    // kaldı; soy defteri panelinde o parametrenin satırı **boş** göründü.
    // Tip `Record<GenomeKey, string>` yapıldı; eksik üye artık derleme hatası.
    // Buradaki denetim, tipten bağımsız ikinci bir güvence.
    const i18n = readFileSync(join(ROOT, 'src/i18n/index.ts'), 'utf8');
    for (const lang of ['TR', 'EN']) {
      const block = i18n.match(new RegExp(`GENOME_LABELS_${lang}[\\s\\S]*?\\n};`))?.[0] ?? '';
      const present = (block.match(/^\s{2}(\w+):/gm) ?? []).map((s) => s.trim().replace(':', ''));
      const keys = new Set(present);
      const missing = [...GENOME_KEYS].filter((k) => !keys.has(k));
      expect(missing, `GENOME_LABELS_${lang} eksik parametreler: ${missing.join(', ')}`).toEqual([]);
    }
    // Ve tip sıkı olmalı (gevşek `Record<string,string>` sessiz geçer).
    expect(i18n).toMatch(/Record<GenomeKey, string>/);
    expect(i18n).not.toMatch(/GENOME_LABELS_\w+: Record<string, string>/);
  });

  it('i18n şablon yer tutucuları TR ve EN arasında AYNI', () => {
    // ⚠️ `format()` eklendiğinde (sayaç içeren metinler için) iki dil
    // **ayrı ayrı** yazılır. Derleyici anahtar eşleşmesini zorlar, ama
    // `{shown}` ile `{total}` yer tutucularının **eşleştiğini** zorlamaz:
    // İngilizce metinde bir yer tutucu yazılmışsa, ekranda "{shown}"
    // **olduğu gibi** görünür — sessiz bir arayüz hatası.
    const walk = (node: unknown, path: string, out: Map<string, string[]>): void => {
      if (typeof node === 'string') {
        out.set(path, [...node.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort());
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out);
      }
    };
    const trMap = new Map<string, string[]>();
    const enMap = new Map<string, string[]>();
    walk(getStrings('tr'), '', trMap);
    walk(getStrings('en'), '', enMap);
    expect(trMap.size, 'i18n ağacı boş döndü — tarama işe yaramıyor').toBeGreaterThan(50);

    const mismatch: string[] = [];
    for (const [path, trVars] of trMap) {
      const enVars = enMap.get(path);
      if (!enVars) {
        mismatch.push(`${path}: EN sözlüğünde yok`);
        continue;
      }
      if (trVars.join(',') !== enVars.join(',')) {
        mismatch.push(`${path}: TR {${trVars.join(',')}} ↔ EN {${enVars.join(',')}}`);
      }
    }
    expect(mismatch, `şablon yer tutucuları iki dil arasında uyuşmuyor:\n${mismatch.join('\n')}`).toEqual(
      [],
    );
  });

  it('format() bilinmeyen yer tutucuyu boş dizeye çevirmiyor', () => {
    // Sessizlik tuzağı: bilinmeyen anahtar boş string'e dönüşseydi ekranda
    // "3B görünüm en fazla  hücre gösterir" gibi eksik bir cümle çıkardı —
    // hata ayıklaması zor, ama görünür. Yerinde bırakmak hatayı gösterir.
    expect(format('{a} ve {b}', { a: '1' })).toBe('1 ve {b}');
    expect(format('{a}', { a: 3 })).toBe('3');
    expect(format('sadece metin', { a: 1 })).toBe('sadece metin');
  });

  it('RNG akış sayısı koddan türetiliyor ve belgelerle AYNI', () => {
    // ⚠️ ÖLÇÜLEN: `src/sim/rng.ts` başlığı "simülasyonun **üç** ayrı rastgele
    // akışı vardır (`env`, `inherit`, `action`)" diyordu. Gerçekte **dört**
    // akış var: `evolve` de var ve `world.ts:2056`da kullanılıyor
    // (`this.rng.evolve`). Eksik olan akış, **şart** olan akıştı: üstel arama
    // pertürbasyonlarının dünya akışlarından ayrı tutulması, çatallanan
    // dünyaların yanlış sebeple farklılaşmaması için gerekli.
    //
    // Yani yanlış sayı, **deney geçerliliğini** ilgilendiren bir alanda
    // sessizce eksik bir akışı gizliyordu. Aynı yanlış sayı `MODEL.md` §6
    // (Determinizm), `ROADMAP.md` G3 ve `experiments/index.ts`de de vardı.
    const rngSrc = readFileSync(join(ROOT, 'src/sim/rng.ts'), 'utf8');

    // (a) Koddaki akışlar: `StreamName` birleşimi.
    const union = rngSrc.match(/export type StreamName\s*=\s*([^;]+);/)?.[1] ?? '';
    const streams = [...union.matchAll(/'([a-z]+)'/g)].map((m) => m[1] as string);
    expect(streams.length, 'RNG akışları koddan okunamadı').toBeGreaterThan(1);
    expect(streams, 'evolve akışı kodda yok').toContain('evolve');

    // (b) `RngBundle` gerçekten o kadar akış taşıyor mu (union ile uyum).
    const bundle = rngSrc.match(/export class RngBundle[\s\S]*?\n}/)?.[0] ?? '';
    const fields = [...bundle.matchAll(/readonly\s+([a-z]+):\s*Rng;/g)].map((m) => m[1] as string);
    expect(fields.sort(), 'RngBundle alanları StreamName ile uyuşmuyor').toEqual([...streams].sort());

    // (c) Türkçe sayı sözcüğü → sayı.
    const words: Record<string, number> = {
      bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
    };

    // (d) Belgeler: hem sayı doğru olmalı. Akış **adlarını** yalnız
    // kanonik yerler (model belgesi ve kaynak modül) saymak zorunda —
    // `ROADMAP.md` tek satırlık bir özet ("Dört ayrı RNG akışı"), orada
    // adları listelemek beklenmez.
    const mustName = new Set(['docs/MODEL.md', 'src/sim/rng.ts']);
    for (const rel of ['docs/MODEL.md', 'docs/ROADMAP.md', 'src/sim/rng.ts']) {
      const text = readFileSync(join(ROOT, rel), 'utf8');
      const m = text.match(
        /\b(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\b[^.\n]{0,60}?(?:RNG|rastgele)\s+akış/i,
      );
      expect(m, `${rel} içinde "N ... akış" biçiminde bir iddia bulunamadı`).toBeTruthy();
      // ⚠️ `/i` bayrağı yakalanan kelimeyi **özgün büyük harfle** döndürür
      // ("Dört"); sözlük küçük harfli olduğu için normalizasyon şart.
      const raw = (m as RegExpMatchArray)[1] as string;
      const stated = words[raw.toLocaleLowerCase('tr')];
      expect(
        stated,
        `${rel} "N akış" diyor (${stated}), kodda ${streams.length} akış var: ` +
          streams.join(', '),
      ).toBe(streams.length);

      if (!mustName.has(rel)) continue;
      for (const s of streams) {
        expect(text, `${rel} "${s}" akışını anmıyor`).toContain(s);
      }
    }
  });

  it('ağ parametre sayısı belgelerde ve arayüzde koddan türetiliyor', () => {
    // ⚠️ `tests/mlp.test.ts` koddaki 140 sayısını ve formülü koruyor, ama
    // **belgeler** korunmuyordu. "140" beş yerde elle yazılıydı:
    // `MODEL.md` (formülle birlikte), `PROGRESS.md`, `ROADMAP.md`,
    // `VALIDATION.md` ve — **kullanıcıya görünen** — `i18n` metni
    // ("140 parametreli ağ"). Mimari değişseydi hepsi sessizce yanlış olurdu.
    const p = MLP_SHAPE;
    // Kodun kendi içinde tutarlılığı (formülü koddan türet).
    expect(
      p.INPUTS * p.HIDDEN + p.HIDDEN + p.HIDDEN * p.OUTPUTS + p.OUTPUTS,
      'MLP parametre formülü PARAM_COUNT ile uyuşmuyor',
    ).toBe(p.PARAM_COUNT);
    expect(p.INPUTS + p.HIDDEN + p.OUTPUTS, 'toplam birim sayısı uyuşmuyor').toBe(p.TOTAL_UNITS);

    // Belgelerdeki "N parametre" iddiası.
    for (const rel of ['docs/MODEL.md', 'docs/PROGRESS.md', 'docs/ROADMAP.md', 'docs/VALIDATION.md']) {
      const text = readFileSync(join(ROOT, rel), 'utf8');
      const m = text.match(/\b(\d+)\s+parametre/);
      expect(m, `${rel} içinde "N parametre" iddiası bulunamadı`).toBeTruthy();
      expect(
        Number((m as RegExpMatchArray)[1]),
        `${rel} "N parametre" diyor (${(m as RegExpMatchArray)[1]}), kod ${p.PARAM_COUNT} diyor`,
      ).toBe(p.PARAM_COUNT);
    }

    // `MODEL.md` formülü: sayılar koddaki topolojiden gelmeli.
    const model = readFileSync(join(ROOT, 'docs/MODEL.md'), 'utf8');
    const formula = model.match(/`(\d+)·(\d+) \+ (\d+) \+ (\d+)·(\d+) \+ (\d+) = ` \*\*(\d+)\*\*/);
    expect(formula, 'MODEL.md ağ formülü okunamadı').toBeTruthy();
    const f = (formula as RegExpMatchArray).map((x) => Number(x));
    expect(f[1], 'MODEL.md formülündeki girdi sayısı yanlış').toBe(p.INPUTS);
    expect(f[2], 'MODEL.md formülündeki gizli sayısı yanlış').toBe(p.HIDDEN);
    expect(f[3], 'MODEL.md formülündeki bias sayısı yanlış').toBe(p.HIDDEN);
    expect(f[4], 'MODEL.md formülündeki gizli sayısı yanlış').toBe(p.HIDDEN);
    expect(f[5], 'MODEL.md formülündeki çıktı sayısı yanlış').toBe(p.OUTPUTS);
    expect(f[6], 'MODEL.md formülündeki bias sayısı yanlış').toBe(p.OUTPUTS);
    expect(f[7], 'MODEL.md formülünün sonucu yanlış').toBe(p.PARAM_COUNT);

    // Arayüz metni: kullanıcıya gösterilen sayı.
    const i18n = readFileSync(join(ROOT, 'src/i18n/index.ts'), 'utf8');
    const ui = i18n.match(/(\d+)\s+parametreli ağ/);
    expect(ui, 'i18n metninde "N parametreli ağ" bulunamadı').toBeTruthy();
    expect(
      Number((ui as RegExpMatchArray)[1]),
      `arayüz metni ${(ui as RegExpMatchArray)[1]} parametreli ağ diyor, kod ${p.PARAM_COUNT} diyor`,
    ).toBe(p.PARAM_COUNT);

    // Arayüzün **mimari tanımı**: yedi sayıyı birden gösteriyor. Hepsi koddan
    // türemeli — kullanıcıya anlatılan mimari ile gerçek mimari ayrışamaz.
    const arch = i18n.match(
      /Mimari: (\d+) → (\d+) \(tanh\) → (\d+) \(softmax\) · (\d+) parametre · (\d+) ağırlıklı bağlantı · (\d+) bias · (\d+) birim/,
    );
    expect(arch, 'i18n mimari tanımı okunamadı').toBeTruthy();
    const a = (arch as RegExpMatchArray).map((x) => Number(x));
    expect(a[1], 'mimari tanımındaki girdi sayısı yanlış').toBe(p.INPUTS);
    expect(a[2], 'mimari tanımındaki gizli sayısı yanlış').toBe(p.HIDDEN);
    expect(a[3], 'mimari tanımındaki çıktı sayısı yanlış').toBe(p.OUTPUTS);
    expect(a[4], 'mimari tanımındaki parametre sayısı yanlış').toBe(p.PARAM_COUNT);
    expect(a[5], 'mimari tanımındaki ağırlıklı bağlantı sayısı yanlış').toBe(p.WEIGHTED_CONNECTIONS);
    expect(a[6], 'mimari tanımındaki bias sayısı yanlış').toBe(p.BIASES);
    expect(a[7], 'mimari tanımındaki birim sayısı yanlış').toBe(p.TOTAL_UNITS);

    // Kanıt modülünün başlığı da aynı sayıyı kullanıyor.
    const evidenceSrc = readFileSync(join(ROOT, 'src/worker/evidence.ts'), 'utf8');
    const ev = evidenceSrc.match(/(\d+)\s+parametreli ağ/);
    expect(ev, 'evidence.ts başlığında "N parametreli ağ" bulunamadı').toBeTruthy();
    expect(
      Number((ev as RegExpMatchArray)[1]),
      `evidence.ts başlığı ${(ev as RegExpMatchArray)[1]} parametreli ağ diyor, kod ${p.PARAM_COUNT} diyor`,
    ).toBe(p.PARAM_COUNT);

    // ⚠️ **Kanonik modülün kendi başlığı** da aynı sayıları taşıyor ve
    // denetlenmiyordu: `sim/behavior/mlp.ts` "12 → 8 → 4", "140 parametre",
    // "W1 96 · b1 8 · W2 32 · b2 4", "24 birim", "128 ağırlıklı bağlantı",
    // "12 bias" diyor. Mimari değişseydi (girdi 12 → 14) **kaynak modülün
    // kendi başlığı** yanlış kalırdı — yani "bu sayı buradan geliyor" diyen
    // her yer yanlış olurdu.
    const mlpSrc = readFileSync(join(ROOT, 'src/sim/behavior/mlp.ts'), 'utf8');
    const head = mlpSrc.slice(0, mlpSrc.indexOf('export const MLP_SHAPE'));
    expect(head, 'mlp.ts başlığı okunamadı').toMatch(
      new RegExp(`${p.INPUTS} → ${p.HIDDEN} → ${p.OUTPUTS} MLP`),
    );
    expect(head, 'mlp.ts başlığı parametre sayısı yanlış').toMatch(
      new RegExp(`${p.INPUTS}\\*${p.HIDDEN} \\+ ${p.HIDDEN} \\+ ${p.HIDDEN}\\*${p.OUTPUTS} \\+ ${p.OUTPUTS} = \\*\\*${p.PARAM_COUNT}\\*\\*`),
    );
    expect(head, 'mlp.ts başlığı ağırlıklı bağlantı sayısı yanlış').toMatch(
      new RegExp(`${p.INPUTS} \\+ ${p.HIDDEN} \\+ ${p.OUTPUTS} = \\*\\*${p.TOTAL_UNITS}\\*\\*`),
    );
    expect(head, 'mlp.ts başlığı ağırlıklı bağlantı sayısı yanlış').toMatch(
      new RegExp(
        `${p.INPUTS * p.HIDDEN} \\+ ${p.HIDDEN * p.OUTPUTS} = \\*\\*${p.WEIGHTED_CONNECTIONS}\\*\\*`,
      ),
    );
    expect(head, 'mlp.ts başlığı matris boyutları yanlış').toMatch(
      new RegExp(
        `W1 ${p.INPUTS * p.HIDDEN} · b1 ${p.HIDDEN} · W2 ${p.HIDDEN * p.OUTPUTS} · b2 ${p.OUTPUTS}`,
      ),
    );
    expect(head, 'mlp.ts başlığı bias sayısı yanlış').toMatch(
      new RegExp(`${p.HIDDEN} \\+ ${p.OUTPUTS} = \\*\\*${p.BIASES}\\*\\*`),
    );

    // Algı vektörünün boyutu da kaynaktan gelmeli.
    const perception = readFileSync(join(ROOT, 'src/sim/behavior/perception.ts'), 'utf8');
    expect(perception, 'perception.ts gözlem boyutunu söylemiyor').toMatch(
      new RegExp(`${p.INPUTS} (boyutlu )?gözlem`),
    );
    expect(inputLabels('tr').length, 'girdi etiketleri sayısı INPUTS ile uyuşmuyor').toBe(p.INPUTS);
  });

  it('i18n sözlüğünde kullanılmayan anahtar/sözlük kalmıyor', () => {    // Tarama sonucu (temiz negatif): 23 üst düzey anahtardan yalnız `units`
    // (enerji birimi sözlüğü) hiçbir dosyada geçmiyordu; silindi.
    // Bu denetim yeni bir anahtar eklenip unutulduğunda yakalar.
    //
    // ⚠️ Önce DİNAMİK erişim olmadığı doğrulandı: `strings[x]` / `t[x]` gibi
    // desenler `getStrings(...)` sonucunu indekslemiyor. Aksi hâlde bu test
    // YANLIŞ POZİTİF üretirdi.
    const i18n = readFileSync(join(ROOT, 'src/i18n/index.ts'), 'utf8');
    const consumers = ['src', 'tests', 'e2e', 'scripts']
      .flatMap((d) => filesUnder(join(ROOT, d), (p) => /\.tsx?$/.test(p)))
      .filter((f) => !f.endsWith('src/i18n/index.ts'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const keys = [
      ...new Set([...i18n.matchAll(/^  ([a-zA-Z][A-Za-z0-9_]*):/gm)].map((m) => m[1] as string)),
    ];
    expect(keys.length, 'hiçbir i18n anahtarı bulunamadı — tarama boş döndü').toBeGreaterThan(10);
    const unused = keys.filter((k) => !new RegExp(`\\b${k}\\b`).test(consumers));
    expect(unused, `kullanılmayan i18n anahtarı: ${unused.join(', ')}`).toEqual([]);
  });

  it('worker in ürettiği her mesajın bir TÜKETİCİSİ var', () => {
    // ⚠️ Bu sınıfın iki üyesi vardı ve ikisi de sessizce kaybolmuştu:
    //   - `events`: yıllardır üretiliyordu, UI hiç dinlemiyordu (listEvents hatası)
    //   - `experimentResult`: stub üretiyordu, hiç dinleyici yoktu
    //
    // DENETİM BOŞ DÖNMEZ: worker'ın ürettiği tüm `post({ type: ... })`
    // tipleri sayılır ve tüketicisi olmayanlar kırmızıya döner.
    const worker = readFileSync(join(ROOT, 'src/worker/sim.worker.ts'), 'utf8');
    const produced = [
      ...new Set([...worker.matchAll(/post\(\{\s*type:\s*'([A-Za-z]+)'/g)].map((m) => m[1] as string)),
    ];
    expect(produced.length, 'worker mesaj türleri taranamadı').toBeGreaterThan(8);
    const consumerSrc = ['src/engine', 'src/ui', 'src/scene']
      .flatMap((d) => filesUnder(join(ROOT, d), (p) => /\.tsx?$/.test(p)))
      .concat([join(ROOT, 'src/App.tsx')])
      .filter((f) => !f.endsWith('src/worker/sim.worker.ts'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    // Kapsanmayan: `ack` taşıma protokolü olmayan tek yönlü komut yanıtıdır
    // (istemci `dispatch` ile TÜM mesajları dinleyicilere iletir, ama hiçbir
    // dinleyici bunu kontrol etmez — işlenmemiş altyapı, yanlış iddia değil).
    //
    // `pong` ÖNCE burada istisnaydı ve kaldırıldı: `ping`'i HİÇBİR yer
    // göndermiyordu, yani worker'daki işleyici erişilemez ölü koddu.
    // Gerçek bir gecikme ölçümü istenirse geri eklenmeli — ama o zaman
    // istisna da kaldırılmalı.
    const exempt = new Set(['ack']);
    const orphans = produced.filter((t) => !exempt.has(t) && !consumerSrc.includes(`'${t}'`));
    expect(orphans, `tüketicisi olmayan worker mesajı: ${orphans.join(', ')}`).toEqual([]);
  });

  it('deney düğmeleri ÇALIŞMADIĞINI iddia etmiyor', () => {
    // ⚠️ Ölü beyanın ÜRÜN yüzeyindeki hâli. Worker'daki `runExperiment`
    // yalnızca `{ queued: true }` yankılıyor; hiçbir deneyi başlatmıyor ve
    // `experimentResult` mesajının HİÇBİR abonelisi yok. Buna rağmen:
    //   - panel "Üç deney uygulamada çalışır" diyordu
    //   - düğme 400 ms sahte "Çalışıyor…" gösteriyordu
    //   - sonuç alanına aynı anda "Çalışıyor… Bu deney henüz çalıştırılmadı."
    //     yazılıyordu — kendi kendini çürüten bir iddia
    //
    // ⚠️ KORUMA KOŞULSUZ. Önceden "worker gerçekten koşuyorsa atla" diye
    // koşullu yazılmıştı ve OLAY TESPİTİ BOZUKTU: `experimentResult` mesaj
    // adı "experiment" kelimesini içerdiği için koşul her zaman yanlış dönüyor
    // ve koruma HİÇ ÇALIŞMIYORDU. Mutasyonla sınandı ve boş çıktı.
    // Şimdi: worker'ı bağlayan kişi bu testi BİLEREK güncellemek zorunda.
    const panel = readFileSync(join(ROOT, 'src/ui/ExperimentPanels.tsx'), 'utf8');
    expect(panel, 'panel sahte ilerleme taklidi yapıyor (setRunning)').not.toMatch(/setRunning\(/);
    expect(
      panel,
      'panel sonuç alanına hem koştu hem koşmadı diyen mesaj yazıyor',
    ).not.toMatch(/experiments\.running\}/);
    const i18n = readFileSync(join(ROOT, 'src/i18n/index.ts'), 'utf8');
    expect(i18n, 'panel deneylerin uygulamada çalıştığını söylüyor').not.toMatch(
      /uygulamada çalışır|run in-app/,
    );
    expect(i18n, 'dürüst notWired metni yok').toContain('notWired');
  });

  it('azaltılmış hareket: kullanıcı seçimi önce, sistem tercihi sonra', () => {
  // ⚠️ `systemPrefersReducedMotion()` yıllardır yazılıydı ama HİÇ ÇAĞRILMIYORDU:
  // localStorage boşken doğrudan `false` dönülüyordu. Yani `prefers-reduced-motion:
  // reduce` ayarlı kullanıcı tam animasyonlu sahneyi görüyordu — erişilebilirlik
  // tercihi sessizce yok sayılıyordu.
  const store = readFileSync(join(ROOT, 'src/engine/store.ts'), 'utf8');
  const fn = store.match(/function loadReducedMotion\(\): boolean \{[\s\S]*?\n\}/)?.[0] ?? '';
  expect(fn, 'loadReducedMotion bulunamadı').not.toBe('');
  // Önce KAYITLI KULLANICI SEÇİMİ: "1"→true, "0"→false, ikisi de sistem
  // tercihine düşmemeli.
  const stored = fn.indexOf('stored');
  const system = fn.indexOf('systemPrefersReducedMotion');
  expect(stored, 'kullanıcının localStorage seçimi okunmuyor').toBeGreaterThan(-1);
  expect(system, 'sistem tercihi hiç sorgulanmıyor').toBeGreaterThan(-1);
  expect(stored, 'sistem tercihi kullanıcı seçiminden ÖNCE gelmemeli').toBeLessThan(system);
  // Artık çağrılıyor olmalı — önceden ölüydü.
  expect(store.match(/systemPrefersReducedMotion\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
});

it('bir adı iki modül TANIMLAYAMAZ (ölü beyan sınıfının kapısı)', () => {
    // "genomeDistance" üç modülde üç farklı hesap olarak yaşıyordu; iki modül
    // aynı adı **tanımlıyordu** (üçüncüsü satır içi bir ifadeydi). Aynı adlı
    // iki tanım = içe aktarma yoluna göre farklı sayı üreten sessiz bir kova.
    //
    // Yeniden dışa aktarma (`export { x }` / `export { x } from …`) tanım
    // DEĞİLDİR ve bilinçli olarak eşleşmez: tek kanonik tanımın paylaşılması
    // tam olarak istenen şeydir.
    const defs = new Map<string, string[]>();
    for (const f of filesUnder(join(ROOT, 'src'), (p) => /\.tsx?$/.test(p))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)) {
        const name = m[1] as string;
        const list = defs.get(name) ?? [];
        list.push(f.replace(ROOT + '/', ''));
        defs.set(name, list);
      }
    }
    const dupes = [...defs.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `${name}: ${files.join(' + ')}`);
    expect(dupes, `aynı ad birden çok modülde tanımlı:\n${dupes.join('\n')}`).toEqual([]);
    // Tarama gerçekten dosya okuyor olmalı (boş dönse hep geçerdi).
    expect(defs.size).toBeGreaterThan(50);
  });

  it('HER genom parametresi hesaba katılmış (doğrudan maliyet VEYA belgeli muafiyet)', () => {
    // ⚠️ MODEL.md "Her parametrenin metabolik maliyeti vardır (basalCostFor)"
    // diyor — ama `bondAffinity` basalCostFor'da YOK. Doğrulayan biri onu
    // arar ve bulamaz, sözleşmenin yalan olduğunu sanır.
    //
    // Gerçek: bondAffinity'nin maliyeti DOLAYLI — daha çok bağ kuruluyor
    // (world.ts: `rng.inherit.float() < genome.bondAffinity`) ve bağ BAŞINA
    // bakım enerjisi ödeniyor. Yani maliyet var, ama kendi parametre terimi
    // olarak değil. Sözleşme bunu söylemiyordu.
    //
    // Bu koruma, ileride eklenebilecek 10. parametrenin hiçbir yerde
    // hesaba katılmadan geçmesini engeller: ya enerji.ts'te doğrudan maliyet
    // terimi olur, ya da burada gerekçeli muafiyet listesine girer.
    const energy = readFileSync(join(ROOT, 'src/sim/biology/energy.ts'), 'utf8');
    const STRUCTURAL = new Set<string>([
      // maliyeti kendi terimi değil, ÜRETİTTEN gelir (bağ sayısı → bakım enerjisi)
      'bondAffinity',
    ]);
    const uncosted = GENOME_KEYS.filter((k) => !energy.includes(`genome.${k}`) && !STRUCTURAL.has(k));
    expect(
      uncosted,
      `hiçbir yerde maliyeti olmayan genom parametresi: ${uncosted.join(', ')}`,
    ).toEqual([]);
    // Muafiyetler de gerekçesiz bırakılmamalı.
    for (const k of STRUCTURAL) {
      expect(GENOME_KEYS, `muafiyet listesinde olmayan parametre: ${k}`).toContain(k);
    }
    // MODEL.md muafiyeti de söylemeli.
    const model = readFileSync(join(ROOT, 'docs/MODEL.md'), 'utf8');
    expect(
      model,
      'MODEL.md bondAffinity maliyetinin dolaylı olduğunu belirtmiyor',
    ).toMatch(/bondAffinity[\s\S]{0,400}(dolaylı|bağ sayısı|bakım)/);
  });

  it('genom parametresi metabolik maliyetli (proje kuralı)', () => {
    // `cooperation` bedelsiz olsaydı düşük değerli bireyler her zaman kazanırdı
    // ve hileci deneyi anlamsızlaşırdı. Test maliyetin varlığını korur.
    const energy = readFileSync(join(ROOT, 'src/sim/biology/energy.ts'), 'utf8');
    expect(energy).toMatch(/COOPERATION_COST_K/);
    expect(energy).toMatch(/COOPERATION_COST_K \* genome\.cooperation/);
  });
});

describe('genom uzaklığı · tek tanım kuralı', () => {
  // ⚠️ Bu blok bir hatanın **ölçülmüş** kaydını korur.
  //
  // Kod tabanında `genomeDistance` adıyla ÜÇ tanım yaşıyordu:
  //   1. sim/genome.ts           → HAM (normalize değil)  ← kanıt paketi
  //   2. sim/experiments/colony  → NORMALİZE              ← rapor
  //   3. ui/Panels.tsx (satır içi reduce) → HAM            ← arayüz
  // Arayüz etiketi bunu "Atasal → torun genom uzaklığı" diye vaat ediyordu.
  //
  // ÖLÇÜLEN ETKİ (93 soy çifti, 8 tohum × 6000 tick): iki tanımın büyüklük
  // ortalaması neredeyse aynı (ham/normalize ≈ 1,02) — yani HAM SÜRÜM YANLIŞ
  // GÖRÜNMEZ. Ama soyların sıralaması %76'sında değişiyor, en büyük kayma 32
  // basamak. Hata ancak bakış açısından görünür.

  it('normalize eder: eşit göreli kayma, eşit katkı verir', () => {
    // ⚠️ SAYISAL DENEME. Metin taraması değil — davranışı ölçer, yani kod
    // yeniden yazılsa bile doğruyu yakalar. Ham sürümde bu test KIRMIZIDIR.
    //
    // senseRadius aralığı 2..7 (genişlik 5), motility 0..1 (genişlik 1).
    // İkisinde de tam **yarım aralık** kayma yapıyoruz: normalize sürümde
    // katkılar eşit olmalı, ham sürümde senseRadius 5 kat baskın çıkar.
    // Taban genom geçerli bir `Genome` olmalı; alanları elle yazmıyoruz
    // (proje kuralı: liste tek kaynaktan gelsin). `genomeDistance` yalnız
    // **farklara** baktığı için tabanın değerleri kendiliğinden geri düşer.
    const base = founderGenomes(new Rng(7), 1)[0] as Genome;
    const n = GENOME_KEYS.length;

    // senseRadius: 2 → 4.5 (2..7 aralığının yarısı = 2.5 birim)
    const srA = { ...base, senseRadius: 2 };
    const srB = { ...base, senseRadius: 4.5 };
    // motility: 0 → 0.5 (0..1 aralığının yarısı = 0.5 birim)
    const moA = { ...base, motility: 0 };
    const moB = { ...base, motility: 0.5 };

    const dSense = genomeDistance(srA, srB);
    const dMotility = genomeDistance(moA, moB);
    expect(dSense).toBeCloseTo(dMotility, 12);
    // Ham sürümde bu ikisi 5 kat farklı olurdu (0.2778 vs 0.0556).
    expect(dSense).toBeCloseTo(0.5 / n, 12);

    // Simetri ve sıfır kayma da korunmalı.
    expect(genomeDistance(srA, srA)).toBe(0);
    expect(genomeDistance(srA, srB)).toBeCloseTo(genomeDistance(srB, srA), 12);
  });

  it('kod tabanında genom uzaklığının YALNIZCA bir tanımı var', () => {
    const defs: string[] = [];
    for (const f of filesUnder(join(ROOT, 'src'), (p) => /\.tsx?$/.test(p))) {
      const src = readFileSync(f, 'utf8');
      if (/function\s+genomeDistance\s*\(/.test(src)) defs.push(f.replace(ROOT + '/', ''));
    }
    // İkinci bir tanım yazılırsa iki yüzey aynı adlı farklı sayı gösterir.
    expect(defs, `genom uzaklığı birden çok yerde tanımlı: ${defs.join(', ')}`).toEqual([
      'src/sim/genome.ts',
    ]);
    // Kanonik tanım gerçekten normalize ediyor (yoksa yukarıdaki sayısal test zaten
    // yakalar; buradaki kontrol niyetin kaydı).
    // ⚠️ DİKKAT: dosyanın tamamında `GENOME_BOUNDS[key]` aramak **boş** bir
    // denetlemeydi — `clampGenome`/`mutateGenome`/`randomGenome` da o satırı
    // içeriyordu, yani `genomeDistance` ham olsa bile geçiyordu. Ateşlenemeyen
    // denetleme hiç olmamasından kötüdür: yanlış güvence üretir. Bu yüzden
    // denetim **fonksiyonun kendi gövdesine** kısıtlı.
    const src = readFileSync(join(ROOT, 'src/sim/genome.ts'), 'utf8');
    const body = src.match(/function genomeDistance[\s\S]*?\n}/)?.[0] ?? '';
    expect(body, 'genomeDistance gövdesi bulunamadı').not.toBe('');
    expect(body, 'kanonik tanım normalize etmiyor (GENOME_BOUNDS kullanmıyor)').toMatch(
      /GENOME_BOUNDS\[key\]/,
    );
  });

  it('ürün yüzeyleri kanonik tanımı çağırıyor, kendi hesabını yapmıyor', () => {
    const panels = readFileSync(join(ROOT, 'src/ui/Panels.tsx'), 'utf8');
    // Soy paneli mesafeyi `genomeDistance(...)` ile almalı…
    expect(panels).toMatch(/genomeDistance\(l\.ancestorGenome, latest\.genome\)/);
    // …ve genom alanlarını elle toplamamalı.
    expect(panels).not.toMatch(/Object\.keys\([^)]*[Gg]enome/);

    // Kanıt paketi de aynı tanımı kullanmalı.
    const evidence = readFileSync(join(ROOT, 'src/worker/evidence.ts'), 'utf8');
    expect(evidence).toMatch(/from '\.\.\/sim\/genome\.ts'/);
    expect(evidence).toMatch(/genomeDistance\(founder\.genome, latest\.genome\)/);
  });

  it('worker sınırındaki genom tipleri sıkı (sessiz eksik parametre olmaz)', () => {
    const protocol = readFileSync(join(ROOT, 'src/worker/protocol.ts'), 'utf8');
    // Dört genom alanı vardı; `Record<string, number>` idi.
    expect(protocol).not.toMatch(/genome: Record<string, number>/);
    expect(protocol).not.toMatch(/meanGenome: Record<string, number>/);
    expect(protocol).not.toMatch(/ancestorGenome: Record<string, number>/);
    expect(protocol).toMatch(/ancestorGenome: Genome;/);
  });

  it('genom modülünün başlığı bayat parametre sayısı taşımıyor', () => {
    // ⚠️ `genome.ts` "Sekiz kalıtsal parametredir" diyordu; genom dokuz
    // parametreye çıktığında güncellenmemişti. Modül artık kanonik tanımın
    // evi olduğu için buradaki yanlış sayı özellikle yanıltıcı.
    const head = readFileSync(join(ROOT, 'src/sim/genome.ts'), 'utf8').slice(0, 600);
    expect(head).not.toMatch(/[Ss]ekiz kalıtsal parametre/);
    expect(head).toMatch(/[Dd]okuz kalıtsal parametre/);
  });
});

describe('ölü alet · dışa aktarım gerçekten tüketiliyor mu', () => {
  // ⚠️ Bu sınıfın ilk üyesi `listEvents` idi: yıllardır hiç çağrılmamış,
  // worker yanıtı üretiyordu ama arayüzde hiç işlenmiyordu. Yani **ölçülemez
  // alet**. Yeniden doğmasını engellemek için dışa aktarımlar taranıyor.
  //
  // Ölçüt bilinçli olarak GEREKSİ BİR AYRINTILILIK: sembol, tanımlandığı
  // dosya dışında **en az bir** dosyada geçmeli. Yalnız kendi dosyasında
  // geçmesi (tanımı + yorum satırı) "tüketiliyor" sayılmaz.
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      if (['node_modules', '.git', 'dist'].includes(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
    return out;
  };
  const corpus = ['src', 'tests', 'tools', 'e2e', 'scripts']
    .map((d) => join(ROOT, d))
    .filter((d) => {
      try {
        return statSync(d).isDirectory();
      } catch {
        return false;
      }
    })
    .flatMap(walk)
    .map((f) => [f, readFileSync(f, 'utf8')] as const);

  it('hiçbir dışa aktarım tüketilmeden kalmıyor', () => {
    const orphans: string[] = [];
    let scanned = 0;
    for (const [f, src] of corpus) {
      if (!f.includes(`${ROOT}/src/`)) continue;
      for (const m of src.matchAll(
        /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/gm,
      )) {
        scanned++;
        const name = m[1] as string;
        // Ölçüt: sembol tanımı dışında HİÇBİR YERDE geçmemeli.
        // "Yalnız kendi dosyasında geçiyor" ÖLÜ değildir — `GENOME_LABELS_TR`
        // gibi semboller `genomeLabels()` tarafından aynı dosyada tüketilir ve
        // sağlıklıdır. `listEvents`'ın öldüğü şey tanımlı olup HİÇ ÇAĞRILMAMASIYDI.
        //
        // ⚠️ İlk ölçüt "başka dosyada geçmeli" idi ve 12 yanlış pozitif üretti.
        // Dışa aktarımın kendisi gereksiz olabilir, ama kod ölü değildir.
        const total = corpus.reduce(
          (sum, [, t]) =>
            sum + (t.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0),
          0,
        );
        if (total <= 1) orphans.push(`${name}  (${f.replace(`${ROOT}/`, '')})`);
      }
    }
    // Politika kurulumu (fork/save yolu) TEK yerde durmalı.
    // Bu işlev bilinçli olarak iki kopyalanmıştı: `snapshot.ts` → `World`
    // içe aktardığı için world onu çağıramıyordu ve kopyayı yanına koymuştu.
    // Politika durumuna alan ekleyen birinin iki yeri de güncellemesi
    // gerekiyordu; birini unutmak fork/save yolunda sessiz öğrenme kaybı.
    // Doğru yer `behavior/policy.ts` — o modül hiçbir şeyi içe aktarmıyor.
    const policySrc = readFileSync(join(ROOT, 'src/sim/behavior/policy.ts'), 'utf8');
    expect(policySrc, 'kanonik politika kurulumu policy.ts içinde değil').toMatch(
      /function restorePolicyFromSnapshot/,
    );
    for (const f of ['src/sim/world.ts', 'src/sim/persistence/snapshot.ts']) {
      expect(
        readFileSync(join(ROOT, f), 'utf8'),
        `${f} kendi politika kurulumunu taşıyor — kopyadır, policy.ts'e taşı`,
      ).not.toMatch(/function restorePolicyFromSnapshot/);
    }

    // Tarama gerçekten dosya buldu mu — boş dönse denetim sessizce her şeyi geçer.
    expect(scanned, 'hiçbir dışa aktarım taranmadı').toBeGreaterThan(100);

    // ⚠️ **AÇIK BORÇ.** Aşağıdakiler taramada bulunan, **bağlanmamış** dışa
    // aktarımlardır. Bu turda her birinin ÜRÜN ETKİSİ araştırılmadı; "zararsız"
    // denmiş bir tescil değildir. Hepsi için geçerli tek gerekçe: yazılmış,
    // hiç çağrılmamış, silinmemiş. Ayrı temizlik geçişi gerekiyor.
    //
    // Bu turun düzelttikleri AYRI: `resourcesLeft` (ölü **ve yanlış**),
    // `useStrings` (ölü, dili yok sayan), `HABITAT_PALETTE`/`PALETTE` (ölü
    // takma ad), `splitsIntoMultiple` ve `maxSpeedFor` (kullanılmayan yardımcı
    // iken formülün satır içi kopyası yaşıyordu — kopyalar bağlandı).
    const KNOWN_UNWIRED: Record<string, string> = {
      // Ürün kararı gerektirenler:
      getRecord: 'ARAŞTIRILDI: kayıt özelliği BAĞLI (listRecords/saveRecord/deleteRecord/downloadJson UI kullanıyor); yalnız bu tek kayıt okuma yardımcısı boşta',
      estimateUsage: 'ARAŞTIRILDI: IndexedDB kota ölçümü; kayıt özelliği bağlı, yalnız bu yardımcı boşta',
      // Saf temizlik borcu — etkileri bu turda ARAŞTIRILMADI:
      ACTIONS: 'ARAŞTIRILDI: sayısal takma ad; ACTION_NAMES (4) ve MLP_SHAPE.OUTPUTS: 4 zaten eylem uzayını tanımlıyor. Zararsız',
      sweepShareThreshold: 'ARAŞTIRILDI: üç ölçüm hata sınıfının (sentinel / maksimum−ortalama / RNG akışı) HİÇBİRİNE girmiyor — eşleştirilmiş tasarım, her noktada new World({ seed: 3001 + i })',
      formatShareThreshold: 'sweepShareThreshold için biçimlendirici; işlevi ölü, zararsız',
      experimentInWorldEvolution: 'ARAŞTIRILDI ve DÜZELTİLDİ: üç ölçüm hatası bulundu (sentinel artefaktı, maksimum−ortalama, RNG akışı). Artık sonlu değilse hüküm vermiyor ve taban maksimumdan bağımsız akıştan geliyor',
      formatInWorldEvolution: 'experimentInWorldEvolution için biçimlendirici; işlevi ölü, zararsız',
      assertPolicyShape: 'ARAŞTIRILDI: mlp.ts içindeki aynı boyut kontrolünün ölü kopyası; asıl koruma orada çalışıyor. Zararsız',
      lifeMapOf: 'ARAŞTIRILDI: world.nicheSnapshot() için tek satırlık takma ad; canlı yol doğrudan nicheSnapshot() çağırıyor. Zararsız',
      RESOURCE_KINDS: "ARAŞTIRILDI: ['A','B'] dizisi ölü; asıl güvence ResourceKind TİPİ. Üçüncü tür eklenirse tip zaten derleme hatası verir. Zararsız",
      zeroTheta: 'ARAŞTIRILDI: createTheta() için takma ad, satır içi kopya yok. Zararsız',
      MLP_PARAMS: 'ARAŞTIRILDI: MLP_SHAPE.PARAM_COUNT için takma ad; asıl sabit mlp.ts içinde kullanılıyor. Zararsız',
    };
    const unexpected = orphans.filter((line) => {
      const name = line.trim().split(/\s+/)[0] as string;
      return !(name in KNOWN_UNWIRED);
    });
    expect(
      unexpected,
      `tüketilmeyen ve gerekçesiz dışa aktarım:\n${unexpected.join('\n')}`,
    ).toEqual([]);
    // Liste boşalmamalı: hepsi bağlanırsa bu denetim işe yaramaz olur.
    for (const [name, why] of Object.entries(KNOWN_UNWIRED)) {
      expect(why.length, `${name} için gerekçe yok`).toBeGreaterThan(20);
    }
  });
});

describe('arayüz · etiket kapsamı gerçekten kapsıyor mu', () => {
  // ⚠️ `GENOME_LABELS` için aynı sınıfın ikinci üyesi.
  //
  // `ACTION_LABELS_TR/EN` dört girdi, `MLP_SHAPE.OUTPUTS` dört çıktı — şu an
  // hizalılar. Ama aralarında **hiçbir bağ yoktu**: eylem uzayı 5'e çıksa
  // etiketler dörtte kalır ve panel beş eylemi dört adla gösterirdi.
  // Korunmayan tek şey hizalama.
  it('eylem etiketleri eylem uzayıyla aynı uzunlukta', () => {
    const n = MLP_SHAPE.OUTPUTS;
    expect(ACTION_NAMES.length, `eylem adları ${n} çıktıyla uyuşmuyor`).toBe(n);
    expect(ACTION_LABELS_TR.length, 'TR etiketleri eylem uzayından kısa').toBe(n);
    expect(ACTION_LABELS_EN.length, 'EN etiketleri eylem uzayından kısa').toBe(n);
    // Sıra da önemli: etiket[i] gerçekten ACTION_NAMES[i] için olmalı.
    for (let i = 0; i < n; i++) {
      expect(ACTION_LABELS_TR[i], `TR etiketi ${i} boş`).toBeTruthy();
      expect(ACTION_LABELS_EN[i], `EN etiketi ${i} boş`).toBeTruthy();
    }
    // TR/EN gerçekten ayrı listeler olmalı — biri diğerine kopyalanmışsa
    // dil değiştirmek hiçbir şey değiştirmez ve denetim bunu yakalamazdı.
    expect(ACTION_LABELS_TR[n - 1]).not.toBe(ACTION_LABELS_EN[n - 1]);
  });
});

describe('ölçüm · hüküm kendi kanıtına bağlı mı', () => {
  // ⚠️ ÖLÇÜLEN SAHTE POZİTİF. `forkScore`, organizma yoksa sentinel olarak
  // `-Infinity` döndürüyor. Rastgele tabanda tek bir ölüm yeter: ortalama
  // `-Infinity`, kazanç `+Infinity`, `Infinity > 0` doğru → deney
  // "canlı dünyanın dalında da işe yarıyor" diyordu.
  //   ÖLÇÜLDÜ (tohum 11, generations 0): taban -Infinity · kazanç +Infinity
  //   → hüküm: OLUMLU. Ölçümün kendisi yoktu.
  //
  // Deney rapora bağlı olmadığı için şimdilik sahte sonuç YAYINLANMIYOR —
  // ama bağlandığı anda yayınlanırdı. Koruma: sonlu olmayan değerle hüküm
  // verilmez.
  const arm = {
    baseline: 41.783,
    best: 64.812,
    gain: 23.029,
    startEnergy: 55,
    endEnergy: 58,
    spentMs: 1000,
  };
  // Kontrol kolu: arama YOK. Kendi kazancı **gürültü tabanıdır**.
  const CONTROL = { gain: 2.214, endEnergy: 58 };

  it('sonlu olmayan kazanç "işe yarıyor" hükmü ÜRETMEZ', () => {
    for (const bad of [
      { baseline: -Infinity, best: 58.9, gain: Infinity },
      { baseline: Number.NaN, best: 58.9, gain: Number.NaN },
      { baseline: 41.8, best: 64.8, gain: Number.NaN },
      { baseline: 41.8, best: 64.8, gain: Infinity },
    ]) {
      const r = readInWorldEvolution({ ...arm, ...bad }, CONTROL);
      expect(r, `hüküm "${r}" kanıtsız olumlu`).toContain('ÖLÇÜLEMEDİ');
      expect(r, `hüküm "${r}" kanıtsız olumlu`).not.toContain('işe yarıyor');
    }
  });

  it('toplayıcılar sonlu olmayan değerleri kendileri eler', () => {
    // ⚠️ Aynı sınıf, daha küçük ölçekte: tek bir NaN medyanı/ortalamayı
    // yutuyor ve rapor "—" diyordu — okuyucu "veri yok" ile "tek eksik alan
    // yüzünden kayboldu" ayırt edemiyordu. Çağıran taraf filtreliyordu ama
    // bu tesadüfdi; koruma TOPLAYICININ İÇİNDE olmalı.
    expect(medianOf([1, 2, 3])).toBe(2);
    expect(medianOf([1, Number.NaN, 3])).toBe(2);          // NaN yutmasın
    expect(medianOf([-Infinity, 2, 4])).toBe(3);           // -Infinity de yutmasın
    expect(Number.isNaN(medianOf([Number.NaN]))).toBe(true); // hepsi geçersizse tanımsız

    expect(medianOf([2, 2, 2, 99])).toBe(2);
    expect(medianOf([2, Number.NaN, 2, 99])).toBe(2);
  });

  it('rastgele taban SABİT bir referans (arama akışından bağımsız)', () => {
    // ⚠️ ÖLÇÜLEN HATA: taban örneği, aramanın RNG akışından ve nesil döngüsü
    // SONRASINDAN çiziliyordu. Döngü kaç kez `search.normal()` tükettiyse taban
    // o kadar kayıyor, yani iki kol FARKLI rastgele örneklemi karşılaştırıyordu
    // ve `generations: 0` geçerli bir kontrol olmaktan çıkıyordu.
    //   ÖLÇÜLDÜ (önce): kontrol taban(ort) 48.378 · evrim kolu 48.386
    //   ÖLÇÜLDÜ (sonra): ikisi de 43.773 — birebir aynı
    //
    // Buradaki koruma: taban çizimi KENDİ akışından, girdi olarak yalnız seed
    // alıyor. Arama ne kadar koşarsa koşsun sonuç değişemez.
    const a = baselineThetas(11, 4, 140);
    const b = baselineThetas(11, 4, 140);
    expect(a.length).toBe(4);
    expect(a[0]?.length).toBe(140);
    for (let i = 0; i < 4; i++) {
      expect(Array.from(a[i] as Float64Array), `taban örneği ${i} tekrarlanamıyor`).toEqual(
        Array.from(b[i] as Float64Array),
      );
    }
    // Farklı seed FARKLI taban vermeli (sabit ama anlamlı referans).
    const c = baselineThetas(12, 4, 140);
    expect(Array.from(c[0] as Float64Array)).not.toEqual(Array.from(a[0] as Float64Array));
  });

  it('sonlu ve pozitif kazanç olumlu hükmü korur', () => {
    expect(readInWorldEvolution(arm, CONTROL)).toContain('işe yarıyor');
  });

  it('sonlu ve negatif kazanç kazanç üretmedi der', () => {
    const r = readInWorldEvolution({ ...arm, gain: -3 }, CONTROL);
    expect(r).toContain('kazanç üretmedi');
    expect(r).not.toContain('işe yarıyor');
  });

  it('⚠️ hüküm TEK kazanca değil NET etkiye bakar (gürültü tabanı düşülür)', () => {
    // ÖLÇÜLEN HATA (19 Ekim 2026): kontrol kolu — yani **arama YOK** — kendi
    // kazancı +2,214 gösteriyordu. Sebep: taban örneği aramanın RNG akışından
    // ayrı çekildiği için "bulunan" ile taban **farklı örneklemlerden**
    // geliyor; fark sıfır değil, örneklem gürültüsü. Raporlanan kazanç
    // (12,251) bu gürültüyü içeriyordu.
    //
    // Burada: tedavi kazancı pozitif ama kontrolünki daha büyükse, ham
    // kazanç "işe yarıyor" derken **net** etki negatiftir. Hüküm NET'e bakar.
    const r = readInWorldEvolution(arm, { gain: 99, endEnergy: 58 });
    expect(r, 'gürültü tabanı düşülmedi').toContain('kazanç üretmedi');
    expect(r).not.toContain('işe yarıyor');
  });

  it('gürültü tabanı hükümde AÇIKÇA yazılır', () => {
    const r = readInWorldEvolution(arm, CONTROL);
    expect(r, 'gürültü tabanı okunmuyor').toContain('2.214');
    expect(r, 'net etik okunmuyor').toContain('net etki');
    // Tek tohum + güven aralığı yok sınırı metinde olmalı.
    expect(r, 'tek tohum sınırı yazılı değil').toMatch(/TEK tohum/);
    expect(r, 'güven aralığı yok sınırı yazılı değil').toMatch(/güven aralığı yok/);
  });
});

describe('yapısal sayılar kaynağa bağlı', () => {
  /**
   * Kullanıcıya **görünen** sayılar ve uygulamanın başlangıç değerleri
   * kaynak sabitten gelmelidir — elle yazıldığında sessizce ayrışırlar.
   *
   * · `App.tsx` başlangıç popülasyonunu `48` diye yazıyordu; `C.DEFAULT_POPULATION`
   *   da 48. İkisi bağımsızdı: sabit değişseydi uygulama eskisini kullanırdı.
   * · İnceleme panelinin metni "4+ hücreli yapı" diyordu; eşik `C.MULTICELL_THRESHOLD`
   *   (4). Eşik değişseydi **arayüz yanlış sayı** yazardı.
   */
  it('uygulamanın başlangıç popülasyonu C.DEFAULT_POPULATION', () => {
    const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
    expect(app, 'App.tsx popülasyonu sabitten almıyor').toMatch(
      /population:\s*C\.DEFAULT_POPULATION/,
    );
    expect(app, 'App.tsx elle popülasyon yazıyor').not.toMatch(/population:\s*\d+/);
  });

  it('arayüzün çok hücrelilik eşiği metni C.MULTICELL_THRESHOLD', () => {
    const i18n = readFileSync(join(ROOT, 'src/i18n/index.ts'), 'utf8');
    // Metin artık **yer tutucu** taşıyor; sayı sabitten gelir.
    expect(i18n, 'eşik metni sayıyı hâlâ elle yazıyor').toMatch(/threshold:\s*\n?\s*['"`][^'"`]*\{n\}/);
    expect(i18n, 'eşik metni sayıyı hâlâ elle yazıyor').not.toMatch(/eşiği: \d\+ hücreli/);
    expect(i18n, "İngilizce eşik metni sayıyı hâlâ elle yazıyor").not.toMatch(/a \d\+ cell structure/);

    // Render yeri sabiti geçiriyor.
    const panels = readFileSync(join(ROOT, 'src/ui/Panels.tsx'), 'utf8');
    expect(panels, 'panel eşik metnini sabitle doldurmuyor').toMatch(
      /format\(t\.inspector\.threshold,\s*\{\s*n:\s*C\.MULTICELL_THRESHOLD\s*\}\)/,
    );
  });

  it('görüntüleme tavanı: sahne elle kaynak sayısı yazmıyor', () => {
    // `Props.tsx` kaynak instancing kapasitesini **7 yerde** `64` diye yazıyordu
    // ve ayrıca ölü bir `x > 0 ? 64 : 64` koşulu ile `void` ifadeleri
    // taşıyordu. Artık tek sabit.
    const props = readFileSync(join(ROOT, 'src/scene/Props.tsx'), 'utf8');
    expect(props, 'sahne elle 64 yazıyor').not.toMatch(/(?<![0-9])64(?![0-9])/);
    expect(props, 'ölü maxField koşulu kaldırılmamış').not.toMatch(/maxField/);
  });
});

describe('ölü dışa aktarım kalmıyor', () => {
  /**
   * `src/` altındaki **hiçbir** dışa aktarım kullanılmıyor olmamalı.
   *
   * ⚠️ ÖLÇÜLEN: `C.MOBILE_CAPACITY` ve `C.COLONY_GENERATION_TARGET` gibi
   * **sabitler** hiç kullanılmıyordu; kullanılmayan bir sabit, "varmış gibi
   * duran" bir özellik vaadi. Aynı sınıf **tipler** için de geçerli:
   * `LifeDescriptors` ve `ExperimentSuiteReport` hiç içe aktarılmıyordu.
   *
   * Bu denetim sınıfın tamamını kapatır: yeni bir dışa aktarım eklenip
   * bağlanmazsa test kırmızıya döner ve **adını** yazar.
   */
  it('kullanılmayan dışa aktarım yok', () => {
    const roots = ['src', 'scripts', 'tools', 'tests', 'e2e', 'server'];
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(join(ROOT, dir))) {
        const rel = join(dir, entry);
        if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(entry)) files.push(rel);
      }
    };
    for (const r of roots) walk(r);

    const corpus = files
      .map((f) => readFileSync(join(ROOT, f), 'utf8'))
      .join('\n');

    // ⚠️ **Yorumlar sayılmaz.** İlk sürüm ham metni tarıyordu ve koruma
    // **kendi yorumuyla** kandırıldı: ölü tipin adı denetimin açıklama
    // metninde geçtiği için "kullanılıyor" sayılıyordu. Yorum bir **bağ**
    // değildir — ölü kodu belgelemek onu yaşatmaz.
    const stripComments = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const code = stripComments(corpus);

    const unused: string[] = [];
    for (const rel of files.filter((f) => f.startsWith('src/'))) {
      const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
      for (const m of src.matchAll(
        /^export (?:const|function|class|interface|type|enum) ([A-Za-z_][A-Za-z0-9_]*)/gm,
      )) {
        const name = m[1] as string;
        const uses = [...code.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length;
        const defs = [...src.matchAll(
          new RegExp(`^export (?:const|function|class|interface|type|enum) ${name}\\b`, 'gm'),
        )].length;
        if (uses - defs <= 0) unused.push(`${rel} :: ${name}`);
      }
    }
    expect(
      unused,
      `kullanılmayan dışa aktarımlar (sil ya da bağla):\n${unused.join('\n')}`,
    ).toEqual([]);
  });
});

describe('ölçüm · paylaşma eşiği taraması okuması veriden türüyor', () => {
  // ⚠️ ÖLÇÜLEN HATA (19 Ekim 2026): okuma metni "Varsayılan 0,82'de aktarım
  // **0**" diye **sert kodlanmıştı** ve artık yanlıştı (ölçüm: 0,82'de 4 tohumda
  // 2.140 aktarım). Dahası cümle kendi kendisiyle çelişiyordu: "0,82 ilk kez
  // tetikleniyor … 0,82'de aktarım 0".
  it('okuma ölçülen tohum sayısını taşır, bayat cümleyi taşımaz', () => {
    const r = sweepShareThreshold({ idleLevels: [0.82, 0.3], seeds: 1, ticks: 400 });
    const text = r.reading;
    expect(text, 'okuma tohum sayısını taşımıyor').toMatch(/\d+\/\d+ \*\*tohumda|tohumda tetikleniyor/);
    expect(text, "bayat 'Varsayılan 0,82'de aktarım 0' iddiası hâlâ var").not.toContain(
      "Varsayılan 0,82'de aktarım",
    );
    expect(text, 'okuma enerji korunumunu taşımıyor').toMatch(/Enerji korunumu/);
  });

  it('her eşik noktası kaç tohumda tetiklendiğini raporlar', () => {
    const r = sweepShareThreshold({ idleLevels: [0.82, 0.3], seeds: 1, ticks: 400 });
    for (const p of r.points) {
      expect(p.liveSeeds, `eşik ${p.idleLevel}: canlı tohum sayısı yok`).toBeGreaterThanOrEqual(0);
      expect(p.liveSeeds, `eşik ${p.idleLevel}: canlı tohum sayısı tohumları aşıyor`).toBeLessThanOrEqual(r.seeds);
    }
    // Formatter "kaç tohumda" sütununu basmalı.
    const text = formatShareThreshold(r);
    expect(text, 'formatter canlı tohum sütununu basmıyor').toMatch(/canlı tohum/);
  });

  it('⚠️ okuma metni verinin TERSİNİ iddia edemez', () => {
    // ⚠️ ÖLÇÜLEN HATA (19 Ekim 2026): okuma metni "eşiğin düşürülmesi
    // aktarımı artırıyor" diyordu — ama ölçülen veri bunun **tersini**
    // söylüyordu (0,5'te 12.610 aktarım, 0,3'te 2.026). Metin, verinin
    // söylediğinin tersini iddia ediyordu.
    //
    // Koruma: okuma metnindeki **yön** ile verideki yön aynı olmalı.
    const r = sweepShareThreshold({ idleLevels: [0.82, 0.5, 0.3], seeds: 1, ticks: 1200 });
    const live = r.points.filter((p) => p.liveSeeds > 0);
    if (live.length < 2) return; // veri bu koşuda ayrım üretmediyse sınır yok
    const first = live[0] as (typeof live)[number];
    const last = live[live.length - 1] as (typeof live)[number];
    const text = r.reading;
    if (last.transfers > first.transfers) {
      expect(text, 'veri artıyor ama metin azalıyor diyor').not.toContain('azaltıyor');
    } else if (last.transfers < first.transfers) {
      expect(text, 'veri azalıyor ama metin artıyor diyor').not.toContain('artırıyor');
    }
  });

  it('işaretli sayılar çift işaret üretmez', () => {
    // ⚠️ "kazanç +" elle yazılınca negatif değerde "+-12.739" oluyordu.
    expect(fmtSigned(3.316)).toBe('+3.316');
    expect(fmtSigned(-12.739)).toBe('-12.739');
    expect(fmtSigned(0)).toBe('0.000');
    expect(fmtSigned(Number.NaN)).toBe('—');
    const r = readInWorldEvolution(
      { baseline: 69.6, best: 61.7, gain: -7.9, startEnergy: 55, endEnergy: 62, spentMs: 100 },
      { gain: -12.7, endEnergy: 62 },
    );
    expect(r, 'çift işaret var').not.toContain('+-');
    expect(r, 'çift işaret var').not.toContain('++');

    // ⚠️ Aynı hata **formatter** satırında da vardı ve ilk düzeltmede
    // kaçmıştı: okuma metni düzeldi, tablo satırı "gürültü tabanı:
    // +-17.741" olarak kaldı. Koruma ikisini birlikte denetler.
    const point = {
      generations: 0,
      history: [] as number[],
      baseline: 65.983,
      baselineMean: 60.977,
      baselineDeaths: 0,
      baselineN: 4,
      best: 56.846,
      gain: -12.739,
      startEnergy: 55,
      endEnergy: 62,
      spentMs: 1626,
      finalPopulation: 139,
      finalMultiCellColonies: 1,
      largestColony: 3,
      worstLedgerResidual: 0,
    };
    const formatted = formatInWorldEvolution({
      seed: 11,
      forkTick: 3000,
      evaluateTicks: 1000,
      runs: 3,
      arms: [
        { label: 'kontrol (arama yok)', point },
        { label: 'evrim (6 nesil)', point: { ...point, generations: 6, best: 69.299, gain: 3.316 } },
      ],
      reading: 'x',
    });
    expect(formatted, 'formatter çift işaret üretiyor').not.toContain('+-');
    expect(formatted, 'formatter çift işaret üretiyor').not.toContain('++');
    expect(formatted, 'formatter gürültü tabanını göstermiyor').toMatch(/gürültü tabanı/);
  });
});

describe('ölçüm kodu · denetim zinciri bütünlüğü', () => {
  it('deney raporu üretilebilir durumda (bozuk sözdizimi yok)', () => {
    // Pipeline'ın üretim kodunda sözdizimi hatası olursa rapor sessizce
    // eski kalır. Burada en azından modülün okunabilir olduğunu doğrularız.
    for (const f of ['src/sim/experiments/ecology.ts', 'scripts/run-experiments.ts']) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      const open = (src.match(/\{/g) ?? []).length;
      const close = (src.match(/\}/g) ?? []).length;
      expect(open, `${f}: süşeli bozuk`).toBe(close);
    }
  });
});
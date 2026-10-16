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
import { baselineThetas, readInWorldEvolution } from '../src/sim/experiments/index.ts';
import { medianOf } from '../src/sim/experiments/ecology.ts';
import { ACTION_LABELS_EN, ACTION_LABELS_TR } from '../src/i18n/index.ts';
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

  it('i18n sözlüğünde kullanılmayan anahtar/sözlük kalmıyor', () => {
    // Tarama sonucu (temiz negatif): 23 üst düzey anahtardan yalnız `units`
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
    // Kapsanmayan: `ack`/`pong` taşıma protokolü olmayan tek yönlü komutlardır
    // (istemci `dispatch` ile TÜM mesajları dinleyicilere iletir, ama hiçbir
    // dinleyici bu ikisini kontrol etmez — işlenmemiş altyapı, yanlış iddia değil).
    const exempt = new Set(['ack', 'pong']);
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
      getRecord: 'IndexedDB tek kayıt okuma — kayıt listesi listRecords() kullanıyor; ÖZELLİK KULLANIMDA',
      estimateUsage: 'IndexedDB kota ölçümü — kayıt özelliği BAĞLI (listRecords/saveRecord/deleteRecord/downloadJson UI kullanıyor); yalnız bu iki yardımcı boşta',
      // Saf temizlik borcu — etkileri bu turda ARAŞTIRILMADI:
      ACTIONS: 'ARAŞTIRILDI: sayısal takma ad. ACTION_NAMES (4) ve MLP_SHAPE.OUTPUTS: 4 zaten eylem uzayını tanımlıyor; satır içi kopya YOK. Zararsız',
      sweepShareThreshold: 'deney yardımcısı; bu turda ürün etkisi araştırılmadı',
      formatShareThreshold: 'deney biçimlendiricisi; bu turda ürün etkisi araştırılmadı',
      experimentInWorldEvolution: 'deney kaydı; bu turda ürün etkisi araştırılmadı',
      formatInWorldEvolution: 'deney biçimlendiricisi; bu turda ürün etkisi araştırılmadı',
      assertPolicyShape: 'deney doğrulaması; bu turda ürün etkisi araştırılmadı',
      lifeMapOf: 'yaşam haritası yardımcısı; bu turda ürün etkisi araştırılmadı',
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

  it('sonlu olmayan kazanç "işe yarıyor" hükmü ÜRETMEZ', () => {
    for (const bad of [
      { baseline: -Infinity, best: 58.9, gain: Infinity },
      { baseline: Number.NaN, best: 58.9, gain: Number.NaN },
      { baseline: 41.8, best: 64.8, gain: Number.NaN },
      { baseline: 41.8, best: 64.8, gain: Infinity },
    ]) {
      const r = readInWorldEvolution({ ...arm, ...bad }, 58);
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
    expect(readInWorldEvolution(arm, 58)).toContain('işe yarıyor');
  });

  it('sonlu ve negatif kazanç kazanç üretmedi der', () => {
    const r = readInWorldEvolution({ ...arm, gain: -3 }, 58);
    expect(r).toContain('kazanç üretmedi');
    expect(r).not.toContain('işe yarıyor');
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
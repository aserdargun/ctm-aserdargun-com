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
    // `genomeSignature` ve `genomeDistance` GENOME_KEYS ile gezmeli.
    expect(ecology).toMatch(/GENOME_KEYS\.map\(/);
    expect(readFileSync(join(ROOT, 'src/sim/experiments/colony.ts'), 'utf8')).toMatch(/for \(const key of GENOME_KEYS\)/);
  });

  it('genom parametresi metabolik maliyetli (proje kuralı)', () => {
    // `cooperation` bedelsiz olsaydı düşük değerli bireyler her zaman kazanırdı
    // ve hileci deneyi anlamsızlaşırdı. Test maliyetin varlığını korur.
    const energy = readFileSync(join(ROOT, 'src/sim/biology/energy.ts'), 'utf8');
    expect(energy).toMatch(/COOPERATION_COST_K/);
    expect(energy).toMatch(/COOPERATION_COST_K \* genome\.cooperation/);
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
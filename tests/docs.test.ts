/**
 * Cell to Mind — belge tutarlılık testleri.
 *
 * Bu projenin bütün disiplini şudur: **belge ölçümle uyuşmalı.** Ama
 * ölçüm kodunu değiştirdiğinde `docs/EXPERIMENTS.md` kendiliğinden
 * güncellenmez; yazılı sayı sessizce bayatlar. İki somut boşluk kapatılıyor:
 *
 *  1. **Bayat rapor.** Ölçüm kodu değiştiyse üretilmiş rapor yeniden
 *     üretilmelidir. Bu test, üretim kodunun son değişikliği raporun
 *     son değişikliğinden yeniyse **kırmızı** döner.
 *
 *  2. **Düzeltme kaydının bozulması.** Bir sayı düzeltildiğinde (ör. yanlış
 *     ölçümden gelen "%83 tek kutu" → doğrusu "%52") hem `VALIDATION.md`
 *     hem üretilmiş rapor aynı yeni sayıyı taşımalıdır. Sessizce geri
 *     dönülürse belge yeniden yanlışlaşır — bu, düzeltmenin kendisini
 *     geçersiz kılar.
 */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

/**
 * Bir dosyanın en son değiştiği commit'in zaman damgası (saniye).
 *
 * ⚠️ **Sığ klon tuzağı.** `actions/checkout` varsayılan olarak derinlik 1
 * (shallow) ile gelir ve sığ klanda yol filtresi **çalışmaz**:
 * `git log -1 --format=%ct -- <dosya>` sığ klonun sınırından bir tarih
 * döndürür — dosya o committe olmasa bile, ve dönen değer **sıfır değildir**.
 *
 * Ölçüldü: 1 commit'lik gerçek bir sığ klon (`--depth 1 --no-local`),
 * `ecology.ts` (HEAD commit'inde yok) için yine bir tarih verdi; tam klon
 * (19 commit) doğru tarihi verdi.
 *
 * ⚠️ İlk denemede "tarih 0 ise hata ver" nöbeti yazıldı ve **işe yaramadı**:
 * sığ klon 0 değil, sığ sınırdan geçerli bir tarih döndürdüğü için test yine
 * sessizce geçti. Doğru tespit "depo sığ mı" sorusudur.
 *
 * Sonuç: shallow konda bu test **anlamsız** değerlerle çalışır ve her şeyi
 * geçer gibi görünür. Bu yüzden:
 *   1. İş akışında `fetch-depth: 0` zorunlu kılındı.
 *   2. Burada sığ klon **açıkça hata** veriyor: sessiz geçen denetim, hiç
 *      denetimden iyidir ama neredeyse o kadar kötüdür.
 */
function lastCommitTime(rel: string): number {
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (shallow === 'true') {
    throw new Error(
      'Depo sığ klon (shallow): git yol filtresi güvenilir çalışmıyor, ' +
        'bayat rapor denetimi anlamsız tarihlerle sessizce geçer. ' +
        "CI'da actions/checkout'a `fetch-depth: 0` ekleyin.",
    );
  }
  const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', rel], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const t = Number(out || 0);
  if (!(t > 0)) {
    throw new Error(`git geçmişi yok (${rel} için tarih alınamadı). Sessizce geçmek yerine düşmelidir.`);
  }
  return t;
}

describe('belge tutarlılığı · üretilmiş rapor', () => {
  it('EXPERIMENTS.md var ve boş değil', () => {
    expect(read('docs/EXPERIMENTS.md').length).toBeGreaterThan(5000);
  });

  it('rapor, üretim kodundan sonra yeniden üretilmiş', () => {
    // ⚠️ Bu, projenin en sık yapacağı hatayı yakalar: ölçüm kodunu
    // değiştirip raporu üretmeyi unutmak. Böyle bir durumda rapordaki
    // sayılar eski koddan gelir ve belge yanlışlaşır — sessizce.
    const codeTime = Math.max(
      lastCommitTime('scripts/run-experiments.ts'),
      lastCommitTime('src/sim/experiments/ecology.ts'),
      lastCommitTime('src/sim/experiments/arena.ts'),
      lastCommitTime('src/sim/experiments/colony.ts'),
      lastCommitTime('src/sim/stats.ts'),
    );
    const reportTime = lastCommitTime('docs/EXPERIMENTS.md');
    expect(reportTime).toBeGreaterThan(0);
    expect(reportTime).toBeGreaterThanOrEqual(codeTime);
  });

  it('rapor her kayıtlı deney bölümünü içerir', () => {
    const report = read('docs/EXPERIMENTS.md');
    // Pipeline'ın ürettiği bölüm başlıkları. Biri eksikse rapor bayattır.
    for (const heading of [
      'Faz B1 · Ekolojik sönümlenme teşhisi',
      'Faz C1 · MODES açık uçluluk metrikleri',
      'Faz D · Niş kapsama (yaşam haritası çekirdeği)',
      'Dal (branch) doğruluğu ve maliyeti',
    ]) {
      expect(report, `raporda eksik bölüm: ${heading}`).toContain(heading);
    }
  });
});

describe('belge tutarlılığı · README sayıları', () => {
  // README'de elle yazılmış sayılar zamanla bayatlıyor: taramada
  // "56.159 koşu" ve "201 test" bulundu, gerçekleri 1.921 ve 208.
  // Bu test sayıları **kaynağa bağlıar**; elle güncellemek gerekmez.

  it('README deney koşu sayısı raporla aynı', () => {
    const report = read('docs/EXPERIMENTS.md');
    const runs = report.match(/\*\*Toplam koşu:\*\* (\d+)/)?.[1];
    expect(runs, 'raporda "Toplam koşu" satırı yok').toBeDefined();
    // README'de binlik ayracı kullanılır (1.921), raporda düz (1921).
    // Karşılaştırma sayısal: ayraçlar atılır.
    const readmeRuns = [...read('README.md').matchAll(/([\d.]+)\s+koşu/g)]
      .map((m) => Number(m[1].replace(/\./g, '')))
      .filter((n) => Number.isFinite(n) && n > 100);
    expect(readmeRuns, 'README\'de koşu sayısı bulunamadı').toContain(Number(runs));
  });

  it('README bölüm sayısı raporla aynı', () => {
    const sections = (read('docs/EXPERIMENTS.md').match(/^## /gm) ?? []).length;
    // Türkçe binlik ayracı olan biçim de kabul edilir (1.921).
    const forms = [String(sections), sections.toLocaleString('tr-TR')];
    expect(
      forms.some((f) => read('README.md').includes(`${f} bölüm`)),
      `rapor ${sections} bölüm, README'de eşleşen yok`,
    ).toBe(true);
  });

  it('README test sayısı gerçek test sayısına bağlı', () => {
    // ⚠️ İlk denemede bu denetim "makul aralık"a bakıyordu ve sayının
    // bayatlamasına **izin veriyordu** (README 208 derken gerçek 211 idi) —
    // yani tam olarak düzeltmeye çalıştığı sorunu çözmedi.
    //
    // Şimdi sayı **kaynaktan** sayılıyor. Vitest içinden kendi toplamını
    // okumak mümkün olmadığı için kaynak taraması kullanılıyor.
    //
    // ⚠️ Tarama **yorumları saymamalı**: bu dosyanın kendi açıklamasında geçen
    // kalıp (aşağıda) gerçek test olmadığı hâlde eşleşiyordu ve sayıyı iki
    // fazla gösteriyordu. Bu, düzeltmeye çalıştığımız bayatlığın ta kendisi:
    // **ölçüm aracı kendi dokümanını sayıyordu.** Satır başındaki girinti
    // zorunlu kılındı.
    const countTests = (): number =>
      readdirSync(resolve(ROOT, 'tests'))
        .filter((f) => f.endsWith('.test.ts'))
        .reduce((sum, f) => sum + (read(`tests/${f}`).match(/^\s+it\(/gm) ?? []).length, 0);

    const actual = countTests();
    const declared = read('README.md').match(/Vitest — (\d+) test/)?.[1];
    expect(declared, 'README\'de "Vitest — N test" satırı yok').toBeDefined();
    expect(Number(declared), `README ${declared} diyor, kaynakta ${actual} test var`).toBe(actual);
  });
});

describe('belge tutarlılığı · düzeltme kaydı', () => {
  it('ε>0 sonucu VALIDATION.md ile üretilmiş raporda AYNI', () => {
    // ⚠️ Yanlış ölçümden gelen "%83 tek kutu" düzeltilmiş ve "%52" olarak
    // kaydedilmişti. Sessizce geri dönülürse belge yeniden yanlışlaşır.
    const validation = read('docs/VALIDATION.md');
    const report = read('docs/EXPERIMENTS.md');

    // Raporun ε>0 satırından farkı çıkar.
    const m = report.match(/eşleştirilmiş fark \(dolu kutu, tohum başına\): \[([^\]]*)\]/);
    expect(m, 'raporda ε>0 fark satırı yok').not.toBeNull();
    const diffs = (m as RegExpMatchArray)[1]!.split(',').map((s) => Number(s.trim()));
    expect(diffs.length).toBeGreaterThanOrEqual(4); // 4 eşleştirilmiş tohum

    // Aynı fark dizisi VALIDATION.md'de de geçmeli.
    //
    // ⚠️ Belgeler farklı tire işaretleri kullanıyor: üretilmiş rapor ASCII
    // `-4` yazarken elle yazılan VALIDATION.md tipografik `−4` (U+2212) ve
    // `+4` kullanıyor. Test, **belgenin güzel tipografisini bozmamak** için
    // karşılaştırmadan önce normalleştiriyor; eşitliği ölçmek istiyoruz,
    // tire kodunu değil.
    const normalize = (s: string): string =>
      s.replace(/−/g, '-').replace(/,\s*\+/g, ',').replace(/\[\s+/g, '[').replace(/\s+\]/g, ']');
    const diffText = normalize(`[${diffs.map((d) => d.toFixed(0)).join(', ')}]`);
    expect(normalize(validation), 'VALIDATION.md fark dizisi rapordan farklı').toContain(diffText);

    // p = 1,0000 her iki belgede de aynı olmalı.
    expect(validation).toContain('p = 1,0000');
    expect(report).toContain('p = 1.0000');
  });

  it('kırık ölçümden gelen eski sayı geçersiz olarak işaretli', () => {
    const validation = read('docs/VALIDATION.md');
    // "%83 tek kutu" ifadesi geçiyorsa, yanlış olduğu da yazılmış olmalı.
    if (validation.includes('%83')) {
      expect(validation).toMatch(/geçersiz|yanlış|doğrusu/i);
    }
  });

  it('doğrulanmayanlar bölümü ε>0 ve gözlemci eksiklerini listeler', () => {
    const validation = read('docs/VALIDATION.md');
    const section = validation.slice(validation.indexOf('## 9. Doğrulanmayanlar'));
    expect(section).toContain('ε > 0');
    expect(section).toContain('CTM_API_KEY');
  });

  it('yol haritası Faz D kapanış kriterini başarısız olarak işaretler', () => {
    const roadmap = read('docs/ROADMAP.md');
    // Kapanış kriteri gerçekleşmedi; bu gizlenmemeli.
    expect(roadmap).toMatch(/harita dolmadı|varsayım çürütüldü|kapanış kriteri gerçekleşmedi/i);
  });

  it('PROGRESS S-4\'ü başarısız olarak işaretler', () => {
    const progress = read('docs/PROGRESS.md');
    // S-4 ölçüldü ve işe yaramadı; "yeni açıldı" yazması yanlış olurdu.
    const i = progress.indexOf('S-4');
    expect(i).toBeGreaterThan(0);
    const around = progress.slice(i, i + 260);
    expect(around).toMatch(/başarısız|denendi/i);
  });
});
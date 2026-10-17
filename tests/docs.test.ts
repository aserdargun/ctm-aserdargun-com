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
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

/**
 * Bir dosyanın **etkin** değişiklik zamanı (saniye).
 *
 * ⚠️ Neden `lastCommitTime` tek başına yetmez: git geçmişinden tarih okur,
 * yani **commit edilmemiş** değişikliği görmez. Ölçüldü: `colony.ts`
 * değiştirilip rapor üretilmeden çalıştırılan `npm run check` **yeşil** geçti,
 * aynı commit CI'da **kırmızı** oldu. Yerel kapı, tam da uyarması gerektiği
 * yerde sessiz kaldı.
 *
 * Düzeltme: dosya çalışma ağacında **değiştirilmiş**se mtime esas alınır.
 * Yalnız *değiştirilmiş* dosyada — çünkü `actions/checkout` her dosyaya taze
 * mtime verir; mtime'ı her zaman esas alsak temiz bir CI klonunda tüm dosyalar
 * raporun commit'inden yeni görünür ve denetim **daima** kırmızı olurdu.
 * Değiştirilmemiş dosyada git tarihi kullanılır, dolayısıyla CI doğru davranır.
 */
function effectiveCodeTime(rel: string): number {
  const committed = lastCommitTime(rel);
  const dirty = (() => {
    try {
      execFileSync('git', ['diff', '--quiet', 'HEAD', '--', rel], { cwd: ROOT });
      return false;
    } catch {
      return true;
    }
  })();
  if (!dirty) return committed;
  try {
    return Math.max(committed, Math.floor(statSync(resolve(ROOT, rel)).mtimeMs / 1000));
  } catch {
    return committed;
  }
}

/**
 * `docs/EXPERIMENTS.md` raporunun **gerçek** üretim girdileri: içe aktarma
 * grafiğinin `scripts/run-experiments.ts` kökünden başlayıp yalnız `src/` ve
 * `scripts/` altındaki dosyalara yayılan geçişli (transitive) kapanışı.
 *
 * Neden grafik: elle yazılmış dosya listesi **yeni bağımlılıkları görmez**.
 * Ölçülen örnek — `COOPERATION_COST_K` (`biology/energy.ts`) ve kanonik
 * `genomeDistance` (`sim/genome.ts`) eklendi; raporun sayıları değişti ya da
 * değişebilirdi, ama rapor-tazelik denetimi o dosyaları **izlemiyordu** ve
 * sessizce geçti. Elle liste ancak listeyi güncelleyen biri varsa tutar.
 *
 * Kapsam bilerek dar: `src/ui/` dışarıda bırakılır, çünkü arayüz rapora girmez.
 * Böylece arayüz değişiklikleri gereksiz yeniden üretim zorlamaz.
 */
function reportInputFiles(): string[] {
  const ROOT_FILE = 'scripts/run-experiments.ts';
  const seen = new Set<string>();
  const queue: string[] = [ROOT_FILE];
  // Yalnız kaynak içe aktarmaları: tip, değer ve `export ... from`.
  const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[^;'"]*?from\s*['"](\.[^'"]+)['"]/g;

  while (queue.length > 0) {
    const rel = queue.pop() as string;
    if (seen.has(rel)) continue;
    let src: string;
    try {
      src = readFileSync(resolve(ROOT, rel), 'utf8');
    } catch {
      continue; // dosya yoksa bu dal takip edilmez
    }
    seen.add(rel);
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] as string;
      // Uzantısız göreli içe aktarmaları çöz (`./genome.ts` ve `./genome`).
      const abs = resolve(ROOT, resolve(ROOT, rel, '..', spec));
      const child = abs.startsWith(ROOT + '/') ? abs.slice(ROOT.length + 1) : null;
      if (child && (child.startsWith('src/') || child.startsWith('scripts/'))) {
        queue.push(child);
      }
    }
  }
  return [...seen];
}

function section(text: string, marks: [string, string]): string {
  const i = text.indexOf(marks[0]);
  const j = text.indexOf(marks[1], i + 1);
  return i === -1 ? '' : text.slice(i, j === -1 ? text.length : j);
}

describe('belge tutarlılığı · üretilmiş rapor', () => {
  it('EXPERIMENTS.md var ve boş değil', () => {
    expect(read('docs/EXPERIMENTS.md').length).toBeGreaterThan(5000);
  });

  it('rapor, üretim kodundan sonra yeniden üretilmiş', () => {
    // ⚠️ Bu, projenin en sık yapacağı hatayı yakalar: ölçüm kodunu
    // değiştirip raporu üretmeyi unutmak. Böyle bir durumda rapordaki
    // sayılar eski koddan gelir ve belge yanlışlaşır — sessizce.
    //
    // ⚠️⚠️ İzlenen dosya listesi ARTIK ELLE YAZILMAZ (ölü ölçüm kapsamı).
    // Önceden yalnız 5 dosya izleniyordu: run-experiments, ecology, arena,
    // colony, stats. Ama raporun GERÇEK bağımlılıkları arasında
    // `sim/genome.ts`, `biology/energy.ts`, `world.ts`, `behavior/mlp.ts`,
    // `lab/lifeMap.ts`, `rng.ts` ve `types.ts` de var. `COOPERATION_COST_K`
    // (`energy.ts`) ve kanonik `genomeDistance` (`genome.ts`) eklenirken denetim
    // hiç kırmızıya basmadı — yani **tehlikeli yön** sessiz kalmıştı.
    // Liste artık içe aktarma grafiğinden türetilir.
    const codeTime = Math.max(...reportInputFiles().map(effectiveCodeTime));
    const reportTime = effectiveCodeTime('docs/EXPERIMENTS.md');
    expect(reportTime).toBeGreaterThan(0);
    expect(reportTime).toBeGreaterThanOrEqual(codeTime);
  });

  it('anlatı belgeleri üretilmiş raporun sayılarını TAŞIYOR', () => {
    // ⚠️ Bu, oturumda bulunan en sessiz sürüklenmeyi kapatır.
    //
    // `VALIDATION.md` §4.3–4.5 ve `PROGRESS.md` deney tablosu, dokuzuncu genom
    // parametresi eklenmeden (`766e0b9`) ÖNCEki koşuların sayılarını taşıyordu.
    // Hiçbir denetim bakmıyordu; yalnız bir sayı güncellendiğinde hepsi
    // sessizce eski kalıyordu.
    //
    // Değerler RAPORUN KENDİSİNDEN türetilir — sabit liste yazılmaz (o da aynı
    // hastalık). Rapor yeniden üretildiğinde belgelerin de değişmesi zorunlu
    // hâle gelir.
    const report = read('docs/EXPERIMENTS.md');
    // Belgeler tipografik eksi (U+2212) ve `+` kullanıyor; ölçtüğümüz şey
    // sayının değeri, işaret tipografisi değil.
    const norm = (s: string): string => s.replace(/−/g, '-').replace(/\s+/g, ' ');
    const grab = (re: RegExp): string[] => [...report.matchAll(re)].map((m) => m[1] as string);

    const kontrol = grab(/kontrol : (\d+\.\d{3})/g);
    const tedavi = grab(/tedavi  : (\d+\.\d{3})/g);
    const fark = grab(/fark    : (-?\d+\.\d{3})/g);

    // Türetme boş dönerse aşağıdaki döngüler hiçbir şeyi denetlemez.
    expect(kontrol.length, 'rapordan kontrol değeri türetilemedi').toBe(3);
    expect(tedavi.length, 'rapordan tedavi değeri türetilemedi').toBe(3);
    expect(fark.length, 'rapordan fark değeri türetilemedi').toBe(3);

    const validation = norm(read('docs/VALIDATION.md'));
    const progress = norm(read('docs/PROGRESS.md'));

    // ⚠️ Değerler belge GENELİNDE aranmıyor, **kendi bölümünde** aranıyor.
    // Sınama: §4.3 tablosundaki 2.083'i 2.33 yaptığımda genel arama yine yeşil
    // kaldı — çünkü "2.083" belgenin başka bir yerinde de geçiyordu. Yani genel
    // alt dizge denetimi "doğru sayı yanlış yerde" hatasını **kaçırır**.
    const vMarks = ['### 4.3 ', '### 4.4 ', '### 4.5 ', '### 4.6 '];
    const pMarks = ['| **1 · ', '| **2 · ', '| **3 · ', '| **Zorluk'];
    const section = (text: string, marks: string[], i: number): string => {
      const start = text.indexOf(marks[i] as string);
      expect(start, `bölüm bulunamadı: ${marks[i]}`).toBeGreaterThan(-1);
      const end = text.indexOf(marks[i + 1] as string);
      return text.slice(start, end === -1 ? text.length : end);
    };

    for (let i = 0; i < 3; i++) {
      const vSec = section(validation, vMarks, i);
      const pSec = section(progress, pMarks, i);
      for (const v of [kontrol[i], tedavi[i], fark[i]] as string[]) {
        expect(vSec, `VALIDATION bölüm ${i + 1} "${v}" değerini taşımıyor`).toContain(v);
        expect(pSec, `PROGRESS satırı ${i + 1} "${v}" değerini taşımıyor`).toContain(v);
      }
    }
  });

  it('VALIDATION §5.3 bağ kırılması ölçümleri raporla AYNI', () => {
    // ⚠️ Bu tablo rapordan alıntı ama KORUMASIZDI: medyan uzama 0,079 olarak
    // kalmıştı, rapor 0,066 diyordu. Aynı sınıfın §4.9'daki hâliydi.
    const report = read('docs/EXPERIMENTS.md');
    const strain = report.match(/kopma anındaki uzama: medyan\s+(\d+\.\d+)/)?.[1];
    const strength = report.match(/koptukları andaki medyan dayanım:\s+(\d+\.\d+)/)?.[1];
    const broken = report.match(/kopan (\d+) bağ/)?.[1];
    expect(strain, 'raporda kopma anı medyan uzaması yok').toBeTruthy();
    expect(strength, 'raporda kopma anı medyan dayanımı yok').toBeTruthy();
    expect(broken, 'raporda kopan bağ sayısı yok').toBeTruthy();
    // Bölüm kapsamlı — belge geneli araması düzeltme notundaki değeri
    // "bulunmuş" sayar (mutasyonla sınandı, önce yanlış negatif verdi).
    const sec = section(read('docs/VALIDATION.md'), ['### 5.3 ', '### 5.4 ']);
    const rowFor = (label: string): string | undefined =>
      sec.split('\n').find((l) => l.startsWith(`| ${label}`));
    const strainRow = rowFor('Koptukları andaki medyan uzama');
    expect(strainRow, '§5.3 medyan uzama satırı bulunamadı').toBeTruthy();
    expect(strainRow, `§5.3 medyan uzaması (${strain}) uyuşmuyor`).toContain(strain as string);
    const strengthRow = rowFor('Koptukları andaki medyan dayanım');
    expect(strengthRow, '§5.3 medyan dayanımı satırı bulunamadı').toBeTruthy();
    expect(strengthRow, `§5.3 medyan dayanımı (${strength}) uyuşmuyor`).toContain(strength as string);
    const brokenRow = rowFor('Kopan bağ sayısı');
    expect(brokenRow, '§5.3 kopan bağ satırı bulunamadı').toBeTruthy();
    expect(brokenRow, `§5.3 kopan bağ sayısı (${broken}) uyuşmuyor`).toContain(broken as string);
  });

  it('VALIDATION §4.9 evrimsel arama sayıları raporla AYNI', () => {
    // ⚠️ §4.9 "evrim bulur, REINFORCE bulamaz" iddiasının dayandığı bölüm.
    // Burada uzun süre **+0.161** yazıyordu; bu sayı ne güncel raporla ne de
    // kendinden önceki raporla uyuşuyordu — bölüm sessizce bayatlamıştı.
    // Taban örneğinin arama RNG'sinden çizilmesi düzeltilince kazanç
    // **0,215 → 0,071**'e düştü; iddia zayıfladı, yanlışlanmadı.
    const report = read('docs/EXPERIMENTS.md');
    const line = report.match(/DEĞERLENDİRME[^\n]*kazanç\s+(-?\d+\.\d+)/)?.[1];
    expect(line, 'raporda "DEĞERLENDİRME … kazanç" satırı bulunamadı').toBeTruthy();
    const gain = line as string;
    // ⚠️ BÖLÜM KAPSAMLI ARIAMA. Belge GENELİ alt dizge araması YANLIŞ
    // NEGATİF üretir: düzeltme notunda geçen değer, tablodaki bayat değeri
    // "bulunmuş" sayar. Sınandı — §5.3'te aynı hata vardı ve ikisi de düzeltildi.
    const sec = section(read('docs/VALIDATION.md'), ['### 4.9 ', '### 4.10 ']);
    // Bölüm yetmiyor: bölüm içinde aynı değer BAŞKA satırlarda da geçiyordu ve
    // mutasyon sınandı — yanlış negatif verdi. SPESİFİK TABLO SATIRI şart.
    const gainRow = sec.split('\n').find((l) => l.startsWith('| **Kazanım**'));
    expect(gainRow, '§4.9 kazanım satırı bulunamadı').toBeTruthy();
    expect(gainRow, `§4.9 kazanım satırı ${gain} taşımıyor`).toContain(`+${gain}`);
    const base = report.match(/DEĞERLENDİRME[^\n]*rastgele taban\(en iyi\)\s+(-?\d+\.\d+)/)?.[1];
    expect(base, 'raporda değerlendirme tabanı bulunamadı').toBeTruthy();
    const baseRow = sec.split('\n').find((l) => l.startsWith('| **Değerlendirme'));
    expect(baseRow, '§4.9 değerlendirme satırı bulunamadı').toBeTruthy();
    expect(baseRow, `§4.9 değerlendirme tabanı ${base} taşımıyor`).toContain(base as string);
  });

  it('anlatı belgeleri bayat test sayısı taşımıyor', () => {
    // PROGRESS.md "145 test, 4 dosya" diyordu; gerçek sayı kaynaktan gelir.
    const progress = read('docs/PROGRESS.md');
    expect(progress).not.toMatch(/\b145 test\b/);
    const readme = read('README.md');
    const declared = readme.match(/Vitest — (\d+) test/)?.[1];
    expect(declared, 'README test sayısı bulunamadı').toBeTruthy();
    expect(progress, 'PROGRESS.md test sayısını README ile aynı yapmalı').toContain(
      `${declared} test`,
    );
  });

  it('derin rapor, ÖLÇÜM boru hattından eski değil', () => {
    // ⚠️⚠️ Bu denetim **yanlış bağımlılığı** izliyordu ve sessizce geçiyordu.
    //
    // Önceden yalnız genomun **şekli** izleniyordu (`types.ts` + `genome.ts`).
    // Gerekçesi: "40 dk'lık üretim her kod değişikliğinde istenemez." Bu
    // gerekçe **ölçüm kapsamı ile kod kapsamını karıştırıyordu**. Yeniden
    // üretimi gerektiren şey kodun kendisi değil, **rapora giren** kod.
    // `reportInputFiles()` tam olarak o kümedir: `src/ui/`, `src/scene/`,
    // `src/engine/`, `src/worker/` dışarıda kalır, yani 3B ve arayüz işi
    // raporu bozmaz. "Her değişiklik" ile "raporu etkileyen değişiklik"
    // arasındaki farkı bu küme kapatır.
    //
    // ÖLÇÜLEN SONUÇ (14 Ekim 2026): DEEP o gün yeniden üretildi ve "Üreme
    // tıkanması" tablosu 41/246/110/18'den **29/235/98/25'e** değişti.
    // `VALIDATION.md` §5.11 bu tabloyu **kopyası** olarak taşıyordu ve 41'i
    // vermeye devam etti. 11 Ekim'de ikisi birebir aynıydı; sessizce
    // ayrıldılar ve **hiçbir denetim bakmadı** — çünkü genomun şekli
    // değişmemişti, sadece ölçüm kodu değişmişti.
    //
    // DEEP'i bayat sayan başka bir kanıt: evrimsel aramanın "DEĞERLENDİRME"
    // satırı pencereye **bağlı değil**. `evolvePolicy` çağrı yerinde
    // `trainTicks`/`evalTicks` sabit yazılıdır ve `args.deep`'i hiç okumaz.
    // Bu yüzden 40k ile 12k arasındaki o satır farkı pencere etkisi **olamaz**,
    // bayatlıktır. DEEP'te iki kez yanlışlanmış kazancı (0.215) taşıyordu.
    //
    // Kapsam genişletildi: DEEP aynı betikten, aynı girdi kümesiyle üretilir;
    // **ölçüm kodu değiştiyse DEEP'in sayıları eskidir**, genom şekli
    // değişmiş olsun olmasın.
    const codeTime = Math.max(...reportInputFiles().map(effectiveCodeTime));
    const deepTime = effectiveCodeTime('docs/EXPERIMENTS-DEEP.md');
    expect(deepTime).toBeGreaterThan(0);
    expect(
      deepTime,
      'EXPERIMENTS-DEEP.md ölçüm boru hattından eski — ' +
        '`npm run experiments -- --deep --out docs/EXPERIMENTS-DEEP.md` ile yeniden üret',
    ).toBeGreaterThanOrEqual(codeTime);
  });

  it('raporun bağımlılık kümesi boş değil (koruma türetmeyi başardı mı)', () => {
    // Yukarıdaki denetimin kendisi sessizce boş dönseydi `Math.max()` → `-Infinity`
    // olur ve **her şey geçerdi**. Türetilen küme gerçekten kapsayıcı mı?
    const files = reportInputFiles();
    expect(files.length).toBeGreaterThan(5);
    for (const must of [
      'src/sim/genome.ts',
      'src/sim/biology/energy.ts',
      'src/sim/world.ts',
      'src/sim/stats.ts',
      'src/sim/experiments/colony.ts',
    ]) {
      expect(files, `bağımlılık kümesi eksik: ${must}`).toContain(must);
    }
    // Arayüz rapora girmez; küme onu **içermemeli** (aksi hâlde her arayüz
    // değişikliği raporun yeniden üretilmesini gerektirirdi).
    expect(files.some((f) => f.startsWith('src/ui/'))).toBe(false);
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

describe('belge tutarlılığı · abartılmayan durum iddiaları', () => {
  // README'nin "Beş unsur nerede?" tablosu ölçümle **çelişiyordu**: aynı
  // dosyanın sonuç tablosu öğrenme için "❌ etki yok (p = 0.333)" derken,
  // unsur tablosu "✅ çalışıyor" diyordu. Üçüncü sınıf hata: **abartılmış
  // durum işareti**.
  //
  // Buradaki olgu şu: mekanizma çalışıyor, ama **sonuç üretildiği
  // gösterilmemiş**. Bu ikisi karıştırıldığında okuyucu yanlış anlıyor.

  it('etkisi ölçülmemiş mekanizmalar "✅ çalışıyor" iddiasında değil', () => {
    const readme = read('README.md');
    // ⚠️ İlk iki denemede bölüm ayrıştırması ve anahtar kelime filtresi
    // kullanıldı ve ikisi de yanlış sonuç verdi: önce "meşru" değişmez
    // kontrolleri ("Öğrenme kapalıyken ağırlıklar sabit | ✅"), sonra
    // **ölçülmüş kazanımları** yakaladı ("Evrim Atölyesi | ✅").
    //
    // Doğru yaklaşım: **yasaklanan satırları birebir** adlandır. Hem daha
    // sağlam, hem de neyi neden yasakladığını kendisi anlatıyor.
    const forbidden = [
      '| Gerçek ANN ile öğrenme | REINFORCE + hareketli baseline | ✅',
      '| Kalıtım, mutasyon, uyarlanma | `src/sim/genome.ts`, `src/sim/world.ts` | ✅',
      '| Tek hücreli → çok hücreli | Bağ grafiği, tomurcuk ayrılması, parçalanma | ✅',
    ];
    for (const row of forbidden) {
      expect(readme.includes(row), `abartılmış durum satırı geri geldi: ${row}`).toBe(false);
    }
  });

  it('README ölçülebilir etkisi olmayanları açıkça söylüyor', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/etkisi yok/);
    expect(readme).toMatch(/gösterilmedi/);
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
    // ⚠️ Önceden yalnız `validation.includes('%83')` kontrolü vardı ve
    // Belgede "geçersiz|yanlış|doğrusu" kelimelerinden BİRİ herhangi bir yerde
    // geçtiği için test HER ZAMAN geçiyordu — yani fiilen hep doğruydu. Kırık
    // sayının (%83.5, %83.6 gibi MEŞRU ölçümler değil) geçtiği her paragrafın
    // bir düzeltme işareti taşıması gerekir.
    const broken = /%83(?!\d)[^\n]{0,40}(organizma|kutuya birik)/;
    const marker = /geçersiz|yanlış|doğrusu|kullanılamaz|kırık|düzelt/i;
    const unmarked = validation
      .split(/\n\s*\n/)
      .filter((para) => broken.test(para) && !marker.test(para));
    expect(
      unmarked,
      `kırık %83 iddiası geçen ama geçersiz işaretlenmemiş paragraf:\n${unmarked.join('\n---\n')}`,
    ).toEqual([]);
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

/**
 * Üretilmiş raporların **anlatı katmanı**. Buradaki iki koruma bu oturumda
 * bulunan iki sessiz hatayı kapatır; ikisi de ölçüm kodundan değil,
 * metnin kendisinden geliyordu.
 */
describe('üretilmiş rapor · metin bütünlüğü', () => {
  const REPORTS = ['docs/EXPERIMENTS.md', 'docs/EXPERIMENTS-DEEP.md'];

  /** Kod blokları ve tablo satırları hariç, boş olmayan anlatı satırları. */
  function proseLines(markdown: string): { line: number; text: string }[] {
    const out: { line: number; text: string }[] = [];
    let fence = false;
    markdown.split('\n').forEach((raw, i) => {
      const t = raw.trim();
      if (t.startsWith('```')) {
        fence = !fence;
        return;
      }
      if (fence || t === '' || t.startsWith('|')) return;
      out.push({ line: i + 1, text: t });
    });
    return out;
  }

  it('hiçbir raporda tekrar eden cümle yok', () => {
    // ⚠️ ÖLÇÜLEN: `run-experiments.ts`in "Uzun vadeli dayanıklılık" bölümünde
    // metin dizisinde **aynı cümle iki kez** sayılıydı — 548. ve 549. satır.
    // Dizi boşlukla birleştirildiği için rapor şu haliyle yayımlanıyordu:
    //   "…uzun vadeli çöküşü gerçekten önlüyor mu?"
    //   "uzun vadeli çöküşü gerçekten önlüyor mu?"
    // Yani **her iki** raporda da cümle iki kez geçiyordu. Sayısal bir hata
    // değildi; üretilmiş belgenin kendisi çürük çıktı.
    //
    // Bu yüzden denetim satırın tamamen aynı olmasına değil, **önceki satırın
    // sonu** olmasına bakar — ekleme hatası satırı yinelemeden üretir.
    // ⚠️ Denetim **tüm raporları gezdikten sonra** bir kez doğrular.
    // İlk sürümde `expect` döngünün içindeydi: EXPERIMENTS.md'de hata bulunca
    // **fırlatıp döngüyü kesiyordu**, DEEP hiç denetlenmiyordu — yani
    // "DEEP temiz" değil, "DEEP'e bakılmadı". Aynı sınıf hata: rapor
    // denetimlerinin çoğu tek örneğe bakıp geçiyor.
    const bad: string[] = [];
    for (const rel of REPORTS) {
      const lines = proseLines(read(rel));
      for (let i = 1; i < lines.length; i++) {
        const prev = (lines[i - 1] as { line: number; text: string }).text;
        const cur = lines[i] as { line: number; text: string };
        // Kısa satırlar yanlış pozitif üretir (ör. "—" veya "```" izleri).
        if (cur.text.length < 12) continue;
        if (prev.endsWith(cur.text) || cur.text.endsWith(prev)) {
          bad.push(`${rel}:${cur.line}  …${prev.slice(-60)} ⏎ ${cur.text}`);
        }
      }
    }
    expect(bad, `tekrar eden cümle:\n${bad.join('\n')}`).toEqual([]);
  });
});

describe('derin profil anlatısı üretilmiş rapora bağlı', () => {
  it('§5.11 üreme tıkanması tablosu DEEP ile AYNI', () => {
    // ⚠️⚠️ ÖLÇÜLEN: `VALIDATION.md` §5.11, `docs/EXPERIMENTS-DEEP.md`nin
    // "Üreme tıkanması teşhisi" tablosunun **kopyasıdır** ve §10'daki kayıt
    // "tümü DEEP'e hizalandı" der. 11 Ekim'de doğruydu (41/246/110/18).
    // 14 Ekim'de DEEP yeniden üretilince tablo **29/235/98/25**'e değişti;
    // §5.11 sessizce eski kaldı. Satır satır **hiçbir sütunda uyuşmuyordu**.
    //
    // Sebep: DEEP'in tazelik denetimi yalnız *genom şeklini* izliyordu;
    // sayıları değiştiren şey ise ölçüm kodu idi.
    const deep = section(read('docs/EXPERIMENTS-DEEP.md'), [
      '## Üreme tıkanması teşhisi',
      '\n## ',
    ]);
    expect(deep, 'DEEP içinde "Üreme tıkanması teşhisi" bölümü bulunamadı').not.toBe('');

    // Sütun düzeni **sabit** olmalı; başlık tutmazsa eşleme sessizce kayar.
    const header =
      /tick\s+pop\s+org\s+küm\.dğ\s+bud\s+frag\s+kurucu soy\s+kurucu hücre\s+soy hücre\s+kol\.nesil\s+küme/.test(
        deep,
      );
    expect(
      header,
      'DEEP "Üreme tıkanması" tablosunun sütun düzeni değişti — eşleme güncellenmeli',
    ).toBe(true);

    // DEEP satırları: `tick pop org küm.dğ bud frag kurucu soy kurucu hücre soy hücre kol.nesil küme`
    // §5.11 bunun **alt kümesi**: kurucu soy / kurucu hücre / soy hücre sütunları yok.
    const WANTED = ['pop', 'org', 'küm.dğ', 'bud', 'frag', 'kol.nesil', 'küme'] as const;
    const DEEP_IDX = [0, 1, 2, 3, 4, 8, 9];

    const deepRows = new Map<number, string[]>();
    for (const raw of deep.split('\n')) {
      const t = raw.trim();
      if (!/^\d/.test(t)) continue;
      const cells = t.split(/\s+/);
      if (cells.length !== 11) continue;
      deepRows.set(Number(cells[0]), cells.slice(1));
    }
    expect(deepRows.size, 'DEEP tablosundan tick satırı okunamadı').toBeGreaterThanOrEqual(4);

    const sec = section(read('docs/VALIDATION.md'), ['### 5.11 ', '### 5.12 ']);
    expect(sec, 'VALIDATION §5.11 bulunamadı').not.toBe('');
    const valRows = new Map<number, string[]>();
    for (const raw of sec.split('\n')) {
      if (!raw.trim().startsWith('|')) continue;
      const cells = raw
        .split('|')
        .slice(1, -1)
        .map((c) => c.replace(/\*\*/g, '').trim());
      if (cells.length !== WANTED.length + 1) continue;
      const tick = Number((cells[0] as string).replace(/\./g, ''));
      if (!Number.isFinite(tick)) continue;
      valRows.set(tick, cells.slice(1));
    }
    expect(valRows.size, '§5.11 tablosundan tick satırı okunamadı').toBeGreaterThanOrEqual(4);

    const mismatch: string[] = [];
    for (const [tick, want] of valRows) {
      const have = deepRows.get(tick);
      if (!have) {
        mismatch.push(`tick ${tick}: DEEP'te yok`);
        continue;
      }
      WANTED.forEach((name, i) => {
        const a = have[DEEP_IDX[i] as number] as string;
        const b = want[i] as string;
        if (a !== b) mismatch.push(`tick ${tick} ${name}: §5.11=${b} DEEP=${a}`);
      });
    }
    expect(mismatch, `§5.11 DEEP'ten ayrışmış:\n${mismatch.join('\n')}`).toEqual([]);
  });

  // §5.12–§5.16'da tüm sütunları eşlemek **biçim belirsizliği** yaratıyor:
  // DEEP `26.3975427799%` yazarken belge `%26.4`, bağ ömrünü `2083` yerine
  // `2.083`, çöküş oranını `6.45454545` yerine `6.5×` yazıyor. Ondalık
  // basamağı farklı olan sayıları güvenilir biçimde eşlemek, korumanın
  // **yanlış negatif** üretmesine yol açar. Oysa bu bölümlerin bilimsel
  // iddiası tamamen **nüfus sayılarına** dayanıyor: §5.13 "52", §5.16 "55"
  // diyor. Nüfus tam sayıdır, biçimi tartışmasızdır — ve ters dönen iki hüküm
  // de tam olarak bu sütundan geliyordu. Koruma bu yüzden **nüfus sütununu**
  // bağlar.
  /**
   * Tablo anahtarını kanonik sayıya çevirir.
   *
   * ⚠️ **İki biçim çatışıyor.** Belge tick'i Türkçe binlik ayracıyla yazıyor
   * (`16.000` = on altı bin), strainK'yı ondalıklı yazıyor (`0.020` = 0,02).
   * Noktayı her yerde silmek `16.000 → 16`, her yerde bırakmak da `16.000 → 16`
   * demek; ikisi de yanlış. Bu yüzden mod açıkça seçiliyor. İlk denemede mod
   * yoktu ve §5.12/§5.15 "DEEP'te yok" diye kırıldı — anahtarlar 4/8/12/20
   * olarak karşılaştırılıyordu.
   */
  type KeyMode = 'int' | 'float';
  const keyOf = (raw: string, mode: KeyMode): number => {
    const lead = raw.match(/\d[\d.]*/)?.[0] ?? '';
    return mode === 'int' ? Number(lead.replace(/\./g, '')) : Number(lead);
  };

  function deepByKey(
    sec: string,
    width: number,
    popIdx: number,
    mode: KeyMode,
  ): Map<string, string> {
    const m = new Map<string, string>();
    for (const raw of sec.split('\n')) {
      const t = raw.trim();
      if (!/^[\d.]/.test(t)) continue;
      const c = t.split(/\s+/);
      if (c.length !== width) continue;
      m.set(String(keyOf(c[0] as string, mode)), c[popIdx] as string);
    }
    return m;
  }

  function validByKey(
    sec: string,
    width: number,
    popIdx: number,
    mode: KeyMode,
  ): Map<string, string> {
    const m = new Map<string, string>();
    for (const raw of sec.split('\n')) {
      if (!raw.trim().startsWith('|')) continue;
      const c = raw.split('|').slice(1, -1).map((x) => x.replace(/\*\*/g, '').trim());
      if (c.length !== width) continue;
      // Başlık satırı ("Tick", "strainK", "regen") ve ayırıcı satır (`|---|`)
      // sayı değildir. ⚠️ Ayırıcı satırın ilk hücresi `"---"`: içinde digit
      // yoksa `Number("") → 0` dönüyor ve koruma **0. satırı veri sanıyordu**.
      if (!/\d/.test(c[0] as string)) continue;
      const key = keyOf(c[0] as string, mode);
      if (!Number.isFinite(key)) continue;
      m.set(String(key), c[popIdx] as string);
    }
    return m;
  }

  /**
   * Bir anlatı tablosunun nüfus sütununu DEEP'in karşılığına bağlar.
   *
   * ⚠️ Boş dönerse **her şey geçer** — bu yüzden iki kümenin de dolu olduğu
   * ayrıca doğrulanır. Sıfır satır okuyan bir koruma, olmayan korumadan
   * daha kötüdür (yanlış güvence üretir).
   */
  function bindPopulation(
    label: string,
    deepHeading: string,
    deepWidth: number,
    popIdx: number,
    mode: KeyMode,
    validMark: [string, string],
    validWidth: number,
  ): void {
    const deep = section(read('docs/EXPERIMENTS-DEEP.md'), [deepHeading, '\n## ']);
    const val = section(read('docs/VALIDATION.md'), validMark);
    expect(deep, `${label}: DEEP bölümü bulunamadı`).not.toBe('');
    expect(val, `${label}: VALIDATION bölümü bulunamadı`).not.toBe('');
    const a = deepByKey(deep, deepWidth, popIdx, mode);
    const b = validByKey(val, validWidth, popIdx, mode);
    expect(a.size, `${label}: DEEP tablosu okunamadı (sütun düzeni değişmiş olabilir)`).toBeGreaterThan(2);
    expect(b.size, `${label}: VALIDATION tablosu okunamadı`).toBeGreaterThan(2);
    const bad: string[] = [];
    for (const [k, want] of b) {
      const have = a.get(k);
      if (have === undefined) bad.push(`anahtar ${k}: DEEP'te yok`);
      else if (have !== want) bad.push(`anahtar ${k}: belge=${want} DEEP=${have}`);
    }
    expect(bad, `${label} nüfus sütunu DEEP'ten ayrışmış:\n${bad.join('\n')}`).toEqual([]);
  }

  // ⚠️ `popIdx` bölümden bölüme değişir ve **elle** verilir: DEEP'in Faz B1
  // tablosunda `pop` ile `org` ayrı sütun olduğu için nüfus 1. sütundadır;
  // "Uzun vadeli dayanıklılık" tablosunda ise 2. sütundadır. Bunu sezgisel
  // bir kurala bağlamak (sütun sayısına bakmak) iki bölümü yanlış sütuna
  // bağlardı — ilk denemede tam olarak bu oldu.
  it('§5.12 nüfus sütunu Faz B1 tablosuyla AYNI', () => {
    bindPopulation('§5.12', '## Faz B1 · Ekolojik sönümlenme teşhisi', 12, 1, 'int', ['### 5.12 ', '### 5.13 '], 8);
  });

  it('§5.13 son popülasyonu uzun vadeli dayanıklılık tablosuyla AYNI', () => {
    bindPopulation('§5.13', '## Uzun vadeli dayanıklılık', 10, 2, 'float', ['### 5.13 ', '### 5.14 '], 10);
  });

  it('§5.15 popülasyonu 40.000 tick sınırı tablosuyla AYNI', () => {
    bindPopulation('§5.15', '## 40.000 tick sınırı', 10, 1, 'int', ['### 5.15 ', '### 5.16 '], 8);
  });

  it('§5.16 son popülasyonu kaynak rejenerasyonu tablosuyla AYNI', () => {
    bindPopulation('§5.16', '## Kaynak rejenerasyonu A/B', 11, 2, 'float', ['### 5.16 ', '### 5.17 '], 9);
  });

  it('§4.2 arena headroom tablosu raporla AYNI', () => {
    // ⚠️ Bu tablo `EXPERIMENTS.md`nin "Arena zorluk kalibrasyonu (headroom)"
    // bölümünün **elle kopyasıydı** ve hiçbir denetimi yoktu. Aynı sınıf:
    // §5.11–§5.16'nın DEEP'ten ayrılması gibi, üretilmiş çıktı yeniden
    // üretildiğinde kopya sessizce eski kalıyor.
    const report = read('docs/EXPERIMENTS.md');
    const rows = [...report.matchAll(/kaynak=\s*(\d+) → kontrol (\d+\.\d+) · headroom (\d+\.\d+) · hayatta kalma (\d+)%/g)];
    expect(rows.length, 'rapordan arena headroom satırı okunamadı').toBeGreaterThanOrEqual(4);

    const sec = section(read('docs/VALIDATION.md'), ['### 4.2 ', '### 4.3 ']);
    expect(sec, '§4.2 bulunamadı').not.toBe('');
    const bad: string[] = [];
    for (const [, n, kontrol, headroom, hayatta] of rows) {
      // Belge satırı: `| 14 | 0.753 | 0.247 | %100 |` ya da
      // `| 34 (oyun varsayılanı) | 0.922 | ... |` — anahtar hücrede etiket olabilir.
      const row = sec
        .split('\n')
        .find((l) => new RegExp(`^\\|\\s*\\**${n}\\b`).test(l.replace(/\*\*/g, '')));
      if (!row) {
        bad.push(`kaynak ${n}: §4.2'de satır yok`);
        continue;
      }
      const cells = row
        .split('|')
        .slice(1, -1)
        .map((c) => c.replace(/\*\*/g, '').trim());
      if (cells[1] !== kontrol) bad.push(`kaynak ${n} kontrol: §4.2=${cells[1]} rapor=${kontrol}`);
      if (cells[2] !== headroom) bad.push(`kaynak ${n} headroom: §4.2=${cells[2]} rapor=${headroom}`);
      if (cells[3] !== `%${hayatta}`) bad.push(`kaynak ${n} hayatta: §4.2=${cells[3]} rapor=%${hayatta}`);
    }
    expect(bad, `§4.2 rapordan ayrışmış:\n${bad.join('\n')}`).toEqual([]);
  });

  it('§1.4 deney testi sayısı kaynaktan gelir', () => {
    // ⚠️ Bölüm "71 test" diyordu; dosyada **94** vardı — 23 test eksik sayılmıştı.
    // Bölümün konusu zaten "deney yükünün doğruluğu"nu doğrulamak olduğuna
    // göre kendi test sayısının bayat kalması tam da bu bölümün konusunu
    // yanlış gösteriyordu. `it(` sayımı koşucuyla birebir aynı (ölçüldü: 94).
    const src = read('tests/experiments.test.ts');
    const actual = (src.match(/^\s*it\(/gm) ?? []).length;
    expect(actual, 'tests/experiments.test.ts içinde `it(` sayılamadı').toBeGreaterThan(10);
    const head = read('docs/VALIDATION.md').match(
      /^### 1\.4 Deney altyapısı \(`tests\/experiments\.test\.ts`, (\d+) test\)/m,
    )?.[1];
    expect(head, '§1.4 başlığında test sayısı bulunamadı').toBeTruthy();
    expect(Number(head), `§1.4 ${head} diyor, dosyada ${actual} test var`).toBe(actual);
  });
});

/**
 * `docs/MODEL.md`'nin **formül tablosu** kodun adlandırılmış sabitlerini
 * anlatıyor. Anlatı belgeleri §5.x'te olduğu gibi sessizce bayatlayabiliyor;
 * bu tablo bağımsız bir sözleşme ve bağımsız bir koruma gerektiriyordu.
 */
describe('MODEL.md formül tablosu koda bağlı', () => {
  /** `energy.ts` içindeki `C` nesnesinden sayısal sabit. */
  const constOf = (name: string): number => {
    const src = read('src/sim/biology/energy.ts');
    const m = src.match(new RegExp(`\\b${name}:\\s*([0-9.]+)`));
    expect(m, `energy.ts içinde ${name} bulunamadı`).toBeTruthy();
    return Number((m as RegExpMatchArray)[1]);
  };

  it('yoğunluk çarpanının bölücüsü STANDARD_CAPACITY ile AYNI', () => {
    // MODEL.md: `1 + DENSITY_COST_K · (popülasyon / 256)²`
    // energy.ts: `1 + C.DENSITY_COST_K * ratio * ratio`, ratio = pop / STANDARD_CAPACITY
    const model = read('docs/MODEL.md');
    const cap = model.match(/\(popülasyon \/ (\d+)\)/)?.[1];
    expect(cap, 'MODEL.md yoğunluk satırında kapasite sayısı bulunamadı').toBeTruthy();
    const actual = constOf('STANDARD_CAPACITY');
    expect(Number(cap), `MODEL.md bölücü ${cap}, kod STANDARD_CAPACITY=${actual}`).toBe(actual);
  });

  it('paylaşma verim çarpanı TRANSPORT_EFFICIENCY ile AYNI', () => {
    // MODEL.md: `min(fazla, açık) · SHARE_RATE · (0.25 + paylaşmaVerimi) · 0.72`
    // energy.ts: `... * C.SHARE_RATE * (0.25 + genome.shareEfficiency)` ve
    //            `TRANSPORT_EFFICIENCY: 0.72`
    const model = read('docs/MODEL.md');
    const eff = model.match(/paylaşmaVerimi\) · (0\.\d+)/)?.[1];
    expect(eff, 'MODEL.md paylaşma satırında taşıma verimi bulunamadı').toBeTruthy();
    const actual = constOf('TRANSPORT_EFFICIENCY');
    expect(Number(eff), `MODEL.md ${eff}, kod TRANSPORT_EFFICIENCY=${actual}`).toBe(actual);
  });

  it('yoğunluk maliyeti bazalı çarpar, hücre silmez (iddia kodda öyle)', () => {
    // MODEL.md: "**Yoğunluk maliyeti bir performans kırpması DEĞİLDİR** ve
    // hücre silmez." Bu iddia yalnız bir açıklama değil, kodda da doğrulanır:
    // çarpan `basalCostFor`'un **dönüş değerini** çarpar, ayrıca hiçbir yerde
    // hücre silme çağrısı yok.
    const energy = read('src/sim/biology/energy.ts');
    expect(
      energy,
      'basalCostFor yoğunluk çarpanını uygulamıyor — MODEL.md iddiası yanlış',
    ).toMatch(/\* densityFactor\s*;?\s*$/m);
    const cap = constOf('STANDARD_CAPACITY');
    expect(
      energy,
      'energy.ts hücre silen bir çağrı içeriyor; yoğunluk maliyeti iddiası geçersiz olurdu',
    ).not.toMatch(/cells\.delete\(|killCell|removeCell/);
    expect(cap).toBeGreaterThan(0);
  });
});

/** README'nin iddia tablosu — projenin en görünür sayı kaynağı. */
describe('README iddia tablosu rapora bağlı', () => {
  it('README iddia tablosu üretilmiş raporla AYNI', () => {
    // ⚠️ Bu tablo **hiçbir denetime bağlı değildi** ve iki gündür bayattı.
    // Ölçülen sapma:
    //   evrimsel arama   README +0.161 ↔ rapor **+0.032**  (5 kat)
    //   yaşam haritası   README 7/27, %52 ↔ rapor **8/27, %50**
    //   üreme çöküşü     README "pop 166 → 41" ↔ DEEP **213 → 29**
    //   uzun vadeli      README "kısmi hafifletiyor" ↔ ölçüm **hafifçe
    //                    kötüleştiriyor** (33 → 26) — yön bile değişmişti
    // Yani README, iki kez düzeltilmiş ölçümleri hâlâ manşet olarak
    // gösteriyordu. Koruma değerleri **rapordan türetir**.
    const report = read('docs/EXPERIMENTS.md');
    const deep = read('docs/EXPERIMENTS-DEEP.md');
    const readme = read('README.md');

    // 1) Evrimsel arama kazancı
    const gain = report.match(/DEĞERLENDİRME[^\n]*kazanç\s+(-?\d+\.\d+)/)?.[1];
    expect(gain, 'raporda DEĞERLENDİRME kazancı okunamadı').toBeTruthy();
    const gainRow = readme
      .split('\n')
      .find((l) => l.startsWith('| Evrimsel politika araması'));
    expect(gainRow, 'README evrimsel arama satırı yok').toBeTruthy();
    expect(gainRow, `README evrimsel arama satırı +${gain} taşımıyor`).toContain(`**+${gain}**`);

    // 2) Yaşam haritası doluluk kutusu
    const boxes = report.match(/→\s*(\d+)\/(\d+)\s+kutu dolu/)?.[0];
    expect(boxes, 'raporda yaşam haritası doluluk satırı okunamadı').toBeTruthy();
    const mapRow = readme.split('\n').find((l) => l.startsWith('| **Yaşam haritası**'));
    expect(mapRow, 'README yaşam haritası satırı yok').toBeTruthy();
    expect(mapRow, `README ${boxes} taşımıyor`).toContain(
      (boxes as string).match(/\d+\/\d+/)?.[0] as string,
    );

    // 3) Üreme çöküşünün son popülasyonu — DEEP'in üreme tablosundan
    const finalRow = deep
      .split('\n')
      .find((l) => l.trim().startsWith('40000') && l.trim().split(/\s+/).length === 11);
    expect(finalRow, 'DEEP üreme tablosunda 40000 satırı bulunamadı').toBeTruthy();
    const finalPop = (finalRow as string).trim().split(/\s+/)[1];
    const reproRow = readme
      .split('\n')
      .find((l) => l.startsWith('| Üreme tıkanması'));
    expect(reproRow, 'README üreme tıkanması satırı yok').toBeTruthy();
    expect(reproRow, `README son popülasyonu ${finalPop} taşımıyor`).toContain(`→ ${finalPop} |`);
  });

  /**
   * Anlatı belgelerindeki **her p-değeri** üretilmiş bir rapordan
   * izlenebilmelidir.
   *
   * ⚠️ Bu, iki ayrı denetimin tek hâlidir ve **neden buraya geldiği**
   * ölçülmüştür: README'de dokuz, PROGRESS'ta yedi bayat sayı çıktı ve
   * belgelerin hiçbiri denetime bağlı değildi. "Biri düzeldi" diye durup
   * diğerini bırakmak hastalığı tek yerde tedavi etmek olurdu; tarama
   * ikisini birden buldu.
   *
   * ⚠️ `VALIDATION.md` **kasıtlı olarak listede değil**: 170 KB'lık belge
   * §6 deney günlüğü olarak tarihsel kayıt taşıyor ve eski ölçümleri
   * *tarihsel* olarak aktarmak zorunda (bkz. 4e3abdd, §6 tarihsel günlük
   * olarak çerçevelendi). Onun yerine bölüm bazlı, rapora bağlı
   * korumalar var (§4.2–4.5, §4.9, §5.3, §5.11–5.16).
   */
  const NARRATIVE_PS_DOCS = ['README.md', 'docs/PROGRESS.md', 'docs/ROADMAP.md'] as const;

  it('§5.8 Y-2 derin ölçümü DEEP ile AYNI (pencere bağımlı)', () => {
    // ⚠️ ÖLÇÜLEN: §5.8 40.000 tick'lik ölçümü anlatıyor ama yalnız **standart**
    // rapora (12.000 tick) bakıyordu — derin ölçüm `EXPERIMENTS-DEEP.md`'de
    // üretiliyor ve bölüm onu hiç görmemişti. Sonuç **ters yöne** kaymıştı:
    //   bölüm  : kontrol −0.0112, tedavi −0.0056, "ölçüt karşılanmadı"
    //   DEEP   : kontrol **+0.0037**, tedavi **+0.0083** [0.0026, 0.0145],
    //             "ölçüt KARŞILANDI — kayma sıfırdan ayrışıyor"
    // Yani bölüm hem sayıyı hem **yönü** ve **hükmü** yanlış taşıyordu.
    const deep = section(read('docs/EXPERIMENTS-DEEP.md'), [
      '## Y-2 · Bağ ömrünün kalıtılabilirliği',
      '\n## ',
    ]);
    expect(deep, 'DEEP içinde Y-2 bölümü bulunamadı').not.toBe('');
    // Belge tipografik eksi (U+2212), rapor ASCII eksi kullanıyor.
    // ⚠️ Burada **virgül çevrilmez**: virgül aynı zamanda liste ayracı
    // (`[lo, hi]`) olduğu için genel dönüşüm aralığı `[−0.0056, +0.0131]`
    // biçimini `[−0.0056. +0.0131]` yapıyor ve eşleşme hiçbir zaman tutmuyor.
    const norm = (s: string): string => s.replace(/−/g, '-');
    const sec = norm(section(read('docs/VALIDATION.md'), ['### 5.8 ', '### 5.9 ']));
    expect(sec, '§5.8 bulunamadı').not.toBe('');

    // DEEP: `iki kol farkı 0.0046 [-0.0056, 0.0131] · p = 0.3302`
    const m = deep.match(/iki kol farkı (\d+\.\d+) \[(-\d+\.\d+), (\d+\.\d+)\] · p = (\d+\.\d+)/);
    expect(m, 'DEEP Y-2 fark/p-değeri okunamadı').toBeTruthy();
    const [, diff, lo, hi, p] = m as RegExpMatchArray;
    expect(sec, `§5.8 iki kol farkı ${diff} taşımıyor`).toContain(`+${diff}`);
    expect(sec, `§5.8 fark aralığı [${lo}, +${hi}] taşımıyor`).toContain(`[${lo}, +${hi}]`);
    expect(sec, `§5.8 p-değeri ${p} taşımıyor`).toContain(`p = ${p}`);
  });

  it('anlatı belgelerindeki her p-değeri bir raporda izlenebilir', () => {
    const sources = read('docs/EXPERIMENTS.md') + read('docs/EXPERIMENTS-DEEP.md');
    // Belge ondalık ayracı olarak virgül kullanıyor; rapor nokta.
    const norm = (s: string): string => s.replace(/,/g, '.');

    // ⚠️ Belge **yuvarlar**, rapor daha çok basamak basıyor: `p = 1,00`
    // ↔ rapor `p = 1.0000`; `p = 0.343` ↔ rapor `0.3435`. Dize eşleştirme
    // ikisini de "izlenemeyen" sayıyordu; doğrusu **sayısal** karşılaştırma.
    const reportPs = [...norm(sources).matchAll(/p\s*=\s*(\d+\.\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(reportPs.length, 'raporlarda p-değeri okunamadı').toBeGreaterThanOrEqual(5);

    // ⚠️ **Düzeltme notları hariç.** Depodaki kırık "%83" korumasının çözümü
    // aynı sorunu çözüyor: geçersiz sayıyı kayda geçiren paragraf da o sayıyı
    // içerir. İlk denemede denetim **kendi yazdığı** "önceden … p = 0,59
    // yazıyordu" notunu yakaladı — düzelttiğim hatayı geri getirmiş gibi gördü.
    const refuted = /önceden|bayatt?ı|geçersiz|düzelt|yanlışlan|eskiden/i;

    const summary: string[] = [];
    for (const rel of NARRATIVE_PS_DOCS) {
      const live = read(rel)
        .split(/\n\s*\n/)
        .filter((para) => !refuted.test(para))
        .join('\n');
      const ps = [...norm(live).matchAll(/p\s*=\s*(\d+\.\d+)/g)].map((m) => m[1] as string);
      const orphans = ps.filter((raw) => {
        const decimals = (raw.split('.')[1] ?? '').length;
        const want = Number(raw);
        return !reportPs.some((rp) => Number(rp.toFixed(decimals)) === want);
      });
      if (orphans.length > 0) summary.push(`${rel}: ${orphans.join(', ')}`);
    }
    // ⚠️ Tüm belgeler **tek seferde** toplanıp doğrulanıyor: `expect` döngünün
    // içindeyken ilk hata fırlatıp kalan belgeleri denetlemeyi kesiyordu
    // (aynı sınıf hata, bu dosyada ikinci kez).
    expect(
      summary,
      `anlatı belgelerinde var ama raporda izlenemeyen p-değerleri:\n${summary.join('\n')}`,
    ).toEqual([]);
  });
});
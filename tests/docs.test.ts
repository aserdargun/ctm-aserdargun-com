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
    const validation = read('docs/VALIDATION.md');
    expect(validation, `§5.3 medyan uzaması (${strain}) uyuşmuyor`).toContain(strain as string);
    expect(validation, `§5.3 medyan dayanımı (${strength}) uyuşmuyor`).toContain(strength as string);
    expect(validation, `§5.3 kopan bağ sayısı (${broken}) uyuşmuyor`).toContain(broken as string);
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
    const validation = read('docs/VALIDATION.md');
    expect(validation, `VALIDATION §4.9 raporun kazancını (${gain}) taşımıyor`).toContain(`+${gain}`);
    // Aynı satırdaki taban da taşınmalı.
    const base = report.match(/DEĞERLENDİRME[^\n]*rastgele taban\(en iyi\)\s+(-?\d+\.\d+)/)?.[1];
    expect(base, 'raporda değerlendirme tabanı bulunamadı').toBeTruthy();
    expect(validation, `VALIDATION §4.9 raporun tabanını (${base}) taşımıyor`).toContain(base as string);
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

  it('derin rapor, genomun tanımından eski değil', () => {
    // ⚠️ Asimetri **bilinçlidir**, gözden kaçmışlık değil.
    //
    // `EXPERIMENTS.md` (12.000 tick, ~13 dk) sık yeniden üretilir; yukarıdaki
    // kesin denetim ona uygulanır. `EXPERIMENTS-DEEP.md` 40.000 tick'tir ve
    // ~40 dk sürer; HER kod değişikliğinde yeniden üretmek uygulanamaz ve
    // denetimi işe yaramaz hâle getirirdi (insanlar atlama eğilimi).
    //
    // Asgari gereken koşul: genomun **şekli** değiştiyse (parametre eklendi/
    // çıkarıldı, sınır değişti) DEEP bayat sayılır. Aksi hâlde bir belge
    // **var olmayan bir genomu** raporlar.
    //
    // ÖLÇÜLEN: DEEP en son 1791719188'de üretilmişti; dokuz parametreli genom
    // ise 1791967248'de geldi — 2,9 gün sonra. DEEP'te "cooperation" ya da
    // "işbirliği" geçişi **0** kez. Yani gerçekten eski bir dünyayı anlatıyordu
    // ve hiçbir denetim buna bakmıyordu.
    const genomeShapeTime = Math.max(
      effectiveCodeTime('src/sim/types.ts'),
      effectiveCodeTime('src/sim/genome.ts'),
    );
    const deepTime = effectiveCodeTime('docs/EXPERIMENTS-DEEP.md');
    expect(
      deepTime,
      'EXPERIMENTS-DEEP.md genom tanımından eski — `npm run experiments -- --deep` ile yeniden üret',
    ).toBeGreaterThanOrEqual(genomeShapeTime);
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
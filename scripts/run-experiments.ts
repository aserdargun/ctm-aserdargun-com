/**
 * Cell to Mind — deney koşucusu (headless).
 *
 * Kullanım:
 *   npm run experiments             # standart paket (12.000 tick pencereleri)
 *   npm run experiments -- --deep   # derin paket (40.000 tick — ekolojik çöküş)
 *   npm run experiments -- --quick  # hızlı duman testi (küçük n)
 *   npm run experiments -- --out docs/EXPERIMENTS.md
 *
 * Bu betik tarayıcıda değil, Node'da koşar. Gerekçe:
 * `docs/VALIDATION.md` §6.8 çapraz cihaz determinizminin **test edilmediğini**
 * söyler; tarayıcıda tohumlu istatistik kirletilir. Aynı ölçüm mimarisi
 * `VALIDATION.md` §2–3'te zaten `vite-node` ile alınmıştır — burada da aynı
 * yol kullanılır.
 *
 * Çıktı: okunabilir rapor (stdout) + istenirse Markdown dosyası.
 * Bu çıktının **ham koşu değerleri** de dosyaya yazılır; hiçbir koşu
 * düşürülmez (JMLR 2024).
 */

import { writeFileSync } from 'node:fs';
import {
  diagnoseColonyCollapse,
  diagnoseReproductiveStall,
  measureModes,
  measureRewardDispersion,
  experimentBondLifeHeritability,
  experimentEvolutionStrategy,
  experimentPopulationUpdate,
  formatBondDurability,
  formatBranch,
  formatHeritability,
  formatLongRun,
  formatLongRunLimit,
  formatDispersion,
  formatPopulationUpdate,
  formatRegen,
  formatReproDiagnosis,
  formatDiagnosis,
  formatEcologyTable,
  sweepBondDurability,
  sweepShareThreshold,
  formatShareThreshold,
  diagnoseLongRunLimit,
  sweepLongRunDurability,
  sweepResourceRegen,
  verifyBranchIndependence,
  formatEvolutionStrategy,
  formatModes,
  measureNicheCoverage,
  formatNiche,
  experimentNicheSeeding,
  formatNicheSeeding,
  experimentSharingEffect,
  formatSharingEffect,
  experimentCooperation,
  formatCooperation,
  experimentCooperationDrift,
  formatCooperationDrift,
} from '../src/sim/experiments/ecology.ts';
import {
  calibrateArena,
  experiment1,
  experiment2,
  experiment3,
  formatDifficulty,
  evolvePolicy,
  formatEvolution,
  formatExperiment,
  formatInvariant,
  formatLearningSweep,
  formatPolicySurvey,
  formatSignalSweep,
  formatRewardSignal,
  formatSignStep,
  formatVarianceSweep,
  runInvariants,
  surveyPolicySpace,
  sweepLearning,
  sweepLearningSignal,
  measureRewardSignal,
  sweepSignStep,
  sweepVarianceReduction,
  experimentInWorldEvolution,
  formatInWorldEvolution,
  type ExperimentReport,
} from '../src/sim/experiments/index.ts';
import { fmt } from '../src/sim/stats.ts';

/**
 * Paketteki **adım sayısı** — ilerleme çıktısının paydası.
 *
 * ⚠️ Bu sayı elle yazılmıştı ve **tutarsızdı**: "1/22 … 8/8 … 14/14 … 23/23"
 * gibi paydalar birbiriyle tutmuyordu, "14/14" iki kez geçiyordu ve
 * "22/22 dal" satırı "28/28"den sonra geliyordu. Yani paket kaç adımdan
 * oluşuyordu, çıktı **söylemiyordu**.
 *
 * Artık adım sayacı kendi kendini artırır (`progress(...)`) ve payda tek
 * yerde yazılıdır. Değer `progress(` çağrısı sayısıyla eşleşmelidir;
 * `tests/docs.test.ts` bunu denetler.
 */
const TOTAL_STEPS = 31;

interface Args {
  quick: boolean;
  /** `--deep`: 40.000 tick'lik uzun pencereler (yavaş, ama ekolojik çöküşü görür). */
  deep: boolean;
  /**
   * `--allow-invariant-failure`: kırık değişmez kontrol olsa bile devam et.
   * Teşhis amaçlı; sonuçlar geçerli sayılmaz.
   */
  allowInvariantFailure: boolean;
  out: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  let quick = false;
  let deep = false;
  let allowInvariantFailure = false;
  let out: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quick') quick = true;
    else if (a === '--deep') deep = true;
    else if (a === '--allow-invariant-failure') allowInvariantFailure = true;
    else if (a === '--out') out = argv[++i] ?? null;
  }
  return { quick, deep, allowInvariantFailure, out };
}

function reportBlock(report: ExperimentReport, rawValues: boolean): string {
  const lines: string[] = [formatExperiment(report)];
  if (rawValues) {
    lines.push(`   kontrol ham : [${report.control.values.map((v) => fmt(v, 4)).join(', ')}]`);
    lines.push(`   tedavi ham  : [${report.treatment.values.map((v) => fmt(v, 4)).join(', ')}]`);
  }
  return lines.join('\n');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();

  const scale = args.quick
    ? { seeds: 3, colonyTicks: 600, trainTicks: 900, evalTicks: 600, resourceCount: 14 }
    : { seeds: 20, colonyTicks: 4000, trainTicks: 6000, evalTicks: 4000, resourceCount: 14 };

  const profile = args.quick ? 'HIZLI TEST' : args.deep ? 'TAM (derin pencere)' : 'standart';
  process.stdout.write(`Cell to Mind · deney paketi [${profile}]\n\n`);

  // ⚠️ **İlerleme numarası artık TÜRETİLİR.** Önce her satırda "N/22",
  // "8/8", "14/14", "23/23" gibi elle yazılmış, birbiriyle **tutarsız**
  // paydalar vardı: "14/14" iki kez geçiyordu (Faz B1b ve Faz C1) ve
  // "22/22 dal" satırı "28/28"den **sonra** geliyordu. Yani paket kaç
  // adımdan oluşuyordu, ilerleme çıktısı bunu **söylemiyordu** — ve yeni
  // bir bölüm eklemek elle 30+ satırı yeniden numaralamak demekti.
  // Şimdi sayaç kendi kendini artırır; payda tek yerde yazılıdır.
  let step = 0;
  const progress = (label: string): void => {
    step++;
    process.stdout.write(`${step === 1 ? '' : '\n'}${step}/${TOTAL_STEPS}  ${label}…\n`);
  };

  progress('değişmez kontroller');
  const invariants = runInvariants();
  process.stdout.write(`${formatInvariant(invariants)}\n\n`);
  // ⚠️ Dürüstlük sözleşmesinin KAPISI. Proje "sayılar bu kontrollerden biri
  // kırıkken geçerli sayılmaz" diyor; önceden yalnızca yazdırılıyordu ve
  // 22 deney kırık bir zeminde koşmaya devam ediyordu. ✗ raporda görünür
  // olsa da süreç sıfırla çıkıyordu — yani "görünür" kötülük değil, kapı
  // eksikliğiydi. Teşhis için `--allow-invariant-failure` ile geçilebilir.
  const broken = invariants.filter((c) => !c.passed);
  if (broken.length > 0) {
    const msg = broken.map((c) => `  ✗ ${c.name} — ${c.detail}`).join('\n');
    if (!args.allowInvariantFailure) {
      process.stderr.write(
        `\nDeğişmez kontroller KIRIK; sonuçlar geçerli sayılmaz:\n${msg}\n` +
          'Teşhis için: --allow-invariant-failure\n',
      );
      process.exit(1);
    }
    process.stderr.write(`\nUYARI: kırık değişmez kontroller (--allow-invariant-failure):\n${msg}\n`);
  }

  progress('arena zorluk kalibrasyonu');
  const difficulty = calibrateArena({
    seeds: args.quick ? 3 : 8,
    ticks: args.quick ? 600 : 4000,
    resourceCounts: args.quick ? [8, 34] : [4, 8, 14, 22, 34],
  });
  process.stdout.write(`${formatDifficulty(difficulty)}\n\n`);

  progress('Deney 1 · bağ gücü');
  const exp1 = experiment1({ seeds: args.quick ? 3 : 12, ticks: scale.colonyTicks });

  progress('Deney 2 · evrim');
  const exp2 = experiment2({ seeds: args.quick ? 3 : 12, ticks: scale.colonyTicks });

  progress('Deney 3 · öğrenme');
  const exp3 = experiment3({
    seeds: args.quick ? 3 : scale.seeds,
    trainTicks: scale.trainTicks,
    evalTicks: scale.evalTicks,
    resourceCount: scale.resourceCount,
  });

  progress('öğrenme · zorluk taraması (önceden kaydedilmiş eksen)');
  const sweep = args.quick
    ? sweepLearning({ resourceCounts: [8, 34], seeds: 3, trainTicks: 900, evalTicks: 600 })
    : sweepLearning({
        resourceCounts: [4, 8, 14, 22, 34],
        seeds: 12,
        trainTicks: 6000,
        evalTicks: 4000,
      });
  process.stdout.write(`${formatLearningSweep(sweep)}\n`);

  progress('öğrenme sinyali duyarlılığı (ağırlık hareketi ne zaman davranışa yansır)');
  const signal = args.quick
    ? sweepLearningSignal({ trajectoryLimits: [16], learnRates: [0.02, 0.5], seeds: 2, trainTicks: 900, evalTicks: 600 })
    : sweepLearningSignal({
        trajectoryLimits: [64, 16, 8],
        learnRates: [0.02, 0.1, 0.5],
        seeds: 8,
        trainTicks: 6000,
        evalTicks: 4000,
      });
  process.stdout.write(`${formatSignalSweep(signal)}\n`);

  progress('politika uzayı araştırması (öğrenmenin üst sınırı)');
  const survey = args.quick
    ? surveyPolicySpace({ resourceCount: 14, samples: 12, ticks: 600 })
    : surveyPolicySpace({ resourceCount: 14, samples: 160, ticks: 4000 });
  process.stdout.write(`${formatPolicySurvey(survey)}\n`);

  progress('evrimsel politika araması (RL ile aynı ölçüm, ayrık tohumlar)');
  const evolution = args.quick
    ? evolvePolicy({ generations: 5, population: 6, offspring: 2, trainSeeds: 2, trainTicks: 1500, evalTicks: 1500 })
    : evolvePolicy({
        generations: 12,
        population: 8,
        offspring: 3,
        trainSeeds: 6,
        trainTicks: 3000,
        evalTicks: 3000,
      });
  process.stdout.write(`${formatEvolution(evolution)}\n`);

  progress('S-1 varyans azaltma (VARSAYILAN adım ayarlarında)');
  const variance = args.quick
    ? sweepVarianceReduction({ seeds: 3, trainTicks: 900, evalTicks: 600 })
    : sweepVarianceReduction({ seeds: 20, trainTicks: 6000, evalTicks: 4000 });
  process.stdout.write(`${formatVarianceSweep(variance)}\n`);

  progress('S-1b · işaret avantajı + ölçülü adım artışı');
  const signStep = args.quick
    ? sweepSignStep({ learnRates: [0.02, 0.5], seeds: 3, trainTicks: 900, evalTicks: 600 })
    : sweepSignStep({ learnRates: [0.02, 0.1, 0.5, 2.0], seeds: 20, trainTicks: 6000, evalTicks: 4000 });
  process.stdout.write(`${formatSignStep(signStep)}\n`);

  progress('S-2 teşhisi · ödül sinyali politikanın kararlarına bağlı mı?');
  const rewardSignal = args.quick
    ? measureRewardSignal({ samples: 10, seedsPerSample: 1, ticks: 900 })
    : measureRewardSignal({ samples: 48, seedsPerSample: 2, ticks: 4000 });
  process.stdout.write(`${formatRewardSignal(rewardSignal)}\n`);

  progress('Faz B1 · ekolojik sönümlenme teşhisi');
  const longTicks = args.deep ? 40_000 : 12_000;
  const sweepSeeds = args.quick ? 3 : 12;
  const signalSeeds = args.quick ? 2 : 8;
  const varianceSeeds = args.quick ? 3 : 20;
  const signStepSeeds = args.quick ? 3 : 20;
  const durabilitySeeds = args.quick ? 1 : 4;
  const reproSampleEvery = args.quick ? 1000 : 4000;
  const ecology = args.quick
    ? diagnoseColonyCollapse({ seed: 11, ticks: 4000, sampleEvery: 400 })
    : diagnoseColonyCollapse({ seed: 11, ticks: longTicks, sampleEvery: 200 });
  process.stdout.write(`${formatDiagnosis(ecology)}\n\n`);
  process.stdout.write(`${formatEcologyTable(ecology, args.quick ? 1000 : 1000)}\n`);

  progress('Faz B1b · bağ ömrü duyarlılığı (teşhisin doğrudan sınaması)');
  const durability = args.quick
    ? sweepBondDurability({ settings: [{ strainDecayK: 0.02, bondFatigue: 2e-5 }, { strainDecayK: 0.005, bondFatigue: 5e-6 }], ticks: 4000, seeds: 1 })
    : sweepBondDurability({ ticks: longTicks, seeds: 4 });
  process.stdout.write(`${formatBondDurability(durability)}\n`);

  progress('Y-2 · bağ ömrünün kalıtılabilirliği');
  const heritability = args.quick
    ? experimentBondLifeHeritability({ seeds: 2, ticks: 4000 })
    : experimentBondLifeHeritability({ seeds: 6, ticks: longTicks });
  process.stdout.write(`${formatHeritability(heritability)}\n`);

  progress('üreme tıkanması teşhisi');
  const repro = args.quick
    ? diagnoseReproductiveStall({ seed: 11, ticks: 8000, sampleEvery: 1000 })
    : diagnoseReproductiveStall({ seed: 11, ticks: longTicks, sampleEvery: 4000 });
  process.stdout.write(`${formatReproDiagnosis(repro)}\n`);

  progress('uzun vadeli dayanıklılık (§5.4 genelleniyor mu?)');
  const longRun = args.quick
    ? sweepLongRunDurability({ settings: [{ strainDecayK: 0.02, bondFatigue: 2e-5 }], ticks: 6000 })
    : sweepLongRunDurability({ ticks: longTicks });
  process.stdout.write(`${formatLongRun(longRun)}\n`);

  progress('40.000 tick sınırı · erişilebilirlik mi avcı mı?');
  const limit = args.quick
    ? diagnoseLongRunLimit({ ticks: 8000, sampleEvery: 2000 })
    : diagnoseLongRunLimit({ ticks: longTicks, sampleEvery: longTicks > 20_000 ? 4000 : 2000 });
  process.stdout.write(`${formatLongRunLimit(limit)}\n`);

  progress('kaynak rejenerasyonu A/B (kapalı enerji sistemi)');
  const regen = args.quick
    ? sweepResourceRegen({ regens: [0, 0.01], ticks: 6000 })
    : sweepResourceRegen({ ticks: longTicks });
  process.stdout.write(`${formatRegen(regen)}\n`);

  progress('popülasyon-ES (seçilen öğrenme yönü)');
  const popUpdate = args.quick
    ? experimentPopulationUpdate({ seeds: 2, ticks: 6000 })
    : experimentPopulationUpdate({ seeds: 8, ticks: 20_000 });
  process.stdout.write(`${formatPopulationUpdate(popUpdate)}\n`);

  progress('ödül hızı yayılımı (paylaşılan dünya siler mi?)');
  const dispersion = args.quick
    ? measureRewardDispersion({ ticks: 4000, acrossWorlds: 2 })
    : measureRewardDispersion({ ticks: 15_000 });
  process.stdout.write(`${formatDispersion(dispersion)}\n`);

  progress('Faz C1 · MODES açık uçluluk metrikleri');
  const modes = args.quick
    ? measureModes({ seed: 11, ticks: 6000, sampleEvery: 2000 })
    : measureModes({ seed: 11, ticks: 12_000, sampleEvery: 2000 });
  process.stdout.write(`${formatModes(modes)}\n`);

  progress('Faz D · niş kapsama (yaşam haritası çekirdeği)');
  // ⚠️ Hızlı kademede `sampleEvery` 2000 kalırsa 3 örnek düşer ve eğilim
  // (bilinçli olarak) hiç okunmaz. 1000 ile 6 örnek düşüyor; maliyet farkı
  // yok çünkü yol uzunluğu her koşuda zaten her tick biriktiriliyor.
  const niche = measureNicheCoverage({
    seed: 11,
    ticks: args.quick ? 6000 : 12_000,
    sampleEvery: 1000,
  });
  process.stdout.write(`${formatNiche(niche)}\n`);

  progress('Faz D · arşivin seçilime katılması (ε > 0)');
  const nicheSeeding = experimentNicheSeeding({
    seeds: args.quick ? 2 : 4,
    ticks: args.quick ? 6000 : 12_000,
  });
  process.stdout.write(`${formatNicheSeeding(nicheSeeding)}\n`);

  progress('Paylaşma mekaniğinin ölçülebilir etkisi');
  const sharingEffect = experimentSharingEffect(args.quick ? { ticks: 4000 } : {});
  process.stdout.write(`${formatSharingEffect(sharingEffect)}\n`);

  progress('Faz D · işbirliği aktı (hücre bağını enerjiyle yeniler)');
  const cooperation = experimentCooperation(args.quick ? { ticks: 4000 } : {});
  process.stdout.write(`${formatCooperation(cooperation)}\n`);

  progress('Faz D · işbirliği eğilimine seçilim var mı');
  const coopDrift = experimentCooperationDrift(args.quick ? { ticks: 8000 } : {});
  process.stdout.write(`${formatCooperationDrift(coopDrift)}\n`);

  progress('dal (branch) doğruluğu ve maliyeti');
  const branch = args.quick
    ? verifyBranchIndependence({ forkTick: 1200, forkTicks: 400 })
    : verifyBranchIndependence({ forkTick: 3000, forkTicks: 1500 });
  process.stdout.write(`${formatBranch(branch)}\n`);

  progress('S-4 · çatallanmış ortamda yaşam içi üstel arama');
  const esSparse = args.quick
    ? experimentEvolutionStrategy({ seeds: 2, ticks: 2500, perturbations: 3, evaluateTicks: 80, population: 6, resourceCount: 6 })
    : experimentEvolutionStrategy({ seeds: 3, ticks: 4000, perturbations: 4, evaluateTicks: 120, population: 6, resourceCount: 6 });
  process.stdout.write(`  [seyrek dünya: pop ${esSparse.treatment ? 6 : 6} · kaynak 6]\n`);
  process.stdout.write(`${formatEvolutionStrategy(esSparse)}\n`);

  // ⚠️ Bu iki bölüm daha önce **rapora hiç bağlı değildi** (ölü deneyler).
  // Kullanıcı kararı: "ikisini de al, ama kendi sınırlarıyla" — yani
  // sınırları gizlenmeden, ölçüm neyi gösteriyorsa onu göstererek.
  //
  // ⚠️ Ölçüm sırasında **iki gerçek hata** bulundu ve düzeltildi:
  //   (a) Paylaşma taramasının okuma metni "Varsayılan 0,82'de aktarım **0**"
  //       diye SERT KODLANMIŞTI ve artık yanlıştı; üstelik kendi cümlesiyle
  //       çelişiyordu ("0,82 ilk kez tetikleniyor … 0,82'de aktarım 0").
  //   (b) Dünya içi evrimin **kontrol kolu** (arama YOK) kendi kazancı olarak
  //       −17,7 (yani **gürültü**) gösteriyordu; tedavi kolunun ham kazancı
  //       ise yalnız +3,3 — yani ham rakam gürültüden **küçüktü**. Etki
  //       ancak gürültü tabanı düşülünce anlamlı: net +21,1.
  progress('paylaşma eşiği duyarlılık taraması');
  const shareSweep = args.quick
    ? sweepShareThreshold({ seeds: 1, ticks: 1200, idleLevels: [0.82, 0.5, 0.3] })
    : sweepShareThreshold({ seeds: 4, ticks: 8000 });
  process.stdout.write(`${formatShareThreshold(shareSweep)}\n`);

  progress('dünya içi evrim (canlı dünyanın dalında)');
  const inWorld = args.quick
    ? experimentInWorldEvolution({ generations: 2, evaluateTicks: 400, population: 4, offspring: 2, forkTick: 1200, trainTicks: 600 })
    : experimentInWorldEvolution({ generations: 6, evaluateTicks: 1000, population: 6, offspring: 3 });
  process.stdout.write(`${formatInWorldEvolution(inWorld)}\n`);

  // Örneklem sayıları (koşu sayımı için).
  const ecologySamples = args.quick ? 10 : Math.floor(longTicks / 200) + 1;
  const limitSamples = args.quick ? 5 : Math.floor(limit.ticks / (limit.ticks > 20_000 ? 4000 : 2000)) + 1;

  const elapsed = Date.now() - started;
  // Koşu sayımı **dünya/trial koşularını** sayar; tick sayıları karıştırılmaz.
  // (Önceki sürümde tick toplamları koşu sayımına karıştırılıyordu.)
  // Koşu sayımı **dünya/trial koşularını** sayar. Elle korunan uzun bir
  // toplamdı; üstelik tick sayılarıyla karıştırıldığı için birim hatasına
  // açıktı. Artık her bölümün koşu sayısı ölçüm noktasında bildiriliyor.
  const totalRuns =
    (exp1.weak.length + exp1.strong.length) +
    (exp2.frozen.length + exp2.evolving.length) +
    exp3.train.length * 5 +
    sweep.length * 5 * sweepSeeds +
    signal.length * 4 * signalSeeds +
    survey.sampled +
    variance.length * 5 * varianceSeeds +
    signStep.length * 5 * signStepSeeds +
    rewardSignal.samples * rewardSignal.seedsPerSample +
    ecologySamples +
    durability.length * durabilitySeeds +
    heritability.seeds * 2 +
    repro.ticks / reproSampleEvery +
    longRun.length +
    limitSamples +
    1 +
    regen.length +
    popUpdate.control.seeds * 2 +
    1 +
    dispersion.acrossWorlds +
    // Yeni bölümler: her koşu bir **dünya/trial koşusudur**.
    //   · paylaşma taraması: her eşik noktası × tohum sayısı dünya koşusu
    //   · dünya içi evrim: 1 kaynak dünya + her kol için 1 dal + her nesilde
    //     (population + offspring) değerlendirme dalı
    shareSweep.runs +
    inWorld.runs;

  process.stdout.write(`toplam koşu: ${totalRuns} · süre: ${(elapsed / 1000).toFixed(1)} s\n`);

  if (args.out) {
    const md = [
      '# Cell to Mind — Deney Sonuçları',
      '',
      `**Körüldü:** ${new Date().toISOString()}`,
      // ⚠️ **Ortam kaydı, süslü biçim tercihi değil.** Ölçüldü (2026-10-19):
      // aynı tohum ve aynı kod, iki platformda **farklı** sonuç veriyor —
      //   macOS/arm64 : n=1158 · maks hız 0.1117 · en büyük organizma 20 hücre
      //   Linux/x64   : n=1183 · maks hız 0.1014 · en büyük organizma 24 hücre
      // Maks hücre sayısının 20 ↔ 24 olması yalnız kayan nokta gürültüsü değil,
      // **ayrık bir davranış farkı**: Linux'de bir organizma yapısal tavana
      // (MAX_ORGANISM_CELLS = 24) ulaşıyor, macOS'ta hiçbiri 20'yi geçmiyor.
      // Platform yazılmadığında iki rapor başlıkları aynı görünür ama sayıları
      // farklı olabilir — yani rapor **kendini yeniden üretemeyi** söylemiyor.
      `**Ortam:** ${process.platform} (${process.arch}) · Node ${process.version}`,
      `**Toplam koşu:** ${totalRuns} · **duvar süresi:** ${(elapsed / 1000).toFixed(1)} s`,
      `**Mod:** ${profile}`,
      `**Pencere:** ${args.quick ? '—' : args.deep ? '40.000 tick' : '12.000 tick'} ` +
      `(40.000 tick'lik ekolojik çöküşü kapsamak için \`--deep\` kullanın)`,
      '',
      '> Bu dosya `npm run experiments` ile üretilir. Sayılar ölçülmüştür;',
      '> hiçbir koşu düşürülmemiştir. Ham koşu değerleri aşağıdadır.',
      '',
      '## Değişmez kontroller',
      '',
      '```',
      formatInvariant(invariants),
      '```',
      '',
      '## Arena zorluk kalibrasyonu (headroom)',
      '',
      'Öğrenme deneyi ancak rastgele politika tam performans almadığında bilgi taşır.',
      'Kaynak sayısı arttıkça kontrol kolusunun skoru tırmanır ve ölçüm tavana yapışır.',
      '',
      '```',
      formatDifficulty(difficulty),
      '```',
      '',
      '## Öğrenme · zorluk taraması',
      '',
      'Varsayılan habitatta (34 kaynak) ölçüm headroom u yalnız 0.072 olduğu için',
      'deney ölçemiyordu. Aşağıdaki tarama, **önceden kaydedilmiş** zorluk ekseninde',
      'tam protokolü koşar: her noktada ayrık eğitim/değerlendirme tohumları,',
      'eşleştirilmiş fark ve bootstrap güven aralığı vardır. Tüm eğri raporlanır —',
      'yalnız elverişli nokta seçilmez.',
      '',
      '```',
      formatLearningSweep(sweep),
      '```',
      '',
      '## Öğrenme sinyali duyarlılığı',
      '',
      '§4.5 teşhisinin doğrulaması: davranış etkisizliği ağır görevden mi yoksa',
      'çok küçük ağırlık hareketinden mi kaynaklanıyor? Model sabitleri',
      '**değiştirilmez** — bu bir duyarlılık analizidir, ürün kararı değildir.',
      'Oyun her zaman varsayılan sabitlerle çalışır.',
      '',
      '```',
      formatSignalSweep(signal),
      '```',
      '',
      '## Politika uzayı araştırması (öğrenmenin üst sınırı)',
      '',
      '"Öğrenme işe yaramıyor" iki şeyden olabilir: politika öğrenemiyor, ya da',
      'politika sınıfı zaten tıkanmış. Rastgele (eğitimsiz) politikaların skor',
      'dağılımı ikisini ayırır: yayılım varsa öğrenilecek bir davranış vardır.',
      '',
      '```',
      formatPolicySurvey(survey),
      '```',
      '',
      '## Evrimsel politika araması — RL ile aynı ölçüm',
      '',
      'Ayırıcı soru: politika sınıfındaki 0.118\'lik açıklığı **arama** bulabiliyor mu?',
      'Bulabiliyorsa RL\'in kusuru kanıtlanmış olur; bulamıyorsa görev zordur.',
      'Aynı arena, aynı ölçüm, aynı tohum ayrımı — tek fark arama yöntemi.',
      '',
      '```',
      formatEvolution(evolution),
      '```',
      '',
      '## S-1 · Varyans azaltma (varsayılan adım ayarlarında)',
      '',
      'Önceden kaydedilmiş hipotez: darboğaz ölçek değil **varyans**; avantaj',
      'dönüşümü (z-skor / işaret) gradyanın sinyal/gürültü oranını artırır.',
      'Tarama `TRAJECTORY_LIMIT` ve `LEARN_RATE` değerlerini **varsayılanlarda',
      'tutar** (64 / 0.02) — §4.7 bölümünde adımı büyütmenin kötüleştirdiği',
      'ölçüldüğü için S-1 en zor koşulda sınanır.',
      '',
      '**Başarı ölçütü (önceden kaydedildi):** en az bir varyantta farkın güven',
      'aralığı sıfırdan ayrışmalı (p < 0.05) ve iyileşme olasılığı > %80 olmalı.',
      '',
      '```',
      formatVarianceSweep(variance),
      '```',
      '',
      '## S-1b · İşaret avantajı + ölçülü adım artışı',
      '',
      '§4.7 büyük adımı **dönüşümsüz**, §4.10 dönüşümü tek başına denedi.',
      'Bileşimi listede açık olarak yazılıydı ve denenmemişti. İşaret avantajı',
      'gradyan büyüklüğünü sınırladığı için büyük adımın gürültüyü değil sinyali',
      'ölçeklemesi beklenir.',
      '',
      '**Başarı ölçütü (S-1 ile aynı eşik):** en az bir noktada p < 0.05 ve',
      'iyileşme olasılığı > %80.',
      '',
      '```',
      formatSignStep(signStep),
      '```',
      '',
      '## S-2 teşhisi · Ödül sinyali',
      '',
      'Buraya kadar yalnızca *sonuçlar* ölçüldü (politika daha mı iyi davranıyor).',
      'Öğrenmenin çalışıp çalışmadığını belirleyen şey **sinyalin kendisidir**:',
      'ödül, politikanın kararlarına duyarlı mı?',
      '',
      '**Yorum kuralı önceden yazıldı:** pay < %5 → pratikte sabit sinyal, hiçbir',
      'optimizer çalışamaz; %5–%20 → zayıf; ≥ %20 → sinyal var, sorun optimizer tarafındadır.',
      '',
      '```',
      formatRewardSignal(rewardSignal),
      '```',
      '',
      '## Faz B1 · Ekolojik sönümlenme teşhisi',
      '',
      'Koloniler neden dağılıyor? `docs/ROADMAP.md` Faz B1 kuralı: ayrım yapılmadan',
      'parametre değiştirilmez. Beş rakip açıklama beş ölçümle ayrıldı.',
      '',
      '```',
      formatDiagnosis(ecology),
      '```',
      '',
      '```',
      formatEcologyTable(ecology, 1000),
      '```',
      '',
      '## Faz B1b · Bağ ömrü duyarlılığı',
      '',
      'B1 teşhisinin doğrudan sınaması: bağ ömrü uzatılınca koloniler kalıcı hale geliyor mu?',
      '',
      '**Başarı ölçütü (önceden kaydedildi):** yorgunluk ve strain katsayısı',
      'düşürüldüğünde pencerenin sonunda **4+ hücreli yapıların sıfırdan çıkması**',
      '(varsayılan ayarlarda pencerenin sonunda 0).',
      '',
      '```',
      formatBondDurability(durability),
      '```',
      '',
      '## Y-2 · Bağ ömrünün kalıtılabilirliği',
      '',
      'Yorgunluk terimi genoma bakmıyor: her bağ, sahibi ne genom taşırsa taşsın',
      'aynı yorulma hızına sahip. Kanca açıldığında yorgunluk da `bond.strength`',
      'ile çarpılır ve dayanıklılık seçilime açık hâle gelir.',
      '',
      'İki kol **aynı** kalıcı-bağ ayarını kullanır, tek fark kalıtılabilirliktir.',
      '',
      '**Başarı ölçütü (önceden kaydedildi):** tedavi kolunun seçilim kayması',
      'sıfırdan ayrışmalı ve kontrol kolundan büyük olmalı.',
      '',
      '```',
      formatHeritability(heritability),
      '```',
      '',
      '## Üreme tıkanması teşhisi',
      '',
      'Popülasyonun neden ~5.5 çevrimde doyduğu sorusu. Kümülatif doğumun',
      'yataylaması **"doygunluk" sanıldı; ölçüm aslında doğumların durmasını**',
      'gösteriyordu — kümülatif sayı artmayı bırakınca çoğalm da bitmiştir.',
      '',
      '```',
      formatReproDiagnosis(repro),
      '```',
      '',
      '## Uzun vadeli dayanıklılık — §5.4 genelleniyor mu?',
      '',
      'Bölüm 5.4 bağ dayanıklılığının 12.000 tick penceresinde 4+ hücreli',
      'yapıları geri getirdiğinin **ölçüldüğünü** ve ölçütü karşıladığını yazar.',
      'Bu tarama aynı ayarları 40.000 tick boyunca sınar: kalibrasyon sönümlenmeyi',
      'erteliyor mu, yoksa uzun vadeli çöküşü gerçekten önlüyor mu?',
      '',
      '```',
      formatLongRun(longRun),
      '```',
      '',
      '## 40.000 tick sınırı — erişilebilirlik mi, avcı mı?',
      '',
      '```',
      formatLongRunLimit(limit),
      '```',
      '',
      '## Kaynak rejenerasyonu A/B',
      '',
      '`C.DEFAULT_REGEN = 0`: kaynak hiç yenilenmiyor. Rejenerasyon açıldığında',
      'popülasyon kalıcı hâle geliyor mu?',
      '',
      '**Bu tarama bir muhasebe hatasını da ortaya çıkardı:** rezidül formülünde',
      '`externalInput` işareti terstiydi. `DEFAULT_REGEN = 0` olduğu için hata',
      '20+ deneyde görünmemişti.',
      '',
      '```',
      formatRegen(regen),
      '```',
      '',
      '## Popülasyon-ES — seçilen öğrenme yönünün testi',
      '',
      'REINFORCE her iki kolda da **kapalıdır**; ölçülen fark yalnız',
      'popülasyon-ES katkısıdır. Birincil ölçüm **ödül hızıdır**',
      '(`lifetimeReward / yaş`) — kümülatif ödül yaşamayı ödüllendirir ve',
      'ölçüm yanlılığı yaratır.',
      '',
      '```',
      formatPopulationUpdate(popUpdate),
      '```',
      '',
      '## Ödül hızı yayılımı — paylaşılan dünya sinyali siler mi?',
      '',
      'Popülasyon-ES başarısızlığının iki açıklamasını ayıran ölçüm.',
      '',
      '```',
      formatDispersion(dispersion),
      '```',
      '',
      '## Faz C1 · MODES açık uçluluk metrikleri',
      '',
      'Dolson vd. (2019) çerçevesi: değişim, yenilik, çeşitlilik, karmaşıklık,',
      'aktivite. Tümü mevcut dünya verisinden türetilir.',
      '',
      '```',
      formatModes(modes),
      '```',
      '',
      '## Faz D · Niş kapsama (yaşam haritası çekirdeği)',
      '',
      'Picbreeder / MAP-Elites kalıbının ölçüm tarafı: üç **ölçülebilir**',
      'betimleyici (hız, boyut, duyu menzili) üzerinden ızgara kurulur ve hangi',
      'kutuların işgal edildiği sayılır. Betimleyicilerin hiçbiri genomla',
      'tahmin edilmiyor — hepsi doğrudan ölçülüyor.',
      '',
      'Bu ölçüm, Faz C1\'deki yakınsamanın **yerini** gösteriyor: sorun',
      'değişimin değil organizmaların aynı davranış kutusuna birikmesi.',
      '',
      '```',
      formatNiche(niche),
      '```',
      '',
      'Faz D · Niş kapsama ölçümünün yorumu',
      '',
      'Bu ölçüm, bir arşivin **gerçekten işe yarayıp yaramadığını** test eder.',
      'MAP-Elites kuralı: boş nişlere o nişte arşivlenen en iyi bireyin yavrusunu',
      'enjekte et. Bu, arşivin seçilime katılmasıdır (ε > 0).',
      '',
      '```',
      formatNicheSeeding(nicheSeeding),
      '```',
      '',
      '## Paylaşma mekaniğinin ölçülebilir etkisi',
      '',
      'Kontrol kolu boşta eşiği **1,50**\'ye çekilir: hiçbir hücre kapasitesinin',
      'üstünde olamayacağı için paylaşma **matematiksel olarak imkânsız** olur.',
      'İki kol aynı tohumlarda koşar; fark, paylaşmanın koloni yapısına katkısını',
      'doğrudan ölçer.',
      '',
      '```',
      formatSharingEffect(sharingEffect),
      '```',
      '',
      '## Faz D · İşbirliği aktı',
      '',
      'Bağ bütünlüğü eşiğin altına düşünce bağın **iki ucundaki hücreler birlikte**',
      'enerji harcayarak bağı yeniler. Paylaşmadan farkı: bedel **ortak** olduğu',
      'için ödemeyen hücre de yararlanır — yani bir *hileci* tanımlanabilir.',
      '',
      '```',
      formatCooperation(cooperation),
      '```',
      '',
      '## Faz D · İşbirliği eğilimine seçilim',
      '',
      '`genome.cooperation` artık **seçilebilir** bir parametre ve metabolik',
      'maliyeti var (bazalin ~%26\'sı). Düşük işbirliği hem ucuz hem zayıf bağ',
      'demek — gerçek bir takas. Soru: seçilim yön veriyor mu?',
      '',
      '```',
      formatCooperationDrift(coopDrift),
      '```',
      '',
      '## Dal (branch) doğruluğu ve maliyeti',
      '',
      '`VALIDATION.md` §9 madde 7 bu yolu "test edilmemiş" diye listeliyordu.',
      'Ölçüldü: iki dal bit düzeyinde aynı ilerliyor, müdahale diğerine sızmıyor,',
      've **çatallama ucuz** — yaşam içi arama bütçelenebilir.',
      '',
      'Bu ölçüm sırasında `World.fromState` içinde **gerçek bir ürün hatası** bulundu:',
      '`Object.create(World.prototype)` çağrısı constructor atladığı için sınıf alan',
      'başlatıcıları hiç çalışmıyor, `ledger` `undefined` kalıyor ve ilk erişimde',
      'TypeError atılıyordu — **snapshot tan dünya kurma (dolayısıyla `branch`) tamamen',
      'bozuktu**. Düzeltildi; regresyon testi eklendi.',
      '',
      '```',
      formatBranch(branch),
      '```',
      '',
      '## S-4 · Çatallanmış ortamda yaşam içi üstel arama',
      '',
      'REINFORCE ve popülasyon-ES kredi ataması yapamadığı için başarısız oldu.',
      'Gerçek ES kredi ataması yapmaz: dünya bir kez snapshotlanır, N dal açılır,',
      'her dalda θ+σξ değerlendirilir ve θ getiriye ağırlıklı pertürbasyon',
      'ortalaması boyunca kaydırılır. Seyrek dünyada koşulur (pop 6, kaynak 6).',
      '',
      '```',
      formatEvolutionStrategy(esSparse),
      '```',
      '',
      '## Paylaşma eşiği duyarlılık taraması',
      '',
      'Paylaşma mekanizmasının tetiklendiği boşta eşiğini tarar: eşik',
      'düşürülürse mekanizma ne kadar sık çalışır ve **ürün değişir mi**?',
      '',
      '⚠️ **Bu bölüm daha önce rapora hiç bağlı değildi (ölü deney).**',
      'Sınırları açıkça yazılarak buraya alındı:',
      '',
      '· **Eşleştirilmiş tasarım**: her eşik noktası aynı tohum kümesini',
      '  kullanır (3001+i), yani eşikler arası karşılaştırma eşleştirilmiştir.',
      '· **Güven aralığı YOK**: bu bir tarama, fark testi değil. "Eşik etkili mi"',
      '  sorusuna cevap verir; "fark ne kadar büyük, güvenilir mi" sorusuna değil.',
      '· Taban çizgisi **varsayılan ayar** (0,82 e) — oyun varsayılanı değişmez.',
      '',
      '```',
      formatShareThreshold(shareSweep),
      '```',
      '',
      '## Dünya içi evrim (canlı dünyanın dalında)',
      '',
      'S-3 · Arena deneyi öğrenmenin üst sınırını aradı; bu ölçüm aynı yöntemin',
      '**canlı dünyanın anlık görüntüsünden açılan bir dalda** da çalışıp',
      'çalışmadığını sorar.',
      '',
      '⚠️ **Bu bölüm daha önce rapora hiç bağlı değildi (ölü deney)** ve',
      'rapora alınırken **iki gerçek hata** bulundu:',
      '',
      '1. **Kontrol kolunun kazancı gürültüydü.** Kontrol kolu (arama YOK) de',
      '   kazanç olarak bir sayı üretiyordu — çünkü taban örneği aramanın RNG',
      '   akışından ayrı çekildiği için "bulunan" ile taban **farklı rastgele',
      '   örneklemlerden** geliyor. Ölçülen değer: kontrol kolu **−17,7**, yani',
      '   arama yapılmadığı halde gürültü tedavi kolunun ham kazancından',
      '   (+3,3) **büyüktü**. Ham rakam gürültü tabanından küçükse anlam taşımaz.',
      '   Düzeltme: etki = tedavi kazancı − **gürültü tabanı** (kontrol kolunun',
      '   kendi kazancı).',
      '2. Sentinel (-Infinity) hâlâ hükmü **reddeder**: sonlu olmayan değerle',
      '   hüküm verilmez ("ÖLÇÜLEMEDİ").',
      '',
      '⚠️ **SINIR: TEK tohum, güven aralığı YOK.** Bu bir **protokol doğrulaması**',
      '("mekanizma canlı dünyanın dalında uçtan uca çalışıyor mu"), genellenebilir',
      'bir **etki** ölçümü değildir. Ayrıca ölçülen kazanç **dünya çıktısında**',
      'değil **değerlendirme skorkasında**; iki kolun canlı dünya sonucu (popülasyon,',
      'koloni sayısı, organizma enerjisi) ölçüldüğü gibi **aynıdır**.',
      '',
      '```',
      formatInWorldEvolution(inWorld),
      '```',
      '',
      ...[exp1.report, exp2.report, exp3.report].flatMap((r) => [
        `## ${r.title}`,
        '',
        `**Soru:** ${r.question}`,
        '',
        `**Protokol (sonuçtan önce sabitlendi):** ${r.protocol}`,
        '',
        '```',
        reportBlock(r, true),
        '```',
        '',
        '**Notlar:**',
        '',
        ...r.notes.map((n) => `- ${n}`),
        '',
      ]),
    ].join('\n');
    writeFileSync(args.out, md, 'utf8');
    process.stdout.write(`rapor yazıldı: ${args.out}\n`);
  }
}

main();

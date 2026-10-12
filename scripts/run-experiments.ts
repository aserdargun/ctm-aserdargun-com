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
  diagnoseLongRunLimit,
  sweepLongRunDurability,
  sweepResourceRegen,
  verifyBranchIndependence,
  formatEvolutionStrategy,
  formatModes,
  measureNicheCoverage,
  formatNiche,
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
  type ExperimentReport,
} from '../src/sim/experiments/index.ts';
import { fmt } from '../src/sim/stats.ts';

interface Args {
  quick: boolean;
  /** `--deep`: 40.000 tick'lik uzun pencereler (yavaş, ama ekolojik çöküşü görür). */
  deep: boolean;
  out: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  let quick = false;
  let deep = false;
  let out: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quick') quick = true;
    else if (a === '--deep') deep = true;
    else if (a === '--out') out = argv[++i] ?? null;
  }
  return { quick, deep, out };
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
  process.stdout.write(`1/22  değişmez kontroller…\n`);
  const invariants = runInvariants();
  process.stdout.write(`${formatInvariant(invariants)}\n\n`);

  process.stdout.write(`2/22  arena zorluk kalibrasyonu…\n`);
  const difficulty = calibrateArena({
    seeds: args.quick ? 3 : 8,
    ticks: args.quick ? 600 : 4000,
    resourceCounts: args.quick ? [8, 34] : [4, 8, 14, 22, 34],
  });
  process.stdout.write(`${formatDifficulty(difficulty)}\n\n`);

  process.stdout.write(`3/22  Deney 1 · bağ gücü…\n`);
  const exp1 = experiment1({ seeds: args.quick ? 3 : 12, ticks: scale.colonyTicks });

  process.stdout.write(`4/22  Deney 2 · evrim…\n`);
  const exp2 = experiment2({ seeds: args.quick ? 3 : 12, ticks: scale.colonyTicks });

  process.stdout.write(`5/22  Deney 3 · öğrenme…\n`);
  const exp3 = experiment3({
    seeds: args.quick ? 3 : scale.seeds,
    trainTicks: scale.trainTicks,
    evalTicks: scale.evalTicks,
    resourceCount: scale.resourceCount,
  });

  process.stdout.write(`\n6/22  öğrenme · zorluk taraması (önceden kaydedilmiş eksen)…\n`);
  const sweep = args.quick
    ? sweepLearning({ resourceCounts: [8, 34], seeds: 3, trainTicks: 900, evalTicks: 600 })
    : sweepLearning({
        resourceCounts: [4, 8, 14, 22, 34],
        seeds: 12,
        trainTicks: 6000,
        evalTicks: 4000,
      });
  process.stdout.write(`${formatLearningSweep(sweep)}\n`);

  process.stdout.write(`\n7/22  öğrenme sinyali duyarlılığı (ağırlık hareketi ne zaman davranışa yansır)…\n`);
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

  process.stdout.write(`\n8/8  politika uzayı araştırması (öğrenmenin üst sınırı)…\n`);
  const survey = args.quick
    ? surveyPolicySpace({ resourceCount: 14, samples: 12, ticks: 600 })
    : surveyPolicySpace({ resourceCount: 14, samples: 160, ticks: 4000 });
  process.stdout.write(`${formatPolicySurvey(survey)}\n`);

  process.stdout.write(`\n9/9  evrimsel politika araması (RL ile aynı ölçüm, ayrık tohumlar)…\n`);
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

  process.stdout.write(`\n10/10 S-1 varyans azaltma (VARSAYILAN adım ayarlarında)…\n`);
  const variance = args.quick
    ? sweepVarianceReduction({ seeds: 3, trainTicks: 900, evalTicks: 600 })
    : sweepVarianceReduction({ seeds: 20, trainTicks: 6000, evalTicks: 4000 });
  process.stdout.write(`${formatVarianceSweep(variance)}\n`);

  process.stdout.write(`\n11/11 S-1b · işaret avantajı + ölçülü adım artışı…\n`);
  const signStep = args.quick
    ? sweepSignStep({ learnRates: [0.02, 0.5], seeds: 3, trainTicks: 900, evalTicks: 600 })
    : sweepSignStep({ learnRates: [0.02, 0.1, 0.5, 2.0], seeds: 20, trainTicks: 6000, evalTicks: 4000 });
  process.stdout.write(`${formatSignStep(signStep)}\n`);

  process.stdout.write(`\n12/12 S-2 teşhisi · ödül sinyali politikanın kararlarına bağlı mı?\n`);
  const rewardSignal = args.quick
    ? measureRewardSignal({ samples: 10, seedsPerSample: 1, ticks: 900 })
    : measureRewardSignal({ samples: 48, seedsPerSample: 2, ticks: 4000 });
  process.stdout.write(`${formatRewardSignal(rewardSignal)}\n`);

  process.stdout.write(`\n13/13 Faz B1 · ekolojik sönümlenme teşhisi…\n`);
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

  process.stdout.write(`\n14/14 Faz B1b · bağ ömrü duyarlılığı (teşhisin doğrudan sınaması)…\n`);
  const durability = args.quick
    ? sweepBondDurability({ settings: [{ strainDecayK: 0.02, bondFatigue: 2e-5 }, { strainDecayK: 0.005, bondFatigue: 5e-6 }], ticks: 4000, seeds: 1 })
    : sweepBondDurability({ ticks: longTicks, seeds: 4 });
  process.stdout.write(`${formatBondDurability(durability)}\n`);

  process.stdout.write(`\n15/22 Y-2 · bağ ömrünün kalıtılabilirliği…\n`);
  const heritability = args.quick
    ? experimentBondLifeHeritability({ seeds: 2, ticks: 4000 })
    : experimentBondLifeHeritability({ seeds: 6, ticks: longTicks });
  process.stdout.write(`${formatHeritability(heritability)}\n`);

  process.stdout.write(`\n16/22 üreme tıkanması teşhisi…\n`);
  const repro = args.quick
    ? diagnoseReproductiveStall({ seed: 11, ticks: 8000, sampleEvery: 1000 })
    : diagnoseReproductiveStall({ seed: 11, ticks: longTicks, sampleEvery: 4000 });
  process.stdout.write(`${formatReproDiagnosis(repro)}\n`);

  process.stdout.write(`\n17/17 uzun vadeli dayanıklılık (§5.4 genelleniyor mu?)…\n`);
  const longRun = args.quick
    ? sweepLongRunDurability({ settings: [{ strainDecayK: 0.02, bondFatigue: 2e-5 }], ticks: 6000 })
    : sweepLongRunDurability({ ticks: longTicks });
  process.stdout.write(`${formatLongRun(longRun)}\n`);

  process.stdout.write(`\n18/22 40.000 tick sınırı · erişilebilirlik mi avcı mı?…\n`);
  const limit = args.quick
    ? diagnoseLongRunLimit({ ticks: 8000, sampleEvery: 2000 })
    : diagnoseLongRunLimit({ ticks: longTicks, sampleEvery: longTicks > 20_000 ? 4000 : 2000 });
  process.stdout.write(`${formatLongRunLimit(limit)}\n`);

  process.stdout.write(`\n19/22 kaynak rejenerasyonu A/B (kapalı enerji sistemi)…\n`);
  const regen = args.quick
    ? sweepResourceRegen({ regens: [0, 0.01], ticks: 6000 })
    : sweepResourceRegen({ ticks: longTicks });
  process.stdout.write(`${formatRegen(regen)}\n`);

  process.stdout.write(`\n20/20 popülasyon-ES (seçilen öğrenme yönü)…\n`);
  const popUpdate = args.quick
    ? experimentPopulationUpdate({ seeds: 2, ticks: 6000 })
    : experimentPopulationUpdate({ seeds: 8, ticks: 20_000 });
  process.stdout.write(`${formatPopulationUpdate(popUpdate)}\n`);

  process.stdout.write(`\n21/22 ödül hızı yayılımı (paylaşılan dünya siler mi?)…\n`);
  const dispersion = args.quick
    ? measureRewardDispersion({ ticks: 4000, acrossWorlds: 2 })
    : measureRewardDispersion({ ticks: 15_000 });
  process.stdout.write(`${formatDispersion(dispersion)}\n`);

  process.stdout.write(`\n14/14 Faz C1 · MODES açık uçluluk metrikleri…\n`);
  const modes = args.quick
    ? measureModes({ seed: 11, ticks: 6000, sampleEvery: 2000 })
    : measureModes({ seed: 11, ticks: 12_000, sampleEvery: 2000 });
  process.stdout.write(`${formatModes(modes)}\n`);

  process.stdout.write(`\n24/24 Faz D · niş kapsama (yaşam haritası çekirdeği)…\n`);
  // ⚠️ Hızlı kademede `sampleEvery` 2000 kalırsa 3 örnek düşer ve eğilim
  // (bilinçli olarak) hiç okunmaz. 1000 ile 6 örnek düşüyor; maliyet farkı
  // yok çünkü yol uzunluğu her koşuda zaten her tick biriktiriliyor.
  const niche = measureNicheCoverage({
    seed: 11,
    ticks: args.quick ? 6000 : 12_000,
    sampleEvery: 1000,
  });
  process.stdout.write(`${formatNiche(niche)}\n`);

  process.stdout.write(`\n22/22 dal (branch) doğruluğu ve maliyeti…\n`);
  const branch = args.quick
    ? verifyBranchIndependence({ forkTick: 1200, forkTicks: 400 })
    : verifyBranchIndependence({ forkTick: 3000, forkTicks: 1500 });
  process.stdout.write(`${formatBranch(branch)}\n`);

  process.stdout.write(`\n23/23 S-4 · çatallanmış ortamda yaşam içi üstel arama…\n`);
  const esSparse = args.quick
    ? experimentEvolutionStrategy({ seeds: 2, ticks: 2500, perturbations: 3, evaluateTicks: 80, population: 6, resourceCount: 6 })
    : experimentEvolutionStrategy({ seeds: 3, ticks: 4000, perturbations: 4, evaluateTicks: 120, population: 6, resourceCount: 6 });
  process.stdout.write(`  [seyrek dünya: pop ${esSparse.treatment ? 6 : 6} · kaynak 6]\n`);
  process.stdout.write(`${formatEvolutionStrategy(esSparse)}\n`);

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
    dispersion.acrossWorlds;

  process.stdout.write(`toplam koşu: ${totalRuns} · süre: ${(elapsed / 1000).toFixed(1)} s\n`);

  if (args.out) {
    const md = [
      '# Cell to Mind — Deney Sonuçları',
      '',
      `**Körüldü:** ${new Date().toISOString()}`,
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
      'uzun vadeli çöküşü gerçekten önlüyor mu?',
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

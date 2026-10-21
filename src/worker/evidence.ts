/**
 * Cell to Mind — gözlemci kanıt paketi ve YEREL kural özeti.
 *
 * İki kural bu dosyada kesindir:
 *  1. Gözlemci, canlıların içindeki 140 parametreli ağdan AYRIDIR. Dünyayı
 *     değiştiremez, ağırlıkları düzenleyemez, hazır cevap veremez.
 *  2. API erişimi yoksa üretilen metin **açıkça** yerel kural özetidir:
 *     "Yerel kural özeti — dil/görsel model kullanılmadı". Sahte model yanıtı
 *     veya sahte görsel inceleme ÜRETİLMEZ.
 */

import { C } from '../sim/biology/energy.ts';
import { INPUT_LABELS } from '../sim/behavior/perception.ts';
import { ACTION_NAMES } from '../sim/behavior/mlp.ts';
import { learnedDeltaNorm } from '../sim/behavior/policy.ts';
import { genomeDistance } from '../sim/genome.ts';
import type { World } from '../sim/world.ts';
import type { EvidencePack } from './protocol.ts';
import { format, getStrings } from '../i18n/index.ts';
import type { Language } from '../engine/store.ts';

export interface LocalSummary {
  observations: string[];
  evidenceIds: number[];
  interpretations: string[];
  uncertainties: string[];
  nextExperiment: string;
  sourceMode: 'local-summary' | 'language-model' | 'vision-assisted';
}

export function buildEvidencePack(
  world: World,
  question: string,
  kind: 'A' | 'B',
  organismId: number | null,
  worldId: string,
  language: Language = 'tr',
): EvidencePack {
  void kind; // kaynak türü kanıt paketine gömülür ama karar girdisi DEĞİLDİR
  const metrics = world.latestMetrics();
  const recent = world.recentEvents(80);

  const measurements: EvidencePack['measurements'] = [];
  const push = (metricRef: string, value: number, unit: string): void => {
    if (Number.isFinite(value)) measurements.push({ metricRef, value, unit });
  };
  if (metrics) {
    push('population', metrics.population, 'cells');
    push('organismCount', metrics.organismCount, 'organisms');
    push('meanCellEnergy', metrics.meanEnergy, 'e');
    push('largestColonySize', metrics.largestColonySize, 'cells');
    push('coloniesOverFourCells', metrics.coloniesOverFourCells, 'structures');
    push('bondCount', metrics.bondCount, 'bonds');
    push('predatorEnergy', metrics.predatorEnergy, 'e');
    push('learningUpdates', metrics.learningUpdates, 'updates');
    push('maxGeneration', metrics.maxGeneration, 'generation');
  }
  push('tick', world.tick, 'tick');
  push('simTime', world.tick * (C.TICK_MS / 1000), 's');
  push('systemEnergy', world.systemEnergyTotal(), 'e');
  push('externalInput', world.ledger.externalInput, 'e');
  push('dissipatedEnergy', world.ledger.dissipated, 'e');
  push('energyResidual', world.ledger.residual(world.systemEnergyTotal()), 'e');

  let networkSummary: unknown = null;
  if (organismId !== null) {
    const org = world.organisms.get(organismId);
    const decision = world.lastDecision(organismId);
    if (org) {
      networkSummary = {
        parameters: 140,
        topology: '12 -> 8 (tanh) -> 4 (softmax)',
        thetaInheritedNorm: Math.sqrt(
          Array.from(org.neural.thetaInherited).reduce((s, v) => s + v * v, 0),
        ),
        learnedDeltaNorm: learnedDeltaNorm(org.neural),
        baseline: org.neural.baseline,
        lastReward: org.neural.prevReward,
        lastAction: decision ? ACTION_NAMES[decision.action] : null,
        lastActionProbs: decision ? Array.from(decision.probs).map((p) => Math.round(p * 1000) / 1000) : null,
        lastObservedInputs: decision
          ? Array.from(decision.obs).map((v, i) => ({ name: INPUT_LABELS[i] ?? `#${i}`, value: Math.round(v * 1000) / 1000 }))
          : null,
        lastHiddenActivations: decision ? Array.from(decision.hidden).map((v) => Math.round(v * 1000) / 1000) : null,
      };
    }
  }

  const lineages = [...world.lineages.values()]
    .map((l) => {
      const orgs = l.organismIds.map((id) => world.organisms.get(id)).filter((o) => !!o);
      const founder = orgs.find((o) => o.id === l.founderOrganismId) ?? orgs[0];
      if (!founder) return null;
      const descendants = orgs.filter((o) => o.birthMode !== 'genesis');
      const latest = descendants.sort((a, b) => b.generation - a.generation || b.bornTick - a.bornTick)[0];
      return {
        lineageId: l.id,
        label: l.label,
        founderOrganismId: l.founderOrganismId,
        founderGenome: founder.genome,
        latestGeneration: latest?.generation ?? 0,
        latestOrganismId: latest?.id ?? null,
        ancestorToLatestDistance: latest ? genomeDistance(founder.genome, latest.genome) : 0,
        organismCount: orgs.length,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.latestGeneration - a.latestGeneration)
    .slice(0, 6);

  return {
    worldId,
    simVersion: world.version,
    tickIntervalMs: C.TICK_MS,
    tick: world.tick,
    simTimeSeconds: world.tick * (C.TICK_MS / 1000),
    question,
    language,
    eventIds: recent.map((e) => e.id),
    events: recent,
    measurements,
    interventions: world.interventions.slice(-40),
    lineage: lineages,
    networkSummary,
    imageHint: {
      tick: world.tick,
      simTimeSeconds: world.tick * (C.TICK_MS / 1000),
      camera: getStrings(language).observer.notMeasured.free,
    },
    constraints: [
      getStrings(language).observer.notMeasured.fixedStep,
      getStrings(language).observer.notMeasured.reserves,
      getStrings(language).observer.notMeasured.regeneration,
      getStrings(language).observer.notMeasured.control,
    ],
    notMeasured: [
      getStrings(language).observer.notMeasured.consciousness,
      getStrings(language).observer.notMeasured.visualCounting,
      getStrings(language).observer.notMeasured.readOnly,
      getStrings(language).observer.notMeasured.listNote,
    ],
  };
}

/**
 * YEREL, kural tabanlı gözlemci özeti.
 *
 * Bu metin bir dil modeli çıktısı DEĞİLDİR. Yalnızca kayıttaki sayısal
 * ölçümleri ve olayları okur; yorumları bunlara dayandırır ve belirsizlikleri
 * açıkça listeler.
 */
export function buildLocalSummary(pack: EvidencePack, language: Language = 'tr'): LocalSummary {
  const observations: string[] = [];
  const evidenceIds: number[] = [];
  const interpretations: string[] = [];
  const uncertainties: string[] = [];

  const metric = (ref: string): number | undefined => pack.measurements.find((m) => m.metricRef === ref)?.value;
  // ⚠️ Özet metinleri artık **i18n**'den gelir: dil İngilizce'ye geçtiğinde
  // panelin tamamı İngilizce olur (önce hepsi Türkçeydi).
  const S = getStrings(language).observer.summary;

  const population = metric('population');
  const largest = metric('largestColonySize');
  const colonies4 = metric('coloniesOverFourCells');
  const bonds = metric('bondCount');
  const predator = metric('predatorEnergy');
  const updates = metric('learningUpdates');
  const residual = metric('energyResidual');

  observations.push(
    format(S.simProgress, {
      tick: pack.tick,
      seconds: pack.simTimeSeconds.toFixed(1),
      events: pack.eventIds.length,
    }),
  );

  if (population !== undefined) observations.push(format(S.population, { value: population }));
  if (largest !== undefined) {
    observations.push(format(S.largestColony, { value: largest }));
    if (largest >= C.MULTICELL_THRESHOLD) evidenceIds.push(pack.eventIds[pack.eventIds.length - 1] ?? -1);
  }
  if (colonies4 !== undefined) {
    observations.push(
      format(S.multiCell, { threshold: C.MULTICELL_THRESHOLD, value: colonies4 }),
    );
  }
  if (bonds !== undefined) observations.push(format(S.bonds, { value: bonds }));
  if (predator !== undefined)
    observations.push(format(S.predatorEnergy, { value: predator.toFixed(1) }));
  if (updates !== undefined) observations.push(format(S.learningUpdates, { value: updates }));
  if (residual !== undefined && Math.abs(residual) > 1e-3) {
    observations.push(format(S.residualViolation, { value: residual.toFixed(4) }));
  } else if (residual !== undefined) {
    observations.push(S.residualOk);
  }

  const interventions = pack.interventions.length;
  if (interventions > 0) {
    observations.push(format(S.interventions, { value: interventions }));
  }

  if (largest !== undefined && largest >= C.MULTICELL_THRESHOLD) {
    interpretations.push(S.multicellObserved);
  } else {
    interpretations.push(
      format(S.multicellNotObserved, { threshold: C.MULTICELL_THRESHOLD }),
    );
  }

  if (pack.lineage && Array.isArray(pack.lineage) && pack.lineage.length > 0) {
    const top = pack.lineage[0] as { label?: string; latestGeneration?: number; ancestorToLatestDistance?: number };
    interpretations.push(
      format(S.deepestLineage, {
        label: top.label ?? '?',
        generation: top.latestGeneration ?? 0,
        distance: (top.ancestorToLatestDistance ?? 0).toFixed(4),
      }),
    );
  }

  if (networkSummaryIsPresent(pack)) {
    interpretations.push(S.networkDelta);
  }

  uncertainties.push(S.noControl);
  uncertainties.push(S.populationDynamics);
  uncertainties.push(S.rewardSignal);
  if (!networkSummaryIsPresent(pack)) {
    uncertainties.push(S.noNetworkSummary);
  }

  return {
    observations,
    evidenceIds: [...new Set(evidenceIds.filter((id) => id >= 0))],
    interpretations,
    uncertainties,
    nextExperiment: suggestNextExperiment(pack, language),
    sourceMode: 'local-summary',
  };
}

function networkSummaryIsPresent(pack: EvidencePack): boolean {
  const net = pack.networkSummary as { learnedDeltaNorm?: number } | null;
  return !!net && typeof net.learnedDeltaNorm === 'number' && net.learnedDeltaNorm > 1e-6;
}

/**
 * "Yüksek seçilim baskısı" sayılırken kullanılan avcı enerjisi eşiği.
 *
 * ⚠️ Önce burada **elle yazılmış `400`** vardı; `C.PREDATOR_CAPACITY` ile
 * hiçbir ilişkisi yoktu, yani kapasite değişse bile eşik değişmezdi —
 * sessiz bir sapma. Şimdi eşik **kapasiteden türer**.
 *
 * Ölçülen temel (2026-10-19, 40.000 tick, 9 senaryo): avcı enerjisi
 * ortalama 108–187 e, tepe 600 e (kapasitenin %25'i). Eşik 400 e
 * (kapasitenin 1/6'sı) — yani "avcı ara sıra doygun" bandının üst sınırı.
 * Değer **korunur**: 2400 / 6 = 400, yani bu değişiklik davranışı değiştirmez,
 * yalnızca sayıyı izlenebilir kılar.
 */
const HIGH_PREDATOR_ENERGY = C.PREDATOR_CAPACITY / 6;

/** Tek değişkenli sonraki deney önerisi. */
function suggestNextExperiment(pack: EvidencePack, language: Language = 'tr'): string {
  const S = getStrings(language).observer.summary;
  const metric = (ref: string): number | undefined => pack.measurements.find((m) => m.metricRef === ref)?.value;
  const colonies4 = metric('coloniesOverFourCells') ?? 0;
  const largest = metric('largestColonySize') ?? 0;
  const predator = metric('predatorEnergy') ?? 0;

  if (largest < C.MULTICELL_THRESHOLD) {
    return S.nextTogether;
  }
  if (colonies4 === 0) {
    return S.nextAdaptation;
  }
  if (predator > HIGH_PREDATOR_ENERGY) {
    return S.nextPressure;
  }
  return S.nextLearning;
}

/** Gözlemci sunucu yanıtını kanıt paketine göre denetler (uydurma sayı yakalar). */
export function extractNumericClaims(text: string): number[] {
  const out: number[] = [];
  const re = /-?\d+(?:[.,]\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = Number(m[0].replace(',', '.'));
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

/**
 * Model yanıtındaki sayıların kanıt paketinde karşılığı olup olmadığını denetler.
 *
 * ⚠️ **Bu denetim değer eşleştirmesi yapar, anlam denetimi yapmaz.** Ölçüldü:
 * "Bu 3 organizma bağ kurdu" cümlesindeki 3, `bondCount = 3` ile eşleşip
 * **doğrulanmış** geçiyor — ama iddia *bağ* değil *organizma* sayısı
 * hakkındaydı. Bu bir **yanlış kabul**dir ve sessiz kalırsa gözlemci
 * yanlış bir iddiayı doğrulanmış diye sunar.
 *
 * Bu yüzden sonuç yalnız `verified` bayrağı değil, **eşleşen ölçümün
 * kimliğini** de taşır: panel "3 ← bondCount" diyebilsin ve insan
 * (veya denetleyen model) uyumsuzluğu görebilsin. Metin bağlamını ayrıştırmak
 * kırılgan olurdu; bunun yerine **eşleşmeyi görünür kılıyoruz** — ölçülen
 * gerçeği saklamak yerine gösteriyoruz.
 */
export function verifyNumericClaims(
  text: string,
  pack: EvidencePack,
  tolerance = 0.02,
): { value: number; unit: string; verified: boolean; matchedMetric: string | null }[] {
  const allowed = pack.measurements.map((m) => ({ value: m.value, unit: m.unit, ref: m.metricRef }));
  return extractNumericClaims(text).map((value) => {
    const match = allowed.find(
      (a) => Math.abs(a.value - value) <= Math.max(tolerance, Math.abs(a.value) * tolerance),
    );
    return match
      ? { value, unit: match.unit, verified: true, matchedMetric: match.ref }
      : { value, unit: '—', verified: false, matchedMetric: null };
  });
}
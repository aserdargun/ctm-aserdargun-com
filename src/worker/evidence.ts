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
    language: 'tr',
    eventIds: recent.map((e) => e.id),
    events: recent,
    measurements,
    interventions: world.interventions.slice(-40),
    lineage: lineages,
    networkSummary,
    imageHint: {
      tick: world.tick,
      simTimeSeconds: world.tick * (C.TICK_MS / 1000),
      camera: 'free — gözlemci karesi tarayıcı tarafında yakalanır',
    },
    constraints: [
      'Simgulasyon 50 ms sabit adımla ilerler; olaylar tick kimliğiyle eşleşir.',
      'Kaynak rezervleri sonludur; enerji paylaşımı enerji üretmez.',
      'Rejenerasyon ve oyuncu besini dış girdidir ve ölçülür.',
      'Kontrol deneyi yapılmadan nedensellik iddiası kurulamaz.',
    ],
    notMeasured: [
      'Bilinç veya genel zekâ ölçülmez.',
      'Görsel sayım telemetrinin yerine geçmez.',
      'Gözlemci canlılara hazır cevap veremez; ağırlıkları düzenleyemez.',
      'Ölçülmemiş her şey `uncertainties` içinde listelenir.',
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
export function buildLocalSummary(pack: EvidencePack): LocalSummary {
  const observations: string[] = [];
  const evidenceIds: number[] = [];
  const interpretations: string[] = [];
  const uncertainties: string[] = [];

  const metric = (ref: string): number | undefined => pack.measurements.find((m) => m.metricRef === ref)?.value;

  const population = metric('population');
  const largest = metric('largestColonySize');
  const colonies4 = metric('coloniesOverFourCells');
  const bonds = metric('bondCount');
  const predator = metric('predatorEnergy');
  const updates = metric('learningUpdates');
  const residual = metric('energyResidual');

  observations.push(
    `Simülasyon ${pack.tick} tick (${pack.simTimeSeconds.toFixed(1)} s) ilerlemiş; ${pack.eventIds.length} olay kaydı bulunuyor.`,
  );

  if (population !== undefined) observations.push(`Canlı hücre sayısı: ${population}.`);
  if (largest !== undefined) {
    observations.push(`En büyük bağlı küme: ${largest} hücre.`);
    if (largest >= C.MULTICELL_THRESHOLD) evidenceIds.push(pack.eventIds[pack.eventIds.length - 1] ?? -1);
  }
  if (colonies4 !== undefined) {
    observations.push(
      `${C.MULTICELL_THRESHOLD}+ hücreli yapı sayısı: ${colonies4} (oyunun işletimsel eşiği, biyolojik tanım değil).`,
    );
  }
  if (bonds !== undefined) observations.push(`Aktif hücre bağı sayısı: ${bonds}.`);
  if (predator !== undefined) observations.push(`Avcı enerjisi: ${predator.toFixed(1)} e (yerel seçilim baskısı).`);
  if (updates !== undefined) observations.push(`Tamamlanmış politika güncellemesi: ${updates}.`);
  if (residual !== undefined && Math.abs(residual) > 1e-3) {
    observations.push(`Enerji muhasebesinde ${residual.toFixed(4)} e fark var — korunum ihlali işareti.`);
  } else if (residual !== undefined) {
    observations.push('Enerji muhasebesi korunuyor (bakiye farkı ihmal edilebilir).');
  }

  const interventions = pack.interventions.length;
  if (interventions > 0) {
    observations.push(`Kayıtta ${interventions} oyuncu müdahalesi var; müdahalesiz karşılaştırma için uygun değil.`);
  }

  if (largest !== undefined && largest >= C.MULTICELL_THRESHOLD) {
    interpretations.push(
      'Bağlı kümeler oluştuğu için çok hücreli yapılar gözlenmiş sayılır; bu yalnız gözlemdir, nedensellik değildir.',
    );
  } else {
    interpretations.push(
      'Şu ana kadar �� eşiğin üzerinde bağlı küme yok. Bu "henüz gözlenmedi" demektir; olmayan bir sonuç değildir.',
    );
  }

  if (pack.lineage && Array.isArray(pack.lineage) && pack.lineage.length > 0) {
    const top = pack.lineage[0] as { label?: string; latestGeneration?: number; ancestorToLatestDistance?: number };
    interpretations.push(
      `En derin soy ${top.label} (${top.latestGeneration ?? 0}. nesil); atasal–torun genom uzaklığı ${(top.ancestorToLatestDistance ?? 0).toFixed(4)}. Bu bir gözlemdir, adaptasyon kanıtı değildir.`,
    );
  }

  if (networkSummaryIsPresent(pack)) {
    interpretations.push(
      'Seçili canlının ağında bu yaşamda öğrenilmiş fark sıfırdan büyük; bu, ağırlıkların değiştiğini gösterir. Öğrenmenin BAŞARILI olduğunu göstermez — başarı için ayrılmış tohumlarda kontrol deneyi gerekir.',
    );
  }

  uncertainties.push('Kontrol dalı olmadan nedensellik kurulamadı; gözlemler yalnızca birliktelik düzeyindedir.');
  uncertainties.push('Popülasyon dinamiği kaynak rezervlerinin sonluluğuyla sınırlıdır; dış girdi müdahaleleri ölçümü değiştirebilir.');
  uncertainties.push('Ödül sinyali net enerji/hasar/maliyetlerden üretilir; kaynağın "doğru" olduğuna dair gizli etiket kullanılmaz.');
  if (!networkSummaryIsPresent(pack)) {
    uncertainties.push('Bu soru için seçili bir canlının ağ özeti yok; mikroskop verisi üretilmedi.');
  }

  return {
    observations,
    evidenceIds: [...new Set(evidenceIds.filter((id) => id >= 0))],
    interpretations,
    uncertainties,
    nextExperiment: suggestNextExperiment(pack),
    sourceMode: 'local-summary',
  };
}

function networkSummaryIsPresent(pack: EvidencePack): boolean {
  const net = pack.networkSummary as { learnedDeltaNorm?: number } | null;
  return !!net && typeof net.learnedDeltaNorm === 'number' && net.learnedDeltaNorm > 1e-6;
}

/** Tek değişkenli sonraki deney önerisi. */
function suggestNextExperiment(pack: EvidencePack): string {
  const metric = (ref: string): number | undefined => pack.measurements.find((m) => m.metricRef === ref)?.value;
  const colonies4 = metric('coloniesOverFourCells') ?? 0;
  const largest = metric('largestColonySize') ?? 0;
  const predator = metric('predatorEnergy') ?? 0;

  if (largest < C.MULTICELL_THRESHOLD) {
    return 'Deney 1 (Birlikte kalmak): aynı kayıttan iki dal aç; yalnız bağlı kalma eğilimini değiştir, baskıyı sabit tut. Koloni üreme neslini karşılaştır.';
  }
  if (colonies4 === 0) {
    return 'Deney 2 (Adaptasyon): atasal ve torun genotiplerini aynı ortamda, öğrenme ve yeni mutasyon kapalıyken karşılaştır.';
  }
  if (predator > 400) {
    return 'Seçilim baskısını düşür, aynı tohumla tekrar etkileşimi ve koloni kalıcılığını ölç (tek değişkenli).';
  }
  return 'Deney 3 (Öğrenme): aynı kalıtsal ağla eğitilmiş/eğitilmemiş politikayı, büyüme ve mutasyon kapalıyken ayrılmış tohumlarda karşılaştır.';
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
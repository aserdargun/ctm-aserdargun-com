/**
 * Cell to Mind — gözlemci kanıt denetimi testleri.
 *
 * Bu modül model yanıtındaki sayıları kanıt paketine karşı denetler.
 * **Modelin dürüst olduğu varsayılırsa denetim işe yaramaz** — bu yüzden
 * testler ağırlıklı olarak **reddetme** yönündedir: uydurma sayı geçmemeli.
 *
 * ⚠️ Bu üç fonksiyon (`extractNumericClaims`, `verifyNumericClaims`,
 * `buildLocalSummary`) daha önce **hiç test edilmemişti**. Onlar olmadan
 * gözlemci paneli, model halüsinasyonlarını doğrulanmış diye sunabilirdi.
 */

import { describe, expect, it } from 'vitest';
import {
  buildLocalSummary,
  extractNumericClaims,
  verifyNumericClaims,
} from '../src/worker/evidence.ts';
import type { EvidencePack } from '../src/worker/protocol.ts';

function pack(measurements: { metricRef: string; value: number; unit: string }[]): EvidencePack {
  return {
    worldId: 'w',
    simVersion: 'test',
    tickIntervalMs: 50,
    tick: 1200,
    simTimeSeconds: 60,
    question: 'ne oluyor?',
    language: 'tr',
    eventIds: [7, 8],
    events: [],
    measurements,
    interventions: [],
    lineage: null,
    networkSummary: null,
    imageHint: null,
    constraints: [],
    notMeasured: ['nedensellik'],
  };
}

const BASE = pack([
  { metricRef: 'population', value: 48, unit: 'hücre' },
  { metricRef: 'bondCount', value: 3, unit: 'bağ' },
  { metricRef: 'largestColonySize', value: 7, unit: 'hücre' },
]);

describe('gözlemci · sayı çıkarma', () => {
  it('tam sayı ve ondalıkları çıkarır', () => {
    expect(extractNumericClaims('48 hücre var.')).toEqual([48]);
    expect(extractNumericClaims('artış 0,5 e')).toEqual([0.5]); // virgül → nokta
    expect(extractNumericClaims('negatif -3 idi')).toEqual([-3]);
  });

  it('sayı olmayan metni boş döndürür', () => {
    expect(extractNumericClaims('hiç sayı yok')).toEqual([]);
  });

  it('binlik ayracı olan Türkçe sayıyı SAYI OLMAKTAN ÇIKARIR (sessiz düşüş)', () => {
    // ⚠️ "1.234" tek sayı olarak okunur; bu bir **eksik yakalama** değil,
    // daha kötüsü **sessiz bir dönüşüm**: 1.234 doğru sayı 1234 değildir.
    // Metin bağlamı çözülemiyorsa doğru davranış şudur: çıkarmamak ve
    // uydurma sayı üretmemek. Test bu sessiz davranışı sabitler.
    expect(extractNumericClaims('Popülasyon 1.234 hücre')).toEqual([1.234]);
  });
});

describe('gözlemci · sayı doğrulama (REDDETME yönü)', () => {
  it('kanıttaki sayıyı doğrular ve EŞLEŞEN ÖLÇÜMÜ bildirir', () => {
    const [claim] = verifyNumericClaims('Canlı hücre sayısı 48.', BASE);
    expect(claim.verified).toBe(true);
    expect(claim.matchedMetric).toBe('population');
  });

  it('kanıtta olmayan sayıyı REDDEDER', () => {
    const [claim] = verifyNumericClaims('En büyük küme 19 hücre.', BASE);
    expect(claim.verified).toBe(false);
    expect(claim.matchedMetric).toBeNull();
  });

  it('uydurma sayıları topluca yakalar', () => {
    const claims = verifyNumericClaims('Popülasyon 480, küme 19, artış 12,7 e.', BASE);
    expect(claims.every((c) => !c.verified)).toBe(true);
  });

  it('⚠️ yanlış kabuli GÖRÜNÜR kılar: değer başka bir metrikle eşleşiyorsa kimliğini bildirir', () => {
    // "Bu 3 organizma bağ kurdu" → 3, bondCount=3 ile eşleşir.
    // Denetim **değer** karşılaştırır, anlam karşılaştırmaz; bu yüzden
    // `matchedMetric` yazılmazsa kullanıcı bunu doğrulanmış sanar.
    const [claim] = verifyNumericClaims('Bu 3 organizma bağ kurdu.', BASE);
    expect(claim.verified).toBe(true);
    expect(claim.matchedMetric).toBe('bondCount');
  });

  it('tolerans: yuvarlanmış sayılar hâlâ eşleşir', () => {
    // %2 tolerans: 48 ± 0,96 → 47,04–48,96
    expect(verifyNumericClaims('yaklaşık 47,5 hücre', BASE)[0].verified).toBe(true);
    expect(verifyNumericClaims('45 hücre', BASE)[0].verified).toBe(false);
  });

  it('tolerans değiştirilebilir ve daraltılınca yakalanır', () => {
    expect(verifyNumericClaims('47,5 hücre', BASE, 0.001)[0].verified).toBe(false);
  });

  it('tarih/gürültü sayıları doğrulanmaz', () => {
    const claims = verifyNumericClaims('2026 modelinde bağ sayısı 47.', BASE);
    expect(claims.find((c) => c.value === 2026)?.verified).toBe(false);
    expect(claims.find((c) => c.value === 47)?.verified).toBe(false);
  });
});

describe('gözlemci · yerel kural özeti', () => {
  it('yalnız kanıttaki sayıları kullanır ve belirsizlikleri listeler', () => {
    const summary = buildLocalSummary(BASE);
    expect(summary.observations.length).toBeGreaterThan(0);
    expect(summary.uncertainties.length).toBeGreaterThan(0);
    // Niteliksel iddialar kanıt dışına çıkmaz.
    expect(summary.observations.join(' ')).toContain('48');
    expect(summary.interpretations.join(' ')).toMatch(/gözlem|nedensellik|adaptasyon/i);
  });

  it('korunum ihlalini işaretler', () => {
    const p = pack([
      { metricRef: 'population', value: 48, unit: 'hücre' },
      { metricRef: 'energyResidual', value: 5.5, unit: 'e' },
    ]);
    expect(buildLocalSummary(p).observations.join(' ')).toMatch(/korunum ihlali/i);
  });

  it('korunum sağlarken ihlal dili kullanmaz', () => {
    const p = pack([
      { metricRef: 'population', value: 48, unit: 'hücre' },
      { metricRef: 'energyResidual', value: 0.0001, unit: 'e' },
    ]);
    const text = buildLocalSummary(p).observations.join(' ');
    expect(text).not.toMatch(/korunum ihlali/i);
  });

  it('müdahale varsa uygunluğu reddeder', () => {
    const p = { ...BASE, interventions: [{ kind: 'test', tick: 5 }] } as unknown as EvidencePack;
    expect(buildLocalSummary(p).observations.join(' ')).toMatch(/müdahale/i);
  });

  it('her zaman bir sonraki deney önerisi üretir', () => {
    expect(buildLocalSummary(BASE).nextExperiment.length).toBeGreaterThan(10);
  });

  it('deterministiktir', () => {
    expect(JSON.stringify(buildLocalSummary(BASE))).toBe(JSON.stringify(buildLocalSummary(BASE)));
  });
});
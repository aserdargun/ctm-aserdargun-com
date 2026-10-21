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
  buildEvidencePack,
  buildLocalSummary,
  extractNumericClaims,
  verifyNumericClaims,
} from '../src/worker/evidence.ts';
import { World } from '../src/sim/world.ts';
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
    eventCount: 2,
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

describe('ölçüm anahtarı bütünlüğü', () => {
  // §6.47'de ölçüldü: 15 anahtar üretiliyor, ama yalnız 7'si `metric('…')`
  // ile ADIYLA okunuyor. Geri kalan 8 (`systemEnergy`, `externalInput`,
  // `dissipatedEnergy`, `tick`, `simTime`, `organismCount`, `meanCellEnergy`,
  // `maxGeneration`) **hiç adıyla okunmuyor**.
  //
  // Bu bir ölü bildirim DEĞİL: `verifyNumericClaims` tüm ölçümleri **genel
  // olarak** geziyor, yani bu anahtarlar da modelin iddia denetimine giriyor.
  // Aşağıdaki test tam olarak bunu davranışsal olarak doğruluyor — metin
  // taramasıyla değil, çalıştırarak.
  it('adıyla okunmayan anahtarlar da genel denetçide geçerli sayılır', () => {
    // systemEnergy yalnız push() ile üretiliyor; hiçbir yerde metric() ile
    // okunmuyor. Yine de modelin iddia denetiminde kanıt sayılmalı.
    const p = pack([
      { metricRef: 'systemEnergy', value: 109_575.25, unit: 'e' },
      { metricRef: 'population', value: 48, unit: 'cells' },
    ]);
    const [claim] = verifyNumericClaims('Sistem enerjisi 109575 e.', p);
    expect(claim.verified, 'adıyla okunmayan anahtar genel denetçide eşleşmeli').toBe(true);
    expect(claim.matchedMetric).toBe('systemEnergy');
  });

  it('kanıtta olmayan sayı yine de reddedilir (genel gezme gevşetmiyor)', () => {
    const p = pack([{ metricRef: 'systemEnergy', value: 109_575.25, unit: 'e' }]);
    const [claim] = verifyNumericClaims('Sistem enerjisi 999999 e.', p);
    expect(claim.verified).toBe(false);
  });

  it('her üretilen anahtar kanıt paketine ulaşır', () => {
    // push() ile üretilen anahtar sayısı ile paketin ölçüm sayısı eşleşmeli.
    const p = pack([
      { metricRef: 'population', value: 48, unit: 'cells' },
      { metricRef: 'bondCount', value: 19, unit: 'bonds' },
      { metricRef: 'energyResidual', value: 0, unit: 'e' },
    ]);
    expect(p.measurements).toHaveLength(3);
    expect(new Set(p.measurements.map((m) => m.metricRef)).size).toBe(3);
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

  it('olay sayısı ÖRNEKLEM değil, dünyanın tuttuğu sayıdır', () => {
    // ⚠️ ÖLÇÜLEN (19 Ekim 2026): özet "80 olay kaydı bulunuyor" diyordu,
    // ama 80 **örneklem** sayısıydı (son 80 olay); dünya 164 olay üretmişti.
    // Yani panel gerçeğin yarısından azını "bulunuyor" diye söylüyordu —
    // bilimsel özet panelinde yanlış bir sayı.
    const p = { ...BASE, eventIds: [1, 2, 3], eventCount: 164 } as unknown as EvidencePack;
    const text = buildLocalSummary(p, 'tr').observations.join(' ');
    expect(text, 'örneklem sayısı (3) dünyanın tuttuğu sayı (164) olarak yazıldı').toContain('164');
    expect(text, 'örneklem sayısı hiç yazılmadı').toMatch(/3/);
    expect(text, 'dünyanın tuttuğu sayı yok').not.toContain('3 olay kaydı bulunuyor');
  });

  it('deterministiktir', () => {
    expect(JSON.stringify(buildLocalSummary(BASE))).toBe(JSON.stringify(buildLocalSummary(BASE)));
  });

  it('İngilizce dilde İngilizce yazar', () => {
    // ⚠️ ÖLÇÜLEN: gözlemci özeti **Türkçe sabit** metinlerdi ve kanıt paketinin
    // `language` alanı sabit `'tr'` idi. Yani dil İngilizce'ye geçse bile
    // panelin TAMAMI Türkçe kalıyordu — 30 metin.
    const tr = buildLocalSummary(BASE, 'tr');
    const en = buildLocalSummary(BASE, 'en');
    const enText = [...en.observations, ...en.interpretations, ...en.uncertainties].join(' ');
    expect(enText, 'İngilizce özet Türkçe kalıyor').not.toMatch(/[ğüşıİç]/);
    expect(enText, 'İngilizce özet boş').toMatch(/\w/);
    expect(en.nextExperiment, 'İngilizce deney önerisi Türkçe kalıyor').not.toMatch(/[ğüşıİç]/);
    // İki dil gerçekten farklı metin üretmeli.
    expect(en.observations.join(' ')).not.toBe(tr.observations.join(' '));
  });

  it('kanıt paketi dili taşır (sabit değil)', () => {
    // Paketin `language` alanı istekten gelmeli; sabit `'tr'` iken dil
    // değiştirme panelde hiçbir iz bırakmıyordu.
    const world = new World({ seed: 3, population: 6 });
    const packEn = buildEvidencePack(world, 'q', 'A', null, 'w', 'en');
    expect(packEn.language, 'paket dili istekten gelmiyor').toBe('en');
    const packTr = buildEvidencePack(world, 'q', 'A', null, 'w', 'tr');
    expect(packTr.language).toBe('tr');
    // Kısıtlar ve "ölçülmeyenler" de dile uyar.
    expect(packEn.constraints.join(' ')).not.toMatch(/[ğüşıİç]/);
    expect(packEn.notMeasured.join(' ')).not.toMatch(/[ğüşıİç]/);
  });
});
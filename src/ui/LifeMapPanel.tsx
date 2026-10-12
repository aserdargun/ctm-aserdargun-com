/**
 * Cell to Mind — Yaşam Haritası paneli.
 *
 * Picbreeder / MAP-Elites ızgarasını görselleştirir: hangi **davranış nişleri**
 * işgal ediliyor? Üç eksen de ölçülebilir betimleyicilerdir (hız, boyut,
 * duyu menzili) — hiçbiri genomla tahmin edilmez.
 *
 * Bu panel **yalnız ölçüm gösterir**. Seçilim `ε = 0` varsayılandadır: arşiv
 * her hücredeki en iyi bireyi saklar ama seçilime **katılmaz**, dolayısıyla
 * canlı dünya bu panel açıkken de değişmez. `VALIDATION.md` §6.23–6.25.
 *
 * ⚠️ Panel, eksenin ölü olup olmadığını da gösterir. Ölçümün ilk hâlinde iki
 * eksen kırıktı ve ikisi de "makul görünen" sayılar üretti; bu yüzden eksen
 * sağlığı gizlenmiyor, kullanıcıya da gösteriliyor.
 */

import React from 'react';
import { useStore } from '../engine/store.ts';
import type { SimClient } from '../engine/client.ts';
import { LIFE_RANGE_MIN, LIFE_RANGE_MAX, type LifeSnapshot } from '../sim/lab/lifeMap.ts';

const POLL_MS = 1500;

function fmt(v: number, digits = 3): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

/**
 * Bir hücrenin rengi: kutudaki en iyi bireyin enerjisine göre.
 * Boş kutular koyu; dolu kutular enerjiye göre ısınır (soğuk → sıcak).
 */
function heatColor(energyNorm: number | null): string {
  if (energyNorm === null) return 'rgba(148,163,184,.06)';
  const v = Math.max(0, Math.min(1, energyNorm));
  const hue = 205 - v * 195; // 205 (mavi) → 10 (turuncu)
  return `hsla(${hue.toFixed(0)}, 78%, ${(34 + v * 22).toFixed(0)}%, .85)`;
}

function Layer({ snapshot, axisName, layer }: {
  snapshot: LifeSnapshot;
  axisName: 'hız' | 'boyut' | 'menzil';
  layer: number;
}): React.ReactElement {
  const B = snapshot.bins;
  const byKey = new Map<string, (typeof snapshot.cells)[number]>();
  for (const c of snapshot.cells) byKey.set(`${c.speedBin}.${c.sizeBin}.${c.rangeBin}`, c);
  // 'hız' = satır, 'boyut' = sütun, 'menzil' = katman.
  const rowOf = axisName === 'hız' ? 0 : 1;
  const colOf = axisName === 'boyut' ? 1 : 0;

  return (
    <div className="lifemap__layer">
      <div className="lifemap__layerLabel">{axisName} {layer}</div>
      <div className="lifemap__grid" style={{ gridTemplateColumns: `repeat(${B}, 1fr)` }}>
        {Array.from({ length: B * B }, (_, i) => {
          const row = Math.floor(i / B);
          const col = i % B;
          const bins = [0, 0, 0];
          bins[rowOf] = row;
          bins[colOf] = col;
          bins[2] = layer;
          const cell = byKey.get(bins.join('.'));
          const title = cell
            ? `${cell.count} organizma · en iyi enerji ${fmt(cell.bestEnergyNorm)} · soy ${cell.bestLineage}`
            : 'boş';
          return (
            <div
              key={i}
              className={`lifemap__cell${cell ? ' lifemap__cell--filled' : ''}`}
              style={{ background: heatColor(cell ? cell.bestEnergyNorm : null) }}
              title={`${axisName}=${rowOf === 0 ? row : layer} ${axisName === 'boyut' ? col : ''} ${title}`}
            >
              {cell ? cell.count : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LifeMapPanel({ client }: { client: SimClient }): React.ReactElement {
  const language = useStore((s) => s.language);
  const snapshot = useStore((s) => s.lifeMap);

  // Panel açıkken düşük frekanlı yoklama: kare başına gönderim yok.
  React.useEffect(() => {
    client.lifeMap();
    const handle = setInterval(() => client.lifeMap(), POLL_MS);
    return () => clearInterval(handle);
  }, [client]);

  const tr = language === 'tr';

  return (
    <section className="panel" aria-label={tr ? 'Yaşam haritası' : 'Life map'}>
      <header className="panel__head">
        <h2>{tr ? 'Yaşam Haritası' : 'Life Map'}</h2>
      </header>

      <p className="panel__hint">
        {tr
          ? 'Hangi davranış nişleri işgal ediliyor? Üç eksen de ölçülür: hız (yol uzunluğu/tick), boyut (hücre sayısı) ve duyu menzili.'
          : 'Which behavioral niches are occupied? All three axes are measured: speed (path length/tick), size (cell count) and sense range.'}
      </p>

      {!snapshot || snapshot.totalOrganisms === 0 ? (
        <p className="panel__hint">{tr ? 'Henüz gözlem yok…' : 'No observations yet…'}</p>
      ) : (
        <>
          <div className="lifemap__stats">
            <span>{snapshot.occupied}/{snapshot.total} {tr ? 'kutu' : 'cells'}</span>
            <span>
              {tr ? 'en yoğun kutu' : 'top cell'} %{Math.round(snapshot.concentration * 100)}
            </span>
            <span>
              {snapshot.totalOrganisms} {tr ? 'gözlem' : 'observations'}
            </span>
            <span>tick {snapshot.tick}</span>
          </div>

          <div className="lifemap__stack">
            {Array.from({ length: snapshot.bins }, (_, i) => i).map((layer) => (
              <Layer key={layer} snapshot={snapshot} axisName="menzil" layer={layer} />
            ))}
          </div>

          <div className="panel__hint" style={{ marginTop: 8 }}>
            {tr ? 'Renk yoğunluğu = kutudaki en iyi bireyin enerjisi. Sayı = o kutuda görülen organizma.' : 'Colour intensity = best energy in the cell. Number = organisms seen there.'}
            {' '}
            {tr ? `Menzil ${LIFE_RANGE_MIN}–${LIFE_RANGE_MAX}.` : `Range ${LIFE_RANGE_MIN}–${LIFE_RANGE_MAX}.`}
          </div>

          {snapshot.degenerateAxes.length > 0 && (
            <p className="panel__hint" style={{ color: 'var(--warn, #fbbf24)' }}>
              ⚠️ {tr ? 'Eksen çöktü' : 'Axis collapsed'}: {snapshot.degenerateAxes.join(', ')}.{' '}
              {tr ? 'Bu eksen ızgarayı taşımıyor; doluluk sayısı bu haliyle yorumlanamaz.' : 'This axis cannot carry the grid; occupancy cannot be interpreted as is.'}
            </p>
          )}

          <details className="lifemap__health">
            <summary>{tr ? 'Ölçüm sağlığı' : 'Measurement health'}</summary>
            <table className="panel__table">
              <thead>
                <tr>
                  <th>{tr ? 'eksen' : 'axis'}</th>
                  <th>{tr ? 'üst sınır' : 'upper bound'}</th>
                  <th>{tr ? 'kırpılan' : 'clamped'}</th>
                  <th>{tr ? 'dolu kutu' : 'bins used'}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.health.map((h) => (
                  <tr key={h.axis}>
                    <td>{h.axis}</td>
                    <td>{fmt(h.max)}</td>
                    <td>
                      {h.clamped} (%)
                    </td>
                    <td>
                      {h.binsReached}/{h.bins}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="panel__hint">
              {tr
                ? 'Üst sınırın altındaki tüm gözlemler üst kutuya kırpılır; sıfır olması eksenin çalıştığının işaretidir.'
                : 'Observations at or above the upper bound are clipped into the top bin; zero means the axis is working.'}
            </p>
          </details>
        </>
      )}

      <p className="panel__hint" style={{ marginTop: 8 }}>
        {tr
          ? 'Bu panel yalnız ölçer: seçilim kapalı, canlı dünya değişmiyor.'
          : 'This panel only measures: selection is off, the living world is unchanged.'}
      </p>
    </section>
  );
}
/**
 * Cell to Mind — Evrim Atölyesi paneli.
 *
 * Seçili bir organizmanın politikasını (μ+λ) evrimsel aramayla iyileştirir ve
 * kullanıcıya **ham süreci** gösterir: nesil eğrisi, eğitim ve **görülmemiş**
 * (tutulmuş) tohumlardaki kazanç ayrı ayrı raporlanır.
 *
 * Neden ayrı: `VALIDATION.md` §6.14–6.15'te canlı dünyada yapılan arama denendi
 * ve **reddedildi** — uygunluk hücre sayısıyla şişiyor, tabanlar
 * karşılaştırılamıyordu. Burada arama **arenada** yapılır (tek birey, kaynak
 * kısıtlı) ve kazanç yalnızca **tutulmuş tohumlarda** raporlanır; bu yüzden
 * "genelleşme" iddiası ölçülebilir.
 */

import React from 'react';
import { useStore } from '../engine/store.ts';
import type { SimClient } from '../engine/client.ts';

const GENERATIONS = 8;
const POPULATION = 4;
const OFFSPRING = 2;

function fmt(v: number, digits = 3): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

/** Nesil eğrisini küçük bir SVG grafiğine çevirir. */
function Sparkline({ history, width = 260, height = 64 }: { history: number[]; width?: number; height?: number }): React.ReactElement | null {
  if (history.length < 2) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = Math.max(1e-6, max - min);
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = history
    .map((v, i) => {
      const x = pad + (i / (history.length - 1)) * w;
      const y = pad + h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `${pad},${pad + h} ${points} ${pad + w},${pad + h}`;
  return (
    <svg width={width} height={height} role="img" aria-label="nesil eğrisi" style={{ display: 'block', marginTop: 8 }}>
      <polygon points={area} fill="rgba(56,189,248,.12)" />
      <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth="2" />
      {history.map((v, i) => {
        const x = pad + (i / (history.length - 1)) * w;
        const y = pad + h - ((v - min) / span) * h;
        return <circle key={i} cx={x} cy={y} r="2" fill="#7dd3fc" />;
      })}
    </svg>
  );
}

export function EvolutionPanel({ client }: { client: SimClient }): React.ReactElement {
  const language = useStore((s) => s.language);
  const selectedId = useStore((s) => s.selectedId);
  const organisms = useStore((s) => s.organisms);
  const evo = useStore((s) => s.evolution);
  const start = useStore((s) => s.evolutionStart);
  const reset = useStore((s) => s.evolutionReset);
  const notify = useStore((s) => s.notify);

  const selected = organisms.find((o) => o.id === selectedId) ?? null;

  const run = (apply: boolean): void => {
    if (!selectedId || evo.running) return;
    start(selectedId, GENERATIONS);
    client.evolve(selectedId, GENERATIONS, POPULATION, OFFSPRING, apply);
  };

  return (
    <section className="panel" aria-label="Evrim Atölyesi">
      <header className="panel__head">
        <h2>Evrim Atölyesi</h2>
      </header>

      <p className="panel__hint">
        Seçili organizmanın politikası <strong>arena</strong> üzerinde (μ+λ) aramayla
        geliştirilir. Canlı dünya değişmez; kazanan politika yalnız uygular.
      </p>

      {!selectedId && (
        <p className="panel__hint">Önce soldaki listeden bir organizma seç.</p>
      )}
      {selectedId && !selected?.alive && (
        <p className="panel__hint">Bu organizma ölmüş. Canlı bir organizma seç.</p>
      )}

      {selected && selected.alive && (
        <div className="panel__row" style={{ marginTop: 10 }}>
          <span>#{selected.id}</span>
          <span>{selected.cellCount} {language === 'tr' ? 'hücre' : 'cells'}</span>
          <span>
            {language === 'tr' ? 'ort. enerji' : 'mean energy'} {fmt(selected.meanEnergyNorm, 2)}
          </span>
        </div>
      )}

      <div className="panel__actions" style={{ marginTop: 12 }}>
        <button type="button" disabled={!selected?.alive || evo.running} onClick={() => run(false)}>
          {language === 'tr' ? 'Yalnız dene' : 'Dry run'}
        </button>
        <button type="button" disabled={!selected?.alive || evo.running} onClick={() => run(true)}>
          {language === 'tr' ? 'Bulunanı uygula' : 'Apply found'}
        </button>
        {(evo.finished || evo.running) && (
          <button
            type="button"
            onClick={() => {
              reset();
              notify('info', 'Evrim atölyesi sıfırlandı');
            }}
          >
            {language === 'tr' ? 'Temizle' : 'Clear'}
          </button>
        )}
      </div>

      {evo.running && (
        <div style={{ marginTop: 12 }}>
          <div className="panel__row">
            <span>
              {language === 'tr' ? 'Nesil' : 'Generation'} {evo.generation}/{evo.total}
            </span>
          </div>
          <div className="panel__bar" role="progressbar" aria-valuenow={evo.generation} aria-valuemin={0} aria-valuemax={evo.total}>
            <div style={{ width: `${(evo.generation / Math.max(1, evo.total)) * 100}%` }} />
          </div>
        </div>
      )}

      {evo.history.length > 1 && <Sparkline history={evo.history} />}

      {evo.result && (
        <div className="panel__section" style={{ marginTop: 12 }}>
          <h3>{language === 'tr' ? 'Sonuç' : 'Result'}</h3>
          <table className="panel__table">
            <tbody>
              <tr>
                <th>{language === 'tr' ? 'Eğitim tohumları' : 'Training seeds'}</th>
                <td>
                  {fmt(evo.result.startScore)} → {fmt(evo.result.bestScore)}
                </td>
              </tr>
              <tr>
                <th>{language === 'tr' ? 'Rastgele taban' : 'Random baseline'}</th>
                <td>{fmt(evo.result.randomBaseline)}</td>
              </tr>
              <tr>
                <th>{language === 'tr' ? 'Görülmemiş tohumlar' : 'Held-out seeds'}</th>
                <td>
                  {fmt(evo.result.startHoldout)} → {fmt(evo.result.bestHoldout)}
                </td>
              </tr>
              <tr>
                <th>{language === 'tr' ? 'Gerçek kazanç' : 'True gain'}</th>
                <td>
                  <strong>
                    {evo.result.holdoutGain >= 0 ? '+' : ''}
                    {fmt(evo.result.holdoutGain)}
                  </strong>
                </td>
              </tr>
              <tr>
                <th>{language === 'tr' ? 'Değerlendirme / süre' : 'Evaluations / time'}</th>
                <td>
                  {evo.result.evaluations} · {(evo.result.spentMs / 1000).toFixed(1)} sn
                </td>
              </tr>
            </tbody>
          </table>

          <p className="panel__hint" style={{ marginTop: 8 }}>
            {evo.result.applied
              ? language === 'tr'
                ? 'Bulunan politika organizmaya yazıldı.'
                : 'Found policy written to the organism.'
              : language === 'tr'
                ? 'Yalnız denendi, organizma değiştirilmedi.'
                : 'Dry run — organism unchanged.'}
          </p>
          <p className="panel__hint">
            {language === 'tr'
              ? 'Kazanç yalnız görülmemiş tohumlarda raporlanır; arama bunları görmedi.'
              : 'Gain is reported only on held-out seeds; the search never saw them.'}
          </p>
        </div>
      )}
    </section>
  );
}
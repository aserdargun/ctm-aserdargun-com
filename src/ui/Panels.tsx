/**
 * Cell to Mind — ayrıntı panelleri.
 *
 * Kurallar:
 *  - Mikroskop yalnız GERÇEKTEN oluşmuş kararı gösterir; karşı-olgusal
 *    hesaplar açıkça etiketlenir.
 *  - Gözlemci kanıtsız sayı uyduramaz; yerel özet dürüstçe etiketlenir.
 *  - Her panel metin karşılığı içerir (grafiklerin erişilebilir eşdeğeri).
 */

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../engine/store.ts';
import type { SimClient } from '../engine/client.ts';
import type { GenomeKey } from '../sim/genome.ts';
import { actionLabels, getStrings, genomeLabels, inputLabels } from '../i18n/index.ts';
import {
  forwardMasked,
  MLP_SHAPE,
  PARAM_SLICES,
  type HiddenMask,
} from '../sim/behavior/mlp.ts';

function num(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

/* --------------------------------------------------------------- İnceleme */

export function InspectorPanel(): React.ReactElement {
  const selectedId = useStore((s) => s.selectedId);
  const organisms = useStore((s) => s.organisms);
  const language = useStore((s) => s.language);
  const t = getStrings(language);
  const labels = genomeLabels(language);

  const org = organisms.find((o) => o.id === selectedId) ?? null;
  if (!org) {
    return <Panel title={t.inspector.title} body={<p className="note">{t.inspector.empty}</p>} />;
  }

  const birthKey = org.birthMode as keyof typeof t.inspector.birthModeValue;

  return (
    <Panel
      title={t.inspector.title}
      body={
        <>
          <h4>{t.inspector.id}</h4>
          <dl className="kv">
            <dt>{t.inspector.id}</dt>
            <dd>#{org.id}</dd>
            <dt>{t.inspector.lineage}</dt>
            <dd>G{org.lineageId + 1}</dd>
            <dt>{t.inspector.generation}</dt>
            <dd>{org.generation}</dd>
            <dt>{t.inspector.birthMode}</dt>
            <dd>{t.inspector.birthModeValue[birthKey] ?? org.birthMode}</dd>
            <dt>{t.inspector.cells}</dt>
            <dd>{org.cellCount}</dd>
            <dt>{t.inspector.totalEnergy}</dt>
            <dd>{num(org.totalEnergy, 2)} e</dd>
            <dt>{t.inspector.parent}</dt>
            <dd>{org.parentOrganismId === null ? '—' : `#${org.parentOrganismId}`}</dd>
            <dt>{t.inspector.offspring}</dt>
            <dd>{org.offspring}</dd>
            {org.deathCause && (
              <>
                <dt>{t.inspector.deaths}</dt>
                <dd>{org.deathCause}</dd>
              </>
            )}
          </dl>

          <h4>{t.inspector.genome}</h4>
          {(Object.entries(org.genome) as [GenomeKey, number][]).map(([key, value]) => (
            <div className="micro__row" key={key}>
              <span className="micro__rowlabel">{labels[key] ?? key}</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${Math.round(value * 100)}%` }} />
              </span>
              <span style={{ fontFamily: 'var(--mono-font)', minWidth: '3rem', textAlign: 'right' }}>
                {num(value)}
              </span>
            </div>
          ))}

          <h4>{t.microscope.live}</h4>
          <dl className="kv">
            <dt>{t.inspector.learned}</dt>
            <dd>{org.learnedDelta.toExponential(3)}</dd>
            <dt>{t.inspector.updates}</dt>
            <dd>{org.learningUpdates}</dd>
            <dt>{t.microscope.baseline}</dt>
            <dd>{num(org.baseline, 4)}</dd>
          </dl>
          <p className="note">{t.inspector.threshold}</p>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------ Mikroskop */

export function MicroscopePanel({ client }: { client: SimClient }): React.ReactElement {
  const selectedId = useStore((s) => s.selectedId);
  const decision = useStore((s) => s.decision);
  const language = useStore((s) => s.language);
  const t = getStrings(language);
  const [mask, setMask] = useState<HiddenMask | null>(null);
  const [history, setHistory] = useState<{ tick: number; action: string; reward: number }[]>([]);

  useEffect(() => {
    setMask(null);
    setHistory([]);
  }, [selectedId]);

  const masked = useMemo(() => {
    if (!decision || !mask) return null;
    const theta = Float64Array.from(decision.thetaLive);
    const obs = Float64Array.from(decision.obs);
    const out = forwardMasked(theta, obs, mask);
    return {
      probs: Array.from(out.probs),
      action: out.probs.indexOf(Math.max(...Array.from(out.probs))),
      hidden: Array.from(out.hidden),
    };
  }, [decision, mask]);

  if (selectedId === null || !decision) {
    return <Panel title={t.microscope.title} body={<p className="note">{t.microscope.empty}</p>} />;
  }

  const labels = actionLabels(language);
  const inputNames = inputLabels(language);
  const theta = decision.thetaLive;
  const thetaInherited = decision.thetaInherited;
  const w1Count = MLP_SHAPE.INPUTS * MLP_SHAPE.HIDDEN;

  return (
    <Panel
      title={t.microscope.title}
      body={
        <>
          <p className="note">{t.microscope.architecture}</p>

          <h4>{t.microscope.action}</h4>
          <dl className="kv">
            <dt>{t.microscope.action}</dt>
            <dd style={{ color: 'var(--life)' }}>
              {labels[decision.action]} (#{decision.action})
            </dd>
            <dt>{t.microscope.greedy}</dt>
            <dd>{labels[decision.greedyAction]}</dd>
            <dt>{t.microscope.logProb}</dt>
            <dd>{num(decision.logProb, 4)}</dd>
            <dt>{t.microscope.baseline}</dt>
            <dd>{num(decision.baseline, 4)}</dd>
            <dt>{t.microscope.reward}</dt>
            <dd>{num(decision.reward, 4)}</dd>
          </dl>
          <div className="chips" style={{ marginTop: '0.3rem' }}>
            <button
              type="button"
              onClick={() => {
                client.requestDecision(selectedId);
                setHistory((h) => [
                  { tick: decision.tick, action: labels[decision.action] ?? '?', reward: decision.reward },
                  ...h,
                ].slice(0, 12));
              }}
            >
              {t.microscope.step}
            </button>
            {mask && (
              <button type="button" onClick={() => setMask(null)}>
                {t.microscope.resetMask}
              </button>
            )}
          </div>

          {history.length > 0 && (
            <>
              <h4>{t.observer.measurements}</h4>
              <table className="metric-table">
                <tbody>
                  {history.map((h) => (
                    <tr key={`${h.tick}-${h.action}`}>
                      <td>{h.tick}</td>
                      <td style={{ textAlign: 'left' }}>{h.action}</td>
                      <td>{num(h.reward, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h4>{t.microscope.output}</h4>
          {decision.probs.map((p, i) => (
            <div className="micro__row" key={`p${i}`}>
              <span className="micro__rowlabel">{labels[i]}</span>
              <span className="bar bar--resource" aria-hidden="true">
                <span style={{ width: `${Math.round(p * 100)}%` }} />
              </span>
              <span style={{ fontFamily: 'var(--mono-font)', minWidth: '3rem', textAlign: 'right' }}>
                {num(p)} (z {num(decision.logits[i], 2)})
              </span>
            </div>
          ))}

          <h4>
            {t.microscope.hidden} — <button type="button" onClick={() => setMask(null)}>{t.microscope.ablate}</button>
          </h4>
          <div className="micro__hidden">
            {decision.hidden.map((h, k) => (
              <button
                key={`h${k}`}
                type="button"
                className="micro__unit"
                data-masked={mask ? mask[k] === 0 : undefined}
                aria-pressed={mask ? mask[k] === 0 : false}
                title={`H${k}: ${num(h, 3)}`}
                onClick={() => {
                  const next: HiddenMask = mask ? new Uint8Array(mask) : new Uint8Array(MLP_SHAPE.HIDDEN).fill(1);
                  next[k] = next[k] === 0 ? 1 : 0;
                  setMask(next);
                }}
                style={{
                  background:
                    h >= 0
                      ? `color-mix(in srgb, var(--life) ${Math.round(h * 100)}%, transparent)`
                      : `color-mix(in srgb, var(--damage) ${Math.round(-h * 100)}%, transparent)`,
                  opacity: mask && mask[k] === 0 ? 0.25 : 1,
                }}
              >
                <span className="sr-only">{`H${k} = ${num(h, 3)}`}</span>
              </button>
            ))}
          </div>

          {masked && (
            <>
              <h4>{t.microscope.ablate}</h4>
              <p className="note note--warn">{t.microscope.ablateNote}</p>
              <dl className="kv">
                <dt>{t.microscope.action}</dt>
                <dd style={{ color: 'var(--resource)' }}>{labels[masked.action]}</dd>
                <dt>{t.microscope.delta}</dt>
                <dd>{num(masked.action === decision.action ? 0 : 1, 0)}</dd>
              </dl>
              <table className="metric-table">
                <tbody>
                  {masked.probs.map((p, i) => (
                    <tr key={`m${i}`}>
                      <td style={{ textAlign: 'left' }}>{labels[i]}</td>
                      <td>{num(p)}</td>
                      <td>{num(decision.probs[i] as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h4>{t.microscope.inputs}</h4>
          <div className="micro__grid">
            {decision.obs.map((v, i) => (
              <div
                key={`i${i}`}
                className="micro__unit"
                title={`${inputNames[i] ?? `#${i}`}: ${num(v, 3)}`}
                style={{
                  background:
                    v >= 0
                      ? `color-mix(in srgb, var(--resource) ${Math.round(v * 100)}%, transparent)`
                      : `color-mix(in srgb, var(--damage) ${Math.round(-v * 100)}%, transparent)`,
                }}
              />
            ))}
          </div>
          <table className="metric-table">
            <tbody>
              {decision.obs.map((v, i) => (
                <tr key={`ir${i}`}>
                  <td style={{ textAlign: 'left' }}>{inputNames[i] ?? `#${i}`}</td>
                  <td>{num(v, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>
            {t.microscope.inherited} / {t.microscope.live} / {t.microscope.delta}
          </h4>
          <dl className="kv">
            <dt>{t.microscope.inherited}</dt>
            <dd>‖θ‖ = {num(Math.sqrt(thetaInherited.reduce((a, b) => a + b * b, 0)), 4)}</dd>
            <dt>{t.microscope.live}</dt>
            <dd>‖θ‖ = {num(Math.sqrt(theta.reduce((a, b) => a + b * b, 0)), 4)}</dd>
            <dt>{t.microscope.delta}</dt>
            <dd>{decision.learnedDelta.toExponential(3)}</dd>
          </dl>
          <p className="note">
            W1 dilimi: [{PARAM_SLICES.W1_OFF}, {PARAM_SLICES.W1_OFF + w1Count}) · b1: [
            {PARAM_SLICES.B1_OFF}, {PARAM_SLICES.B1_OFF + MLP_SHAPE.HIDDEN}) · W2: [{PARAM_SLICES.W2_OFF},{' '}
            {PARAM_SLICES.W2_OFF + MLP_SHAPE.OUTPUTS * MLP_SHAPE.HIDDEN}) · b2: [{PARAM_SLICES.B2_OFF},{' '}
            {PARAM_SLICES.B2_OFF + MLP_SHAPE.OUTPUTS})
          </p>
          <p className="note note--warn">{t.microscope.evidenceWarning}</p>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------- Soy defteri */

export function LineagePanel({ client }: { client: SimClient }): React.ReactElement {
  const lineages = useStore((s) => s.lineages);
  const language = useStore((s) => s.language);
  const t = getStrings(language);
  const labels = genomeLabels(language);

  useEffect(() => {
    client.listLineages();
  }, [client]);

  if (lineages.length === 0) {
    return <Panel title={t.lineage.title} body={<p className="note">{t.lineage.empty}</p>} />;
  }

  return (
    <Panel
      title={t.lineage.title}
      body={
        <>
          <p className="note">{t.lineage.note}</p>
          {lineages.slice(0, 12).map((l) => {
            const latest = l.generations[l.generations.length - 1];
            const distance = latest
              ? Object.keys(l.ancestorGenome).reduce(
                  (s, k) => s + Math.abs((l.ancestorGenome[k] ?? 0) - (latest.genome[k] ?? 0)),
                  0,
                ) / Object.keys(l.ancestorGenome).length
              : 0;
            return (
              <section key={l.id}>
                <h4>
                  {l.label} · {t.lineage.maxGeneration}: {l.maxGeneration}
                </h4>
                <dl className="kv">
                  <dt>{t.lineage.founder}</dt>
                  <dd>#{l.founderOrganismId}</dd>
                  <dt>{t.lineage.organisms}</dt>
                  <dd>
                    {l.aliveCount}/{l.organismCount}
                  </dd>
                  <dt>{t.lineage.distance}</dt>
                  <dd>{num(distance, 4)}</dd>
                </dl>
                <div className="chips">
                  {(Object.entries(l.meanGenome) as [GenomeKey, number][]).map(([k, v]) => (
                    <span className="chip" key={k}>
                      {labels[k] ?? k}: {num(v as number, 2)}
                    </span>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      }
    />
  );
}

/* -------------------------------------------------------------- Gözlemci */

export function ObserverPanel({ client }: { client: SimClient }): React.ReactElement {
  const language = useStore((s) => s.language);
  const evidence = useStore((s) => s.evidence);
  const localSummary = useStore((s) => s.localSummary);
  const modelReport = useStore((s) => s.modelReport);
  const modelState = useStore((s) => s.modelState);
  const selectedId = useStore((s) => s.selectedId);
  const t = getStrings(language);
  const [question, setQuestion] = useState('');

  const ask = (q: string): void => {
    const text = q.trim();
    if (!text) return;
    useStore.getState().setPanel('observer');
    client.evidencePack(text, 'A', selectedId);
  };

  return (
    <Panel
      title={t.observer.title}
      body={
        <>
          <p className="note">{t.observer.hint}</p>

          <div className="observer__quick">
            {[t.observer.prompts.tell, t.observer.prompts.lineage, t.observer.prompts.learned, t.observer.prompts.next].map(
              (p) => (
                <button type="button" key={p} onClick={() => ask(p)}>
                  {p}
                </button>
              ),
            )}
          </div>

          <div className="observer__prompt">
            <input
              type="text"
              value={question}
              placeholder={t.observer.ask_placeholder}
              aria-label={t.observer.ask}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ask(question);
              }}
            />
            <button type="button" onClick={() => ask(question)}>
              {t.observer.ask}
            </button>
          </div>

          {modelState === 'loading' && <p className="note">{t.experiments.running}</p>}
          {modelState === 'error' && <p className="note note--danger">{t.observer.timeout}</p>}

          {localSummary && (
            <>
              <div className="chips" style={{ marginBottom: '0.5rem' }}>
                <span className="chip chip--resource">{t.observer.sourceLocal}</span>
              </div>
              <h4>{t.observer.observations}</h4>
              <ul>
                {localSummary.observations.map((o, i) => (
                  <li key={`o${i}`}>{o}</li>
                ))}
              </ul>
              <h4>{t.observer.interpretations}</h4>
              <ul>
                {localSummary.interpretations.map((o, i) => (
                  <li key={`i${i}`}>{o}</li>
                ))}
              </ul>
              <h4>{t.observer.uncertainties}</h4>
              <ul>
                {localSummary.uncertainties.map((o, i) => (
                  <li key={`u${i}`}>{o}</li>
                ))}
              </ul>
              <h4>{t.observer.nextExperiment}</h4>
              <p className="note">{localSummary.nextExperiment}</p>
              <h4>{t.observer.evidence}</h4>
              <p style={{ fontFamily: 'var(--mono-font)', fontSize: '0.7rem' }}>
                {localSummary.evidenceIds.length > 0 ? localSummary.evidenceIds.join(', ') : '—'}
              </p>
            </>
          )}

          {modelReport ? (
            <>
              <div className="chips" style={{ marginBottom: '0.5rem' }}>
                <span className="chip chip--life">{t.observer.sourceModel}</span>
              </div>
              <ObserverReport report={modelReport} />
            </>
          ) : null}

          {evidence && (
            <>
              <h4>{t.observer.measurements}</h4>
              <table className="metric-table">
                <tbody>
                  {evidence.measurements.slice(0, 24).map((m) => (
                    <tr key={m.metricRef}>
                      <td style={{ textAlign: 'left' }}>{m.metricRef}</td>
                      <td>
                        {m.value.toFixed(3)} {m.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      }
    />
  );
}

/** Model yanıtındaki sayıları kanıtla karşılaştırır; doğrulanamayanları işaretler. */
function ObserverReport({ report }: { report: unknown }): React.ReactElement | null {
  const language = useStore((s) => s.language);
  const t = getStrings(language);
  const r = report as {
    sourceMode?: string;
    observations?: string[];
    interpretations?: string[];
    uncertainties?: string[];
    nextExperiment?: string;
    claims?: { value: number; unit: string; verified: boolean; matchedMetric: string | null }[];
  };
  if (!r || typeof r !== 'object') return null;
  return (
    <>
      {r.claims && (
        <>
          <h4>{t.observer.unverifiedNumbers}</h4>
          <table className="metric-table">
            <tbody>
              {r.claims.slice(0, 20).map((c, i) => (
                <tr key={`c${i}`}>
                  <td style={{ textAlign: 'left' }}>{c.value}</td>
                  <td>
                    {c.verified && c.matchedMetric ? (
                      // Hangi ölçümle eşleştiği gösterilir: denetim **değer**
                      // karşılaştırır, anlam karşılaştırmaz. "3 organizma
                      // bağ kurdu" cümlesindeki 3, bondCount=3 ile eşleşip
                      // doğrulanmış görünebilir; eşleşen metrik yazılmazsa
                      // bu yanlış kabul görünmez kalır.
                      <span className="claim__metric">{c.matchedMetric}</span>
                    ) : (
                      c.unit
                    )}
                  </td>
                  <td className={c.verified ? 'verified' : 'unverified'}>
                    {c.verified ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {r.observations && (
        <>
          <h4>{t.observer.observations}</h4>
          <ul>
            {r.observations.map((o, i) => (
              <li key={`mo${i}`}>{o}</li>
            ))}
          </ul>
        </>
      )}
      {r.interpretations && (
        <>
          <h4>{t.observer.interpretations}</h4>
          <ul>
            {r.interpretations.map((o, i) => (
              <li key={`mi${i}`}>{o}</li>
            ))}
          </ul>
        </>
      )}
      {r.uncertainties && (
        <>
          <h4>{t.observer.uncertainties}</h4>
          <ul>
            {r.uncertainties.map((o, i) => (
              <li key={`mu${i}`}>{o}</li>
            ))}
          </ul>
        </>
      )}
      {r.nextExperiment && (
        <>
          <h4>{t.observer.nextExperiment}</h4>
          <p className="note">{r.nextExperiment}</p>
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------- Panel kabı */

export function Panel({
  title,
  body,
  right,
}: {
  title: string;
  body: React.ReactNode;
  right?: React.ReactNode;
}): React.ReactElement {
  const language = useStore((s) => s.language);
  const setPanel = useStore((s) => s.setPanel);
  const t = getStrings(language);
  return (
    <div className="panel">
      <div className="panel__head">
        <span>{title}</span>
        <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          {right}
          <button type="button" onClick={() => setPanel(null)} aria-label={t.actions.close}>
            ×
          </button>
        </span>
      </div>
      <div className="panel__body">{body}</div>
    </div>
  );
}
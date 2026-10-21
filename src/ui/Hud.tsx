/**
 * Cell to Mind — HUD, canlı listesi ve habitat araçları.
 *
 * HUD ekranın yaklaşık %20–25'ini aşmaz: ince bir zaman/nüfus şeridi ve
 * kompakt araç grubu. Ayrıntılar ayrı panellerdedir.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../engine/store.ts';
import { format, getStrings, genomeLabels } from '../i18n/index.ts';
import {
  MAX_RENDER_CELLS,
  MAX_RENDER_RESOURCES,
  ORGANISM_LIST_LIMIT,
} from '../engine/limits.ts';
import type { SimClient, SpeedMultiplier } from '../engine/client.ts';

function fmt(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function Hud({ client }: { client: SimClient }): React.ReactElement {
  const s = useStore();
  const t = getStrings(s.language);

  return (
    <header className="hud" role="banner">
      <div className="hud__brand">
        <span className="hud__title">{t.title}</span>
        <span className="hud__subtitle">{t.subtitle}</span>
      </div>

      <div className="hud__stats">
        <Stat label={t.hud.tick} value={fmt(s.tick)} />
        <Stat label={t.hud.simTime} value={`${fmt(s.simTime, 1)} s`} />
        <Stat label={t.hud.population} value={fmt(s.population)} tone="life" />
        <Stat label={t.hud.energy} value={`${fmt(s.systemEnergy)} e`} tone="resource" />
        <Stat
          label={t.hud.residual}
          value={`${s.energyResidual >= 0 ? '' : '−'}${fmt(Math.abs(s.energyResidual), 3)} e`}
          tone={Math.abs(s.energyResidual) > 0.01 ? 'damage' : undefined}
        />
        {s.population > MAX_RENDER_CELLS && (
          // ⚠️ 3B sahne bu sayının ALTINDA hücre gösterir. Sessiz kırpma
          // olursa HUD ile sahne ayrışır; bu satır ayrışmayı görünür kılar.
          <Stat
            label={t.hud.renderLimit}
            value={`${fmt(MAX_RENDER_CELLS)} / ${fmt(s.population)}`}
            tone="damage"
            title={format(t.hud.renderLimitNote, {
              shown: fmt(MAX_RENDER_CELLS),
              total: fmt(s.population),
              hidden: fmt(s.population - MAX_RENDER_CELLS),
            })}
          />
        )}
        {s.resourceCount > MAX_RENDER_RESOURCES && (
          // Aynı sınıf, kaynaklar için: düğüm sayısı tavanı aşarsa kaynak
          // düğümleri görünmez olur ve kullanıcı bunu **öğrenmez**.
          <Stat
            label={t.hud.resourceLimit}
            value={`${fmt(MAX_RENDER_RESOURCES)} / ${fmt(s.resourceCount)}`}
            tone="damage"
            title={format(t.hud.resourceLimitNote, {
              shown: fmt(MAX_RENDER_RESOURCES),
              total: fmt(s.resourceCount),
              hidden: fmt(s.resourceCount - MAX_RENDER_RESOURCES),
            })}
          />
        )}
      </div>

      <div className="hud__tools">
        <div className="speeds" role="group" aria-label={t.hud.speed}>
          {([1, 2, 4] as SpeedMultiplier[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={s.speed === v}
              onClick={() => {
                useStore.getState().setSpeed(v);
                client.setSpeed(v);
              }}
            >
              {v}×
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !useStore.getState().running;
            useStore.getState().setRunning(next);
            client.setRunning(next);
          }}
        >
          {s.running ? t.hud.pause : t.hud.resume}
        </button>
        <button type="button" onClick={() => useStore.getState().togglePanel('settings')} aria-pressed={s.panel === 'settings'}>
          {t.actions.settings}
        </button>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone?: 'life' | 'resource' | 'damage';
  title?: string;
}): React.ReactElement {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value${tone ? ` stat__value--${tone}` : ''}`} title={title}>
        {value}
      </span>
    </div>
  );
}

/** Canlı listesi: klavyeyle seçilebilir, görünür odak, canlı bölge. */
export function OrganismList({ client }: { client: SimClient }): React.ReactElement {
  const organisms = useStore((s) => s.organisms);
  const selectedId = useStore((s) => s.selectedId);
  const language = useStore((s) => s.language);
  const t = getStrings(language);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = organisms.filter((o) => o.alive);
    if (!q) return list;
    return list.filter((o) => String(o.id).includes(q) || `g${o.lineageId}`.includes(q));
  }, [organisms, query]);

  // Kırpma **görünür** olmalı: `matching.length` (kırpılmamış) ile
  // `filtered.length` (gösterilen) ayrı tutulur, fark varsa kullanıcıya söylenir.
  const filtered = useMemo(() => matching.slice(0, ORGANISM_LIST_LIMIT), [matching]);
  const truncated = matching.length > filtered.length;

  useEffect(() => {
    const index = filtered.findIndex((o) => o.id === selectedId);
    if (index >= 0) setFocusIndex(index);
  }, [filtered, selectedId]);

  const select = (id: number | null): void => {
    useStore.getState().select(id);
    if (id !== null) {
      client.requestDecision(id);
      client.listLineages();
    }
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <span>{t.list.title}</span>
        <span>{filtered.length}</span>
      </div>
      <div style={{ padding: '0.5rem 0.7rem 0.2rem' }}>
        <input
          type="search"
          value={query}
          placeholder={t.list.search}
          aria-label={t.list.search}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="orglist__header" aria-hidden="true">
        {t.list.columns.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <ul
        className="orglist"
        ref={listRef}
        role="listbox"
        aria-label={t.list.title}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(filtered.length - 1, focusIndex + 1);
            setFocusIndex(next);
            const org = filtered[next];
            if (org) select(org.id);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = Math.max(0, focusIndex - 1);
            setFocusIndex(next);
            const org = filtered[next];
            if (org) select(org.id);
          } else if (e.key === 'Home') {
            e.preventDefault();
            setFocusIndex(0);
            const org = filtered[0];
            if (org) select(org.id);
          } else if (e.key === 'End') {
            e.preventDefault();
            setFocusIndex(filtered.length - 1);
            const org = filtered[filtered.length - 1];
            if (org) select(org.id);
          }
        }}
      >
        {filtered.length === 0 && <li className="panel__body">{t.list.empty}</li>}
        {filtered.map((o, i) => (
          <li
            key={o.id}
            className={`orglist__item${o.alive ? '' : ' orglist__item--dead'}`}
            role="option"
            aria-selected={o.id === selectedId}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => {
              setFocusIndex(i);
              select(o.id);
            }}
          >
            <span>#{o.id}</span>
            <span>G{o.lineageId + 1}</span>
            <span>{o.generation}</span>
            <span>{o.cellCount}</span>
            <span className="orglist__energy" aria-hidden="true">
              <span style={{ width: `${Math.round(Math.min(1, o.meanEnergyNorm) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
      {truncated && (
        <p className="panel__hint">
          {format(t.list.truncated, { shown: fmt(filtered.length), total: fmt(matching.length) })}
        </p>
      )}
    </div>
  );
}

/** Habitat koşul araçları: besin, ışık, akıntı, baskı, öğrenme. */
export function Toolbar({ client }: { client: SimClient }): React.ReactElement {
  const settings = useStore((s) => s.settings);
  const language = useStore((s) => s.language);
  const predator = useStore((s) => s.predator);
  const t = getStrings(language);

  const set = (patch: Partial<typeof settings>): void => {
    useStore.getState().setSettings(patch);
  };

  return (
    <footer className="toolbar" role="toolbar" aria-label={t.title}>
      <div className="toolbar__group">
        <Slider
          label={t.hud.light}
          value={settings.light}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => {
            set({ light: v });
            client.setSetting('light', v);
          }}
        />
        <Slider
          label={t.hud.current}
          value={settings.currentStrength}
          min={0}
          max={0.2}
          step={0.005}
          format={(v) => v.toFixed(3)}
          onChange={(v) => {
            set({ currentStrength: v });
            client.setSetting('currentStrength', v);
          }}
        />
        <Slider
          label={t.hud.pressure}
          value={settings.selectionPressure}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => {
            set({ selectionPressure: v });
            client.setSetting('selectionPressure', v);
          }}
        />
      </div>

      <div className="toolbar__group">
        <button
          type="button"
          aria-pressed={settings.learningEnabled}
          onClick={() => {
            const next = !settings.learningEnabled;
            set({ learningEnabled: next });
            client.setLearning(next);
          }}
        >
          {t.hud.learning}: {settings.learningEnabled ? 'Açık' : 'Kapalı'}
        </button>
        <button type="button" onClick={() => client.addNutrient('A', 900)}>
          + A
        </button>
        <button type="button" onClick={() => client.addNutrient('B', 900)}>
          + B
        </button>
        {!predator.active && (
          <button type="button" onClick={() => client.revivePredator(400)}>
            {t.actions.revivePredator}
          </button>
        )}
      </div>

      <div className="toolbar__group" style={{ marginLeft: 'auto' }}>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'inspector'}
          onClick={() => useStore.getState().togglePanel('inspector')}
        >
          {t.actions.inspector}
        </button>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'microscope'}
          onClick={() => useStore.getState().togglePanel('microscope')}
        >
          {t.actions.microscope}
        </button>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'lineage'}
          onClick={() => useStore.getState().togglePanel('lineage')}
        >
          {t.actions.lineage}
        </button>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'experiments'}
          onClick={() => useStore.getState().togglePanel('experiments')}
        >
          {t.actions.experiments}
        </button>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'evolution'}
          onClick={() => useStore.getState().togglePanel('evolution')}
        >
          {t.actions.evolution}
        </button>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'lifemap'}
          onClick={() => useStore.getState().togglePanel('lifemap')}
        >
          {t.actions.lifemap}
        </button>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'events'}
          onClick={() => useStore.getState().togglePanel('events')}
        >
          {t.actions.events}
        </button>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'observer'}
          onClick={() => useStore.getState().togglePanel('observer')}
        >
          {t.actions.observer}
        </button>
        <button
          type="button"
          aria-pressed={useStore.getState().panel === 'data'}
          onClick={() => useStore.getState().togglePanel('data')}
        >
          {t.actions.data}
        </button>
      </div>
    </footer>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}): React.ReactElement {
  const id = `slider-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="slider">
      <label className="toolbar__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider__value">{format ? format(value) : value.toFixed(2)}</span>
    </div>
  );
}

/** Üst düzey bildirimler (hata, başarı, model zaman aşımı). */
export function Notices(): React.ReactElement | null {
  const notices = useStore((s) => s.notices);
  const dismiss = useStore((s) => s.dismissNotice);
  if (notices.length === 0) return null;
  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`notice notice--${n.kind}`}>
          <span style={{ flex: 1 }}>{n.message}</span>
          <button type="button" onClick={() => dismiss(n.id)} aria-label="Kapat">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export { genomeLabels };
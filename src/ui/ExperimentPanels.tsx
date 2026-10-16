/**
 * Cell to Mind — deneyler paneli ve veri paneli.
 *
 * Dürüstlük kuralı: bir deney çalıştırılmadıysa "henüz gözlenmedi" yazılır.
 * Kabul hedefi gerçekleşmiş sonuç gibi sunulmaz.
 */

import { useEffect, useState } from 'react';
import { useStore } from '../engine/store.ts';
import type { SimClient } from '../engine/client.ts';
import { getStrings } from '../i18n/index.ts';
import { Panel } from './Panels.tsx';
import {
  deleteRecord,
  downloadJson,
  listRecords,
  pickJsonFile,
  saveRecord,
  StorageError,
  type SavedRecord,
} from '../engine/storage.ts';

export function ExperimentsPanel({ client }: { client: SimClient }): React.ReactElement {
  const language = useStore((s) => s.language);
  const t = getStrings(language);
  // `running` artık kullanılmıyor: hiçbir şey koşmuyor, ilerleme taklidi yok.
  const running: string | null = null;
  const [result, setResult] = useState<string | null>(null);

  /**
   * ⚠️ Bu düğme bir deneyi **ÇALIŞTIRMAZ.**
   *
   * Worker'daki `runExperiment` yalnızca `{ queued: true }` yankılar; hiçbir
   * deneyi başlatmaz ve `experimentResult` mesajının HİÇBİR abonelisi yoktur
   * (yalnız tip bildirimi ve üretici var). Önceden burada 400 ms'lik sahte bir
   * "çalışıyor" göstergesi vardı ve sonuç alanına aynı anda hem "çalışıyor"
   * hem "bu deney henüz çalıştırılmadı" yazılıyordu — kendi kendini çürüten
   * bir iddia.
   *
   * Şimdi ilerleme taklidi yapılmıyor ve dürüst mesaj gösteriliyor. Gerçek
   * deneyler `npm run experiments` ile Node'da koşar.
   */
  const run = (name: string, seed: number): void => {
    client.runExperiment(name, seed);
  };

  return (
    <Panel
      title={t.experiments.title}
      body={
        <>
          <p className="note">{t.experiments.hint}</p>
          <p className="note note--warn">{t.experiments.honestNote}</p>

          <h4>{t.experiments.seeds}</h4>
          <dl className="kv">
            <dt>{t.experiments.trainSeeds}</dt>
            <dd>{t.experiments.trainSeeds}</dd>
            <dt>{t.experiments.evalSeeds}</dt>
            <dd>{t.experiments.evalSeeds}</dd>
            <dt>{t.experiments.budget}</dt>
            <dd>—</dd>
          </dl>

          <h4>{t.experiments.togetherness}</h4>
          <p>{t.experiments.togethernessDesc}</p>
          <button
            type="button"
            disabled={running !== null}
            onClick={() => {
              run('togetherness', 1);
              setResult(t.experiments.notWired);
            }}
          >
            {running === 'togetherness' ? t.experiments.running : t.experiments.run}
          </button>

          <h4>{t.experiments.adaptation}</h4>
          <p>{t.experiments.adaptationDesc}</p>
          <button
            type="button"
            disabled={running !== null}
            onClick={() => {
              run('adaptation', 1);
              setResult(t.experiments.notWired);
            }}
          >
            {running === 'adaptation' ? t.experiments.running : t.experiments.run}
          </button>

          <h4>{t.experiments.learning}</h4>
          <p>{t.experiments.learningDesc}</p>
          <button
            type="button"
            disabled={running !== null}
            onClick={() => {
              run('learning', 1001);
              setResult(t.experiments.notWired);
            }}
          >
            {running === 'learning' ? t.experiments.running : t.experiments.run}
          </button>

          <h4>{t.experiments.ablation}</h4>
          <p>{t.experiments.ablationDesc}</p>

          <h4>{t.experiments.result}</h4>
          <p className="note">{result ?? t.experiments.notYetRun}</p>
        </>
      }
    />
  );
}

export function DataPanel({ client }: { client: SimClient }): React.ReactElement {
  const language = useStore((s) => s.language);
  const tick = useStore((s) => s.tick);
  const simVersion = useStore((s) => s.simVersion);
  const notify = useStore((s) => s.notify);
  const t = getStrings(language);
  const [records, setRecords] = useState<SavedRecord[]>([]);

  const refresh = (): void => {
    listRecords()
      .then(setRecords)
      .catch(() => setRecords([]));
  };

  useEffect(refresh, []);

  const doSave = (): void => {
    client.snapshot('manual');
  };

  const doLoad = (id: string): void => {
    listRecords()
      .then((all) => {
        const rec = all.find((r) => r.id === id);
        if (rec) client.load(rec.snapshotJson, rec.label);
      })
      .catch(() => notify('error', t.data.storageError));
  };

  return (
    <Panel
      title={t.data.title}
      body={
        <>
          <div className="chips" style={{ marginBottom: '0.5rem' }}>
            <button type="button" onClick={doSave}>
              {t.data.save}
            </button>
            <button
              type="button"
              onClick={() => {
                const name = `ctm-dal-${Date.now()}`;
                client.branch(name);
                notify('info', t.data.branchCreated);
              }}
            >
              {t.actions.branch}
            </button>
          </div>

          <h4>{t.data.list}</h4>
          {records.length === 0 && <p className="note">{t.data.empty}</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {records.map((r) => (
              <li key={r.id} className="orglist__item" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <span>
                  {r.label} · {r.tick} · {(r.bytes / 1024).toFixed(0)} KiB
                </span>
                <button type="button" onClick={() => doLoad(r.id)}>
                  {t.data.load}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteRecord(r.id)
                      .then(refresh)
                      .catch(() => notify('error', t.data.storageError));
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <h4>{t.data.export}</h4>
          <div className="chips">
            <button
              type="button"
              onClick={() => {
                client.snapshot('export');
              }}
            >
              {t.data.export}
            </button>
            <button
              type="button"
              onClick={async () => {
                const text = await pickJsonFile();
                if (!text) return;
                client.load(text, 'import');
              }}
            >
              {t.data.import}
            </button>
          </div>
          <p className="note">
            {t.hud.tick}: {tick} · sim {simVersion || '—'}
          </p>
        </>
      }
    />
  );
}

export function SettingsPanel(): React.ReactElement {
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const setReducedMotion = useStore((s) => s.setReducedMotion);
  const muted = useStore((s) => s.muted);
  const setMuted = useStore((s) => s.setMuted);
  const t = getStrings(language);

  return (
    <Panel
      title={t.settings.title}
      body={
        <>
          <h4>{t.settings.language}</h4>
          <div className="chips">
            <button type="button" aria-pressed={language === 'tr'} onClick={() => setLanguage('tr')}>
              {t.settings.turkish}
            </button>
            <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>
              {t.settings.english}
            </button>
          </div>

          <h4>{t.settings.reducedMotion}</h4>
          <div className="chips">
            <button
              type="button"
              aria-pressed={reducedMotion}
              onClick={() => setReducedMotion(!reducedMotion)}
            >
              {reducedMotion ? 'Açık' : 'Kapalı'}
            </button>
          </div>
          <p className="note">{t.settings.reducedMotionHint}</p>

          <h4>{t.settings.silent}</h4>
          <div className="chips">
            <button type="button" aria-pressed={muted} onClick={() => setMuted(!muted)}>
              {muted ? 'Açık' : 'Kapalı'}
            </button>
          </div>
          <p className="note">{t.settings.silentHint}</p>

          <p className="note note--warn">{t.inspector.threshold}</p>
        </>
      }
    />
  );
}

export { downloadJson, saveRecord, StorageError };
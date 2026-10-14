/**
 * Cell to Mind — uygulama kabuğu.
 *
 * Worker tek yazardır; ana iş parçacığı yalnızca komut gönderir ve kare paketini
 * sahneye aktarır. React durumu kare başına güncellenmez.
 */

import { useEffect, useMemo, useRef } from 'react';
import { SimClient } from './engine/client.ts';
import { setFrame } from './engine/frame.ts';
import { useStore } from './engine/store.ts';
import { Scene } from './scene/Scene.tsx';
import { Hud, Notices, OrganismList, Toolbar } from './ui/Hud.tsx';
import { InspectorPanel, LineagePanel, MicroscopePanel, ObserverPanel } from './ui/Panels.tsx';
import { DataPanel, ExperimentsPanel, SettingsPanel } from './ui/ExperimentPanels.tsx';
import { EvolutionPanel } from './ui/EvolutionPanel.tsx';
import { LifeMapPanel } from './ui/LifeMapPanel.tsx';
import { EventsPanel } from './ui/EventsPanel.tsx';
import { getStrings } from './i18n/index.ts';
import { H, RES, RESOURCE_FLOATS } from './worker/protocol.ts';
import { downloadJson, saveRecord, StorageError } from './engine/storage.ts';
import { buildLocalSummary, verifyNumericClaims } from './worker/evidence.ts';

const ORGANISM_REFRESH_MS = 900;

export function App(): React.ReactElement {
  const client = useMemo(() => new SimClient(), []);
  const store = useStore();
  const t = getStrings(store.language);
  const bootedRef = useRef(false);

  // ---------------------------------------------------------- worker bağlantısı
  useEffect(() => {
    const dispose = client.on((message) => {
      const s = useStore.getState();
      switch (message.type) {
        case 'ready':
          s.setReady(message.simVersion, { size: message.habitat.size, rocks: message.rocks });
          s.setSettings({
            light: 0.62,
            currentStrength: 0.045,
            selectionPressure: 0.18,
            learningEnabled: true,
          });
          client.listOrganisms();
          break;
        case 'frame': {
          const data = new Float32Array(message.buffer);
          setFrame(data);
          // Telemetri düşük frekansta panele yazılır (kare başına render yok).
          s.setTelemetry({
            tick: data[H.TICK] as number,
            simTime: data[H.SIM_TIME] as number,
            population: data[H.POPULATION] as number,
            systemEnergy: data[H.SYSTEM_ENERGY] as number,
            externalInput: data[H.EXTERNAL_INPUT] as number,
            dissipated: data[H.DISSIPATED] as number,
            initialEnergy: data[H.INITIAL_ENERGY] as number,
            largestColony: data[H.LARGEST_COLONY] as number,
            coloniesFour: data[H.COLONIES_FOUR] as number,
            bondCount: data[H.BOND_COUNT] as number,
            light: data[H.LIGHT] as number,
            predatorActive: (data[H.PREDATOR_ACTIVE] as number) > 0.5,
            predatorEnergy: data[H.PREDATOR_ENERGY] as number,
            px: data[H.PREDATOR_X] as number,
            py: data[H.PREDATOR_Y] as number,
            pz: data[H.PREDATOR_Z] as number,
            pr: data[H.PREDATOR_RADIUS] as number,
          });
          break;
        }
        case 'organisms':
          s.setOrganisms(message.organisms);
          break;
        case 'lineages':
          s.setLineages(message.lineages);
          break;
        case 'decision':
          s.setDecision(message.decision);
          break;
        case 'evidence':
          s.setEvidence(message.pack);
          void runObserver(message.pack.question);
          break;
        case 'evolutionProgress':
          s.evolutionProgress(message.generation, message.best);
          break;
        case 'lifeMapResult':
          s.setLifeMap(message.snapshot);
          break;
        case 'events':
          s.setEvents(message.events, message.totalKnown);
          break;
        case 'evolutionResult':
          s.evolutionDone({
            organismId: message.organismId,
            applied: message.applied,
            startScore: message.startScore,
            bestScore: message.bestScore,
            randomBaseline: message.randomBaseline,
            startHoldout: message.startHoldout,
            bestHoldout: message.bestHoldout,
            holdoutGain: message.holdoutGain,
            history: message.history,
            evaluations: message.evaluations,
            spentMs: message.spentMs,
          });
          s.notify(
            message.holdoutGain >= 0 ? 'success' : 'info',
            `Evrim atölyesi: görülmemiş tohumlarda ${message.holdoutGain >= 0 ? '+' : ''}${message.holdoutGain.toFixed(3)}`,
          );
          break;
        case 'snapshot':
          void handleSnapshot(message.snapshotJson, message.tick, message.bytes);
          break;
        case 'error':
          s.notify('error', `${t.status.error}: ${message.message}${message.detail ? ` — ${message.detail}` : ''}`);
          break;
        default:
          break;
      }
    });

    const offStatus = client.onStatus((status, error) => {
      const s = useStore.getState();
      s.setStatus(status, error);
      if (status === 'unsupported' && error) {
        s.notify('error', `${t.settings.title}: ${error}`);
      }
    });

    const offFrame = client.onFrame((data) => setFrame(data));

    if (!bootedRef.current) {
      bootedRef.current = true;
      client.start();
      client.init({
        seed: 20261006,
        preset: 'standard',
        population: 48,
        learningEnabled: true,
        selectionPressure: 0.18,
      });
    }

    // Düşük frekanlı canlı listesi yenileme (klavyeyle gezinilebilir kalsın).
    const timer = window.setInterval(() => {
      if (useStore.getState().ready) client.listOrganisms();
    }, ORGANISM_REFRESH_MS);

    return () => {
      dispose();
      offStatus();
      offFrame();
      window.clearInterval(timer);
      client.stop();
    };
  }, [client, t.status.error, t.settings.title]);

  // --------------------------------------------------- gözlemci + kayıt işleyicileri
  async function handleSnapshot(json: string, tick: number, bytes: number): Promise<void> {
    const s = useStore.getState();
    try {
      await saveRecord({
        id: `snap-${Date.now()}`,
        label: `tick-${tick}`,
        tick,
        simVersion: s.simVersion || '1.0.0',
        bytes,
        snapshotJson: json,
      });
      s.notify('success', t.data.saved);
    } catch (err) {
      s.notify('error', err instanceof StorageError ? err.message : t.data.storageError);
    }
  }

  async function runObserver(question: string): Promise<void> {
    const s = useStore.getState();
    // 1) Her zaman yerel kural özeti üretilir — dürüst taban çizgi.
    const pack = s.evidence;
    if (pack) s.setLocalSummary(buildLocalSummary(pack));

    // 2) Sunucu rotası denenir. Anahtar yoksa/hata olursa OYUN DEVAM EDER ve
    //    yerel özet kalır. Sahte model yanıtı üretilmez.
    try {
      s.setModelState('loading');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      const response = await fetch('/api/observer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, evidence: s.evidence }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      if (!response.ok) {
        s.setModelState('no-key', `${response.status}`);
        return;
      }
      const report = (await response.json()) as { text?: string; sourceMode?: string };
      if (!report.text) {
        s.setModelState('no-key');
        return;
      }
      // Model yanıtındaki sayıları kanıt paketine karşı doğrula.
      const claims = s.evidence ? verifyNumericClaims(report.text, s.evidence) : [];
      s.setModelReport({ ...report, claims });
      s.setModelState('done');
    } catch {
      s.setModelState('no-key');
    }
  }

  // ---------------------------------------------------------------- düzen
  const panel = store.panel;

  return (
    <div className="app">
      <Hud client={client} />
      <div className="stage">
        <Scene />
        <aside className="side" aria-label={t.list.title}>
          <OrganismList client={client} />
        </aside>
        {panel && (
          <aside className="side side--right" aria-label={t.actions.inspector}>
            {panel === 'inspector' && <InspectorPanel />}
            {panel === 'microscope' && <MicroscopePanel client={client} />}
            {panel === 'lineage' && <LineagePanel client={client} />}
            {panel === 'experiments' && <ExperimentsPanel client={client} />}
            {panel === 'evolution' && <EvolutionPanel client={client} />}
            {panel === 'lifemap' && <LifeMapPanel client={client} />}
            {panel === 'events' && <EventsPanel client={client} />}
            {panel === 'observer' && <ObserverPanel client={client} />}
            {panel === 'data' && <DataPanel client={client} />}
            {panel === 'settings' && <SettingsPanel />}
          </aside>
        )}
        <Notices />
        {!store.ready && (
          <div className="notice" style={{ top: '50%', transform: 'translate(-50%, -50%)' }}>
            {t.status.starting}
          </div>
        )}
      </div>
      <Toolbar client={client} />
      {/* Dışa aktarma yardımcısı: worker kayıt JSON'unu indirir. */}
      <DownloadBridge client={client} />
    </div>
  );
}

/** Dışa aktarma isteğini worker yanıtı üzerinden gerçekleştirir. */
function DownloadBridge({ client }: { client: SimClient }): null {
  const armedRef = useRef(false);
  useEffect(() => {
    const dispose = client.on((message) => {
      if (message.type !== 'snapshot') return;
      if (!armedRef.current) return;
      armedRef.current = false;
      downloadJson(`cell-to-mind-${message.tick}.json`, message.snapshotJson);
    });
    return dispose;
  }, [client]);
  useEffect(() => {
    const handler = (): void => {
      armedRef.current = true;
      useStore.getState().notify('info', 'JSON hazırlanıyor…');
    };
    (globalThis as unknown as { __ctmExport?: () => void }).__ctmExport = handler;
  }, []);
  void RES;
  void RESOURCE_FLOATS;
  return null;
}
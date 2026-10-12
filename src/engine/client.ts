/**
 * Cell to Mind — ana iş parçacığı worker istemcisi.
 *
 * Kare paketleri doğrudan `Float32Array` olarak scene bileşenlerine iletilir;
 * React durumuna kare başına hücre yazılmaz.
 */

import type {
  DecisionSnapshot,
  EvidencePack,
  LineageSummary,
  OrganismSummary,
  RockSeed,
  SpeedMultiplier,
  WorkerRequest,
  WorkerResponse,
} from '../worker/protocol.ts';

export type ClientStatus = 'idle' | 'starting' | 'running' | 'paused' | 'error' | 'unsupported';

type Listener = (message: WorkerResponse) => void;
type FrameListener = (data: Float32Array) => void;
type StatusListener = (status: ClientStatus, error?: string) => void;

export class SimClient {
  private worker: Worker | null = null;
  private listeners = new Set<Listener>();
  private frameListeners = new Set<FrameListener>();
  private statusListeners = new Set<StatusListener>();
  private status: ClientStatus = 'idle';
  private lastError: string | null = null;

  status_(): ClientStatus {
    return this.status;
  }

  error(): string | null {
    return this.lastError;
  }

  start(): void {
    if (this.worker) return;
    if (typeof Worker === 'undefined') {
      this.setStatus('unsupported', 'Bu tarayıcı Web Worker desteklemiyor.');
      return;
    }
    try {
      this.worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), {
        type: 'module',
        name: 'ctm-sim',
      });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.dispatch(event.data);
      this.worker.onerror = (event) => {
        this.lastError = event.message || 'Worker hatası';
        this.setStatus('error', this.lastError);
      };
      this.worker.onmessageerror = () => {
        this.lastError = 'Worker mesajı çözümlenemedi (yapılandırılmamış veri).';
        this.setStatus('error', this.lastError);
      };
      this.setStatus('starting');
    } catch (err) {
      this.lastError = (err as Error).message;
      this.setStatus('error', this.lastError);
    }
  }

  /** Grafik bağımı kaybında worker'a bağlanmadan yeniden başlatılabilir. */
  restart(): void {
    this.stop();
    this.start();
  }

  stop(): void {
    this.worker?.terminate();
    this.worker = null;
    this.setStatus('idle');
  }

  private setStatus(status: ClientStatus, error?: string): void {
    this.status = status;
    if (error) this.lastError = error;
    for (const l of this.statusListeners) l(status, error);
  }

  private dispatch(message: WorkerResponse): void {
    if (message.type === 'frame') {
      // Kare paketi hem sahne dinleyicilerine hem de genel dinleyicilere gider;
      // burada ERKEN DÖNMEK telemetri güncellemesini sessizce düşürürdü.
      const view = new Float32Array(message.buffer);
      for (const l of this.frameListeners) l(view);
      for (const l of this.listeners) l(message);
      return;
    }
    if (message.type === 'error') {
      this.lastError = `${message.message}${message.detail ? ` — ${message.detail}` : ''}`;
      this.setStatus(message.fatal ? 'error' : this.status, this.lastError);
    }
    if (message.type === 'ready') this.setStatus('running');
    for (const l of this.listeners) l(message);
  }

  send(command: WorkerRequest): void {
    this.worker?.postMessage(command);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // ------------------------------------------------------------ komut kısayolları
  init(options: {
    seed: number;
    preset: string;
    population: number;
    learningEnabled: boolean;
    selectionPressure: number;
  }): void {
    this.send({ type: 'init', ...options });
  }
  setRunning(running: boolean): void {
    this.send({ type: 'setRunning', running });
  }
  setSpeed(speed: SpeedMultiplier): void {
    this.send({ type: 'setSpeed', speed });
  }
  setSetting(key: 'light' | 'currentStrength' | 'selectionPressure', value: number): void {
    this.send({ type: 'setSetting', key, value });
  }
  setLearning(enabled: boolean): void {
    this.send({ type: 'setLearning', enabled });
  }
  addNutrient(kind: 'A' | 'B', amount: number): void {
    this.send({ type: 'addNutrient', kind, amount });
  }
  revivePredator(energy: number): void {
    this.send({ type: 'revivePredator', energy });
  }
  requestDecision(organismId: number): void {
    this.send({ type: 'requestDecision', organismId });
  }
  snapshot(reason: string): void {
    this.send({ type: 'snapshot', reason });
  }
  load(snapshotJson: string, label: string): void {
    this.send({ type: 'load', snapshotJson, label });
  }
  branch(name: string): void {
    this.send({ type: 'branch', name });
  }
  listOrganisms(): void {
    this.send({ type: 'listOrganisms' });
  }
  listLineages(): void {
    this.send({ type: 'listLineages' });
  }
  listEvents(count = 120): void {
    this.send({ type: 'listEvents', count });
  }
  evidencePack(question: string, kind: 'A' | 'B', organismId: number | null): void {
    this.send({ type: 'evidencePack', question, kind, organismId });
  }
  /**
   * Evrim Atölyesi: seçili organizmanın politikasını arena üzerinde (μ+λ)
   * aramayla iyileştirir. Canlı dünyayı değiştirmez; yalnız `apply` true ise
   * kazanan politika organizmanın ağırlıklarına yazılır.
   */
  evolve(organismId: number, generations: number, population: number, offspring: number, apply: boolean): void {
    this.send({ type: 'evolve', organismId, generations, population, offspring, apply });
  }

  runExperiment(experiment: string, seed: number): void {
    this.send({ type: 'runExperiment', experiment, seed });
  }
}

export type { DecisionSnapshot, EvidencePack, LineageSummary, OrganismSummary, RockSeed, SpeedMultiplier };
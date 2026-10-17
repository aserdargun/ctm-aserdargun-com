/**
 * Gözlemci sunucusu — gerçek süreç, gerçek HTTP.
 *
 * ⚠️ Bu dosya (`server/index.ts`) oturuma kadar **hiç test edilmemişti**:
 * ne `tests/` ne `e2e/` bir satırına dokunuyordu, ve o dosya ne `src/` ne
 * `scripts/` altında olduğu için içe aktarma grafiğinden türetilen rapor
 * tazelik denetimi de onu görmüyordu. İki sessiz hata buradan çıktı:
 *
 *  1. **Yanlış etiket.** `sourceMode: PROVIDER === 'local' ? 'local-summary'
 *     : 'language-model'` yazıyordu; ama `callProvider` her durumda
 *     koşuluyordu. Yani `CTM_PROVIDER=local` ile sunucu dil modelini
 *     çağırıp yanıtı **yerel özet diye etiketliyordu** — etiket istenen şeyi
 *     değil ölçüleni anlatıyordu. `CTM_PROVIDER` belgelerde hiç geçmiyor.
 *
 *  2. **Sunucu tüm arayüzlere bağlıydı.** `server.listen(PORT)` host vermezse
 *     Node `::`/`0.0.0.0`'a bağlanır; README ve başlangıç günlüğü ise
 *     `http://127.0.0.1:8787` diyordu. Aynı ağdaki herhangi biri bu dosyanın
 *     en üstünde "bypass edilemez" dediği API anahtarını kullandırabiliyordu.
 *
 * Testler **gerçek alt süreç** başlatır: `summariseEvidence` ve yönlendirme
 * içe aktarılıp birim düzeyde denetlenemez, çünkü dosya içe aktarıldığı anda
 * `listen` çağırıyor. Portlar CI ile çakışmasın diye yüksek seçildi.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { Socket } from 'node:net';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import type { Readable } from 'node:stream';
import type { ChildProcessByStdio } from 'node:child_process';

const ROOT = resolve(__dirname, '..');

/** Anahtarsız örnek (503 yolunu ölçmek için) ve sahte-anahtarlı örnek ayrı portlarda. */
const NOKEY_PORT = 18787;
const STUB_PORT = 18788;

const STUB_REPLY = 'SAHTE-SAGLAYICI-YANITI';

/** Sahte OpenAI-uyumlu sağlayıcı: modelin gerçekten çağrıldığını kanıtlar. */
function startStub(): Promise<{ server: Server; received: unknown[] }> {
  const received: unknown[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      received.push({ headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
      const payload = JSON.stringify({
        choices: [{ message: { content: STUB_REPLY } }],
      });
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      });
      res.end(payload);
    });
  });
  return new Promise((ok) => server.listen(STUB_PORT, '127.0.0.1', () => ok({ server, received })));
}

interface Observer {
  proc: ChildProcessByStdio<null, Readable, Readable>;
  port: number;
}

function startObserver(port: number, env: Record<string, string>): Promise<Observer> {
  // `stdio: ['ignore','pipe','pipe']` → stdin `null`; bu yüzden tip
  // `ChildProcessWithoutNullStreams` **değil**. İlk denemede yanlış tipten
  // zorlamayla geçirildi ve `tsc` reddetti.
  const proc = spawn('node', ['server/index.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((ok, fail) => {
    let out = '';
    const onData = (buf: Buffer): void => {
      out += buf.toString('utf8');
      if (out.includes('gözlemci sunucusu')) {
        proc.stdout.off('data', onData);
        ok({ proc, port });
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (b: Buffer) => {
      out += b.toString('utf8');
    });
    proc.on('exit', (code) => fail(new Error(`gözlemci sunucusu erken çıktı (${code}):\n${out}`)));
    setTimeout(() => fail(new Error(`gözlemci sunucusu açılmadı:\n${out}`)), 10_000);
  });
}

const post = (port: number, body: unknown): Promise<{ status: number; json: any }> =>
  fetch(`http://127.0.0.1:${port}/api/observer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, json: await r.json() }));

/** Verilen anahtara bağlanmayı dener; `ECONNREFUSED` bekleniyorsa `true`. */
function isRefused(host: string, port: number): Promise<boolean> {
  return new Promise((ok) => {
    const socket = new Socket();
    const done = (v: boolean): void => {
      socket.destroy();
      ok(v);
    };
    socket.setTimeout(3000);
    socket.once('connect', () => done(false));
    socket.once('error', (e: NodeJS.ErrnoException) => done(e.code === 'ECONNREFUSED'));
    socket.once('timeout', () => done(false));
    socket.connect(port, host);
  });
}

describe('gözlemci sunucusu · anahtarsız yol', () => {
  let obs: Observer;

  beforeAll(async () => {
    // Anahtar **kasıtlı olarak yok**: ortamda tanımlıysa da temizleniyor.
    obs = await startObserver(NOKEY_PORT, {
      CTM_API_KEY: '',
      MINIMAX_API_KEY: '',
    });
  });

  afterAll(() => {
    obs?.proc.kill('SIGKILL');
  });

  it('sağlık uç noktası yapılandırma durumunu döner, anahtarın kendisini değil', async () => {
    const r = await fetch(`http://127.0.0.1:${NOKEY_PORT}/api/observer/health`);
    expect(r.status).toBe(200);
    const json = (await r.json()) as Record<string, unknown>;
    expect(json.ok).toBe(true);
    expect(json.hasKey).toBe(false);
    // Anahtar yalnızca uzunluk olarak görünür; gövdede geçmemeli.
    expect(Object.keys(json)).toContain('hasKey');
    expect(JSON.stringify(json)).not.toMatch(/sk-|Bearer|CTM_API_KEY=/);
  });

  it('anahtar yokken 503 döner ve istemciye yerel özete düşme yolu bildirir', async () => {
    const { status, json } = await post(NOKEY_PORT, { question: 'ne oluyor?' });
    expect(status).toBe(503);
    expect(json.sourceMode).toBe('local-summary');
    expect(String(json.hint)).toContain('CTM_API_KEY');
  });

  it('GET /api/observer yönlendirilmemiş → 404', async () => {
    const r = await fetch(`http://127.0.0.1:${NOKEY_PORT}/api/observer`);
    expect(r.status).toBe(404);
  });

  it('sunucu YALNIZCA döngü arayüzüne bağlı', async () => {
    // ⚠️ Regresyon koruması. `server.listen(PORT)` (host'suz) Node'u tüm
    // arayüzlere bağlar; README ise 127.0.0.1 diyordu.
    const lan = Object.values(networkInterfaces())
      .flat()
      .filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal)
      .map((i) => i.address);
    // Ağ arayüzü yoksa bu iddia ölçülemez; atlanır (CI konteynerleri böyle
    // olabilir) — ama atlandığı da kaydedilir, "geçti" diye sunulmaz.
    for (const addr of lan) {
      expect(await isRefused(addr, NOKEY_PORT), `sunucu ${addr} üzerinden ERİŞİLEBİLİR`).toBe(true);
    }
    // Döngü ayrıca gerçekten açık olmalı — "hiç bağlanmıyor" da geçmemeli.
    const r = await fetch(`http://127.0.0.1:${NOKEY_PORT}/api/observer/health`);
    expect(r.status).toBe(200);
    if (lan.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('döngü-dışı arayüz yok: ağ bağlama iddiası bu çalıştırmada ölçülemedi');
    }
  });
});

describe('gözlemci sunucusu · etiket gerçeği söylüyor', () => {
  let stub: { server: Server; received: unknown[] };
  let obs: Observer;

  beforeAll(async () => {
    stub = await startStub();
    // `CTM_PROVIDER=local` eskiden yanıtı "yerel özet diye" etiketletti,
    // oysa sağlayıcı yine çağrılıyordu. Artık etiket ölçüleni söylemeli.
    obs = await startObserver(STUB_PORT + 1, {
      CTM_API_KEY: 'sahte-anahtar',
      CTM_BASE_URL: `http://127.0.0.1:${STUB_PORT}`,
      CTM_PROVIDER: 'local',
      CTM_MODEL: 'test-modeli',
    });
  });

  afterAll(() => {
    obs?.proc.kill('SIGKILL');
    stub?.server.close();
  });

  it('sağlayıcı çağrıldıysa sourceMode "language-model" der, "local-summary" DEĞİL', async () => {
    const { status, json } = await post(STUB_PORT + 1, {
      question: 'koloniler neden dağılıyor?',
      evidence: { tick: 1000, measurements: [{ metricRef: 'pop', value: 12, unit: 'hücre' }] },
    });
    expect(status).toBe(200);
    // Metin gerçekten sahteden geldi → model çağrıldı.
    expect(json.text).toBe(STUB_REPLY);
    // ...ve etiket buna uyuyor. `CTM_PROVIDER=local` olması bunu değiştirmez.
    expect(json.sourceMode).toBe('language-model');
    expect(json.model).toBe('test-modeli');
    expect(stub.received.length).toBe(1);
  });

  it('istemci sağlayıcı veya model adı BELİRLEYEMEZ (sunucu env\'i kazanır)', async () => {
    const { json } = await post(STUB_PORT + 1, {
      question: 'q',
      // İstemci bunları göndermeye çalışıyor; sunucu yok saymalı.
      provider: 'sahte-saglayici',
      model: 'istemci-modeli',
    });
    expect(json.provider).toBe('local');
    expect(json.model).toBe('test-modeli');
  });

  it('API anahtarı istemciye hiç dönmez', async () => {
    const { json } = await post(STUB_PORT + 1, { question: 'q' });
    expect(JSON.stringify(json)).not.toContain('sahte-anahtar');
    // Anahtar sağlayıcı isteğinde header olarak gitmeli (sunucu tarafı).
    const rec = stub.received[0] as { headers: Record<string, string> };
    expect(rec.headers.authorization).toBe('Bearer sahte-anahtar');
  });
});
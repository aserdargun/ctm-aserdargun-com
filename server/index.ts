/**
 * Cell to Mind — gözlemci sunucu rotası.
 *
 * GÜVENLİK KURALLARI (bypass edilemez):
 *  - API anahtarı YALNIZCA sunucu ortam değişkeninden okunur. İstemci paketine,
 *    `VITE_` değişkenine, kayda veya loga girmez.
 *  - İstemci, sağlayıcı URL'sini veya model adını BELİRLEYEMEZ; sağlayıcı ve
 *    model sunucu ortamından yapılandırılır. İstemciden gelen sağlayıcı alanı
 *    yok sayılır.
 *  - Anahtar yoksa 503 döner; oyun yerel kural özetine düşer ve DURMAZ.
 *
 * Çalıştırma:  node server/index.ts   (Node 22 tip soyma destekler)
 *              PORT=8787 node server/index.ts
 */

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
/** Sağlayıcı ve model SUNUCUDAN yapılandırılır; istemci değiştiremez. */
const PROVIDER = process.env.CTM_PROVIDER ?? 'minimax';
const BASE_URL = process.env.CTM_BASE_URL ?? 'https://api.minimax.chat/v1';
const MODEL = process.env.CTM_MODEL ?? 'MiniMax-M2.1';
const API_KEY = process.env.CTM_API_KEY ?? process.env.MINIMAX_API_KEY ?? '';
const TIMEOUT_MS = Number(process.env.CTM_TIMEOUT_MS ?? 20000);
const MAX_BODY_BYTES = 512 * 1024;

const SYSTEM_PROMPT = [
  'Sen bir yapay yaşam gözlemcisin. Kurallar:',
  '1. Yalnızca sana sağlanan dünya kanıtlarına dayan.',
  '2. Gözlem, çıkarım ve öneriyi ayrı ayrı yaz.',
  '3. Sayı veya olay uydurma. Ölçülmemiş bir şeyi ölçülmüş gibi yazma.',
  '4. Görüntü tek başına öğrenme, genetik değişim veya bilinç kanıtı değildir.',
  '5. Yetersiz veriyi açıkça söyle.',
  '6. Kontrol deneyi öner; kendin uygulama.',
].join(' ');

interface ObserverBody {
  question?: string;
  evidence?: unknown;
}

function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new Error('istek gövdesi çok büyük');
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Kanıt paketini modele verilecek kısa metne indirger (uydurma veri yok). */
function summariseEvidence(evidence: unknown): string {
  if (!evidence || typeof evidence !== 'object') return '(kanıt yok)';
  const e = evidence as {
    measurements?: { metricRef: string; value: number; unit: string }[];
    eventIds?: number[];
    interventions?: unknown[];
    lineage?: unknown;
    networkSummary?: unknown;
    notMeasured?: string[];
    tick?: number;
  };
  const measurements = (e.measurements ?? [])
    .map((m) => `- ${m.metricRef}: ${m.value} ${m.unit}`)
    .join('\n');
  const notMeasured = (e.notMeasured ?? []).map((n) => `- ${n}`).join('\n');
  return [
    `tick: ${e.tick ?? '?'}`,
    'ÖLÇÜMLER:',
    measurements || '- yok',
    'OLAY KİMLİKLERİ:',
    (e.eventIds ?? []).slice(-40).join(', ') || '- yok',
    'MÜDAHALELER:',
    JSON.stringify(e.interventions ?? []).slice(0, 1200),
    'SOY:',
    JSON.stringify(e.lineage ?? []).slice(0, 1600),
    'AĞ ÖZETİ:',
    JSON.stringify(e.networkSummary ?? {}).slice(0, 1600),
    'ÖLÇÜLMEYENLER:',
    notMeasured || '- yok',
  ].join('\n');
}

async function callProvider(question: string, evidenceText: string): Promise<string> {
  // OpenAI uyumlu sohbet tamamlama şeması. MiniMax bu yolu destekler.
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Soru: ${question}\n\nDünya kanıtları:\n${evidenceText}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 900,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Anahtar SADECE burada, sunucu tarafında kullanılır.
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`sağlayıcı ${response.status}: ${detail.slice(0, 300)}`);
    }
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error('sağlayıcı boş yanıt döndürdü');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const server = createServer((req, res) => {
  void (async () => {
    if (req.method === 'GET' && req.url === '/api/observer/health') {
      // Anahtarın kendisi ASLA dönülmez; yalnızca yapılandırma durumu.
      sendJson(res, 200, {
        ok: true,
        provider: PROVIDER,
        model: MODEL,
        hasKey: API_KEY.length > 0,
        timeoutMs: TIMEOUT_MS,
      });
      return;
    }

    if (req.method !== 'POST' || !req.url?.startsWith('/api/observer')) {
      sendJson(res, 404, { error: 'bulunamadı' });
      return;
    }

    if (!API_KEY) {
      // Anahtar yok: 503. İstemci yerel kural özetine düşer, oyun DURMAZ.
      sendJson(res, 503, {
        error: 'api anahtarı yok',
        hint: 'CTM_API_KEY (veya MINIMAX_API_KEY) sunucu ortamında tanımlayın',
        sourceMode: 'local-summary',
      });
      return;
    }

    let parsed: ObserverBody;
    try {
      const raw = await readBody(req);
      parsed = JSON.parse(raw) as ObserverBody;
    } catch (err) {
      sendJson(res, 400, { error: `geçersiz istek: ${(err as Error).message}` });
      return;
    }

    const question = String(parsed.question ?? '').slice(0, 500) || 'Bu dünyada ne oluyor?';
    const evidenceText = summariseEvidence(parsed.evidence);

    try {
      const text = await callProvider(question, evidenceText);
      sendJson(res, 200, {
        text,
        sourceMode: PROVIDER === 'local' ? 'local-summary' : 'language-model',
        provider: PROVIDER,
        model: MODEL,
        // Kanıt paketi eklenir; istemci sayıları bununla doğrular.
        evidenceUsed: true,
      });
    } catch (err) {
      // Hata halinde oyun SÜRER: 200 yerine 502 dönüp yerel özete düşülür.
      sendJson(res, 502, {
        error: (err as Error).message,
        sourceMode: 'local-summary',
      });
    }
  })();
});

server.listen(PORT, () => {
  console.log(`Cell to Mind gözlemci sunucusu: http://127.0.0.1:${PORT}`);
  console.log(`  sağlayıcı: ${PROVIDER} · model: ${MODEL}`);
  console.log(`  api anahtarı: ${API_KEY ? 'sunucu ortamında VAR' : 'YOK (yerel kural özeti kullanılır)'}`);
});
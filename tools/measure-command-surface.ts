/**
 * Ölçüm: arayüzün gönderdiği her komut worker'da karşılanıyor mu?
 *
 * Worker → arayüz yönünün denetimi zaten var ("worker in ürettiği her mesajın bir
 * TÜKETİCİSİ var"). **Arayüz → worker** yönü denetlenmiyordu: UI bir komut
 * gönderir, worker'da `case` karşılığı yoksa komut **sessizce** düşer ve
 * kullanıcı hiçbir geri bildirim almaz — düğme "çalıştı" gibi görünür.
 *
 * Bu bir ölçüm aracıdır; yalnızca sayı üretir.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const client = readFileSync(resolve(ROOT, 'src/engine/client.ts'), 'utf8');
const worker = readFileSync(resolve(ROOT, 'src/worker/sim.worker.ts'), 'utf8');
const protocol = readFileSync(resolve(ROOT, 'src/worker/protocol.ts'), 'utf8');

const sent = [...new Set([...client.matchAll(/type:\s*'([a-zA-Z]+)'/g)].map((m) => m[1] as string))].sort();
const handled = new Set([...worker.matchAll(/case\s*'([a-zA-Z]+)':/g)].map((m) => m[1] as string));
const declared = new Set([...protocol.matchAll(/type:\s*'([a-zA-Z]+)'/g)].map((m) => m[1] as string));

console.log(`istemci gönderiyor (${sent.length}): ${sent.join(', ')}`);
console.log(`worker karşılıyor (${handled.size})`);

const orphan = sent.filter((t) => !handled.has(t));
console.log(orphan.length ? `\n✗ KARŞILIĞI OLMAYAN KOMUT: ${orphan.join(', ')}` : '\n✓ her komut worker\'da karşılanıyor');

const undeclared = sent.filter((t) => !declared.has(t));
console.log(
  undeclared.length
    ? `\n✗ PROTOKOLDE BEYAN EDİLMEMİŞ: ${undeclared.join(', ')}`
    : '\n✓ her komut protokolde beyan edilmiş',
);

// Ters yön: worker'da karşılanan ama istemcinin hiç göndermediği komutlar.
const neverSent = [...handled].filter((t) => !sent.includes(t)).sort();
console.log(
  neverSent.length
    ? `\n· worker karşılıyor ama istemci göndermiyor: ${neverSent.join(', ')}`
    : '\n· worker\'ın beklediği ama istemcinin göndermediği komut yok',
);

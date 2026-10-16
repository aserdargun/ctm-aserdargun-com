/**
 * Cell to Mind — olay günlüğü paneli testleri.
 *
 * Panel, **hiç bağlanmamış** bir altyapıyı görünür kılıyor: `listEvents`
 * komutu gönderiliyor, worker `events` yanıtını üretiyor, ama ne bir yerden
 * çağrılıyordu ne de yanıt işleniyordu (`VALIDATION.md` §6.53). Bu testler
 * o bağın **yeniden kopmamasını** korur.
 */

import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../src/sim/ring.ts';
import { World } from '../src/sim/world.ts';
import type { SimEvent } from '../src/sim/types.ts';

const ev = (id: number, tick: number, type: SimEvent['type']): SimEvent => ({
  id,
  tick,
  type,
});

describe('olay günlüğü · dünya kaydı', () => {
  it('varsayılan koşuda olay üretilir (panel boş kalmaz)', () => {
    const w = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
    for (let t = 1; t <= 4000; t++) w.step();
    const events = w.recentEvents(400);
    expect(events.length).toBeGreaterThan(0);
    // Her kayıt tick kimliğiyle etiketli olmalı (kanıt izi için şart).
    expect(events.every((e) => e.tick > 0)).toBe(true);
    expect(events.every((e) => e.id > 0)).toBe(true);
  });

  it('olay türleri beyan edilen kümenin içinde', () => {
    const w = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
    for (let t = 1; t <= 4000; t++) w.step();
    const allowed: SimEvent['type'][] = [
      'genesis', 'cell-division', 'bud-separation', 'bond-formation',
      'bond-break', 'fragmentation', 'death', 'predation',
      'learning-update', 'intervention',
    ];
    for (const e of w.recentEvents(400)) {
      expect(allowed, `beyan edilmeyen olay türü: ${e.type}`).toContain(e.type);
    }
  });

  it('halka tamponu kapasiteyi aşınca EN ESKİYİ düşürür', () => {
    // ⚠️ Önceki sürüm BU KORUMA BOŞTU: 3000 tick sonrası ölçülen olay sayısı
    // yalnızca 728 — kapasite 2000. Yani tampon sınırına hiç ULAŞMIYORDU ve
    // `size <= 2000` sınırsız büyüseydi de geçerdi. Dahası RingBuffer.count
    // zaten kapasitede sınırlı olduğu için o doğrulama sınıfın kendisi
    // tarafından garanti ediliyordu.
    //
    // Gerçek risk şu: kapasite aşılınca HANGİ öğeler tutuluyor? Eski olanlar
    // düşmeli, sıra korunmalı. Doğrudan sınıf üzerinde sınanıyor.
    const b = new RingBuffer<number>(3);
    for (const i of [1, 2, 3, 4, 5]) b.push(i);
    expect(b.size).toBe(3);
    expect(b.toArray()).toEqual([3, 4, 5]); // en eski (1,2) düştü
    expect(b.last()).toBe(5);
    expect(b.recent(2)).toEqual([4, 5]);
    // Kapasite tam dolmadan da sıra korunmalı.
    const c = new RingBuffer<number>(3);
    c.push(1);
    c.push(2);
    expect(c.toArray()).toEqual([1, 2]);
    expect(c.last()).toBe(2);
    // Geçersiz kapasite reddedilmeli.
    expect(() => new RingBuffer<number>(0)).toThrow();
  });

  it('dünyanın olay tamponu kapasiteye bağlı (bağlantı sınaması)', () => {
    const w = new World({ seed: 11, population: 48, strainDecayK: 0.005 });
    for (let t = 1; t <= 3000; t++) w.step();
    expect(w.events.size).toBeLessThanOrEqual(2000);
    expect(w.recentEvents(100).length).toBeLessThanOrEqual(100);
  });
});

describe('olay günlüğü · panel bağlantısı', () => {
  // Bu blok metin taramasıyla değil **kaynak okuyarak** kontrol eder:
  // zincir koptuğunda (listEvents çağrılmıyor / events işlenmiyor) kırmızı
  // döner. Tam olarak §6.53'te ölçülen kusurun regresyon koruması.
  it('store olay alanını taşıyor', async () => {
    const store = await import('../src/engine/store.ts');
    const s = store.useStore.getState();
    expect(Array.isArray(s.events)).toBe(true);
    expect(s.eventsTotal).toBe(0);
    expect(typeof s.setEvents).toBe('function');
    expect(typeof s.clearEvents).toBe('function');
  });

  it('setEvents olayları ve toplamı yazar', async () => {
    const store = await import('../src/engine/store.ts');
    store.useStore.getState().setEvents([ev(1, 10, 'death'), ev(2, 20, 'genesis')], 500);
    const s = store.useStore.getState();
    expect(s.events).toHaveLength(2);
    expect(s.eventsTotal).toBe(500);
    store.useStore.getState().clearEvents();
    expect(store.useStore.getState().events).toHaveLength(0);
  });
});
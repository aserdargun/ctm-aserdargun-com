/**
 * Cell to Mind — Olay Günlüğü paneli.
 *
 * Simülasyonun kaydı: 12.000 tick'te 7.088 öğrenme güncellemesi, 603 ölüm,
 * 302 tomurcuk ayrılması… **Bu veri zaten üretiliyordu ama hiçbir yere
 * bağlı değildi**: `SimClient.listEvents()` komutu gönderiyor, worker `events`
 * yanıtını üretiyor, ama ne bir yerden çağrılıyordu ne de yanıt işleniyordu
 * (`VALIDATION.md` §6.53).
 *
 * Panel yalnız **ölçüm gösterir**: olayları listeler, türe göre sayar ve
 * filtirlemeye izin verir. Hiçbir olayı değiştirmez.
 */

import React from 'react';
import { useStore } from '../engine/store.ts';
import type { SimClient } from '../engine/client.ts';
import type { SimEvent, SimEventType } from '../sim/types.ts';

const POLL_MS = 1200;
const PAGE = 400;

const TYPE_LABEL: Record<SimEventType, string> = {
  genesis: 'kuruluş',
  'cell-division': 'hücre bölünmesi',
  'bud-separation': 'tomurcuk ayrılması',
  'bond-formation': 'bağ kuruldu',
  'bond-break': 'bağ koptu',
  fragmentation: 'parçalanma',
  death: 'ölüm',
  predation: 'avlanma',
  'learning-update': 'öğrenme güncellemesi',
  intervention: 'oyuncu müdahalesi',
};

/** Tıklama sayısını azaltmak için en sık görülen türler üstte. */
function countByType(events: readonly SimEvent[]): [SimEventType, number][] {
  const counts = new Map<SimEventType, number>();
  for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function EventsPanel({ client }: { client: SimClient }): React.ReactElement {
  const language = useStore((s) => s.language);
  const events = useStore((s) => s.events);
  const totalKnown = useStore((s) => s.eventsTotal);
  const clearEvents = useStore((s) => s.clearEvents);
  const notify = useStore((s) => s.notify);
  const tr = language === 'tr';

  const [filter, setFilter] = React.useState<SimEventType | 'all'>('all');

  React.useEffect(() => {
    client.listEvents(PAGE);
    const handle = setInterval(() => client.listEvents(PAGE), POLL_MS);
    return () => clearInterval(handle);
  }, [client]);

  const counts = countByType(events);
  const shown = filter === 'all' ? events : events.filter((e) => e.type === filter);

  return (
    <section className="panel" aria-label={tr ? 'Olay günlüğü' : 'Event log'}>
      <header className="panel__head">
        <h2>{tr ? 'Olay Günlüğü' : 'Event Log'}</h2>
      </header>

      <p className="panel__hint">
        {tr
          ? 'Simülasyonun kaydı. Bu veri zaten üretiliyordu; panel onu görünür kılıyor.'
          : 'The simulation record. This data was already produced; the panel makes it visible.'}
      </p>

      <div className="panel__row" style={{ marginTop: 10 }}>
        <span>{shown.length} / {totalKnown}</span>
        <button
          type="button"
          onClick={() => {
            // Depo **ve** worker temizleniyor. Yalnız depo sıfırlamak
            // yetmezdi: 1.200 ms'lik yoklama worker'ın günlüğünü geri
            // getiriyor ve düğme yalan söylüyordu.
            clearEvents();
            client.clearEvents();
            notify('info', tr ? 'Olay listesi temizlendi' : 'Event list cleared');
          }}
        >
          {tr ? 'Temizle' : 'Clear'}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="panel__hint" style={{ marginTop: 10 }}>
          {tr ? 'Henüz olay yok…' : 'No events yet…'}
        </p>
      ) : (
        <>
          <div className="events__filters" role="group" aria-label={tr ? 'Türe göre filtrele' : 'Filter by type'}>
            <button
              type="button"
              className={filter === 'all' ? 'is-active' : ''}
              onClick={() => setFilter('all')}
            >
              {tr ? 'hepsi' : 'all'} ({events.length})
            </button>
            {counts.map(([type, n]) => (
              <button
                key={type}
                type="button"
                className={filter === type ? 'is-active' : ''}
                onClick={() => setFilter(type)}
              >
                {TYPE_LABEL[type] ?? type} ({n})
              </button>
            ))}
          </div>

          <ol className="events__list">
            {shown
              .slice(-120)
              .reverse()
              .map((e) => (
                <li key={e.id} className="events__item">
                  <span className="events__tick">{e.tick}</span>
                  <span className="events__type">{TYPE_LABEL[e.type] ?? e.type}</span>
                  <span className="events__detail">
                    {e.detail
                      ? Object.entries(e.detail)
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')
                      : ''}
                  </span>
                </li>
              ))}
          </ol>

          {shown.length > 120 && (
            <p className="panel__hint">
              {tr ? `Son 120 olay gösteriliyor (${shown.length} kayıtlı).` : `Showing last 120 of ${shown.length}.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
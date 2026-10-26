import { useMemo, useState } from 'react';
import { KINDS, STATUSES } from '../../lib/constants';

const TABS = [
  { id: 'all', label: 'Everything' },
  { id: 'missions', label: 'Launches' },
  { id: 'stations', label: 'Stations' },
  { id: 'rockets', label: 'Rockets' },
  { id: 'moons', label: 'Moons' },
];

const KIND_ICON = {
  mission: '🚀',
  station: '🛰️',
  rocket: '🏗️',
  moon: '🌙',
};

function badgeFor(row) {
  if (row.kind === 'mission') return KINDS[row.visualKind] || null;
  return null;
}

function statusLabel(row) {
  if (!row.statusGroup) return null;
  return (STATUSES[row.statusGroup] || {}).label || row.statusGroup;
}

/**
 * "Year in review" — what happened in the year the timeline is parked on.
 *
 * Every row is a jump link: clicking it flies to the object and opens its record. When the
 * timeline is at "All time" the panel becomes a set of shortcuts into the busiest years.
 */
export function YearPanel({ open, year, timeline, events, onClose, onJump, onSelectYear }) {
  const [tab, setTab] = useState('all');

  const rows = useMemo(() => {
    if (!events) return [];
    const all = [
      ...events.missions.map((row) => ({ ...row, group: 'missions' })),
      ...events.stations.map((row) => ({ ...row, group: 'stations' })),
      ...events.rockets.map((row) => ({ ...row, group: 'rockets' })),
      ...events.moons.map((row) => ({ ...row, group: 'moons' })),
    ];
    if (tab === 'all') return all;
    return all.filter((row) => row.group === tab);
  }, [events, tab]);

  const counts = useMemo(
    () => ({
      missions: events ? events.missions.length : 0,
      stations: events ? events.stations.length : 0,
      rockets: events ? events.rockets.length : 0,
      moons: events ? events.moons.length : 0,
    }),
    [events]
  );

  return (
    <aside className={`year-panel${open ? ' year-panel--open' : ''}`} aria-hidden={!open} aria-label="Year in review">
      <header className="year-panel__head">
        <div>
          <span className="eyebrow">{year ? 'Year in review' : 'Timeline'}</span>
          <h2 className="year-panel__title">{year || 'All time'}</h2>
        </div>
        <div className="year-panel__head-actions">
          <span className="year-panel__total">
            {year ? `${events ? events.total : 0} events` : `${timeline ? timeline.years.length : 0} active years`}
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close year review">
            ✕
          </button>
        </div>
      </header>

      {year ? (
        <>
          <div className="year-panel__tabs" role="tablist" aria-label="Event types">
            {TABS.map((item) => {
              const count = counts[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={`chip${tab === item.id ? ' chip--on' : ''}`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                  <small>{item.id === 'all' ? events.total : count}</small>
                </button>
              );
            })}
          </div>

          <div className="year-panel__list">
            {rows.length ? (
              rows.map((row) => {
                const kind = badgeFor(row);
                return (
                  <button
                    key={`${row.kind}-${row.id}`}
                    type="button"
                    className={`year-event year-event--${row.group}`}
                    onClick={() => onJump(row)}
                    title={`Open ${row.name}`}
                  >
                    <span className="year-event__icon" aria-hidden="true">
                      {KIND_ICON[row.kind] || '•'}
                    </span>
                    <span className="year-event__body">
                      <strong>{row.name}</strong>
                      <small>
                        {row.subtitle || (kind ? kind.label : '')}
                        {row.discoverer ? ` · ${row.discoverer}` : ''}
                      </small>
                    </span>
                    <span className="year-event__meta">
                      {statusLabel(row) ? <span className={`tag tag--${row.statusGroup}`}>{statusLabel(row)}</span> : null}
                      {row.nasa ? <span className="tag tag--nasa">NASA</span> : null}
                      <span className="year-event__arrow" aria-hidden="true">→</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="small muted year-panel__empty">
                {events && events.total
                  ? 'Nothing of this type in this year — try “Everything”.'
                  : 'No dated record in the catalogue for this year. Drag the timeline to a launch year.'}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="year-panel__list">
          <p className="small muted year-panel__intro">
            Drag the slider in the header to any year, or start from one of the busiest years in the catalogue.
          </p>
          <div className="year-panel__years">
            {(timeline ? timeline.busiest : []).map((row) => (
              <button
                key={row.year}
                type="button"
                className="year-pill"
                onClick={() => {
                  onSelectYear(row.year);
                  setTab('all');
                }}
              >
                <strong>{row.year}</strong>
                <small>{row.total} events</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

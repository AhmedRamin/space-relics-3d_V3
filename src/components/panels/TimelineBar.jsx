import { useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber } from '../../lib/scale';

/**
 * The year axis in the header.
 *
 * Drag the slider to any year and the whole explorer re-reads the catalogue as it stood
 * then: objects that had not launched yet disappear from the rail and the scene, and the
 * "Year in review" panel lists what actually happened in that year.
 *
 * `null` means all time. The slider always has a position (the latest year), so moving it
 * is the only gesture needed to enter a specific year.
 */
export function TimelineBar({ timeline, year, onChange, panelOpen, onTogglePanel, eventCount }) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  const min = timeline ? timeline.minYear : new Date().getFullYear() - 60;
  const max = timeline ? timeline.maxYear : new Date().getFullYear();
  const value = year === null || year === undefined ? max : year;
  const active = year !== null && year !== undefined;
  const totalEvents = useMemo(
    () => (timeline ? timeline.years.reduce((sum, row) => sum + row.total, 0) : 0),
    [timeline]
  );

  useEffect(() => {
    if (!playing) {
      if (timer.current) clearInterval(timer.current);
      return undefined;
    }
    timer.current = setInterval(() => {
      onChange((current) => {
        const base = current === null ? min : current;
        if (base >= max) return max;
        return base + 1;
      });
    }, 700);
    return () => clearInterval(timer.current);
  }, [playing, min, max, onChange]);

  useEffect(() => {
    if (playing && active && year >= max) setPlaying(false);
  }, [playing, active, year, max]);

  const marks = useMemo(() => {
    if (!timeline) return [];
    const span = Math.max(1, max - min);
    const busiest = Math.max(1, ...timeline.counts.map((row) => row.total));
    return timeline.counts.map((row) => ({
      ...row,
      left: ((row.year - min) / span) * 100,
      weight: row.total / busiest,
    }));
  }, [timeline, min, max]);

  const step = (delta) => {
    setPlaying(false);
    onChange((current) => {
      const base = current === null ? max : current;
      return Math.min(max, Math.max(min, base + delta));
    });
  };

  return (
    <div className={`timeline${active ? ' timeline--active' : ''}`} aria-label="Year timeline">
      <div className="timeline__lead">
        <button
          type="button"
          className={`timeline__play${playing ? ' timeline__play--on' : ''}`}
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? 'Pause the timeline' : 'Play the timeline'}
          title={playing ? 'Pause' : 'Play through the years'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          className="timeline__nudge"
          onClick={() => step(-1)}
          aria-label="Previous year"
          disabled={value <= min}
        >
          ‹
        </button>
        <div className="timeline__readout">
          <span className="timeline__year">{active ? year : 'All time'}</span>
          <span className="timeline__sub">
            {active
              ? `${formatNumber(eventCount || 0)} ${eventCount === 1 ? 'event' : 'events'}`
              : `${formatNumber(totalEvents)} dated events`}
          </span>
        </div>
        <button
          type="button"
          className="timeline__nudge"
          onClick={() => step(1)}
          aria-label="Next year"
          disabled={value >= max}
        >
          ›
        </button>
      </div>

      <div className="timeline__track">
        <div className="timeline__marks" aria-hidden="true">
          {marks.map((mark) => (
            <span
              key={mark.year}
              className="timeline__mark"
              style={{
                left: `${mark.left}%`,
                height: `${3 + mark.weight * 11}px`,
                opacity: 0.28 + mark.weight * 0.62,
              }}
              title={`${mark.year} · ${mark.total} events`}
            />
          ))}
        </div>
        <input
          className="timeline__range"
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label="Year"
          aria-valuetext={active ? `Year ${year}` : 'Showing all years'}
          onChange={(event) => {
            setPlaying(false);
            onChange(Number(event.target.value));
          }}
        />
        <div className="timeline__scale" aria-hidden="true">
          <span>{min}</span>
          <span>{Math.round((min + max) / 2)}</span>
          <span>{max}</span>
        </div>
      </div>

      <div className="timeline__actions">
        <button
          type="button"
          className={`chip${!active ? ' chip--on' : ''}`}
          onClick={() => {
            setPlaying(false);
            onChange(null);
          }}
          title="Stop filtering by year"
        >
          All time
        </button>
        <button
          type="button"
          className={`chip chip--accent${panelOpen ? ' chip--on' : ''}`}
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
        >
          <span aria-hidden="true">🗓</span>
          <span className="timeline__panel-label">{active ? `${year} in review` : 'Year in review'}</span>
        </button>
      </div>
    </div>
  );
}

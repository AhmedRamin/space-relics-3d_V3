import { KINDS } from '../../lib/constants';
import { IconTypePanel } from './IconTypePanel';

/**
 * Explorer rail: bodies (system view) or the hardware at the current body, plus the
 * hardware-type filters.
 *
 * On desktop it is a docked column that stays open until the user collapses it — the
 * choice is remembered. Below 1080px it becomes a slide-over drawer; on phones it closes
 * after a selection so the scene is not covered.
 */
export function Sidebar({
  view,
  bodies,
  current,
  hardware,
  selectedId,
  onFocusBody,
  onSelect,
  kindFilter,
  setKindFilter,
  workingOnly,
  setWorkingOnly,
  showDwarfs,
  setShowDwarfs,
  facets,
  onClose,
  isPhone,
  docked,
  year,
  totalHardware,
  onCollapse,
}) {
  const visible = hardware.filter((item) => {
    if (kindFilter && item.visualKind !== kindFilter) return false;
    if (workingOnly && !item.workingNow) return false;
    return true;
  });

  const hiddenByYear = Math.max(0, (totalHardware || 0) - hardware.length);

  return (
    <aside className={`sidebar${docked ? ' sidebar--docked' : ''}`} aria-label="Explorer panels">
      <div className="sidebar__head">
        <div className="sidebar__head-text">
          <span className="eyebrow">Explorer</span>
          {year ? <span className="sidebar__era">as of {year}</span> : null}
        </div>
        <div className="sidebar__head-actions">
          {docked ? (
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={onCollapse}
              aria-label="Collapse the explorer panel"
              title="Collapse panel (M)"
            >
              ‹
            </button>
          ) : (
            <button type="button" className="btn btn--sm btn--ghost" onClick={onClose} aria-label="Close panels">
              ✕
            </button>
          )}
        </div>
      </div>

      <section className="sidebar__section">
        <div className="sidebar__title">
          <span className="eyebrow">{view.mode === 'body' ? `Hardware at ${current ? current.name : 'this body'}` : 'Bodies'}</span>
          <span className="row" style={{ gap: 6 }}>
            <span className="small muted">
              {view.mode === 'body' ? visible.length : bodies.length}
            </span>
          </span>
        </div>

        <div className="sidebar__scroll">
          {view.mode === 'body'
            ? visible.map((item) => {
                const kind = KINDS[item.visualKind] || KINDS.probe;
                const place = item.location ? '◎' : item.orbit ? '◉' : '≈';
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`row-item${selectedId === item.id ? ' row-item--on' : ''}`}
                    style={{ '--row': kind.color }}
                    onClick={() => onSelect(item)}
                    title={item.location ? item.location.label : item.orbit ? item.orbit.label : 'Position not published'}
                  >
                    <span className="row-item__icon" aria-hidden="true">{kind.icon}</span>
                    <span className="row-item__text">
                      <strong>{item.name}</strong>
                      <span className="small muted">
                        {item.launchYear ? `${item.launchYear} · ` : ''}
                        {item.type || kind.label}
                      </span>
                    </span>
                    <span className={`row-item__dot${item.workingNow ? ' row-item__dot--live' : ''}`} aria-hidden="true" />
                    <span className="row-item__place small muted" aria-hidden="true">{place}</span>
                  </button>
                );
              })
            : bodies.map((body) => {
                const total = year ? body.eraTotal ?? body.total ?? 0 : body.total || 0;
                return (
                  <button
                    key={body.id}
                    type="button"
                    className="row-item"
                    onClick={() => onFocusBody(body)}
                    title={`${body.type}${year ? ` · ${total} objects in ${year}` : ''}`}
                  >
                    <span className="row-item__icon" aria-hidden="true">
                      {body.isDwarf ? '🪨' : body.id === 'sun' ? '☀️' : '🪐'}
                    </span>
                    <span className="row-item__text">
                      <strong>{body.name}</strong>
                      <span className="small muted">{body.type}</span>
                    </span>
                    <span className={`row-item__badge${year && total < (body.total || 0) ? ' row-item__badge--era' : ''}`}>
                      {total}
                    </span>
                  </button>
                );
              })}

          {view.mode === 'body' && !visible.length ? (
            <p className="small muted sidebar__empty">
              {year
                ? `Nothing had launched to ${current ? current.name : 'this body'} by ${year}. Move the timeline forward.`
                : 'No hardware matches the current filters.'}
            </p>
          ) : null}
        </div>

        {view.mode === 'body' && year && hiddenByYear > 0 ? (
          <p className="sidebar__note small">
            <span aria-hidden="true">◷</span> {hiddenByYear} object{hiddenByYear === 1 ? '' : 's'} not launched yet in {year}
          </p>
        ) : null}
      </section>

      <IconTypePanel
        kinds={(facets && facets.kinds) || []}
        kindFilter={kindFilter}
        setKindFilter={setKindFilter}
        workingOnly={workingOnly}
        setWorkingOnly={setWorkingOnly}
        showDwarfs={showDwarfs}
        setShowDwarfs={setShowDwarfs}
        counts={facets && facets.counts}
      />

      <div className="sidebar__foot small muted">
        {year ? (
          <>
            Era filter: <strong>{year}</strong> · objects launched after this year are hidden
          </>
        ) : current ? (
          <>Viewing <strong style={{ color: 'var(--text-secondary)' }}>{current.name}</strong> · press Esc for the Solar System</>
        ) : (
          <>Pick a body to see the hardware sent there</>
        )}
      </div>
    </aside>
  );
}

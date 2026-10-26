import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SceneHost } from './components/three/SceneHost';
import { SolarSystemScene } from './components/scene/SolarSystemScene';
import { BodyScene } from './components/scene/BodyScene';
import { TopBar } from './components/panels/TopBar';
import { Sidebar } from './components/panels/Sidebar';
import { InfoPanel } from './components/panels/InfoPanel';
import { WelcomeOverlay } from './components/panels/WelcomeOverlay';
import { PhoneBar } from './components/panels/PhoneBar';
import { YearPanel } from './components/panels/YearPanel';
import { ChatDock } from './components/chat/ChatDock';
import { Tour, hasSeenTour } from './components/tour/Tour';
import { ExplorerProvider, useExplorer } from './state/ExplorerContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAsync } from './hooks/useAsync';
import { useBreakpoints } from './hooks/useMediaQuery';
import { api } from './services/api';

const RAIL_KEY = 'space-relics:rail';

const readRailPreference = () => {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(max-width: 1080px)').matches) return false;
  try {
    return window.localStorage.getItem(RAIL_KEY) !== 'closed';
  } catch {
    return true;
  }
};

/** The explorer: one canvas, two 3D layers, a docked rail, the year axis and the guide. */
export function Explorer() {
  const {
    view,
    selected,
    kindFilter,
    workingOnly,
    showDwarfs,
    chatOpen,
    chatSeed,
    year,
    yearPanelOpen,
    focusBody,
    backToSystem,
    selectObject,
    setKindFilter,
    setWorkingOnly,
    setShowDwarfs,
    setChatOpen,
    setYear,
    setYearPanelOpen,
    askAbout,
    clearSeed,
  } = useExplorer();

  const { isPhone, isTablet } = useBreakpoints();
  const [railOpen, setRailOpen] = useState(readRailPreference);
  const [tourOpen, setTourOpen] = useState(false);
  const autoTourStarted = useRef(false);
  // First visit: skip the welcome card and go straight into the guided tour.
  const [welcomeAllowed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return hasSeenTour();
  });
  const previousYear = useRef(year);

  const catalog = useAsync(() => api.catalog(), []);
  const bodyData = useAsync(
    () => (view.mode === 'body' ? api.body(view.bodyId) : Promise.resolve(null)),
    [view.mode, view.bodyId]
  );

  const bodies = (catalog.data && catalog.data.data.bodies) || [];
  const counts = catalog.data && catalog.data.data.counts;
  const facets = catalog.data && catalog.data.data.facets;
  const timeline = catalog.data && catalog.data.data.timeline;

  const bodyNames = useMemo(
    () => bodies.reduce((acc, body) => ({ ...acc, [body.id]: body.name }), {}),
    [bodies]
  );

  const bodyImages = useMemo(
    () => bodies.reduce((acc, body) => (body.imageUrl ? { ...acc, [body.id]: body.imageUrl } : acc), {}),
    [bodies]
  );

  const current = view.mode === 'body' ? bodyData.data && bodyData.data.data.body : null;
  const hardware = (bodyData.data && bodyData.data.data.hardware) || [];
  const moons = (bodyData.data && bodyData.data.data.moons) || [];

  /**
   * The era filter: an object is visible when its launch year is at or before the selected
   * year. Records without a launch year are never hidden.
   */
  const eraHardware = useMemo(() => {
    if (!year) return hardware;
    return hardware.filter((item) => !item.launchYear || item.launchYear <= year);
  }, [hardware, year]);

  /**
   * Bodies carry an era count so the Solar System view shrinks its hardware clusters as you
   * slide back in time instead of always showing today's fleet.
   */
  const eraBodies = useMemo(() => {
    if (!year || !timeline) return bodies;
    return bodies.map((body) => {
      const records = timeline.byBody.get(body.id) || [];
      const inEra = records.filter((row) => row.year <= year);
      const eraCounts = inEra.reduce((acc, row) => {
        acc[row.kind] = (acc[row.kind] || 0) + 1;
        return acc;
      }, {});
      return { ...body, eraTotal: inEra.length, counts: eraCounts };
    });
  }, [bodies, year, timeline]);

  const yearEvents = useMemo(() => {
    if (!year || !timeline) return null;
    return timeline.byYear.get(year) || { year, total: 0, missions: [], stations: [], rockets: [], moons: [] };
  }, [year, timeline]);

  // The rail docks above 1080px, so a resize back to desktop restores the saved preference.
  useEffect(() => {
    setRailOpen(readRailPreference());
  }, [isTablet]);

  const toggleRail = useCallback(() => {
    setRailOpen((open) => {
      const next = !open;
      if (!isTablet) {
        try {
          window.localStorage.setItem(RAIL_KEY, next ? 'open' : 'closed');
        } catch {
          // storage can be blocked; the toggle still works for this session
        }
      }
      return next;
    });
  }, [isTablet]);

  /** Entering a year (from "All time") reveals the review panel once. */
  const changeYear = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(previousYear.current) : next;
      if (previousYear.current === null && resolved !== null) setYearPanelOpen(true);
      previousYear.current = resolved === undefined ? null : resolved;
      setYear(resolved);
    },
    [setYear, setYearPanelOpen]
  );

  useEffect(() => {
    previousYear.current = year;
  }, [year]);

  useEffect(() => {
    function onKey(event) {
      const typing = event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
      if (event.key === 'Escape') {
        if (yearPanelOpen) setYearPanelOpen(false);
        else if (chatOpen) setChatOpen(false);
        else if (isTablet && railOpen) setRailOpen(false);
        else if (view.mode === 'body') backToSystem();
        return;
      }
      if (typing) return;
      if (event.key.toLowerCase() === 'f') setWorkingOnly(!workingOnly);
      if (event.key.toLowerCase() === 'd') setShowDwarfs(!showDwarfs);
      if (event.key.toLowerCase() === 'm') toggleRail();
      if (yearPanelOpen && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        changeYear((current) => {
          const min = timeline ? timeline.minYear : 1957;
          const max = timeline ? timeline.maxYear : new Date().getFullYear();
          const base = current === null ? max : current;
          return Math.min(max, Math.max(min, base + (event.key === 'ArrowRight' ? 1 : -1)));
        });
      }
      if (event.key.toLowerCase() === 'y') setYearPanelOpen((open) => !open);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    view.mode, chatOpen, workingOnly, showDwarfs, isTablet, railOpen, yearPanelOpen,
    backToSystem, setChatOpen, setWorkingOnly, setShowDwarfs, setYearPanelOpen, toggleRail, changeYear, timeline,
  ]);

  const openBody = useCallback(
    (body) => {
      focusBody(body);
      // On a phone the details sheet would cover the whole world — open the body clean and
      // let a tap on the surface reveal its record.
      if (isPhone) selectObject(null);
      if (isTablet) setRailOpen(false);
    },
    [focusBody, isTablet, isPhone, selectObject]
  );

  const selectHardware = useCallback(
    (item) => {
      selectObject({ kind: item.kind || 'mission', id: item.id, name: item.name, data: item });
      if (isPhone) setRailOpen(false);
    },
    [selectObject, isPhone]
  );

  const welcomeChoose = useCallback(
    (choice) => {
      if (choice === 'guide') setChatOpen(true);
      else if (choice === 'hardware') {
        const mars = bodies.find((b) => b.id === 'mars');
        if (mars) openBody(mars);
      }
    },
    [bodies, openBody, setChatOpen]
  );

  const chatContext = useMemo(
    () => (selected ? { kind: selected.kind, id: selected.id, name: selected.name } : null),
    [selected]
  );

  /** Jump from a search hit, a year event or a chat reference straight to the object. */
  const jumpTo = useCallback(
    async (ref) => {
      if (ref.kind === 'body') {
        const body = bodies.find((b) => b.id === ref.id);
        if (body) openBody(body);
        return;
      }
      try {
        if (ref.kind === 'mission') {
          const res = await api.mission(ref.id);
          const mission = res.data.mission;
          const body = bodies.find((b) => b.id === mission.bodyId) || bodies.find((b) => b.id === ref.bodyId);
          if (body && view.bodyId !== body.id) openBody(body);
          selectObject({ kind: 'mission', id: mission.id, name: mission.name, data: mission });
        } else if (ref.kind === 'station') {
          const res = await api.stations();
          const station = (res.data || []).find((s) => s.id === ref.id);
          const earth = bodies.find((b) => b.id === 'earth');
          if (earth && view.bodyId !== 'earth') openBody(earth);
          if (station) selectObject({ kind: 'station', id: station.id, name: station.name, data: station });
        } else if (ref.kind === 'rocket') {
          const res = await api.rockets();
          const rocket = (res.data || []).find((r) => r.id === ref.id);
          if (rocket) selectObject({ kind: 'rocket', id: rocket.id, name: rocket.name, data: rocket });
        } else if (ref.kind === 'moon') {
          const res = await api.moon(ref.id);
          const moon = res.data;
          const parent = moon && bodies.find((b) => b.id === moon.parentId);
          if (parent && view.bodyId !== parent.id) openBody(parent);
          if (moon) selectObject({ kind: 'moon', id: moon.id, name: moon.name, data: moon });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[jump] failed', err.message);
      }
    },
    [bodies, openBody, selectObject, view.bodyId]
  );

  /** Stable actions the tour uses to stage each step in the live app. */
  const tourApi = useMemo(
    () => ({
      openRail: () => setRailOpen(true),
      closeYearPanel: () => setYearPanelOpen(false),
      showYear: (value) => {
        setRailOpen(true);
        changeYear(value);
        setYearPanelOpen(true);
      },
      showBody: (id) => {
        const body = bodies.find((b) => b.id === id);
        if (!body) return;
        setYearPanelOpen(false);
        changeYear(null);
        openBody(body);
      },
      showSystem: () => {
        setYearPanelOpen(false);
        backToSystem();
      },
    }),
    [bodies, changeYear, openBody, setYearPanelOpen, backToSystem]
  );

  const startTour = useCallback(() => {
    setChatOpen(false);
    setYearPanelOpen(false);
    setRailOpen(true);
    changeYear(null);
    backToSystem();
    setTourOpen(true);
  }, [setChatOpen, setYearPanelOpen, changeYear, backToSystem]);

  useEffect(() => {
    if (autoTourStarted.current || !bodies.length) return undefined;
    autoTourStarted.current = true;
    if (hasSeenTour()) return undefined;
    try {
      window.localStorage.setItem('space-relics-welcome-v2', 'seen');
    } catch {
      /* storage can be blocked */
    }
    const timer = setTimeout(startTour, 700);
    return () => clearTimeout(timer);
  }, [bodies.length, startTour]);

  const jumpFromYear = useCallback(
    (row) => {
      if (row.year && year !== row.year) changeYear(row.year);
      jumpTo(row);
    },
    [changeYear, jumpTo, year]
  );

  if (catalog.error) {
    return (
      <div className="state" style={{ height: '100vh' }}>
        <img src="/logo.png" alt="" width="72" height="72" style={{ borderRadius: '50%' }} />
        <h2>The dataset could not be loaded</h2>
        <div className="error-box">{catalog.error.message}</div>
        <button type="button" className="btn btn--primary" onClick={catalog.reload}>
          Try again
        </button>
        <p className="small muted">
          The catalogue is read from <span className="mono">public/data/</span>. Run{' '}
          <span className="mono">npm run dev</span> inside <span className="mono">client/</span>, then reload.
        </p>
      </div>
    );
  }

  const docked = !isTablet;

  return (
    <div
      className={`app${railOpen ? ' app--rail-open' : ''}${chatOpen ? ' app--chat-open' : ''}${
        docked ? ' app--docked' : ''
      }`}
    >
      <TopBar
        counts={counts}
        view={view}
        onBack={backToSystem}
        onJumpTo={jumpTo}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        sidebarOpen={railOpen}
        onToggleSidebar={toggleRail}
        timeline={timeline}
        year={year}
        setYear={changeYear}
        yearPanelOpen={yearPanelOpen}
        setYearPanelOpen={setYearPanelOpen}
        yearEvents={yearEvents ? yearEvents.total : 0}
        onStartTour={startTour}
      />

      <div className="app__body">
        <Sidebar
          view={view}
          bodies={eraBodies}
          current={current}
          hardware={eraHardware}
          totalHardware={hardware.length}
          selectedId={selected ? selected.id : null}
          onFocusBody={openBody}
          onSelect={selectHardware}
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
          workingOnly={workingOnly}
          setWorkingOnly={setWorkingOnly}
          showDwarfs={showDwarfs}
          setShowDwarfs={setShowDwarfs}
          facets={facets}
          isPhone={isPhone}
          docked={docked}
          year={year}
          onCollapse={toggleRail}
          onClose={() => setRailOpen(false)}
        />

        <main className="stage">
          <div className="canvas-layer">
            {!bodies.length ? (
              <div className="state" style={{ height: '100%' }}>
                <div className="spinner" />
                <p className="small">Reading the dataset…</p>
              </div>
            ) : view.mode === 'system' ? (
              <SceneHost camera={{ position: [0, 150, 340], fov: 50, near: 0.05, far: 4000 }}>
                <SolarSystemScene
                  bodies={eraBodies}
                  onFocusBody={openBody}
                  selectedBodyId={selected && selected.kind === 'body' ? selected.id : null}
                  showDwarfs={showDwarfs}
                  year={year}
                />
              </SceneHost>
            ) : bodyData.loading && !current ? (
              <div className="state" style={{ height: '100%' }}>
                <div className="spinner" />
                <p className="small">Building the surface at this body…</p>
              </div>
            ) : current ? (
              <SceneHost camera={{ position: [0, 5, 18], fov: 45, near: 0.02, far: 2000 }}>
                <BodyScene
                  body={current}
                  hardware={eraHardware}
                  moons={moons}
                  selectedId={selected ? selected.id : null}
                  onSelect={selectHardware}
                  kindFilter={kindFilter}
                  workingOnly={workingOnly}
                          year={year}
                  isPhone={isPhone}
                  onClearSelection={() => selectObject(null)}
                />
              </SceneHost>
            ) : null}
          </div>

          {!docked && railOpen ? (
            <button type="button" className="scrim" onClick={() => setRailOpen(false)} aria-label="Close panels" />
          ) : null}

          {!docked && !railOpen ? (
            <button
              type="button"
              className="rail-tab"
              onClick={() => setRailOpen(true)}
              aria-label="Open the explorer panel"
              title="Explorer panel"
            >
              <span aria-hidden="true">☰</span>
              <span className="rail-tab__label">Panels</span>
            </button>
          ) : null}

          <YearPanel
            open={yearPanelOpen}
            year={year}
            timeline={timeline}
            events={yearEvents}
            onClose={() => setYearPanelOpen(false)}
            onJump={jumpFromYear}
            onSelectYear={changeYear}
          />

          <InfoPanel
            selected={selected}
            bodyNames={bodyNames}
            bodyImages={bodyImages}
            isPhone={isPhone}
            year={year}
            inBodyView={view.mode === 'body' && selected && selected.kind === 'body'}
            onClose={() => selectObject(null)}
            onFocusBody={openBody}
            onAsk={askAbout}
          />

          {!chatOpen && !selected ? (
            <button type="button" className="fab" onClick={() => setChatOpen(true)} aria-label="Open the AI guide">
              <span aria-hidden="true">🤖</span>
              <span className="fab__label">Ask the guide</span>
            </button>
          ) : null}

          {!selected && !chatOpen && !isPhone ? (
            <p className="hint">
              Drag to orbit · Scroll to zoom · Click any vehicle to fly to it · Drag the year timeline to travel back
            </p>
          ) : null}

          {isPhone ? (
            <PhoneBar
              view={view}
              sidebarOpen={railOpen}
              onToggleSidebar={toggleRail}
              chatOpen={chatOpen}
              onOpenChat={() => setChatOpen(!chatOpen)}
              onBack={backToSystem}
            />
          ) : null}
        </main>
      </div>

      {welcomeAllowed ? <WelcomeOverlay counts={counts} onChoose={welcomeChoose} onTour={startTour} /> : null}

      <Tour open={tourOpen} onClose={() => setTourOpen(false)} api={tourApi} />

      {chatOpen ? (
        <ChatDock
          context={chatContext}
          seed={chatSeed}
          onConsumeSeed={clearSeed}
          onSelectRef={jumpTo}
          isFullScreen={isPhone}
          onClose={() => setChatOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ExplorerProvider>
        <Explorer />
      </ExplorerProvider>
    </ErrorBoundary>
  );
}

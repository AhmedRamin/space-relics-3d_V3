import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const TOUR_KEY = 'space-relics-tour-v1';

/**
 * First-run tour.
 *
 * Each step points at a real element in the running app, dims everything else with a
 * spotlight, and explains what that part is for. Steps can prepare the interface first
 * (open the rail, park the timeline on 1969, focus Mars) so the user sees the feature
 * working rather than a screenshot of it.
 */
const STEPS = [
  {
    id: 'intro',
    title: 'Welcome to Space Relics 3D',
    body: 'A museum of real space hardware, placed on the worlds it explored. This 60-second tour shows you where everything lives. Use Next, or the arrow keys.',
    placement: 'center',
    icon: '🛰️',
  },
  {
    id: 'rail',
    title: 'Your explorer rail',
    body: 'Pick a body on the left to fly to it. Inside a body, the same rail lists every rover, lander, orbiter and station sent there — with its launch year. Drag the divider to scroll.',
    target: '.sidebar',
    placement: 'right',
    icon: '🗂️',
    prepare: (api) => {
      api.showSystem();
      api.openRail();
    },
  },
  {
    id: 'scene',
    title: 'Fly the Solar System',
    body: 'Drag to orbit the camera, scroll to zoom, and click a planet to descend. Each world carries a glowing cluster sized by how much hardware orbits it.',
    target: '.stage',
    placement: 'center',
    icon: '🪐',
    prepare: (api) => {
      api.showSystem();
      api.closeYearPanel();
    },
  },
  {
    id: 'timeline',
    title: 'Travel through time',
    body: 'This is the year axis. Drag the slider or press play, and the whole app becomes that year: objects that had not launched yet disappear, and the counts shrink to the fleet that existed then.',
    target: '.timeline',
    placement: 'below',
    icon: '⏳',
    prepare: (api) => api.closeYearPanel(),
  },
  {
    id: 'year',
    title: 'What happened that year',
    body: 'Open “Year in review” to see every launch, station and moon discovery of the selected year. Every row is a link — click it to fly straight to that object. Here is 1969, the year of Apollo 11.',
    target: '.year-panel',
    placement: 'right',
    icon: '🗓️',
    prepare: (api) => api.showYear(1969),
  },
  {
    id: 'info',
    title: 'Read the record',
    body: 'Selecting anything opens its dossier: photograph, status, launch, position, achievement, the relic-panel story, NASA citations and the exact coordinates in the dataset.',
    target: '.info-panel',
    placement: 'left',
    icon: '📖',
    prepare: (api) => api.showBody('mars'),
  },
  {
    id: 'guide',
    title: 'Ask the AI guide',
    body: 'The guide answers from this dataset first, then the web, and always labels its sources. Ask things like “Which rovers are still working?” or “Where is Voyager 1 now?”.',
    target: '.topbar__ai',
    placement: 'below',
    icon: '🤖',
    prepare: (api) => api.closeYearPanel(),
  },
  {
    id: 'search',
    title: 'Jump straight to anything',
    body: 'Search every NASA mission, moon, rocket and body by name. Results are grouped by type and carry the launch year.',
    target: '.searchbox',
    placement: 'below',
    icon: '🔎',
    prepare: (api) => api.closeYearPanel(),
  },
];

const PAD = 8;

export function Tour({ open, onClose, onFinish, api }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef(null);
  const retry = useRef(null);

  const step = STEPS[index];

  const measure = useCallback(() => {
    if (!step) return;
    if (!step.target) {
      setRect(null);
      setReady(true);
      return;
    }
    const element = document.querySelector(step.target);
    if (!element) {
      setRect(null);
      setReady(false);
      // The target may be mounting (a panel opening, a body loading) — retry briefly.
      clearTimeout(retry.current);
      retry.current = setTimeout(measure, 180);
      return;
    }
    const box = element.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) {
      setRect(null);
      setReady(false);
      clearTimeout(retry.current);
      retry.current = setTimeout(measure, 180);
      return;
    }
    setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    setReady(true);
  }, [step]);

  // Prepare the UI for the step, then measure once it has settled.
  useEffect(() => {
    if (!open || !step) return undefined;
    setReady(false);
    setRect(null);
    if (step.prepare) step.prepare(api);
    const timer = setTimeout(measure, step.target ? 380 : 60);
    return () => clearTimeout(timer);
  }, [open, index, step, api, measure]);

  useEffect(() => {
    if (!open) {
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, measure]);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_KEY, 'seen');
    } catch {
      /* storage can be blocked */
    }
    if (onFinish) onFinish();
    onClose();
  }, [onClose, onFinish]);

  const next = useCallback(() => {
    if (index >= STEPS.length - 1) finish();
    else setIndex((i) => i + 1);
  }, [index, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish, next, back]);

  useLayoutEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    if (!card) return;
    const box = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = vw / 2 - box.width / 2;
    let y = vh / 2 - box.height / 2;

    if (rect) {
      const gap = 16;
      const right = rect.left + rect.width;
      const bottom = rect.top + rect.height;
      if (step.placement === 'right' && right + gap + box.width < vw - 12) {
        x = right + gap;
        y = rect.top;
      } else if (step.placement === 'left' && rect.left - gap - box.width > 12) {
        x = rect.left - gap - box.width;
        y = rect.top;
      } else if (step.placement === 'below' || step.placement === 'right' || step.placement === 'left') {
        x = Math.min(Math.max(12, rect.left), vw - box.width - 12);
        y = bottom + gap;
      } else if (step.placement === 'above' && rect.top - gap - box.height > 12) {
        x = rect.left;
        y = rect.top - box.height - gap;
      }
    }

    card.style.left = `${Math.min(Math.max(12, x), vw - box.width - 12)}px`;
    card.style.top = `${Math.min(Math.max(12, y), vh - box.height - 12)}px`;
  }, [open, index, rect, step, ready]);

  if (!open || !step) return null;

  const spot = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Quick tour">
      <div className="tour__dim" />
      {spot ? <div className="tour__spot" style={spot} /> : null}

      <div ref={cardRef} className={`tour__card${ready ? ' tour__card--on' : ''}${spot ? '' : ' tour__card--center'}`}>
        <div className="tour__head">
          <span className="tour__icon" aria-hidden="true">{step.icon}</span>
          <span className="tour__step">
            Step {index + 1} of {STEPS.length}
          </span>
          <button type="button" className="tour__skip" onClick={finish}>
            Skip
          </button>
        </div>

        <h2 className="tour__title">{step.title}</h2>
        <p className="tour__body">{step.body}</p>

        <div className="tour__foot">
          <div className="tour__dots" aria-hidden="true">
            {STEPS.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`tour__dot${i === index ? ' tour__dot--on' : ''}`}
                onClick={() => setIndex(i)}
                tabIndex={-1}
              />
            ))}
          </div>
          <div className="tour__actions">
            {index > 0 ? (
              <button type="button" className="btn btn--sm btn--ghost" onClick={back}>
                Back
              </button>
            ) : null}
            <button type="button" className="btn btn--sm btn--primary" onClick={next}>
              {index === STEPS.length - 1 ? 'Start exploring' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function hasSeenTour() {
  if (typeof window === 'undefined') return true;
  try {
    return Boolean(window.localStorage.getItem(TOUR_KEY));
  } catch {
    return true;
  }
}

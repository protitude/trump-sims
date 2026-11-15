import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { cardById, vanityById } from '../game/content.ts';
import { dutyCost, vanityEgo, vanityStatus } from '../game/engine.ts';
import type { DutyKind, GameState, Place } from '../game/types.ts';
import { Blocks, Fx } from '../ui.tsx';
import { drawWorld, hitRectPx } from './draw.ts';
import type { Actor, Npc, Sim } from './draw.ts';
import { ARRIVALS, BEDS, ENTRANCE, OBJECTS, findPath, nearestFree, tileAt, tileCenter, waitingSpot } from './map.ts';
import { T } from './map.ts';
import type { Point, Tile } from './map.ts';

interface Props {
  state: GameState;
  /** A "walk over there" request from the HUD. `n` changes on every request. */
  command: { n: number; target: Target } | null;
  onDuty: (cardId: string, option: number) => void;
  onVanity: (actionId: string) => void;
  onEndMonth: () => void;
}

export type Target = { type: 'object'; id: string } | { type: 'npc'; cardId: string };
type Menu = Target & { sx: number; sy: number };

const PRESIDENT_SPEED = 340;
const VISITOR_SPEED = 210;
/** How long an activity takes to watch, by its cost in time blocks. */
const watchTime = (blocks: number) => 1.6 + 0.8 * blocks;

const KIND_LABEL: Record<DutyKind, string> = {
  briefing: 'Briefing',
  decision: 'Decision',
  press: 'Press',
  call: 'Phone call',
  crisis: 'Crisis',
  hybrid: 'Opportunity',
};

const DUTY_EMOJI: Record<DutyKind, string> = {
  briefing: '📋',
  decision: '🤔',
  press: '🎤',
  call: '📞',
  crisis: '🚨',
  hybrid: '🤝',
};

const VANITY_EMOJI: Record<string, string> = {
  build: '🏗️',
  trip: '✈️',
  resort: '🌴',
  'resort-golf': '⛳',
  'resort-dinner': '🍽️',
  'resort-dj': '🎵',
  'resort-memberships': '💰',
  rename: '✍️',
  gild: '✨',
  'show-golf': '⛳',
  'show-post': '📱',
  'show-rally': '📣',
  'show-parade': '🎖️',
};

function advance(a: Actor, speed: number, dt: number): void {
  let budget = speed * dt;
  if (a.path.length > 0) a.walk += dt;
  while (budget > 0 && a.path.length > 0) {
    const next = a.path[0];
    const dx = next.x - a.x;
    const dy = next.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.5) a.facing = dx > 0 ? 1 : -1;
    if (dist <= budget) {
      a.x = next.x;
      a.y = next.y;
      a.path.shift();
      budget -= dist;
    } else {
      a.x += (dx / dist) * budget;
      a.y += (dy / dist) * budget;
      budget = 0;
    }
  }
}

function createSim(place: Place): Sim {
  const start = tileCenter(BEDS[place].spot);
  return {
    pres: { ...start, path: [], facing: 1, walk: 0 },
    npcs: [],
    activity: null,
    floats: [],
    hover: null,
    time: 0,
    fade: 0,
    cam: { x: 0, y: 0, scale: 1 },
  };
}

/** Tile the president stands on to talk to a visitor. */
function besideVisitor(spot: Tile): Tile {
  return [spot[0] - 2, spot[1]];
}

export function World({ state, command, onDuty, onVanity, onEndMonth }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  if (!simRef.current) simRef.current = createSim(state.place);
  const sim = simRef.current;

  const stateRef = useRef(state);
  stateRef.current = state;
  const callbacks = useRef({ onDuty, onVanity, onEndMonth });
  callbacks.current = { onDuty, onVanity, onEndMonth };

  const targetRef = useRef<Target | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const toScreen = (p: Point) => ({ sx: (p.x - sim.cam.x) * sim.cam.scale, sy: (p.y - sim.cam.y) * sim.cam.scale });

  const openMenu = (target: Target) => {
    let anchor: Point = sim.pres;
    if (target.type === 'object') {
      const r = hitRectPx(OBJECTS.find((o) => o.id === target.id)!);
      anchor = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    } else {
      const npc = sim.npcs.find((n) => n.cardId === target.cardId && !n.leaving);
      if (!npc) return;
      anchor = { x: npc.x, y: npc.y - 30 };
      sim.pres.facing = npc.x >= sim.pres.x ? 1 : -1;
      npc.facing = sim.pres.facing === 1 ? -1 : 1;
    }
    setMenu({ ...target, ...toScreen(anchor) });
  };

  const walkTo = (tile: Tile, target: Target | null) => {
    setMenu(null);
    sim.pres.path = findPath(sim.pres, tile);
    // No route (the other place, or out at sea): stay put and open nothing.
    const goal = tileCenter(tile);
    const there = Math.hypot(goal.x - sim.pres.x, goal.y - sim.pres.y) < T;
    targetRef.current = sim.pres.path.length > 0 || there ? target : null;
  };

  /** True once the month's time is spent and he is heading for bed. */
  const bedtime = useRef(false);

  const sleep = () => {
    perform('Sleeping', '💤', 1.8, () => callbacks.current.onEndMonth(), { anim: 'sleep' });
    sim.activity!.sleep = true;
  };

  /** Starts a timed activity. `scene` picks the animation drawn while it runs. */
  function perform(
    label: string,
    emoji: string,
    seconds: number,
    done: () => void,
    scene: { anim?: string; objectId?: string; cardId?: string } = {},
  ) {
    setMenu(null);
    setBusy(label);
    sim.activity = {
      label,
      emoji,
      t: 0,
      dur: seconds,
      ...scene,
      done: () => {
        setBusy(null);
        done();
      },
    };
  }

  // Animation loop. Runs for the lifetime of the component.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      sim.time += dt;

      advance(sim.pres, PRESIDENT_SPEED, dt);
      for (const n of sim.npcs) advance(n, VISITOR_SPEED, dt);
      sim.npcs = sim.npcs.filter((n) => !(n.leaving && n.path.length === 0));

      if (sim.activity) {
        sim.activity.t += dt;
        if (sim.activity.sleep) sim.fade = Math.min(1, sim.activity.t / sim.activity.dur);
        if (sim.activity.t >= sim.activity.dur) {
          const finished = sim.activity;
          sim.activity = null;
          finished.done();
        }
      } else {
        sim.fade = Math.max(0, sim.fade - dt * 1.2);
        if (targetRef.current && sim.pres.path.length === 0) {
          const target = targetRef.current;
          targetRef.current = null;
          // Out of time: he gets into bed by himself, with no menu to confirm.
          if (bedtime.current && target.type === 'object' && target.id === BEDS[stateRef.current.place].id) sleep();
          else openMenu(target);
        } else if (bedtime.current && !targetRef.current && sim.pres.path.length === 0) {
          // Safety net: out of time but standing idle, so send him to bed again.
          const bed = BEDS[stateRef.current.place];
          walkTo(bed.spot, { type: 'object', id: bed.id });
        }
      }

      for (const f of sim.floats) f.t += dt;
      sim.floats = sim.floats.filter((f) => f.t < 1.6);

      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (wrap && canvas) {
        const dpr = window.devicePixelRatio || 1;
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawWorld(ctx, sim, stateRef.current, w, h);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep visitors in step with the inbox: new cards walk in, dealt-with or
  // ignored ones walk out.
  useEffect(() => {
    const prefix = `${state.month}:`;
    const wanted = new Set(state.inbox.map((id) => prefix + id));
    for (const n of sim.npcs) {
      if (n.leaving || wanted.has(n.key)) continue;
      n.leaving = true;
      n.angry = !n.key.startsWith(prefix);
      n.path = findPath(n, ENTRANCE);
    }
    for (const id of state.inbox) {
      const key = prefix + id;
      if (sim.npcs.some((n) => n.key === key)) continue;
      const kind = cardById(id).kind;
      const spot = waitingSpot(
        kind,
        sim.npcs.filter((n) => !n.leaving).map((n) => n.spot),
      );
      const npc: Npc = { ...tileCenter(ENTRANCE), path: [], facing: -1, walk: 0, key, cardId: id, kind, spot, leaving: false, angry: false };
      npc.path = findPath(npc, spot);
      sim.npcs.push(npc);
    }
  }, [state.inbox, state.month, sim]);

  // Float "+5 Ego" style numbers over the president when a meter changes.
  const previous = useRef({ ego: state.ego, stability: state.stability });
  useEffect(() => {
    const changes: [number, string][] = [
      [state.ego - previous.current.ego, 'Ego'],
      [state.stability - previous.current.stability, 'Stability'],
    ];
    previous.current = { ego: state.ego, stability: state.stability };
    let row = 0;
    for (const [delta, name] of changes) {
      if (delta === 0) continue;
      sim.floats.push({
        x: sim.pres.x,
        y: sim.pres.y - 96 - row * 18,
        text: `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${name}`,
        color: delta > 0 ? '#8ff0a8' : '#ff8a7a',
        t: 0,
      });
      row += 1;
    }
  }, [state.ego, state.stability, sim]);

  // Stepping off the plane: appear at the arrival spot of the new place.
  const lastPlace = useRef(state.place);
  useEffect(() => {
    if (state.place === lastPlace.current) return;
    lastPlace.current = state.place;
    Object.assign(sim.pres, tileCenter(ARRIVALS[state.place]), { path: [] });
    targetRef.current = null;
  }, [state.place, sim]);

  // When the month's time runs out he walks to the nearest bed and sleeps.
  useEffect(() => {
    bedtime.current = state.blocks === 0 && state.status === 'playing';
    if (!bedtime.current) return;
    const bed = BEDS[state.place];
    walkTo(bed.spot, { type: 'object', id: bed.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.blocks, state.month, state.place, state.status]);

  const lastCommand = useRef(command?.n);
  useEffect(() => {
    if (!command || command.n === lastCommand.current) return;
    lastCommand.current = command.n;
    // Ignore requests while he is busy or already on his way to bed.
    if (sim.activity || bedtime.current) return;
    const target = command.target;
    if (target.type === 'object') {
      // "Go to bed" means whichever bed is in this place.
      const object = target.id === 'bed' ? BEDS[stateRef.current.place] : OBJECTS.find((o) => o.id === target.id)!;
      walkTo(object.spot, { type: 'object', id: object.id });
    } else {
      const npc = sim.npcs.find((n) => n.cardId === target.cardId && !n.leaving);
      if (npc) walkTo(besideVisitor(npc.spot), target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  const worldPoint = (e: PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / sim.cam.scale + sim.cam.x, y: (e.clientY - rect.top) / sim.cam.scale + sim.cam.y };
  };

  const hit = (p: Point): { target: Target; key: string; tile: Tile } | null => {
    for (const n of stateRef.current.place === 'dc' ? sim.npcs : []) {
      if (n.leaving) continue;
      if (Math.abs(p.x - n.x) < 20 && p.y > n.y - 102 && p.y < n.y + 8) {
        return { target: { type: 'npc', cardId: n.cardId }, key: n.key, tile: besideVisitor(n.spot) };
      }
    }
    // Smallest object first, so the phone wins over the carpet behind it.
    const candidates = OBJECTS.filter((o) => {
      if (o.inert || (o.place ?? 'dc') !== stateRef.current.place) return false;
      const r = hitRectPx(o);
      return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    }).sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h);
    const o = candidates[0];
    return o ? { target: { type: 'object', id: o.id }, key: o.id, tile: o.spot } : null;
  };

  const onPointerMove = (e: PointerEvent) => {
    const found = hit(worldPoint(e));
    sim.hover = found?.key ?? null;
    canvasRef.current!.style.cursor = found ? 'pointer' : 'default';
  };

  const onPointerDown = (e: PointerEvent) => {
    // Nothing to redirect once he is busy or on his way to bed.
    if (sim.activity || bedtime.current) return;
    const p = worldPoint(e);
    const found = hit(p);
    if (found) walkTo(found.tile, found.target);
    else walkTo(nearestFree(tileAt(p)), null);
  };

  // ---------- Interaction menu ----------

  let panel = null;
  if (menu && !busy) {
    const wrap = wrapRef.current;
    const width = wrap?.clientWidth ?? 800;
    const height = wrap?.clientHeight ?? 500;
    const left = Math.max(175, Math.min(width - 175, menu.sx));
    const below = menu.sy < height * 0.5;
    const style = below
      ? { left, top: Math.max(8, menu.sy + 26), maxHeight: height - Math.max(8, menu.sy + 26) - 8 }
      : { left, bottom: Math.max(8, height - menu.sy + 34), maxHeight: height - Math.max(8, height - menu.sy + 34) - 8 };

    let body = null;
    if (menu.type === 'npc') {
      const card = cardById(menu.cardId);
      const cost = dutyCost(state, card);
      const affordable = cost <= state.blocks;
      body = (
        <article className={`card kind-${card.kind}`}>
          <div className="card-head">
            <span className="kind">{card.setPiece ?? (card.because ? 'Consequence' : KIND_LABEL[card.kind])}</span>
            <Blocks n={cost} />
          </div>
          <h3>{card.title.replace(/^(CRISIS|OPPORTUNITY): /, '')}</h3>
          {card.because && <p className="because">{card.because}</p>}
          <p>{card.text}</p>
          <div className="options">
            {card.options.map((option, i) => (
              <button
                key={i}
                className="option"
                disabled={!affordable}
                onClick={() =>
                  perform(option.label, DUTY_EMOJI[card.kind], watchTime(cost), () => callbacks.current.onDuty(card.id, i), {
                    anim: `duty-${card.kind}`,
                    cardId: card.id,
                  })
                }
              >
                <span>{option.label}</span>
                <Fx effects={option.effects} />
              </button>
            ))}
          </div>
          {!affordable && <div className="ignore">Not enough time left this month.</div>}
          {card.ignore.stability < 0 && <div className="ignore">If ignored: {card.ignore.stability} Stability</div>}
        </article>
      );
    } else {
      const object = OBJECTS.find((o) => o.id === menu.id)!;
      if (object.special === 'bed') {
        const waiting = state.inbox.filter((id) => cardById(id).kind !== 'hybrid').length;
        body = (
          <>
            <h3 className="menu-title">Bed</h3>
            <p className="menu-note">
              {waiting > 0
                ? `${waiting} ${waiting === 1 ? 'person is' : 'people are'} still waiting for you${
                    state.place === 'dc' ? '' : ' in Washington'
                  }. Sleeping now ignores them.`
                : 'Nobody is waiting. A rare clean desk.'}
            </p>
            <button
              className="btn primary"
              onClick={sleep}
            >
              Go to sleep (end the month)
            </button>
          </>
        );
      } else {
        body = (
          <>
            <h3 className="menu-title">{object.kind === 'plot' ? 'Construction Site' : object.name}</h3>
            {object.actions.map((id) => {
              const action = vanityById(id);
              const status = vanityStatus(state, action);
              const note =
                status === 'done'
                  ? 'Done.'
                  : status === 'locked'
                    ? 'Build the previous monument first.'
                    : status === 'no-time'
                      ? 'Not enough time left this month.'
                      : status === 'away'
                        ? 'You are not there.'
                        : action.text;
              return (
                <button
                  key={id}
                  className={`vanity status-${status}`}
                  disabled={status !== 'ok'}
                  onClick={() => {
                    const grouped = ['gild', 'build', 'rename'].includes(action.category);
                    perform(
                      action.title,
                      VANITY_EMOJI[action.id] ?? VANITY_EMOJI[action.category],
                      action.travelTo ? 1.8 : watchTime(action.cost),
                      () => callbacks.current.onVanity(action.id),
                      { anim: grouped ? action.category : action.id, objectId: object.id },
                    );
                    // Flights fade to black so the change of scene is hidden.
                    if (action.travelTo) sim.activity!.sleep = true;
                  }}
                >
                  <span className="vanity-main">
                    <span className="vanity-title">{action.title}</span>
                    <span className="vanity-text">{note}</span>
                  </span>
                  {status !== 'done' && (
                    <span className="vanity-side">
                      <Blocks n={action.cost} />
                      <Fx effects={{ ego: vanityEgo(state, action), stability: action.stability, gold: action.gold, names: action.names }} />
                    </span>
                  )}
                </button>
              );
            })}
          </>
        );
      }
    }
    panel = (
      <div className="menu" style={style} role="dialog">
        <button className="menu-close" aria-label="Close" onClick={() => setMenu(null)}>
          ×
        </button>
        {body}
      </div>
    );
  }

  return (
    <div className="world" ref={wrapRef}>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={() => (sim.hover = null)} />
      {busy && <div className="busy">{busy}…</div>}
      {panel}
    </div>
  );
}

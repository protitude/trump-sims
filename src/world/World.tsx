import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { calleeAt } from '../game/calls.ts';
import { cardById, vanityById } from '../game/content.ts';
import { COKE_SECONDS, DANCES, FIGHT_SECONDS, INTERVIEW_SECONDS, LUNCH_SECONDS, SUE_SECONDS, aideAway, golfing } from './draw.ts';
import { TUNING, bragsAboutPhysical, dutyEffects, leakChanceAt, cokeStatus, domeShields, dutyCost, melaniaAttends, melaniaStatus, sueStatus, vanityEgo, vanityStability, vanityStatus } from '../game/engine.ts';
import type { Meal } from '../game/engine.ts';
import { MELANIA_INSULTS } from '../game/melania.ts';
import { guestById, showOf } from '../game/guests.ts';
import { BRAGS_PER_EGO, BRAG_EGO_MAX, INAUGURATION_ADDRESS, addressFor, applauseEgo, bragMaterial, isSpeech } from '../game/events.ts';
import { ELECTION_SECONDS, INAUGURATION_SECONDS } from './scenes.ts';
import type { DutyKind, GameState, Place } from '../game/types.ts';
import { Blocks, Fx, Why, needCoin, needTime } from '../ui.tsx';
import { drawWorld, hitRectPx } from './draw.ts';
import type { Activity, Actor, Aide, Npc, Sim } from './draw.ts';
import { nextAffirmations } from './affirmations.ts';
import { AIDE_GRAB, AIDE_PACE, AIDE_SPOT, BEDS, CLUB_GATE, IDLE_SEATS, RINGSIDE, RINGSIDE_VIA, arrival, cartLoop, cheerTile, curbTile, inCabinetRoom, exists, golfShot, guestSpot, idleKindAt, objectName, ENTRANCE, OBJECTS, findPath, nearestFree, tileAt, tileCenter, waitingSpot } from './map.ts';
import { T } from './map.ts';
import type { Point, Tile } from './map.ts';
import type { DanceCue } from '../music.tsx';

interface Props {
  state: GameState;
  /** A "walk over there" request from the HUD. `n` changes on every request. */
  command: { n: number; target: Target } | null;
  /** His cue to dance: which moves, and performance.now() when the track started. Null with the music off. */
  dance: DanceCue | null;
  onDuty: (cardId: string, option: number) => void;
  onVanity: (actionId: string) => void;
  onBribe: (guestId: string) => void;
  onDecline: (guestId: string) => void;
  onLunch: (meal: Meal) => void;
  onCoke: () => void;
  onSue: () => void;
  onMelania: () => void;
  onAbuse: () => void;
  /** The election broadcast has finished playing. */
  onBroadcast: () => void;
  onEndMonth: () => void;
}

/** `cardId` is a duty card for a visitor in Washington, or a guest id at the club. */
export type Target = { type: 'object'; id: string } | { type: 'npc'; cardId: string } | { type: 'guest'; cardId: string };
/** Menus open on a target, or on Natalie, who is always within reach. */
type Menu = (Target | { type: 'aide' }) & { sx: number; sy: number };

const PRESIDENT_SPEED = 340;
const VISITOR_SPEED = 210;
/** Natalie keeps up, just. Pacing the corridor she drags her feet; on the grass the cart outruns her. */
const AIDE_SPEED = 300;
const AIDE_PACE_SPEED = 100;
const AIDE_CHASE_SPEED = 150;
const AIDE_BEDTIME_SPEED = 420;
/** How close she stands to him. */
const AIDE_GAP = 44;
/** Radians a second around the golf course. */
const CART_SPIN = 2;
/** Seconds of affirmations before the lights go out. */
const BEDTIME_SECONDS = 15;
/** Seconds of standing about before he finds something to do by himself. */
const IDLE_AFTER = 30;
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
  'trip-maralago-heli': '🚁',
  'trip-home-heli': '🚁',
  'trip-newyork-heli': '🚁',
  'trip-home-heli-ny': '🚁',
  resort: '🌴',
  'resort-golf': '⛳',
  'resort-dinner': '🍽️',
  'resort-dj': '🎵',
  'resort-memberships': '💰',
  rename: '✍️',
  gild: '✨',
  'show-golf': '⛳',
  'show-post': '📱',
  'show-call': '📞',
  'show-rally': '📣',
  'show-parade': '🎖️',
  'show-state-dinner': '🍽️',
};

/** Actions that borrow another one's animation. */
const ANIM: Record<string, string> = { 'show-state-dinner': 'resort-dinner' };

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

/** Natalie, one step behind and to the side of the tile given. */
function aideAt(tile: Tile): Aide {
  return { ...tileCenter(nearestFree([tile[0] + 2, tile[1] + 1])), path: [], facing: -1, walk: 0, mode: 'follow', think: 0, pace: 0, pacing: false };
}

function createSim(place: Place): Sim {
  const start = tileCenter(BEDS[place].spot);
  return {
    pres: { ...start, path: [], facing: 1, walk: 0 },
    npcs: [],
    activity: null,
    idle: null,
    aide: aideAt(BEDS[place].spot),
    floats: [],
    hover: null,
    time: 0,
    fade: 0,
    cam: { x: 0, y: 0, scale: 1 },
  };
}

/** Seconds it takes to ask Melania for something. It feels longer. */
const BEG_SECONDS = 3;
/** Where the helicopter sets down in each place. */
const HELIPADS: Record<Place, string> = { dc: 'garden', maralago: 'mal-helipad', newyork: 'ny-helipad' };
/** Seconds a take-off or a landing takes to watch. */
const FLIGHT_SECONDS = 2.4;

/** Tile the president stands on to talk to a visitor. */
function besideVisitor(spot: Tile): Tile {
  return [spot[0] - 2, spot[1]];
}

export function World({ state, command, dance, onDuty, onVanity, onBribe, onDecline, onLunch, onCoke, onSue, onMelania, onAbuse, onBroadcast, onEndMonth }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  if (!simRef.current) simRef.current = createSim(state.place);
  const sim = simRef.current;

  const stateRef = useRef(state);
  stateRef.current = state;
  const callbacks = useRef({ onDuty, onVanity, onBribe, onDecline, onLunch, onCoke, onSue, onMelania, onAbuse, onBroadcast, onEndMonth });
  callbacks.current = { onDuty, onVanity, onBribe, onDecline, onLunch, onCoke, onSue, onMelania, onAbuse, onBroadcast, onEndMonth };

  const targetRef = useRef<Target | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** True once Melania has said something in the menu that is open now. */
  const [heard, setHeard] = useState(false);

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
    setHeard(false);
    setMenu({ ...target, ...toScreen(anchor) });
  };

  /** Seconds he has been standing still with nothing to do. */
  const idleFor = useRef(0);
  const menuOpen = useRef(false);
  menuOpen.current = menu !== null;

  /** Left alone too long: start the scene that suits where he is standing. */
  const startIdle = () => {
    const kind = idleKindAt(stateRef.current.place, sim.pres);
    if (!kind) return;
    sim.idle = { kind, walking: kind !== 'press', t: 0 };
    if (kind === 'cart') {
      // The cart is waiting at the right-hand end of its loop.
      const loop = cartLoop(stateRef.current.place);
      sim.pres.path = findPath(sim.pres, tileAt({ x: loop.cx + loop.rx, y: loop.cy }));
    } else if (kind === 'motorcade') sim.pres.path = findPath(sim.pres, curbTile(sim.pres));
    else if (kind !== 'press') sim.pres.path = findPath(sim.pres, IDLE_SEATS[kind].tile);
  };

  /** Any instruction snaps him out of it. */
  const endIdle = () => {
    idleFor.current = 0;
    if (!sim.idle) return;
    sim.idle = null;
    sim.pres.seated = false;
  };

  /** Natalie Harp goes wherever he goes, except the Cabinet Room. */
  function updateAide(dt: number) {
    const a = sim.aide;
    const p = sim.pres;
    const place = stateRef.current.place;
    const idle = sim.idle && !sim.idle.walking ? sim.idle.kind : null;
    // On the green she waits by the hole, where his ball is about to not go in.
    const shot = golfing(sim.activity) ? golfShot(sim.activity?.objectId) : null;
    const mode: Aide['mode'] = sim.activity?.sleep
      ? 'bedside'
      : shot
        ? 'kick'
        : idle === 'dictate'
        ? 'dictate'
        : idle === 'cart'
          ? 'chase'
          : idle === 'rain'
            ? 'grab'
            : idle === 'motorcade'
            ? 'clap'
            : place === 'dc' && inCabinetRoom(p)
            ? 'barred'
            : 'follow';
    if (mode !== a.mode) {
      a.mode = mode;
      a.think = 0;
      a.pacing = false;
      a.path = mode === 'bedside' ? findPath(a, BEDS[place].spot) : mode === 'dictate' ? findPath(a, AIDE_SPOT) : [];
      if (mode === 'kick' && shot) a.path = [...findPath(a, tileAt(shot.stand)), shot.stand];
      if (mode === 'clap') a.path = findPath(a, cheerTile(p));
    }
    const gap = Math.hypot(p.x - a.x, p.y - a.y);
    let speed = AIDE_SPEED;
    switch (mode) {
      case 'follow':
        a.think -= dt;
        if (a.think <= 0 && gap > (p.path.length > 0 ? AIDE_GAP : AIDE_GAP + 16)) {
          a.path = findPath(a, tileAt(p));
          a.think = 0.3;
        }
        // On the last straight to him, stop a polite step short.
        if (a.path.length <= 1 && gap < AIDE_GAP) a.path = [];
        break;
      case 'barred':
        // Shut out: to the corridor, then up and down outside the door.
        if (a.path.length === 0) {
          if (a.pacing) a.pace = a.pace === 0 ? 1 : 0;
          else if (Math.hypot(tileCenter(AIDE_PACE[a.pace]).x - a.x, tileCenter(AIDE_PACE[a.pace]).y - a.y) < T) a.pacing = true;
          a.path = findPath(a, AIDE_PACE[a.pace]);
        }
        if (a.pacing) speed = AIDE_PACE_SPEED;
        break;
      case 'chase':
        // Straight at the cart, which is always somewhere else by the time she gets there.
        a.path = gap > 30 ? [{ x: p.x, y: p.y }] : [];
        speed = AIDE_CHASE_SPEED;
        break;
      case 'grab':
        // From one bill to the next around the pool, stooping briefly at each.
        if (a.path.length === 0) {
          a.think -= dt;
          if (a.think <= 0) {
            const spots = AIDE_GRAB.filter((s) => Math.hypot(tileCenter(s).x - a.x, tileCenter(s).y - a.y) > T);
            a.path = findPath(a, spots[Math.floor(Math.random() * spots.length)]);
            a.think = 0.5;
          }
        }
        break;
      case 'bedside':
        speed = AIDE_BEDTIME_SPEED;
        break;
      case 'dictate':
      case 'kick':
      case 'clap':
        break;
    }
    advance(a, speed, dt);
    if (a.path.length === 0) {
      // The bed is to the left of where she stands; otherwise she watches him.
      if (mode === 'bedside') a.facing = -1;
      // Scrambling for bills, her eyes are on the pool, which is to his right.
      else if (mode === 'grab') a.facing = p.x + 5 * T >= a.x ? 1 : -1;
      // By the hole, she faces the ball she is about to kick.
      else if (mode === 'kick' && shot) a.facing = shot.miss.x >= a.x ? 1 : -1;
      else if (mode !== 'barred') a.facing = p.x >= a.x ? 1 : -1;
    }
  }

  const walkTo = (tile: Tile, target: Target | null) => {
    setMenu(null);
    endIdle();
    sim.pres.path = findPath(sim.pres, tile);
    // No route (the other place, or out at sea): stay put and open nothing.
    const goal = tileCenter(tile);
    const there = Math.hypot(goal.x - sim.pres.x, goal.y - sim.pres.y) < T;
    targetRef.current = sim.pres.path.length > 0 || there ? target : null;
  };

  /** True once the month's time is spent and he is heading for bed. */
  const bedtime = useRef(false);

  const sleep = () => {
    // Tucked in, with Natalie at the bedside telling him what he needs to hear.
    perform('Sleeping', '💤', BEDTIME_SECONDS, () => callbacks.current.onEndMonth(), { anim: 'sleep', objectId: BEDS[stateRef.current.place].id });
    sim.activity!.sleep = true;
    sim.activity!.lines = nextAffirmations(4);
  };

  /** Starts a timed activity. `scene` picks the animation drawn while it runs. */
  function perform(
    label: string,
    emoji: string,
    seconds: number,
    done: () => void,
    scene: Pick<Activity, 'anim' | 'objectId' | 'cardId' | 'screen'> = {},
  ) {
    setMenu(null);
    endIdle();
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

  // A dance track comes on: a few seconds of moves, wherever he happens to be.
  useEffect(() => {
    if (!dance) {
      // Music switched off: the party is over.
      sim.danceUntil = undefined;
      return;
    }
    const left = DANCES[dance.style].seconds - (performance.now() - dance.at) / 1000;
    if (left > 0) {
      sim.danceUntil = sim.time + left;
      sim.danceStyle = dance.style;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dance]);

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
      updateAide(dt);

      if (sim.activity) {
        // Bedtime does not start until Natalie has reached the bedside, nor the fight until he has reached his seat.
        const waiting = sim.activity.sleep ? sim.aide.path.length > 0 : sim.activity.anim === 'fight' && sim.pres.path.length > 0;
        if (!waiting) sim.activity.t += dt;
        const part = sim.activity.t / sim.activity.dur;
        // The lights go down for the affirmations, then out.
        if (sim.activity.sleep) sim.fade = Math.max(0.35 * Math.min(1, sim.activity.t / 0.8), 1 - (sim.activity.dur - sim.activity.t) / 0.8);
        // Flights black out as they leave and clear as they come in, hiding the change of scene.
        else if (sim.activity.flight === 'out') sim.fade = Math.max(0, Math.min(1, (part - 0.7) / 0.3));
        else if (sim.activity.flight === 'in') sim.fade = Math.max(0, 1 - part / 0.35);
        // Anything else starts in daylight, even straight out of bed.
        else sim.fade = Math.max(0, sim.fade - dt * 1.2);
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

      // Idle scenes: left standing about, he finds his own entertainment.
      const idle = sim.idle;
      if (idle?.walking) {
        if (sim.pres.path.length === 0) {
          idle.walking = false;
          if (idle.kind === 'cart') {
            // Arrived at the cart: climb in.
            sim.pres.seated = true;
          } else if (idle.kind !== 'motorcade') {
            // Arrived: sit down (or take the podium). At the desk, Natalie comes around to take dictation.
            const seat = IDLE_SEATS[idle.kind as Exclude<typeof idle.kind, 'press' | 'cart'>];
            Object.assign(sim.pres, seat.seat, { facing: seat.facing, seated: !seat.stand });
          }
        }
      } else if (idle) {
        idle.t += dt;
        if (idle.kind === 'cart') {
          // Round and round the course.
          const loop = cartLoop(stateRef.current.place);
          const angle = idle.t * CART_SPIN;
          sim.pres.x = loop.cx + Math.cos(angle) * loop.rx;
          sim.pres.y = loop.cy + Math.sin(angle) * loop.ry;
          sim.pres.facing = Math.sin(angle) > 0 ? -1 : 1;
        }
      } else if (
        !sim.activity &&
        !targetRef.current &&
        !bedtime.current &&
        !menuOpen.current &&
        sim.pres.path.length === 0 &&
        stateRef.current.status === 'playing'
      ) {
        idleFor.current += dt;
        if (idleFor.current >= IDLE_AFTER) startIdle();
      } else {
        idleFor.current = 0;
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
    const guestPrefix = `g${state.month}:`;
    const wanted = new Set([...state.inbox.map((id) => prefix + id), ...state.guests.map((id) => guestPrefix + id)]);
    for (const n of sim.npcs) {
      if (n.leaving || wanted.has(n.key)) continue;
      n.leaving = true;
      // Ignored visitors storm out. Guests at the club just drift home.
      n.angry = n.place === 'dc' && !n.key.startsWith(prefix);
      n.path = findPath(n, n.place === 'dc' ? ENTRANCE : CLUB_GATE);
    }
    const taken = (place: Place) => sim.npcs.filter((n) => !n.leaving && n.place === place).map((n) => n.spot);
    for (const id of state.inbox) {
      const key = prefix + id;
      if (sim.npcs.some((n) => n.key === key)) continue;
      const kind = cardById(id).kind;
      const spot = waitingSpot(kind, taken('dc'));
      const npc: Npc = { ...tileCenter(ENTRANCE), path: [], facing: -1, walk: 0, key, cardId: id, kind, place: 'dc', spot, leaving: false, angry: false };
      npc.path = findPath(npc, spot);
      sim.npcs.push(npc);
    }
    for (const id of state.guests) {
      const key = guestPrefix + id;
      if (sim.npcs.some((n) => n.key === key)) continue;
      const spot = guestSpot(taken('maralago'));
      const npc: Npc = { ...tileCenter(CLUB_GATE), path: [], facing: -1, walk: 0, key, cardId: id, kind: guestById(id).kind, place: 'maralago', spot, leaving: false, angry: false };
      npc.path = findPath(npc, spot);
      sim.npcs.push(npc);
    }
  }, [state.inbox, state.guests, state.month, sim]);

  // Float "+5 Ego" style numbers over the president when a meter changes.
  const previous = useRef({ ego: state.ego, stability: state.stability, coin: state.coin });
  useEffect(() => {
    const changes: [number, string][] = [
      [state.ego - previous.current.ego, 'Ego'],
      [state.stability - previous.current.stability, 'Stability'],
      [state.coin - previous.current.coin, 'Coin'],
    ];
    previous.current = { ego: state.ego, stability: state.stability, coin: state.coin };
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
  }, [state.ego, state.stability, state.coin, sim]);

  // Lunch came back up: say so over his head before he heads for bed.
  const sick = state.stats.sick ?? 0;
  const lastSick = useRef(sick);
  /** What she was last sent for, so that the right thing gets the blame. */
  const lastMeal = useRef<Meal>('burger');
  useEffect(() => {
    if (sick > lastSick.current) {
      sim.floats.push({ x: sim.pres.x, y: sim.pres.y - 114, text: '💩 Uh oh', color: '#d9a066', t: 0 });
      sim.sick = lastMeal.current;
    }
    lastSick.current = sick;
  }, [sick, sim]);
  // A night's sleep and it is forgotten. Kennedy is not, and neither is the lettuce.
  useEffect(() => {
    sim.sick = undefined;
  }, [state.month, sim]);

  // Stepping off the plane or helicopter: appear at the arrival spot of the new place.
  const lastPlace = useRef(state.place);
  const flew = useRef(false);
  /** Cage Fight Dana paid, and this is the flight home: the fight is on as soon as he lands. */
  const fightDue = useRef(false);
  useEffect(() => {
    if (state.place === lastPlace.current) return;
    lastPlace.current = state.place;
    endIdle();
    // Natalie came too.
    sim.aide = aideAt(arrival(state));
    Object.assign(sim.pres, tileCenter(arrival(state)), { path: [] });
    targetRef.current = null;
    // Arriving by air, as opposed to a new game: watch it come in to land.
    if (flew.current) {
      flew.current = false;
      const heli = state.vehicle === 'heli';
      const pad = heli ? HELIPADS[state.place] : state.place === 'dc' ? 'plane' : 'mal-plane';
      sim.fade = 1;
      const fight = fightDue.current && state.place === 'dc';
      fightDue.current = false;
      // Off the craft and straight to ringside, around the top of the cage.
      const fightNight = () => {
        perform('Fight night', '🥊', FIGHT_SECONDS, () => {}, { anim: 'fight' });
        sim.pres.path = [...findPath(sim.pres, RINGSIDE_VIA), ...findPath(tileCenter(RINGSIDE_VIA), RINGSIDE)];
        targetRef.current = null;
      };
      perform('Landing', heli ? '🚁' : '✈️', FLIGHT_SECONDS, fight ? fightNight : () => {}, { anim: heli ? 'land-heli' : 'land-plane', objectId: pad });
      sim.activity!.flight = 'in';
    }
  }, [state.place, sim]);

  // Broadcasts that play before anything else can happen: the inauguration oath and election night.
  useEffect(() => {
    if (!state.broadcast || state.status !== 'playing') return;
    if (state.broadcast === 'inauguration') {
      perform('Inauguration Day', '📖', INAUGURATION_SECONDS, () => callbacks.current.onBroadcast(), {
        screen: { kind: 'address', ...INAUGURATION_ADDRESS },
      });
    } else if (state.broadcast === 'election') {
      perform('Election night', '🗳️', ELECTION_SECONDS, () => callbacks.current.onBroadcast(), { anim: 'election' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.broadcast, state.status]);

  // When the month's time runs out he walks to the nearest bed and sleeps.
  useEffect(() => {
    // Not while a notice is up: he waits for it to be read before turning in.
    bedtime.current = state.blocks === 0 && state.status === 'playing' && state.reveals.length === 0;
    if (!bedtime.current) return;
    const bed = BEDS[state.place];
    walkTo(bed.spot, { type: 'object', id: bed.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.blocks, state.month, state.place, state.status, state.reveals.length]);

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
    for (const n of sim.npcs) {
      if (n.leaving || n.place !== stateRef.current.place) continue;
      if (Math.abs(p.x - n.x) < 20 && p.y > n.y - 102 && p.y < n.y + 8) {
        return { target: { type: n.place === 'dc' ? 'npc' : 'guest', cardId: n.cardId }, key: n.key, tile: besideVisitor(n.spot) };
      }
    }
    // Smallest object first, so the phone wins over the carpet behind it.
    const candidates = OBJECTS.filter((o) => {
      if (o.inert || (o.place ?? 'dc') !== stateRef.current.place || !exists(o, stateRef.current)) return false;
      const r = hitRectPx(o);
      return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    }).sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h);
    const o = candidates[0];
    return o ? { target: { type: 'object', id: o.id }, key: o.id, tile: o.spot } : null;
  };

  const onAide = (p: Point): boolean => {
    const a = sim.aide;
    return !sim.activity?.flight && !aideAway(sim.activity) && Math.abs(p.x - a.x) < 20 && p.y > a.y - 70 && p.y < a.y + 8;
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = worldPoint(e);
    const found = hit(p);
    // Pointing at Natalie says who she is; clicking her opens her errands.
    const aide = !found && onAide(p);
    sim.hover = found?.key ?? (aide ? 'aide' : null);
    canvasRef.current!.style.cursor = found || aide ? 'pointer' : 'default';
  };

  const onPointerDown = (e: PointerEvent) => {
    // Nothing to redirect once he is busy or on his way to bed.
    if (sim.activity || bedtime.current) return;
    const p = worldPoint(e);
    const found = hit(p);
    if (found) walkTo(found.tile, found.target);
    else if (onAide(p)) {
      // She is already at his elbow: no walk, just ask.
      endIdle();
      sim.pres.path = [];
      targetRef.current = null;
      setMenu({ type: 'aide', ...toScreen({ x: sim.aide.x, y: sim.aide.y - 30 }) });
    } else walkTo(nearestFree(tileAt(p)), null);
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
    if (menu.type === 'aide') {
      const affordable = state.coin >= TUNING.lunchCost;
      const coke = cokeStatus(state);
      const sue = sueStatus(state);
      const post = vanityById('show-post');
      const postStatus = vanityStatus(state, post);
      body = (
        <>
          <h3 className="menu-title">Natalie Harp</h3>
          <p className="menu-note">"Anything, sir. Anything at all."</p>
          <button
            className={`vanity status-${postStatus}`}
            disabled={postStatus !== 'ok'}
            onClick={() =>
              perform(post.title, VANITY_EMOJI[post.id], watchTime(post.cost), () => callbacks.current.onVanity(post.id), { anim: post.id })
            }
          >
            <span className="vanity-main">
              <span className="vanity-title">{post.title}</span>
              <span className="vanity-text">{postStatus === 'no-time' ? 'Not enough time left this month.' : post.text}</span>
            </span>
            <span className="vanity-side">
              <Blocks n={post.cost} />
              <Fx effects={{ ego: vanityEgo(state, post), stability: post.stability }} />
            </span>
            {postStatus === 'no-time' && <Why>{needTime(post.cost, state.blocks)}</Why>}
          </button>
          <button
            className={`vanity status-${affordable ? 'ok' : 'no-time'}`}
            disabled={!affordable}
            onClick={() => {
              lastMeal.current = 'burger';
              perform('Lunch', '🍔', LUNCH_SECONDS, () => callbacks.current.onLunch('burger'), { anim: 'lunch' });
            }}
          >
            <span className="vanity-main">
              <span className="vanity-title">Send her for a McBurger</span>
              <span className="vanity-text">
                {affordable
                  ? 'Lunch, eaten at speed. Two all-beef patties, no questions.'
                  : 'You have no coin. Guests at Mar-a-Lago can help with that.'}
              </span>
            </span>
            <span className="vanity-side">
              <span className="chip bad">−{TUNING.lunchCost} Coin</span>
            </span>
            {!affordable && <Why>{needCoin(state)}</Why>}
          </button>
          <button
            className={`vanity status-${affordable ? 'ok' : 'no-time'}`}
            disabled={!affordable}
            onClick={() => {
              lastMeal.current = 'taco';
              perform('Lunch', '🌮', LUNCH_SECONDS, () => callbacks.current.onLunch('taco'), { anim: 'lunch' });
            }}
          >
            <span className="vanity-main">
              <span className="vanity-title">Send her to Taco Gong</span>
              <span className="vanity-text">
                {affordable
                  ? 'A sack of crunchy tacos, eaten at speed. Hold the lettuce, if they remember.'
                  : 'You have no coin. Guests at Mar-a-Lago can help with that.'}
              </span>
            </span>
            <span className="vanity-side">
              <span className="chip bad">−{TUNING.lunchCost} Coin</span>
            </span>
            {!affordable && <Why>{needCoin(state)}</Why>}
          </button>
          <button
            className={`vanity status-${coke === 'ok' ? 'ok' : 'no-time'}`}
            disabled={coke !== 'ok'}
            onClick={() => perform('Diet Coke', '🥤', COKE_SECONDS, () => callbacks.current.onCoke(), { anim: 'coke' })}
          >
            <span className="vanity-main">
              <span className="vanity-title">Press the Diet Coke button</span>
              <span className="vanity-text">
                {coke === 'ok'
                  ? 'One press, one can, on a silver tray. Buys back a time block.'
                  : coke === 'limit'
                    ? 'You have had this month\'s can. Doctor\'s orders.'
                    : coke === 'full'
                      ? 'You have not done anything yet this month. Save it.'
                      : `The button takes ${TUNING.cokeCost} coin. Guests at Mar-a-Lago can help with that.`}
              </span>
            </span>
            <span className="vanity-side">
              <span className="chip good">+{TUNING.cokeBlocks} Time</span>
              <span className="chip bad">−{TUNING.cokeCost} Coin</span>
            </span>
            {coke === 'limit' && <Why>The doctor set a limit on your Coke. Natalie wants you to live forever and won't let you have more.</Why>}
            {coke === 'full' && <Why>You have all your time left this month. The button only buys back time you have already spent.</Why>}
            {coke === 'no-coin' && <Why>{needCoin(state)}</Why>}
          </button>
          <button
            className={`vanity status-${sue === 'ok' ? 'ok' : 'no-time'}`}
            disabled={sue !== 'ok'}
            onClick={() => perform('Suing', '⚖️', SUE_SECONDS, () => callbacks.current.onSue(), { anim: 'sue' })}
          >
            <span className="vanity-main">
              <span className="vanity-title">Have her pull in the Lawyer</span>
              <span className="vanity-text">
                {sue === 'sued'
                  ? 'The Lawyer has filed his one for the month. He is billing for it now.'
                  : sue === 'no-coin'
                    ? `The Lawyer wants ${TUNING.sueCost} coin up front. Guests at Mar-a-Lago can help with that.`
                    : 'He will sue something. He does not know what yet either. No time, once a month.'}
              </span>
            </span>
            <span className="vanity-side">
              <Fx effects={TUNING.sueEffects} />
              <span className="chip bad">−{TUNING.sueCost} Coin</span>
            </span>
            {sue === 'sued' && <Why>The Lawyer files one suit a month, and this month's is filed. He will be back next month, with an invoice.</Why>}
            {sue === 'no-coin' && <Why>{needCoin(state)}</Why>}
          </button>
        </>
      );
    } else if (menu.type === 'guest') {
      const guest = guestById(menu.cardId);
      const affordable = TUNING.bribeCost <= state.blocks;
      body = (
        <article className="card kind-hybrid">
          <div className="card-head">
            <span className="kind">{guest.kind === 'ceo' ? 'Tech boss' : 'Media personality'}</span>
            <Blocks n={TUNING.bribeCost} />
          </div>
          <h3>{guest.title}</h3>
          <p>{guest.text}</p>
          <div className="options">
            <button
              className="option"
              disabled={!affordable}
              onClick={() =>
              {
                // Airtime was the ask: the interview plays on a tablet while the coin changes hands.
                const show = showOf(guest);
                perform(show ? 'On the air' : 'Taking the coin', show ? '🎙️' : '🪙', show ? INTERVIEW_SECONDS : watchTime(TUNING.bribeCost), () => callbacks.current.onBribe(guest.id), {
                  anim: 'duty-hybrid',
                  cardId: guest.id,
                  ...(show && { screen: { kind: show, host: guest.title } }),
                });
              }}
            >
              <span>Take the coin</span>
              <Fx effects={guest.effects} />
              {!affordable && <Why>{needTime(TUNING.bribeCost, state.blocks)}</Why>}
            </button>
            <button
              className="option"
              onClick={() => {
                setMenu(null);
                callbacks.current.onDecline(guest.id);
              }}
            >
              <span>Send them away (no time)</span>
              <Fx effects={{ ego: TUNING.declineEgo }} />
            </button>
          </div>
          {!affordable && <div className="ignore">Not enough time left this month.</div>}
          <div className="ignore">
            There is a {Math.round(leakChanceAt(state.month) * 100)}% chance somebody talks, and lips get looser every year. If the story runs, you lose {TUNING.leakTimes} times what
            the deal gave you.
          </div>
        </article>
      );
    } else if (menu.type === 'npc') {
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
                onClick={() => {
                  // The calendar's big days go out live: the tablet shows how he is handling it.
                  const address = addressFor(state, card, i);
                  perform(option.label, DUTY_EMOJI[card.kind], address ? INTERVIEW_SECONDS : watchTime(cost), () => callbacks.current.onDuty(card.id, i), {
                    anim: `duty-${card.kind}`,
                    cardId: card.id,
                    ...(address && { screen: { kind: 'address', ...address } }),
                  });
                }}
              >
                <span>{option.label}</span>
                <Fx effects={dutyEffects(state, card, i)} />
                {!affordable && <Why>{needTime(cost, state.blocks)}</Why>}
              </button>
            ))}
          </div>
          {!affordable && <div className="ignore">Not enough time left this month.</div>}
          {isSpeech(card) && (
            <div className="ignore">
              Applause: you have built, named or gilded {bragMaterial(state)} {bragMaterial(state) === 1 ? 'thing' : 'things'} to boast about. Going off script earns +
              {applauseEgo(state, card, 1)} Ego for it (1 for every {BRAGS_PER_EGO}, up to {BRAG_EGO_MAX}).
            </div>
          )}
          {domeShields(state, card) && <div className="ignore">The Golden Dome takes {TUNING.domeBlocks} time block off this one.</div>}
          {card.ignore.stability < 0 && <div className="ignore">If ignored: {card.ignore.stability} Stability</div>}
        </article>
      );
    } else {
      const object = OBJECTS.find((o) => o.id === menu.id)!;
      if (object.special === 'bed') {
        const waiting = state.inbox.filter((id) => cardById(id).kind !== 'hybrid').length;
        body = (
          <>
            <h3 className="menu-title">{object.name}</h3>
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
      } else if (object.special === 'melania') {
        const status = melaniaStatus(state);
        body = (
          <>
            <h3 className="menu-title">Melania</h3>
            <p className="menu-note">
              {heard && state.insult !== undefined
                ? `"${MELANIA_INSULTS[state.insult]}"`
                : state.melania
                  ? 'She is booked for your next rally, parade or building project. She would like you to leave now.'
                  : status === 'used'
                    ? 'She has made her one appearance for the year. She has not run out of things to say.'
                    : '"What do you want, Donald."'}
            </p>
            {status === 'used' ? (
              <button className="vanity status-ok" onClick={() => {
                setHeard(true);
                callbacks.current.onAbuse();
              }}>
                <span className="vanity-main">
                  <span className="vanity-title">Free abuse</span>
                  <span className="vanity-text">She has something to say to you. It costs nothing, and she has plenty.</span>
                </span>
                <span className="vanity-side">
                  <Blocks n={0} />
                </span>
              </button>
            ) : (
              <button
                className={`vanity status-${status === 'ok' ? 'ok' : 'no-time'}`}
                disabled={status !== 'ok'}
                onClick={() => perform('Begging', '🙏', BEG_SECONDS, () => callbacks.current.onMelania(), { anim: 'melania-ask', objectId: object.id })}
              >
                <span className="vanity-main">
                  <span className="vanity-title">Beg her to come to an event</span>
                  <span className="vanity-text">
                    {status === 'ok'
                      ? `She stands beside you at your next rally, parade or building project: +${TUNING.melaniaStability} Stability for that event. No time, once a year.`
                      : `She wants ${TUNING.melaniaCost} coin up front. Guests at Mar-a-Lago can help with that.`}
                  </span>
                </span>
                <span className="vanity-side">
                  <Fx effects={{ ego: TUNING.melaniaEgo }} />
                  <span className="chip bad">−{TUNING.melaniaCost} Coin</span>
                </span>
                {status === 'no-coin' && <Why>{needCoin(state)}</Why>}
              </button>
            )}
          </>
        );
      } else {
        body = (
          <>
            <h3 className="menu-title">{object.kind === 'plot' && !state.done[object.actions[0]] ? 'Construction Site' : objectName(object, state)}</h3>
            {object.actions.map((id) => {
              const action = vanityById(id);
              const status = vanityStatus(state, action);
              // The phone list has a different name on it every time.
              const title = action.id === 'show-call' ? `Call ${calleeAt(state.callee).who} and tell them off` : action.title;
              // Off the building lots, an option only appears once it is unlocked.
              if (status === 'locked' && (object.kind !== 'plot' || action.category !== 'build')) return null;
              const note =
                status === 'done'
                  ? `Done.${action.perk ? ` ${action.perk}` : ''}`
                  : status === 'locked'
                    ? 'Build the previous monument first.'
                    : status === 'no-time'
                      ? 'Not enough time left this month.'
                      : status === 'away'
                        ? 'You are not there.'
                        : status === 'no-ride'
                          ? action.vehicle === 'heli'
                            ? 'The helicopter is in Washington. You came by plane.'
                            : 'The plane is in Washington. You came by helicopter.'
                        : action.id === 'show-call'
                          ? calleeAt(state.callee).gripe
                          : `${action.text}${action.perk ? ` ${action.perk}` : ''}`;
              const where = { dc: 'in Washington', newyork: 'in New York', maralago: 'at Mar-a-Lago' }[action.place ?? 'dc'];
              const why =
                status === 'locked'
                  ? 'This lot is not ready. Build the previous monument first.'
                  : status === 'no-time'
                    ? needTime(action.cost, state.blocks)
                    : status === 'away'
                      ? `This can only be done ${where}. Fly there first.`
                      : status === 'no-ride'
                        ? `You fly home the way you came. ${note} Take the ${action.vehicle === 'heli' ? 'plane' : 'helicopter'}.`
                        : null;
              // Booked and paid for: she turns up at the next event that qualifies.
              const withHer = Boolean(state.melania) && melaniaAttends(action) && (status === 'ok' || status === 'no-time');
              return (
                <button
                  key={id}
                  className={`vanity status-${status}`}
                  disabled={status !== 'ok'}
                  onClick={() => {
                    const grouped = ['gild', 'build', 'rename'].includes(action.category);
                    perform(
                      title,
                      VANITY_EMOJI[action.id] ?? VANITY_EMOJI[action.category],
                      action.travelTo ? FLIGHT_SECONDS : watchTime(action.cost),
                      () => {
                        flew.current = Boolean(action.travelTo);
                        fightDue.current = action.travelTo === 'dc' && Boolean(stateRef.current.fight);
                        callbacks.current.onVanity(action.id);
                      },
                      { anim: grouped ? action.category : (ANIM[action.id] ?? action.id), objectId: object.id },
                    );
                    // The craft takes off, with him aboard, and the scene changes in the dark.
                    if (action.travelTo) sim.activity!.flight = 'out';
                  }}
                >
                  <span className="vanity-main">
                    <span className="vanity-title">{title}</span>
                    <span className="vanity-text">
                      {note}
                      {withHer && ' Melania will be at your side.'}
                      {bragsAboutPhysical(state, action) && status !== 'done' && ' You will open with the physical.'}
                    </span>
                  </span>
                  {status !== 'done' && (
                    <span className="vanity-side">
                      <Blocks n={action.cost} />
                      <Fx effects={{ ego: vanityEgo(state, action), stability: vanityStability(state, action), gold: action.gold, names: action.names }} />
                    </span>
                  )}
                  {why && <Why>{why}</Why>}
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

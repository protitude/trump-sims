import { BLOCKS_PER_MONTH, mood } from '../game/engine.ts';
import { vanityById } from '../game/content.ts';
import type { GuestKind } from '../game/guests.ts';
import type { DutyKind, GameState, Place } from '../game/types.ts';
import { OBJECTS, REGIONS, ROOMS, T, exists, isWall, objectName } from './map.ts';
import type { IdleKind, Point, Rect, Tile, WorldObject } from './map.ts';

// Everything on screen is drawn with canvas shapes; there are no image files.

export interface Actor {
  x: number;
  y: number;
  path: Point[];
  facing: 1 | -1;
  /** Seconds spent walking, drives the leg swing. */
  walk: number;
  /** Sitting down: drawn lower, with short legs. */
  seated?: boolean;
}

/** What the president gets up to when nobody tells him what to do. */
export interface Idle {
  kind: IdleKind;
  /** Still on his way to the seat. */
  walking: boolean;
  /** Seconds since the scene proper began. */
  t: number;
}

export interface Aide extends Actor {
  /**
   * What she is doing: trailing him, shut out of the Cabinet Room, taking
   * dictation at the desk, running after the golf cart, or at the bedside.
   */
  mode: 'follow' | 'barred' | 'dictate' | 'chase' | 'bedside';
  /** Seconds until she next works out where he has got to. */
  think: number;
  /** Which end of the corridor she is pacing toward, and whether she has started. */
  pace: 0 | 1;
  pacing: boolean;
}

export interface Npc extends Actor {
  key: string;
  cardId: string;
  kind: DutyKind | GuestKind;
  /** Where they are: a duty visitor in Washington, or a guest at the club. */
  place: Place;
  spot: Tile;
  leaving: boolean;
  angry: boolean;
}

export interface Activity {
  label: string;
  emoji: string;
  t: number;
  dur: number;
  sleep?: boolean;
  /** Tonight's affirmations, read out at the bedside. */
  lines?: string[];
  /** A flight: taking off from the object, or coming in to land on it. */
  flight?: 'out' | 'in';
  /** Which animation to play: an action id, a category, or "duty-<kind>". */
  anim?: string;
  /** The object being used, or the card being dealt with. */
  objectId?: string;
  cardId?: string;
  done: () => void;
}

export interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

export interface Sim {
  pres: Actor;
  npcs: Npc[];
  activity: Activity | null;
  idle: Idle | null;
  /** Natalie Harp, who is never more than a step behind him. */
  aide: Aide;
  floats: Float[];
  /** Object id or npc key under the pointer, or 'aide' for Natalie. */
  hover: string | null;
  time: number;
  /** 0..1 blackout used when sleeping. */
  fade: number;
  cam: { x: number; y: number; scale: number };
}

type Ctx = CanvasRenderingContext2D;

const GOLD_LIGHT = '#f8dc82';
const GOLD = '#e3b341';
const GOLD_DARK = '#a87c16';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const NPC_LOOK: Record<DutyKind | GuestKind, { suit: string; hair: string; icon: string }> = {
  ceo: { suit: '#2b2b33', hair: '#3a2c22', icon: '🪙' },
  media: { suit: '#b0413e', hair: '#d8c48a', icon: '🎙️' },
  briefing: { suit: '#56627a', hair: '#4a3728', icon: '📋' },
  decision: { suit: '#6b5a7d', hair: '#2b2118', icon: '❓' },
  press: { suit: '#2f8f83', hair: '#8a5a2b', icon: '🎤' },
  call: { suit: '#4d6fa8', hair: '#c9c2b5', icon: '📞' },
  crisis: { suit: '#5c6b3a', hair: '#8d8d8d', icon: '🚨' },
  hybrid: { suit: '#8a4fa3', hair: '#1f1a17', icon: '⭐' },
};

function px(r: Rect): Rect {
  return { x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T };
}

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function goldFill(c: Ctx, x: number, y: number, w: number, h: number): CanvasGradient {
  const g = c.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, GOLD_LIGHT);
  g.addColorStop(0.5, GOLD);
  g.addColorStop(1, GOLD_LIGHT);
  return g;
}

/** A furniture block seen from slightly above: a top face and a darker front. */
function box(c: Ctx, r: Rect, top: string | CanvasGradient, front: string, radius = 4): void {
  c.fillStyle = 'rgba(0,0,0,0.18)';
  rr(c, r.x + 2, r.y + 4, r.w, r.h, radius);
  c.fill();
  c.fillStyle = front;
  rr(c, r.x, r.y, r.w, r.h, radius);
  c.fill();
  c.fillStyle = top;
  rr(c, r.x, r.y, r.w, r.h - 7, radius);
  c.fill();
}

function sparkles(c: Ctx, r: Rect, time: number, seed: number): void {
  c.fillStyle = '#fffbe6';
  for (let i = 0; i < 3; i++) {
    const phase = time * 2 + seed + i * 2.1;
    const size = Math.max(0, Math.sin(phase)) * 3.5;
    if (size < 0.5) continue;
    const x = r.x + ((Math.sin(seed * 12.9 + i * 7.3) + 1) / 2) * r.w;
    const y = r.y + ((Math.cos(seed * 4.1 + i * 3.7) + 1) / 2) * r.h;
    c.beginPath();
    c.moveTo(x, y - size);
    c.lineTo(x + size * 0.3, y - size * 0.3);
    c.lineTo(x + size, y);
    c.lineTo(x + size * 0.3, y + size * 0.3);
    c.lineTo(x, y + size);
    c.lineTo(x - size * 0.3, y + size * 0.3);
    c.lineTo(x - size, y);
    c.lineTo(x - size * 0.3, y - size * 0.3);
    c.fill();
  }
}

function label(c: Ctx, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
  c.font = `700 ${size}px ${FONT}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(text, x, y);
}

// ---------- People ----------

interface Look {
  suit: string;
  skin: string;
  hair: string;
  tie?: string;
  swoosh?: boolean;
  /** Hair down to the shoulders. */
  long?: boolean;
}

function person(c: Ctx, a: Actor, look: Look, bob: number): void {
  const swing = a.path.length > 0 ? Math.sin(a.walk * 14) : 0;
  c.save();
  c.translate(a.x, a.y);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath();
  c.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.translate(0, -bob);
  c.scale(a.facing, 1);
  if (a.seated) c.translate(0, 6);

  const leg = a.seated ? 8 : 14;
  c.fillStyle = '#1b1f2e';
  c.fillRect(-7, -14, 6, leg - Math.max(0, swing) * 5);
  c.fillRect(1, -14, 6, leg - Math.max(0, -swing) * 5);

  c.fillStyle = look.suit;
  c.fillRect(-14, -38, 5, 17 + swing * 2);
  c.fillRect(9, -38, 5, 17 - swing * 2);
  rr(c, -11, -40, 22, 28, 6);
  c.fill();

  if (look.tie) {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(-5, -40);
    c.lineTo(5, -40);
    c.lineTo(0, -30);
    c.fill();
    c.fillStyle = look.tie;
    c.fillRect(-2, -38, 4, 23);
  }

  if (look.long) {
    c.fillStyle = look.hair;
    rr(c, -11, -54, 22, 20, 5);
    c.fill();
  }

  c.fillStyle = look.skin;
  c.beginPath();
  c.arc(0, -50, 10, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = look.hair;
  c.beginPath();
  c.arc(0, -52, 10.5, Math.PI, 0);
  c.fill();
  if (look.swoosh) {
    c.beginPath();
    c.ellipse(5, -60, 11, 5, -0.25, 0, Math.PI * 2);
    c.fill();
  }

  c.fillStyle = '#1b1f2e';
  c.fillRect(1, -50, 2, 3);
  c.fillRect(6, -50, 2, 3);
  c.restore();
}

function bubble(c: Ctx, x: number, y: number, emoji: string, fill = '#ffffff'): void {
  c.fillStyle = 'rgba(0,0,0,0.2)';
  rr(c, x - 15, y - 27, 32, 30, 9);
  c.fill();
  c.fillStyle = fill;
  rr(c, x - 16, y - 29, 32, 30, 9);
  c.fill();
  c.beginPath();
  c.moveTo(x - 5, y);
  c.lineTo(x, y + 7);
  c.lineTo(x + 5, y);
  c.fill();
  c.font = `17px ${EMOJI_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#000';
  c.fillText(emoji, x, y - 13);
}

// ---------- Monuments ----------

function arch(c: Ctx, cx: number, by: number, w: number, h: number, gilded: boolean): void {
  c.fillStyle = gilded ? goldFill(c, cx - w / 2, by - h, w, h) : '#e9dfc6';
  const pillar = w * 0.27;
  c.fillRect(cx - w / 2, by - h, pillar, h);
  c.fillRect(cx + w / 2 - pillar, by - h, pillar, h);
  c.fillRect(cx - w / 2, by - h, w, h * 0.34);
  c.beginPath();
  c.arc(cx, by - h * 0.66, w / 2 - pillar, Math.PI, 0);
  c.fill();
  c.fillStyle = gilded ? GOLD_DARK : '#b9ad8f';
  c.fillRect(cx - w / 2 - 4, by - h - 5, w + 8, 6);
  c.fillRect(cx - w / 2 - 3, by - 5, pillar + 6, 5);
  c.fillRect(cx + w / 2 - pillar - 3, by - 5, pillar + 6, 5);
  label(c, 'TRUMP', cx, by - h * 0.83, Math.max(9, w * 0.13), gilded ? '#5b4300' : GOLD_DARK);
}

function monument(c: Ctx, id: string, r: Rect, time: number): void {
  const cx = r.x + r.w / 2;
  const by = r.y + r.h - 4;
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(cx, by, r.w / 2, 9, 0, 0, Math.PI * 2);
  c.fill();

  if (id === 'build-arch') arch(c, cx, by, 96, 100, false);
  if (id === 'build-ballroom') {
    c.fillStyle = '#efe7d2';
    c.fillRect(cx - 66, by - 62, 132, 62);
    c.fillStyle = goldFill(c, cx - 72, by - 90, 144, 30);
    c.beginPath();
    c.moveTo(cx - 74, by - 62);
    c.lineTo(cx, by - 92);
    c.lineTo(cx + 74, by - 62);
    c.fill();
    c.fillStyle = '#cfc4a6';
    for (let i = 0; i < 6; i++) c.fillRect(cx - 60 + i * 23, by - 58, 7, 58);
    c.fillStyle = GOLD;
    c.fillRect(cx - 9, by - 30, 18, 30);
    label(c, 'BALLROOM', cx, by - 70, 9, '#5b4300');
  }
  if (id === 'build-statue') {
    c.fillStyle = '#9aa0ad';
    c.fillRect(cx - 20, by - 34, 40, 34);
    c.fillStyle = '#7d8391';
    c.fillRect(cx - 24, by - 38, 48, 6);
    c.fillStyle = goldFill(c, cx - 20, by - 120, 40, 90);
    rr(c, cx - 13, by - 96, 26, 58, 6);
    c.fill();
    c.beginPath();
    c.arc(cx, by - 106, 11, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(cx + 5, by - 117, 12, 5, -0.25, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(cx - 10, by - 88);
    c.rotate(-0.5);
    c.fillRect(-34, -4, 34, 8);
    c.restore();
  }
  if (id === 'build-mountain') {
    c.fillStyle = '#8d8f99';
    c.beginPath();
    c.moveTo(cx - 76, by);
    c.lineTo(cx - 34, by - 96);
    c.lineTo(cx - 8, by - 70);
    c.lineTo(cx + 22, by - 132);
    c.lineTo(cx + 78, by);
    c.fill();
    c.fillStyle = '#a9abb5';
    c.beginPath();
    c.arc(cx + 14, by - 64, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#74767f';
    c.fillRect(cx + 8, by - 68, 5, 5);
    c.fillRect(cx + 24, by - 68, 5, 5);
    c.fillRect(cx + 12, by - 50, 14, 3);
    c.fillStyle = GOLD;
    c.beginPath();
    c.ellipse(cx + 20, by - 92, 32, 12, -0.2, 0, Math.PI * 2);
    c.fill();
  }
  if (id === 'build-giftshop') {
    c.fillStyle = '#f3ead6';
    c.fillRect(cx - 60, by - 52, 120, 52);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#ffffff' : '#d9282f';
      c.fillRect(cx - 66 + i * 22, by - 66, 22, 18);
    }
    c.fillStyle = '#9bd0e8';
    c.fillRect(cx - 50, by - 38, 34, 24);
    c.fillRect(cx + 16, by - 38, 34, 24);
    c.fillStyle = GOLD;
    c.fillRect(cx - 9, by - 34, 18, 34);
    c.fillRect(cx - 40, by - 30, 6, 10);
    c.fillRect(cx - 30, by - 32, 6, 12);
    c.fillRect(cx + 28, by - 30, 6, 10);
    label(c, 'GIFTS', cx, by - 76, 10, '#fff4c2');
  }
  if (id === 'build-dome') {
    c.fillStyle = goldFill(c, cx - 68, by - 78, 136, 78);
    c.beginPath();
    c.ellipse(cx, by - 12, 68, 66, 0, Math.PI, 0);
    c.fill();
    c.fillRect(cx - 70, by - 14, 140, 14);
    c.strokeStyle = GOLD_DARK;
    c.lineWidth = 1.5;
    for (const k of [0.35, 0.7]) {
      c.beginPath();
      c.ellipse(cx, by - 12, 68 * k, 66, 0, Math.PI, 0);
      c.stroke();
    }
    c.fillStyle = GOLD_DARK;
    c.fillRect(cx - 2, by - 96, 4, 20);
  }
  if (id === 'build-space-arch') {
    c.strokeStyle = goldFill(c, cx - 80, by - 170, 160, 170);
    c.lineWidth = 22;
    c.lineCap = 'butt';
    c.beginPath();
    c.moveTo(cx - 64, by);
    c.lineTo(cx - 64, by - 96);
    c.arc(cx, by - 96, 64, Math.PI, 0);
    c.lineTo(cx + 64, by);
    c.stroke();
    label(c, 'T R U M P', cx, by - 160, 11, '#5b4300');
  }
  sparkles(c, { x: r.x, y: r.y - 80, w: r.w, h: r.h + 70 }, time, r.x);
}

// ---------- Furniture and lawn objects ----------

function landingPad(c: Ctx, cx: number, cy: number, radius: number): void {
  c.strokeStyle = '#ffffff';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.stroke();
  label(c, 'H', cx, cy + 2, 40, 'rgba(255,255,255,0.9)');
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** How far through leaving the ground the craft at this object is: 0 parked, 1 gone. */
function airborne(o: WorldObject): { k: number; side: number } | null {
  const act = currentAct;
  if (!act?.flight || act.objectId !== o.id) return null;
  const u = clamp01(act.t / act.dur);
  // Departures leave to the left; arrivals come in from the right and play backwards.
  return act.flight === 'out' ? { k: u, side: -1 } : { k: 1 - u, side: 1 };
}

/** Seen from above, nose to the left. It lifts straight up, then leans away. */
function helicopter(c: Ctx, cx: number, cy: number, gilded: boolean, time: number, air: { k: number; side: number } | null = null): void {
  const lift = air ? clamp01(air.k / 0.5) : 0;
  const away = air ? clamp01((air.k - 0.35) / 0.65) : 0;
  const dx = air ? air.side * away * away * 900 : 0;
  const bx = cx - 8;
  c.fillStyle = `rgba(0,0,0,${0.2 - lift * 0.11})`;
  c.beginPath();
  c.ellipse(bx + 6 + dx, cy + 10 + lift * 34, 36 * (1 - lift * 0.25), 16 * (1 - lift * 0.25), 0, 0, Math.PI * 2);
  c.fill();
  if (air && lift > 0 && lift < 1) {
    // Rotor wash on the pad while it is close to the ground.
    c.strokeStyle = `rgba(255,255,255,${0.35 * (1 - lift)})`;
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ring = 30 + ((time * 60 + i * 22) % 66);
      c.beginPath();
      c.ellipse(bx + dx, cy + 8, ring, ring * 0.45, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.save();
  if (air) {
    const size = 1 + lift * 0.4;
    c.translate(cx + dx, cy - lift * 90 + Math.sin(time * 9) * 2 * lift);
    c.rotate(air.side * away * 0.12);
    c.scale(size, size);
    c.translate(-cx, -cy);
  }
  // Tail boom, fin and tail rotor.
  c.fillStyle = gilded ? GOLD_DARK : '#2f4a2c';
  c.fillRect(bx + 20, cy - 3, 36, 6);
  c.fillRect(bx + 52, cy - 11, 5, 22);
  // Cabin: green below, white on top, like the real one. Or gold.
  c.fillStyle = gilded ? goldFill(c, bx - 30, cy - 15, 60, 30) : '#3d5a3a';
  c.beginPath();
  c.ellipse(bx, cy, 30, 15, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = gilded ? GOLD_LIGHT : '#f4f6fa';
  c.beginPath();
  c.ellipse(bx + 2, cy, 19, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = gilded ? '#fff4c2' : '#9db5dd';
  c.beginPath();
  c.ellipse(bx - 21, cy, 6, 9, 0, 0, Math.PI * 2);
  c.fill();
  // Main rotor.
  const flying = currentAct?.anim?.includes('heli') ?? false;
  const spin = time * (flying ? 26 : 1.2);
  c.strokeStyle = gilded ? GOLD_DARK : '#22252d';
  c.lineWidth = 4;
  c.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const a = spin + (i * Math.PI) / 2;
    c.beginPath();
    c.moveTo(bx - Math.cos(a) * 42, cy - Math.sin(a) * 42);
    c.lineTo(bx + Math.cos(a) * 42, cy + Math.sin(a) * 42);
    c.stroke();
  }
  c.lineCap = 'butt';
  c.fillStyle = gilded ? GOLD : '#22252d';
  c.beginPath();
  c.arc(bx, cy, 4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** The activity in progress, shared with drawObject while a frame is drawn. */
let currentAct: Activity | null = null;

function drawObject(c: Ctx, o: WorldObject, s: GameState, time: number, hovered: boolean): void {
  const r = px(o.rect);
  const did = (id: string) => Boolean(s.done[id]);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let gilded = false;

  switch (o.kind) {
    case 'bed': {
      box(c, r, '#f4efe2', '#8a6a3b', 8);
      c.fillStyle = goldFill(c, r.x, r.y + 30, r.w, r.h);
      rr(c, r.x + 3, r.y + 32, r.w - 6, r.h - 44, 6);
      c.fill();
      c.fillStyle = '#ffffff';
      rr(c, r.x + 12, r.y + 7, r.w - 24, 20, 6);
      c.fill();
      break;
    }
    case 'toilet': {
      gilded = did('gild-toilet');
      const top = gilded ? goldFill(c, r.x, r.y, r.w, r.h) : '#f7f7f4';
      box(c, { x: r.x + 6, y: r.y, w: r.w - 12, h: 16 }, top, gilded ? GOLD_DARK : '#c9c9c4', 3);
      c.fillStyle = gilded ? GOLD_DARK : '#c9c9c4';
      c.beginPath();
      c.ellipse(cx, r.y + 27, 13, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = top;
      c.beginPath();
      c.ellipse(cx, r.y + 25, 13, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = gilded ? '#c8961f' : '#dfe9ee';
      c.beginPath();
      c.ellipse(cx, r.y + 26, 7, 7, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'fireplace': {
      gilded = did('gild-fireplace');
      box(c, r, gilded ? goldFill(c, r.x, r.y, r.w, r.h) : '#ded6c4', gilded ? GOLD_DARK : '#a39a86', 3);
      c.fillStyle = '#231a16';
      rr(c, cx - 20, r.y + 10, 40, r.h - 12, 4);
      c.fill();
      if (!gilded) {
        c.fillStyle = '#ff8a2b';
        c.beginPath();
        c.ellipse(cx, r.y + r.h - 8, 9, 9 + Math.sin(time * 9) * 2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.ellipse(cx, r.y + r.h - 6, 4, 5 + Math.sin(time * 13) * 1.5, 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'desk': {
      gilded = did('gild-desk');
      box(c, r, gilded ? goldFill(c, r.x, r.y, r.w, r.h) : '#7a4a2a', gilded ? GOLD_DARK : '#54311b', 5);
      c.fillStyle = '#fbf8ee';
      c.fillRect(r.x + 14, r.y + 12, 20, 26);
      c.fillRect(r.x + 40, r.y + 16, 20, 24);
      // The soda button.
      const button = did('gild-soda-button');
      c.fillStyle = '#2a2a2a';
      rr(c, r.x + r.w - 34, r.y + 14, 22, 22, 4);
      c.fill();
      c.fillStyle = button ? GOLD_LIGHT : '#e0312f';
      c.beginPath();
      c.arc(r.x + r.w - 23, r.y + 25, 7, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'phone': {
      gilded = did('gild-phone');
      box(c, r, '#8a5a34', '#5e3b20', 4);
      c.fillStyle = gilded ? goldFill(c, r.x, r.y, r.w, r.h) : '#d9282f';
      rr(c, r.x + 7, r.y + 8, r.w - 14, 16, 4);
      c.fill();
      rr(c, r.x + 4, r.y + 5, r.w - 8, 7, 3);
      c.fill();
      break;
    }
    case 'portraits': {
      gilded = did('gild-portraits');
      for (let i = 0; i < 5; i++) {
        const big = i === 2;
        const w = big ? 26 : 16;
        const h = big ? 20 : 15;
        const x = r.x + 12 + i * 22 - (big ? 5 : 0) + (i > 2 ? 10 : 0);
        const y = r.y + (T - h) / 2 - (big ? 1 : 0);
        c.fillStyle = gilded ? GOLD : '#6a4a2a';
        c.fillRect(x - (gilded ? 3 : 2), y - (gilded ? 3 : 2), w + (gilded ? 6 : 4), h + (gilded ? 6 : 4));
        c.fillStyle = '#39445f';
        c.fillRect(x, y, w, h);
        c.fillStyle = '#e8b98f';
        c.beginPath();
        c.arc(x + w / 2, y + h / 2 + 1, big ? 6 : 4, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = big ? '#f2c230' : '#8f8f8f';
        c.fillRect(x + w / 2 - (big ? 7 : 4), y + h / 2 - (big ? 8 : 5), big ? 15 : 8, big ? 4 : 3);
      }
      break;
    }
    case 'carpet': {
      gilded = did('gild-carpet');
      c.fillStyle = gilded ? goldFill(c, r.x, r.y, r.w, r.h) : '#2f4f8f';
      c.beginPath();
      c.ellipse(cx, cy, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = gilded ? '#fff4c2' : GOLD;
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(cx, cy, r.w / 2 - 10, r.h / 2 - 10, 0, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(cx, cy, 22, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case 'bigmap': {
      box(c, r, '#e9e2cf', '#6a4a2a', 3);
      c.fillStyle = '#7fb4d9';
      c.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 15);
      c.fillStyle = '#6fae6a';
      c.beginPath();
      c.ellipse(r.x + 15, r.y + 22, 8, 12, 0.3, 0, Math.PI * 2);
      c.ellipse(r.x + 25, r.y + 50, 9, 11, -0.4, 0, Math.PI * 2);
      c.fill();
      // One gold pin for everything named after you.
      c.fillStyle = GOLD_LIGHT;
      for (let i = 0; i < Math.min(s.names, 12); i++) {
        c.beginPath();
        c.arc(r.x + 9 + (i % 3) * 11, r.y + 11 + Math.floor(i / 3) * 14, 3, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'table': {
      c.fillStyle = '#3b2616';
      for (let i = 0; i < 4; i++) {
        rr(c, r.x + 16 + i * 36, r.y - 10, 20, 14, 4);
        c.fill();
        rr(c, r.x + 16 + i * 36, r.y + r.h - 6, 20, 14, 4);
        c.fill();
      }
      box(c, r, '#6b4226', '#472a16', 24);
      break;
    }
    case 'constitution': {
      gilded = did('gild-constitution');
      box(c, r, gilded ? goldFill(c, r.x, r.y, r.w, r.h) : '#5a6274', gilded ? GOLD_DARK : '#3d4352', 3);
      c.fillStyle = '#efe2b8';
      c.fillRect(r.x + 8, r.y + 6, r.w - 16, r.h - 20);
      c.fillStyle = '#8b7a4a';
      for (let i = 0; i < 3; i++) c.fillRect(r.x + 11, r.y + 10 + i * 5, r.w - 22, 1.5);
      break;
    }
    case 'podium': {
      box(c, r, '#2b4a86', '#1b3160', 3);
      c.strokeStyle = GOLD;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx, cy - 2, 9, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case 'garden': {
      gilded = did('gild-garden');
      if (gilded) {
        c.fillStyle = goldFill(c, r.x, r.y, r.w, r.h);
        rr(c, r.x, r.y, r.w, r.h, 6);
        c.fill();
        c.strokeStyle = GOLD_DARK;
        c.lineWidth = 1;
        for (let x = r.x + 20; x < r.x + r.w; x += 20) {
          c.beginPath();
          c.moveTo(x, r.y);
          c.lineTo(x, r.y + r.h);
          c.stroke();
        }
        for (let y = r.y + 20; y < r.y + r.h; y += 20) {
          c.beginPath();
          c.moveTo(r.x, y);
          c.lineTo(r.x + r.w, y);
          c.stroke();
        }
        if (did('build-helipad')) {
          landingPad(c, cx, cy, 44);
          helicopter(c, cx, cy, did('gild-helicopter'), time, airborne(o));
        }
      } else {
        c.fillStyle = '#2f6a3a';
        rr(c, r.x, r.y, r.w, r.h, 10);
        c.fill();
        for (let i = 0; i < 24; i++) {
          const x = r.x + 14 + (i % 8) * 21 + (Math.floor(i / 8) % 2) * 8;
          const y = r.y + 18 + Math.floor(i / 8) * 30;
          c.fillStyle = '#3f8a4c';
          c.beginPath();
          c.arc(x, y, 9, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = i % 3 === 0 ? '#ff9bb0' : '#e23b55';
          c.beginPath();
          c.arc(x - 2, y - 2, 3.5, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case 'golf': {
      c.fillStyle = '#6fc46e';
      c.beginPath();
      c.ellipse(cx, cy, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#e8d9a0';
      c.beginPath();
      c.ellipse(r.x + 44, r.y + r.h - 34, 22, 12, 0.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#1e3b22';
      c.beginPath();
      c.ellipse(cx + 50, cy - 8, 5, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f2f2f2';
      c.fillRect(cx + 49, cy - 46, 2, 38);
      c.fillStyle = '#d9282f';
      c.beginPath();
      c.moveTo(cx + 51, cy - 46);
      c.lineTo(cx + 69, cy - 39);
      c.lineTo(cx + 51, cy - 32);
      c.fill();
      break;
    }
    case 'stage': {
      box(c, r, '#3b4f8f', '#b3282d', 4);
      c.fillStyle = '#ffffff';
      for (let x = r.x + 8; x < r.x + r.w - 8; x += 22) {
        c.beginPath();
        c.arc(x + 6, r.y + r.h - 4, 6, 0, Math.PI);
        c.fill();
      }
      c.fillStyle = '#1b2748';
      c.fillRect(cx - 9, r.y + 14, 18, 24);
      label(c, 'RALLY', cx, r.y + 56, 11, '#ffffff');
      break;
    }
    case 'stand': {
      box(c, r, '#e9e2d0', '#8d8674', 3);
      for (let i = 0; i < 7; i++) {
        c.fillStyle = ['#b3282d', '#ffffff', '#3b4f8f'][i % 3];
        c.beginPath();
        c.arc(r.x + 10 + i * 20, r.y + r.h - 7, 9, 0, Math.PI);
        c.fill();
      }
      label(c, 'PARADE', cx, r.y + 20, 11, '#5a5546');
      break;
    }
    case 'helipad': {
      c.fillStyle = '#6a6d76';
      rr(c, r.x, r.y, r.w, r.h, 10);
      c.fill();
      landingPad(c, cx, cy, 44);
      // The helicopter is only here if it brought you.
      if (s.vehicle === 'heli') {
        gilded = did('gild-helicopter');
        helicopter(c, cx, cy, gilded, time, airborne(o));
      }
      break;
    }
    case 'plane': {
      // An empty runway at Mar-a-Lago if the helicopter brought you.
      if (o.place === 'maralago' && s.vehicle === 'heli') break;
      gilded = did('gild-plane');
      const body = gilded ? goldFill(c, r.x, r.y, r.w, r.h) : '#f4f6fa';
      // In flight it rolls down the lawn, then climbs: bigger, higher, shadow left behind.
      const air = airborne(o);
      const roll = air ? air.side * air.k * air.k * 1500 : 0;
      const climb = air ? clamp01((air.k - 0.35) / 0.65) : 0;
      c.fillStyle = `rgba(0,0,0,${0.2 - climb * 0.12})`;
      c.beginPath();
      c.ellipse(cx + 4 + roll, cy + 10 + climb * 50, (r.w / 2) * (1 - climb * 0.3), 20 * (1 - climb * 0.3), 0, 0, Math.PI * 2);
      c.fill();
      c.save();
      if (air) {
        const size = 1 + climb * 0.45;
        c.translate(cx + roll, cy - climb * 130);
        c.rotate(air.side * -climb * 0.07);
        c.scale(size, size);
        c.translate(-cx, -cy);
        // Engine streaks trailing off the tail.
        c.strokeStyle = `rgba(255,255,255,${0.5 * Math.min(1, air.k * 4)})`;
        c.lineWidth = 3;
        for (const dy of [-26, 26]) {
          const len = 40 + air.k * 160 + Math.sin(time * 30 + dy) * 10;
          c.beginPath();
          c.moveTo(cx + 50, cy + dy);
          c.lineTo(cx + 50 + len, cy + dy);
          c.stroke();
        }
      }
      c.fillStyle = gilded ? GOLD : '#c8ced9';
      c.beginPath();
      c.moveTo(cx - 20, cy);
      c.lineTo(cx + 40, r.y);
      c.lineTo(cx + 66, r.y);
      c.lineTo(cx + 30, cy);
      c.lineTo(cx + 66, r.y + r.h);
      c.lineTo(cx + 40, r.y + r.h);
      c.fill();
      c.beginPath();
      c.moveTo(r.x + r.w - 40, cy);
      c.lineTo(r.x + r.w - 6, cy - 34);
      c.lineTo(r.x + r.w + 4, cy - 34);
      c.lineTo(r.x + r.w - 8, cy);
      c.lineTo(r.x + r.w + 4, cy + 34);
      c.lineTo(r.x + r.w - 6, cy + 34);
      c.fill();
      c.fillStyle = body;
      rr(c, r.x, cy - 19, r.w, 38, 19);
      c.fill();
      c.fillStyle = gilded ? GOLD_DARK : '#2b4a86';
      rr(c, r.x + 4, cy - 2, r.w - 8, 14, 7);
      c.fill();
      c.fillStyle = gilded ? '#fff4c2' : '#9db5dd';
      for (let i = 0; i < 9; i++) c.fillRect(r.x + 44 + i * 22, cy - 10, 8, 5);
      label(c, 'TRUMP FORCE ONE', cx + 10, cy + 5, 9, gilded ? '#fff4c2' : '#ffffff');
      c.restore();
      break;
    }
    case 'malballroom': {
      gilded = did('gild-mal-ballroom');
      box(c, r, goldFill(c, r.x, r.y, r.w, r.h), GOLD_DARK, 3);
      c.fillStyle = gilded ? '#fff4c2' : '#7a4a2a';
      c.fillRect(cx - 22, r.y + 6, 20, r.h - 16);
      c.fillRect(cx + 2, r.y + 6, 20, r.h - 16);
      label(c, 'BALLROOM', cx, r.y - 8, 9, '#7a3b2a');
      break;
    }
    case 'dj': {
      box(c, r, '#2b2b33', '#16161b', 4);
      c.fillStyle = '#9bd0e8';
      rr(c, cx - 14, r.y + 7, 28, 18, 3);
      c.fill();
      c.fillStyle = '#2b2b33';
      for (let i = 0; i < 4; i++) c.fillRect(cx - 10 + i * 6, r.y + 20 - (2 + ((i * 5 + Math.floor(time * 6)) % 4) * 3), 3, 2 + ((i * 5 + Math.floor(time * 6)) % 4) * 3);
      break;
    }
    case 'patio': {
      c.fillStyle = '#6a4a2a';
      for (let i = 0; i < 3; i++) {
        rr(c, r.x + 14 + i * 44, r.y - 10, 22, 14, 4);
        c.fill();
      }
      box(c, r, '#ffffff', '#cfcfcf', 8);
      c.fillStyle = GOLD;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(r.x + 25 + i * 44, r.y + 22, 9, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#8a4a2a';
      c.beginPath();
      c.ellipse(cx, r.y + 22, 6, 4, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'memberdesk': {
      box(c, r, '#7a4a2a', '#54311b', 4);
      c.fillStyle = GOLD_LIGHT;
      c.fillRect(r.x + 8, r.y + 8, 22, 14);
      c.fillStyle = '#ffffff';
      c.fillRect(r.x + 40, r.y + 6, 26, 18);
      label(c, 'JOIN', r.x + 53, r.y + 15, 8, '#2a1e00');
      break;
    }
    case 'pool': {
      c.fillStyle = '#f3ead6';
      rr(c, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 26);
      c.fill();
      c.fillStyle = '#3fb6d8';
      rr(c, r.x, r.y, r.w, r.h, 22);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const y = r.y + 26 + i * 28;
        c.beginPath();
        c.moveTo(r.x + 24, y + Math.sin(time * 2 + i) * 3);
        c.quadraticCurveTo(cx, y - 8 + Math.sin(time * 2 + i) * 3, r.x + r.w - 24, y + Math.sin(time * 2 + i) * 3);
        c.stroke();
      }
      break;
    }
    case 'malgolf': {
      c.fillStyle = '#5fbf63';
      rr(c, r.x, r.y, r.w, r.h, 70);
      c.fill();
      c.fillStyle = '#7ad67c';
      c.beginPath();
      c.ellipse(r.x + r.w - 80, cy, 60, 44, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#efdfa6';
      c.beginPath();
      c.ellipse(r.x + 70, cy + 30, 34, 16, 0.3, 0, Math.PI * 2);
      c.ellipse(r.x + 150, cy - 44, 26, 12, -0.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#1e3b22';
      c.beginPath();
      c.ellipse(r.x + r.w - 70, cy, 5, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f2f2f2';
      c.fillRect(r.x + r.w - 71, cy - 40, 2, 40);
      c.fillStyle = GOLD;
      c.beginPath();
      c.moveTo(r.x + r.w - 69, cy - 40);
      c.lineTo(r.x + r.w - 49, cy - 33);
      c.lineTo(r.x + r.w - 69, cy - 26);
      c.fill();
      break;
    }
    case 'plot': {
      const action = o.actions[0];
      if (did(action)) {
        monument(c, action, r, time);
        break;
      }
      if (currentAct?.anim === 'build' && currentAct.objectId === o.id) {
        // Under construction: the finished monument rises out of the lot.
        const k = Math.min(1, currentAct.t / currentAct.dur);
        const base = r.y + r.h;
        const top = base - 190 * k;
        c.fillStyle = '#9a7b52';
        rr(c, r.x, r.y, r.w, r.h, 4);
        c.fill();
        c.save();
        c.beginPath();
        c.rect(r.x - 80, top, r.w + 160, base - top + 4);
        c.clip();
        monument(c, action, r, time);
        c.restore();
        c.strokeStyle = '#8a6a3b';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(r.x - 6, base);
        c.lineTo(r.x - 6, top - 8);
        c.moveTo(r.x + r.w + 6, base);
        c.lineTo(r.x + r.w + 6, top - 8);
        c.moveTo(r.x - 12, top - 4);
        c.lineTo(r.x + r.w + 12, top - 4);
        c.stroke();
        c.fillStyle = '#e6dcc8';
        for (let i = 0; i < 5; i++) {
          const puff = (time * 1.5 + i * 0.2) % 1;
          c.globalAlpha = (1 - puff) * 0.7;
          c.beginPath();
          c.arc(r.x + (i + 0.5) * (r.w / 5), base - 4 - puff * 14, 5 + puff * 7, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
        break;
      }
      const needs = vanityById(action).requires;
      const unlocked = !needs || did(needs);
      c.fillStyle = unlocked ? '#9a7b52' : 'rgba(0,0,0,0.10)';
      rr(c, r.x, r.y, r.w, r.h, 4);
      c.fill();
      c.strokeStyle = unlocked ? '#f2c230' : 'rgba(255,255,255,0.35)';
      c.lineWidth = 2;
      c.setLineDash(unlocked ? [10, 6] : [4, 6]);
      c.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      c.setLineDash([]);
      if (unlocked) {
        c.fillStyle = '#ffffff';
        rr(c, cx - 46, cy - 20, 92, 32, 3);
        c.fill();
        c.fillStyle = '#6a4a2a';
        c.fillRect(cx - 2, cy + 12, 4, 16);
        label(c, 'FUTURE SITE OF', cx, cy - 11, 8, '#8a6a14');
        label(c, o.name.replace(/^(The|A|Your) /, '').slice(0, 17).toUpperCase(), cx, cy + 2, 8, '#2a1e00');
      } else {
        label(c, 'LOCKED', cx, cy, 9, 'rgba(255,255,255,0.5)');
      }
      break;
    }
  }

  if (gilded) sparkles(c, r, time, r.x * 0.37 + r.y);

  if (hovered) {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.setLineDash([6, 4]);
    rr(c, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6);
    c.stroke();
    c.setLineDash([]);
  }
}

// ---------- Activity animations ----------

/** A small spectator: used for rally crowds and club members. */
function fan(c: Ctx, x: number, y: number, bob: number, shirt: string, cap: string | null): void {
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = shirt;
  rr(c, x - 6, y - 17 - bob, 12, 15, 3);
  c.fill();
  c.fillStyle = '#e9c09a';
  c.beginPath();
  c.arc(x, y - 22 - bob, 5.5, 0, Math.PI * 2);
  c.fill();
  if (cap) {
    c.fillStyle = cap;
    c.beginPath();
    c.arc(x, y - 24 - bob, 5.8, Math.PI, 0);
    c.fill();
    c.fillRect(x, y - 25 - bob, 8, 2);
  }
}

function tank(c: Ctx, x: number, y: number): void {
  c.fillStyle = '#2b2f22';
  rr(c, x - 30, y - 6, 60, 14, 7);
  c.fill();
  c.fillStyle = '#5c6b3a';
  rr(c, x - 26, y - 20, 52, 16, 4);
  c.fill();
  c.fillStyle = '#6f7f48';
  rr(c, x - 12, y - 30, 26, 13, 4);
  c.fill();
  c.fillRect(x + 12, y - 26, 30, 4);
  c.fillStyle = '#d9282f';
  c.fillRect(x - 22, y - 44, 2, 16);
  c.fillRect(x - 20, y - 44, 12, 8);
}

function risingText(c: Ctx, text: string, x: number, y: number, age: number, life: number, size: number, color: string): void {
  if (age < 0 || age > life) return;
  c.globalAlpha = 1 - age / life;
  c.font = `800 ${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(10,15,31,0.85)';
  c.strokeText(text, x, y - age * 36);
  c.fillStyle = color;
  c.fillText(text, x, y - age * 36);
  c.globalAlpha = 1;
}

/** Like risingText, but drifts off to the right: for speech with no headroom above it. */
function driftingText(c: Ctx, text: string, x: number, y: number, age: number, life: number, size: number, color: string): void {
  if (age < 0 || age > life) return;
  c.globalAlpha = 1 - (age / life) ** 2;
  c.font = `800 ${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(10,15,31,0.85)';
  c.strokeText(text, x + age * 34, y);
  c.fillStyle = color;
  c.fillText(text, x + age * 34, y);
  c.globalAlpha = 1;
}

function emojiAt(c: Ctx, emoji: string, x: number, y: number, size: number, alpha = 1): void {
  c.globalAlpha = Math.max(0, alpha);
  c.font = `${size}px ${EMOJI_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#000';
  c.fillText(emoji, x, y);
  c.globalAlpha = 1;
}

const POSTS = ['SAD!', 'WITCH HUNT', 'TREMENDOUS', 'FAKE!', 'WINNING!!!', 'MANY PEOPLE'];
const CROWD_SHIRTS = ['#b3282d', '#3b4f8f', '#e9e2d0', '#56627a'];

/** Bedtime: a short settle, then one affirmation after another. */
const AFFIRM_START = 0.2;
const AFFIRM_EVERY = 3.5;

/** A speech balloon with wrapped text, its tail pointing down at (x, y). */
function speech(c: Ctx, text: string, x: number, y: number, alpha: number): void {
  if (alpha <= 0) return;
  c.font = `700 11px ${FONT}`;
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word;
    if (line && c.measureText(longer).width > 150) {
      lines.push(line);
      line = word;
    } else line = longer;
  }
  lines.push(line);
  const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 18;
  const h = lines.length * 14 + 10;
  c.globalAlpha = alpha;
  c.fillStyle = '#fff6fb';
  rr(c, x - w / 2, y - h, w, h, 8);
  c.fill();
  c.beginPath();
  c.moveTo(x - 6, y - 1);
  c.lineTo(x - 2, y + 8);
  c.lineTo(x + 5, y - 1);
  c.fill();
  c.fillStyle = '#3a2233';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  lines.forEach((l, i) => c.fillText(l, x, y - h + 12 + i * 14));
  c.globalAlpha = 1;
}

const SOBS = ['*sob*', 'SIR?', '*sniff*', 'HE NEEDS ME', '*sob*', 'IS IT OVER YET?', 'I HAVE HIS PRINTOUTS', '*wail*'];
const CHASE = ['WAIT FOR ME, SIR!', 'SIR! SIR!', 'YOUR PRINTOUTS, SIR!', 'SO FAST, SIR!', 'COMING, SIR!'];
const JOYRIDE = ['BEST DRIVER', 'VROOM', 'NO SPEED LIMIT', 'KEEP UP, NATALIE', 'TREMENDOUS HANDLING'];

/** The golf cart, drawn in two passes so that he sits inside it. */
function golfCart(c: Ctx, x: number, y: number, facing: 1 | -1, time: number, front: boolean): void {
  c.save();
  c.translate(x, y - Math.abs(Math.sin(time * 14)) * 1.2);
  c.scale(facing, 1);
  if (!front) {
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath();
    c.ellipse(0, 2, 34, 8, 0, 0, Math.PI * 2);
    c.fill();
    // Seat back, and the bag of clubs behind it.
    c.fillStyle = '#c9c2b5';
    rr(c, -22, -44, 8, 30, 3);
    c.fill();
    c.fillStyle = '#7a4a2a';
    rr(c, -34, -46, 10, 32, 4);
    c.fill();
    c.strokeStyle = '#d7dbe2';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-31, -46);
    c.lineTo(-33, -58);
    c.moveTo(-27, -46);
    c.lineTo(-26, -60);
    c.stroke();
  } else {
    // Body, roof and wheels, over his legs.
    c.fillStyle = '#f4f1ea';
    rr(c, -36, -24, 68, 18, 6);
    c.fill();
    c.fillStyle = GOLD;
    c.fillRect(-34, -14, 64, 3);
    c.strokeStyle = '#8d939e';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-24, -24);
    c.lineTo(-24, -76);
    c.moveTo(24, -24);
    c.lineTo(18, -76);
    // Steering column.
    c.moveTo(22, -24);
    c.lineTo(15, -36);
    c.stroke();
    c.fillStyle = '#f4f1ea';
    rr(c, -30, -81, 56, 6, 3);
    c.fill();
    c.fillStyle = '#1b1f2e';
    for (const wx of [-22, 20]) {
      c.beginPath();
      c.arc(wx, -4, 7, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#c9c9c4';
    for (const wx of [-22, 20]) {
      c.beginPath();
      c.arc(wx, -4, 3, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

/** Draws whatever the president is busy doing, on top of the scene. */
function drawActivity(c: Ctx, sim: Sim, s: GameState): void {
  const act = sim.activity;
  if (!act?.anim) return;
  const p = sim.pres;
  const t = act.t;
  const k = Math.min(1, t / act.dur);
  const object = OBJECTS.find((o) => o.id === act.objectId);
  const r = object ? px(object.rect) : { x: p.x - 20, y: p.y - 60, w: 40, h: 60 };
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const npc = sim.npcs.find((n) => n.cardId === act.cardId && !n.leaving);

  switch (act.anim) {
    case 'show-golf':
    case 'resort-golf': {
      const hole = act.anim === 'show-golf' ? { x: cx + 50, y: cy - 8 } : { x: r.x + r.w - 70, y: cy };
      const dir = hole.x >= p.x ? 1 : -1;
      p.facing = dir;
      const cycle = (t % 1.3) / 1.3;
      // Backswing, strike, follow-through. Angle is measured from straight down.
      const angle = cycle < 0.3 ? 0.9 - (cycle / 0.3) * 3.1 : cycle < 0.42 ? -2.2 + ((cycle - 0.3) / 0.12) * 3.6 : 1.4;
      const hx = p.x + dir * 5;
      const hy = p.y - 28;
      const ex = hx + Math.sin(angle) * 30 * dir;
      const ey = hy + Math.cos(angle) * 30;
      c.strokeStyle = '#d7dbe2';
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(hx, hy);
      c.lineTo(ex, ey);
      c.stroke();
      c.fillStyle = '#8d939e';
      c.beginPath();
      c.arc(ex, ey, 4, 0, Math.PI * 2);
      c.fill();
      const tee = { x: p.x + dir * 14, y: p.y - 2 };
      const u = Math.max(0, Math.min(1, (cycle - 0.42) / 0.45));
      if (u < 1) {
        const bx = tee.x + (hole.x - tee.x) * u;
        const by = tee.y + (hole.y - tee.y) * u;
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.ellipse(bx, by + 2, 4, 2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(bx, by - Math.sin(Math.PI * u) * 46, 3.5, 0, Math.PI * 2);
        c.fill();
      } else {
        risingText(c, 'HOLE IN ONE', hole.x, hole.y - 50, (cycle - 0.87) * 1.3, 0.4, 11, GOLD_LIGHT);
      }
      break;
    }
    case 'show-rally': {
      let i = 0;
      for (let row = 0; row < 3; row++) {
        for (let x = r.x - 50 + (row % 2) * 11; x <= r.x + r.w + 50; x += 22) {
          i += 1;
          const y = p.y - 34 - row * 18;
          if (Math.abs(x - p.x) < 24 && row < 2) continue;
          const bob = Math.abs(Math.sin(sim.time * 7 + i * 1.3)) * 6;
          fan(c, x, y, bob, CROWD_SHIRTS[i % 4], i % 3 === 0 ? null : '#d9282f');
          if (i % 5 === 0) {
            c.fillStyle = '#ffffff';
            c.fillRect(x - 11, y - 46 - bob, 22, 12);
            c.fillStyle = '#8a6a3b';
            c.fillRect(x - 1, y - 34 - bob, 2, 10);
            label(c, i % 2 ? 'USA' : '#1', x, y - 40 - bob, 8, '#b3282d');
          }
        }
      }
      for (let j = 0; j < 26; j++) {
        const fx = r.x - 60 + ((j * 53) % (r.w + 120));
        const fy = p.y - 150 + ((sim.time * 70 + j * 41) % 150);
        c.fillStyle = ['#d9282f', '#ffffff', '#3b4f8f', GOLD_LIGHT][j % 4];
        c.fillRect(fx + Math.sin(sim.time * 3 + j) * 6, fy, 4, 6);
      }
      break;
    }
    case 'show-parade': {
      const y = 53.7 * T;
      const span = REGIONS.dc.w + 300;
      for (let j = 0; j < 5; j++) tank(c, ((t * 170 + j * 260) % span) - 150, y);
      for (let j = 0; j < 9; j++) fan(c, r.x - 30 + j * 26, r.y + r.h + 26, Math.abs(Math.sin(sim.time * 5 + j)) * 3, CROWD_SHIRTS[j % 4], null);
      break;
    }
    case 'show-post': {
      POSTS.forEach((word, j) => risingText(c, word, p.x + ((j % 3) - 1) * 46, p.y - 92, t - j * 0.35, 1.5, 12, '#ffffff'));
      emojiAt(c, '📱', p.x + p.facing * 16, p.y - 34, 15);
      break;
    }
    case 'gild': {
      c.globalAlpha = k * 0.6;
      c.fillStyle = goldFill(c, r.x, r.y, r.w, r.h);
      rr(c, r.x, r.y, r.w, r.h, 6);
      c.fill();
      c.globalAlpha = 1;
      sparkles(c, r, sim.time * 3, 1.7);
      sparkles(c, r, sim.time * 3, 5.2);
      sparkles(c, r, sim.time * 3, 9.9);
      emojiAt(c, '🖌️', p.x + p.facing * 16, p.y - 30 + Math.sin(sim.time * 12) * 6, 16);
      break;
    }
    case 'rename': {
      const beat = (t % 0.7) / 0.7;
      const n = Math.floor(t / 0.7);
      const size = 24 - Math.min(1, beat * 4) * 9;
      c.save();
      c.translate(cx + 46 + (n % 3) * 26, r.y + 6 + (n % 2) * 26);
      c.rotate(-0.22 + (n % 3) * 0.12);
      c.globalAlpha = Math.min(1, 1.6 - beat);
      c.strokeStyle = '#d9282f';
      c.lineWidth = 2;
      c.strokeRect(-size * 1.7, -size * 0.7, size * 3.4, size * 1.4);
      label(c, 'TRUMP', 0, 1, size, '#d9282f');
      c.restore();
      c.globalAlpha = 1;
      break;
    }
    case 'resort-dinner': {
      for (let j = 0; j < 7; j++) {
        const x = r.x - 26 + j * ((r.w + 52) / 6);
        const y = j % 2 ? r.y - 12 : r.y + r.h + 34;
        if (Math.abs(x - p.x) < 22 && y > r.y) continue;
        const bob = Math.abs(Math.sin(sim.time * 8 + j)) * 4;
        fan(c, x, y, bob, ['#f3ead6', '#2f8f83', '#e9b99a', '#3b4f8f'][j % 4], null);
        emojiAt(c, '👏', x + 9, y - 30 - bob, 11, 0.5 + Math.sin(sim.time * 8 + j) * 0.5);
      }
      break;
    }
    case 'resort-dj': {
      for (let j = 0; j < 6; j++) {
        const age = (t + j * 0.4) % 1.8;
        risingText(c, j % 2 ? '♪' : '♫', cx - 30 + j * 12 + Math.sin(age * 5 + j) * 8, r.y - 6, age, 1.8, 16, GOLD_LIGHT);
      }
      for (let j = 0; j < 4; j++) fan(c, r.x + r.w + 30 + j * 24, r.y + r.h + 20 + (j % 2) * 14, Math.abs(Math.sin(sim.time * 6 + j * 2)) * 5, CROWD_SHIRTS[j % 4], null);
      break;
    }
    case 'resort-memberships': {
      for (let j = 0; j < 6; j++) {
        const u = ((t * 0.8 + j / 6) % 1);
        const x = r.x + r.w + 70 + (p.x - (r.x + r.w + 70)) * u;
        const y = p.y - 30 - Math.sin(Math.PI * u) * 44;
        c.fillStyle = GOLD_DARK;
        c.beginPath();
        c.arc(x, y + 1, 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = GOLD_LIGHT;
        c.beginPath();
        c.arc(x, y, 6, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'duty-press': {
      if (!npc) break;
      for (let j = 0; j < 4; j++) {
        const phase = (t * 3 + j * 0.37) % 1;
        if (phase > 0.25) continue;
        const x = npc.x + 34 + ((j * 37) % 70);
        const y = npc.y - 20 - ((j * 23) % 50);
        c.fillStyle = `rgba(255,255,255,${1 - phase * 4})`;
        c.beginPath();
        c.arc(x, y, 6 + phase * 40, 0, Math.PI * 2);
        c.fill();
      }
      emojiAt(c, '📸', npc.x + 26, npc.y - 30, 15);
      break;
    }
    case 'duty-briefing': {
      if (npc) for (let j = 0; j < 4; j++) risingText(c, 'blah', npc.x + 6 + (j % 2) * 14, npc.y - 96, (t + j * 0.45) % 1.8, 1.8, 10, '#ffffff');
      if (k > 0.35) for (let j = 0; j < 3; j++) risingText(c, 'z', p.x - 16 - j * 4, p.y - 70, (t + j * 0.5) % 1.5, 1.5, 12 + j * 3, '#9db5dd');
      break;
    }
    case 'duty-call': {
      if (!npc) break;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      for (let j = 0; j < 3; j++) {
        const phase = (t * 1.6 + j / 3) % 1;
        c.globalAlpha = 1 - phase;
        c.beginPath();
        c.arc(npc.x, npc.y - 50, 14 + phase * 26, -2.4, -0.7);
        c.stroke();
      }
      c.globalAlpha = 1;
      break;
    }
    case 'duty-decision': {
      emojiAt(c, '📄', p.x + p.facing * 18, p.y - 34, 15);
      if (npc) risingText(c, '...', npc.x, npc.y - 96, t % 1.2, 1.2, 14, '#ffffff');
      break;
    }
    case 'duty-crisis': {
      const region = REGIONS.dc;
      c.fillStyle = `rgba(217,40,47,${0.07 + Math.abs(Math.sin(t * 5)) * 0.1})`;
      c.fillRect(region.x, region.y, region.w, region.h);
      if (npc) emojiAt(c, '🚨', npc.x, npc.y - 104 + Math.sin(t * 10) * 3, 20);
      break;
    }
    case 'duty-hybrid': {
      const box = { x: Math.min(p.x, npc?.x ?? p.x) - 30, y: p.y - 90, w: Math.abs((npc?.x ?? p.x) - p.x) + 60, h: 90 };
      sparkles(c, box, sim.time * 3, 2.2);
      sparkles(c, box, sim.time * 3, 6.1);
      emojiAt(c, '🤝', (p.x + (npc?.x ?? p.x)) / 2, p.y - 36, 18);
      break;
    }
    case 'sleep': {
      // Tucked in: head on the pillow, hands holding the top of the comforter.
      const hx = cx;
      const hy = r.y + 18;
      const breath = Math.sin(sim.time * 2.2) * 1.5;
      c.fillStyle = 'rgba(0,0,0,0.16)';
      rr(c, cx - 15, r.y + 31, 34, r.h - 50, 13);
      c.fill();
      c.fillStyle = GOLD_LIGHT;
      rr(c, cx - 17 - breath / 2, r.y + 28, 34 + breath, r.h - 50, 13);
      c.fill();
      c.fillStyle = '#f2a35e';
      c.beginPath();
      c.arc(cx - 12, r.y + 31, 4, 0, Math.PI * 2);
      c.arc(cx + 12, r.y + 31, 4, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(hx, hy, 10, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f2c230';
      c.beginPath();
      c.arc(hx, hy - 2, 10.5, Math.PI, 0);
      c.fill();
      c.beginPath();
      c.ellipse(hx + 5, hy - 10, 11, 5, -0.25, 0, Math.PI * 2);
      c.fill();
      // Eyes shut, and a very contented smile.
      c.strokeStyle = '#1b1f2e';
      c.lineWidth = 1.5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(hx - 6, hy + 1);
      c.lineTo(hx - 2, hy + 1);
      c.moveTo(hx + 2, hy + 1);
      c.lineTo(hx + 6, hy + 1);
      c.stroke();
      c.beginPath();
      c.arc(hx, hy + 3, 4, 0.25, Math.PI - 0.25);
      c.stroke();

      const aide = sim.aide;
      if (aide.path.length > 0) {
        // He will not close his eyes until she is there.
        driftingText(c, 'NATALIE!', hx + 24, hy - 14, sim.time % 1.4, 1.4, 12, '#ffffff');
        break;
      }
      const lines = act.lines ?? [];
      const n = Math.floor((t - AFFIRM_START) / AFFIRM_EVERY);
      const age = t - AFFIRM_START - n * AFFIRM_EVERY;
      if (t >= AFFIRM_START && n < lines.length) {
        const alpha = clamp01(Math.min(age / 0.2, (AFFIRM_EVERY - age) / 0.25));
        speech(c, lines[n], aide.x + 6, aide.y - 92, alpha);
        // Each one lands.
        emojiAt(c, '💛', hx + 16 + Math.sin(age * 5) * 4, hy - 12 - age * 11, 12, 1 - age / AFFIRM_EVERY);
      }
      if (n >= lines.length) for (let j = 0; j < 3; j++) risingText(c, 'Z', hx + 18 + j * 8, hy - 8, (t + j * 0.5) % 1.5, 1.5, 12 + j * 4, '#ffffff');
      break;
    }
  }
}

// ---------- Idle scenes ----------

const GAGGLE = ['FAKE NEWS!', 'NEXT QUESTION', 'TREMENDOUS', 'NASTY QUESTION', 'IN TWO WEEKS', 'EVERYBODY KNOWS IT'];
const DICTATION = ['WITCH HUNT!', 'MANY PEOPLE ARE SAYING', 'TOTAL DISASTER', 'ALL CAPS, NATALIE', 'THANK YOU FOR YOUR', 'ATTENTION TO THIS MATTER!'];
const SCROLL = ['❤️', '👍', '🔁', '😡', '❤️', '🔥'];
/** Where the reporters stand, relative to the president. */
const REPORTERS: [number, number][] = [
  [-58, 8],
  [-36, 32],
  [0, 44],
  [36, 32],
  [58, 8],
];

const RAMBLE = [
  'NOBODY KNEW THAT',
  'BIGGEST CROWD EVER',
  'THEY SAID "SIR..."',
  'PERFECT. JUST PERFECT.',
  'SHARKS, VERY BAD',
  'WE HAVE THE BEST WATER',
  'QUIET, QUIET PIGGY',
  'FAKE NEWS!',
  "I DON'T KNOW HER",
  'IN TWO WEEKS',
];
const QUESTIONS = ['SIR! SIR!', 'BUT THE TARIFFS?', 'WHICH GULF?', 'A FOLLOW-UP?', 'WHAT WATER?', 'IS THAT LEGAL?', 'TWO WEEKS FROM WHEN?', 'MR PRESIDENT!', 'WHO SAID "SIR"?', 'ANY COMMENT?'];
/** The order the press room chairs fill up in. Matches the seating drawn in washington(). */
const SEAT_ORDER = [2, 7, 0, 9, 4, 5, 1, 8, 3, 6];
const seatAt = (i: number): Point => ({ x: 56.3 * T + (i % 5) * 42 + 13, y: (12.6 + Math.floor(i / 5) * 1.9) * T + 15 });
const SEAT_EVERY = 0.9;
const QUESTION_EVERY = 2.8;

/** Draws what the president does when left alone, on top of the scene. */
function drawIdle(c: Ctx, sim: Sim): void {
  const idle = sim.idle;
  if (!idle || idle.walking) return;
  const p = sim.pres;
  const t = idle.t;

  switch (idle.kind) {
    case 'press': {
      // The pack closes in from all sides, then he holds forth.
      const k = 1 - (1 - Math.min(1, t / 0.7)) ** 3;
      p.facing = Math.sin(t * 0.9) >= 0 ? 1 : -1;
      REPORTERS.forEach(([dx, dy], j) => {
        const spread = 1 + (1 - k) * 1.6;
        const x = p.x + dx * spread;
        const y = p.y + dy * spread;
        const bob = Math.abs(Math.sin(sim.time * 5 + j * 1.7)) * 2;
        c.globalAlpha = k;
        fan(c, x, y, bob, CROWD_SHIRTS[(j + 1) % 4], null);
        c.globalAlpha = 1;
        const lean = dx === 0 ? 0 : dx > 0 ? -1 : 1;
        emojiAt(c, j === 2 ? '📸' : '🎤', x + lean * 9, y - 32 - bob, 12, k);
        const flash = (t * 1.3 + j * 0.41) % 1;
        if (k === 1 && j % 2 === 0 && flash < 0.12) {
          c.fillStyle = `rgba(255,255,255,${1 - flash * 8})`;
          c.beginPath();
          c.arc(x, y - 30, 5 + flash * 110, 0, Math.PI * 2);
          c.fill();
        }
      });
      if (k === 1) risingText(c, GAGGLE[Math.floor(t / 1.7) % GAGGLE.length], p.x, p.y - 100, t % 1.7, 1.7, 12, '#ffffff');
      break;
    }
    case 'briefing': {
      // He holds forth from the podium while the chairs fill up with questions.
      p.facing = Math.sin(t * 0.7) >= 0 ? 1 : -1;
      driftingText(c, RAMBLE[Math.floor(t / 1.8) % RAMBLE.length], p.x + 10, p.y - 72, t % 1.8, 1.8, 12, '#ffffff');
      emojiAt(c, '🎤', p.x, p.y + 12, 11);

      const seated = Math.min(SEAT_ORDER.length, Math.floor(t / SEAT_EVERY));
      const n = Math.floor(t / QUESTION_EVERY);
      const age = t % QUESTION_EVERY;
      // Whoever is asking was picked from those already sitting when the question began.
      const there = Math.min(SEAT_ORDER.length, Math.floor((n * QUESTION_EVERY) / SEAT_EVERY));
      const asker = there > 0 && age < 1.9 ? SEAT_ORDER[(n * 7) % there] : -1;
      // Back row last, so it is drawn over the front one.
      for (let seat = 0; seat < SEAT_ORDER.length; seat++) {
        const j = SEAT_ORDER.indexOf(seat);
        if (j >= seated) continue;
        const { x, y } = seatAt(seat);
        const k = Math.min(1, (t - (j + 1) * SEAT_EVERY) / 0.35);
        const asking = seat === asker;
        const bob = asking ? 3 + Math.abs(Math.sin(sim.time * 9)) * 2 : Math.abs(Math.sin(sim.time * 2 + seat)) * 0.8;
        c.globalAlpha = k;
        fan(c, x, y + (1 - k) * 8, bob, CROWD_SHIRTS[(seat * 3 + 1) % 4], null);
        c.globalAlpha = 1;
        if (asking) emojiAt(c, '✋', x + 9, y - 30 - bob, 11);
        else if (seat % 4 === 1) emojiAt(c, seat === 5 ? '📸' : '🎤', x + 8, y - 16, 9, k);
        const flash = (t * 0.9 + seat * 0.37) % 1;
        if (k === 1 && seat === 5 && flash < 0.1) {
          c.fillStyle = `rgba(255,255,255,${1 - flash * 10})`;
          c.beginPath();
          c.arc(x + 8, y - 16, 5 + flash * 120, 0, Math.PI * 2);
          c.fill();
        }
      }
      if (asker >= 0) {
        const { x, y } = seatAt(asker);
        const text = QUESTIONS[n % QUESTIONS.length];
        // Kept clear of the side walls, so long questions stay in the room.
        risingText(c, text, Math.max(58.5 * T, Math.min(63.5 * T, x)), y - 44, age, 1.9, 10, GOLD_LIGHT);
      }
      break;
    }
    case 'dictate': {
      const aide = sim.aide;
      if (aide.mode !== 'dictate' || aide.path.length > 0) {
        // Waiting for her: he drums on the soda button.
        driftingText(c, 'NATALIE!', p.x + 10, p.y - 72, t % 1.4, 1.4, 12, '#ffffff');
        break;
      }
      const n = Math.floor(t / 1.9);
      const age = t % 1.9;
      driftingText(c, DICTATION[n % DICTATION.length], p.x + 10, p.y - 72, age, 1.9, 11, '#ffffff');
      emojiAt(c, '💻', aide.x + aide.facing * 15, aide.y - 28 + Math.abs(Math.sin(sim.time * 16)) * 2, 15);
      risingText(c, 'POSTED ✓', aide.x, aide.y - 84, age - 1.1, 0.8, 10, GOLD_LIGHT);
      break;
    }
    case 'toilet': {
      const hx = p.x + p.facing * 15;
      const hy = p.y - 30 + Math.sin(sim.time * 9) * 1.5;
      // The glow of the screen on a happy face.
      c.fillStyle = 'rgba(150,200,255,0.22)';
      c.beginPath();
      c.arc(hx, hy, 20 + Math.sin(sim.time * 3) * 2, 0, Math.PI * 2);
      c.fill();
      emojiAt(c, '📱', hx, hy, 15);
      for (let j = 0; j < 3; j++) {
        const age = (t + j * 0.6) % 1.8;
        const which = Math.floor((t + j * 0.6) / 1.8) * 3 + j;
        emojiAt(c, SCROLL[which % SCROLL.length], hx + 8 + j * 9 + Math.sin(age * 4 + j) * 4, hy - 14 - age * 30, 11, 1 - age / 1.8);
      }
      break;
    }
    case 'cart': {
      // Joyriding, with Natalie in pursuit.
      const aide = sim.aide;
      risingText(c, JOYRIDE[Math.floor(t / 2.6) % JOYRIDE.length], p.x, p.y - 100, t % 2.6, 1.6, 11, '#ffffff');
      risingText(c, CHASE[Math.floor((t + 1.3) / 2.6) % CHASE.length], aide.x, aide.y - 92, (t + 1.3) % 2.6, 1.6, 10, GOLD_LIGHT);
      emojiAt(c, '💦', aide.x - aide.facing * 14, aide.y - 56 + Math.sin(sim.time * 12) * 2, 11);
      break;
    }
    case 'nap': {
      // Out cold at the cabinet table.
      for (let j = 0; j < 3; j++) risingText(c, 'Z', p.x + 14 + j * 8, p.y - 62, (t + j * 0.5) % 1.5, 1.5, 12 + j * 4, '#ffffff');
      emojiAt(c, '😴', p.x - 20, p.y - 70 + Math.sin(sim.time * 2) * 2, 14);
      break;
    }
  }
}

// ---------- Scenery ----------

function palm(c: Ctx, x: number, y: number): void {
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.beginPath();
  c.ellipse(x + 4, y + 2, 16, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#8a6a3b';
  c.fillRect(x - 3, y - 44, 6, 44);
  c.fillStyle = '#2f8f4e';
  for (let i = 0; i < 6; i++) {
    c.save();
    c.translate(x, y - 46);
    c.rotate((i / 6) * Math.PI * 2);
    c.beginPath();
    c.ellipse(15, 0, 17, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

function washington(c: Ctx): void {
  const region = REGIONS.dc;
  c.fillStyle = '#4c8f57';
  c.fillRect(0, 0, region.w, region.h);
  c.fillStyle = 'rgba(255,255,255,0.045)';
  for (let x = 0; x < region.w; x += 80) c.fillRect(x, 0, 40, region.h);

  // Parade avenue along the bottom, and paths from the doors.
  c.fillStyle = '#5a5d66';
  c.fillRect(0, 52 * T, region.w, 3 * T);
  c.fillStyle = '#f2c230';
  for (let x = 10; x < region.w; x += 60) c.fillRect(x, 53.4 * T, 30, 4);
  c.fillStyle = '#d8ccb0';
  c.fillRect(27 * T, 23 * T, 2 * T, 3 * T);
  c.fillRect(50 * T, 23 * T, 2 * T, 3 * T);
  c.fillRect(16 * T, 25 * T, 52 * T, 1.2 * T);
  c.fillRect(68 * T, 18 * T, 2 * T, 8.2 * T);
  c.fillRect(16 * T, 33.4 * T, 50 * T, 1.2 * T);
  c.fillRect(16 * T, 43.4 * T, 50 * T, 1.2 * T);
  c.fillRect(16 * T, 25 * T, 1.2 * T, 19.6 * T);
  c.fillRect(65.4 * T, 25 * T, 1.2 * T, 19.6 * T);

  for (const room of ROOMS) {
    const r = px(room.rect);
    c.fillStyle = room.floor;
    c.fillRect(r.x, r.y, r.w, r.h);
    if (room.name) {
      c.fillStyle = 'rgba(0,0,0,0.05)';
      for (let y = r.y; y < r.y + r.h; y += 40) c.fillRect(r.x, y, r.w, 20);
      label(c, room.name, r.x + r.w / 2, r.y + r.h - 14, 12, 'rgba(0,0,0,0.3)');
    }
  }
  // Door thresholds.
  c.fillStyle = '#9c2f3a';
  for (const x of [9, 27, 46, 60]) c.fillRect(x * T, 17 * T, 2 * T, T);
  c.fillStyle = GOLD;
  c.fillRect(3 * T, 19.9 * T, 64 * T, 3);

  // Press room seating.
  c.fillStyle = '#40506e';
  for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
    rr(c, 56.3 * T + i * 42, (12.6 + row * 1.9) * T, 26, 20, 5);
    c.fill();
  }

  for (let ty = 0; ty < 24; ty++) {
    for (let tx = 0; tx < 70; tx++) {
      if (!isWall(tx, ty)) continue;
      c.fillStyle = '#b7ae98';
      c.fillRect(tx * T, ty * T, T, T);
      c.fillStyle = '#f3eee0';
      c.fillRect(tx * T, ty * T, T, T - 6);
    }
  }

  label(c, 'MONUMENTS', 18 * T, 26.6 * T, 10, 'rgba(255,255,255,0.45)', 'left');
  label(c, 'BUILDINGS', 18 * T, 36.3 * T, 10, 'rgba(255,255,255,0.45)', 'left');
}

function maralago(c: Ctx, time: number): void {
  const region = REGIONS.maralago;
  c.fillStyle = '#2f8fc4';
  c.fillRect(region.x - 400, region.y - 400, region.w + 800, region.h + 800);
  c.strokeStyle = 'rgba(255,255,255,0.25)';
  c.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = region.y + 12 + i * 78 + Math.sin(time + i) * 4;
    c.beginPath();
    c.moveTo(region.x - 200, y);
    c.lineTo(region.x + region.w + 200, y);
    c.stroke();
  }
  // Sand, then lawn.
  c.fillStyle = '#efdfa6';
  rr(c, 1.4 * T, 59.4 * T, 47.2 * T, 29.2 * T, 40);
  c.fill();
  c.fillStyle = '#58a862';
  rr(c, 2.6 * T, 60.6 * T, 44.8 * T, 26.8 * T, 30);
  c.fill();

  // The club terrace.
  c.fillStyle = '#e9b99a';
  rr(c, 4 * T, 61 * T, 28 * T, 13 * T, 10);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.14)';
  for (let x = 4; x < 32; x += 2) for (let y = 61; y < 74; y += 2) {
    if ((x + y) % 4 === 1 || (x + y) % 4 === 3) continue;
    c.fillRect(x * T, y * T, T, T);
  }
  c.fillStyle = '#c96f4a';
  c.fillRect(4 * T, 60.4 * T, 28 * T, 0.8 * T);
  label(c, 'MAR-A-LAGO', 18 * T, 73 * T, 13, 'rgba(90,40,20,0.45)');

  // Runway.
  c.fillStyle = '#6a6d76';
  rr(c, 27 * T, 81 * T, 20 * T, 5.6 * T, 8);
  c.fill();
  c.fillStyle = '#f2c230';
  for (let x = 28; x < 46; x += 3) c.fillRect(x * T, 83.7 * T, 30, 4);

  for (const [x, y] of [[33, 62], [46, 61], [46, 72], [34, 73], [3.4, 74.6], [25, 76], [26, 86], [3.6, 86], [45, 78]]) {
    palm(c, x * T, y * T);
  }
}

// ---------- Frame ----------

export function hitRectPx(o: WorldObject): Rect {
  return px(o.rect);
}

export function drawWorld(c: Ctx, sim: Sim, s: GameState, viewW: number, viewH: number): void {
  // Fit the whole of the current place when there is room; otherwise follow
  // the president around it.
  const region = REGIONS[s.place];
  const here = OBJECTS.filter((o) => (o.place ?? 'dc') === s.place && exists(o, s));
  const scale = Math.max(Math.min(viewW / region.w, viewH / region.h), 0.5);
  const visibleW = viewW / scale;
  const visibleH = viewH / scale;
  const follow = (center: number, visible: number, start: number, size: number) =>
    visible >= size ? start + (size - visible) / 2 : Math.max(start, Math.min(start + size - visible, center - visible / 2));
  sim.cam = {
    x: follow(sim.pres.x, visibleW, region.x, region.w),
    y: follow(sim.pres.y - 30, visibleH, region.y, region.h),
    scale,
  };

  c.fillStyle = s.place === 'dc' ? '#2f5f3a' : '#2f8fc4';
  c.fillRect(0, 0, viewW, viewH);
  c.save();
  c.scale(scale, scale);
  c.translate(-sim.cam.x, -sim.cam.y);

  if (s.place === 'dc') washington(c);
  else maralago(c, sim.time);

  currentAct = sim.activity;
  const flat = here.filter((o) => !o.blocking);
  for (const o of flat) drawObject(c, o, s, sim.time, sim.hover === o.id);

  // Everything standing up is drawn back to front.
  const standing: { y: number; draw: () => void }[] = [];
  for (const o of here) {
    if (!o.blocking) continue;
    standing.push({ y: (o.rect.y + o.rect.h) * T, draw: () => drawObject(c, o, s, sim.time, sim.hover === o.id) });
  }
  for (const n of sim.npcs.filter((x) => x.place === s.place)) {
    const look = NPC_LOOK[n.kind];
    standing.push({
      y: n.y,
      draw: () => {
        person(c, n, { suit: look.suit, skin: '#e9c09a', hair: look.hair }, 0);
        if (n.leaving) {
          if (n.angry) bubble(c, n.x, n.y - 70, '💢');
        } else {
          const bounce = n.path.length === 0 ? Math.sin(sim.time * 4 + n.x) * 2 : 0;
          bubble(c, n.x, n.y - 70 + bounce, look.icon, n.kind === 'crisis' ? '#ffd9d4' : n.kind === 'hybrid' || n.place === 'maralago' ? '#fff0b8' : '#ffffff');
        }
        if (sim.hover === n.key) {
          c.strokeStyle = '#ffffff';
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(n.x, n.y, 17, 7, 0, 0, Math.PI * 2);
          c.stroke();
        }
      },
    });
  }
  const aide = sim.aide;
  // She is aboard too while a flight is in the air.
  if (!sim.activity?.flight) {
    standing.push({
      y: aide.y,
      draw: () => {
        const sobbing = aide.mode === 'barred';
        person(c, aide, { suit: '#f4f1ea', skin: '#f0c9a8', hair: '#e8cf7a', long: true }, sobbing ? Math.abs(Math.sin(sim.time * 9)) * 2 : 0);
        if (sobbing) {
          // Shut out of the Cabinet Room: tears, and a great deal of noise.
          c.fillStyle = '#7fc4ff';
          for (let j = 0; j < 4; j++) {
            const age = (sim.time * 1.6 + j * 0.25) % 1;
            const side = j % 2 ? 1 : -1;
            c.globalAlpha = 1 - age;
            c.beginPath();
            c.arc(aide.x + side * (7 + age * 12), aide.y - 46 + age * age * 30, 2.2, 0, Math.PI * 2);
            c.fill();
          }
          c.globalAlpha = 1;
          emojiAt(c, '😭', aide.x, aide.y - 96 + Math.sin(sim.time * 6) * 2, 16);
          risingText(c, SOBS[Math.floor(sim.time / 1.6) % SOBS.length], aide.x + 34, aide.y - 60, sim.time % 1.6, 1.4, 10, '#bfe0ff');
        }
        // Her name shows only under the pointer.
        if (sim.hover !== 'aide') return;
        c.font = `700 9px ${FONT}`;
        const w = c.measureText('Natalie Harp').width + 10;
        c.fillStyle = 'rgba(10,15,31,0.8)';
        rr(c, aide.x - w / 2, aide.y - 80, w, 14, 4);
        c.fill();
        label(c, 'Natalie Harp', aide.x, aide.y - 73, 9, '#ffffff');
      },
    });
  }
  const act = sim.activity;
  const idle = sim.idle && !sim.idle.walking ? sim.idle.kind : null;
  // He is aboard while a flight is in the air.
  // Nor is he standing about while he is in bed.
  if (!act?.flight && !act?.sleep) standing.push({
    y: sim.pres.y,
    draw: () => {
      if (idle === 'cart') {
        golfCart(c, sim.pres.x, sim.pres.y, sim.pres.facing, sim.time, false);
        person(c, { ...sim.pres, y: sim.pres.y - 10 }, { suit: '#1d2a52', skin: '#f2a35e', hair: '#f2c230', tie: '#d9282f', swoosh: true }, 0);
        golfCart(c, sim.pres.x, sim.pres.y, sim.pres.facing, sim.time, true);
        return;
      }
      const bob = act ? Math.abs(Math.sin(sim.time * 8)) * 3 : idle === 'press' || idle === 'briefing' ? Math.abs(Math.sin(sim.time * 5)) * 1.5 : 0;
      if (idle === 'dictate') {
        // The chair behind the desk.
        c.fillStyle = '#3a2416';
        rr(c, sim.pres.x - 15, sim.pres.y - 50, 30, 46, 7);
        c.fill();
        c.fillStyle = '#6b3f24';
        rr(c, sim.pres.x - 12, sim.pres.y - 47, 24, 40, 5);
        c.fill();
      }
      person(c, sim.pres, { suit: '#1d2a52', skin: '#f2a35e', hair: '#f2c230', tie: '#d9282f', swoosh: true }, bob);
    },
  });
  standing.sort((a, b) => a.y - b.y);
  for (const item of standing) item.draw();

  drawActivity(c, sim, s);
  drawIdle(c, sim);

  // Above-head status for the president.
  const p = sim.pres;
  if (act?.flight || act?.sleep) {
    // Nothing over his head: he is on board, or in bed.
  } else if (act) {
    bubble(c, p.x, p.y - 84, act.emoji);
    const w = 54;
    c.fillStyle = 'rgba(10,15,31,0.85)';
    rr(c, p.x - w / 2 - 2, p.y - 78, w + 4, 10, 5);
    c.fill();
    c.fillStyle = GOLD_LIGHT;
    rr(c, p.x - w / 2, p.y - 76, w * Math.min(1, act.t / act.dur), 6, 3);
    c.fill();
  } else {
    const m = mood(s);
    if (m !== 'normal') bubble(c, p.x, p.y - 74 + Math.sin(sim.time * 3) * 2, m === 'sulking' ? '🌧️' : '🔥');
  }

  // Name tag for whatever is under the pointer.
  const hovered = OBJECTS.find((o) => o.id === sim.hover);
  if (hovered) {
    const r = px(hovered.rect);
    c.font = `700 12px ${FONT}`;
    const name = objectName(hovered, s);
    const w = c.measureText(name).width + 16;
    c.fillStyle = 'rgba(10,15,31,0.9)';
    rr(c, r.x + r.w / 2 - w / 2, r.y - 26, w, 20, 5);
    c.fill();
    label(c, name, r.x + r.w / 2, r.y - 16, 12, '#ffffff');
  }

  for (const f of sim.floats) {
    c.globalAlpha = Math.max(0, 1 - f.t / 1.6);
    c.font = `800 15px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(10,15,31,0.85)';
    c.strokeText(f.text, f.x, f.y - f.t * 34);
    c.fillStyle = f.color;
    c.fillText(f.text, f.x, f.y - f.t * 34);
    c.globalAlpha = 1;
  }

  c.restore();

  // The day darkens as the month's time is used up, and blacks out for sleep.
  const used = 1 - s.blocks / BLOCKS_PER_MONTH;
  c.fillStyle = `rgba(16,22,60,${used * 0.28})`;
  c.fillRect(0, 0, viewW, viewH);
  if (sim.fade > 0) {
    c.fillStyle = `rgba(5,7,18,${sim.fade})`;
    c.fillRect(0, 0, viewW, viewH);
  }
}

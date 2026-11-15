import { BLOCKS_PER_MONTH, mood } from '../game/engine.ts';
import { vanityById } from '../game/content.ts';
import type { DutyKind, GameState } from '../game/types.ts';
import { OBJECTS, REGIONS, ROOMS, T, isWall } from './map.ts';
import type { Point, Rect, Tile, WorldObject } from './map.ts';

// Everything on screen is drawn with canvas shapes; there are no image files.

export interface Actor {
  x: number;
  y: number;
  path: Point[];
  facing: 1 | -1;
  /** Seconds spent walking, drives the leg swing. */
  walk: number;
}

export interface Npc extends Actor {
  key: string;
  cardId: string;
  kind: DutyKind;
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
  floats: Float[];
  /** Object id or npc key under the pointer. */
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

const NPC_LOOK: Record<DutyKind, { suit: string; hair: string; icon: string }> = {
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

  c.fillStyle = '#1b1f2e';
  c.fillRect(-7, -14, 6, 14 - Math.max(0, swing) * 5);
  c.fillRect(1, -14, 6, 14 - Math.max(0, -swing) * 5);

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
    case 'plane': {
      gilded = did('gild-plane');
      const body = gilded ? goldFill(c, r.x, r.y, r.w, r.h) : '#f4f6fa';
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.beginPath();
      c.ellipse(cx + 4, cy + 10, r.w / 2, 20, 0, 0, Math.PI * 2);
      c.fill();
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
      for (let j = 0; j < 3; j++) risingText(c, 'Z', p.x - 30 - j * 8, p.y - 40, (t + j * 0.5) % 1.5, 1.5, 14 + j * 4, '#ffffff');
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
  const here = OBJECTS.filter((o) => (o.place ?? 'dc') === s.place);
  const scale = Math.max(Math.min(viewW / region.w, viewH / region.h), 0.5);
  const visibleW = viewW / scale;
  const visibleH = viewH / scale;
  const follow = (centre: number, visible: number, start: number, size: number) =>
    visible >= size ? start + (size - visible) / 2 : Math.max(start, Math.min(start + size - visible, centre - visible / 2));
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
  for (const n of s.place === 'dc' ? sim.npcs : []) {
    const look = NPC_LOOK[n.kind];
    standing.push({
      y: n.y,
      draw: () => {
        person(c, n, { suit: look.suit, skin: '#e9c09a', hair: look.hair }, 0);
        if (n.leaving) {
          if (n.angry) bubble(c, n.x, n.y - 70, '💢');
        } else {
          const bounce = n.path.length === 0 ? Math.sin(sim.time * 4 + n.x) * 2 : 0;
          bubble(c, n.x, n.y - 70 + bounce, look.icon, n.kind === 'crisis' ? '#ffd9d4' : n.kind === 'hybrid' ? '#fff0b8' : '#ffffff');
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
  const act = sim.activity;
  standing.push({
    y: sim.pres.y,
    draw: () => {
      const bob = act ? Math.abs(Math.sin(sim.time * 8)) * 3 : 0;
      person(c, sim.pres, { suit: '#1d2a52', skin: '#f2a35e', hair: '#f2c230', tie: '#d9282f', swoosh: true }, bob);
    },
  });
  standing.sort((a, b) => a.y - b.y);
  for (const item of standing) item.draw();

  drawActivity(c, sim, s);

  // Above-head status for the president.
  const p = sim.pres;
  if (act) {
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
    const w = c.measureText(hovered.name).width + 16;
    c.fillStyle = 'rgba(10,15,31,0.9)';
    rr(c, r.x + r.w / 2 - w / 2, r.y - 26, w, 20, 5);
    c.fill();
    label(c, hovered.name, r.x + r.w / 2, r.y - 16, 12, '#ffffff');
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

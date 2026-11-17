import { MIDTERM_BAR } from '../game/calendar.ts';
import { heat } from '../game/engine.ts';
import type { Address, Exhibit } from '../game/events.ts';
import { SET_PIECE_MONTHS } from '../game/story.ts';
import type { GameState, Take } from '../game/types.ts';
import { GOLD, GOLD_DARK, GOLD_LIGHT, PRESIDENT, clamp01, emojiAt, fan, goldFill, label, person, risingText, rr, speech, woman } from './draw.ts';
import type { Activity, Actor, Ctx, Look, Sim } from './draw.ts';
import { REGIONS, T } from './map.ts';

// What the calendar leaves lying around: the props that go up on the lawn for
// each of the term's big days, the marks those days leave on the house for
// good, the backdrops the tablet puts behind an address, and election night.
// Like everything else, it is all canvas shapes.

/** Election night: the map fills in, the result is called, and he takes it the way he takes it. */
export const ELECTION_SECONDS = 13;
const ELECTION_SLIDE = 0.6;
const ELECTION_COUNT_FROM = 1.1;
const ELECTION_CALLED = 7.2;
const ELECTION_THROW = 8.1;
const ELECTION_SPLAT = 8.6;

const RED = '#d9282f';
const BLUE = '#3b6fd4';
const PAPER = '#fbf8ee';
const INK = '#14161c';

type Standing = { y: number; draw: () => void }[];

const still = (x: number, y: number, facing: 1 | -1 = 1): Actor => ({ x, y, path: [], facing, walk: 0 });
const taken = (s: GameState, id: string): Take | undefined => s.setPieces?.[id];
/** A number in 0..1 that is always the same for the same n. */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- The portrait ----------

/** The official portrait: the honest one, or the one he asked for. */
function portraitArt(c: Ctx, x: number, y: number, w: number, h: number, heroic: boolean): void {
  const u = h / 50;
  const cx = x + w / 2;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  if (heroic) {
    c.fillStyle = '#9c2f3a';
    c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(248,220,130,0.55)';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx, y + h * 0.5);
      c.lineTo(cx + Math.cos(a) * w, y + h * 0.5 + Math.sin(a) * w);
      c.lineTo(cx + Math.cos(a + 0.2) * w, y + h * 0.5 + Math.sin(a + 0.2) * w);
      c.fill();
    }
  } else {
    c.fillStyle = '#8d9099';
    c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(x, y + h * 0.6, w, h * 0.4);
  }
  // Shoulders: as they are, or as he remembers them.
  c.fillStyle = '#1d2a52';
  c.beginPath();
  c.ellipse(cx, y + h + 3 * u, heroic ? w * 0.6 : w * 0.34, heroic ? 19 * u : 14 * u, 0, 0, Math.PI * 2);
  c.fill();
  if (heroic) {
    for (const side of [-1, 1]) {
      c.beginPath();
      c.arc(cx + side * w * 0.4, y + h - 9 * u, 6 * u, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(cx - 4 * u, y + h - 13 * u);
  c.lineTo(cx + 4 * u, y + h - 13 * u);
  c.lineTo(cx, y + h - 6 * u);
  c.fill();
  c.fillStyle = RED;
  c.fillRect(cx - 1.5 * u, y + h - 12 * u, 3 * u, 14 * u);
  // The head, the hair, and what the last four years did to the eyes.
  const hy = y + h - 22 * u + (heroic ? -2 * u : 0);
  c.fillStyle = heroic ? '#f2a35e' : '#ddb596';
  c.beginPath();
  c.arc(cx, hy, 9 * u, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = heroic ? '#f8d040' : '#d6c68c';
  c.beginPath();
  c.arc(cx, hy - 2 * u, 9.5 * u, Math.PI, 0);
  c.fill();
  c.beginPath();
  c.ellipse(cx + 4 * u, hy - 9 * u, heroic ? 12 * u : 9 * u, heroic ? 5 * u : 3.5 * u, -0.25, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1b1f2e';
  c.fillRect(cx - 4 * u, hy, 2 * u, 2 * u);
  c.fillRect(cx + 2 * u, hy, 2 * u, 2 * u);
  c.strokeStyle = heroic ? '#7a2a1c' : '#8a6a5a';
  c.lineWidth = Math.max(0.6, u);
  c.beginPath();
  if (heroic) c.arc(cx, hy + 3 * u, 3.5 * u, 0.2, Math.PI - 0.2);
  else {
    c.arc(cx, hy + 8 * u, 3.5 * u, Math.PI + 0.5, -0.5);
    c.moveTo(cx - 5 * u, hy + 3.2 * u);
    c.lineTo(cx - 1.5 * u, hy + 3.2 * u);
    c.moveTo(cx + 1.5 * u, hy + 3.2 * u);
    c.lineTo(cx + 5 * u, hy + 3.2 * u);
  }
  c.stroke();
  if (heroic) emojiAt(c, '🦁', x + w - 8 * u, y + h - 9 * u, 13 * u);
  c.restore();
}

function framed(c: Ctx, x: number, y: number, w: number, h: number, gold: boolean, art: () => void): void {
  const b = gold ? 4 : 2;
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(x - b + 1, y - b + 2, w + b * 2, h + b * 2);
  c.fillStyle = gold ? goldFill(c, x - b, y - b, w + b * 2, h + b * 2) : '#5b3a22';
  c.fillRect(x - b, y - b, w + b * 2, h + b * 2);
  art();
}

/** A sheet of paper with one big thing written on it. */
function sheet(c: Ctx, x: number, y: number, w: number, h: number, e: Exhibit): void {
  c.fillStyle = 'rgba(0,0,0,0.25)';
  rr(c, x + 2, y + 3, w, h, 3);
  c.fill();
  c.fillStyle = e.gold ? goldFill(c, x, y, w, h) : PAPER;
  rr(c, x, y, w, h, 3);
  c.fill();
  const u = h / 44;
  label(c, e.title, x + w / 2, y + 7 * u, 7 * u, e.gold ? '#5c4208' : '#6b7080');
  label(c, e.big, x + w / 2, y + 22 * u, 19 * u, e.gold ? '#3a2a05' : RED);
  label(c, e.small, x + w / 2, y + 37 * u, 6 * u, e.gold ? '#5c4208' : '#3d414b');
}

// ---------- The address: what the tablet puts behind him ----------

const LEADER: Look = { suit: '#3d4a44', skin: '#e9c09a', hair: '#8d8d8d', tie: '#2f8f83' };
const SPEAKER: Look = { suit: '#6b5a7d', skin: '#e9c09a', hair: '#c9c2b5' };
const VEEP: Look = { suit: '#2b2b33', skin: '#e2b08a', hair: '#4a3728', tie: '#3b4f8f' };
const FLAGS = ['#d9282f', '#3b6fd4', '#f2c230', '#2f8f83', '#ffffff', '#8a4fa3', '#e9862f'];

/** The set, drawn on the tablet's 300 by 216 grid before he is. */
export function addressBackdrop(c: Ctx, a: Address, t: number): void {
  const W = 300;
  const H = 216;
  switch (a.set) {
    case 'chamber': {
      const wood = c.createLinearGradient(0, 0, 0, H);
      wood.addColorStop(0, '#2c1a10');
      wood.addColorStop(1, '#5b3a22');
      c.fillStyle = wood;
      c.fillRect(0, 0, W, H);
      // The flag behind the dais.
      for (let i = 0; i < 7; i++) {
        c.fillStyle = i % 2 ? '#f3eee0' : '#9c2f3a';
        c.fillRect(150, 14 + i * 9, 110, 9);
      }
      c.fillStyle = '#26356b';
      c.fillRect(150, 14, 44, 36);
      // The two behind him. One of them has opinions about the speech.
      const ripping = !a.flat;
      person(c, still(186, 112), VEEP, 0);
      const rip = ripping ? (t % 1.7) / 1.7 : 0;
      person(c, still(236, 112, -1), SPEAKER, ripping && rip < 0.25 ? 2 : 0);
      if (ripping) {
        for (const side of [-1, 1]) {
          c.save();
          c.translate(236 + side * (3 + rip * 13), 46 - Math.sin(rip * Math.PI) * 9);
          c.rotate(side * rip * 0.9);
          c.fillStyle = PAPER;
          c.fillRect(-4, -6, 8, 12);
          c.fillStyle = 'rgba(0,0,0,0.25)';
          for (let i = 0; i < 3; i++) c.fillRect(-2.5, -4 + i * 3, 5, 1);
          c.restore();
        }
      }
      c.fillStyle = '#3a2416';
      c.fillRect(140, 80, 160, 26);
      c.fillStyle = '#6b3f24';
      c.fillRect(140, 80, 160, 5);
      // The applause meter. It is his meter.
      const level = clamp01((a.applause ?? 0) * (a.flat ? 1 : 0.85 + 0.15 * Math.sin(t * 9)));
      c.fillStyle = 'rgba(10,15,31,0.75)';
      rr(c, 266, 20, 16, 54, 4);
      c.fill();
      c.fillStyle = level > 0.6 ? GOLD_LIGHT : '#8ff0a8';
      rr(c, 269, 71 - 48 * level, 10, 48 * level, 2);
      c.fill();
      emojiAt(c, '👏', 274, 13, 9);
      // The chamber, which nods off a little earlier every year.
      const asleep = a.flat ? 1 : (a.year ?? 1) * 2;
      for (let i = 0; i < asleep; i++) risingText(c, 'z', 156 + hash(i) * 120, 164, (t + i * 0.47) % 1.6, 1.6, 9 + (i % 3) * 2, '#9db5dd');
      break;
    }
    case 'clinic': {
      c.fillStyle = '#dcebe6';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#b9d2ca';
      c.fillRect(0, 130, W, H - 130);
      // The eye chart. He read it perfectly.
      c.fillStyle = '#ffffff';
      rr(c, 228, 16, 50, 56, 3);
      c.fill();
      c.strokeStyle = '#8fa39c';
      c.lineWidth = 1;
      c.stroke();
      ['B', 'E S', 'T E V', 'E R !'].forEach((row, i) => label(c, row, 253, 26 + i * 12, 13 - i * 2.5, INK));
      c.fillStyle = RED;
      c.fillRect(160, 22, 6, 18);
      c.fillRect(154, 28, 18, 6);
      break;
    }
    case 'count': {
      c.fillStyle = '#0d1430';
      c.fillRect(0, 0, W, H);
      // The big board. Called early, there is nothing on it to call.
      for (let i = 0; i < 48; i++) {
        const lit = a.flat && hash(i + 9) * 48 < t * 6;
        c.fillStyle = lit ? (hash(i) < 0.5 ? RED : BLUE) : '#39415c';
        rr(c, 150 + (i % 12) * 11, 20 + Math.floor(i / 12) * 11, 9, 9, 2);
        c.fill();
      }
      if (a.flat) label(c, `${Math.min(99, Math.floor(t * 12))}% REPORTING`, 215, 72, 8, '#9db5dd');
      else {
        label(c, '0% REPORTING', 215, 72, 8, '#9db5dd');
        if (t > 1.6) {
          c.save();
          c.translate(215, 41);
          c.rotate(-0.14);
          c.strokeStyle = GOLD_LIGHT;
          c.lineWidth = 2.5;
          rr(c, -44, -13, 88, 26, 4);
          c.stroke();
          label(c, 'I WON', 0, 1, 19, GOLD_LIGHT);
          c.restore();
        }
      }
      break;
    }
    case 'summit': {
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#cfe3f2');
      sky.addColorStop(1, '#8fb4d6');
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);
      FLAGS.forEach((color, i) => {
        const x = 152 + i * 20;
        c.fillStyle = '#6f737d';
        c.fillRect(x, 16, 2, 64);
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(x + 2, 18);
        c.lineTo(x + 16, 20 + Math.sin(t * 4 + i) * 2);
        c.lineTo(x + 2, 32);
        c.fill();
      });
      // The other leader, and a handshake that is now a contest.
      const yank = a.flat ? Math.sin(t * 2) * 2 : -Math.abs(Math.sin(t * 5.5)) * 16;
      c.save();
      c.translate(256 + yank, 240);
      c.rotate(a.flat ? 0 : -0.1 - Math.abs(Math.sin(t * 5.5)) * 0.12);
      c.scale(2.3, 2.3);
      person(c, still(0, 0, -1), LEADER, 0);
      c.restore();
      c.strokeStyle = PRESIDENT.suit;
      c.lineWidth = 10;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(118, 160);
      c.lineTo(168 + yank * 0.4, 158);
      c.stroke();
      c.strokeStyle = LEADER.suit;
      c.beginPath();
      c.moveTo(232 + yank, 160);
      c.lineTo(176 + yank * 0.4, 158);
      c.stroke();
      c.lineCap = 'butt';
      c.fillStyle = PRESIDENT.skin;
      c.beginPath();
      c.arc(172 + yank * 0.4, 158, 7, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'studio': {
      c.fillStyle = '#3d322c';
      c.fillRect(0, 0, W, H);
      const spot = c.createRadialGradient(244, 40, 4, 244, 40, 110);
      spot.addColorStop(0, 'rgba(255,240,200,0.4)');
      spot.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = spot;
      c.fillRect(0, 0, W, H);
      // The easel, and what is on it.
      c.strokeStyle = '#8a6a3b';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(226, 60);
      c.lineTo(212, 168);
      c.moveTo(262, 60);
      c.lineTo(276, 168);
      c.moveTo(244, 60);
      c.lineTo(244, 168);
      c.stroke();
      framed(c, 214, 16, 60, 50, !a.flat, () => portraitArt(c, 214, 16, 60, 50, !a.flat));
      if (!a.flat) for (let i = 0; i < 3; i++) emojiAt(c, '✨', 210 + hash(i) * 70, 14 + hash(i + 4) * 54, 9, Math.sin(t * 5 + i * 2));
      break;
    }
    case 'farewell': {
      c.fillStyle = '#e6dcc3';
      c.fillRect(0, 0, W, H);
      // The window behind the desk, with the drapes he picked.
      c.fillStyle = '#9fd0ee';
      c.fillRect(178, 16, 76, 92);
      c.fillStyle = '#4c8f57';
      c.fillRect(178, 84, 76, 24);
      c.strokeStyle = '#fbf8ee';
      c.lineWidth = 3;
      c.strokeRect(178, 16, 76, 92);
      c.beginPath();
      c.moveTo(216, 16);
      c.lineTo(216, 108);
      c.moveTo(178, 60);
      c.lineTo(254, 60);
      c.stroke();
      c.fillStyle = goldFill(c, 160, 10, 20, 110);
      c.fillRect(162, 10, 18, 112);
      c.fillRect(252, 10, 18, 112);
      c.fillStyle = '#9c2f3a';
      c.fillRect(276, 30, 12, 100);
      c.fillStyle = '#26356b';
      c.fillRect(142, 30, 12, 100);
      break;
    }
    case 'hearing': {
      c.fillStyle = '#33241b';
      c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = 0; x < W; x += 30) c.fillRect(x, 0, 15, H);
      // The committee, up on its bench.
      for (let i = 0; i < 4; i++) fan(c, 170 + i * 32, 62, 0, ['#2b2b33', '#56627a', '#6b5a7d', '#3d4a44'][i], null);
      c.fillStyle = '#54311b';
      c.fillRect(146, 56, 154, 22);
      c.fillStyle = '#7a4a2a';
      c.fillRect(146, 56, 154, 4);
      label(c, 'C-SPIN 3', 40, 22, 9, 'rgba(255,255,255,0.7)');
      if (a.empty) {
        // His chair, his name, and the small bottle of water.
        c.fillStyle = '#231710';
        rr(c, 50, 76, 68, 110, 12);
        c.fill();
        c.fillStyle = '#4a2f20';
        rr(c, 56, 82, 56, 100, 9);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < 4; i++) c.fillRect(62, 96 + i * 18, 44, 2);
      }
      c.fillStyle = '#54311b';
      c.fillRect(11, 150, 150, 18);
      c.fillStyle = goldFill(c, 34, 140, 84, 16);
      rr(c, 34, 140, 84, 16, 2);
      c.fill();
      label(c, 'THE PRESIDENT', 76, 148.5, 8, '#3a2a05');
      c.fillStyle = '#cfeaf7';
      rr(c, 134, 132, 8, 20, 3);
      c.fill();
      c.fillStyle = '#3b6fd4';
      c.fillRect(134, 130, 8, 4);
      break;
    }
    case 'news':
      break;
  }
}

/** Whatever he is holding up, drawn over him and under the lower third. */
export function addressProps(c: Ctx, a: Address, t: number): void {
  if (!a.exhibit) return;
  const up = clamp01((t - 1) / 0.35);
  if (up <= 0) return;
  c.save();
  c.translate(247, 144 + (1 - up) ** 2 * 70);
  c.rotate(Math.sin(t * 2.2) * 0.05 + 0.04);
  sheet(c, -39, -22, 78, 44, a.exhibit);
  c.restore();
}

// ---------- Election night ----------

const ELECTION_LINES: Record<'friendly' | 'hostile', string[]> = {
  friendly: ['Look at that map. Beautiful map.', 'I was not on the ballot. And I still won.', 'The biggest midterm win in history. Maybe ever.'],
  hostile: ['Early. It is early. Those do not count.', 'Who colored that one in? Fire them.', 'RIGGED. Also, I won.'],
};
const ELECTION_TICKER: Record<'friendly' | 'hostile', string> = {
  friendly: 'PRESIDENT\'S PARTY HOLDS CONGRESS · PRESIDENT: "MY WIN" · MEMBERS WHO ACTUALLY RAN UNAVAILABLE FOR COMMENT',
  hostile: 'PRESIDENT\'S PARTY LOSES CONGRESS · PRESIDENT BLAMES MACHINES, WEATHER, LETTUCE · NEW CHAIRS ORDER STATIONERY',
};
const BALLOONS = ['#d9282f', '#ffffff', '#3b6fd4', '#f2c230'];

function balloon(c: Ctx, x: number, y: number, r: number, color: string): void {
  c.strokeStyle = 'rgba(255,255,255,0.6)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x, y + r);
  c.quadraticCurveTo(x + 4, y + r * 2, x - 2, y + r * 3);
  c.stroke();
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath();
  c.ellipse(x - r * 0.3, y - r * 0.35, r * 0.2, r * 0.3, -0.5, 0, Math.PI * 2);
  c.fill();
}

/** A ketchup stain: the blob, the spatter around it, and how far it has run. */
function ketchup(c: Ctx, x: number, y: number, r: number, run: number): void {
  c.fillStyle = '#a3161c';
  for (let i = 0; i < 9; i++) {
    const a = hash(i) * Math.PI * 2;
    const d = r * (1.1 + hash(i + 20) * 1.1);
    c.beginPath();
    c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * (0.1 + hash(i + 40) * 0.22), 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * r * 0.42;
    const len = run * r * (1.6 + hash(i + 60) * 2.6);
    rr(c, x + dx - r * 0.09, y, r * 0.18, len, r * 0.09);
    c.fill();
    c.beginPath();
    c.arc(x + dx, y + len, r * 0.13, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#d9282f';
  c.beginPath();
  c.ellipse(x - r * 0.15, y - r * 0.12, r * 0.7, r * 0.52, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.3)';
  c.beginPath();
  c.ellipse(x - r * 0.35, y - r * 0.3, r * 0.2, r * 0.12, -0.5, 0, Math.PI * 2);
  c.fill();
}

/**
 * The midterm result, on a television that drops in over the scene: the map
 * fills in seat by seat, the networks call it, and then there are balloons,
 * or there is ketchup. Screen space, on a 380 by 250 design grid.
 */
export function electionNight(c: Ctx, act: Activity, s: GameState, viewW: number, viewH: number): void {
  if (act.anim !== 'election' || !s.congress) return;
  const won = s.congress === 'friendly';
  const t = act.t;
  const W = 380;
  const H = 250;
  const scale = Math.min((viewW * 0.86) / W, (viewH * 0.8) / H, 1.6);
  const arrive = clamp01(t / ELECTION_SLIDE);
  const leave = clamp01((t - (act.dur - ELECTION_SLIDE)) / ELECTION_SLIDE);
  const shown = Math.min(arrive, 1 - leave);
  const drop = (1 - arrive) ** 3 + leave ** 3;

  c.fillStyle = `rgba(5,7,18,${0.6 * shown})`;
  c.fillRect(0, 0, viewW, viewH);

  c.save();
  c.translate(viewW / 2, viewH * 0.47 - drop * (viewH * 0.5 + H * scale));
  c.scale(scale, scale);
  c.translate(-W / 2, -H / 2);

  // The set itself.
  c.fillStyle = 'rgba(0,0,0,0.4)';
  rr(c, 6, 10, W, H, 14);
  c.fill();
  c.fillStyle = '#14161c';
  rr(c, 0, 0, W, H, 14);
  c.fill();
  c.fillStyle = '#2c303b';
  c.fillRect(W / 2 - 50, H, 100, 7);
  c.save();
  rr(c, 9, 9, W - 18, H - 18, 6);
  c.clip();
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b1338');
  sky.addColorStop(1, '#1d3a80');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);

  c.fillStyle = RED;
  c.fillRect(9, 9, W - 18, 24);
  label(c, 'ELECTION NIGHT', 20, 21.5, 13, '#ffffff', 'left');
  label(c, 'THE MIDTERMS · WHO RUNS CONGRESS', W - 20, 21.5, 8, '#ffd9d4', 'right');

  // The map: fifty seats, called one at a time, in no order anyone can explain.
  const SEATS = 50;
  const share = won ? 0.6 : 0.4;
  const pace = (ELECTION_CALLED - ELECTION_COUNT_FROM - 0.5) / SEATS;
  let his = 0;
  let theirs = 0;
  for (let i = 0; i < SEATS; i++) {
    const at = ELECTION_COUNT_FROM + Math.floor(hash(i + 3) * SEATS) * pace;
    const mine = hash(i + 77) < share;
    const x = 22 + (i % 10) * 23;
    const y = 46 + Math.floor(i / 10) * 23;
    const since = t - at;
    if (since >= 0) {
      if (mine) his += 1;
      else theirs += 1;
    }
    c.fillStyle = since < 0 ? '#39415c' : mine ? RED : BLUE;
    rr(c, x, y, 20, 20, 4);
    c.fill();
    if (since >= 0 && since < 0.3) {
      c.fillStyle = `rgba(255,255,255,${1 - since / 0.3})`;
      rr(c, x, y, 20, 20, 4);
      c.fill();
    }
  }

  // The count, and the line it has to cross.
  const bar = (y: number, n: number, color: string, name: string) => {
    label(c, name, 262, y - 9, 8, '#c9d1dc', 'left');
    c.fillStyle = 'rgba(255,255,255,0.12)';
    rr(c, 262, y, 100, 14, 3);
    c.fill();
    c.fillStyle = color;
    rr(c, 262, y, Math.max(3, n * 2), 14, 3);
    c.fill();
    label(c, String(n), 262 + Math.max(3, n * 2) + 5, y + 7.5, 10, '#ffffff', 'left');
  };
  bar(62, his, RED, 'HIS PARTY');
  bar(104, theirs, BLUE, 'EVERYBODY ELSE');
  c.fillStyle = GOLD_LIGHT;
  c.fillRect(262 + 52, 54, 1.5, 70);
  label(c, 'TO WIN: 26', 314, 133, 7, GOLD_LIGHT);
  label(c, `${Math.round(((his + theirs) / SEATS) * 100)}% REPORTING`, 312, 150, 8, '#9db5dd');

  // The president, in a box in the corner, watching it come in.
  const called = t >= ELECTION_CALLED;
  const talking = shown >= 1;
  c.save();
  c.translate(58, 262 + (talking ? Math.sin(t * 7) * 1.2 : 0));
  c.scale(2, 2);
  person(c, still(0, 0), PRESIDENT, 0);
  c.fillStyle = '#7a2a1c';
  const open = talking ? 0.7 + Math.abs(Math.sin(t * 15)) * 2.2 : 0.7;
  rr(c, 2.5, -45.5, 5, open, Math.min(1, open / 2));
  c.fill();
  c.restore();

  if (called) {
    const since = t - ELECTION_CALLED;
    const pop = 1 + Math.max(0, 0.3 - since) * 1.4;
    c.save();
    c.translate(131, 103);
    c.scale(pop, pop);
    c.rotate(-0.06);
    c.fillStyle = won ? goldFill(c, -108, -22, 216, 44) : '#14161c';
    rr(c, -108, -22, 216, 44, 6);
    c.fill();
    c.strokeStyle = won ? GOLD_DARK : RED;
    c.lineWidth = 3;
    c.stroke();
    label(c, won ? 'CONGRESS: HELD' : 'CONGRESS: LOST', 0, 1, 22, won ? '#3a2a05' : '#ff8a7a');
    c.restore();
  }

  // The crawl.
  c.fillStyle = '#0a0f1f';
  c.fillRect(9, H - 31, W - 18, 22);
  const crawl = called ? ELECTION_TICKER[s.congress] : 'COUNTING CONTINUES · PRESIDENT "NOT WORRIED," SAYS PRESIDENT · POLLS CLOSED IN MOST PLACES';
  c.font = '700 9px system-ui, sans-serif';
  const width = c.measureText(crawl).width + 80;
  const from = called ? t - ELECTION_CALLED : t;
  for (let x = W - ((from * 70) % width) - 20; x < W; x += width) label(c, crawl, x, H - 19.5, 9, '#ffe9a8', 'left');

  if (talking && t < act.dur - ELECTION_SLIDE) {
    const lines = ELECTION_LINES[s.congress];
    const n = called ? 2 : t < ELECTION_COUNT_FROM + 3 ? 0 : 1;
    const since = n === 2 ? t - ELECTION_CALLED - 0.5 : n === 1 ? t - ELECTION_COUNT_FROM - 3 : t - ELECTION_SLIDE;
    const until = n === 2 ? act.dur - ELECTION_SLIDE - t : n === 1 ? ELECTION_CALLED - t : ELECTION_COUNT_FROM + 3 - t;
    speech(c, lines[n], 152, 200, clamp01(Math.min(since / 0.2, until / 0.25)));
  }

  // Lost: the bottle leaves his hand, and the screen takes it.
  if (!won && t >= ELECTION_THROW) {
    const fly = clamp01((t - ELECTION_THROW) / (ELECTION_SPLAT - ELECTION_THROW));
    if (fly < 1) {
      c.save();
      c.translate(70 + (300 - 70) * fly, 170 + (62 - 170) * fly - Math.sin(fly * Math.PI) * 40);
      c.rotate(fly * 9);
      c.fillStyle = RED;
      rr(c, -5, -10, 10, 20, 3);
      c.fill();
      c.fillStyle = '#ffffff';
      c.fillRect(-3, -15, 6, 6);
      c.restore();
    } else {
      const age = t - ELECTION_SPLAT;
      ketchup(c, 300, 62, 14 + Math.min(1, age / 0.12) * 12, clamp01(age / 3));
      risingText(c, 'SPLAT', 300, 30, age, 0.8, 16, '#ffffff');
    }
  }
  c.restore();
  // Glass, and the name on the set.
  c.fillStyle = 'rgba(255,255,255,0.04)';
  c.beginPath();
  c.moveTo(9, 9);
  c.lineTo(180, 9);
  c.lineTo(80, H - 9);
  c.lineTo(9, H - 9);
  c.fill();
  c.restore();

  // Won: the balloons come down over everything, with the confetti.
  if (won && t >= ELECTION_CALLED) {
    const since = t - ELECTION_CALLED;
    c.globalAlpha = 1 - leave;
    for (let i = 0; i < 22; i++) {
      const x = hash(i) * viewW + Math.sin(since * 1.4 + i) * 16;
      const y = -40 + (since - hash(i + 30) * 1.6) * (90 + hash(i + 50) * 70);
      if (y > -40) balloon(c, x, y, 13 + hash(i + 9) * 7, BALLOONS[i % BALLOONS.length]);
    }
    for (let i = 0; i < 60; i++) {
      const y = ((since * (120 + hash(i) * 120) + hash(i + 5) * viewH) % (viewH + 20)) - 10;
      c.fillStyle = BALLOONS[i % BALLOONS.length];
      c.fillRect(hash(i + 11) * viewW + Math.sin(since * 3 + i) * 8, y, 4, 7);
    }
    c.globalAlpha = 1;
  }
}

// ---------- On the lawn ----------

/** The patch of grass to the right of the monuments, where the day's props go up. */
const LOT = { x: 62 * T, y: 30.4 * T };
/** The longer patch to the right of the buildings. */
const SIDE = { x: 53.6 * T, y: 40.6 * T };

const DOCTOR: Look = { suit: '#f4f4f0', skin: '#e9c09a', hair: '#9a9ca6', tie: '#3b6fd4' };
const HISTORIAN: Look[] = [
  { suit: '#7a6a4f', skin: '#e9c09a', hair: '#c9c2b5', tie: '#5c6b3a' },
  { suit: '#5d5a66', skin: '#d6a67e', hair: '#4a3728' },
];
const COURIER: Look = { suit: '#6b4a2e', skin: '#e9c09a', hair: '#2b2118' };

function lectern(c: Ctx, x: number, y: number, tipped: boolean, time: number): void {
  // Two panes of glass with the speech on them, or two panes of glass on the grass.
  for (const side of [-1, 1]) {
    c.save();
    c.translate(x + side * 34, y);
    if (tipped) c.rotate(side * 1.35);
    c.strokeStyle = '#6f737d';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -38);
    c.stroke();
    c.fillStyle = 'rgba(190,225,245,0.55)';
    c.save();
    c.translate(0, -44);
    c.rotate(side * -0.25);
    c.fillRect(-9, -8, 18, 14);
    if (!tipped) {
      c.fillStyle = 'rgba(20,22,28,0.6)';
      for (let i = 0; i < 3; i++) c.fillRect(-6, -5 + ((i * 4 + time * 3) % 10), 12, 1.5);
    }
    c.restore();
    c.restore();
  }
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(x, y, 16, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#54311b';
  rr(c, x - 11, y - 34, 22, 34, 3);
  c.fill();
  c.fillStyle = '#7a4a2a';
  rr(c, x - 13, y - 38, 26, 8, 3);
  c.fill();
  c.fillStyle = GOLD;
  c.beginPath();
  c.arc(x, y - 17, 6, 0, Math.PI * 2);
  c.fill();
}

function weighIn(c: Ctx, x: number, y: number, take: Take | undefined, time: number): void {
  // The scale, which has seen things.
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(x - 10, y, 20, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#8d939e';
  rr(c, x - 26, y - 7, 32, 7, 2);
  c.fill();
  c.fillRect(x - 12, y - 46, 4, 40);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(x - 10, y - 52, 11, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6f737d';
  c.lineWidth = 2;
  c.stroke();
  const spin = take === 'boast' ? time * 11 : Math.sin(time * 2.4) * (take ? 0.3 : 0.9);
  c.strokeStyle = RED;
  c.beginPath();
  c.moveTo(x - 10, y - 52);
  c.lineTo(x - 10 + Math.sin(spin) * 9, y - 52 - Math.cos(spin) * 9);
  c.stroke();
  // The doctor, and his one-page summary.
  person(c, still(x + 30, y, -1), DOCTOR, 0);
  emojiAt(c, '📋', x + 16, y - 30, 13);
  if (take === 'boast') risingText(c, '7\'0"?', x + 30, y - 78, time % 2.6, 1.4, 10, '#ffffff');
  else if (take === 'modest') risingText(c, '"ADEQUATE"', x + 30, y - 78, time % 2.6, 1.4, 9, '#c9d1dc');
}

function easel(c: Ctx, x: number, y: number, take: Take | undefined, time: number): void {
  c.strokeStyle = '#8a6a3b';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x - 6, y - 62);
  c.lineTo(x - 18, y);
  c.moveTo(x + 6, y - 62);
  c.lineTo(x + 18, y);
  c.moveTo(x, y - 62);
  c.lineTo(x, y - 6);
  c.stroke();
  const w = 36;
  const h = 44;
  const top = y - 68;
  if (take === 'skipped') {
    // It went up without him seeing it. The easel is all that is left.
  } else if (!take) {
    // Under a sheet until he is allowed to look.
    c.fillStyle = '#efe6d2';
    rr(c, x - w / 2 - 3, top - 3, w + 6, h + 10, 4);
    c.fill();
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 4; i++) c.fillRect(x - w / 2 + 4 + i * 9, top, 2, h + 6);
    label(c, '?', x, top + h / 2, 16, 'rgba(0,0,0,0.25)');
  } else {
    framed(c, x - w / 2, top, w, h, take === 'boast', () => portraitArt(c, x - w / 2, top, w, h, take === 'boast'));
  }
  // The painter. She describes it as honest.
  const painting = take === 'boast';
  woman(c, still(x + 38, y, -1), { skin: '#e2b08a', hair: '#3a2c22', dress: '#56627a', trim: '#3d4658' }, 0);
  emojiAt(c, painting ? '🖌️' : '🎨', x + 23, y - 30 + (painting ? Math.sin(time * 9) * 5 : 0), 13);
  if (painting) risingText(c, ['MORE GOLD?', 'A LION. FINE.', 'NOT SIGNING IT'][Math.floor(time / 2.8) % 3], x + 38, y - 74, time % 2.8, 1.5, 9, '#ffffff');
}

function movingTruck(c: Ctx, x: number, y: number, staying: boolean, time: number): void {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.beginPath();
  c.ellipse(x, y + 1, 56, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#f3eee0';
  rr(c, x - 30, y - 50, 78, 42, 4);
  c.fill();
  c.fillStyle = '#3b4f8f';
  rr(c, x - 54, y - 36, 26, 28, 5);
  c.fill();
  c.fillStyle = '#bfe0ff';
  rr(c, x - 50, y - 32, 14, 11, 2);
  c.fill();
  c.fillStyle = '#1b1f2e';
  for (const wx of [-40, 8, 34]) {
    c.beginPath();
    c.arc(x + wx, y - 6, 7, 0, Math.PI * 2);
    c.fill();
  }
  label(c, staying ? 'ON HOLD' : 'MOVERS', x + 9, y - 34, 11, staying ? RED : '#3b4f8f');
  label(c, staying ? '"we will see"' : 'est. every 4 years', x + 9, y - 21, 6, '#6b7080');
  // The boxes: on their way out, or on their way back in.
  for (let i = 0; i < 5; i++) {
    const bx = x + 58 + (i % 3) * 16 - (i > 2 ? -8 : 0);
    const by = y - (i > 2 ? 13 : 0);
    c.fillStyle = '#a87c4f';
    c.fillRect(bx - 7, by - 13, 14, 13);
    c.fillStyle = '#c9a37a';
    c.fillRect(bx - 7, by - 13, 14, 3);
    c.fillStyle = GOLD_LIGHT;
    c.fillRect(bx - 1, by - 13, 2, 13);
  }
  if (staying) risingText(c, ['SIR? THE TRUCK?', 'WE CHARGE BY THE HOUR', 'IN OR OUT, SIR?'][Math.floor(time / 3) % 3], x - 40, y - 60, time % 3, 1.6, 9, '#ffffff');
}

function cake(c: Ctx, x: number, y: number, candles: number, time: number): void {
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(x, y, 30, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#8a6a3b';
  c.fillRect(x - 30, y - 8, 60, 8);
  const tiers: [number, number, string][] = [[26, 16, '#f7d6e0'], [19, 14, '#ffffff'], [12, 12, '#f7d6e0']];
  let top = y - 8;
  for (const [half, h, color] of tiers) {
    c.fillStyle = color;
    rr(c, x - half, top - h, half * 2, h, 3);
    c.fill();
    c.fillStyle = GOLD;
    c.fillRect(x - half, top - h + 4, half * 2, 2.5);
    top -= h;
  }
  for (let i = 0; i < candles; i++) {
    const cx = x - 9 + (i * 18) / Math.max(1, candles - 1);
    c.fillStyle = '#3b6fd4';
    c.fillRect(cx - 1, top - 8, 2, 8);
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.ellipse(cx, top - 11, 2, 3 + Math.sin(time * 13 + i) * 1, 0, 0, Math.PI * 2);
    c.fill();
  }
  label(c, 'HAPPY BIRTHDAY, SIR', x, y - 15, 5.5, '#b3282d');
}

function yardSign(c: Ctx, x: number, y: number, his: boolean, lean: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(lean);
  c.fillStyle = '#8a6a3b';
  c.fillRect(-1, -12, 2, 12);
  c.fillStyle = his ? RED : BLUE;
  rr(c, -11, -24, 22, 13, 2);
  c.fill();
  label(c, his ? 'HIM' : 'NOT HIM', 0, -17, his ? 8 : 5, '#ffffff');
  c.restore();
}

function campaignBus(c: Ctx, x: number, y: number, time: number): void {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.beginPath();
  c.ellipse(x, y + 1, 84, 9, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#f3eee0';
  rr(c, x - 78, y - 52, 156, 46, 8);
  c.fill();
  c.fillStyle = RED;
  c.fillRect(x - 78, y - 24, 156, 9);
  c.fillStyle = '#26356b';
  c.fillRect(x - 78, y - 15, 156, 7);
  c.fillStyle = '#bfe0ff';
  for (let i = 0; i < 6; i++) {
    rr(c, x - 70 + i * 24, y - 47, 19, 13, 2);
    c.fill();
  }
  c.fillStyle = '#1b1f2e';
  for (const wx of [-52, 50]) {
    c.beginPath();
    c.arc(x + wx, y - 6, 8, 0, Math.PI * 2);
    c.fill();
  }
  label(c, 'THE "IT\'S ABOUT ME" TOUR', x, y - 29, 8, '#b3282d');
  // His face on the side, in case anybody forgets whose midterms these are.
  emojiAt(c, '📣', x + 66, y - 60 + Math.sin(time * 6) * 1.5, 13);
}

function beachSet(c: Ctx, x: number, y: number, time: number): void {
  // Staff, with Congress away: chairs, an umbrella, and something with ice in it.
  for (let i = 0; i < 3; i++) {
    const cx = x + i * 54;
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.ellipse(cx, y, 20, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8a6a3b';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - 14, y);
    c.lineTo(cx + 6, y - 14);
    c.moveTo(cx - 4, y);
    c.lineTo(cx + 14, y - 26);
    c.stroke();
    c.fillStyle = ['#e9862f', '#2f8f83', '#d9282f'][i];
    c.save();
    c.translate(cx + 5, y - 13);
    c.rotate(-0.9);
    c.fillRect(-14, -3, 28, 6);
    c.restore();
    fan(c, cx - 1, y - 6, 0, ['#f3ead6', '#bfe0ff', '#f7d6e0'][i], i === 1 ? '#f2c230' : null);
    emojiAt(c, i === 1 ? '🍹' : '🕶️', cx + 15, y - 9 - (i === 1 ? Math.abs(Math.sin(time * 2)) * 2 : 0), 10);
  }
  // The umbrella.
  const ux = x + 27;
  c.strokeStyle = '#f3eee0';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(ux, y - 2);
  c.lineTo(ux, y - 62);
  c.stroke();
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i % 2 ? '#ffffff' : RED;
    c.beginPath();
    c.moveTo(ux, y - 62);
    c.arc(ux, y - 50, 34, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
    c.fill();
  }
  risingText(c, ['OUT OF OFFICE', 'BACK IN SEPTEMBER', 'IS HE LOOKING?'][Math.floor(time / 3.2) % 3], x + 54, y - 76, time % 3.2, 1.6, 9, '#ffffff');
}

function tumbleweed(c: Ctx, time: number): void {
  const span = REGIONS.dc.w + 160;
  const x = ((time * 70) % span) - 80;
  const y = 53.4 * T - Math.abs(Math.sin(time * 3.1)) * 9;
  c.save();
  c.translate(x, y);
  c.rotate(time * 4);
  c.strokeStyle = '#b89a5e';
  c.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.ellipse(0, 0, 11, 5 + (i % 3) * 2, (i * Math.PI) / 6, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

function flagRow(c: Ctx, x: number, y: number, time: number): void {
  // The carpet they walk up, and a flag for every leader who was promised a gift shop.
  c.fillStyle = '#9c2f3a';
  c.fillRect(x - 12, y + 2, FLAGS.length * 30 + 12, 9);
  c.fillStyle = GOLD;
  c.fillRect(x - 12, y + 2, FLAGS.length * 30 + 12, 1.5);
  FLAGS.forEach((color, i) => {
    const fx = x + i * 30;
    c.fillStyle = '#d7dbe2';
    c.fillRect(fx - 1, y - 52, 2, 52);
    c.fillStyle = GOLD;
    c.beginPath();
    c.arc(fx, y - 53, 2.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(fx + 1, y - 50);
    c.quadraticCurveTo(fx + 11, y - 53 + Math.sin(time * 4 + i) * 3, fx + 21, y - 49 + Math.sin(time * 4 + i + 1) * 2);
    c.lineTo(fx + 21, y - 36 + Math.sin(time * 4 + i + 1) * 2);
    c.quadraticCurveTo(fx + 11, y - 40 + Math.sin(time * 4 + i) * 3, fx + 1, y - 37);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = 1;
    c.stroke();
  });
}

function boxPile(c: Ctx, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const bx = x + col * 17 + (row % 2) * 8;
    const by = y - row * 12;
    c.fillStyle = '#8a6a3b';
    c.fillRect(bx, by - 13, 15, 13);
    c.fillStyle = '#c9a37a';
    c.fillRect(bx, by - 13, 15, 3);
    c.fillStyle = PAPER;
    c.fillRect(bx + 4, by - 8, 7, 4);
  }
}

// ---------- On the walls ----------

/** The corridor wall: one frame for every day he would like remembered, and a few he would not. */
function gallery(c: Ctx, s: GameState): void {
  const y = 17 * T - 5;
  const days = taken(s, 'set-hundred-days');
  if (days) {
    sheet(c, 31.2 * T, y, 20, 22, {
      title: '',
      big: days === 'boast' ? 'A++' : days === 'modest' ? 'B−' : '?',
      small: '',
      gold: days === 'boast',
    });
  }
  const physical = taken(s, 'set-physical');
  if (physical) {
    c.fillStyle = PAPER;
    c.fillRect(33.2 * T, y, 18, 22);
    c.fillStyle = RED;
    c.fillRect(33.2 * T + 7, y + 3, 4, 10);
    c.fillRect(33.2 * T + 4, y + 6, 10, 4);
    label(c, physical === 'boast' ? '7\'0"' : physical === 'modest' ? 'OK' : 'LEAK', 33.2 * T + 9, y + 17.5, 6, INK);
  }
  const summit = taken(s, 'set-summit-host');
  if (summit && summit !== 'skipped') {
    framed(c, 35.2 * T, y + 1, 24, 18, summit === 'boast', () => {
      c.fillStyle = summit === 'boast' ? '#e9b99a' : '#c9c2b5';
      c.fillRect(35.2 * T, y + 1, 24, 18);
      emojiAt(c, summit === 'boast' ? '🧾' : '🤝', 35.2 * T + 12, y + 10.5, 11);
    });
  }
  const portrait = taken(s, 'set-portrait');
  if (portrait === 'skipped') {
    // Next to the fire exit, where he has never looked.
    framed(c, 63.4 * T, y - 3, 18, 24, false, () => portraitArt(c, 63.4 * T, y - 3, 18, 24, false));
    c.fillStyle = '#2f8f57';
    c.fillRect(64.7 * T, y + 2, 17, 8);
    label(c, 'EXIT', 64.7 * T + 8.5, y + 6.5, 6, '#ffffff');
  } else if (portrait) {
    const heroic = portrait === 'boast';
    const w = heroic ? 30 : 22;
    framed(c, 42 * T - w / 2, y - 6, w, 28, heroic, () => portraitArt(c, 42 * T - w / 2, y - 6, w, 28, heroic));
  }
}

function banner(c: Ctx, text: string, time: number): void {
  const x = 30.5 * T;
  const w = 18 * T;
  const y = 21.9 * T;
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.fillRect(x + 3, y + 5, w, 26);
  c.fillStyle = '#fbf8ee';
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w, y + 24);
  c.quadraticCurveTo(x + w / 2, y + 28 + Math.sin(time * 2) * 1.5, x, y + 24);
  c.fill();
  c.fillStyle = RED;
  c.fillRect(x, y, w, 4);
  c.fillStyle = '#26356b';
  c.fillRect(x, y + 4, 26, 18);
  c.fillRect(x + w - 26, y + 4, 26, 18);
  emojiAt(c, '⭐', x + 13, y + 13, 10);
  emojiAt(c, '⭐', x + w - 13, y + 13, 10);
  let size = 15;
  c.font = `700 ${size}px system-ui, sans-serif`;
  while (size > 8 && c.measureText(text).width > w - 64) {
    size -= 1;
    c.font = `700 ${size}px system-ui, sans-serif`;
  }
  label(c, text, x + w / 2, y + 14, size, '#b3282d');
}

// ---------- The historians ----------

const trail: { x: number; y: number; t: number; facing: 1 | -1 }[] = [];
const NOTES = ['HM.', 'NOTED.', '"TREMENDOUS," HE SAYS', 'IS THAT GOLD?', 'HOW DO YOU SPELL THAT', 'FOR THE RECORD...'];
const STEERING = ['WRITE DOWN THE GOLD', 'PUT "BEST EVER"', 'THE ARCH. MENTION THE ARCH', 'NOT THAT. LOOK OVER HERE', 'BIGGER THAN LINCOLN. WRITE IT'];

/** Where he was a moment ago, which is where a historian is now. */
function trailing(time: number, ago: number): { x: number; y: number; facing: 1 | -1; moving: boolean } | null {
  const at = time - ago;
  for (let i = trail.length - 1; i > 0; i--) {
    if (trail[i - 1].t <= at) {
      const a = trail[i - 1];
      const b = trail[i];
      return { x: a.x, y: a.y, facing: a.facing, moving: Math.hypot(b.x - a.x, b.y - a.y) > 0.5 };
    }
  }
  return trail.length > 0 ? { ...trail[0], moving: false } : null;
}

// ---------- What the frame draws ----------

const SOTU_MONTHS = Object.entries(SET_PIECE_MONTHS).filter(([, id]) => id.startsWith('set-sotu')).map(([month]) => Number(month));
const BIRTHDAYS = [6, 18, 30, 42];
const RECESSES = [8, 20, 32, 44];
const CAMPAIGN = [21, 22, 23, 24];
const LEGACY_FROM = 43;
/** Where each yard sign is, and the order in which they go over to the other side. */
const SIGNS = Array.from({ length: 16 }, (_, i) => ({ x: (3.5 + i * 4.1) * T, turn: Math.floor(hash(i + 13) * 16) }));

/** His share of the yard signs: half of them at the bar, and all or none a long way either side of it. */
const signShare = (s: GameState): number => clamp01(0.5 + (s.stability - MIDTERM_BAR) / 50);

/** Flat on the ground or on the walls of Washington: drawn before anybody is. */
export function decorFlat(c: Ctx, sim: Sim, s: GameState): void {
  if (s.place !== 'dc') return;
  const time = sim.time;
  gallery(c, s);
  const days = taken(s, 'set-hundred-days');
  if (days === 'boast') banner(c, 'THE GREATEST 100 DAYS IN HISTORY', time);
  else if (s.month === 4) banner(c, '100 DAYS', time);
  // What election night left on the wall of the Oval Office.
  if (s.congress === 'hostile' && !s.broadcast) ketchup(c, 24.4 * T, 2.5 * T, 8, 1);
  if (s.month === 30) flagRow(c, SIDE.x + 14, SIDE.y, time);
  if (RECESSES.includes(s.month)) tumbleweed(c, time);
  if (CAMPAIGN.includes(s.month)) {
    const his = Math.round(signShare(s) * SIGNS.length);
    SIGNS.forEach((sign, i) => yardSign(c, sign.x, 51.9 * T, sign.turn < his, (hash(i) - 0.5) * 0.24));
  }
  // A hostile House sends for boxes, and the boxes pile up by the gate.
  if (s.congress === 'hostile' && s.month >= 25 && s.month <= 36) boxPile(c, 57.6 * T, 24.6 * T, Math.min(15, 3 + heat(s) * 2 + Math.floor((s.month - 25) / 2)));
}

/** Standing on the lawn: sorted in with the people and the furniture. */
export function decorStanding(c: Ctx, sim: Sim, s: GameState, standing: Standing): void {
  const time = sim.time;

  // The historians go wherever he goes, a few steps behind.
  const p = sim.pres;
  const last = trail[trail.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) > 240) trail.length = 0;
  trail.push({ x: p.x, y: p.y, t: time, facing: p.facing });
  while (trail.length > 2 && trail[1].t < time - 2.5) trail.shift();
  const flying = Boolean(sim.activity?.flight || sim.activity?.sleep);
  if (s.month >= LEGACY_FROM && !flying) {
    HISTORIAN.forEach((look, i) => {
      const at = trailing(time, 0.75 + i * 0.6);
      if (!at) return;
      const x = at.x - at.facing * (38 + i * 24);
      const y = at.y + (i ? 9 : -7);
      standing.push({
        y,
        draw: () => {
          person(c, { x, y, path: at.moving ? [{ x, y }] : [], facing: p.x >= x ? 1 : -1, walk: time + i }, look, 0);
          emojiAt(c, '📝', x + (p.x >= x ? 13 : -13), y - 30 + (at.moving ? 0 : Math.abs(Math.sin(time * 14 + i)) * 2), 11);
          const n = Math.floor((time + i * 2.3) / 4.6);
          if (!at.moving) risingText(c, NOTES[(n + i * 3) % NOTES.length], x, y - 72, (time + i * 2.3) % 4.6, 1.5, 9, '#d8ccb0');
        },
      });
    });
  }

  if (s.place !== 'dc') return;
  const { x, y } = LOT;
  const piece = SET_PIECE_MONTHS[s.month];
  if (SOTU_MONTHS.includes(s.month)) standing.push({ y, draw: () => lectern(c, x, y, taken(s, piece) === 'boast', time) });
  if (piece === 'set-physical') standing.push({ y, draw: () => weighIn(c, x - 6, y, taken(s, piece), time) });
  if (piece === 'set-portrait') standing.push({ y, draw: () => easel(c, x - 12, y, taken(s, piece), time) });
  if (piece === 'set-farewell') standing.push({ y, draw: () => movingTruck(c, x - 14, y, (s.stats.wontLeave ?? 0) > 0, time) });
  if (BIRTHDAYS.includes(s.month)) standing.push({ y, draw: () => cake(c, x, y, 3 + BIRTHDAYS.indexOf(s.month), time) });
  if (RECESSES.includes(s.month)) standing.push({ y: SIDE.y, draw: () => beachSet(c, SIDE.x + 30, SIDE.y, time) });
  if (CAMPAIGN.includes(s.month)) standing.push({ y: 49.6 * T, draw: () => campaignBus(c, 61 * T, 49.6 * T, time) });
  // The balloons from election night, still up in the corner of the Oval Office.
  if (s.congress === 'friendly' && !s.broadcast) {
    standing.push({
      y: 4.2 * T,
      draw: () => BALLOONS.slice(0, 3).forEach((color, i) => balloon(c, 37.2 * T + i * 11, 4 * T + Math.sin(time * 1.3 + i * 2) * 2 - (i === 1 ? 7 : 0), 8, color)),
    });
  }
  // Couriers from the Hill, in a line at the gate, each with something to sign for.
  if (s.congress === 'hostile' && s.month >= 25 && s.month <= 36) {
    for (let i = 0; i < 3; i++) {
      const cy = (22.6 + i * 1.5) * T;
      standing.push({
        y: cy,
        draw: () => {
          person(c, still(69.3 * T, cy, -1), COURIER, 0);
          emojiAt(c, '✉️', 69.3 * T - 14, cy - 30 + Math.sin(time * 2 + i) * 1.5, 11);
        },
      });
    }
  }
}

/** Over everything in the world: what flies past, and what he is attached to. */
export function decorOver(c: Ctx, sim: Sim, s: GameState): void {
  const time = sim.time;
  const p = sim.pres;
  const busy = Boolean(sim.activity?.flight || sim.activity?.sleep);

  if (s.month >= LEGACY_FROM && !busy && !sim.activity && p.path.length === 0) {
    const n = Math.floor(time / 5.2);
    risingText(c, STEERING[n % STEERING.length], p.x, p.y - 104, (time % 5.2) - 2.6, 1.8, 10, GOLD_LIGHT);
  }
  if (s.place !== 'dc') return;

  // He said he might not leave, and has taken steps.
  if ((s.stats.wontLeave ?? 0) > 0 && !busy) {
    const from = { x: 28 * T, y: 8 * T - 4 };
    const to = { x: p.x, y: p.y - 4 };
    const links = Math.max(4, Math.floor(Math.hypot(to.x - from.x, to.y - from.y) / 9));
    const sag = Math.min(40, 600 / links);
    for (let i = 0; i <= links; i++) {
      const u = i / links;
      c.fillStyle = i % 2 ? '#8d939e' : '#d7dbe2';
      c.beginPath();
      c.ellipse(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u + Math.sin(u * Math.PI) * sag, 3.5, 2.5, 0, 0, Math.PI * 2);
      c.fill();
    }
    emojiAt(c, '🔒', from.x, from.y - 2, 12);
  }

  // The birthday flyover, towing a banner somebody should have proofread.
  if (BIRTHDAYS.includes(s.month)) {
    const span = REGIONS.dc.w + 900;
    const x = ((time * 150) % (span + 700)) - 420;
    const y = 24.4 * T + Math.sin(time * 1.1) * 6;
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - 20, y);
    c.lineTo(x - 52, y);
    c.stroke();
    c.fillStyle = '#ffffff';
    rr(c, x - 330, y - 9, 280, 18, 3);
    c.fill();
    c.strokeStyle = RED;
    c.lineWidth = 1.5;
    c.stroke();
    label(c, 'HAPPY BIRTHDAY MR. PRESDIENT', x - 190, y + 0.5, 12, '#b3282d');
    for (let i = 0; i < 3; i++) {
      const jx = x + i * 26;
      const jy = y + (i - 1) * 13 * (i === 1 ? 0 : 1);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(jx - 60, jy - 1, 44, 2);
      c.fillStyle = '#c9d1dc';
      c.beginPath();
      c.moveTo(jx + 16, jy);
      c.lineTo(jx - 14, jy - 4);
      c.lineTo(jx - 8, jy);
      c.lineTo(jx - 14, jy + 4);
      c.fill();
      c.beginPath();
      c.moveTo(jx + 2, jy);
      c.lineTo(jx - 8, jy - 11);
      c.lineTo(jx - 4, jy);
      c.lineTo(jx - 8, jy + 11);
      c.fill();
    }
  }
}

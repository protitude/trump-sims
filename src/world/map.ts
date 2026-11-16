import type { DutyKind, GameState, Place, Vehicle } from '../game/types.ts';

// The world is a grid of 20px tiles holding three separate places. Washington
// fills the top: the White House (four rooms over a corridor) with the South
// Lawn below it. Mar-a-Lago sits further down the grid, and the roof of the
// tower in New York is tucked in beside it. Each is cut off by blocked tiles
// and reached only by air. Everything here is measured in tiles unless a name
// says "px".

export const T = 20;
export const COLS = 70;
export const ROWS = 90;
export const WORLD_W = COLS * T;
export const WORLD_H = ROWS * T;

export type Tile = [number, number];
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The part of the world belonging to each place, in pixels. */
export const REGIONS: Record<Place, Rect> = {
  dc: { x: 0, y: 0, w: 70 * T, h: 55 * T },
  maralago: { x: 0, y: 58 * T, w: 50 * T, h: 32 * T },
  newyork: { x: 50 * T, y: 60 * T, w: 20 * T, h: 25 * T },
};

/** The roof of the tower in New York: all of it, and the part that can be walked on. */
export const ROOF: Rect = { x: 52, y: 62, w: 16, h: 21 };
const ROOF_FLOOR: Rect = { x: 53, y: 65, w: 14, h: 17 };

export interface Room {
  name: string;
  rect: Rect;
  floor: string;
}

export const ROOMS: Room[] = [
  { name: 'RESIDENCE', rect: { x: 3, y: 3, w: 13, h: 14 }, floor: '#b98a5e' },
  { name: 'OVAL OFFICE', rect: { x: 17, y: 3, w: 22, h: 14 }, floor: '#e6dcc3' },
  { name: 'CABINET ROOM', rect: { x: 40, y: 3, w: 14, h: 14 }, floor: '#a8794f' },
  { name: 'PRESS ROOM', rect: { x: 55, y: 3, w: 12, h: 14 }, floor: '#7f93b5' },
  { name: '', rect: { x: 3, y: 18, w: 64, h: 4 }, floor: '#9c2f3a' },
];

export interface WorldObject {
  id: string;
  name: string;
  /** Selects the drawing routine in draw.ts. */
  kind: string;
  rect: Rect;
  /** Tile the president stands on to use it. */
  spot: Tile;
  /** Vanity action ids offered here. */
  actions: string[];
  blocking: boolean;
  /** Which place it is in. Washington unless stated. */
  place?: Place;
  /** Furniture that is only scenery. */
  inert?: boolean;
  /** Vanity action that must be done before this exists at all. */
  needs?: string;
  special?: 'bed' | 'melania';
}

const RENAMES = [
  'rename-airport',
  'rename-arts',
  'rename-gulf',
  'rename-park',
  'rename-highways',
  'rename-battleship',
  'rename-month',
  'rename-tuesday',
  'rename-dollar',
  'rename-moon',
];

export const OBJECTS: WorldObject[] = [
  // Residence
  { id: 'bed', name: 'Bed', kind: 'bed', rect: { x: 4, y: 4, w: 5, h: 5 }, spot: [9, 7], actions: [], blocking: true, special: 'bed' },
  { id: 'toilet', name: 'Toilet', kind: 'toilet', rect: { x: 13, y: 4, w: 2, h: 2 }, spot: [13, 6], actions: ['gild-toilet'], blocking: true },

  // Oval Office
  { id: 'fireplace', name: 'Fireplace', kind: 'fireplace', rect: { x: 19, y: 3, w: 4, h: 2 }, spot: [21, 5], actions: ['gild-fireplace'], blocking: true },
  { id: 'desk', name: 'The Desk', kind: 'desk', rect: { x: 25, y: 5, w: 6, h: 3 }, spot: [28, 8], actions: ['gild-desk', 'gild-soda-button'], blocking: true },
  { id: 'phone', name: 'The Phone', kind: 'phone', rect: { x: 33, y: 5, w: 2, h: 2 }, spot: [33, 7], actions: ['show-call', 'gild-phone'], blocking: true },
  { id: 'portraits', name: 'Presidential Portraits', kind: 'portraits', rect: { x: 32, y: 2, w: 6, h: 1 }, spot: [35, 3], actions: ['gild-portraits'], blocking: false },
  { id: 'carpet', name: 'The Carpet', kind: 'carpet', rect: { x: 22, y: 10, w: 12, h: 6 }, spot: [28, 12], actions: ['gild-carpet'], blocking: false },
  { id: 'bigmap', name: 'The Big Map', kind: 'bigmap', rect: { x: 18, y: 11, w: 2, h: 4 }, spot: [20, 13], actions: RENAMES, blocking: true },

  // Cabinet Room
  { id: 'table', name: 'Cabinet Table', kind: 'table', rect: { x: 43, y: 7, w: 8, h: 4 }, spot: [42, 9], actions: [], blocking: true, inert: true },
  { id: 'constitution', name: 'The Constitution', kind: 'constitution', rect: { x: 51, y: 4, w: 2, h: 2 }, spot: [51, 6], actions: ['gild-constitution'], blocking: true },

  // Press Room
  { id: 'podium', name: 'Podium', kind: 'podium', rect: { x: 60, y: 5, w: 2, h: 2 }, spot: [60, 7], actions: [], blocking: true, inert: true },

  // South Lawn: garden, then two rows of building lots, then the showgrounds.
  { id: 'garden', name: 'Rose Garden', kind: 'garden', rect: { x: 6, y: 25, w: 9, h: 5 }, spot: [10, 30], actions: ['gild-garden', 'build-helipad', 'gild-helicopter', 'trip-maralago-heli', 'trip-newyork-heli'], blocking: true },
  { id: 'plot-arch', name: 'Triumphal Arch', kind: 'plot', rect: { x: 18, y: 27, w: 6, h: 5 }, spot: [21, 32], actions: ['build-arch'], blocking: true },
  { id: 'plot-statue', name: '90-Foot Gold Statue', kind: 'plot', rect: { x: 29, y: 27, w: 4, h: 5 }, spot: [31, 32], actions: ['build-statue'], blocking: true },
  { id: 'plot-mountain', name: 'Your Face On The Mountain', kind: 'plot', rect: { x: 38, y: 27, w: 7, h: 5 }, spot: [41, 32], actions: ['build-mountain'], blocking: true },
  { id: 'plot-space-arch', name: 'Arch Visible From Space', kind: 'plot', rect: { x: 51, y: 27, w: 8, h: 5 }, spot: [55, 32], actions: ['build-space-arch'], blocking: true },
  { id: 'plot-ballroom', name: 'The Grand Ballroom', kind: 'plot', rect: { x: 18, y: 37, w: 7, h: 5 }, spot: [21, 42], actions: ['build-ballroom', 'show-state-dinner'], blocking: true },
  { id: 'plot-giftshop', name: 'The Gift Shop', kind: 'plot', rect: { x: 31, y: 37, w: 7, h: 5 }, spot: [34, 42], actions: ['build-giftshop'], blocking: true },
  { id: 'plot-dome', name: 'The Golden Dome', kind: 'plot', rect: { x: 44, y: 37, w: 7, h: 5 }, spot: [47, 42], actions: ['build-dome'], blocking: true },
  { id: 'golf', name: 'Putting Green', kind: 'golf', rect: { x: 4, y: 34, w: 11, h: 7 }, spot: [9, 37], actions: ['show-golf'], blocking: false },
  { id: 'stage', name: 'Rally Stage', kind: 'stage', rect: { x: 6, y: 46, w: 8, h: 4 }, spot: [10, 45], actions: ['show-rally'], blocking: true },
  { id: 'stand', name: 'Parade Reviewing Stand', kind: 'stand', rect: { x: 20, y: 47, w: 7, h: 3 }, spot: [23, 46], actions: ['show-parade'], blocking: true },
  { id: 'plane', name: 'The Plane', kind: 'plane', rect: { x: 40, y: 45, w: 15, h: 6 }, spot: [47, 44], actions: ['trip-maralago', 'gild-plane'], blocking: true },

  // Mar-a-Lago
  { id: 'mal-bed', name: 'Bed', kind: 'bed', rect: { x: 5, y: 62, w: 4, h: 4 }, spot: [9, 64], actions: [], blocking: true, special: 'bed', place: 'maralago' },
  { id: 'mal-ballroom', name: 'The Ballroom', kind: 'malballroom', rect: { x: 12, y: 61, w: 6, h: 2 }, spot: [15, 63], actions: ['gild-mal-ballroom'], blocking: true, place: 'maralago' },
  { id: 'mal-dj', name: 'The Tablet', kind: 'dj', rect: { x: 21, y: 62, w: 3, h: 2 }, spot: [22, 64], actions: ['resort-dj'], blocking: true, place: 'maralago' },
  { id: 'mal-patio', name: 'Your Table', kind: 'patio', rect: { x: 12, y: 67, w: 7, h: 3 }, spot: [15, 70], actions: ['resort-dinner'], blocking: true, place: 'maralago' },
  { id: 'mal-desk', name: 'Membership Desk', kind: 'memberdesk', rect: { x: 25, y: 68, w: 4, h: 2 }, spot: [27, 70], actions: ['resort-memberships'], blocking: true, place: 'maralago' },
  { id: 'mal-pool', name: 'Pool', kind: 'pool', rect: { x: 35, y: 62, w: 10, h: 7 }, spot: [34, 65], actions: [], blocking: true, inert: true, place: 'maralago' },
  { id: 'mal-golf', name: 'The Course', kind: 'malgolf', rect: { x: 5, y: 76, w: 18, h: 8 }, spot: [14, 80], actions: ['resort-golf'], blocking: false, place: 'maralago' },
  { id: 'mal-plane', name: 'The Plane', kind: 'plane', rect: { x: 29, y: 80, w: 15, h: 6 }, spot: [36, 79], actions: ['trip-home'], blocking: true, place: 'maralago' },
  { id: 'mal-helipad', name: 'Helipad', kind: 'helipad', rect: { x: 37, y: 72, w: 5, h: 5 }, spot: [39, 77], actions: ['trip-home-heli'], blocking: true, place: 'maralago', needs: 'build-helipad' },

  // New York: the roof of the tower. Only the helicopter can land here.
  { id: 'ny-melania', name: 'Melania', kind: 'melania', rect: { x: 58, y: 66, w: 2, h: 3 }, spot: [56, 68], actions: [], blocking: true, place: 'newyork', special: 'melania' },
  { id: 'ny-bed', name: 'The Spare Bed', kind: 'bed', rect: { x: 54, y: 75, w: 4, h: 4 }, spot: [58, 77], actions: [], blocking: true, special: 'bed', place: 'newyork' },
  { id: 'ny-helipad', name: 'Helipad', kind: 'helipad', rect: { x: 61, y: 73, w: 5, h: 5 }, spot: [63, 78], actions: ['trip-home-heli-ny'], blocking: true, place: 'newyork' },
];

const byId = (id: string) => OBJECTS.find((o) => o.id === id)!;

/** The bed that ends the month in each place. */
export const BEDS: Record<Place, WorldObject> = { dc: byId('bed'), maralago: byId('mal-bed'), newyork: byId('ny-bed') };
const ARRIVALS: Record<Vehicle, Record<Place, Tile>> = {
  // No plane can land on the roof in New York; the entry is there for completeness.
  plane: { dc: byId('plane').spot, maralago: byId('mal-plane').spot, newyork: byId('ny-helipad').spot },
  heli: { dc: byId('garden').spot, maralago: byId('mal-helipad').spot, newyork: byId('ny-helipad').spot },
};

/** Where the president steps out after a trip. */
export const arrival = (s: GameState): Tile => ARRIVALS[s.vehicle ?? 'plane'][s.place];

/** True once the object has been built into the world. */
export const exists = (o: WorldObject, s: GameState): boolean => !o.needs || Boolean(s.done[o.needs]);

/** What the object is called now; the Rose Garden does not stay one. */
export const objectName = (o: WorldObject, s: GameState): string =>
  o.id === 'garden' && s.done['build-helipad'] ? 'Helipad' : o.name;

/** Where visitors wait. The president stands two tiles to their left. */
const ZONES: Record<'cabinet' | 'press' | 'oval', Tile[]> = {
  cabinet: [
    [44, 13],
    [47, 13],
    [50, 13],
  ],
  press: [
    [58, 10],
    [61, 10],
    [64, 10],
  ],
  oval: [
    [23, 9],
    [33, 9],
    [36, 12],
    [36, 15],
  ],
};

const ZONE_FOR: Record<DutyKind, keyof typeof ZONES> = {
  briefing: 'cabinet',
  decision: 'cabinet',
  press: 'press',
  call: 'oval',
  crisis: 'oval',
  hybrid: 'oval',
};

/** First free waiting spot for a visitor, preferring the room that suits them. */
export function waitingSpot(kind: DutyKind, taken: Tile[]): Tile {
  const free = (t: Tile) => !taken.some((o) => o[0] === t[0] && o[1] === t[1]);
  const preferred = ZONES[ZONE_FOR[kind]].find(free);
  return preferred ?? Object.values(ZONES).flat().find(free) ?? ZONES.oval[0];
}

/** Visitors arrive and leave through the east door. */
export const ENTRANCE: Tile = [69, 19];

/** Guests at Mar-a-Lago come and go by the east gate. */
export const CLUB_GATE: Tile = [47, 71];

/** Where guests stand around at the club. The president stands two tiles to their left. */
const CLUB_SPOTS: Tile[] = [
  [27, 65],
  [31, 65],
  [24, 73],
  [30, 74],
];

/** First free standing spot for a guest at the club. */
export function guestSpot(taken: Tile[]): Tile {
  return CLUB_SPOTS.find((t) => !taken.some((o) => o[0] === t[0] && o[1] === t[1])) ?? CLUB_SPOTS[0];
}

// ---------- Idle scenes ----------

/** What the president drifts into when left standing about. */
export type IdleKind = 'press' | 'briefing' | 'dictate' | 'toilet' | 'nap' | 'cart' | 'dinner' | 'rain';

/** The club itself at Mar-a-Lago: the terrace, which counts as indoors. */
const CLUB: Rect = { x: 4, y: 61, w: 28, h: 13 };

/** Poolside at Mar-a-Lago: right of the club, above the helipad. */
const POOLSIDE: Rect = { x: 32, y: 60, w: 16, h: 12 };

const inRoom = (t: Tile, name: string): boolean => {
  const r = ROOMS.find((room) => room.name === name)!.rect;
  return t[0] >= r.x && t[0] < r.x + r.w && t[1] >= r.y && t[1] < r.y + r.h;
};

/** The idle scene that suits where he is standing, if any. */
export function idleKindAt(place: Place, p: Point): IdleKind | null {
  const t = tileAt(p);
  // On the grass with nobody watching, he takes the cart out.
  const g = GOLF[place]?.rect;
  if (g && t[0] >= g.x && t[0] < g.x + g.w && t[1] >= g.y && t[1] < g.y + g.h) return 'cart';
  // On the roof he is being watched, and behaves.
  if (place === 'newyork') return null;
  // By the pool he throws money in it, and watches them scramble.
  if (place === 'maralago' && t[0] >= POOLSIDE.x && t[0] < POOLSIDE.x + POOLSIDE.w && t[1] >= POOLSIDE.y && t[1] < POOLSIDE.y + POOLSIDE.h) return 'rain';
  // Inside the club he takes his table, and the members come to him.
  // Out in the grounds, the press can always find him.
  if (place === 'maralago') return t[0] >= CLUB.x && t[0] < CLUB.x + CLUB.w && t[1] >= CLUB.y && t[1] < CLUB.y + CLUB.h ? 'dinner' : 'press';
  if (inRoom(t, 'RESIDENCE')) return 'toilet';
  if (inRoom(t, 'OVAL OFFICE')) return 'dictate';
  if (inRoom(t, 'CABINET ROOM')) return 'nap';
  if (inRoom(t, 'PRESS ROOM')) return 'briefing';
  return t[1] >= 23 ? 'press' : null;
}

/** Where he walks to for an idle scene, and the exact pixel he sits (or stands) at. */
export const IDLE_SEATS: Record<Exclude<IdleKind, 'press' | 'cart'>, { tile: Tile; seat: Point; facing: 1 | -1; stand?: boolean }> = {
  // Behind the podium, looking out over the chairs.
  briefing: { tile: [60, 4], seat: { x: 61 * T, y: 5 * T - 1 }, facing: 1, stand: true },
  // Behind the desk, tucked against its back edge.
  dictate: { tile: [28, 4], seat: { x: 28 * T, y: 5 * T - 1 }, facing: -1 },
  // On the bowl, just in front of it so he is drawn over it.
  toilet: { tile: [13, 6], seat: { x: 14 * T, y: 6 * T + 1 }, facing: 1 },
  // The second chair along the far side of the cabinet table.
  nap: { tile: [46, 6], seat: { x: 46 * T + 2, y: 7 * T - 1 }, facing: 1 },
  // The middle chair on the far side of his table at the club.
  dinner: { tile: [15, 66], seat: { x: 12 * T + 69, y: 67 * T - 1 }, facing: 1 },
  // At the left edge of the pool, facing the water.
  rain: { tile: [34, 65], seat: { x: 34 * T + 6, y: 65 * T + 14 }, facing: 1, stand: true },
};

/** Around the pool's edge, where the aide scrambles after the bills. */
export const AIDE_GRAB: Tile[] = [
  [34, 63],
  [37, 69],
  [34, 67],
  [41, 69],
  [36, 61],
  [40, 61],
];

/** The aide takes dictation in front of the desk. */
export const AIDE_SPOT: Tile = [26, 9];

/** The one room the aide may not enter. */
export const inCabinetRoom = (p: Point): boolean => inRoom(tileAt(p), 'CABINET ROOM');

/** The stretch of corridor outside the Cabinet Room door, where she waits it out. */
export const AIDE_PACE: [Tile, Tile] = [
  [43, 20],
  [50, 20],
];

/** The golf in each place, and the loop the cart is driven around on it, in pixels. */
const GOLF: Partial<Record<Place, WorldObject>> = { dc: byId('golf'), maralago: byId('mal-golf') };
export function cartLoop(place: Place): { cx: number; cy: number; rx: number; ry: number } {
  const r = GOLF[place]!.rect;
  const ry = (r.h * T) / 2 - 24;
  return { cx: (r.x + r.w / 2) * T, cy: (r.y + r.h / 2) * T + 8, rx: Math.min((r.w * T) / 2 - 40, ry * 1.8), ry };
}

// ---------- Collision grid ----------

const wall = new Uint8Array(COLS * ROWS);
const blocked = new Uint8Array(COLS * ROWS);

function fill(grid: Uint8Array, r: Rect, value: number): void {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y * COLS + x] = value;
}

const WALLS: Rect[] = [
  { x: 2, y: 2, w: 66, h: 1 },
  { x: 2, y: 22, w: 66, h: 1 },
  { x: 2, y: 2, w: 1, h: 21 },
  { x: 67, y: 2, w: 1, h: 21 },
  { x: 3, y: 17, w: 64, h: 1 },
  { x: 16, y: 3, w: 1, h: 14 },
  { x: 39, y: 3, w: 1, h: 14 },
  { x: 54, y: 3, w: 1, h: 14 },
];

const DOORS: Rect[] = [
  { x: 9, y: 17, w: 2, h: 1 },
  { x: 27, y: 17, w: 2, h: 1 },
  { x: 46, y: 17, w: 2, h: 1 },
  { x: 60, y: 17, w: 2, h: 1 },
  { x: 27, y: 22, w: 2, h: 1 },
  { x: 50, y: 22, w: 2, h: 1 },
  { x: 67, y: 19, w: 1, h: 2 },
];

for (const r of WALLS) fill(wall, r, 1);
for (const r of DOORS) fill(wall, r, 0);
blocked.set(wall);
// Everything below Washington is impassable except the grounds of Mar-a-Lago,
// which leaves a ring of sea around the resort.
fill(blocked, { x: 0, y: 55, w: COLS, h: ROWS - 55 }, 1);
fill(blocked, { x: 2, y: 60, w: 46, h: 28 }, 0);
// The roof in New York, inside its parapet.
fill(blocked, ROOF_FLOOR, 0);
for (const o of OBJECTS) if (o.blocking) fill(blocked, o.rect, 1);

export function isWall(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && wall[ty * COLS + tx] === 1;
}

export function isBlocked(tx: number, ty: number): boolean {
  return tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || blocked[ty * COLS + tx] === 1;
}

export function tileCenter(t: Tile): Point {
  return { x: t[0] * T + T / 2, y: t[1] * T + T / 2 };
}

export function tileAt(p: Point): Tile {
  return [Math.floor(p.x / T), Math.floor(p.y / T)];
}

/** Closest walkable tile to the one given (which may be inside furniture). */
export function nearestFree(t: Tile): Tile {
  const tx = Math.max(0, Math.min(COLS - 1, t[0]));
  const ty = Math.max(0, Math.min(ROWS - 1, t[1]));
  for (let r = 0; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!isBlocked(tx + dx, ty + dy)) return [tx + dx, ty + dy];
      }
    }
  }
  return [tx, ty];
}

/** True if a body can walk the straight line between two points. */
function clearLine(a: Point, b: Point): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return true;
  // Check the center line and both shoulders so corners are not clipped.
  const nx = (-dy / len) * 7;
  const ny = (dx / len) * 7;
  const steps = Math.ceil(len / 6);
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (dx * i) / steps;
    const y = a.y + (dy * i) / steps;
    for (const s of [-1, 0, 1]) {
      if (isBlocked(Math.floor((x + nx * s) / T), Math.floor((y + ny * s) / T))) return false;
    }
  }
  return true;
}

/**
 * Route from a pixel position to a tile: breadth-first search over the grid,
 * then straightened so people walk diagonals instead of staircases.
 */
export function findPath(from: Point, to: Tile): Point[] {
  const start = nearestFree(tileAt(from));
  const goal = nearestFree(to);
  const startIndex = start[1] * COLS + start[0];
  const goalIndex = goal[1] * COLS + goal[0];
  const cameFrom = new Int32Array(COLS * ROWS).fill(-1);
  cameFrom[startIndex] = startIndex;
  const queue = [startIndex];
  for (let head = 0; head < queue.length && cameFrom[goalIndex] === -1; head++) {
    const current = queue[head];
    const cx = current % COLS;
    const cy = (current - cx) / COLS;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBlocked(nx, ny)) continue;
      const next = ny * COLS + nx;
      if (cameFrom[next] !== -1) continue;
      cameFrom[next] = current;
      queue.push(next);
    }
  }
  if (cameFrom[goalIndex] === -1) return [];

  const tiles: Point[] = [];
  for (let i = goalIndex; i !== startIndex; i = cameFrom[i]) {
    tiles.push(tileCenter([i % COLS, Math.floor(i / COLS)]));
  }
  tiles.reverse();

  const path: Point[] = [];
  let anchor = from;
  let i = 0;
  while (i < tiles.length) {
    let far = i;
    for (let j = tiles.length - 1; j > i; j--) {
      if (clearLine(anchor, tiles[j])) {
        far = j;
        break;
      }
    }
    path.push(tiles[far]);
    anchor = tiles[far];
    i = far + 1;
  }
  return path;
}

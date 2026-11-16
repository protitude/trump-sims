import { VANITY, cardById } from './content.ts';
import { SET_PIECE_MONTHS } from './story.ts';
import type { Effects, GameState, VanityAction } from './types.ts';

// The shape of the four-year term: seasons that bend the rules for a while,
// and the whims the president takes up every six months.

export interface Season {
  id: string;
  name: string;
  /** One line for the HUD saying what is different. */
  note: string;
  months: number[];
  /** Visitors dealt per month (default 3). */
  visitors?: number;
  /** Added to the monthly Stability drift. */
  drift?: number;
  /** Added to the monthly Ego decay. */
  egoDecay?: number;
  /** Multiplier on the Ego from matching vanity actions. */
  boost?: { match: (a: VanityAction) => boolean; times: number; noFade?: boolean };
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const SEASONS: Season[] = [
  {
    id: 'recess',
    name: 'August Recess',
    note: 'Congress is away. Only two visitors this month.',
    months: [8, 20, 32, 44],
    visitors: 2,
  },
  {
    id: 'birthday',
    name: 'Your Birthday',
    note: 'A parade this month is worth double.',
    months: [6, 18, 30, 42],
    boost: { match: (a) => a.id === 'show-parade', times: 2, noFade: true },
  },
  {
    id: 'campaign',
    name: 'Midterm Campaign',
    note: 'Rallies give half as much Ego again. The world is distracted: −1 Stability a month. Stability on election night decides Congress.',
    months: range(21, 24),
    drift: 1,
    boost: { match: (a) => a.id === 'show-rally', times: 1.5, noFade: true },
  },
  {
    id: 'legacy',
    name: 'Legacy Season',
    note: 'The end is in sight. Big projects and renames give 30% more Ego, but Ego drains 2 faster.',
    months: range(43, 48),
    egoDecay: 2,
    boost: { match: (a) => a.category === 'build' || a.category === 'rename', times: 1.3 },
  },
];

/** Applies from the month after a lost midterm until the end of year three. */
const HOSTILE_CONGRESS: Season = {
  id: 'hostile',
  name: 'Hostile Congress',
  note: 'You lost the midterms. Hearings and subpoenas cost 1 extra Stability a month.',
  months: range(25, 36),
  drift: 1,
};

export const MIDTERM_MONTH = 24;
/** Stability needed on election night to keep Congress. */
export const MIDTERM_BAR = 50;

export function activeSeasons(s: GameState): Season[] {
  const active = SEASONS.filter((season) => season.months.includes(s.month));
  if (s.congress === 'hostile' && HOSTILE_CONGRESS.months.includes(s.month)) active.push(HOSTILE_CONGRESS);
  return active;
}

/** The next thing on the calendar, for the "coming up" line. */
export function comingUp(s: GameState): { name: string; inMonths: number } | null {
  for (let month = s.month + 1; month <= Math.min(48, s.month + 6); month++) {
    const piece = SET_PIECE_MONTHS[month];
    if (piece) return { name: cardById(piece).title, inMonths: month - s.month };
    const season = SEASONS.find((x) => x.months[0] === month || (x.months.includes(month) && !x.months.includes(month - 1)));
    if (season) return { name: season.name, inMonths: month - s.month };
  }
  return null;
}

// ---------- Whims ----------

export interface Whim {
  id: string;
  title: string;
  text: string;
  /** Which running count it watches (see GameState.stats). */
  stat: string;
  target: number;
  reward: Effects;
  /** Hidden from the offer when it can no longer be completed. */
  possible?: (s: GameState) => boolean;
}

const remaining = (s: GameState, category: string) =>
  VANITY.filter((v) => v.category === category && !v.repeatable && !s.done[v.id]).length;

export const WHIM_MONTHS = 6;
export const WHIM_FAIL_EGO = -4;

export const WHIMS: Whim[] = [
  { id: 'name-three', title: 'Name Three Things', text: 'Three things out there still have the wrong name on them.', stat: 'rename', target: 3, reward: { ego: 12 }, possible: (s) => remaining(s, 'rename') >= 3 },
  { id: 'gold-fever', title: 'Gold Fever', text: 'Gild four things. It does not matter which four.', stat: 'gild', target: 4, reward: { ego: 10, gold: 2 }, possible: (s) => remaining(s, 'gild') >= 4 },
  { id: 'groundbreaking', title: 'Groundbreaking', text: 'Finish one big project. Something people can see from the road.', stat: 'build', target: 1, reward: { ego: 10 }, possible: (s) => remaining(s, 'build') >= 1 },
  { id: 'man-of-the-people', title: 'Man Of The People', text: 'Hold three rallies. The people have been asking. You have been told.', stat: 'rally', target: 3, reward: { ego: 12 } },
  { id: 'florida-man', title: 'Florida Man', text: 'Do five things at Mar-a-Lago. Washington will manage. Probably.', stat: 'resort', target: 5, reward: { ego: 12, gold: 1 } },
  { id: 'pay-to-play', title: 'Pay To Play', text: 'Take the coin from three guests at Mar-a-Lago. They came all this way.', stat: 'bribes', target: 3, reward: { ego: 10, coin: 2 } },
  { id: 'eighteen-holes', title: 'Tournament Form', text: 'Play golf four times, on either course.', stat: 'golf', target: 4, reward: { ego: 9 } },
  { id: 'post-through-it', title: 'Post Through It', text: 'Have Natalie post at 3am three times. The followers are waiting.', stat: 'post', target: 3, reward: { ego: 9 } },
  { id: 'speed-dial', title: 'Speed Dial', text: 'Call three people and tell them off. They know what they did.', stat: 'call', target: 3, reward: { ego: 9 } },
  { id: 'unfiltered', title: 'Unfiltered', text: 'Take the fun option five times. Advisers are for other people.', stat: 'vain', target: 5, reward: { ego: 12 } },
  { id: 'statesman', title: 'Statesman Phase', text: 'Take the responsible option six times. Somebody said you could not.', stat: 'responsible', target: 6, reward: { stability: 8, ego: 8 } },
  { id: 'open-door', title: 'Open Door', text: 'Deal with twelve visitors. You were promised a sticker.', stat: 'duties', target: 12, reward: { stability: 6, ego: 8 } },
  { id: 'clean-desk', title: 'Clean Desk', text: 'End three months with nobody left waiting.', stat: 'cleanMonths', target: 3, reward: { stability: 6, ego: 10 } },
  { id: 'parade-ground', title: 'Parade Ground', text: 'Hold two military parades. One was not enough tanks.', stat: 'parade', target: 2, reward: { ego: 12 } },
];

export function whimById(id: string): Whim {
  const whim = WHIMS.find((w) => w.id === id);
  if (!whim) throw new Error(`Unknown whim: ${id}`);
  return whim;
}

/** Progress on the current whim, capped at its target. */
export function whimProgress(s: GameState): { whim: Whim; done: number; monthsLeft: number } | null {
  if (!s.whim) return null;
  const whim = whimById(s.whim.id);
  const done = Math.min(whim.target, (s.stats[whim.stat] ?? 0) - s.whim.base);
  return { whim, done, monthsLeft: s.whim.deadline - s.month + 1 };
}

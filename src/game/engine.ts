import type { Effects, GameState, Mood, Tone, VanityAction, DutyCard } from './types.ts';
import { CRISES, DUTIES, HYBRIDS, VANITY, cardById, vanityById } from './content.ts';
import { CHOICE_STATS, CONSEQUENCES, HEARING_MONTHS, SET_PIECE_MONTHS, VOTE_MONTH } from './story.ts';
import { CHAOS, chaosById } from './chaos.ts';
import type { ChaosOutcome } from './chaos.ts';
import { GUESTS, guestById } from './guests.ts';
import { CALLEES, calleeAt } from './calls.ts';
import { SUITS } from './suits.ts';
import { MELANIA_INSULTS } from './melania.ts';
import { MIDTERM_BAR, MIDTERM_MONTH, WHIMS, WHIM_FAIL_EGO, WHIM_MONTHS, activeSeasons, whimById } from './calendar.ts';

// Pure game rules. Every action takes a state and returns a new one, so the
// UI and the balance simulator (scripts/sim.ts) share exactly the same logic.

export const TOTAL_MONTHS = 48;
export const BLOCKS_PER_MONTH = 5;

/** Tuning knobs. Change these, then run `npm run sim` to see the effect. */
export const TUNING = {
  startEgo: 70,
  startStability: 70,
  egoDecay: 6,
  /** Extra monthly ego decay per build or rename completed. */
  egoInflation: 0.36,
  stabilityDrift: 2,
  dutiesPerMonth: 3,
  hybridChance: 0.2,
  ignoredPerCrisis: 4,
  renameFade: 0.9,
  showFade: 0.92,
  showFloor: 0.4,
  sulkingBelow: 25,
  unleashedAbove: 85,
  unleashedPenalty: 5,
  /** Most consequences that can land in one month. */
  sequelsPerMonth: 2,
  /** Base chance of a chaos event at the start of a month. */
  chaosChance: 0.1,
  /** Added to the chance for every month played: 22% at month 12, 34% at month 24. */
  chaosRamp: 0.01,
  chaosPerYear: 6,
  /** Odds of a good, mixed or bad outcome: favorable choice, then deflection. */
  chaosOdds: [
    [0.6, 0.25, 0.15],
    [0.3, 0.3, 0.4],
  ],
  /** Odds that blowback from an ignored event is bad, severe, or fizzles. */
  blowbackOdds: [0.7, 0.25, 0.05],
  /** Chance that ignoring an event brings two rounds of blowback, not one. */
  blowbackTwice: 0.5,
  /** Guests waiting at Mar-a-Lago each month. */
  guestsPerMonth: 2,
  /** Time blocks it takes to hear a guest out and take the coin. */
  bribeCost: 1,
  /** Ego lost by sending a guest away. */
  declineEgo: -2,
  /** Chance that a bribe leaks. Rolled once, when it is taken. */
  leakChance: 0.1,
  /** A leak takes back this many times what the bribe gave. */
  leakTimes: 3,
  /** A leak becomes news this many months later, at the earliest and the latest. */
  leakDelay: [1, 6],
  /** Coin it costs to send Natalie out for lunch. */
  lunchCost: 1,
  /** Chance that lunch disagrees with him and ends the month on the spot. */
  lunchSickChance: 0.3,
  /** Coin it costs to press the Diet Coke button. */
  cokeCost: 2,
  /** Time blocks a Diet Coke gives back. */
  cokeBlocks: 1,
  /** Coin the Lawyer bills for a lawsuit. */
  sueCost: 3,
  /** What a lawsuit does. It costs no time, once a month. */
  sueEffects: { ego: 1, stability: -2 } as Effects,
  /** Coin Melania takes to turn up at an event. */
  melaniaCost: 5,
  /** What asking her does to him. */
  melaniaEgo: -2,
  /** Stability her appearance adds to the event she turns up at. */
  melaniaStability: 2,
  /** Every this-many take-out orders, the doctor insists on a physical. */
  physicalEvery: 5,
  /** Extra Ego at the next rally, where he brags about passing it. */
  physicalRallyEgo: 2,
  /** Coin the Gift Shop pays every month once it is built. */
  giftShopCoin: 1,
  /** Ego decay the Statue takes off while he is Sulking. */
  statueComfort: 2,
  /** Time blocks the Golden Dome takes off one crisis. */
  domeBlocks: 1,
  /** Heat at which a hostile House impeaches him. */
  impeachAt: 4,
  /** Heat from each bribe that has been exposed. */
  heatPerLeak: 2,
  /** Lawsuits it takes to add one heat. */
  suitsPerHeat: 3,
  /** What the vote does to him, impeached or not. */
  impeachedEffects: { ego: -10, stability: -6 } as Effects,
  survivedEffects: { ego: 6 } as Effects,
};

/** mulberry32, with the seed carried in the state so games are replayable. */
function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pick<T>(s: GameState, items: T[]): T {
  return items[Math.floor(rand(s) * items.length)];
}

function shuffled<T>(s: GameState, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function log(s: GameState, text: string, tone: Tone): void {
  s.log.unshift({ month: s.month, text, tone });
  if (s.log.length > 80) s.log.length = 80;
}

function apply(s: GameState, fx: Effects): void {
  s.ego = Math.min(100, Math.round(s.ego + (fx.ego ?? 0)));
  s.stability = Math.min(100, Math.round(s.stability + (fx.stability ?? 0)));
  s.gold += fx.gold ?? 0;
  s.names += fx.names ?? 0;
  s.coin += fx.coin ?? 0;
}

function count(s: GameState, stat: string, by = 1): void {
  s.stats[stat] = (s.stats[stat] ?? 0) + by;
}

function checkEnd(s: GameState): void {
  if (s.status !== 'playing') return;
  if (s.stability <= 0) {
    s.stability = 0;
    s.status = 'ww3';
    log(s, 'World War III has begun.', 'bad');
  } else if (s.ego <= 0) {
    s.ego = 0;
    s.status = 'depression';
    log(s, 'You have gone to bed and are not getting up.', 'bad');
  }
}

/** A crisis or opportunity the player has not seen yet (any, once all are used). */
function freshSpecial(s: GameState, pool: DutyCard[]): string {
  const unseen = pool.filter((c) => !s.usedSpecials.includes(c.id));
  const id = pick(s, unseen.length > 0 ? unseen : pool).id;
  s.usedSpecials.push(id);
  return id;
}

function drawInbox(s: GameState): void {
  s.inbox = [];
  const seasons = activeSeasons(s);
  let normal = seasons.reduce((n, season) => Math.min(n, season.visitors ?? n), TUNING.dutiesPerMonth);

  // The calendar's set piece arrives on top of everything else.
  const piece = SET_PIECE_MONTHS[s.month];
  if (piece) s.inbox.push(piece);
  // A hostile Congress has a calendar of its own.
  const hearing = s.congress === 'hostile' ? HEARING_MONTHS[s.month] : undefined;
  if (hearing) s.inbox.push(hearing);

  if (s.crisisPending) {
    s.crisisPending = false;
    s.inbox.push(freshSpecial(s, CRISES));
    normal -= 1;
  }

  // Consequences of earlier choices take the place of ordinary visitors.
  const due = s.pending.filter((p) => p.due <= s.month).slice(0, Math.min(TUNING.sequelsPerMonth, Math.max(0, normal)));
  for (const p of due) {
    s.inbox.push(p.card);
    s.usedSpecials.push(p.card);
    normal -= 1;
  }
  s.pending = s.pending.filter((p) => !due.includes(p));

  for (let i = 0; i < normal; i++) {
    if (s.deck.length === 0) s.deck = shuffled(s, DUTIES.map((d) => d.id));
    s.inbox.push(s.deck.pop()!);
  }
  if (rand(s) < TUNING.hybridChance) s.inbox.push(freshSpecial(s, HYBRIDS));
}

/** Remembers that a choice will come back later, and counts the ones the game keeps a tally of. */
function plant(s: GameState, key: string): void {
  const tally = CHOICE_STATS[key];
  if (tally) count(s, tally[0], tally[1]);
  const consequence = CONSEQUENCES[key];
  if (!consequence) return;
  // Each consequence happens once per game, even if two choices lead to it.
  if (s.pending.some((p) => p.card === consequence.card) || s.usedSpecials.includes(consequence.card)) return;
  const due = s.month + consequence.after;
  if (due <= TOTAL_MONTHS) s.pending.push({ card: consequence.card, due });
}

// ---------- Whims ----------

function offerWhims(s: GameState): void {
  const pool = WHIMS.filter((w) => !w.possible || w.possible(s));
  s.whimOffer = shuffled(s, pool)
    .slice(0, 3)
    .map((w) => w.id);
}

/** Pays out the current whim if it has been met. */
function settleWhim(s: GameState): void {
  if (!s.whim || s.status !== 'playing') return;
  const whim = whimById(s.whim.id);
  if ((s.stats[whim.stat] ?? 0) - s.whim.base < whim.target) return;
  apply(s, whim.reward);
  count(s, 'whimsDone');
  log(s, `Whim satisfied: ${whim.title}. You feel, briefly, like enough.`, 'good');
  s.whim = null;
}

export function chooseWhim(state: GameState, id: string): GameState {
  if (state.status !== 'playing' || !state.whimOffer.includes(id)) return state;
  const s = structuredClone(state);
  const whim = whimById(id);
  s.whim = { id, base: s.stats[whim.stat] ?? 0, deadline: s.month + WHIM_MONTHS - 1 };
  s.whimOffer = [];
  log(s, `New whim: ${whim.title}.`, 'neutral');
  return s;
}

// ---------- Chaos ----------

const yearOf = (month: number) => Math.ceil(month / 12);

/** Picks an index from a list of odds that add up to 1. */
function roll(s: GameState, odds: number[]): number {
  let r = rand(s);
  for (let i = 0; i < odds.length - 1; i++) {
    if (r < odds[i]) return i;
    r -= odds[i];
  }
  return odds.length - 1;
}

function toneOf(fx: Effects): Tone {
  const net = (fx.ego ?? 0) + (fx.stability ?? 0);
  return net > 0 ? 'good' : net < 0 ? 'bad' : 'neutral';
}

function landChaos(s: GameState, eyebrow: string, title: string, outcome: ChaosOutcome): void {
  apply(s, outcome.effects);
  log(s, outcome.text, toneOf(outcome.effects));
  s.reveals.push({ eyebrow, title, text: outcome.text, effects: outcome.effects });
}

/** Blowback from ignored events that falls due this month. */
function landBlowback(s: GameState): void {
  const due = s.blowback.filter((b) => b.due <= s.month);
  s.blowback = s.blowback.filter((b) => !due.includes(b));
  for (const b of due) {
    const event = chaosById(b.id);
    landChaos(s, 'Blowback · you ignored this', event.title, event.ignore.blowback[roll(s, TUNING.blowbackOdds)]);
  }
}

/** A chaos event may strike at the start of a month, more likely as the months go by, up to a yearly cap. */
function rollChaos(s: GameState): void {
  const struck = rand(s) < TUNING.chaosChance + TUNING.chaosRamp * s.month;
  const thisYear = s.chaosMonths.filter((m) => yearOf(m) === yearOf(s.month)).length;
  if (!struck || thisYear >= TUNING.chaosPerYear) return;
  const unseen = CHAOS.filter((c) => !s.usedChaos.includes(c.id));
  const event = pick(s, unseen.length > 0 ? unseen : CHAOS);
  s.chaos = event.id;
  s.usedChaos.push(event.id);
  s.chaosMonths.push(s.month);
  log(s, `Chaos: ${event.title}.`, 'bad');
}

/**
 * Answers the chaos event. 0 is the favorable choice, 1 the deflection.
 * The outcome is rolled here, so the player cannot know it in advance.
 * Ignoring does nothing now and comes back later in the same year.
 */
export function resolveChaos(state: GameState, choice: 0 | 1 | 'ignore'): GameState {
  if (state.status !== 'playing' || !state.chaos) return state;
  const event = chaosById(state.chaos);
  if (choice !== 'ignore' && event.choices[choice].cost > state.blocks) return state;

  const s = structuredClone(state);
  s.chaos = null;
  count(s, 'chaos');

  if (choice === 'ignore') {
    log(s, event.ignore.text, 'neutral');
    s.reveals.push({ eyebrow: 'Ignored · for now', title: event.title, text: event.ignore.text, effects: {} });
    // Blowback lands in later months of this year, or next month if the year is nearly over.
    const yearEnd = yearOf(s.month) * 12;
    const months = shuffled(
      s,
      Array.from({ length: yearEnd - s.month }, (_, i) => s.month + 1 + i),
    );
    // In the last month of the term there is no later, so it lands at once.
    if (months.length === 0) months.push(Math.min(s.month + 1, TOTAL_MONTHS));
    const hits = rand(s) < TUNING.blowbackTwice ? 2 : 1;
    for (const due of months.slice(0, hits)) s.blowback.push({ id: event.id, due });
    landBlowback(s);
  } else {
    const option = event.choices[choice];
    s.blocks -= option.cost;
    landChaos(s, option.label, event.title, option.outcomes[roll(s, TUNING.chaosOdds[choice])]);
  }
  settleWhim(s);
  checkEnd(s);
  return s;
}

/** Closes the oldest chaos result once the player has read it. */
export function dismissReveal(state: GameState): GameState {
  if (state.reveals.length === 0) return state;
  const s = structuredClone(state);
  s.reveals.shift();
  return s;
}

// ---------- Guests at Mar-a-Lago ----------

/** A new set of guests turns up at the club. Last month's have gone home. */
function drawGuests(s: GameState): void {
  s.guests = [];
  for (let i = 0; i < TUNING.guestsPerMonth; i++) {
    if (s.guestDeck.length === 0) s.guestDeck = shuffled(s, GUESTS.map((g) => g.id));
    s.guests.push(s.guestDeck.pop()!);
  }
}

/** What a leaked bribe costs: everything it gave, times three. The coin stays. */
export function leakEffects(fx: Effects): Effects {
  return { ego: -TUNING.leakTimes * (fx.ego ?? 0), stability: -TUNING.leakTimes * (fx.stability ?? 0) };
}

/**
 * Grants the guest's ask and takes the coin. Whether it leaks is rolled here,
 * so the player cannot know; a leak becomes news in a later month.
 */
export function takeBribe(state: GameState, guestId: string): GameState {
  if (state.status !== 'playing' || state.chaos || state.place !== 'maralago') return state;
  if (!state.guests.includes(guestId) || TUNING.bribeCost > state.blocks) return state;
  const guest = guestById(guestId);

  const s = structuredClone(state);
  s.blocks -= TUNING.bribeCost;
  s.guests = s.guests.filter((id) => id !== guestId);
  apply(s, guest.effects);
  log(s, guest.result, 'ego');
  if (rand(s) < TUNING.leakChance) {
    const [soonest, latest] = TUNING.leakDelay;
    const delay = soonest + Math.floor(rand(s) * (latest - soonest + 1));
    // Near the end of the term the story runs in the final month at the latest.
    s.exposures.push({ id: guestId, due: Math.min(s.month + delay, TOTAL_MONTHS), effects: leakEffects(guest.effects) });
  }
  count(s, 'bribes');
  count(s, 'resort');
  settleWhim(s);
  checkEnd(s);
  return s;
}

/** Sends a guest home with nothing. Costs no time, only a little pride. */
export function declineGuest(state: GameState, guestId: string): GameState {
  if (state.status !== 'playing' || state.chaos || state.place !== 'maralago' || !state.guests.includes(guestId)) return state;
  const guest = guestById(guestId);
  const s = structuredClone(state);
  s.guests = s.guests.filter((id) => id !== guestId);
  apply(s, { ego: TUNING.declineEgo });
  log(s, `You sent ${guest.title} away and kept your hands clean. It did not feel like winning.`, 'neutral');
  checkEnd(s);
  return s;
}

/** Puts somebody else at the top of the phone list. Never the same person twice running. */
function nextCallee(s: GameState): void {
  s.callee = ((s.callee ?? 0) + 1 + Math.floor(rand(s) * (CALLEES.length - 1))) % CALLEES.length;
}

// ---------- Natalie's errands ----------

export type Meal = 'burger' | 'taco';

/** What each lunch is called, and what is said when it does or does not stay down. */
const MEALS: Record<Meal, { stat: string; sickLog: string; sickTitle: string; sickText: string; fineLog: string }> = {
  burger: {
    stat: 'burgers',
    sickLog: 'The McBurger did not agree with you. You have gone straight to bed. Everything else can wait, and will.',
    sickTitle: 'The McBurger Strikes Back',
    sickText: 'Four bites in, something shifted. You have diarrhea, the worst anybody has ever seen, and you are going to bed right now. ',
    fineLog: 'Natalie fetched a McBurger. It was gone in four bites. Best burger, everybody says so.',
  },
  taco: {
    stat: 'tacos',
    sickLog: 'The Taco Gong did not agree with you. It was the lettuce. You have gone straight to bed. Everything else can wait, and will.',
    sickTitle: 'The Gong Has Been Rung',
    sickText:
      'Three tacos in, something shifted. It was the lettuce, it is always the lettuce. You have diarrhea, the worst anybody has ever seen, and you are going to bed right now. ',
    fineLog: 'Natalie fetched a sack from Taco Gong. It was gone in six bites. You picked out the lettuce. Nobody loves tacos more than you.',
  },
};

/**
 * Natalie fetches lunch, a McBurger or a sack from Taco Gong, paid for in
 * coin. It costs no time, unless it disagrees with him: then the rest of the
 * month is gone and he is off to bed, leaving whoever was waiting to be
 * ignored. The player is not warned; a notice says so when it happens.
 */
export function orderLunch(state: GameState, meal: Meal = 'burger'): GameState {
  if (state.status !== 'playing' || state.chaos || state.blocks === 0 || state.coin < TUNING.lunchCost) return state;
  const s = structuredClone(state);
  const food = MEALS[meal];
  s.coin -= TUNING.lunchCost;
  count(s, 'lunches');
  count(s, food.stat);
  if (rand(s) < TUNING.lunchSickChance) {
    s.blocks = 0;
    count(s, 'sick');
    log(s, food.sickLog, 'bad');
    const waiting = s.inbox.filter((id) => cardById(id).kind !== 'hybrid').length;
    s.reveals.push({
      eyebrow: 'Lunch · it did not stay down',
      title: food.sickTitle,
      text:
        food.sickText +
        (waiting > 0
          ? `The ${waiting === 1 ? 'person' : `${waiting} people`} still waiting for you will be ignored.`
          : 'Luckily nobody was waiting for you.') +
        ' The rest of the month is gone.',
      effects: {},
    });
  } else {
    log(s, food.fineLog, 'ego');
  }
  // Every fifth order the doctor puts his foot down. He passes, of course, and will say so.
  if (s.stats.lunches % TUNING.physicalEvery === 0) {
    s.physical = true;
    count(s, 'physicals');
    log(s, 'The doctor insisted on a physical. You passed it biggly, and the next rally is going to hear all about it.', 'ego');
    s.reveals.push({
      eyebrow: `Doctor's orders · take-out order number ${s.stats.lunches}`,
      title: 'The Physical',
      text:
        'The doctor has counted the bags and insisted. You were weighed, measured and asked to draw a clock. You passed, biggly: ' +
        `the best physical anybody has ever had, they could not believe the numbers. You will be bragging about it at your next rally (+${TUNING.physicalRallyEgo} Ego).`,
      effects: {},
    });
  }
  settleWhim(s);
  checkEnd(s);
  return s;
}

/**
 * Whether the Diet Coke button will do anything: `limit` means he has had this
 * month's can, and `full` that no time has been spent yet.
 */
export function cokeStatus(state: GameState): 'ok' | 'no-coin' | 'full' | 'limit' {
  if (state.coked === state.month) return 'limit';
  if (state.blocks >= BLOCKS_PER_MONTH) return 'full';
  return state.coin >= TUNING.cokeCost ? 'ok' : 'no-coin';
}

/**
 * He presses the button on the desk and Natalie arrives with a Diet Coke,
 * paid for in coin. It gives back a time block, up to a full month's worth,
 * and the doctor allows one a month.
 */
export function pressCokeButton(state: GameState): GameState {
  if (state.status !== 'playing' || state.chaos || state.blocks === 0 || cokeStatus(state) !== 'ok') return state;
  const s = structuredClone(state);
  s.coked = s.month;
  s.coin -= TUNING.cokeCost;
  s.blocks = Math.min(BLOCKS_PER_MONTH, s.blocks + TUNING.cokeBlocks);
  count(s, 'cokes');
  log(s, 'You pressed the button. A Diet Coke arrived on a silver tray. You have never felt more awake, or more correct.', 'ego');
  settleWhim(s);
  checkEnd(s);
  return s;
}

/** Whether the Lawyer will take the call: he files one suit a month, and bills in coin. */
export function sueStatus(state: GameState): 'ok' | 'no-coin' | 'sued' {
  if (state.sued === state.month) return 'sued';
  return state.coin >= TUNING.sueCost ? 'ok' : 'no-coin';
}

/**
 * Natalie pulls in the Lawyer and he sues something, picked at random. It
 * costs coin but no time, and can be done once a month.
 */
export function sueSomething(state: GameState): GameState {
  if (state.status !== 'playing' || state.chaos || state.blocks === 0 || sueStatus(state) !== 'ok') return state;
  const s = structuredClone(state);
  s.sued = s.month;
  s.coin -= TUNING.sueCost;
  apply(s, TUNING.sueEffects);
  log(s, pick(s, SUITS).result, 'ego');
  count(s, 'suits');
  settleWhim(s);
  checkEnd(s);
  return s;
}

// ---------- Melania ----------

/** Whether she can be booked: once a year of the term, and paid in coin. */
export function melaniaStatus(state: GameState): 'ok' | 'no-coin' | 'used' {
  if (state.melaniaYear === yearOf(state.month)) return 'used';
  return state.coin >= TUNING.melaniaCost ? 'ok' : 'no-coin';
}

/** The events she will turn up at: rallies, parades and the big building projects. */
export function melaniaAttends(action: VanityAction): boolean {
  return action.category === 'build' || action.id === 'show-rally' || action.id === 'show-parade';
}

/** Stability a vanity action would cost right now, with Melania at his side if she is booked. */
export function vanityStability(s: GameState, action: VanityAction): number {
  return action.stability + (s.melania && melaniaAttends(action) ? TUNING.melaniaStability : 0);
}

/**
 * He asks her, on the roof in New York, to come to an event. It costs coin
 * and pride but no time. She then appears at his next rally, parade or build.
 */
export function askMelania(state: GameState): GameState {
  if (state.status !== 'playing' || state.chaos || state.place !== 'newyork' || state.blocks === 0) return state;
  if (melaniaStatus(state) !== 'ok') return state;
  const s = structuredClone(state);
  s.coin -= TUNING.melaniaCost;
  apply(s, { ego: TUNING.melaniaEgo });
  s.melania = true;
  s.melaniaYear = yearOf(s.month);
  log(s, 'You asked Melania to come to an event. She named a price, counted the coin twice and said "one."', 'neutral');
  count(s, 'melania');
  settleWhim(s);
  checkEnd(s);
  return s;
}

/** Already booked this year: all she has left for him is an insult. Free, and never the same one twice running. */
export function hearMelania(state: GameState): GameState {
  if (state.status !== 'playing' || state.chaos || state.place !== 'newyork' || melaniaStatus(state) !== 'used') return state;
  const s = structuredClone(state);
  const n = MELANIA_INSULTS.length;
  s.insult = s.insult === undefined ? Math.floor(rand(s) * n) : (s.insult + 1 + Math.floor(rand(s) * (n - 1))) % n;
  log(s, `Melania: "${MELANIA_INSULTS[s.insult]}"`, 'bad');
  count(s, 'insults');
  return s;
}

/** Leaked bribes whose story runs this month. */
function landExposures(s: GameState): void {
  const due = s.exposures.filter((e) => e.due <= s.month);
  s.exposures = s.exposures.filter((e) => !due.includes(e));
  for (const e of due) {
    const guest = guestById(e.id);
    apply(s, e.effects);
    count(s, 'exposed');
    log(s, guest.exposed, 'bad');
    s.reveals.push({ eyebrow: 'Exposed · somebody talked', title: `${guest.title} And The Coin`, text: guest.exposed, effects: e.effects });
  }
}

// ---------- Hearings ----------

/** The case against him: exposed bribes, lawsuits, and how he has handled the hearings. */
export function heat(s: GameState): number {
  const leaks = (s.stats.exposed ?? 0) * TUNING.heatPerLeak;
  const suits = Math.floor((s.stats.suits ?? 0) / TUNING.suitsPerHeat);
  return Math.max(0, leaks + suits + (s.stats.heat ?? 0));
}

/** The House votes. Impeachment does not remove him, but it hurts, and it is in every biography. */
function holdVote(s: GameState): void {
  const exposed = s.stats.exposed ?? 0;
  const suits = s.stats.suits ?? 0;
  const record = `On the record: ${exposed} exposed ${exposed === 1 ? 'bribe' : 'bribes'}, ${suits} ${suits === 1 ? 'lawsuit' : 'lawsuits'}, and the hearings.`;
  s.impeached = heat(s) >= TUNING.impeachAt;
  const effects = s.impeached ? TUNING.impeachedEffects : TUNING.survivedEffects;
  const text = s.impeached
    ? `The House has impeached you, 221 to 212. The Senate will acquit, eventually, but the word is now in the first line of every biography. ${record}`
    : `The articles failed by nine votes. You have called it a total exoneration, which it was not, and a landslide, which it also was not. ${record}`;
  apply(s, effects);
  log(s, text, s.impeached ? 'bad' : 'good');
  s.reveals.push({ eyebrow: 'The vote · a hostile House', title: s.impeached ? 'Impeached' : 'Not Impeached', text, effects });
}

// ---------- Game flow ----------

export function newGame(seed: number = Date.now()): GameState {
  const s: GameState = {
    seed: seed | 0,
    month: 1,
    blocks: BLOCKS_PER_MONTH,
    ego: TUNING.startEgo,
    stability: TUNING.startStability,
    gold: 0,
    names: 0,
    coin: 0,
    monuments: 0,
    ignored: 0,
    crisisPending: false,
    place: 'dc',
    usedSpecials: [],
    pending: [],
    stats: {},
    whim: null,
    whimOffer: [],
    congress: null,
    chaos: null,
    chaosMonths: [],
    usedChaos: [],
    blowback: [],
    reveals: [],
    guests: [],
    guestDeck: [],
    exposures: [],
    inbox: [],
    deck: [],
    done: {},
    log: [],
    status: 'playing',
  };
  log(s, 'Inauguration Day. Biggest crowd ever, period. Now there is apparently a job to do.', 'neutral');
  drawInbox(s);
  drawGuests(s);
  offerWhims(s);
  nextCallee(s);
  return s;
}

export function mood(s: GameState): Mood {
  if (s.ego < TUNING.sulkingBelow) return 'sulking';
  if (s.ego > TUNING.unleashedAbove) return 'unleashed';
  return 'normal';
}

/** Whether the Golden Dome will take the edge off this card: one crisis, once. */
export function domeShields(s: GameState, card: DutyCard): boolean {
  return card.kind === 'crisis' && Boolean(s.done['build-dome']) && !s.domeSpent;
}

/** Sulking makes every duty take longer. Opportunities are exempt. The Dome shortens one crisis. */
export function dutyCost(s: GameState, card: DutyCard): number {
  const sulk = mood(s) === 'sulking' && card.kind !== 'hybrid' ? 1 : 0;
  return Math.max(1, card.cost + sulk - (domeShields(s, card) ? TUNING.domeBlocks : 0));
}

/** Ego a vanity action would give right now, after fading and seasonal boosts. */
export function vanityEgo(s: GameState, action: VanityAction): number {
  const boost = activeSeasons(s)
    .map((season) => season.boost)
    .find((b) => b?.match(action));
  let ego = action.ego;
  if (action.category === 'rename') {
    const renames = VANITY.filter((v) => v.category === 'rename' && s.done[v.id]).length;
    ego *= TUNING.renameFade ** renames;
  } else if (action.repeatable && !boost?.noFade) {
    ego *= Math.max(TUNING.showFloor, TUNING.showFade ** (s.done[action.id] ?? 0));
  }
  return Math.round(ego * (boost?.times ?? 1)) + (bragsAboutPhysical(s, action) ? TUNING.physicalRallyEgo : 0);
}

/** Fresh from a physical, he opens the next rally with the results. */
export function bragsAboutPhysical(s: GameState, action: VanityAction): boolean {
  return Boolean(s.physical) && action.id === 'show-rally';
}

export type VanityAvailability = 'ok' | 'done' | 'locked' | 'no-time' | 'away' | 'no-ride';

export function vanityStatus(s: GameState, action: VanityAction): VanityAvailability {
  if (!action.repeatable && s.done[action.id]) return 'done';
  if (!action.anywhere && (action.place ?? 'dc') !== s.place) return 'away';
  if (action.requires && !s.done[action.requires]) return 'locked';
  // The way home is whatever you flew out in; the other one is still in Washington.
  if (action.travelTo === 'dc' && (action.vehicle ?? 'plane') !== (s.vehicle ?? 'plane')) return 'no-ride';
  if (action.cost > s.blocks) return 'no-time';
  return 'ok';
}

/** Monthly ego decay: the base rate, monument inflation, and the season. */
export function egoDecay(s: GameState): number {
  const seasonal = activeSeasons(s).reduce((n, season) => n + (season.egoDecay ?? 0), 0);
  // Sulking, he goes and looks at the Statue. It helps.
  const comfort = mood(s) === 'sulking' && s.done['build-statue'] ? TUNING.statueComfort : 0;
  return Math.max(0, Math.round(TUNING.egoDecay + TUNING.egoInflation * s.monuments) + seasonal - comfort);
}

/** Monthly stability drift, including whatever the season adds. */
export function stabilityDrift(s: GameState): number {
  return TUNING.stabilityDrift + activeSeasons(s).reduce((n, season) => n + (season.drift ?? 0), 0);
}

export function playDuty(state: GameState, cardId: string, optionIndex: number): GameState {
  if (state.status !== 'playing' || state.chaos || state.place !== 'dc' || !state.inbox.includes(cardId)) return state;
  const card = cardById(cardId);
  const option = card.options[optionIndex];
  const cost = dutyCost(state, card);
  if (!option || cost > state.blocks) return state;

  const s = structuredClone(state);
  s.blocks -= cost;
  s.inbox = s.inbox.filter((id) => id !== cardId);
  if (domeShields(state, card)) {
    s.domeSpent = true;
    log(s, 'The Golden Dome took the edge off that one. Nobody can explain how, and you have told them not to try.', 'good');
  }
  apply(s, option.effects);
  const net = (option.effects.stability ?? 0) + (option.effects.ego ?? 0);
  log(s, option.result, card.kind === 'hybrid' ? 'good' : (option.effects.stability ?? 0) > 0 ? 'good' : net > 0 ? 'ego' : 'bad');

  count(s, 'duties');
  if (card.options.length === 2) count(s, optionIndex === 0 ? 'responsible' : 'vain');
  plant(s, `${cardId}:${optionIndex}`);
  settleWhim(s);
  checkEnd(s);
  return s;
}

const STAT_FOR_ACTION: Record<string, string> = {
  'show-golf': 'golf',
  'resort-golf': 'golf',
  'show-rally': 'rally',
  'show-post': 'post',
  'show-call': 'call',
  'show-parade': 'parade',
};

export function doVanity(state: GameState, actionId: string): GameState {
  if (state.status !== 'playing' || state.chaos) return state;
  const action = vanityById(actionId);
  if (vanityStatus(state, action) !== 'ok') return state;

  const s = structuredClone(state);
  const ego = vanityEgo(s, action);
  s.blocks -= action.cost;
  const withMelania = Boolean(s.melania) && melaniaAttends(action);
  const bragging = bragsAboutPhysical(s, action);
  apply(s, { ego, stability: vanityStability(s, action), gold: action.gold, names: action.names });
  if (withMelania) s.melania = false;
  if (bragging) s.physical = false;
  s.done[action.id] = (s.done[action.id] ?? 0) + 1;
  if (action.category === 'build' || action.category === 'rename') s.monuments += 1;
  if (action.travelTo) {
    s.place = action.travelTo;
    s.vehicle = action.vehicle ?? 'plane';
  }
  if (action.id === 'show-call') {
    log(s, calleeAt(s.callee).result, 'ego');
    nextCallee(s);
  } else {
    log(s, action.result, 'ego');
  }
  if (withMelania) log(s, 'Melania stood beside you for the whole thing. She did not smile, and the world relaxed slightly.', 'good');
  if (bragging) log(s, 'You opened with the physical. Passed it biggly, you said: the doctor wept. The crowd chanted your blood pressure.', 'ego');
  // What he builds, names and gilds comes back, the same as what he decides.
  plant(s, `${action.id}:done`);

  count(s, action.category);
  if (STAT_FOR_ACTION[action.id]) count(s, STAT_FOR_ACTION[action.id]);
  settleWhim(s);
  checkEnd(s);
  return s;
}

export function endMonth(state: GameState): GameState {
  if (state.status !== 'playing' || state.chaos) return state;
  const s = structuredClone(state);

  let neglected = 0;
  for (const id of s.inbox) {
    const card = cardById(id);
    apply(s, { stability: card.ignore.stability });
    log(s, card.ignore.text, card.kind === 'hybrid' ? 'neutral' : 'bad');
    plant(s, `${id}:ignore`);
    if (card.kind !== 'hybrid') {
      neglected += 1;
      s.ignored += 1;
      if (s.ignored % TUNING.ignoredPerCrisis === 0) s.crisisPending = true;
    }
  }
  s.inbox = [];
  if (neglected === 0) count(s, 'cleanMonths');

  if (mood(s) === 'unleashed') {
    apply(s, { stability: -TUNING.unleashedPenalty });
    log(s, 'Feeling invincible, you gave an unscripted interview. Markets and allies are "monitoring".', 'bad');
  }

  // Election night: the state of the world decides who runs Congress.
  if (s.month === MIDTERM_MONTH) {
    if (s.stability >= MIDTERM_BAR) {
      s.congress = 'friendly';
      apply(s, { ego: 10 });
      log(s, 'Midterms: your party held Congress. You are taking this entirely personally, in a good way.', 'good');
    } else {
      s.congress = 'hostile';
      apply(s, { ego: -6 });
      log(s, 'Midterms: you lost Congress. The new committee chairs have already ordered stationery.', 'bad');
    }
  }

  // The press runs whatever it has on the bribes before the month closes.
  landExposures(s);

  // A hostile House votes on impeachment, on everything that has come out by now.
  if (s.congress === 'hostile' && s.month === VOTE_MONTH) holdVote(s);

  // The Gift Shop pays, every month, in the only currency it trusts.
  if (s.done['build-giftshop']) {
    apply(s, { coin: TUNING.giftShopCoin });
    count(s, 'giftShopCoin', TUNING.giftShopCoin);
  }

  apply(s, { ego: -egoDecay(s), stability: -stabilityDrift(s) });
  settleWhim(s);
  checkEnd(s);
  if (s.status !== 'playing') return s;

  if (s.month >= TOTAL_MONTHS) {
    s.status = 'won';
    log(s, 'The term is over. Both you and the planet made it.', 'good');
    return s;
  }

  s.month += 1;
  nextCallee(s);
  s.blocks = BLOCKS_PER_MONTH;

  if (s.whim && s.month > s.whim.deadline) {
    apply(s, { ego: WHIM_FAIL_EGO });
    log(s, `Whim abandoned: ${whimById(s.whim.id).title}. You are pretending you never wanted it.`, 'bad');
    s.whim = null;
    checkEnd(s);
    if (s.status !== 'playing') return s;
  }
  if ((s.month - 1) % WHIM_MONTHS === 0 && !s.whim) offerWhims(s);

  for (const season of activeSeasons(s)) {
    if (!season.months.includes(s.month - 1)) log(s, `${season.name}. ${season.note}`, 'neutral');
  }
  if (s.crisisPending) log(s, 'Neglect has consequences. A crisis lands on your desk.', 'bad');
  drawInbox(s);
  drawGuests(s);

  landBlowback(s);
  checkEnd(s);
  if (s.status !== 'playing') return s;
  rollChaos(s);
  return s;
}

export function score(s: GameState): number {
  return s.gold * 10 + s.coin * 10 + s.names * 25 + s.ego + s.stability + (s.stats.whimsDone ?? 0) * 20 + (s.status === 'won' ? 500 : 0);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateLabel(month: number): string {
  return `${MONTH_NAMES[(month - 1) % 12]}, Year ${Math.ceil(month / 12)}`;
}

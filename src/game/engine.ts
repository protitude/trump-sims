import type { Effects, GameState, Mood, Tone, VanityAction, DutyCard } from './types.ts';
import { CRISES, DUTIES, HYBRIDS, VANITY, cardById, vanityById } from './content.ts';
import { CONSEQUENCES, SET_PIECE_MONTHS } from './story.ts';
import { CHAOS, chaosById } from './chaos.ts';
import type { ChaosOutcome } from './chaos.ts';
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
  /** Chance of a chaos event at the start of any month. */
  chaosChance: 0.1,
  chaosPerYear: 2,
  /** Odds of a good, mixed or bad outcome: favorable choice, then deflection. */
  chaosOdds: [
    [0.6, 0.25, 0.15],
    [0.3, 0.3, 0.4],
  ],
  /** Odds that blowback from an ignored event is bad, severe, or fizzles. */
  blowbackOdds: [0.7, 0.25, 0.05],
  /** Chance that ignoring an event brings two rounds of blowback, not one. */
  blowbackTwice: 0.5,
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

/** Remembers that a choice will come back later. */
function plant(s: GameState, key: string): void {
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

/** A chaos event may strike at the start of a month, at most twice a year. */
function rollChaos(s: GameState): void {
  const struck = rand(s) < TUNING.chaosChance;
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
    inbox: [],
    deck: [],
    done: {},
    log: [],
    status: 'playing',
  };
  log(s, 'Inauguration Day. Biggest crowd ever, period. Now there is apparently a job to do.', 'neutral');
  drawInbox(s);
  offerWhims(s);
  return s;
}

export function mood(s: GameState): Mood {
  if (s.ego < TUNING.sulkingBelow) return 'sulking';
  if (s.ego > TUNING.unleashedAbove) return 'unleashed';
  return 'normal';
}

/** Sulking makes every duty take longer. Opportunities are exempt. */
export function dutyCost(s: GameState, card: DutyCard): number {
  return card.cost + (mood(s) === 'sulking' && card.kind !== 'hybrid' ? 1 : 0);
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
  return Math.round(ego * (boost?.times ?? 1));
}

export type VanityAvailability = 'ok' | 'done' | 'locked' | 'no-time' | 'away' | 'no-ride';

export function vanityStatus(s: GameState, action: VanityAction): VanityAvailability {
  if (!action.repeatable && s.done[action.id]) return 'done';
  if ((action.place ?? 'dc') !== s.place) return 'away';
  if (action.requires && !s.done[action.requires]) return 'locked';
  // The way home is whatever you flew out in; the other one is still in Washington.
  if (action.travelTo === 'dc' && (action.vehicle ?? 'plane') !== (s.vehicle ?? 'plane')) return 'no-ride';
  if (action.cost > s.blocks) return 'no-time';
  return 'ok';
}

/** Monthly ego decay: the base rate, monument inflation, and the season. */
export function egoDecay(s: GameState): number {
  const seasonal = activeSeasons(s).reduce((n, season) => n + (season.egoDecay ?? 0), 0);
  return Math.round(TUNING.egoDecay + TUNING.egoInflation * s.monuments) + seasonal;
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
  'show-parade': 'parade',
};

export function doVanity(state: GameState, actionId: string): GameState {
  if (state.status !== 'playing' || state.chaos) return state;
  const action = vanityById(actionId);
  if (vanityStatus(state, action) !== 'ok') return state;

  const s = structuredClone(state);
  const ego = vanityEgo(s, action);
  s.blocks -= action.cost;
  apply(s, { ego, stability: action.stability, gold: action.gold, names: action.names });
  s.done[action.id] = (s.done[action.id] ?? 0) + 1;
  if (action.category === 'build' || action.category === 'rename') s.monuments += 1;
  if (action.travelTo) {
    s.place = action.travelTo;
    s.vehicle = action.vehicle ?? 'plane';
  }
  log(s, action.result, 'ego');

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

  landBlowback(s);
  checkEnd(s);
  if (s.status !== 'playing') return s;
  rollChaos(s);
  return s;
}

export function score(s: GameState): number {
  return s.gold * 10 + s.names * 25 + s.ego + s.stability + (s.stats.whimsDone ?? 0) * 20 + (s.status === 'won' ? 500 : 0);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateLabel(month: number): string {
  return `${MONTH_NAMES[(month - 1) % 12]}, Year ${Math.ceil(month / 12)}`;
}

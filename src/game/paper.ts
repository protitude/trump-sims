import type { GameState, Tone } from './types.ts';

// The year-end front page. Through the year the engine files stories: the
// choices that moved the meters most, the visitors left waiting, the things he
// built, chaos, leaks, the midterms and the vote. Every December the paper
// leads with the biggest of them and runs a few more below, beside a box of
// numbers for the year. The final edition runs on the ending screen.
//
// Nothing here changes a meter or the score.

/** One thing that happened this year that the paper might print. */
export interface Story {
  month: number;
  /** How big a story it is. The biggest leads the paper. */
  weight: number;
  /** The small label above the headline: Crisis, Consequence, Construction... */
  kicker: string;
  headline: string;
  text: string;
  tone: Tone;
}

/** What the paper compares against: where things stood when the year began. */
export interface Snapshot {
  month: number;
  ego: number;
  stability: number;
  gold: number;
  names: number;
  coin: number;
  ignored: number;
  stats: Record<string, number>;
}

/** The year so far, as the newsroom has it. */
export interface Newsroom {
  start: Snapshot;
  stories: Story[];
}

export interface FrontPage {
  year: number;
  /** Set on the ending screen: the term, or the world, is over. */
  final: boolean;
  dateline: string;
  price: string;
  weather: string;
  lead: Story | null;
  others: Story[];
  numbers: { label: string; value: string }[];
  editorial: { headline: string; text: string };
  correction: string;
  /** What he says as he folds it up. */
  reply: string;
}

export const MASTHEAD = 'The National Ledger';

/** Months at the end of which a year-end edition is printed. The last year's runs on the ending screen. */
export const PAPER_MONTHS = [12, 24, 36];

/** Stories kept per year. The smallest are spiked once the pile is full. */
const MAX_STORIES = 40;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const yearOf = (month: number) => Math.ceil(month / 12);

export function snapshot(s: GameState): Snapshot {
  return { month: s.month, ego: s.ego, stability: s.stability, gold: s.gold, names: s.names, coin: s.coin, ignored: s.ignored, stats: { ...s.stats } };
}

/** Starts a fresh year in the newsroom. */
export function openNewsroom(s: GameState): Newsroom {
  return { start: snapshot(s), stories: [] };
}

/** Files a story for this year's paper. */
export function file(s: GameState, story: Omit<Story, 'month'>): void {
  if (!s.news) s.news = openNewsroom(s);
  s.news.stories.push({ ...story, month: s.month });
  if (s.news.stories.length > MAX_STORIES) {
    // Spike the smallest, oldest first.
    let smallest = 0;
    s.news.stories.forEach((st, i) => {
      if (st.weight < s.news!.stories[smallest].weight) smallest = i;
    });
    s.news.stories.splice(smallest, 1);
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function weather(stability: number): string {
  if (stability >= 75) return 'Clear skies on every continent';
  if (stability >= 50) return 'Scattered tensions, clearing by noon';
  if (stability >= 30) return 'Storm warnings on three continents';
  if (stability >= 15) return 'Heavy diplomacy, chance of sirens';
  return 'Fallout, then a light drizzle';
}

const EDITORIALS = {
  absent: {
    headline: 'Is Anybody Answering The Door?',
    text: (n: number) => `${plural(n, 'visitor')} waited outside the Oval Office this year and went home. This page has started leaving its questions on the porch.`,
  },
  sensible: {
    headline: 'In Praise Of A Boring Year',
    text: () => 'The President read the briefings and took the dull option, again and again. It made for terrible television and an unusually good year. We hope he does not notice.',
  },
  fun: {
    headline: 'Somebody Should Take The Phone Away',
    text: () => 'Offered a sensible answer and an exciting one, the President chose excitement most of the time. Allies have begun communicating with us by carrier pigeon.',
  },
  gold: {
    headline: 'The Gilding Must Stop',
    text: (n: number) => `${plural(n, 'more thing')} turned to gold this year. The Treasury has asked whether the gold is load-bearing. Nobody will say.`,
  },
  mixed: {
    headline: 'A Year Of Both',
    text: () => 'Some of the job got done, and some of it got gilded. On balance, the planet is still here, which this page is choosing to count as a win.',
  },
};

const CORRECTIONS = [
  'A previous edition described the inaugural crowd as "large." The White House has asked us to say "the largest." We decline.',
  'Due to an editing error, last week\'s weather map showed the Gulf under its old name. We regret any confusion, and the map.',
  'A photo caption misidentified a gold chair as a throne. The White House insists it is a throne.',
  'An earlier story said the President "spoke for an hour." He spoke for an hour and forty minutes. We regret the omission.',
  'We incorrectly reported the arch as "visible from space." It is visible from the space station, which has complained.',
  'A previous edition misspelled "covfefe." We cannot find the correct spelling and have stopped looking.',
  'Last month\'s crossword answer "WITCH HUNT" was not, as stated, approved by the White House. It was suggested by it.',
  'This paper reported that the President had read a briefing. A source has since clarified that he held it.',
];

function editorial(s: GameState, start: Snapshot): FrontPage['editorial'] {
  const d = (stat: string) => (s.stats[stat] ?? 0) - (start.stats[stat] ?? 0);
  const ignored = s.ignored - start.ignored;
  const sensible = d('responsible');
  const fun = d('vain');
  const gold = s.gold - start.gold;
  // Absent only when he left more people waiting than half the number he saw.
  if (ignored >= 10 && ignored * 2 > d('duties')) return { headline: EDITORIALS.absent.headline, text: EDITORIALS.absent.text(ignored) };
  if (gold >= 8) return { headline: EDITORIALS.gold.headline, text: EDITORIALS.gold.text(gold) };
  if (sensible >= 5 && sensible >= 2 * fun) return { headline: EDITORIALS.sensible.headline, text: EDITORIALS.sensible.text() };
  if (fun > sensible) return { headline: EDITORIALS.fun.headline, text: EDITORIALS.fun.text() };
  return { headline: EDITORIALS.mixed.headline, text: EDITORIALS.mixed.text() };
}

function numbers(s: GameState, start: Snapshot): FrontPage['numbers'] {
  const d = (stat: string) => (s.stats[stat] ?? 0) - (start.stats[stat] ?? 0);
  const out: FrontPage['numbers'] = [
    { label: 'World Stability', value: `${start.stability} → ${s.stability}` },
    { label: 'Presidential Ego', value: `${start.ego} → ${s.ego}` },
    { label: 'Visitors seen', value: String(d('duties')) },
    { label: 'Left waiting', value: String(s.ignored - start.ignored) },
  ];
  const extras: [string, number][] = [
    ['Things gilded', s.gold - start.gold],
    ['Things named after him', s.names - start.names],
    ['Rounds of golf', d('golf')],
    ['Rallies', d('rally')],
    ['Posts at 3am', d('post')],
    ['Lawsuits filed', d('suits')],
    ['Take-out orders', d('lunches')],
    ['Coin taken at the club', s.coin - start.coin],
  ];
  for (const [label, n] of extras) if (n > 0 && out.length < 9) out.push({ label, value: String(n) });
  return out;
}

/** The front-page story of the final edition. */
function endingStory(s: GameState): Story | null {
  const base = { month: s.month, weight: Infinity };
  if (s.status === 'ww3')
    return { ...base, kicker: 'Extra', headline: 'World War III', text: 'Officials describe the situation as "very bad" and "ongoing." The President has asked whether the Arch is insured.', tone: 'bad' };
  if (s.status === 'depression')
    return { ...base, kicker: 'Extra', headline: 'President Has Not Left Bed In Weeks', text: 'Aides confirm he is under the gold comforter and has asked not to be told how well things are going.', tone: 'bad' };
  if (s.status === 'won' && (s.stats.wontLeave ?? 0) > 0)
    return { ...base, kicker: 'Extra', headline: 'President Says He May Not Leave', text: 'The movers are idling in the driveway. Constitutional scholars have not slept. His successor is measuring the drapes from the sidewalk.', tone: 'bad' };
  if (s.status === 'won')
    return { ...base, kicker: 'The Term', headline: 'Four Years, And The Planet Made It', text: 'Historians are baffled. The President is already asking about a third term, and has asked that this headline be gilded.', tone: 'good' };
  return null;
}

/**
 * Prints the paper for the year so far. Pure: it reads the state and the
 * stories filed in it. `final` is for the ending screen.
 */
export function printPaper(s: GameState, final = false): FrontPage {
  const start = s.news?.start ?? snapshot({ ...s, month: (yearOf(s.month) - 1) * 12 + 1 });
  const year = yearOf(s.month);
  // Biggest first; on a tie, the later story, since it is fresher.
  const ranked = [...(s.news?.stories ?? [])].sort((a, b) => b.weight - a.weight || b.month - a.month);
  const seen = new Set<string>();
  const unique = ranked.filter((st) => (seen.has(st.headline) ? false : (seen.add(st.headline), true)));
  // The last edition leads with how it all ended, and everything else moves down.
  const ending = final ? endingStory(s) : null;
  if (ending) unique.unshift(ending);
  const [lead = null, ...rest] = unique;
  const others = rest.slice(0, 4).sort((a, b) => a.month - b.month);

  const up = s.stability >= start.stability;
  const reply = final
    ? 'Frame it. Hang it next to the other one.'
    : up
      ? 'Frame it. Hang it in the hall.'
      : 'Fake news. Fold it up.';

  return {
    year,
    final,
    dateline: final ? `Final Edition · ${MONTHS[(s.month - 1) % 12]}, Year ${year}` : `Year-End Edition · December 31, Year ${year}`,
    price: s.done['rename-dollar'] ? 'One Trump Dollar (not accepted)' : 'One Dollar',
    weather: weather(s.stability),
    lead,
    others,
    numbers: numbers(s, start),
    editorial: editorial(s, start),
    correction: CORRECTIONS[(start.ego * 31 + start.stability * 7 + s.gold + year) % CORRECTIONS.length],
    reply,
  };
}

import { VANITY } from './content.ts';
import type { GameState } from './types.ts';

// What the ending screen says about the term just played. Everything here is
// read off the final state: nothing in it changes a meter or the score.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const built = (s: GameState) => VANITY.filter((v) => v.category === 'build' && s.done[v.id]).length;
const BUILDS = VANITY.filter((v) => v.category === 'build').length;

/** The name history gives him. The first one that fits wins. */
const TITLES: { title: string; why: string; fits: (s: GameState) => boolean }[] = [
  { title: 'President For Life, Pending Litigation', why: 'You said you might not leave. Nobody is sure you were joking.', fits: (s) => s.status === 'won' && (s.stats.wontLeave ?? 0) > 0 },
  { title: 'The Asterisk', why: 'Impeached, acquitted and footnoted forever.', fits: (s) => Boolean(s.impeached) },
  { title: 'The Grifter-In-Chief', why: 'The coin kept coming, and so did the headlines.', fits: (s) => (s.stats.exposed ?? 0) >= 2 },
  { title: 'The Coin Collector', why: 'A great many guests, a great deal of coin, and hardly a word in the papers.', fits: (s) => (s.stats.bribes ?? 0) >= 10 },
  { title: 'The Builder', why: 'Every lot on the lawn has something enormous on it.', fits: (s) => built(s) === BUILDS },
  { title: 'Florida Man', why: 'The government was run, when it was run, from a patio.', fits: (s) => (s.stats.resort ?? 0) >= 25 },
  { title: 'The Brand', why: 'There is very little left that is not named after you.', fits: (s) => s.names >= 9 },
  { title: 'The Gilder', why: 'If it stood still, it is gold now.', fits: (s) => s.gold >= 25 },
  { title: 'The Plaintiff', why: 'You sued nearly everything. Some of it sued back.', fits: (s) => (s.stats.suits ?? 0) >= 10 },
  { title: 'The Drive-Thru President', why: 'The bags were counted. The doctor was called, repeatedly.', fits: (s) => (s.stats.lunches ?? 0) >= 10 },
  { title: 'The Accidental Statesman', why: 'You kept doing the job. Nobody is more surprised than you.', fits: (s) => (s.stats.responsible ?? 0) >= 30 && (s.stats.responsible ?? 0) >= 2 * (s.stats.vain ?? 0) },
  { title: 'The Unfiltered', why: 'Given a sensible option and a fun one, you knew which was which.', fits: (s) => (s.stats.vain ?? 0) > (s.stats.responsible ?? 0) },
];

export function legacyTitle(s: GameState): { title: string; why: string } {
  return TITLES.find((t) => t.fits(s)) ?? { title: 'The Stable Genius', why: 'A bit of everything, and nothing to excess. By your standards.' };
}

/** Things he did that could plausibly have started a war, for the first line of that ending. */
function sparks(s: GameState): string[] {
  const out: string[] = [];
  if (s.done['rename-gulf']) out.push('a renamed gulf');
  else if (s.done['rename-moon']) out.push('a renamed Moon');
  else if (s.done['rename-dollar']) out.push('a renamed dollar');
  if (s.ignored > 0) out.push(s.ignored === 1 ? 'a visitor left waiting' : `${s.ignored} visitors left waiting`);
  if ((s.stats.vain ?? 0) > 0) out.push(s.stats.vain === 1 ? 'one fun answer to a serious question' : `${s.stats.vain} fun answers to serious questions`);
  if ((s.stats.exposed ?? 0) > 0) out.push(plural(s.stats.exposed, 'leaked bribe'));
  if ((s.stats.post ?? 0) > 0) out.push(s.stats.post === 1 ? 'a post at 3am' : `${s.stats.post} posts at 3am`);
  return out.slice(0, 3);
}

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** The paragraph under the heading: how it ended, in terms of what he actually did. */
export function endingText(s: GameState): string {
  if (s.status === 'ww3') {
    const causes = sparks(s);
    const began = causes.length > 0 ? `It began with ${list(causes)}.` : 'Nobody is quite sure how it began.';
    const survived = s.done['build-arch'] ? 'The Arch survived. Not much else did.' : s.gold > 0 ? 'The gold survived. Not much else did.' : 'Not much survived.';
    return `${began} ${survived}`;
  }
  if (s.status === 'depression') {
    const named = s.names > 0 ? ` ${plural(s.names, 'thing carries', 'things carry')} your name, and it was not enough.` : ' Nothing carries your name, and you have noticed.';
    return `The world has never been better: peace, prosperity, agencies that function. Nobody has said your name in weeks.${named} You are under the gold comforter and you are not coming out.`;
  }
  if ((s.stats.wontLeave ?? 0) > 0) {
    return 'Four years are up, and you have announced that you may be staying. The movers are in the driveway with the engine running. Constitutional scholars have not slept, and your successor is measuring the drapes from the sidewalk.';
  }
  if (s.impeached) {
    return 'Four years, one impeachment, and both the planet and your self-esteem are somehow intact. Historians are baffled. You are describing the acquittal as a third term.';
  }
  return 'Four years, and both the planet and your self-esteem are intact. Historians are baffled. You are already asking about a third term.';
}

/** What the history books will mention, most telling first. Only lines with something to say appear. */
export function epilogue(s: GameState): string[] {
  const n = (stat: string) => s.stats[stat] ?? 0;
  const lines: string[] = [];

  const builds = built(s);
  if (builds === BUILDS) lines.push(`You built all ${BUILDS} of the great projects. The lawn is full, and astronauts close the blinds when they pass over.`);
  else if (builds > 0) lines.push(`You built ${builds} of the ${BUILDS} great projects. The empty lots are still fenced off, with your name on the fence.`);
  else lines.push('You built nothing. The lots on the South Lawn are still grass, which you take personally.');

  if (s.impeached === true) lines.push('You lost Congress and were impeached in Year 3. The Senate acquitted you, slowly, and without eye contact.');
  else if (s.impeached === false) lines.push('You lost Congress, and the impeachment vote failed by nine. You have had the tally sheet framed.');
  else if (s.congress === 'friendly') lines.push('Your party held Congress at the midterms. There were no hearings, only lunches.');
  else if (s.congress === 'hostile') lines.push('You lost Congress at the midterms. The hearings were still going when it ended.');

  if (n('bribes') > 0) {
    lines.push(
      `You took coin from ${plural(n('bribes'), 'guest')} at the club. ` +
        (n('exposed') > 0 ? `${n('exposed') === 1 ? 'One of them' : `${n('exposed')} of them`} talked.` : 'Nobody talked. Yet.'),
    );
  } else if (s.status === 'won') lines.push('You never took a coin at the club. Nobody believes this, including the guests.');

  if (s.names >= 3) lines.push(`${plural(s.names, 'thing')} carry your name${s.done['rename-moon'] ? ', including the Moon, in one country' : ''}.`);

  if (n('lunches') > 0) {
    lines.push(
      `Natalie fetched ${plural(n('lunches'), 'take-out order')}` +
        (n('sick') > 0 ? `, ${n('sick') === 1 ? 'one' : n('sick')} of which fought back` : '') +
        (n('physicals') > 0 ? `. You had ${plural(n('physicals'), 'physical')} and passed ${n('physicals') === 1 ? 'it' : 'them all'} biggly.` : '.'),
    );
  }

  if (n('suits') > 0) lines.push(`The Lawyer filed ${plural(n('suits'), 'suit')}. He won none of them and billed for all.`);

  if (n('melania') > 0 || n('insults') > 0) {
    lines.push(
      (n('melania') > 0 ? `Melania stood beside you ${n('melania') === 1 ? 'once' : `${n('melania')} times`}, at a price. ` : 'Melania never once stood beside you. ') +
        (n('insults') > 0 ? `She told you what she thought of you ${n('insults') === 1 ? 'once' : `${n('insults')} times`}, for free.` : ''),
    );
  }

  if (n('responsible') + n('vain') > 0) lines.push(`Given the choice, you did the sensible thing ${plural(n('responsible'), 'time')} and the fun thing ${plural(n('vain'), 'time')}.`);

  if (s.ignored >= 8) lines.push(`${s.ignored} people waited for you and gave up. Several are still describing it at dinner parties.`);
  else if (n('cleanMonths') >= 12) lines.push(`You ended ${n('cleanMonths')} months with nobody left waiting. Staff still talk about it.`);

  return lines.map((line) => line.trim()).slice(0, 6);
}

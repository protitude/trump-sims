import { TOTAL_MONTHS, score } from './engine.ts';
import { legacyTitle } from './epilogue.ts';
import type { GameState, Status } from './types.ts';

// What the player takes away from a finished term: the numbers on the ending
// screen, and the post he would write about them. Read off the final state only.

/** Where shared posts send people. */
export const SITE_URL = 'https://trump-sim.protitude.com';

export const ENDINGS: Record<Status, string> = { ww3: 'World War III', depression: 'Full Depression', won: 'Term Complete', playing: '' };

const num = (n: number) => n.toLocaleString('en-US');

/** The stat tiles on the ending screen and on the shared image. The legacy score is always last. */
export function finalStats(s: GameState): { label: string; value: string }[] {
  const stats = [
    { label: 'Months served', value: `${s.status === 'won' ? TOTAL_MONTHS : s.month - 1} / ${TOTAL_MONTHS}` },
    { label: 'Things named after you', value: num(s.names) },
    { label: 'Gold', value: num(s.gold) },
    { label: 'Coin', value: num(s.coin) },
    { label: 'Bribes taken / exposed', value: `${s.stats.bribes ?? 0} / ${s.stats.exposed ?? 0}` },
    { label: 'Whims satisfied', value: num(s.stats.whimsDone ?? 0) },
    { label: 'Congress after the midterms', value: s.congress === 'friendly' ? 'Kept' : s.congress === 'hostile' ? 'Lost' : 'Not reached' },
  ];
  if (s.impeached !== undefined) stats.push({ label: 'Impeachment vote', value: s.impeached ? 'Impeached' : 'Survived' });
  stats.push({ label: 'Legacy score', value: num(score(s)) });
  return stats;
}

/** Room for the post on the strictest network, once the link back is added. */
const POST_MAX = 250;

function opener(s: GameState): string[] {
  if (s.status === 'ww3') {
    return [
      'World War III started on my watch. NOT my fault, the Fake News did it!',
      'Yes, there was a small World War. Many people are to blame, none of them me.',
      'They say I started World War III. WRONG! It was already starting. I just finished it.',
    ];
  }
  if (s.status === 'depression') {
    return [
      'Posting this from under the gold comforter. I am NOT coming out.',
      'The world is at peace and NOBODY is saying my name. Very unfair!',
      'I have gone to bed, permanently. A beautiful bed, the best bed.',
    ];
  }
  if ((s.stats.wontLeave ?? 0) > 0) return ['Four years are up and I may not be leaving. We will see what happens!'];
  if (s.impeached) return ['Four PERFECT years and one PERFECT impeachment. Acquitted, totally!'];
  return [
    'Just finished the GREATEST term in the history of terms.',
    'Four years. PERFECT years. Everybody says so.',
    'Term complete, and what a term. Maybe the best ever!',
  ];
}

const SCORE_LINES = [
  (n: string) => `Legacy score: ${n}. A number like nobody has ever seen.`,
  (n: string) => `Legacy score of ${n}. TREMENDOUS. The experts are stunned.`,
  (n: string) => `My legacy score is ${n}, the highest ever recorded, by a lot.`,
];

const CLOSERS = [
  'Can YOU do better? I doubt it. Sad!',
  'You could never beat it. But go ahead and try!',
  'Losers and haters are welcome to try. Thank you for your attention to this matter!',
];

/**
 * The ending, as he would post it: all caps where it counts and no admission of anything.
 * The same term always produces the same post. The link back is added by whoever shares it.
 */
export function bragPost(s: GameState): string {
  const seed = Math.floor(Math.abs(s.seed));
  const pick = <T,>(items: T[], offset: number): T => items[(seed + offset) % items.length];

  const open = pick(opener(s), 0);
  const tally = pick(SCORE_LINES, 1)(num(score(s)));
  const close = pick(CLOSERS, 2);

  // Boasts go in while there is room, best first.
  const boasts: string[] = [];
  if (s.names > 0) boasts.push(s.names === 1 ? 'One thing named after me, a beautiful name.' : `${num(s.names)} things named after me, beautiful names.`);
  if (s.gold > 0) boasts.push(`${num(s.gold)} gold, the best gold.`);
  boasts.push(`History calls me "${legacyTitle(s).title}."`);
  if (s.coin > 0) boasts.push(`${num(s.coin)} coin, all of it very legal.`);

  const middle: string[] = [];
  let length = [open, tally, close].join(' ').length;
  for (const boast of boasts) {
    if (length + boast.length + 1 > POST_MAX) continue;
    middle.push(boast);
    length += boast.length + 1;
  }
  return [open, tally, ...middle, close].join(' ');
}

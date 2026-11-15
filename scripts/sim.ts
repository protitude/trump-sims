// Balance simulator: plays many games with simple bot strategies and reports
// how each one ends. Run with `npm run sim` (optionally: `npm run sim -- 2000`).
//
// What a healthy balance looks like:
//   vanity-only  -> always World War III
//   duty-only    -> always depression
//   random       -> almost always loses
//   balanced     -> wins some of the time, not all of it

import { VANITY, cardById } from '../src/game/content.ts';
import { chooseWhim, doVanity, dutyCost, endMonth, newGame, playDuty, resolveChaos, vanityEgo, vanityStatus } from '../src/game/engine.ts';
import type { GameState } from '../src/game/types.ts';

type Strategy = (s: GameState) => GameState;

function bestVanity(s: GameState): GameState | null {
  // The bots stay in Washington; trips are left to human players.
  const options = VANITY.filter((v) => vanityStatus(s, v) === 'ok' && v.category !== 'trip');
  if (options.length === 0) return null;
  const value = (v: (typeof VANITY)[number]) => (vanityEgo(s, v) + v.stability * 0.5) / v.cost;
  options.sort((a, b) => value(b) - value(a));
  return doVanity(s, options[0].id);
}

function bestDuty(s: GameState): GameState | null {
  const cards = s.inbox.map(cardById).filter((c) => dutyCost(s, c) <= s.blocks);
  if (cards.length === 0) return null;
  // Worst thing to ignore first; always take the responsible option (index 0).
  const value = (c: (typeof cards)[number]) =>
    ((c.options[0].effects.stability ?? 0) - c.ignore.stability) / dutyCost(s, c);
  cards.sort((a, b) => value(b) - value(a));
  return playDuty(s, cards[0].id, 0);
}

function hybridFirst(s: GameState): GameState | null {
  const card = s.inbox.map(cardById).find((c) => c.kind === 'hybrid' && dutyCost(s, c) <= s.blocks);
  return card ? playDuty(s, card.id, 0) : null;
}

const strategies: Record<string, Strategy> = {
  'vanity-only': (s) => bestVanity(s) ?? endMonth(s),
  'duty-only': (s) => bestDuty(s) ?? endMonth(s),
  random: (s) => {
    const moves: (() => GameState)[] = [];
    for (const id of s.inbox) {
      const card = cardById(id);
      if (dutyCost(s, card) > s.blocks) continue;
      card.options.forEach((_, i) => moves.push(() => playDuty(s, id, i)));
    }
    for (const v of VANITY) if (vanityStatus(s, v) === 'ok' && v.category !== 'trip') moves.push(() => doVanity(s, v.id));
    if (moves.length === 0) return endMonth(s);
    return moves[Math.floor(Math.random() * moves.length)]();
  },
  // Feed whichever meter is lower, and grab every opportunity.
  balanced: (s) => {
    const hybrid = hybridFirst(s);
    if (hybrid) return hybrid;
    const first = s.stability <= s.ego ? bestDuty : bestVanity;
    const second = s.stability <= s.ego ? bestVanity : bestDuty;
    return first(s) ?? second(s) ?? endMonth(s);
  },
};

// How each bot answers a chaos event: the favorable choice, the deflection, or ignoring it.
const chaosAnswer: Record<string, () => 0 | 1 | 'ignore'> = {
  'vanity-only': () => 1,
  'duty-only': () => 0,
  random: () => ([0, 1, 'ignore'] as const)[Math.floor(Math.random() * 3)],
  balanced: () => (process.env.CHAOS === 'ignore' ? 'ignore' : process.env.CHAOS === 'deflect' ? 1 : 0),
};

const games = Number(process.argv[2] ?? 1000);

for (const [name, strategy] of Object.entries(strategies)) {
  const endings: Record<string, number> = { won: 0, ww3: 0, depression: 0 };
  let monthsSurvived = 0;
  for (let i = 0; i < games; i++) {
    let s = newGame(i * 7919 + 1);
    // Bots take the first whim on offer and then ignore it.
    while (s.status === 'playing') {
      if (s.whimOffer.length > 0) s = chooseWhim(s, s.whimOffer[0]);
      else if (s.chaos) s = resolveChaos(s, chaosAnswer[name]());
      else s = strategy(s);
      s.reveals = [];
    }
    endings[s.status] += 1;
    monthsSurvived += s.month;
  }
  const pct = (n: number) => `${((n / games) * 100).toFixed(1)}%`.padStart(6);
  console.log(
    `${name.padEnd(12)} won ${pct(endings.won)}  ww3 ${pct(endings.ww3)}  depression ${pct(endings.depression)}  avg months ${(monthsSurvived / games).toFixed(1)}`,
  );
}

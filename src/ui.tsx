import type { ReactNode } from 'react';
import type { Effects, GameState } from './game/types.ts';

/** Colored chips showing what an action does to the meters. */
export function Fx({ effects }: { effects: Effects }) {
  const chips: { text: string; good: boolean }[] = [];
  const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  if (effects.ego) chips.push({ text: `${signed(effects.ego)} Ego`, good: effects.ego > 0 });
  if (effects.stability) chips.push({ text: `${signed(effects.stability)} Stability`, good: effects.stability > 0 });
  if (effects.gold) chips.push({ text: `+${effects.gold} Gold`, good: true });
  if (effects.coin) chips.push({ text: `+${effects.coin} Coin`, good: true });
  if (effects.names) chips.push({ text: `+${effects.names} Named`, good: true });
  return (
    <span className="fx">
      {chips.map((c) => (
        <span key={c.text} className={c.good ? 'chip good' : 'chip bad'}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

export function Blocks({ n }: { n: number }) {
  return <span className="cost">{n === 0 ? 'No time' : n === 1 ? '1 block' : `${n} blocks`}</span>;
}

/** A note that covers a locked button while the pointer is on it, saying why it is locked. */
export function Why({ children }: { children: ReactNode }) {
  return (
    <span className="pop" role="tooltip">
      {children}
    </span>
  );
}

/** Why something paid for in coin is locked. */
export function needCoin(state: GameState): string {
  return state.place === 'maralago'
    ? 'You need more coins. The guests here have bribes, er, I mean favors, on offer.'
    : 'You need more coins. Fly to Mar-a-Lago to take more bribes, er, I mean favors.';
}

/** Why something that takes time is locked. */
export function needTime(cost: number, blocks: number): string {
  return `This takes ${cost} time blocks and you have ${blocks} left. Go to bed, or press the Diet Coke button to get one back.`;
}

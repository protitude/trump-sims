import type { Effects } from './game/types.ts';

/** Coloured chips showing what an action does to the meters. */
export function Fx({ effects }: { effects: Effects }) {
  const chips: { text: string; good: boolean }[] = [];
  const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  if (effects.ego) chips.push({ text: `${signed(effects.ego)} Ego`, good: effects.ego > 0 });
  if (effects.stability) chips.push({ text: `${signed(effects.stability)} Stability`, good: effects.stability > 0 });
  if (effects.gold) chips.push({ text: `+${effects.gold} Gold`, good: true });
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
  return <span className="cost">{n === 1 ? '1 block' : `${n} blocks`}</span>;
}

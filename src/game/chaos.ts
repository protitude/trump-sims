import events from './cards/chaos.json' with { type: 'json' };
import type { Effects } from './types.ts';

// Chaos events: sudden interruptions with hidden, random consequences.
// The content lives in cards/chaos.json; the rules are in engine.ts.

export interface ChaosOutcome {
  effects: Effects;
  text: string;
}

export interface ChaosChoice {
  label: string;
  /** Time blocks it takes. */
  cost: number;
  /** Good, mixed, bad. Which one happens is rolled when the choice is made. */
  outcomes: [ChaosOutcome, ChaosOutcome, ChaosOutcome];
}

export interface ChaosEvent {
  id: string;
  title: string;
  text: string;
  /** The favorable choice first, then the deflection. */
  choices: [ChaosChoice, ChaosChoice];
  ignore: {
    label: string;
    /** Shown at the time. Nothing happens yet. */
    text: string;
    /** Bad, severe, fizzled. Rolled when the blowback lands in a later month. */
    blowback: [ChaosOutcome, ChaosOutcome, ChaosOutcome];
  };
}

export const CHAOS = events as unknown as ChaosEvent[];

export function chaosById(id: string): ChaosEvent {
  const event = CHAOS.find((c) => c.id === id);
  if (!event) throw new Error(`Unknown chaos event: ${id}`);
  return event;
}

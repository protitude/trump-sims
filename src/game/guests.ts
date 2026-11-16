import guests from './cards/guests.json' with { type: 'json' };
import type { Effects } from './types.ts';

// Guests at Mar-a-Lago: tech bosses and media people, each with an ask and a
// stake in the president's coin. The content lives in cards/guests.json; the
// rules (and the odds of a leak) are in engine.ts.

export type GuestKind = 'ceo' | 'media';

export interface Guest {
  id: string;
  kind: GuestKind;
  /** The parody name. This is all the game ever shows. */
  title: string;
  /** What they want, and what they are offering. */
  text: string;
  /** What taking the coin gives: Ego, Stability and coin, all positive. */
  effects: Effects;
  result: string;
  /** The story that runs if it leaks. */
  exposed: string;
  /** The real person the parody is based on. Not shown in the game. */
  inspiredBy: string;
}

export const GUESTS = guests as unknown as Guest[];

export function guestById(id: string): Guest {
  const guest = GUESTS.find((g) => g.id === id);
  if (!guest) throw new Error(`Unknown guest: ${id}`);
  return guest;
}

/** The guest whose ask is a cage fight on the South Lawn. It is waiting there the next time he lands. */
export const FIGHT_GUEST = 'guest-cage-dana';

/** What kind of show a guest's coin buys him onto. */
export type Show = 'tv' | 'podcast';

/** The guests whose ask is airtime: taking their coin means sitting for the interview. */
const SHOWS: Record<string, Show> = {
  'guest-sean-newsmanguy': 'tv',
  'guest-laura-angle': 'tv',
  'guest-tucker-bowtie': 'podcast',
  'guest-podcast-joe': 'podcast',
  'guest-pundit-piers': 'tv',
  'guest-late-night-greg': 'tv',
  'guest-money-maria': 'tv',
};

/** The show the guest puts him on, if airtime is what was bought. */
export function showOf(guest: Guest): Show | null {
  return SHOWS[guest.id] ?? null;
}

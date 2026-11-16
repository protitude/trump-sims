export interface Effects {
  ego?: number;
  stability?: number;
  gold?: number;
  names?: number;
  /** The president's crypto coin. Only counts toward the score. */
  coin?: number;
}

export type DutyKind = 'briefing' | 'decision' | 'press' | 'call' | 'crisis' | 'hybrid';

export interface DutyOption {
  label: string;
  effects: Effects;
  result: string;
}

export interface DutyCard {
  id: string;
  kind: DutyKind;
  title: string;
  text: string;
  /** Time blocks needed to deal with it. */
  cost: number;
  options: DutyOption[];
  /** What happens if the card is still in the inbox at month end. */
  ignore: { stability: number; text: string };
  /** The real news event a card is loosely based on. Not shown in the game. */
  inspiredBy?: string;
  /** On a consequence card: the earlier choice that caused it. */
  because?: string;
  /** On a calendar card: the label shown in place of its kind. */
  setPiece?: string;
}

export type VanityCategory = 'build' | 'rename' | 'gild' | 'show' | 'trip' | 'resort';

export type Place = 'dc' | 'maralago' | 'newyork';

export type Vehicle = 'plane' | 'heli';

export interface VanityAction {
  id: string;
  category: VanityCategory;
  title: string;
  text: string;
  cost: number;
  ego: number;
  stability: number;
  gold?: number;
  names?: number;
  /** Id of the vanity action that must be completed first. */
  requires?: string;
  /** Shows are repeatable; everything else can be done once. */
  repeatable?: boolean;
  /** Where it can be done. Washington unless stated. */
  place?: Place;
  /** Done through Natalie, so it can be done wherever he is. */
  anywhere?: boolean;
  /** What it unlocks or changes once it is done. Shown on its button. */
  perk?: string;
  /** Trips move the president here when they finish. */
  travelTo?: Place;
  /** What a trip flies in. The plane unless stated. */
  vehicle?: Vehicle;
  result: string;
}

export type Tone = 'good' | 'bad' | 'ego' | 'neutral';

export interface LogEntry {
  month: number;
  text: string;
  tone: Tone;
}

/** The revealed result of a chaos choice, or of blowback landing. */
export interface Reveal {
  eyebrow: string;
  title: string;
  text: string;
  effects: Effects;
}

export type Status = 'playing' | 'won' | 'ww3' | 'depression';
export type Mood = 'sulking' | 'normal' | 'unleashed';

export interface GameState {
  seed: number;
  /** Index into CALLEES of whoever is next on the phone list. Moves on after every call and every month. */
  callee?: number;
  month: number;
  blocks: number;
  ego: number;
  stability: number;
  gold: number;
  names: number;
  /** Crypto coin padded by guests at Mar-a-Lago. Spent on Natalie's errands and the Diet Coke button; what is left counts toward the score. */
  coin: number;
  /** Builds + renames completed. Drives ego inflation. */
  monuments: number;
  /** Duty cards left to rot. Every third one spawns a crisis. */
  ignored: number;
  crisisPending: boolean;
  /** Where the president is. Duties can only be done in Washington. */
  place: Place;
  /** What the last trip flew in; it is the only way back. The plane if unset. */
  vehicle?: Vehicle;
  /** Crisis and opportunity cards already seen, so none repeats. */
  usedSpecials: string[];
  /** Consequences of earlier choices, waiting for their month. */
  pending: { card: string; due: number }[];
  /** Running counts of what the player has done; whims are measured on these. */
  stats: Record<string, number>;
  /** The whim in progress: `base` is its stat when chosen, `deadline` its last month. */
  whim: { id: string; base: number; deadline: number } | null;
  /** Whims on offer. The player must pick one before carrying on. */
  whimOffer: string[];
  /** Set on election night at the end of month 24. */
  congress: 'friendly' | 'hostile' | null;
  /** The chaos event waiting for an answer. Nothing else can be done until it has one. */
  chaos: string | null;
  /** Months in which a chaos event struck, for the yearly cap. */
  chaosMonths: number[];
  /** Chaos events already seen, so none repeats. */
  usedChaos: string[];
  /** Ignored chaos events, waiting to come back. */
  blowback: { id: string; due: number }[];
  /** What chaos did, waiting to be shown to the player and dismissed. */
  reveals: Reveal[];
  /** Guests at Mar-a-Lago this month, each with an ask and an offer. */
  guests: string[];
  /** Guests not yet dealt this time through the list. */
  guestDeck: string[];
  /** The month the Lawyer last filed a suit. One a month. */
  sued?: number;
  /** The month he last had a Diet Coke from the button. One a month. */
  coked?: number;
  /** Melania is paid for and will stand beside him at the next rally, parade or build. */
  melania?: boolean;
  /** The year of the term in which she was last booked. Once a year. */
  melaniaYear?: number;
  /** Index into MELANIA_INSULTS of the last thing she said to him. */
  insult?: number;
  /** Cage Fight Dana has paid: the fight is on the South Lawn the next time he flies in to Washington. */
  fight?: boolean;
  /** Fresh from a physical: he will brag about it at his next rally, for a little extra Ego. */
  physical?: boolean;
  /** The Golden Dome has already taken the edge off one crisis. It does that once. */
  domeSpent?: boolean;
  /** Set at the end of the impeachment vote, if a hostile Congress got that far. */
  impeached?: boolean;
  /** Bribes that leaked, waiting for the month the story runs. */
  exposures: { id: string; due: number; effects: Effects }[];
  inbox: string[];
  deck: string[];
  /** Times each vanity action has been used. */
  done: Record<string, number>;
  log: LogEntry[];
  status: Status;
}

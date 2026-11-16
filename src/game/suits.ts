// What the Lawyer files this month. Natalie gets him on the line, he finds
// something, and nobody is told how it ends.

export interface Suit {
  /** As it reads after "You sued ...". */
  who: string;
  /** What goes in the log once the papers are filed. */
  result: string;
}

export const SUITS: Suit[] = [
  { who: 'a newspaper', result: 'You sued a newspaper for $15 billion over an adjective. The Lawyer says the number is the point.' },
  { who: 'the moon', result: 'You sued the moon for being out during the day. The Lawyer could not find an address and filed anyway.' },
  { who: 'a pollster', result: 'You sued a pollster for election interference, by arithmetic. Discovery is expected to be mostly decimals.' },
  { who: 'a cartoonist', result: 'You sued a cartoonist over the size of the hands. Exhibit A is the cartoon, which is now everywhere.' },
  { who: 'the dictionary', result: 'You sued the dictionary over its definition of "landslide." The dictionary declined to comment, alphabetically.' },
  { who: 'a wind farm', result: 'You sued a wind farm for looking at you. The turbines kept turning, which the Lawyer calls contempt.' },
  { who: 'a late-night show', result: 'You sued a late-night show for emotional distress. They read the complaint on air. It got the biggest laugh of the night.' },
  { who: 'your own biographer', result: 'You sued your biographer for quoting you accurately. The tapes have been entered as evidence, by both sides.' },
  { who: 'a board game', result: 'You sued a board game because the hotels were too small. The Lawyer billed for six hours of playing it.' },
  { who: 'the Pulitzer board', result: 'You sued the Pulitzer board for giving prizes to other people. They have asked what relief you seek. You said "the prizes."' },
  { who: 'a weather app', result: 'You sued a weather app for a 40% chance of rain that happened. The Lawyer is seeking the other 60%.' },
  { who: 'a seagull', result: 'You sued a seagull at Mar-a-Lago over an incident with a club sandwich. It was served on the beach and ate the summons.' },
  { who: 'a wax museum', result: 'You sued a wax museum because the figure looked tired. They have offered to melt it down. You are thinking about it.' },
  { who: 'a streaming service', result: 'You sued a streaming service for canceling a show you had never watched. It is about the principle, and the $2 billion.' },
  { who: 'the Canadian province of Manitoba', result: 'You sued Manitoba. Nobody is sure for what. Manitoba has apologized, just in case.' },
  { who: 'a fact-checker', result: 'You sued a fact-checker for checking. The complaint has already been rated "Mostly False."' },
  { who: 'the escalator industry', result: 'You sued the escalator industry over one that stopped. The Lawyer calls it sabotage. The manufacturer calls it stairs.' },
  { who: 'a history textbook', result: 'You sued a history textbook for leaving you out of chapter nine. Chapter nine is about the Civil War.' },
];

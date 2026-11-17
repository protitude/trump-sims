import { MIDTERM_BAR, activeSeasons } from './calendar.ts';
import { VANITY } from './content.ts';
import type { DutyCard, GameState, Take } from './types.ts';

// What the calendar's big days look and sound like: the address that plays on
// the tablet when a set piece is dealt with, the applause his boasting earns,
// the posts each season brings out of him, and the highlights reel at the end.
// The rules for the days themselves are in story.ts and calendar.ts.

// ---------- The address ----------

/** The backdrop the tablet puts behind him. */
export type AddressSet = 'news' | 'chamber' | 'clinic' | 'count' | 'summit' | 'studio' | 'farewell' | 'hearing';

/** A sheet of paper held up to the camera. */
export interface Exhibit {
  title: string;
  big: string;
  small: string;
  gold?: boolean;
}

/** An address to the nation, as the tablet shows it. */
export interface Address {
  set: AddressSet;
  /** The name in the lower third. */
  chyron: string;
  /** What he says, one balloon after another. */
  lines: string[];
  ticker: string[];
  /** Reading it off the teleprompter: no bounce, and not much mouth. */
  flat: boolean;
  exhibit?: Exhibit;
  /** Which State of the Union this is: the chamber is sleepier every year. */
  year?: number;
  /** 0..1 on the applause meter in the chamber. */
  applause?: number;
  /** He is not there: the camera has only his chair to look at. */
  empty?: boolean;
}

type Script = Omit<Address, 'flat' | 'year' | 'applause'>;

const SOTU_FLAT: Script = {
  set: 'chamber',
  chyron: 'State of the Union',
  lines: ['The state of the union is... "strong." It says strong.', 'Next it says "pause for applause." So I am pausing.', 'In conclusion, "bipartisan." Whatever that is. Good night.'],
  ticker: ['PRESIDENT READS SPEECH AS WRITTEN', 'ANALYSTS: "IS HE ALL RIGHT?"', 'APPLAUSE DESCRIBED AS "CONFUSED"'],
};

const SOTU_BOAST: Script[] = [
  {
    set: 'chamber',
    chyron: 'State of the Union · hour two',
    lines: ['The state of the union is ME. And I am strong. Very strong.', 'Windmills. Nobody is talking about the windmills. I am.', 'They gave me a speech. I threw it out. Mine is better.'],
    ticker: ['PRESIDENT ABANDONS SCRIPT AT MINUTE THREE', 'WINDMILLS: MINUTE 20 OF 20', 'SPEAKER SEEN TEARING SOMETHING'],
  },
  {
    set: 'chamber',
    chyron: 'State of the Union · hour three',
    lines: ['That sign is very rude. And the spelling! Terrible.', 'Half this room hates me. The better half loves me.', 'Two hours, no notes. Lincoln used notes. Sad!'],
    ticker: ['PRESIDENT ANSWERING SIGNS INDIVIDUALLY', 'RUNNING TIME: 2 HOURS 11 MINUTES', 'MEMBERS ASLEEP ON BOTH SIDES OF AISLE'],
  },
  {
    set: 'chamber',
    chyron: 'State of the Union · still going',
    lines: ['My successor? There is no successor. Who said that?', 'The arch. Forty minutes on the arch. You are welcome.', 'They say last one. We will see. We will see what happens.'],
    ticker: ['SUCCESSOR PARAGRAPH REMOVED FROM SPEECH', 'ARCH: MINUTE 40 OF 40', 'CHAMBER LIGHTS NOW ON A TIMER'],
  },
];

const SCRIPTS: Record<string, [modest: Script, boast: Script]> = {
  'set-hundred-days': [
    {
      set: 'news',
      chyron: 'The First 100 Days',
      lines: ['Here is what we did. It is a short list.', 'One: the meetings. Two... that might be it.', 'It fits on an index card. With room. Thank you.'],
      ticker: ['HUNDRED-DAY SCORECARD: "ACCURATE"', 'PRESIDENT LISTS ACHIEVEMENTS, FINISHES EARLY', 'NETWORKS LEFT WITH 50 MINUTES TO FILL'],
      exhibit: { title: '100 DAYS', big: 'B−', small: 'graded by: experts' },
    },
    {
      set: 'news',
      chyron: 'The First 100 Days',
      lines: ['The greatest hundred days in history. Maybe ever.', 'Lincoln had sixty good days, tops. I checked.', 'I graded it myself. Very tough grader. A plus plus.'],
      ticker: ['PRESIDENT: "GREATEST 100 DAYS EVER"', 'HISTORIANS ASK WHICH 100 DAYS HE MEANS', 'REPORT CARD APPEARS TO BE SELF-ISSUED'],
      exhibit: { title: '100 DAYS', big: 'A++', small: 'graded by: me', gold: true },
    },
  ],
  'set-physical': [
    {
      set: 'clinic',
      chyron: 'The Annual Physical',
      lines: ['The doctor will read it. I am just standing here.', 'He said "adequate." I do not love "adequate."', '"For his age." Who writes this? Get a new doctor.'],
      ticker: ['DOCTOR: PRESIDENT "ADEQUATE, FOR HIS AGE"', 'CHOLESTEROL DESCRIBED AS "A NUMBER"', 'WHITE HOUSE SEEKING NEW DOCTOR'],
      exhibit: { title: 'RESULTS', big: 'OK', small: 'adequate, for his age' },
    },
    {
      set: 'clinic',
      chyron: 'The Annual Physical',
      lines: ['Healthiest president ever measured. The doctor cried.', 'I grew an inch. At my age! Nobody does that.', 'They broke the scale. In a good way. A strong way.'],
      ticker: ['PRESIDENT ANNOUNCES OWN RESULTS', 'HEIGHT UP AN INCH SINCE LAST YEAR', 'DOCTOR LAST SEEN LOOKING AT FLOOR'],
      exhibit: { title: 'RESULTS', big: '7\'0"', small: '239 lbs, all muscle', gold: true },
    },
  ],
  'set-election-night': [
    {
      set: 'count',
      chyron: 'Election Night',
      lines: ['We are waiting for the count. Like animals.', 'It is 3am. I have not said a thing. A record.', 'Still counting. How many votes can there be?'],
      ticker: ['PRESIDENT WAITS FOR COUNT', 'AIDES: "LONGEST HE HAS GONE WITHOUT SPEAKING"', 'RESULTS EXPECTED BY MORNING'],
    },
    {
      set: 'count',
      chyron: 'Election Night · 9:00 PM',
      lines: ['We won. Big. It is 9pm, so it is official.', 'Stop the count! Unless I am behind. Then count.', 'A landslide. The polls are open? Close them. We won.'],
      ticker: ['PRESIDENT DECLARES VICTORY AT 9PM', '0% OF PRECINCTS REPORTING', 'POLLS STILL OPEN IN 31 STATES'],
    },
  ],
  'set-summit-host': [
    {
      set: 'summit',
      chyron: 'Summit of the Big Economies',
      lines: ['A conference center. Beige. Very beige.', 'We signed a communique. Several pages. I held it.', 'No gift shop. I asked twice. Productive, they say.'],
      ticker: ['SUMMIT DESCRIBED AS "DULL, PRODUCTIVE"', 'COMMUNIQUE RUNS TO SEVERAL PAGES', 'HANDSHAKE ENTERS SECOND MINUTE'],
    },
    {
      set: 'summit',
      chyron: 'Summit · live from the resort',
      lines: ['Seven leaders, seven bills. Full rate. They love it.', 'The communique is on a spa menu. Classy menu.', 'I won the handshake. All seven. Nobody else was close.'],
      ticker: ['SUMMIT HELD AT PRESIDENT\'S RESORT, FULL RATE', 'LEADERS BILLED FOR THE MINIBAR', 'HANDSHAKE ENTERS SECOND MINUTE'],
    },
  ],
  'set-portrait': [
    {
      set: 'studio',
      chyron: 'The Official Portrait',
      lines: ['That is me? On a Tuesday, maybe.', 'She calls it "honest." Nasty word.', 'Fine. Hang it. The eyes look tired. Follow me, eyes.'],
      ticker: ['OFFICIAL PORTRAIT UNVEILED', 'PAINTER: "IT IS HONEST"', 'PRESIDENT ACCEPTS PORTRAIT, VISIBLY'],
    },
    {
      set: 'studio',
      chyron: 'The Official Portrait · revised',
      lines: ['Thirty pounds lighter. That is called accuracy.', 'More gold. More arms. And where is the lion?', 'Now THAT is a president. She will not sign it. Jealous.'],
      ticker: ['PORTRAIT REVISED AT PRESIDENT\'S REQUEST', 'LION ADDED "FOR REALISM"', 'PAINTER REMOVES SIGNATURE'],
    },
  ],
  'set-farewell': [
    {
      set: 'farewell',
      chyron: 'Farewell Address',
      lines: ['Thank you. It has been an honor. It says here.', 'I wish the next one luck. In general terms.', 'Goodbye, and God bless. Ten minutes. That was it.'],
      ticker: ['PRESIDENT DELIVERS GRACIOUS FAREWELL', 'COMMENTATORS: "A SURPRISE"', 'SEVERAL ANCHORS VISIBLY MOVED'],
    },
    {
      set: 'farewell',
      chyron: 'Farewell Address?',
      lines: ['People are saying stay. Smart people. So maybe.', 'Four years is a suggestion. Read it. It is vague.', 'I am not leaving. We will see what happens!'],
      ticker: ['PRESIDENT FLOATS NOT LEAVING', 'SCHOLARS WOKEN IN ELEVEN TIME ZONES', 'MOVING TRUCK TOLD TO WAIT'],
      exhibit: { title: 'TERM ENDS', big: 'TBD', small: 'we will see', gold: true },
    },
  ],
  'hear-subpoena': [
    {
      set: 'hearing',
      chyron: 'Oversight Committee · live',
      lines: ['Take the boxes. All forty. My idea, by the way.', 'There is nothing in them. Best nothing you ever saw.', 'Careful with the gold ones. Those come back.'],
      ticker: ['FORTY BOXES ARRIVE ON THE HILL', 'WHITE HOUSE: BOXES WERE PRESIDENT\'S IDEA', 'CHAIR ORDERS MORE SHELVES'],
    },
    {
      set: 'hearing',
      chyron: 'Oversight Committee · live',
      lines: ['The chair recognizes... the chair. His chair.', 'The guest book is privileged, we are told. And the buffet.', 'This committee will now hold a hearing on the buffet.'],
      ticker: ['PRESIDENT DECLARES GUEST BOOK PRIVILEGED', 'PRIVILEGE EXTENDED TO BUFFET', 'CHAIR SCHEDULES BUFFET HEARING'],
      empty: true,
    },
  ],
  'hear-testimony': [
    {
      set: 'hearing',
      chyron: 'The Hearing · live',
      lines: ['The clerk will read the statement. All four pages.', '"Paragraph nine. See paragraph eight."', 'The witness chair remains, for the record, a chair.'],
      ticker: ['WRITTEN STATEMENT READ INTO RECORD', 'CLERK PRAISED FOR MONOTONE', 'ROOM EMPTYING STEADILY'],
      empty: true,
    },
    {
      set: 'hearing',
      chyron: 'The Hearing · by phone',
      lines: ['Hello? Am I on? It is me. Your favorite witness.', 'That binder is a liar. I barely know the binder.', 'Ninety minutes. No lawyer. Best testimony in history.'],
      ticker: ['PRESIDENT PHONES IN TO OWN HEARING', 'CALL ENTERS MINUTE 90', 'CHAIR THANKS PRESIDENT FOR "THE EXHIBITS"'],
    },
  ],
  'hear-vote': [
    {
      set: 'hearing',
      chyron: 'The Vote · whip count',
      lines: ['How is the district? Good. Good district.', 'And the family? I am asking nicely. Write that down.', 'Forty calls. All polite. I need to lie down.'],
      ticker: ['PRESIDENT CALLS MEMBERS, POLITELY', 'SEVERAL MEMBERS HAD TO SIT DOWN', 'COUNT REMAINS CLOSE'],
    },
    {
      set: 'hearing',
      chyron: 'Capitol steps · live',
      lines: ['WITCH HUNT! The biggest witch. The best hunt.', 'The chair has a new name. Sleepy Gavel. It will stick.', 'They are counting in the windows. Wave at them!'],
      ticker: ['PRESIDENT HOLDS RALLY ON CAPITOL STEPS', 'CHAIR GIVEN NEW NICKNAME', 'MEMBERS WATCH FROM WINDOWS, COUNTING'],
    },
  ],
};

const SOTU = /^set-sotu-(\d)$/;

/** What plays on the tablet while he deals with a calendar card, by the option taken. */
export function addressFor(s: GameState, card: DutyCard, option: number): Address | null {
  const boast = option === 1;
  const year = Number(SOTU.exec(card.id)?.[1] ?? 0);
  if (year) {
    const script = boast ? SOTU_BOAST[year - 1] : SOTU_FLAT;
    // Read as written, both sides clap once. Unscripted, it depends what there is to point at.
    return { ...script, flat: !boast, year, applause: boast ? Math.min(1, 0.25 + bragMaterial(s) / 16) : 0.12 };
  }
  const script = SCRIPTS[card.id]?.[boast ? 1 : 0];
  return script ? { ...script, flat: !boast } : null;
}

// ---------- Applause: things to brag about ----------

/** Cards where the boastful answer is a speech, and so is only as good as his material. */
const SPEECHES = ['set-hundred-days', 'set-sotu-1', 'set-sotu-2', 'set-sotu-3', 'set-farewell'];
/** Things built, named or gilded that it takes to earn one more Ego from a speech. */
export const BRAGS_PER_EGO = 4;
export const BRAG_EGO_MAX = 4;

/** Everything he has built, named or gilded: the applause lines he writes himself. */
export function bragMaterial(s: GameState): number {
  return VANITY.filter((v) => !v.repeatable && s.done[v.id] && (v.category === 'build' || v.category === 'rename' || v.category === 'gild')).length;
}

/** Extra Ego the boastful option of this card earns, for having something to boast about. */
export function applauseEgo(s: GameState, card: DutyCard, option: number): number {
  if (option !== 1 || !SPEECHES.includes(card.id)) return 0;
  return Math.min(BRAG_EGO_MAX, Math.floor(bragMaterial(s) / BRAGS_PER_EGO));
}

/** Whether this card is one where applause counts, for the note on its menu. */
export const isSpeech = (card: DutyCard): boolean => SPEECHES.includes(card.id);

// ---------- Polls ----------

/** The midterm polls: what the pollsters have, and what he says they have. */
export function polls(s: GameState): { real: number; claimed: number; bar: number } {
  const real = Math.max(0, Math.min(100, Math.round(s.stability)));
  // His number is always higher, and never lower than a landslide.
  const claimed = Math.min(99, Math.max(72, real + 24 + (s.month % 3) * 2));
  return { real, claimed, bar: MIDTERM_BAR };
}

// ---------- Posts ----------

interface PostPool {
  /** What he bleats at Natalie, in the order he bleats it. */
  shouts: string[];
  /** What the log says went out. */
  log: string;
}

const SEASON_POSTS: Record<string, PostPool> = {
  recess: {
    shouts: ['CONGRESS IS LAZY!', 'I NEVER REST', 'WHO IS AT THE BEACH?', 'NAMES. I WANT NAMES', 'WORKING HARD!!!', 'VERY EMPTY TOWN'],
    log: 'You posted at 3am that Congress is on vacation and you alone are working. It was sent from the golf course.',
  },
  birthday: {
    shouts: ['HAPPY BIRTHDAY TO ME', 'BIGGEST CAKE EVER', 'WHERE IS MY PARADE?', 'I LOOK 39', 'THANK ME!', 'MANY CANDLES. STRONG LUNGS'],
    log: 'You posted birthday wishes to yourself at 3am, and then thanked yourself in the replies.',
  },
  campaign: {
    shouts: ['VOTE!!!', 'RIGGED (IF WE LOSE)', 'RED WAVE', 'POLLS ARE FAKE', 'EXCEPT MY POLLS', 'I AM ON THE BALLOT (NOT REALLY)'],
    log: 'You posted the polls at 3am. They were your polls. The other polls have been called a hoax.',
  },
  hostile: {
    shouts: ['WITCH HUNT!', 'PRESIDENTIAL HARASSMENT', 'SUBPOENA THIS', 'THE BUFFET IS PRIVILEGED', 'NO COLLUSION', 'SLEEPY GAVEL'],
    log: 'You posted "PRESIDENTIAL HARASSMENT" at 3am, eleven times. The committee has entered all eleven into the record.',
  },
  legacy: {
    shouts: ['BEST PRESIDENT EVER', 'ASK THE HISTORIANS', 'PUT ME ON THE MOUNTAIN', 'A THIRD TERM?', 'LEGACY!!!', 'YOU WILL MISS ME'],
    log: 'You posted your own ranking of the presidents at 3am. You were first, and also third.',
  },
};

const DAY_POSTS: Record<string, PostPool> = {
  'set-hundred-days': {
    shouts: ['100 DAYS!', 'BEST 100 EVER', 'LINCOLN WHO?', 'A++', 'SO MUCH WINNING', 'DAY 101: ALSO GREAT'],
    log: 'You posted your own hundred-day scorecard at 3am. Every category was "WON."',
  },
  'set-physical': {
    shouts: ['PERFECT HEALTH', 'DOCTOR CRIED', 'I GREW AN INCH', 'ACED THE CLOCK TEST', 'STRONG HEART', 'CHOLESTEROL IS FAKE'],
    log: 'You posted your physical at 3am, with several of the numbers improved.',
  },
  'set-election-night': {
    shouts: ['WE WON!', 'STOP THE COUNT', 'COUNT FASTER', 'LANDSLIDE', 'FRAUD (MAYBE)', 'I CALLED IT'],
    log: 'You posted "WE WON" at 3am. The count was at four percent.',
  },
  'set-summit-host': {
    shouts: ['GREAT SUMMIT', 'I WON THE HANDSHAKE', 'THEY LOVE ME', 'BEST HOST', 'SEVEN BILLS', 'VERY STRONG GRIP'],
    log: 'You posted a ranking of the other leaders\' handshakes at 3am. Two ambassadors have been recalled.',
  },
  'set-portrait': {
    shouts: ['MORE GOLD', 'ADD A LION', 'I LOOK THIN', 'FIRE THE PAINTER', 'CENTRAL CASTING', 'BEST PORTRAIT'],
    log: 'You posted notes on the portrait at 3am. The painter has read them and is lying down.',
  },
  'set-farewell': {
    shouts: ['NOT GOODBYE', 'FOUR MORE?', 'YOU ARE WELCOME', 'CANCEL THE TRUCK', 'I MIGHT STAY', 'WE WILL SEE'],
    log: 'You posted "NOT GOODBYE" at 3am. The moving company has asked for clarification.',
  },
};

/** What this month in particular brings out of him at 3am, if anything. */
export function seasonalPost(s: GameState): PostPool | null {
  const day = s.inbox.find((id) => DAY_POSTS[id]);
  if (day) return DAY_POSTS[day];
  const sotu = s.inbox.some((id) => SOTU.test(id));
  if (sotu) {
    return {
      shouts: ['BIG SPEECH TONIGHT', 'NO NOTES', 'WATCH THE RATINGS', 'THEY WILL STAND', 'OR ELSE', 'STATE OF ME: STRONG'],
      log: 'You posted a preview of the State of the Union at 3am. The speechwriters learned what was in it from the post.',
    };
  }
  // The season that changes the most comes first: a hostile House outranks a recess.
  const seasons = activeSeasons(s).map((season) => season.id);
  const id = ['hostile', 'campaign', 'legacy', 'birthday', 'recess'].find((x) => seasons.includes(x));
  return id ? SEASON_POSTS[id] : null;
}

// ---------- The highlights reel ----------

const REEL: Record<string, Record<Take, string>> = {
  'set-hundred-days': {
    boast: 'The hundred days: "The greatest in history. Lincoln had sixty good ones, tops."',
    modest: 'The hundred days: an accurate list, on one index card. You do not talk about the index card.',
    skipped: 'The hundred days: the scorecards ran without you. You say you were too busy winning.',
  },
  'set-sotu-1': {
    boast: 'First State of the Union: "The state of the union is ME." Twenty minutes on windmills.',
    modest: 'First State of the Union: read as written. You describe this as "being held hostage."',
    skipped: 'First State of the Union: the Speaker read it to an empty lectern, doing your voice. Badly, you say.',
  },
  'set-physical': {
    boast: 'The physical: "Healthiest president ever measured. I grew an inch. The doctor cried."',
    modest: 'The physical: "adequate, for his age." That doctor no longer works there.',
    skipped: 'The physical: it leaked. You maintain that cholesterol is a matter of opinion.',
  },
  'set-election-night': {
    boast: 'Election night: victory declared at 9pm, in a state that had not closed its polls.',
    modest: 'Election night: you waited for the count. "The longest three hours of my life. I said nothing."',
    skipped: 'Election night: you went to bed. You say you already knew.',
  },
  'set-sotu-2': {
    boast: 'Second State of the Union: two hours and eleven minutes. "I answered every sign. Personally."',
    modest: 'Second State of the Union: the teleprompter again. You have stopped speaking to it.',
    skipped: 'Second State of the Union: you did not go. "They had signs. Rude signs."',
  },
  'set-summit-host': {
    boast: 'The summit: "Seven leaders, seven bills, full rate. And I won the handshake."',
    modest: 'The summit: a conference center with no gift shop. "Beige. I was very brave."',
    skipped: 'The summit: nobody booked a room. "Video is the future. One of them was on mute. Perfect."',
  },
  'set-sotu-3': {
    boast: 'Last State of the Union: forty minutes on the arch, and no word of a successor.',
    modest: 'Last State of the Union: gracious, and as written. You blame the writers.',
    skipped: 'Last State of the Union: skipped. "They know the state. It is strong. I sent a post."',
  },
  'set-portrait': {
    boast: 'The portrait: "Thirty pounds lighter, a gold frame, and a lion. Finally, accuracy."',
    modest: 'The portrait: the honest one. It hangs in the hall and looks tired, which you say it is.',
    skipped: 'The portrait: hung by the fire exit, unseen by you. "I have never used that exit."',
  },
  'set-farewell': {
    boast: 'The farewell: "I am not leaving. We will see what happens."',
    modest: 'The farewell: ten gracious minutes. You have asked for the tape to be destroyed.',
    skipped: 'The farewell: an hour of penguins. "Great ratings. My penguins."',
  },
};

/** The term's big days as he would tell them, in the order they happened. */
export function highlights(s: GameState): string[] {
  const lines: string[] = [];
  for (const [id, takes] of Object.entries(REEL)) {
    const take = s.setPieces?.[id];
    if (take) lines.push(takes[take]);
    if (id === 'set-election-night' && s.congress) {
      lines.push(
        s.congress === 'friendly'
          ? 'The midterms: "The biggest midterm win in history. Maybe the only one."'
          : 'The midterms: "RIGGED. Also, I won." (You lost Congress.)',
      );
    }
  }
  return lines;
}

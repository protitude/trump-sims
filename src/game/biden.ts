// Month 1 holdovers: Joe Biden wandering the White House hall, and Commander
// guarding the South Lawn.

export const BIDEN_LINES: string[] = [
  "Listen here, Jack, where'd they move the ice cream machine? Chocolate chocolate chip, not a joke!",
  "Come on, man! You're telling me this isn't the Amtrak to Wilmington, Jack?",
  "Look, Jack, here's the deal: back in Scranton we had a guy named Corn Pop. Bad dude!",
  "Hey Jack, did you see my Corvette? I parked it right next to the bowling alley in 1974.",
  "Listen, Jack, I've been in the Senate for 180 years and nobody's ever moved that bathroom.",
  "No malarkey, Jack! Where's Jill? She told me not to wander past the portrait of Lincoln.",
  "Look, fat—I mean Jack—back when I was a lifeguard, the kids used to rub my hairy legs in the sun.",
  "Here's the deal, Jack: two words—Made in America. Wait, that's three. Anyway, where's the kitchen?",
  "Hey Jack, you look familiar. Did we play football at Delaware State? Good hands, pal.",
  "Listen, Jack, I'm not kidding around—somebody took my aviators. Oh. They're on my face.",
  "Come on, Jack, let's do push-ups right here on the carpet! Right after my nap.",
  "Look, Jack, I told Barack—I said, 'Barack, don't jump!'—Wait, what room is this?",
  "Hey Jack, do you know the thing? You know, the thing! Everybody knows the thing.",
  "Listen here, Jack, I drove an 18-wheeler once. Well, I sat in one. Great horn. Honk honk!",
  "Not a joke, Jack—my Uncle Bosie was eaten by cannibals. Or maybe he just missed the train.",
  "Here's the deal, Jack: if you're looking for the Oval Office, take a left at the horse-faced pony soldier.",
  "Hey Jack, have you seen Commander? He's a good boy. Only bit twelve Secret Service guys, tops.",
  "Come on, man! In my day a double scoop cost a nickel and you got change back, Jack.",
  "Listen, Jack, I'm supposed to meet the President of Mexico—President Sisi. Is he in the Press Room?",
  "Look, Jack, America can be defined in a single word: asufutimaehaehfutbw. Think about that.",
  "Hey Jack, did somebody paint the curtains gold? Jill's gonna have a fit when she sees this.",
  "Listen here, Jack, I beat Medicare! Wait—no, I mean—anyway, where's the exit?",
  "Come on, Jack, don't tell me I'm retired. I've got a 3 o'clock with Strom Thurmond!",
  "Here's the deal, Jack: keep the record player on at night so the kids learn words. Good night, folks!",
];

export const COMMANDER_BARKS: string[] = [
  'WOOF!',
  'ARF! ARF!',
  'BARK! BARK!',
  'GRRR! WOOF!',
  'RROOF!',
  'WOOF! WOOF!',
];

/** Picks a random index into BIDEN_LINES without repeating the previous one. */
export function nextBidenLine(last?: number): number {
  if (BIDEN_LINES.length <= 1) return 0;
  let i = Math.floor(Math.random() * BIDEN_LINES.length);
  if (i === last) i = (i + 1) % BIDEN_LINES.length;
  return i;
}

/** Picks a random bark for Commander. */
export function nextBark(last?: string): string {
  const pool = COMMANDER_BARKS.filter((b) => b !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? COMMANDER_BARKS[0];
}

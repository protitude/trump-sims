// Who is on the other end of the phone. He calls, he tells them off, he hangs
// up first. The name on the list changes after every call and every month.

export interface Callee {
  /** As it reads after "Call ...". */
  who: string;
  /** Why they have it coming, shown on the button. */
  gripe: string;
  /** What goes in the log once he has hung up. */
  result: string;
}

export const CALLEES: Callee[] = [
  { who: 'the Fed chair', gripe: 'Rates are still a number you did not pick.', result: 'You told the Fed chair he was too late, too slow and too tall. Rates did not move. He did not either.' },
  { who: 'a late-night host', gripe: 'He did a bit about you. It got a laugh. Unacceptable.', result: 'You told a late-night host he has no talent and no ratings. He has tonight\'s monologue now.' },
  { who: 'the Prime Minister of Canada', gripe: 'He keeps saying "sovereign" in that polite voice.', result: 'You told the Prime Minister of Canada he was a governor. He apologized, which is how they say no.' },
  { who: 'the Senate Majority Leader', gripe: 'The Senate is still doing things at Senate speed.', result: 'You told the Senate Majority Leader he was weak. He agreed with you for forty minutes and changed nothing.' },
  { who: 'the Speaker of the House', gripe: 'He called a recess without asking you first.', result: 'You told the Speaker he works for you. He said "yes sir" eleven times, which was all you called for.' },
  { who: 'a federal judge', gripe: 'She ruled against you, in writing, with footnotes.', result: 'You told a federal judge she was a disgrace. Her clerk took notes. So did your lawyers, pale.' },
  { who: 'the NATO Secretary General', gripe: 'Somebody over there is still not paying.', result: 'You told the NATO Secretary General to pay up. He called you "Daddy" and you let it go.' },
  { who: 'your own Attorney General', gripe: 'Your enemies are, as of this morning, still at large.', result: 'You told your Attorney General to try harder. Three subpoenas went out before you had hung up.' },
  { who: 'a network news president', gripe: 'The chyron last night was very unfair.', result: 'You told a network president you would pull the license. There is no license. He settled anyway.' },
  { who: 'the Chief Justice', gripe: 'He issued a "statement." Nobody asked for a statement.', result: 'You told the Chief Justice he owed you. The line was silent, and then it was a dial tone.' },
  { who: 'the Governor of California', gripe: 'He has been posting in your style. Badly. People like it.', result: 'You told the Governor of California he was a loser. He posted the call in ALL CAPS before you had put the phone down.' },
  { who: 'the Mayor of New York', gripe: 'It is your city and he keeps acting like it is his.', result: 'You told the Mayor of New York the city was finished. He invited you to lunch. You said maybe.' },
  { who: 'a pollster', gripe: 'His numbers are wrong. Your numbers are the numbers.', result: 'You told a pollster his poll was fake. He asked if you would say you were "very" or "somewhat" angry.' },
  { who: 'the head of the Nobel committee', gripe: 'Another year. Another person who is not you.', result: 'You told the Nobel committee they had embarrassed themselves. They thanked you in Norwegian for your interest.' },
  { who: 'the weather service', gripe: 'It rained on the golf. Somebody approved that.', result: 'You told the weather service the forecast was rigged. Tomorrow is now "sunny, per the President."' },
  { who: 'a tech billionaire', gripe: 'He was at the dinner and he did not clap first.', result: 'You told a tech billionaire he would be nothing without you. He donated to the ballroom within the hour.' },
  { who: 'the President of France', gripe: 'He did the long handshake again. In front of people.', result: 'You told the President of France his wine was getting a tariff. He said something in French. It sounded expensive.' },
  { who: 'the Kennedy Center box office', gripe: 'There are empty seats at a show with your name on it.', result: 'You told the box office to announce a sellout. It is now sold out. The seats do not know.' },
  { who: 'the jobs numbers lady', gripe: 'The jobs report came out wrong again.', result: 'You told the statistician the numbers were rigged and she was fired. She had been fired since August.' },
  { who: 'the wrong number', gripe: 'You are not sure who this is. That has never stopped you.', result: 'You told off a dentist in Tulsa for nine minutes. He says it was an honor and he is voting for you again.' },
];

export function calleeAt(i: number | undefined): Callee {
  return CALLEES[(i ?? 0) % CALLEES.length];
}

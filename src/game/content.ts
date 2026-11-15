import { SEQUELS, SET_PIECE_CARDS } from './story.ts';
import type { DutyCard, VanityAction } from './types.ts';
import ally from './cards/ally.json' with { type: 'json' };
import econ from './cards/econ.json' with { type: 'json' };
import event from './cards/event.json' with { type: 'json' };
import gov from './cards/gov.json' with { type: 'json' };
import house from './cards/house.json' with { type: 'json' };
import law from './cards/law.json' with { type: 'json' };
import media from './cards/media.json' with { type: 'json' };
import peace from './cards/peace.json' with { type: 'json' };
import sci from './cards/sci.json' with { type: 'json' };
import special from './cards/special.json' with { type: 'json' };

// All game content lives here as plain data. The original cards are written
// out below; the rest are in ./cards/*.json, one file per news beat, each card
// loosely based on a real event (see its "inspiredBy" line). To add a card,
// append to a list here or to one of those files, then run
// `node scripts/validate-cards.mjs <file>`.
// Convention for two-option cards: option 0 is the dull, responsible choice.

const NEWS_CARDS = [ally, econ, event, gov, house, law, media, peace, sci, special].flat() as DutyCard[];

const BASE_DUTIES: DutyCard[] = [
  {
    id: 'intel-briefing',
    kind: 'briefing',
    title: 'Daily Intelligence Briefing',
    text: 'Forty pages, no pictures. Staff have added your name to every third paragraph to hold your attention.',
    cost: 2,
    options: [
      {
        label: 'Sit through it',
        effects: { stability: 9, ego: -4 },
        result: 'You sat through the whole briefing. You now know where several countries are.',
      },
    ],
    ignore: { stability: -5, text: 'The intelligence briefing went unread. Somewhere, a situation develops.' },
  },
  {
    id: 'budget-meeting',
    kind: 'briefing',
    title: 'Budget Meeting',
    text: 'Three hours of spreadsheets. Not one of the line items is a statue.',
    cost: 2,
    options: [
      {
        label: 'Attend and nod',
        effects: { stability: 8, ego: -4 },
        result: 'The government is funded. Nobody clapped.',
      },
    ],
    ignore: { stability: -5, text: 'No budget. Federal workers are being paid in commemorative coins.' },
  },
  {
    id: 'hurricane-briefing',
    kind: 'briefing',
    title: 'Hurricane Response',
    text: 'A big one is coming. They need sign-offs, and they need them from you, apparently.',
    cost: 2,
    options: [
      {
        label: 'Sign the boring forms',
        effects: { stability: 10, ego: -3 },
        result: 'Aid arrived on time. The hurricane did not thank you personally.',
      },
    ],
    ignore: { stability: -7, text: 'The hurricane response was signed by nobody. It shows.' },
  },
  {
    id: 'trade-signing',
    kind: 'briefing',
    title: 'Trade Deal Fine Print',
    text: 'The deal is done but someone has to read clauses 1 through 900. Your lawyers insist it be you.',
    cost: 2,
    options: [
      {
        label: 'Read every clause',
        effects: { stability: 9, ego: -5 },
        result: 'You read the deal. It is a normal deal. This is somehow the worst part.',
      },
    ],
    ignore: { stability: -5, text: 'The trade deal lapsed. Soybeans are piling up somewhere.' },
  },
  {
    id: 'cabinet-meeting',
    kind: 'decision',
    title: 'Cabinet Meeting',
    text: 'The full cabinet is assembled around the big table, waiting.',
    cost: 1,
    options: [
      {
        label: 'Work through the agenda',
        effects: { stability: 6, ego: -3 },
        result: 'Decisions were made. Several departments now know what they are doing.',
      },
      {
        label: 'Go round the table for compliments',
        effects: { ego: 6, stability: -3 },
        result: 'Each secretary praised you in turn. The Secretary of Energy cried. Nothing else occurred.',
      },
    ],
    ignore: { stability: -3, text: 'The cabinet sat in the room for six hours, then went home.' },
  },
  {
    id: 'penguin-tariff',
    kind: 'decision',
    title: 'The Penguin Question',
    text: 'An adviser proposes tariffs on an island inhabited exclusively by penguins.',
    cost: 1,
    options: [
      {
        label: 'Leave the penguins alone',
        effects: { stability: 5, ego: -2 },
        result: 'The penguins remain untaxed. Markets exhale.',
      },
      {
        label: '"They have been ripping us off"',
        effects: { ego: 5, stability: -5 },
        result: 'Penguins tariffed at 40%. They have not responded, which you take as weakness.',
      },
    ],
    ignore: { stability: -3, text: 'With no guidance, the adviser tariffed the penguins on his own initiative.' },
  },
  {
    id: 'unnamed-bill',
    kind: 'decision',
    title: 'A Bill On Your Desk',
    text: 'A popular infrastructure bill needs your signature. Your name appears nowhere in its title.',
    cost: 1,
    options: [
      {
        label: 'Sign it anyway',
        effects: { stability: 6, ego: -4 },
        result: 'Bridges will be repaired. Anonymous, nameless bridges.',
      },
      {
        label: 'Veto until it is renamed',
        effects: { ego: 5, stability: -5 },
        result: 'Vetoed. Congress is workshopping titles. The bridges wait.',
      },
    ],
    ignore: { stability: -4, text: 'The bill expired on your desk, under a golf magazine.' },
  },
  {
    id: 'alliance',
    kind: 'decision',
    title: 'The Generals Want A Word',
    text: 'An old ally is nervous and would like to hear that the alliance still exists.',
    cost: 1,
    options: [
      {
        label: 'Reaffirm the alliance',
        effects: { stability: 7, ego: -3 },
        result: 'You said the alliance is fine. A continent slept better.',
      },
      {
        label: 'Ask what they have paid lately',
        effects: { ego: 4, stability: -6 },
        result: 'You sent the ally an invoice. They are reading it in several languages.',
      },
    ],
    ignore: { stability: -5, text: 'The ally heard nothing back and has started making other friends.' },
  },
  {
    id: 'weather-map',
    kind: 'decision',
    title: 'The Forecast',
    text: 'The weather service says the storm will miss the state you said it would hit.',
    cost: 1,
    options: [
      {
        label: 'Defer to the meteorologists',
        effects: { stability: 5, ego: -4 },
        result: 'You were wrong about the weather, in public, like a mortal.',
      },
      {
        label: 'Fix the map with a marker',
        effects: { ego: 5, stability: -4 },
        result: 'The map now agrees with you. The storm does not.',
      },
    ],
    ignore: { stability: -3, text: 'Two forecasts are now circulating. Residents are evacuating in both directions.' },
  },
  {
    id: 'appointment',
    kind: 'decision',
    title: 'A Vacancy',
    text: 'The public health agency needs a new director.',
    cost: 1,
    options: [
      {
        label: 'Appoint the qualified deputy',
        effects: { stability: 6, ego: -2 },
        result: 'A competent person now runs the agency. She did not mention you in her speech.',
      },
      {
        label: 'Appoint your golf caddie',
        effects: { ego: 5, stability: -5 },
        result: 'The caddie is in charge. He says your swing is the healthiest he has ever seen.',
      },
    ],
    ignore: { stability: -4, text: 'The agency is being run by whoever answers the phone.' },
  },
  {
    id: 'the-button',
    kind: 'decision',
    title: 'Desk Ergonomics',
    text: 'Staff would like to move the big red button further away from the soda button.',
    cost: 1,
    options: [
      {
        label: 'Fine, move it',
        effects: { stability: 6, ego: -2 },
        result: 'The buttons are now on separate desks. The Joint Chiefs sent flowers.',
      },
      {
        label: '"I know which is which"',
        effects: { ego: 3, stability: -6 },
        result: 'The buttons stay. You ordered a soda and everyone in the room flinched.',
      },
    ],
    ignore: { stability: -4, text: 'The buttons remain adjacent. A near miss is logged and classified.' },
  },
  {
    id: 'press-conference',
    kind: 'press',
    title: 'Press Conference',
    text: 'A reporter asks a simple factual question about your own policy.',
    cost: 1,
    options: [
      {
        label: 'Answer the question',
        effects: { stability: 6, ego: -4 },
        result: 'You gave a clear answer. The reporter was visibly shaken.',
      },
      {
        label: 'Call the reporter nasty',
        effects: { ego: 6, stability: -4 },
        result: '"Nasty question. Next." The crowd in your head went wild.',
      },
    ],
    ignore: { stability: -3, text: 'The press pool waited at an empty podium and wrote about that instead.' },
  },
  {
    id: 'fact-check',
    kind: 'press',
    title: 'The Interview',
    text: 'On live television the host says your crowd-size figure exceeds the population of the state.',
    cost: 1,
    options: [
      {
        label: 'Concede the number',
        effects: { stability: 5, ego: -5 },
        result: 'You admitted the crowd was merely large. It hurt in a place you cannot name.',
      },
      {
        label: '"Many people are saying"',
        effects: { ego: 5, stability: -3 },
        result: 'Many people are saying it. You could not name them. They are very private people.',
      },
    ],
    ignore: { stability: -2, text: 'You canceled the interview. The network aired the empty chair.' },
  },
  {
    id: 'turkey-pardon',
    kind: 'press',
    title: 'Turkey Pardon',
    text: 'The annual ceremony. The turkey is getting more applause than you did.',
    cost: 1,
    options: [
      {
        label: 'Pardon it graciously',
        effects: { stability: 4, ego: -2 },
        result: 'The turkey was pardoned. A nation briefly felt normal.',
      },
      {
        label: 'Make the speech about yourself',
        effects: { ego: 5, stability: -2 },
        result: 'Forty minutes on your own pardoning record. The turkey left early.',
      },
    ],
    ignore: { stability: -2, text: 'Nobody pardoned the turkey. Its lawyers are appealing.' },
  },
  {
    id: 'strongman-call',
    kind: 'call',
    title: 'Call From A Strongman',
    text: 'He says you are the greatest leader in history. Also, could he have one small neighboring country.',
    cost: 1,
    options: [
      {
        label: 'Decline politely',
        effects: { stability: 7, ego: -3 },
        result: 'You said no. He stopped complimenting you mid-sentence.',
      },
      {
        label: '"Finally, someone who gets me"',
        effects: { ego: 7, stability: -8 },
        result: 'He got the country. You got a very nice letter, which you have framed.',
      },
    ],
    ignore: { stability: -5, text: 'The strongman took your silence as a yes.' },
  },
  {
    id: 'ally-call',
    kind: 'call',
    title: 'Call From A Prime Minister',
    text: 'She wants to discuss the trade agreement. She did not open with a compliment.',
    cost: 1,
    options: [
      {
        label: 'Negotiate like an adult',
        effects: { stability: 7, ego: -4 },
        result: 'A sensible agreement was reached. It felt like eating plain rice.',
      },
      {
        label: 'Put her on hold indefinitely',
        effects: { ego: 3, stability: -5 },
        result: 'She has been on hold for nine days. The hold music is you, speaking.',
      },
    ],
    ignore: { stability: -4, text: 'The Prime Minister left a voicemail. It was not warm.' },
  },
  {
    id: 'un-speech',
    kind: 'press',
    title: 'Address To The United Nations',
    text: 'A careful speech has been written. Every delegate on Earth is listening.',
    cost: 2,
    options: [
      {
        label: 'Read the teleprompter',
        effects: { stability: 10, ego: -4 },
        result: 'You read the speech exactly as written. Diplomats wept with relief.',
      },
      {
        label: 'Riff',
        effects: { ego: 8, stability: -8 },
        result: 'Ninety minutes, mostly about windmills. Six ambassadors were recalled.',
      },
    ],
    ignore: { stability: -6, text: 'The UN slot was filled by a nervous deputy reading from his phone.' },
  },
  {
    id: 'disaster-visit',
    kind: 'press',
    title: 'Disaster Zone Visit',
    text: 'A flooded town is waiting for the President to show up and look concerned.',
    cost: 2,
    options: [
      {
        label: 'Listen to the survivors',
        effects: { stability: 9, ego: -3 },
        result: 'You listened for a whole afternoon. People felt heard. You felt nothing, but quietly.',
      },
      {
        label: 'Throw paper towels into the crowd',
        effects: { ego: 5, stability: -4 },
        result: 'Great arc on the throws. Tremendous form. The town remains underwater.',
      },
    ],
    ignore: { stability: -6, text: 'You skipped the disaster zone. The photos are of the golf course instead.' },
  },
];

const BASE_CRISES: DutyCard[] = [
  {
    id: 'crisis-naval',
    kind: 'crisis',
    title: 'CRISIS: Naval Standoff',
    text: 'Two fleets are nose to nose because nobody read a memo. Everyone is waiting for you.',
    cost: 3,
    options: [
      {
        label: 'Spend all night on the phone',
        effects: { stability: 10, ego: -6 },
        result: 'Both fleets backed off. You missed the unveiling of your own portrait.',
      },
    ],
    ignore: { stability: -18, text: 'The standoff escalated. Shots were fired. They are calling it an "incident" for now.' },
  },
  {
    id: 'crisis-markets',
    kind: 'crisis',
    title: 'CRISIS: Markets In Freefall',
    text: 'Traders have noticed that nobody is running anything. The line is going down.',
    cost: 3,
    options: [
      {
        label: 'Calm the markets, boringly',
        effects: { stability: 10, ego: -6 },
        result: 'You read a dull statement in a dull voice. The line went back up.',
      },
    ],
    ignore: { stability: -18, text: 'The crash continued. Several countries are asking for their money back.' },
  },
  {
    id: 'crisis-allies',
    kind: 'crisis',
    title: 'CRISIS: Allies Leave The Group Chat',
    text: 'Seven allied leaders have formed a new alliance. You were not invited to it.',
    cost: 3,
    options: [
      {
        label: 'Apologize, sort of',
        effects: { stability: 10, ego: -7 },
        result: 'You said "mistakes were made" by unnamed others. They let you back in.',
      },
    ],
    ignore: { stability: -18, text: 'The allies are gone. The map in the Situation Room has a lot more red on it.' },
  },
];

const BASE_HYBRIDS: DutyCard[] = [
  {
    id: 'hybrid-summit',
    kind: 'hybrid',
    title: 'OPPORTUNITY: Peace Summit At Your Golf Resort',
    text: 'Two warring nations will sign anything, anywhere. Anywhere could be the 18th hole.',
    cost: 3,
    options: [
      {
        label: 'Host it',
        effects: { stability: 12, ego: 10, gold: 1 },
        result: 'Peace was signed on the 18th green. Both delegations paid full rack rate.',
      },
    ],
    ignore: { stability: 0, text: 'The peace summit was held in Geneva instead. Nobody mentioned you.' },
  },
  {
    id: 'hybrid-accords',
    kind: 'hybrid',
    title: 'OPPORTUNITY: The Trump Accords',
    text: 'The diplomats did all the work. They will let you put your name on it if you just show up.',
    cost: 3,
    options: [
      {
        label: 'Show up and sign',
        effects: { stability: 10, ego: 12, names: 1 },
        result: 'A real treaty, and it has your name on it. In gold leaf. You checked.',
      },
    ],
    ignore: { stability: 0, text: 'The treaty was named after a mid-sized Norwegian city.' },
  },
  {
    id: 'hybrid-nobel',
    kind: 'hybrid',
    title: 'OPPORTUNITY: The Shortlist',
    text: 'A prize committee is watching. All you have to do is behave for one week.',
    cost: 2,
    options: [
      {
        label: 'Behave for one week',
        effects: { stability: 8, ego: 8 },
        result: 'Seven days of statesmanship. You did not win, but you were "discussed."',
      },
    ],
    ignore: { stability: 0, text: 'The committee stopped watching.' },
  },
  {
    id: 'hybrid-ribbon',
    kind: 'hybrid',
    title: 'OPPORTUNITY: Ribbon Cutting',
    text: 'A hospital you accidentally funded is opening. They have offered you giant scissors.',
    cost: 2,
    options: [
      {
        label: 'Cut the ribbon',
        effects: { stability: 6, ego: 9, gold: 1 },
        result: 'You cut the ribbon and kept the scissors. They are gold now.',
      },
    ],
    ignore: { stability: 0, text: 'The mayor cut the ribbon. With normal scissors.' },
  },
];

const ROUTINE = new Set(['briefing', 'decision', 'press', 'call']);

/** Everyday duties. There are twice as many as one full term can draw. */
export const DUTIES: DutyCard[] = [...BASE_DUTIES, ...NEWS_CARDS.filter((c) => ROUTINE.has(c.kind))];
export const CRISES: DutyCard[] = [...BASE_CRISES, ...NEWS_CARDS.filter((c) => c.kind === 'crisis')];
export const HYBRIDS: DutyCard[] = [...BASE_HYBRIDS, ...NEWS_CARDS.filter((c) => c.kind === 'hybrid')];

export const VANITY: VanityAction[] = [
  // Monuments: a chain of four on the upper row of lots. Each needs the one before it.
  {
    id: 'build-arch',
    category: 'build',
    title: 'Triumphal Arch',
    text: 'Like the one in Paris, but bigger, and about you.',
    cost: 3,
    ego: 20,
    stability: -3,
    gold: 2,
    result: 'The Arch is complete. Traffic is rerouted through three states.',
  },
  {
    id: 'build-ballroom',
    category: 'build',
    title: 'The Grand Ballroom',
    text: 'It goes where a wing of the White House used to be.',
    cost: 3,
    ego: 21,
    stability: -3,
    gold: 3,
    result: 'The Ballroom opens. It seats 900 and echoes your name back at you.',
  },
  {
    id: 'build-statue',
    category: 'build',
    title: '90-Foot Gold Statue',
    text: 'You, pointing at the future. The future is to the left.',
    cost: 4,
    ego: 27,
    stability: -4,
    gold: 5,
    requires: 'build-arch',
    result: 'The Statue is unveiled. Planes now have to go around it.',
  },
  {
    id: 'build-mountain',
    category: 'build',
    title: 'Your Face On The Mountain',
    text: 'There are four up there already. They can scoot.',
    cost: 5,
    ego: 36,
    stability: -7,
    gold: 2,
    names: 1,
    requires: 'build-statue',
    result: 'Your face is on the mountain, 20% larger than the others, for perspective.',
  },
  {
    id: 'build-space-arch',
    category: 'build',
    title: 'Arch Visible From Space',
    text: 'The treasury says no. The treasury is not the president.',
    cost: 5,
    ego: 42,
    stability: -9,
    gold: 8,
    requires: 'build-mountain',
    result: 'Astronauts confirm they can see the Arch. They did not sound happy about it.',
  },

  // Buildings: a second chain, of three, on the lower row of lots.
  {
    id: 'build-giftshop',
    category: 'build',
    title: 'The Gift Shop',
    text: 'Every visit to the White House should end the way it does at any great attraction.',
    cost: 4,
    ego: 28,
    stability: -4,
    gold: 4,
    requires: 'build-ballroom',
    result: 'The Gift Shop is open. All tours now exit through it. So do all treaties.',
  },
  {
    id: 'build-dome',
    category: 'build',
    title: 'The Golden Dome',
    text: 'A dome over the whole property. Engineers ask what it is for. It is for being golden.',
    cost: 5,
    ego: 40,
    stability: -9,
    gold: 8,
    requires: 'build-giftshop',
    result: 'The Dome is finished. It is blinding at noon. Air traffic has been rerouted over Ohio.',
  },

  // Renames: quick, but each one thrills a little less than the last.
  {
    id: 'rename-airport',
    category: 'rename',
    title: 'Rename the airport',
    text: 'Trump International. The luggage tags are already printed.',
    cost: 1,
    ego: 10,
    stability: -1,
    names: 1,
    result: 'Welcome to Trump International. Flights are delayed, tremendously.',
  },
  {
    id: 'rename-arts',
    category: 'rename',
    title: 'Rename the arts center',
    text: 'The national performing arts center could use a more performing name.',
    cost: 1,
    ego: 10,
    stability: -1,
    names: 1,
    result: 'The arts center bears your name. The orchestra plays only walk-on music now.',
  },
  {
    id: 'rename-gulf',
    category: 'rename',
    title: 'Rename the gulf',
    text: 'It is a big gulf. It deserves a big name.',
    cost: 1,
    ego: 10,
    stability: -3,
    names: 1,
    result: 'The Gulf of Trump. Cartographers are resigning in waves.',
  },
  {
    id: 'rename-park',
    category: 'rename',
    title: 'Rename a national park',
    text: 'The geyser can stay faithful. It will just be faithful to you.',
    cost: 1,
    ego: 10,
    stability: -1,
    names: 1,
    result: 'Trumpstone National Park is open. The bison were not consulted.',
  },
  {
    id: 'rename-highways',
    category: 'rename',
    title: 'Rename the highway system',
    text: 'Every interstate, every sign.',
    cost: 1,
    ego: 10,
    stability: -2,
    names: 1,
    result: 'All highways are now Trump Highway. Navigation apps have given up.',
  },
  {
    id: 'rename-battleship',
    category: 'rename',
    title: 'Rename the fleet',
    text: 'A whole class of warship. Gold trim optional but encouraged.',
    cost: 1,
    ego: 10,
    stability: -2,
    names: 1,
    result: 'The Trump-class battleship is announced. It has a ballroom.',
  },
  {
    id: 'rename-month',
    category: 'rename',
    title: 'Rename a month',
    text: 'July had a good run.',
    cost: 1,
    ego: 10,
    stability: -2,
    names: 1,
    result: 'Happy 4th of Trumpuary. Calendar companies are suing.',
  },
  {
    id: 'rename-tuesday',
    category: 'rename',
    title: 'Rename Tuesday',
    text: 'Nobody likes Tuesday. You would be doing it a favor.',
    cost: 1,
    ego: 10,
    stability: -2,
    names: 1,
    result: 'See you next Trumpsday. Meetings everywhere are missed.',
  },
  {
    id: 'rename-dollar',
    category: 'rename',
    title: 'Rename the dollar',
    text: 'One Trump. Five Trumps. A hundred Trumps. It just sounds richer.',
    cost: 1,
    ego: 10,
    stability: -5,
    names: 1,
    result: 'The currency is now the Trump. It immediately lost 9% against the euro.',
  },
  {
    id: 'rename-moon',
    category: 'rename',
    title: 'Rename the Moon',
    text: 'It has never had a real name. "The Moon" is a description.',
    cost: 1,
    ego: 10,
    stability: -3,
    names: 1,
    result: 'Look up tonight at the beautiful Trump. Other nations still call it the Moon, sadly.',
  },

  // Gilding: the snack food. Cheap, harmless, small.
  {
    id: 'gild-desk',
    category: 'gild',
    title: 'Gild the desk',
    text: 'The Resolute Desk, but resolutely gold.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The desk is gold. Pens slide off it.',
  },
  {
    id: 'gild-phone',
    category: 'gild',
    title: 'Gild the phone',
    text: 'The red phone would look better not red.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The hotline is gold. It is also now very heavy.',
  },
  {
    id: 'gild-fireplace',
    category: 'gild',
    title: 'Gild the fireplace',
    text: 'The mantel has room for at least forty more ornaments.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The fireplace gleams. You cannot light it any more, but it gleams.',
  },
  {
    id: 'gild-carpet',
    category: 'gild',
    title: 'Gild the carpet',
    text: 'The presidential seal, but harder to vacuum.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The carpet is gold. Visitors now slide gently toward the door.',
  },
  {
    id: 'gild-soda-button',
    category: 'gild',
    title: 'Gild the soda button',
    text: 'The most important button on the desk should look it.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The soda button is gold. The other button is jealous.',
  },
  {
    id: 'gild-portraits',
    category: 'gild',
    title: 'Gild the portrait frames',
    text: 'Forty-odd presidents on the wall. Yours gets the thickest frame.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'Every frame is gold. Yours required a structural engineer.',
  },
  {
    id: 'gild-garden',
    category: 'gild',
    title: 'Pave and gild the garden',
    text: 'Roses are fine. Patio is better. Gold patio is best.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The garden is a gold patio. The bees have left the District.',
  },
  {
    id: 'build-helipad',
    category: 'gild',
    title: 'Turn the patio into a helipad',
    text: 'A gold patio is a waste of a gold patio. Paint an H on it.',
    cost: 1,
    ego: 6,
    stability: -1,
    requires: 'gild-garden',
    result: 'The Rose Garden is a helipad. The last rose left by helicopter.',
  },
  {
    id: 'gild-helicopter',
    category: 'gild',
    title: 'Gild the helicopter',
    text: 'Marine One is green. Green is not a metal.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    requires: 'build-helipad',
    result: 'The helicopter is gold. It hovers lower now, but with more confidence.',
  },
  {
    id: 'gild-toilet',
    category: 'gild',
    title: 'Gild the toilet',
    text: 'A throne should be a throne.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The toilet is gold. It is cold. You regret nothing.',
  },
  {
    id: 'gild-plane',
    category: 'gild',
    title: 'Gild the plane',
    text: 'Air Force One, but visible from further away.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The plane is gold. It now needs a longer runway.',
  },
  {
    id: 'gild-constitution',
    category: 'gild',
    title: 'Gild the Constitution display',
    text: 'Not the document. Just the case. And the room. And the building.',
    cost: 1,
    ego: 5,
    stability: 0,
    gold: 1,
    result: 'The Constitution is harder to read behind all that glare. Coincidence.',
  },

  // Trips. Free both ways: no time, no ego, no stability. Visitors keep
  // waiting in Washington while you are away.
  {
    id: 'trip-maralago',
    category: 'trip',
    title: 'Fly to Mar-a-Lago',
    text: 'The job cannot follow you to Florida. Whoever is waiting will keep waiting.',
    cost: 0,
    ego: 0,
    stability: 0,
    repeatable: true,
    travelTo: 'maralago',
    result: 'Wheels down in Palm Beach. Washington is now somebody else\'s problem.',
  },
  {
    id: 'trip-maralago-heli',
    category: 'trip',
    title: 'Take the helicopter to Mar-a-Lago',
    text: 'Door to door, no motorcade. The neighbours will hear you coming.',
    cost: 0,
    ego: 0,
    stability: 0,
    repeatable: true,
    requires: 'build-helipad',
    travelTo: 'maralago',
    vehicle: 'heli',
    result: 'The helicopter sets down by the pool. Several umbrellas are now in the pool.',
  },
  {
    id: 'trip-home-heli',
    category: 'trip',
    title: 'Take the helicopter back to Washington',
    text: 'They are all still standing where you left them. They will hear you land.',
    cost: 0,
    ego: 0,
    stability: 0,
    repeatable: true,
    place: 'maralago',
    travelTo: 'dc',
    vehicle: 'heli',
    result: 'Back on the helipad. The rotor wash has rearranged the press corps.',
  },
  {
    id: 'trip-home',
    category: 'trip',
    title: 'Fly back to Washington',
    text: 'They are all still standing where you left them.',
    cost: 0,
    ego: 0,
    stability: 0,
    repeatable: true,
    place: 'maralago',
    travelTo: 'dc',
    result: 'Back at the White House. The carpet looks smaller than you remember.',
  },

  // Mar-a-Lago: richer ego than Washington, repeatable, and nobody can reach you.
  {
    id: 'resort-golf',
    category: 'resort',
    title: 'Play eighteen holes',
    text: 'Your course, your rules, your club championship. Again.',
    cost: 1,
    ego: 8,
    stability: -1,
    repeatable: true,
    place: 'maralago',
    result: 'You won the club championship. You were also the only entrant, and the judge.',
  },
  {
    id: 'resort-dinner',
    category: 'resort',
    title: 'Dinner on the patio',
    text: 'The members stand and applaud when you walk in. It is in the bylaws.',
    cost: 1,
    ego: 8,
    stability: -1,
    repeatable: true,
    place: 'maralago',
    result: 'A standing ovation between every course. The steak was well done, like the evening.',
  },
  {
    id: 'resort-dj',
    category: 'resort',
    title: 'Run the patio playlist',
    text: 'You have the tablet. Nobody else is allowed to touch the tablet.',
    cost: 1,
    ego: 7,
    stability: -1,
    repeatable: true,
    place: 'maralago',
    result: 'The same nine songs, twice, at a volume guests describe as "committed."',
  },
  {
    id: 'resort-memberships',
    category: 'resort',
    title: 'Sell memberships',
    text: 'The initiation fee has gone up again. Proximity to you is the amenity.',
    cost: 1,
    ego: 4,
    stability: -2,
    gold: 2,
    repeatable: true,
    place: 'maralago',
    result: 'Four new members. Two are ambassadors now. It is unclear which happened first.',
  },
  {
    id: 'gild-mal-ballroom',
    category: 'gild',
    title: 'Re-gild the ballroom',
    text: 'It is already gold. It could be more gold.',
    cost: 1,
    ego: 6,
    stability: 0,
    gold: 2,
    place: 'maralago',
    result: 'The ballroom is now gold on gold. Guests are issued sunglasses at the door.',
  },

  // Shows: repeatable, but the crowd gets tired.
  {
    id: 'show-golf',
    category: 'show',
    title: 'Play golf',
    text: 'You always win. The scorekeeper has a mortgage.',
    cost: 1,
    ego: 5,
    stability: -1,
    repeatable: true,
    result: 'You shot a 61. Witnesses were told what they saw.',
  },
  {
    id: 'show-post',
    category: 'show',
    title: 'Post at 3am',
    text: 'ALL CAPS. No drafts. No survivors.',
    cost: 1,
    ego: 6,
    stability: -3,
    repeatable: true,
    result: 'You posted. Four embassies have requested "clarification."',
  },
  {
    id: 'show-rally',
    category: 'show',
    title: 'Hold a rally',
    text: 'Twenty thousand people chanting your name, or whatever number you say it was.',
    cost: 2,
    ego: 13,
    stability: -2,
    repeatable: true,
    result: 'A tremendous rally. You did the dance. They loved the dance.',
  },
  {
    id: 'show-parade',
    category: 'show',
    title: 'Military parade',
    text: 'Tanks down the avenue, on your birthday, which is a coincidence.',
    cost: 3,
    ego: 19,
    stability: -4,
    repeatable: true,
    result: 'The parade rolled by. The tanks ruined the road. Other countries took notes.',
  },
];

const ALL_CARDS = new Map([...DUTIES, ...CRISES, ...HYBRIDS, ...SEQUELS, ...SET_PIECE_CARDS].map((c) => [c.id, c]));
const ALL_VANITY = new Map(VANITY.map((v) => [v.id, v]));

export function cardById(id: string): DutyCard {
  const card = ALL_CARDS.get(id);
  if (!card) throw new Error(`Unknown duty card: ${id}`);
  return card;
}

export function vanityById(id: string): VanityAction {
  const action = ALL_VANITY.get(id);
  if (!action) throw new Error(`Unknown vanity action: ${id}`);
  return action;
}

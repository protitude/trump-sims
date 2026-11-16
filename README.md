# Executive Time

A satirical life sim for the web. You play President Trump, and you walk him around the White House and the South Lawn, one month at a time. What he wants from the presidency is simple: build the arch, put his name on things, and cover everything else in gold. The trouble is that the presidency keeps turning out to be a job. People line up in the Cabinet Room with folders. The phone rings. The press has questions.

You have four years and not nearly enough hours.

## The idea

The game runs on two meters, and either one can end it.

| Meter | Goes down when | Goes up when | At zero |
|---|---|---|---|
| **Ego** | Every month, automatically. Faster the more monuments you own. | You do vanity projects. | **Full Depression.** You go to bed and do not get up. |
| **World Stability** | Every month, and whenever you ignore or botch the job. | You do the job properly. | **World War III.** |

Both draw on the same budget: **5 time blocks a month**. Every block spent in a budget meeting is a block not spent gilding the carpet, and the other way around.

- Lean entirely into vanity and the world falls apart within a few months.
- Do nothing but the job and the world thrives, while you sink into a depression that ends the game just as surely.
- Survive all **48 months** with both meters above zero and you win.

The joke, and the strategy, is that the responsible choice is always available and always slightly unbearable.

## How to play

**Click to walk.** Click a person or an object and the President walks over and a menu opens showing what he can do there, what it costs in time blocks, and what it does to the meters. Pick something and you watch him do it.

Each month plays out like one day:

1. **Visitors arrive.** Three or so people walk in through the east door and wait for you, each with an icon over their head. The strip at the top of the screen lists who is waiting; clicking a name walks you to them.
2. **Spend your five blocks** on any mix of visitors and vanity. The light fades as the blocks run out.
3. **Go to bed.** When your last time block is spent, he walks to bed by himself and the month ends. To end a month early, click the bed in the Residence (or the "Go to bed" button). Anyone still waiting storms out, with consequences. Ego drains. A new month begins.

### Where things are

| Place | What you do there |
|---|---|
| **Residence** | The bed ends the month. The toilet can be gilded. |
| **Oval Office** | Gild the desk, the soda button, the phone, the fireplace, the portraits and the carpet. Pick up the phone to call someone and tell them off; who is on the line changes after every call and every month. Rename things at the Big Map. Callers, generals and diplomats wait here. |
| **Cabinet Room** | Aides wait here with briefings and decisions. The Constitution's display case can be gilded. |
| **Press Room** | Reporters wait here. |
| **South Lawn** | Seven construction lots in two rows (four monuments above, three buildings below), the Rose Garden, the putting green, the rally stage, the parade stand and the plane. |
| **Mar-a-Lago** | A separate place, reached by clicking the plane (or the helicopter, once the Rose Garden is a helipad). Golf, dinner on the patio, the playlist, the membership desk, a ballroom to re-gild, and a bed. |

Activities are animated. Golf has a swing and a ball that always goes in, rallies draw a bouncing crowd and confetti, parades send tanks down the avenue, monuments rise out of their lots behind scaffolding, renames get stamped, posts are bleated at Natalie in capital letters and typed up on the spot, and the club members applaud dinner. Visitors get their own touches too: camera flashes for the press, "blah blah" for briefings, a red alert for a crisis.

Vanity is visible. Gilded things turn gold and sparkle, monuments rise on their plots, and every rename adds a gold pin to the Big Map.

### The people who want something

| Icon | Visitor | What it is |
|---|---|---|
| 📋 | **Briefing** | Long, dull, good for the world. Costs 2 blocks and some Ego. |
| ❓ 🎤 📞 | **Decision, press, phone call** | Two choices. One is sensible and deflating. The other feels fantastic and damages the planet. |
| 🚨 | **Crisis** | Shows up after you have ignored four visitors. Costs 3 blocks. Ignoring it is catastrophic. |
| ⭐ | **Opportunity** | Rare. The only visitors that raise *both* meters, such as a peace summit held at your own golf resort. Always take these. |

### The vanity projects

| Category | How it works |
|---|---|
| **Build** | Seven big projects in two chains. Monuments: Triumphal Arch, 90-Foot Gold Statue, Your Face On The Mountain, Arch Visible From Space. Buildings: Grand Ballroom, Gift Shop, Golden Dome. Huge Ego, but each eats most of a month and hurts Stability. Each lot unlocks when the one before it in its chain is built. Four of them come with a perk (see below). |
| **Rename** | The airport, the gulf, the dollar, Tuesday, the Moon. One block each, but every rename gives a little less Ego than the one before. |
| **Gild** | Gold-plate things around the house. Small, cheap and harmless. |
| **Show** | Rallies, golf, parades, posting at 3am, telling people off on the phone. Repeatable, with fading returns. |

### What the monuments do

Four of the big projects keep working after the ribbon is cut. The perk is printed on the button before and after you build.

| Project | Perk |
|---|---|
| **The Grand Ballroom** | Unlocks state dinners on its lot: two blocks, +3 Ego (fading) and +3 Stability. The only repeatable action that is good for the world. |
| **90-Foot Gold Statue** | While Sulking, Ego drains 2 slower. |
| **The Gift Shop** | Pays 1 coin at the end of every month. |
| **The Golden Dome** | The next crisis takes 1 time block fewer. Once. |

### Trips to Mar-a-Lago

Click the plane on the South Lawn to fly to Mar-a-Lago. Flights are free in both directions: they cost no time and change no meters. Once the Rose Garden is gilded it can be turned into a helipad; the helicopter parked there can be gilded too, and flies to Mar-a-Lago in place of the plane. Whatever you flew out in is the way back.

- **Why go.** Everything there feeds Ego better than its Washington equivalent, and it can all be repeated (with slowly fading returns).
- **What it costs.** The job cannot follow you. Visitors keep waiting in Washington, and you cannot deal with any of them until you fly back. If you go to bed in Florida, everyone waiting that month is ignored.
- **Staying over.** There is a bed at the club, so you can stay for several months. Stability will not thank you.

### Melania, in New York

Once the Rose Garden is a helipad, the helicopter can also fly to New York. It lands on the roof of the tower, where Melania is standing. The plane cannot go there, and the helicopter is the only way back. The flight is free; there is a spare bed on the roof if the month runs out.

- **Beg her to come to an event.** Five coin, −2 Ego, no time. She then stands beside you at your next rally, parade or building project, which gives that one event +2 Stability: a rally goes from −2 Stability to 0. She can be booked once in each year of the term.
- **Free abuse.** Once she has been booked for the year, the offer is replaced by an insult, picked at random from the 50 in `src/game/melania.ts`. It costs nothing and changes nothing.

### Guests at the club

Two guests are waiting at Mar-a-Lago every month: tech bosses and media people, each with an ask and a stake in your crypto coin. They are listed in the bar at the top wherever you are, but you have to fly down to talk to them. Anyone you do not get to has gone home by next month, at no cost.

- **Take the coin.** One time block. You grant the ask, and get Ego, Stability and coin, all shown on the button. Coin is spent on Natalie's errands; whatever is left counts toward the final score.
- **Send them away.** No time, −2 Ego.
- **The catch.** Each bribe has a chance of leaking, rolled in secret when you take it. The chance is 10% in the first year and steps up five points every year after, as lips get looser: 15% in Year 2, 20% in Year 3 and 25% in Year 4. A leak becomes news one to six months later (in the final month at the latest) and takes back three times the Ego and Stability the bribe gave: a deal worth +8 Ego and +10 Stability comes back as −24 and −30. You keep the coin.

### Natalie's errands

Click Natalie, wherever she is, to ask for something.

- **Post at 3am.** One time block. You bleat it, she types it and posts it. Works in Washington and at Mar-a-Lago.
- **Send her for a McBurger.** One coin, no time. She vanishes, comes back with the bag, and it is gone in seconds. Fast food is not without its risks.
- **Send her to Taco Gong.** One coin, no time. Same errand, same risks, but with tacos. If it goes wrong, it was the lettuce.
- **The physical.** Every fifth take-out order, burgers and tacos counted together, the doctor insists on a physical. He passes it biggly, and brags about it at his next rally: +2 Ego on that rally.
- **Press the Diet Coke button.** Two coin, no time. She arrives with a can on a silver tray and you get one time block back, up to the usual five. It does nothing in a month where you have not spent any time yet, and the doctor allows one can a month.
- **Have her pull in the Lawyer.** Three coin, no time, once a month. He sues something, picked at random from `src/game/suits.ts`: +1 Ego, −2 Stability.

The guests are parodies under made-up names. There are 26, in `src/game/cards/guests.json`; they come around again once all have visited.

### Consequences

Some choices come back. Tariff the penguins and, four months later, the penguins retaliate; escalate that and a nature documentary arrives. Appoint your caddie to run public health and you will hear about his first outbreak briefing. These visitors are labeled **Consequence** and open with a line reminding you what you did.

- Most consequences follow the fun option, and are a harder version of the same mess.
- A few follow the responsible option, and are rewards: the deputy you appointed delivers, the ally you reassured names a square after you.
- Ignoring certain visitors has consequences too. The unread intelligence briefing is one.

- Vanity comes back as well. Gild the Constitution display and the archivist turns up to say nobody can read it; rename the dollar and the vending machines stop taking it; build the arch that can be seen from space and the space station calls about the glare. Eighteen of the builds, renames and gildings have a follow-up.

There are 57 consequence cards. How many you see depends on how you play: more gold and more names mean more visitors with complaints.

### The calendar

The four years are not all alike. A strip under the top bar shows what is in force this month and what is coming up next.

| When | What | Effect |
|---|---|---|
| April, Year 1 | The First Hundred Days | Set piece |
| Every June | Your Birthday | A parade is worth double Ego |
| Every August | August Recess | Only two visitors |
| Each January from Year 2 | State of the Union | Set piece, costs 2 blocks |
| April, Year 2 | The Annual Physical | Set piece |
| Sept to Dec, Year 2 | Midterm Campaign | Rallies give 50% more Ego and do not fade; Stability falls 1 faster |
| December, Year 2 | Election Night | Set piece. At month end, Stability of 50 or more keeps Congress (+10 Ego). Below that you lose it (−6 Ego). |
| Year 3, if you lost | Hostile Congress | Stability falls 1 faster all year, and the hearings begin (see below) |
| June, Year 3 | Your Turn To Host | Set piece |
| April, Year 4 | The Official Portrait | Set piece |
| July to Dec, Year 4 | Legacy Season | Big projects and renames give 30% more Ego; Ego drains 2 faster |
| December, Year 4 | The Farewell Address | Set piece |

Set pieces are extra visitors, labeled **Set piece**, on top of the usual three.

### Hearings and the impeachment vote

Lose the midterms and the new House sends three extra visitors in Year 3, labeled **Hearing**: a subpoena in March, televised testimony in July and the impeachment vote in October. The House votes as October ends, on the **heat** against you:

- +2 for every bribe that has been exposed
- +1 for every three lawsuits the Lawyer has filed
- +2 for defying or ignoring the subpoena, and +2 for the same at the hearing
- −2 for working the phones before the vote, +1 for holding a rally or ignoring it

At 4 heat or more you are impeached: −10 Ego, −6 Stability. Below that the articles fail and you get +6 Ego. Impeachment does not end the game. The heat is shown in the calendar strip while a hostile Congress is sitting.

### Whims

Every six months he takes up a whim. You are offered three and must pick one: rename three things, hold three rallies, deal with twelve visitors, end three months with a clean desk, and so on. Satisfy it before the six months run out and you collect its reward. Let it lapse and he sulks (−4 Ego). The current whim and its progress are shown in the calendar strip.

### Chaos

At the start of any month there is a chance that something simply happens: an aide is in tears, a hurricane is heading for Florida, a relative has accepted a gift. The chance starts at 10% and climbs one point every month, so it is 22% at the end of the first year, 34% at the end of the second and 58% by the end of the term. There are never more than six of these a year, and a full term sees about fifteen.

A chaos event stops everything until you answer it. There are always three answers:

- **The favorable one**, which costs one or two time blocks.
- **The deflection**, which costs nothing.
- **Ignoring it.**

Nothing on the menu tells you what any of them will do. The result is rolled when you choose and shown afterward, with its numbers. The favorable answer usually goes well (60% good, 25% mixed, 15% bad) and the deflection usually does not (30% good, 30% mixed, 40% bad), but either can go either way, and a bad result can hit both meters hard.

Ignoring an event does nothing at the time. It comes back once or twice in later months of the same year, and that blowback is nearly always bad and sometimes severe. An event ignored in December comes back in January.

Unlike the rest of the game, chaos events name real public figures. There are 17, in `src/game/cards/chaos.json`, and none repeats until all 17 have been seen.

### Things that complicate it

- **Ego inflation.** Every monument and rename permanently raises how fast your Ego drains. The arch that thrilled you in Year 1 is just the baseline by Year 3.
- **Moods.** Below 25 Ego you are **Sulking** (a rain cloud over your head), and every duty takes an extra block. Above 85 you are **Unleashed** (a flame), and you cost the world 5 Stability a month by saying things out loud.
- **Neglect snowballs.** Every fourth ignored visitor sends a crisis the following month.

### The scenarios

There are 295 everyday scenarios, 20 crises and 20 opportunities. A full term draws at most 144 everyday scenarios (three a month for 48 months), so the deck is twice the size a game can use and nothing repeats within a game. Crises and opportunities are also dealt without repeats.

Most scenarios are loosely based on real news from 2025 and 2026, exaggerated into something clearly comic. Each card carries an `inspiredBy` note naming the event behind it. That note is for whoever edits the cards and is never shown in the game. Other than the President, real people are referred to by role, not name.

### Scoring

Your legacy score rewards gold, things named after you, and whatever is left in both meters, with a large bonus for finishing the term.

The ending screen is written from what you did. Its opening paragraph changes with how the term ended (announce in the Farewell Address that you might not leave, and it says so), history gives you a title such as The Gilder, Florida Man, The Asterisk or The Accidental Statesman, and up to six lines record the projects, the midterms, the bribes, the take-out and the rest. The titles and lines are in `src/game/epilogue.ts`.

### Music

Six instrumental tracks play in rotation once the game starts: all lofi. The controls in the bottom-right corner turn the music off, skip to the next track and set the volume. The on/off choice and the volume are remembered. All six tracks are public domain (CC0) from OpenGameArt.org; see `public/music/CREDITS.md`.

## Running it

Requires Node 22.18 or newer (the balance simulator runs TypeScript directly).

```sh
npm install
npm run dev       # play locally, with hot reload
npm run build     # type-check and build a static site into dist/
npm run preview   # serve the built site
npm run sim       # run the balance simulator
```

The build is plain static files with no backend, so `dist/` can be dropped onto GitHub Pages, Netlify, itch.io or any other static host. Progress is saved in the browser's local storage.

## How it is built

TypeScript, React and Vite. The world is drawn on an HTML canvas using shapes only; there are no image files and no game engine. React handles the bars at the top and the pop-up menus.

```
src/
  game/
    types.ts      Data shapes: game state, duty cards, vanity actions
    content.ts    The original cards and every vanity project, as plain data
    story.ts      Consequence cards, what triggers them, the set pieces and the hearings
    epilogue.ts   The ending screen: the title history gives him and what it remembers
    calendar.ts   Seasons, the midterms, and the whims
    chaos.ts      The shape of a chaos event (the events are in cards/chaos.json)
    guests.ts     The shape of a Mar-a-Lago guest (the guests are in cards/guests.json)
    cards/        The news-based scenarios, one JSON file per beat (trade, allies,
                  peace deals, the White House, media, agencies, courts, science,
                  ceremonies) plus special.json for crises and opportunities
    engine.ts     The rules, as pure functions, plus the tuning numbers
  world/
    map.ts        The floor plan: rooms, walls, objects, waiting spots, pathfinding
    draw.ts       Everything you see: scenery, furniture, monuments, people
    World.tsx     Walking, clicking, visitors, activities and the pop-up menus
  App.tsx         Title and ending screens, and the bars at the top
  music.tsx       The background music playlist and its controls
  ui.tsx          Small shared pieces
public/
  music/          The six tracks and their credits
scripts/
  sim.ts              Bots that play thousands of games to check the balance
  validate-cards.mjs  Checks a card file against the rules below
```

Three things are worth knowing before changing anything:

- **Rules and world are separate.** `engine.ts` knows nothing about walking or drawing. The world is a way of showing the rules and choosing actions; it never changes a meter itself. This is what lets the simulator play the real game without a screen.
- **Content is data.** To add a scenario, add a card to one of the files in `src/game/cards/`; a visitor will turn up with it. Then run `node scripts/validate-cards.mjs src/game/cards/<file>.json`, which checks the card's shape, its text lengths and that its numbers are in the range the balance expects. To add a vanity action, add it to `content.ts` and then list its id on an object in `map.ts` so there is somewhere to do it.
- **The map is a grid.** The world is a grid of 20-pixel tiles holding three places: Washington at the top, with Mar-a-Lago and the roof in New York further down, separated by impassable tiles. Objects in `map.ts` are placed in tile coordinates, and anything marked `blocking` is walked around automatically. The camera shows whichever place the President is in.

### Tuning the balance

All the numbers that govern difficulty are in the `TUNING` object at the top of `engine.ts`. After changing one, run `npm run sim`. It plays 1,000 games with each of five bots:

| Bot | What it does | Result at current tuning |
|---|---|---|
| vanity-only | Never does the job | World War III by month 3, every time |
| duty-only | Never does anything fun | Depression by month 5, every time |
| random | Clicks anything | World War III within about 4 months |
| balanced | Feeds whichever meter is lower | Wins about 23% of games, usually lasting into Year 4 (it was 40% before the monument perks, vanity consequences and hearings were added, and 34% before chaos events and leaks were retuned) |
| grifter | Balanced, but flies to Mar-a-Lago every third month, takes both bribes and flies home | Wins about 21% of games; about 18 bribes and 2.6 leaks a game |

The balanced bot is a fairly naive player, and it picks a whim at random and then ignores it. A person who chases whims collects several rewards a game that the bot mostly misses, so 23% for the bot should mean a hard but fair game for a person. That is an estimate from the simulator, not something tested widely with real players. The bots answer chaos events in a fixed way: the balanced bot always takes the favorable answer and wins about 23%. Made to always deflect (`CHAOS=deflect npm run sim`), it wins about 26%; made to always ignore (`CHAOS=ignore`), it almost never wins (under 1% even if blowback only ever came once). Only the grifter flies to Mar-a-Lago, and only for the bribes, so the simulator says nothing about whether the rest of the club is too strong or too weak.

The bribes are a gamble, not free money. With leaks switched off (`LEAK=0 npm run sim`) the grifter wins about 84% of games. At a flat 10% all term (`LEAK=0.1 npm run sim`) it wins about 45%. At the real odds, which start at 10% and step up five points a year to 25% in Year 4 (`leakChance` and `leakPerYear`), it wins about 21%, because two or three leaks a game at three times the damage usually means World War III. Setting `LEAK` gives a flat chance and turns the yearly step off. `TRIP_EVERY=4 npm run sim` changes how often it flies.

The balance is very sensitive to the number of big projects and to `egoInflation`, so re-run the simulator after touching either. For reference: six projects at 0.25 gave the bot 29% wins; twelve projects at 0.25 gave 97%; seven projects at 0.26 gave 37%. Adding the calendar and whims made the game easier again (78% at 0.26), so the value is now 0.36.

## Ideas not built yet

- **More consequences.** About 40 of the 295 scenarios and 18 of the vanity projects have a follow-up. Phone calls, lawsuits, guests and chaos events still have none.
- **A staff you hire and fire, recurring rivals, and risky actions with uncertain results.** The remaining ideas from the engagement list.
- **A running clock and an action queue**, so you can line up several things and watch them play out, with speed controls.
- **Aides** who live in the building. You can delegate duties to them. The competent ones get credit, which drains your Ego until you fire them. The loyal ones are useless.
- **Approval** as a third meter, and impeachment that can actually remove you. The vote in Year 3 only costs Ego and Stability.
- **Multi-month construction**, with scaffolding going up over several turns.
- **Real art and sound.** Sprites in place of shapes, probably moving the drawing to Phaser at that point.
- **A comedy and fact pass on the scenarios.** The news-based cards were drafted in bulk. Some punchlines are soft, and many `inspiredBy` notes were written from memory and have not been checked against sources.

## A note on tone

This is parody of a public figure, in the tradition of political cartoons. It is not affiliated with or endorsed by anyone. It is a life sim in the general genre, with its own look and name, and is not connected to any existing game series.

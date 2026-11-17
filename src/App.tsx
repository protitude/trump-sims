import { useEffect, useState } from 'react';
import {
  BLOCKS_PER_MONTH,
  TOTAL_MONTHS,
  chooseWhim,
  declineGuest,
  dateLabel,
  dismissReveal,
  doVanity,
  egoDecay,
  heat,
  TUNING,
  endBroadcast,
  endMonth,
  mood,
  newGame,
  orderLunch,
  pressCokeButton,
  sueSomething,
  askMelania,
  hearMelania,
  playDuty,
  resolveChaos,
  stabilityDrift,
  takeBribe,
} from './game/engine.ts';
import { WHIM_FAIL_EGO, WHIM_MONTHS, activeSeasons, comingUp, whimById, whimProgress } from './game/calendar.ts';
import { Blocks, Fx, Why } from './ui.tsx';
import { chaosById } from './game/chaos.ts';
import { guestById } from './game/guests.ts';
import type { GameState } from './game/types.ts';
import { cardById } from './game/content.ts';
import { ENDINGS, finalStats } from './game/brag.ts';
import { highlights, polls } from './game/events.ts';
import { endingText, epilogue, legacyTitle } from './game/epilogue.ts';
import { VOTE_MONTH } from './game/story.ts';
import { MusicControl, useMusic } from './music.tsx';
import { Brag } from './share.tsx';
import type { Music } from './music.tsx';
import { World } from './world/World.tsx';
import type { Target } from './world/World.tsx';

const SAVE_KEY = 'executive-time-save-v6';

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

function writeSave(state: GameState | null): void {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable (private window etc). The game still works, unsaved.
  }
}

const GUEST_ICON = { ceo: '🪙', media: '🎙️' };
const VISITOR_ICON = { briefing: '📋', decision: '❓', press: '🎤', call: '📞', crisis: '🚨', hybrid: '⭐' };

const MOODS = {
  sulking: { label: 'Sulking', note: 'Every duty takes 1 extra block.' },
  normal: { label: 'Stable Genius', note: 'No mood effects.' },
  unleashed: { label: 'Unleashed', note: 'Loses 5 Stability at month end.' },
};

function Meter({ label, value, kind, hint }: { label: string; value: number; kind: 'ego' | 'stability'; hint: string }) {
  const danger = value <= 25;
  return (
    <div className={`meter ${kind}${danger ? ' danger' : ''}`}>
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">{value}</span>
      </div>
      <div className="meter-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="meter-fill" style={{ width: `${value}%` }} />
      </div>
      <div className="meter-hint">{hint}</div>
    </div>
  );
}

function Title({ onStart, onContinue }: { onStart: () => void; onContinue?: () => void }) {
  return (
    <main className="screen">
      <div className="plaque">
        <p className="eyebrow">A satirical life sim</p>
        <h1>Executive Time</h1>
        <p>
          You are the President. You would like to spend four years building arches, renaming things after yourself and
          gold-plating the furniture. Unfortunately there is also a job.
        </p>
        <ul className="rules">
          <li>
            <b>Ego</b> drains every month. Only vanity projects refill it. At zero you go to bed and never get up.
          </li>
          <li>
            <b>World Stability</b> falls when you ignore the job. At zero, World War III.
          </li>
          <li>
            You get <b>{BLOCKS_PER_MONTH} time blocks a month</b> to split between the two. Survive all {TOTAL_MONTHS}{' '}
            months.
          </li>
          <li>
            <b>Click to walk.</b> Click the people waiting for you to do the job, click objects to use them, and click
            the bed to end the month.
          </li>
        </ul>
        <div className="row">
          {onContinue && (
            <button className="btn primary" onClick={onContinue}>
              Continue term
            </button>
          )}
          <button className={onContinue ? 'btn' : 'btn primary'} onClick={onStart}>
            {onContinue ? 'New term' : 'Take the oath'}
          </button>
        </div>
        <p className="fine">
          Parody. Not affiliated with anyone, least of all the government. Music: public-domain tracks by omfgdude, Snabisch
          and Tarush Singhal, from OpenGameArt.org. Executive Disco vibed by David.
        </p>
      </div>
    </main>
  );
}

function GameOver({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const legacy = legacyTitle(state);
  const reel = highlights(state);
  return (
    <main className="screen">
      <div className={`plaque ending-${state.status}`}>
        <p className="eyebrow">{state.status === 'won' ? 'You won' : `Game over · ${dateLabel(state.month)}`}</p>
        <h1>{ENDINGS[state.status]}</h1>
        <p>{endingText(state)}</p>
        <p className="legacy">
          History will call you <b>{legacy.title}</b>. {legacy.why}
        </p>
        <ul className="rules">
          {epilogue(state).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {reel.length > 0 && (
          <>
            <p className="eyebrow">The term, as you tell it</p>
            <ul className="rules reel">
              {reel.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
        <dl className="stats">
          {finalStats(state).map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
        <Brag state={state} />
        <button className="btn primary" onClick={onRestart}>
          Run again
        </button>
      </div>
    </main>
  );
}

export function App() {
  const music = useMusic();
  return (
    <>
      <Game music={music} />
      <MusicControl music={music} />
    </>
  );
}

function Game({ music }: { music: Music }) {
  const [state, setState] = useState<GameState | null>(null);
  const [saved] = useState(loadSave);
  const [command, setCommand] = useState<{ n: number; target: Target } | null>(null);
  const go = (target: Target) => setCommand((c) => ({ n: (c?.n ?? 0) + 1, target }));

  useEffect(() => {
    if (state) writeSave(state.status === 'playing' ? state : null);
  }, [state]);

  if (!state) {
    const resumable = saved && saved.status === 'playing' ? saved : null;
    // Music can only begin on a click, so it starts with the game.
    const begin = (game: GameState) => {
      music.start();
      setState(game);
    };
    return <Title onStart={() => begin(newGame())} onContinue={resumable ? () => begin(resumable) : undefined} />;
  }
  if (state.status !== 'playing') return <GameOver state={state} onRestart={() => setState(newGame())} />;

  const currentMood = mood(state);
  const moodInfo = MOODS[currentMood];
  const seasons = activeSeasons(state);
  const next = comingUp(state);
  const progress = whimProgress(state);
  // One pop-up at a time: the whim, then anything chaos has done, then new chaos.
  // Nothing pops up while the election result is still playing on the television.
  const live = Boolean(state.broadcast);
  const whims = live ? [] : state.whimOffer;
  const reveal = !live && state.whimOffer.length === 0 ? state.reveals[0] : undefined;
  const chaos = !live && state.whimOffer.length === 0 && !reveal && state.chaos ? chaosById(state.chaos) : null;
  const campaign = seasons.some((season) => season.id === 'campaign') ? polls(state) : null;

  return (
    <main className="game">
      <header className="hud">
        <div className="hud-top">
          <div>
            <div className="date">{dateLabel(state.month)}</div>
            <div className="sub">
              Month {state.month} of {TOTAL_MONTHS}
            </div>
          </div>
          <div className={`mood mood-${currentMood}`} title={moodInfo.note}>
            <span className="mood-label">{moodInfo.label}</span>
            <span className="mood-note">{moodInfo.note}</span>
          </div>
          <div className="tally">
            <span>
              <b>{state.names}</b> named
            </span>
            <span>
              <b>{state.gold}</b> gold
            </span>
            <span>
              <b>{state.coin}</b> coin
            </span>
          </div>
        </div>
        <div className="meters">
          <Meter label="Ego" value={state.ego} kind="ego" hint={`−${egoDecay(state)} every month`} />
          <Meter
            label="World Stability"
            value={state.stability}
            kind="stability"
            hint={`−${stabilityDrift(state)} every month, more if the job is ignored`}
          />
        </div>
        <div className="turn">
          <div className="pips" aria-label={`${state.blocks} of ${BLOCKS_PER_MONTH} time blocks left`}>
            {Array.from({ length: BLOCKS_PER_MONTH }, (_, i) => (
              <span key={i} className={i < state.blocks ? 'pip on' : 'pip'} />
            ))}
            <span className="pips-label">
              {state.blocks} time {state.blocks === 1 ? 'block' : 'blocks'} left
            </span>
          </div>
          <button className="btn" onClick={() => go({ type: 'object', id: 'bed' })}>
            Go to bed
          </button>
        </div>
        <div className="waiting">
          <span className="waiting-label">
            {state.inbox.length === 0
              ? 'Nobody is waiting for you.'
              : state.place === 'dc'
                ? 'Waiting for you:'
                : `Waiting in Washington while you are ${state.place === 'newyork' ? 'in New York' : 'at Mar-a-Lago'}:`}
          </span>
          {state.inbox.map((id) => {
            const card = cardById(id);
            return (
              <button key={id} className={`visitor kind-${card.kind}`} disabled={state.place !== 'dc'} onClick={() => go({ type: 'npc', cardId: id })}>
                <span aria-hidden="true">{VISITOR_ICON[card.kind]}</span>
                {card.title.replace(/^(CRISIS|OPPORTUNITY): /, '')}
                {state.place !== 'dc' && <Why>They are waiting in Washington. Fly back to see them.</Why>}
              </button>
            );
          })}
        </div>
        {state.guests.length > 0 && (
          <div className="waiting">
            <span className="waiting-label">{state.place === 'maralago' ? 'Guests at the club:' : 'At Mar-a-Lago this month:'}</span>
            {state.guests.map((id) => {
              const guest = guestById(id);
              return (
                <button key={id} className="visitor kind-hybrid" disabled={state.place !== 'maralago'} onClick={() => go({ type: 'guest', cardId: id })}>
                  <span aria-hidden="true">{GUEST_ICON[guest.kind]}</span>
                  {guest.title}
                  {state.place !== 'maralago' && <Why>This guest is at Mar-a-Lago. Fly there to hear the offer.</Why>}
                </button>
              );
            })}
          </div>
        )}
        {state.physical && (
          <div className="waiting">
            <span className="waiting-label">
              Fresh from the physical: you will brag about it at your next rally (+{TUNING.physicalRallyEgo} Ego).
            </span>
          </div>
        )}
        {state.melania && (
          <div className="waiting">
            <span className="waiting-label">Melania is booked: she will be at your side for your next rally, parade or building project.</span>
          </div>
        )}
      </header>

      <div className="calendar">
        {seasons.map((season) => (
          <span key={season.id} className="season" title={season.note}>
            <b>{season.name}</b> {season.note}
          </span>
        ))}
        {campaign && (
          <span className="season" title="Stability on election night decides who runs Congress. The yard signs on the lawn follow it.">
            <b>The polls</b> Your number: {campaign.claimed}%. The pollsters' number: {campaign.real}%. It takes {campaign.bar} to hold Congress.
          </span>
        )}
        {state.congress === 'hostile' && state.month <= VOTE_MONTH && (
          <span className="season" title="Exposed bribes, lawsuits and defying the hearings all add to it.">
            <b>Impeachment heat</b> {heat(state)} of {TUNING.impeachAt}. The House votes in {dateLabel(VOTE_MONTH)}.
          </span>
        )}
        {next && (
          <span className="upcoming">
            Coming up: <b>{next.name}</b> in {next.inMonths === 1 ? '1 month' : `${next.inMonths} months`}
          </span>
        )}
        {progress && (
          <span className="whim" title={progress.whim.text}>
            Whim: <b>{progress.whim.title}</b> {progress.done}/{progress.whim.target} ·{' '}
            {progress.monthsLeft === 1 ? 'last month' : `${progress.monthsLeft} months left`} <Fx effects={progress.whim.reward} />
          </span>
        )}
      </div>

      {whims.length > 0 && (
        <div className="overlay">
          <div className="plaque whims" role="dialog" aria-label="Choose a whim">
            <p className="eyebrow">{dateLabel(state.month)} · a new whim</p>
            <h2>What do you feel like, Mr. President?</h2>
            <p className="menu-note">
              Pick one. Satisfy it within {WHIM_MONTHS} months for the reward. Give up on it and you sulk ({WHIM_FAIL_EGO} Ego).
            </p>
            {whims.map((id) => {
              const whim = whimById(id);
              return (
                <button key={id} className="vanity" onClick={() => setState((s) => s && chooseWhim(s, id))}>
                  <span className="vanity-main">
                    <span className="vanity-title">{whim.title}</span>
                    <span className="vanity-text">{whim.text}</span>
                  </span>
                  <span className="vanity-side">
                    <Fx effects={whim.reward} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {reveal && (
        <div className="overlay">
          <div className="plaque whims chaos" role="dialog" aria-label="What happened">
            <p className="eyebrow">{reveal.eyebrow}</p>
            <h2>{reveal.title}</h2>
            <p>{reveal.text}</p>
            {reveal.effects.ego || reveal.effects.stability ? (
              <Fx effects={reveal.effects} />
            ) : (
              <p className="menu-note">No change to either meter.</p>
            )}
            <button className="btn primary" onClick={() => setState((s) => s && dismissReveal(s))}>
              Carry on
            </button>
          </div>
        </div>
      )}

      {chaos && (
        <div className="overlay">
          <div className="plaque whims chaos" role="dialog" aria-label="Chaos event">
            <p className="eyebrow">{dateLabel(state.month)} · chaos</p>
            <h2>{chaos.title}</h2>
            <p>{chaos.text}</p>
            <p className="menu-note">Nobody can tell you how any of this will turn out. Ignoring it now means hearing about it later this year.</p>
            {chaos.choices.map((choice, i) => (
              <button
                key={choice.label}
                className="vanity"
                disabled={choice.cost > state.blocks}
                onClick={() => setState((s) => s && resolveChaos(s, i as 0 | 1))}
              >
                <span className="vanity-main">
                  <span className="vanity-title">{choice.label}</span>
                </span>
                <span className="vanity-side">
                  {choice.cost > 0 ? <Blocks n={choice.cost} /> : <span className="cost">No time</span>}
                  <span className="chip unknown">???</span>
                </span>
                {choice.cost > state.blocks && (
                  <Why>
                    This answer takes {choice.cost} time blocks and you have {state.blocks} left. Pick another, or ignore it.
                  </Why>
                )}
              </button>
            ))}
            <button className="vanity" onClick={() => setState((s) => s && resolveChaos(s, 'ignore'))}>
              <span className="vanity-main">
                <span className="vanity-title">{chaos.ignore.label}</span>
              </span>
              <span className="vanity-side">
                <span className="cost">No time</span>
                <span className="chip unknown">???</span>
              </span>
            </button>
          </div>
        </div>
      )}

      <World
        state={state}
        command={command}
        onDuty={(cardId, option) => setState((s) => s && playDuty(s, cardId, option))}
        onVanity={(actionId) => setState((s) => s && doVanity(s, actionId))}
        onBribe={(guestId) => setState((s) => s && takeBribe(s, guestId))}
        onDecline={(guestId) => setState((s) => s && declineGuest(s, guestId))}
        onLunch={(meal) => setState((s) => s && orderLunch(s, meal))}
        onCoke={() => setState((s) => s && pressCokeButton(s))}
        onSue={() => setState((s) => s && sueSomething(s))}
        onMelania={() => setState((s) => s && askMelania(s))}
        onAbuse={() => setState((s) => s && hearMelania(s))}
        onBroadcast={() => setState((s) => s && endBroadcast(s))}
        onEndMonth={() => setState((s) => s && endMonth(s))}
      />

      <section className="news">
        <ul>
          {state.log.slice(0, 4).map((entry, i) => (
            <li key={`${state.log.length}-${i}`} className={`tone-${entry.tone}`}>
              <span className="log-date">{dateLabel(entry.month)}</span>
              {entry.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

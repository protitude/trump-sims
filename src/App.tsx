import { useEffect, useState } from 'react';
import {
  BLOCKS_PER_MONTH,
  TOTAL_MONTHS,
  chooseWhim,
  dateLabel,
  dismissReveal,
  doVanity,
  egoDecay,
  endMonth,
  mood,
  newGame,
  playDuty,
  resolveChaos,
  score,
  stabilityDrift,
} from './game/engine.ts';
import { WHIM_FAIL_EGO, WHIM_MONTHS, activeSeasons, comingUp, whimById, whimProgress } from './game/calendar.ts';
import { Blocks, Fx } from './ui.tsx';
import { chaosById } from './game/chaos.ts';
import type { GameState } from './game/types.ts';
import { cardById } from './game/content.ts';
import { MusicControl, useMusic } from './music.tsx';
import type { Music } from './music.tsx';
import { World } from './world/World.tsx';
import type { Target } from './world/World.tsx';

const SAVE_KEY = 'executive-time-save-v5';

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
          and Tarush Singhal, from OpenGameArt.org.
        </p>
      </div>
    </main>
  );
}

const ENDINGS = {
  ww3: {
    title: 'World War III',
    text: 'It began with a renamed gulf, an unread briefing and a phone left on hold. The Arch survived. Not much else did.',
  },
  depression: {
    title: 'Full Depression',
    text: 'The world has never been better: peace, prosperity, agencies that function. Nobody has said your name in weeks. You are under the gold duvet and you are not coming out.',
  },
  won: {
    title: 'Term Complete',
    text: 'Four years, and both the planet and your self-esteem are intact. Historians are baffled. You are already asking about a third term.',
  },
  playing: { title: '', text: '' },
};

function GameOver({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const ending = ENDINGS[state.status];
  return (
    <main className="screen">
      <div className={`plaque ending-${state.status}`}>
        <p className="eyebrow">{state.status === 'won' ? 'You won' : `Game over · ${dateLabel(state.month)}`}</p>
        <h1>{ending.title}</h1>
        <p>{ending.text}</p>
        <dl className="stats">
          <div>
            <dt>Months served</dt>
            <dd>
              {state.status === 'won' ? TOTAL_MONTHS : state.month - 1} / {TOTAL_MONTHS}
            </dd>
          </div>
          <div>
            <dt>Things named after you</dt>
            <dd>{state.names}</dd>
          </div>
          <div>
            <dt>Gold</dt>
            <dd>{state.gold}</dd>
          </div>
          <div>
            <dt>Whims satisfied</dt>
            <dd>{state.stats.whimsDone ?? 0}</dd>
          </div>
          <div>
            <dt>Congress after the midterms</dt>
            <dd>{state.congress === 'friendly' ? 'Kept' : state.congress === 'hostile' ? 'Lost' : 'Not reached'}</dd>
          </div>
          <div>
            <dt>Legacy score</dt>
            <dd>{score(state)}</dd>
          </div>
        </dl>
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
  const reveal = state.whimOffer.length === 0 ? state.reveals[0] : undefined;
  const chaos = state.whimOffer.length === 0 && !reveal && state.chaos ? chaosById(state.chaos) : null;

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
                : 'Waiting in Washington while you are at Mar-a-Lago:'}
          </span>
          {state.inbox.map((id) => {
            const card = cardById(id);
            return (
              <button key={id} className={`visitor kind-${card.kind}`} disabled={state.place !== 'dc'} onClick={() => go({ type: 'npc', cardId: id })}>
                <span aria-hidden="true">{VISITOR_ICON[card.kind]}</span>
                {card.title.replace(/^(CRISIS|OPPORTUNITY): /, '')}
              </button>
            );
          })}
        </div>
      </header>

      <div className="calendar">
        {seasons.map((season) => (
          <span key={season.id} className="season" title={season.note}>
            <b>{season.name}</b> {season.note}
          </span>
        ))}
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

      {state.whimOffer.length > 0 && (
        <div className="overlay">
          <div className="plaque whims" role="dialog" aria-label="Choose a whim">
            <p className="eyebrow">{dateLabel(state.month)} · a new whim</p>
            <h2>What do you feel like, Mr. President?</h2>
            <p className="menu-note">
              Pick one. Satisfy it within {WHIM_MONTHS} months for the reward. Give up on it and you sulk ({WHIM_FAIL_EGO} Ego).
            </p>
            {state.whimOffer.map((id) => {
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

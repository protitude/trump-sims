import { useCallback, useEffect, useRef, useState } from 'react';
import type { DanceStyle } from './world/draw.ts';

// Background music: an original disco track rendered by
// scripts/disco-track.mjs, the original "Manosphere Music" rendered by
// scripts/manosphere-track.mjs, Schubert's Ave Maria rendered by
// scripts/ave-maria-track.mjs, plus six public-domain (CC0) tracks from
// OpenGameArt.org, played in rotation. Credits are in public/music/CREDITS.md.

interface Track {
  title: string;
  file: string;
  /** How many times to play it before moving on (short loops repeat). */
  plays: number;
  /** He moves to this one when it starts from the top. */
  dance?: DanceStyle;
}

const PLAYLIST: Track[] = [
  { title: 'Executive Disco', file: 'music/executive-disco.mp3', plays: 1, dance: 'disco' },
  { title: 'Lofi Hip Hop Loop', file: 'music/lofi-hip-hop-loop.mp3', plays: 1 },
  { title: 'Funky Lofi Jam', file: 'music/funky-lofi-jam.mp3', plays: 1 },
  { title: 'Manosphere Music', file: 'music/manosphere-music.mp3', plays: 1, dance: 'macho' },
  { title: 'Lofi Again', file: 'music/lofi-again.mp3', plays: 2 },
  { title: 'Chill Lofi Inspired', file: 'music/chill-lofi.mp3', plays: 1 },
  { title: 'Ave Maria', file: 'music/ave-maria.mp3', plays: 1, dance: 'sway' },
  { title: 'Happy Lofi Day', file: 'music/happy-lofi-day.mp3', plays: 1 },
  { title: 'Lofi Hip Hop', file: 'music/lofi-hip-hop.mp3', plays: 1 },
];

const PREF_KEY = 'executive-time-music';
const VOLUME_KEY = 'executive-time-volume';
const DEFAULT_VOLUME = 0.35;

function savedVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = stored === null ? NaN : Number(stored);
    return value >= 0 && value <= 1 ? value : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

function savedPreference(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export interface Music {
  on: boolean;
  title: string;
  /** 0 to 1. */
  volume: number;
  setVolume: (volume: number) => void;
  /** Call from a click handler: browsers only allow sound after a user action. */
  start: () => void;
  toggle: () => void;
  next: () => void;
  /** The last dance cue: which moves, and performance.now() when its track started from the top. */
  dance: DanceCue | null;
}

export interface DanceCue {
  style: DanceStyle;
  at: number;
}

export function useMusic(): Music {
  const [on, setOn] = useState(savedPreference);
  const [index, setIndex] = useState(0);
  const [volume, setVolumeState] = useState(savedVolume);
  const [dance, setDance] = useState<DanceCue | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playsLeft = useRef(PLAYLIST[0].plays);
  const onRef = useRef(on);
  onRef.current = on;

  const load = useCallback((i: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    playsLeft.current = PLAYLIST[i].plays;
    audio.src = PLAYLIST[i].file;
    setIndex(i);
    if (onRef.current) audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = savedVolume();
    audio.preload = 'none';
    audio.src = PLAYLIST[0].file;
    audioRef.current = audio;
    let current = 0;
    const onEnded = () => {
      playsLeft.current -= 1;
      if (playsLeft.current > 0) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      current = (PLAYLIST.findIndex((t) => audio.src.endsWith(t.file)) + 1) % PLAYLIST.length;
      load(current);
    };
    // A dance track starting from the top is his cue.
    const onPlaying = () => {
      const style = PLAYLIST.find((t) => audio.src.endsWith(t.file))?.dance;
      if (style && audio.currentTime < 1) setDance({ style, at: performance.now() });
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('playing', onPlaying);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('playing', onPlaying);
      audio.pause();
      audioRef.current = null;
    };
  }, [load]);

  const start = useCallback(() => {
    if (onRef.current) audioRef.current?.play().catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    const next = !onRef.current;
    setOn(next);
    try {
      localStorage.setItem(PREF_KEY, next ? 'on' : 'off');
    } catch {
      // Preference just will not be remembered.
    }
    if (next) audioRef.current?.play().catch(() => {});
    else audioRef.current?.pause();
  }, []);

  const next = useCallback(() => load((index + 1) % PLAYLIST.length), [index, load]);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      // Volume just will not be remembered.
    }
  }, []);

  return { on, title: PLAYLIST[index].title, volume, setVolume, start, toggle, next, dance };
}

export function MusicControl({ music }: { music: Music }) {
  return (
    <div className="music">
      <button onClick={music.toggle} aria-pressed={music.on} title={music.on ? 'Turn music off' : 'Turn music on'}>
        <span aria-hidden="true">{music.on ? '♪' : '♪̸'}</span> Music {music.on ? 'on' : 'off'}
      </button>
      {music.on && (
        <button onClick={music.next} title="Next track">
          {music.title} <span aria-hidden="true">⏭</span>
        </button>
      )}
      {music.on && (
        <label className="volume" title={`Volume ${Math.round(music.volume * 100)}%`}>
          <span aria-hidden="true">{music.volume === 0 ? '🔈' : music.volume < 0.5 ? '🔉' : '🔊'}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(music.volume * 100)}
            aria-label="Music volume"
            onChange={(e) => music.setVolume(Number(e.target.value) / 100)}
          />
        </label>
      )}
    </div>
  );
}

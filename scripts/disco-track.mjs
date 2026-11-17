// Renders "Executive Disco", an original disco/chiptune track, to an MP3.
// Everything here (melody, chords, arrangement, synth sounds) is written from
// scratch, so the result is ours to ship. No samples, no dependencies.
//
// Usage: node scripts/disco-track.mjs [out.mp3]
// Needs ffmpeg on the PATH for the WAV -> MP3 step.

import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'public/music/executive-disco.mp3';
const SR = 44100;
const BPM = 124;
const SIX = 60 / BPM / 4; // one sixteenth note, in seconds
const BAR = SIX * 16;

// ---------------------------------------------------------------- music data

const CHORDS = {
  Dm7: { root: 38, notes: [57, 60, 62, 65] },
  G7: { root: 43, notes: [59, 62, 65, 67] },
  Cmaj7: { root: 36, notes: [59, 60, 64, 67] },
  C: { root: 36, notes: [55, 60, 64, 67] },
  Am7: { root: 45, notes: [57, 60, 64, 67] },
  Bbmaj7: { root: 46, notes: [58, 62, 65, 69] },
  A7: { root: 45, notes: [57, 61, 64, 67] },
  A7sus: { root: 45, notes: [57, 62, 64, 67] },
};

// Melodies: "note/sixteenths", "r" is a rest. Each bar adds up to 16.
const VERSE_TUNE = `
  r/4 A4/2 C5/2 D5/3 C5/1 A4/4
  r/2 B4/2 D5/2 F5/4 E5/2 D5/4
  r/4 G4/2 C5/2 E5/3 D5/1 C5/4
  E5/2 D5/2 C5/2 A4/6 r/4
  r/4 A4/2 C5/2 D5/3 C5/1 A4/4
  r/2 B4/2 D5/2 F5/4 G5/2 F5/4
  D5/3 F5/3 A5/2 G5/2 F5/2 D5/4
  E5/4 C#5/4 A4/4 r/4`;

const CHORUS_TUNE = `
  F5/2 F5/2 r/2 D5/2 F5/2 G5/2 A5/4
  G5/2 F5/2 E5/2 C5/2 r/4 E5/2 G5/2
  A5/6 G5/2 E5/4 C5/4
  D5/8 r/4 A4/2 C5/2
  F5/2 F5/2 r/2 D5/2 F5/2 G5/2 A5/4
  C6/2 Bb5/2 A5/2 G5/2 r/2 G5/2 A5/2 Bb5/2
  A5/4 G5/2 F5/2 E5/4 D5/4
  C#5/4 E5/4 A5/4 r/4`;

const VERSE = ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Bbmaj7', 'A7'];
const CHORUS = ['Bbmaj7', 'C', 'Am7', 'Dm7', 'Bbmaj7', 'C', 'A7sus', 'A7'];

const SONG = [
  { kind: 'intro', chords: ['Dm7', 'G7', 'Dm7', 'G7'] },
  { kind: 'verse', chords: VERSE, tune: VERSE_TUNE },
  { kind: 'chorus', chords: CHORUS, tune: CHORUS_TUNE },
  { kind: 'break', chords: ['Bbmaj7', 'C', 'Am7', 'A7'] },
  { kind: 'verse', chords: VERSE, tune: VERSE_TUNE, pad: true },
  { kind: 'chorus', chords: CHORUS, tune: CHORUS_TUNE },
  { kind: 'chorus', chords: CHORUS, tune: CHORUS_TUNE, octave: true },
  { kind: 'outro', chords: ['Dm7', 'G7', 'Dm7', 'Dm7'] },
];

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + accidental;
}
function parseTune(text) {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [name, len] = token.split('/');
      return { midi: name === 'r' ? null : noteToMidi(name), len: Number(len) };
    });
}
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// ------------------------------------------------------------------ buffers

const totalBars = SONG.reduce((n, s) => n + s.chords.length, 0);
const LENGTH = Math.ceil((totalBars * BAR + 3) * SR);
const L = new Float32Array(LENGTH);
const R = new Float32Array(LENGTH);
const reverbSend = new Float32Array(LENGTH);
const delaySend = new Float32Array(LENGTH);

function put(i, v, pan = 0, rev = 0) {
  if (i < 0 || i >= LENGTH) return;
  const a = ((pan + 1) * Math.PI) / 4;
  L[i] += v * Math.cos(a) * Math.SQRT2;
  R[i] += v * Math.sin(a) * Math.SQRT2;
  reverbSend[i] += v * rev;
}

// Deterministic noise so every render is identical.
let seed = 12345;
function noise() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
}

// Chamberlin state-variable filter.
function svf() {
  let low = 0;
  let band = 0;
  return (x, cutoff, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SR / 6)) / SR);
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    return { low, band, high };
  };
}

// ------------------------------------------------------------------- voices

function kick(t) {
  const s0 = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 0.4 * SR; i++) {
    const tt = i / SR;
    ph += (45 + 120 * Math.exp(-tt * 35)) / SR;
    let v = Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 7) * 0.9;
    if (tt < 0.003) v += noise() * 0.25;
    put(s0 + i, v);
  }
}

function clap(t, vel = 1) {
  const s0 = Math.floor(t * SR);
  const filter = svf();
  for (let i = 0; i < 0.3 * SR; i++) {
    const tt = i / SR;
    let env = 0;
    for (const k of [0, 0.011, 0.022]) if (tt >= k) env = Math.max(env, Math.exp(-(tt - k) * 300));
    if (tt >= 0.022) env = Math.max(env, 0.6 * Math.exp(-(tt - 0.022) * 18));
    const { band } = filter(noise(), 1500, 0.5);
    put(s0 + i, band * env * 0.55 * vel, 0, 0.35);
  }
}

function snare(t, vel) {
  const s0 = Math.floor(t * SR);
  const filter = svf();
  for (let i = 0; i < 0.12 * SR; i++) {
    const tt = i / SR;
    const { band } = filter(noise(), 1800, 0.6);
    const body = Math.sin(2 * Math.PI * 190 * tt) * Math.exp(-tt * 40);
    put(s0 + i, (band * 0.5 + body * 0.3) * Math.exp(-tt * 28) * vel, 0.1, 0.2);
  }
}

function hat(t, open) {
  const s0 = Math.floor(t * SR);
  let lp = 0;
  const len = open ? 0.16 : 0.04;
  for (let i = 0; i < len * SR; i++) {
    const tt = i / SR;
    const n = noise();
    lp += 0.55 * (n - lp);
    const v = (n - lp) * Math.exp(-tt * (open ? 14 : 70)) * (open ? 0.13 : 0.08);
    put(s0 + i, v, open ? 0.3 : -0.3, 0.05);
  }
}

function bass(t, dur, midi) {
  const s0 = Math.floor(t * SR);
  const f0 = mtof(midi);
  const filter = svf();
  let ph = 0;
  for (let i = 0; i < (dur + 0.04) * SR; i++) {
    const tt = i / SR;
    ph = (ph + f0 / SR) % 1;
    const saw = 2 * ph - 1;
    const { low } = filter(saw, 180 + 1500 * Math.exp(-tt * 18), 0.55);
    const gate = tt < dur ? 0.7 + 0.3 * Math.exp(-tt * 12) : 0.7 * Math.exp(-(tt - dur) * 60);
    put(s0 + i, low * Math.min(1, tt / 0.003) * gate * 0.32);
  }
}

function lead(t, dur, midi, vel = 1, pan = 0.08) {
  const s0 = Math.floor(t * SR);
  const f0 = mtof(midi);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < (dur + 0.1) * SR; i++) {
    const tt = i / SR;
    const vib = tt > 0.14 ? 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * tt) : 1;
    ph = (ph + (f0 * vib) / SR) % 1;
    const pulse = (ph < 0.25 ? 1 : -1) + 0.5; // 25% duty, DC removed
    lp += 0.35 * (pulse - lp);
    const env =
      Math.min(1, tt / 0.005) * (tt < dur ? 0.8 + 0.2 * Math.exp(-tt * 8) : 0.8 * Math.exp(-(tt - dur) * 40));
    const v = lp * env * vel * 0.1;
    put(s0 + i, v, pan, 0.12);
    if (s0 + i < LENGTH) delaySend[s0 + i] += v;
  }
}

function pluck(t, notes, pan) {
  const s0 = Math.floor(t * SR);
  for (const midi of notes) {
    const f0 = mtof(midi + 12);
    let ph = 0;
    let lp = 0;
    for (let i = 0; i < 0.15 * SR; i++) {
      const tt = i / SR;
      ph = (ph + f0 / SR) % 1;
      lp += (0.08 + 0.4 * Math.exp(-tt * 30)) * ((ph < 0.5 ? 1 : -1) - lp);
      put(s0 + i, lp * Math.exp(-tt * 28) * 0.035, pan, 0.1);
    }
  }
}

function brass(t, dur, notes, vel = 1) {
  const s0 = Math.floor(t * SR);
  notes.forEach((midi, n) => {
    const pan = -0.45 + (0.9 * n) / (notes.length - 1);
    const f0 = mtof(midi);
    const filter = svf();
    const phases = [0, 0.33, 0.66];
    const detune = [1, 1.004, 0.996];
    for (let i = 0; i < (dur + 0.1) * SR; i++) {
      const tt = i / SR;
      let x = 0;
      for (let k = 0; k < 3; k++) {
        phases[k] = (phases[k] + (f0 * detune[k]) / SR) % 1;
        x += 2 * phases[k] - 1;
      }
      const swell = Math.min(1, tt / 0.025);
      const { low } = filter(x, 300 + 2800 * swell * (0.45 + 0.55 * Math.exp(-tt * 9)), 0.6);
      const env = Math.min(1, tt / 0.01) * (tt < dur ? 1 : Math.exp(-(tt - dur) * 35));
      put(s0 + i, low * env * vel * 0.03, pan, 0.25);
    }
  });
}

function pad(t, dur, notes, cutoff) {
  const s0 = Math.floor(t * SR);
  notes.forEach((midi, n) => {
    const pan = n % 2 ? 0.5 : -0.5;
    const f0 = mtof(midi + 12);
    const filter = svf();
    let a = noise() * 0.5 + 0.5;
    let b = noise() * 0.5 + 0.5;
    for (let i = 0; i < (dur + 0.4) * SR; i++) {
      const tt = i / SR;
      a = (a + f0 / SR) % 1;
      b = (b + (f0 * 1.003) / SR) % 1;
      const { low } = filter(a + b - 1, cutoff, 0.8);
      const env = Math.min(1, tt / 0.3) * (tt < dur ? 1 : Math.exp(-(tt - dur) * 8));
      put(s0 + i, low * env * 0.022, pan, 0.4);
    }
  });
}

// ------------------------------------------------------------- arrangement

let bar = 0;
SONG.forEach((section, si) => {
  const nextIsChorus = SONG[si + 1]?.kind === 'chorus';
  const tune = section.tune ? parseTune(section.tune) : null;
  if (tune) {
    let pos = 0;
    const t0 = bar * BAR;
    for (const note of tune) {
      if (note.midi !== null) {
        const dur = note.len * SIX * 0.9;
        lead(t0 + pos * SIX, dur, note.midi);
        if (section.octave) lead(t0 + pos * SIX, dur, note.midi + 12, 0.4, -0.25);
      }
      pos += note.len;
    }
  }

  section.chords.forEach((name, bi) => {
    const chord = CHORDS[name];
    const t = bar * BAR;
    const isLast = bi === section.chords.length - 1;
    const finalBar = section.kind === 'outro' && isLast;

    // Drums
    if (finalBar) {
      kick(t);
      clap(t);
    } else {
      for (let q = 0; q < 4; q++) kick(t + q * 4 * SIX);
      if (section.kind !== 'intro' || bi >= 2) {
        clap(t + 4 * SIX);
        clap(t + 12 * SIX);
      }
      if (section.kind !== 'break') {
        for (const s of [2, 6, 10, 14]) hat(t + s * SIX, true);
      }
      if (section.kind === 'chorus' || section.kind === 'break') {
        for (let s = 0; s < 16; s++) if (s % 4 !== 2) hat(t + s * SIX, false);
      }
      if (isLast && nextIsChorus) {
        for (let s = 8; s < 16; s++) snare(t + s * SIX, 0.3 + (0.7 * (s - 8)) / 7);
      }
    }

    // Octave-jumping disco bass
    if (finalBar) {
      bass(t, SIX * 6, chord.root);
    } else if (section.kind !== 'intro' || bi >= 2) {
      for (let e = 0; e < 8; e++) bass(t + e * 2 * SIX, SIX * 1.6, chord.root + (e % 2 ? 12 : 0));
    }

    // Chords
    if (section.kind === 'verse') {
      [2, 6, 10, 14].forEach((s, k) => pluck(t + s * SIX, chord.notes, k % 2 ? 0.4 : -0.4));
      if (section.pad) pad(t, BAR, chord.notes, 1400);
    }
    if (section.kind === 'chorus') {
      pad(t, BAR, chord.notes, 1800);
      brass(t, SIX * 2, chord.notes);
      brass(t + 6 * SIX, SIX, chord.notes, 0.8);
      brass(t + 10 * SIX, SIX * 2, chord.notes, 0.9);
    }
    if (section.kind === 'break') {
      pad(t, BAR, chord.notes, 700);
      if (bi % 2 === 0) for (const s of [0, 3, 6]) brass(t + s * SIX, SIX * 1.5, chord.notes, 0.9);
    }
    if (finalBar) brass(t, SIX * 8, chord.notes.concat(chord.notes[3] + 12));

    bar += 1;
  });
});

// ----------------------------------------------------------- effects + mix

// Ping-pong dotted-eighth delay on the lead.
{
  const d = Math.round(3 * SIX * SR);
  const dl = new Float32Array(LENGTH);
  const dr = new Float32Array(LENGTH);
  for (let i = 0; i < LENGTH; i++) {
    if (i >= d) {
      dl[i] = delaySend[i - d] + dr[i - d] * 0.35;
      dr[i] = dl[i - d] * 0.8;
    }
    L[i] += dl[i] * 0.25;
    R[i] += dr[i] * 0.25;
  }
}

// Small Schroeder reverb on the send bus.
function reverb(input, spread) {
  const out = new Float32Array(LENGTH);
  for (const len of [1116, 1188, 1277, 1356]) {
    const n = len + spread;
    const buf = new Float32Array(n);
    let idx = 0;
    let damp = 0;
    for (let i = 0; i < LENGTH; i++) {
      const y = buf[idx];
      damp = y * 0.75 + damp * 0.25;
      buf[idx] = input[i] + damp * 0.8;
      idx = (idx + 1) % n;
      out[i] += y * 0.25;
    }
  }
  for (const len of [556, 441]) {
    const n = len + spread;
    const buf = new Float32Array(n);
    let idx = 0;
    for (let i = 0; i < LENGTH; i++) {
      const b = buf[idx];
      const y = -out[i] + b;
      buf[idx] = out[i] + b * 0.5;
      idx = (idx + 1) % n;
      out[i] = y;
    }
  }
  return out;
}
const revL = reverb(reverbSend, 0);
const revR = reverb(reverbSend, 23);
for (let i = 0; i < LENGTH; i++) {
  L[i] += revL[i] * 0.3;
  R[i] += revR[i] * 0.3;
}

// DC block, soft clip, then level-match the lofi playlist (~-18 dB mean).
let peak = 0;
for (const ch of [L, R]) {
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < LENGTH; i++) {
    const y = ch[i] - x1 + 0.995 * y1;
    x1 = ch[i];
    y1 = y;
    ch[i] = Math.tanh(y * 1.2);
    peak = Math.max(peak, Math.abs(ch[i]));
  }
}
const gain = 0.45 / peak;

// --------------------------------------------------------------- write out

const wav = Buffer.alloc(44 + LENGTH * 4);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + LENGTH * 4, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(LENGTH * 4, 40);
for (let i = 0; i < LENGTH; i++) {
  wav.writeInt16LE(Math.round(L[i] * gain * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(R[i] * gain * 32767), 46 + i * 4);
}

const dir = mkdtempSync(join(tmpdir(), 'disco-'));
const wavPath = join(dir, 'track.wav');
writeFileSync(wavPath, wav);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-b:a', '128k', OUT]);
rmSync(dir, { recursive: true });
console.log(`Wrote ${OUT} (${(LENGTH / SR).toFixed(1)}s)`);

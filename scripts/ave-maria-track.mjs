// Renders "Ave Maria" (Schubert, D 839, 1825) to an MP3: a synthesized
// arrangement for voice-like lead, rippling piano and, in the second verse,
// strings. Schubert's music is long in the public domain; the notes below are
// transcribed from the Mutopia Project's public-domain edition
// (https://www.mutopiaproject.org, piece 1054, after C.F. Peters). The sounds
// and the arrangement are written from scratch here. No samples, no
// dependencies.
//
// Usage: node scripts/ave-maria-track.mjs [out.mp3]
// Needs ffmpeg on the PATH for the WAV -> MP3 step.

import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'public/music/ave-maria.mp3';
const SR = 44100;
const BPM = 54; // "Sehr langsam"
const BAR = (60 / BPM) * 4;
const U = BAR / 96; // one bar is 96 units: quarter 24, sixteenth 6, sextuplet sixteenth 4

// ---------------------------------------------------------------- music data

// Melody, bars 3 to 13 of the score: "note/units", "r" is a rest. Each bar adds up to 96.
// Grace notes are left out; appoggiaturas take their time from the main note.
const AVE = 'Bb4/36 A4/6 Bb4/6 D5/42 C5/6';
const VERSE_TUNE = [
  AVE,
  'Bb4/24 r/24 C5/24 Bb4/6 A4/6 G4/6 A4/6',
  'Bb4/24 r/12 D5/12 D5/18 C5/3 Bb4/3 A4/6 G4/6 D5/6 E5/6',
  'D5/24 C#5/18 A4/6 C5/18 Bb4/6 A4/4 C5/4 D5/4 Eb5/4 C5/4 A4/4',
  'Bb4/36 D5/6 C5/6 C5/18 A4/6 G4/4 B4/4 D5/4 F5/4 D5/4 B4/4',
  'C5/28 G4/4 A4/4 Bb4/4 A4/4 G4/4 F4/24 r/12 F4/12',
  'C5/18 C5/6 C5/9 B4/3 C5/9 D5/3 C5/9 D5/3 Bb4/12 r/12 Bb4/12',
  'C5/18 C5/6 C5/4 B4/4 C5/4 Eb5/4 D5/4 C5/4 Bb4/24 r/12 Bb4/12',
  'C5/18 C5/6 D5/9 D5/3 D5/4 C5/4 D5/4 F5/6 Eb5/6 Eb5/12 r/18 G4/6',
  'D5/6 C5/12 C5/6 Bb4/4 A4/4 Bb4/4 Db5/4 C5/4 Bb4/4 C5/36 r/12',
  AVE,
];
const LAST_WORD = 'Bb4/24 r/72'; // "...ri-a!" lands on the next downbeat

// Piano: per beat, the four notes the right hand ripples through (low to
// high), and the left hand's octave in the bass.
const B = {
  Bb: ['D4', 'F4', 'Bb4', 'D5'],
  BbF: ['F4', 'Bb4', 'D5', 'F5'],
  Bb7: ['Ab4', 'D5', 'F5', 'Ab5'],
  Eb: ['G4', 'Bb4', 'Eb5', 'G5'],
  dim: ['Gb4', 'A4', 'Eb5', 'Gb5'],
  C7: ['D4', 'E4', 'Bb4', 'D5'],
  F7: ['Eb4', 'A4', 'C5', 'Eb5'],
  Gm: ['D4', 'G4', 'Bb4', 'D5'],
  Cm: ['Eb4', 'G4', 'C5', 'Eb5'],
  F7b: ['Eb4', 'F4', 'A4', 'C5'],
  D7: ['D4', 'F#4', 'Bb4', 'D5'],
  Gm6: ['E4', 'G4', 'Bb4', 'D5'],
  A7: ['E4', 'G4', 'A4', 'C#5'],
  F: ['C4', 'F4', 'A4', 'C5'],
  G7: ['F4', 'G4', 'B4', 'F5'],
  Fhi: ['F4', 'A4', 'C5', 'F5'],
  C7b: ['E4', 'Bb4', 'C5', 'E5'],
  F7hi: ['Eb4', 'A4', 'C5', 'F5'],
  BbD: ['D4', 'Bb4', 'D5', 'F5'],
  GmLo: ['Bb3', 'D4', 'G4', 'Bb4'],
  D7b: ['D4', 'F#4', 'A4', 'D5'],
  Cm7: ['C4', 'Eb4', 'G4', 'C5'],
  dim2: ['Db4', 'E4', 'Bb4', 'Db5'],
};
// [right hand, bass] for each of the four beats.
const INTRO = [
  [[B.Bb, 'Bb'], [B.Bb, 'Bb'], [B.BbF, 'Bb'], [B.Bb7, 'Bb']],
  [[B.Eb, 'Bb'], [B.dim, 'Bb'], [B.BbF, 'Bb'], [B.Bb, 'Bb']],
];
const VERSE_PIANO = [
  [[B.Bb, 'Bb'], [B.C7, 'G'], [B.Bb, 'F'], [B.F7, 'F']],
  [[B.Gm, 'G'], [B.Gm, 'G'], [B.Cm, 'Eb'], [B.F7b, 'F']],
  [[B.Bb, 'Bb'], [B.Bb, 'Bb'], [B.D7, 'Bb'], [B.Gm, 'Bb']],
  [[B.Gm6, 'A'], [B.A7, 'A'], [B.F7, 'F#'], [B.F7, 'F#']],
  [[B.Gm, 'G'], [B.C7, 'G'], [B.F, 'A'], [B.G7, 'D']],
  [[B.Fhi, 'C'], [B.C7b, 'C'], [B.Fhi, 'F'], [B.Fhi, 'F']],
  [[B.F7hi, 'F'], [B.F7hi, 'F'], [B.BbD, 'F'], [B.BbD, 'F']],
  [[B.F7hi, 'F'], [B.F7hi, 'F'], [B.Gm, 'G'], [B.GmLo, 'G']],
  [[B.F, 'F'], [B.D7b, 'D'], [B.Cm, 'C'], [B.Cm, 'C']],
  [[B.Cm7, 'Eb'], [B.dim2, 'G'], [B.F, 'F'], [B.F7b, 'F']],
  [[B.Bb, 'Bb'], [B.C7, 'G'], [B.Bb, 'F'], [B.F7, 'F']],
];
const BASS = { Eb: 27, E: 28, F: 29, 'F#': 30, G: 31, Ab: 32, A: 33, Bb: 34, B: 35, C: 36, Db: 37, D: 38 };

// Bars in order. `stretch` slows a bar down (the closing ritardando and fermata).
const SONG = [
  ...INTRO.map((piano) => ({ piano, staccato: true })),
  ...VERSE_PIANO.map((piano, i) => ({ piano, tune: VERSE_TUNE[i] })),
  { piano: INTRO[0], staccato: true, tune: LAST_WORD },
  { piano: INTRO[1], staccato: true },
  ...VERSE_PIANO.map((piano, i) => ({ piano, tune: VERSE_TUNE[i], strings: true })),
  { piano: INTRO[0], tune: LAST_WORD, strings: true },
  { piano: INTRO[1], strings: true },
  {
    piano: [[['Bb3', 'D4', 'F4', 'Bb4'], 'Bb'], [['F3', 'Bb3', 'D4', 'F4'], 'Bb'], [['D3', 'F3', 'Bb3', 'D4'], 'Bb'], [['D3', 'F3', 'Bb3', 'D4'], 'Bb']],
    stretch: 1.2,
    strings: true,
  },
  { final: true, stretch: 2 },
];

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + accidental;
}
function parseTune(text) {
  const notes = text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [name, len] = token.split('/');
      return { midi: name === 'r' ? null : noteToMidi(name), len: Number(len) };
    });
  const total = notes.reduce((n, x) => n + x.len, 0);
  if (total !== 96) throw new Error(`Bar adds up to ${total}, not 96: ${text}`);
  return notes;
}
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// ------------------------------------------------------------------ buffers

const barStarts = [];
let songLength = 0;
for (const bar of SONG) {
  barStarts.push(songLength);
  songLength += BAR * (bar.stretch ?? 1);
}
const LENGTH = Math.ceil((songLength + 4) * SR);
const L = new Float32Array(LENGTH);
const R = new Float32Array(LENGTH);
const reverbSend = new Float32Array(LENGTH);

function put(i, v, pan = 0, rev = 0) {
  if (i < 0 || i >= LENGTH) return;
  const a = ((pan + 1) * Math.PI) / 4;
  L[i] += v * Math.cos(a) * Math.SQRT2;
  R[i] += v * Math.sin(a) * Math.SQRT2;
  reverbSend[i] += v * rev;
}

// Deterministic noise so every render is identical.
let seed = 4242;
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

// A soft piano: a few slightly stretched harmonics, upper ones dying first.
function piano(t, midi, vel, ring, pan) {
  const s0 = Math.floor(t * SR);
  const f0 = mtof(midi);
  const partials = [];
  for (let k = 1; k <= 6; k++) {
    const f = f0 * k * (1 + 0.0004 * k * k);
    if (f > SR / 2.5) break;
    partials.push({ w: (2 * Math.PI * f) / SR, amp: 1 / k ** 1.6, decay: (1.2 + 0.9 * k) * (f0 / 300) ** 0.4 });
  }
  const len = Math.floor(ring * SR);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let v = 0;
    for (const p of partials) v += Math.sin(p.w * i) * p.amp * Math.exp(-tt * p.decay);
    const attack = Math.min(1, tt / 0.004);
    const release = i > len - 0.05 * SR ? (len - i) / (0.05 * SR) : 1;
    put(s0 + i, v * attack * release * vel * 0.05, pan, 0.35);
  }
}

// The singer: a sawtooth through three "ah" formants, with vibrato that
// blooms after the note has settled.
function voice(t, dur, midi, vel = 1) {
  const s0 = Math.floor(t * SR);
  const f0 = mtof(midi);
  const formants = [
    [800, 1, svf()],
    [1150, 0.55, svf()],
    [2900, 0.22, svf()],
  ];
  const tail = 0.18;
  let ph = 0;
  let breath = 0;
  for (let i = 0; i < (dur + tail) * SR; i++) {
    const tt = i / SR;
    const depth = 0.007 * Math.min(1, Math.max(0, (tt - 0.18) / 0.35));
    const vib = 1 + depth * Math.sin(2 * Math.PI * 5.3 * tt);
    ph = (ph + (f0 * vib) / SR) % 1;
    breath += 0.2 * (noise() - breath);
    const src = 2 * ph - 1 + breath * 0.15;
    let v = 0;
    for (const [freq, gain, filter] of formants) v += filter(src, freq, 0.18).band * gain;
    const env = Math.min(1, tt / 0.06) * (tt < dur ? 1 : Math.exp(-(tt - dur) * 25));
    put(s0 + i, v * env * vel * 0.055, 0, 0.55);
  }
}

// Bowed strings: detuned saws, slow attack, filtered dark.
function strings(t, dur, notes) {
  const s0 = Math.floor(t * SR);
  notes.forEach((midi, n) => {
    const pan = -0.6 + (1.2 * n) / (notes.length - 1);
    const f0 = mtof(midi);
    const filter = svf();
    let a = noise() * 0.5 + 0.5;
    let b = noise() * 0.5 + 0.5;
    for (let i = 0; i < (dur + 0.5) * SR; i++) {
      const tt = i / SR;
      a = (a + f0 / SR) % 1;
      b = (b + (f0 * 1.004) / SR) % 1;
      const { low } = filter(a + b - 1, 1100, 0.9);
      const env = Math.min(1, tt / 0.35) * (tt < dur ? 1 : Math.exp(-(tt - dur) * 6));
      put(s0 + i, low * env * 0.016, pan, 0.6);
    }
  });
}

// ------------------------------------------------------------- arrangement

SONG.forEach((bar, bi) => {
  const t0 = barStarts[bi];
  const unit = U * (bar.stretch ?? 1);

  if (bar.final) {
    // Closing chord, held under the fermata.
    const ring = BAR * 2 + 3;
    for (const n of ['Bb1', 'F2', 'Bb2', 'D4', 'F4', 'Bb4', 'D5']) piano(t0, noteToMidi(n), 0.9, ring, 0);
    strings(t0, BAR * 1.6, ['Bb2', 'F3', 'D4', 'F4'].map(noteToMidi));
    return;
  }

  if (bar.tune) {
    let pos = 0;
    for (const note of parseTune(bar.tune)) {
      if (note.midi !== null) voice(t0 + pos * unit, note.len * unit, note.midi);
      pos += note.len;
    }
  }

  bar.piano.forEach(([rh, bassName], beat) => {
    const tb = t0 + beat * 24 * unit;
    const [p1, p2, p3, p4] = rh.map(noteToMidi);
    const dyads = [[p1, p2], [p2, p3], [p3, p4], [p2, p3], [p1, p2]];
    const ring = bar.staccato ? 0.35 : 1.4;
    dyads.forEach((dyad, k) => {
      const vel = k === 2 ? 0.95 : 0.7;
      for (const m of dyad) piano(tb + (k + 1) * 4 * unit, m, vel, ring, 0.15 - k * 0.06);
    });
    // Left hand: an octave on the beat, an eighth long.
    const bass = BASS[bassName];
    piano(tb, bass, 0.9, 12 * unit + 0.2, -0.2);
    piano(tb, bass + 12, 0.7, 12 * unit + 0.2, -0.2);
    if (bar.strings) strings(tb, 24 * unit, [bass + 12, p1, p3]);
  });
});

// ----------------------------------------------------------- effects + mix

// A big, dark room: Schroeder reverb with long combs.
function reverb(input, spread) {
  const out = new Float32Array(LENGTH);
  for (const len of [1557, 1617, 1491, 1422, 1277, 1356]) {
    const n = len + spread;
    const buf = new Float32Array(n);
    let idx = 0;
    let damp = 0;
    for (let i = 0; i < LENGTH; i++) {
      const y = buf[idx];
      damp = y * 0.6 + damp * 0.4;
      buf[idx] = input[i] + damp * 0.86;
      idx = (idx + 1) % n;
      out[i] += y * 0.17;
    }
  }
  for (const len of [556, 441, 341]) {
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
  L[i] += revL[i] * 0.35;
  R[i] += revR[i] * 0.35;
}

// DC block, soft clip, then level-match the other tracks.
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
const gain = 0.7 / peak;

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

const dir = mkdtempSync(join(tmpdir(), 'ave-'));
const wavPath = join(dir, 'track.wav');
writeFileSync(wavPath, wav);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-b:a', '128k', OUT]);
rmSync(dir, { recursive: true });
console.log(`Wrote ${OUT} (${(LENGTH / SR).toFixed(1)}s)`);

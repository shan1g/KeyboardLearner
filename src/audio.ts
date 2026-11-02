// Synthesised sound effects (no audio files), built into the browser.

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let activeVoices = 0;
const MAX_VOICES = 24; // keeps frantic smashing from turning into noise

function getAudio(): AudioContext | null {
  if (!ctx) {
    const AC =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const compressor = ctx.createDynamicsCompressor();
    out = ctx.createGain();
    out.gain.value = 0.7;
    out.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a user gesture (click / key press) so browsers allow audio. */
export const unlockAudio = () => {
  getAudio();
};

/** Shared context and master output, so voice clips go through the same chain as the sound effects. */
export function audioGraph(): { ctx: AudioContext; out: GainNode } | null {
  const c = getAudio();
  return c && out ? { ctx: c, out } : null;
}

interface ToneOptions {
  at?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
  slideTo?: number;
}

function tone(freq: number, { at = 0, dur = 0.25, type = 'sine', vol = 0.2, slideTo }: ToneOptions = {}) {
  const c = getAudio();
  const dest = out;
  if (!c || !dest || activeVoices >= MAX_VOICES) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  activeVoices++;
  osc.onended = () => {
    activeVoices--;
    gain.disconnect();
  };
}

// Pentatonic scale: any combination of keys sounds pleasant.
const PENTATONIC = [0, 2, 4, 7, 9];
const C4 = 261.63;
const noteFreq = (i: number) => C4 * 2 ** ((PENTATONIC[i % 5] + 12 * (Math.floor(i / 5) % 3)) / 12);

export const sfx = {
  /** Bubbly pop, a different note for every key. */
  pop(index: number) {
    const f = noteFreq(index);
    tone(f * 2, { dur: 0.09, vol: 0.12, slideTo: f });
    tone(f, { dur: 0.4, type: 'triangle', vol: 0.22 });
  },
  /** Happy rising arpeggio. */
  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, n) => tone(f, { at: n * 0.09, dur: 0.35, type: 'triangle', vol: 0.2 }));
    tone(2093, { at: 0.36, dur: 0.6, vol: 0.06 });
  },
  /** Gentle "uh-oh", not harsh. */
  wrong() {
    tone(330, { dur: 0.16, vol: 0.16, slideTo: 260 });
    tone(262, { at: 0.13, dur: 0.24, vol: 0.14, slideTo: 196 });
  },
  tap() {
    tone(1046.5, { dur: 0.06, vol: 0.06 });
  },
};

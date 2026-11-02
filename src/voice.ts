// Plays the pre-rendered Kokoro clips in public/voice/ (see scripts/gen-voice.ts)
// through the shared Web Audio output, so they behave like the sound effects.
import { audioGraph } from './audio';

const GAP_SECONDS = 0.06;
const cache = new Map<string, Promise<AudioBuffer | null>>();
let active: AudioBufferSourceNode[] = [];
let generation = 0;

function load(id: string): Promise<AudioBuffer | null> {
  const cached = cache.get(id);
  if (cached) return cached;
  const promise = (async () => {
    const graph = audioGraph();
    if (!graph) return null;
    try {
      // Relative URL so it also works when the app is hosted under a sub-path.
      const res = await fetch(`voice/${id}.mp3`);
      if (!res.ok) return null;
      return await graph.ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  })();
  cache.set(id, promise);
  void promise.then((buffer) => {
    if (!buffer) cache.delete(id); // allow a retry later, e.g. after coming back online
  });
  return promise;
}

/** Fetch and decode clips ahead of time so they play instantly. */
export function preloadVoice(ids: string[]) {
  for (const id of ids) void load(id);
}

export function stopVoice() {
  generation++;
  for (const src of active) {
    try {
      src.stop();
    } catch {
      // already stopped
    }
  }
  active = [];
}

interface SpeakOptions {
  /** Skip instead of interrupting if a clip is already playing (e.g. repeated wrong keys). */
  ifIdle?: boolean;
  /** Seconds to wait before the first clip, e.g. to let a sound effect finish. */
  delay?: number;
}

/**
 * Plays clips back to back, interrupting anything already playing.
 * Resolves with the seconds until playback ends, or null if skipped or interrupted while loading.
 */
export async function speak(ids: string[], { ifIdle = false, delay = 0 }: SpeakOptions = {}): Promise<number | null> {
  if (ifIdle && active.length > 0) return null;
  stopVoice();
  const run = generation;
  const buffers = await Promise.all(ids.map(load));
  const graph = audioGraph();
  if (run !== generation || !graph) return null;

  const { ctx, out } = graph;
  let t = ctx.currentTime + 0.02 + delay;
  for (const buffer of buffers) {
    if (!buffer) continue;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(out);
    src.onended = () => {
      active = active.filter((s) => s !== src);
      src.disconnect();
    };
    src.start(t);
    active.push(src);
    t += buffer.duration + GAP_SECONDS;
  }
  return Math.max(0, t - ctx.currentTime);
}

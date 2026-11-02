/**
 * Renders Learn mode's voice clips with Kokoro-82M (Apache-2.0) into public/voice/.
 * The model (~90 MB) downloads once and is cached; after that it runs offline on the CPU.
 *
 *   npm run voice                               # only renders new or changed lines
 *   npm run voice -- --force                    # re-render everything
 *   npm run voice -- --voice=bf_isabella --speed=0.85   # voice changes re-render everything
 *
 * Requires ffmpeg on PATH (used to trim silence and encode small MP3s).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { KokoroTTS } from 'kokoro-js';
import { voiceScript } from '../src/voiceLines.ts';

interface Manifest {
  voice: string;
  speed: number;
  clips: Record<string, string>;
}

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const force = process.argv.includes('--force');
// British English voice, to match the letter names in src/voiceLines.ts (Z = "zed").
const voice = arg('voice') ?? 'bf_emma';
const speed = Number(arg('speed') ?? 0.9);

const outDir = path.resolve('public/voice');
const manifestPath = path.join(outDir, 'manifest.json');
const clipPath = (id: string) => path.join(outDir, `${id}.mp3`);

if (spawnSync('ffmpeg', ['-version']).error) {
  console.error('ffmpeg was not found on PATH. Install it (e.g. `winget install Gyan.FFmpeg`) and try again.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const script = voiceScript();
const previous: Manifest | null = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
const done: Record<string, string> = {};
if (previous && !force && previous.voice === voice && previous.speed === speed) {
  for (const [id, text] of Object.entries(previous.clips)) {
    if (script[id] === text && existsSync(clipPath(id))) done[id] = text;
  }
}

// Remove clips for words that no longer exist.
for (const file of readdirSync(outDir)) {
  if (file.endsWith('.mp3') && !(file.slice(0, -4) in script)) rmSync(path.join(outDir, file));
}

const saveManifest = () =>
  writeFileSync(manifestPath, JSON.stringify({ voice, speed, clips: done } satisfies Manifest, null, 2) + '\n');

function encode(samples: Float32Array, rate: number, file: string) {
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02';
  const result = spawnSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0',
      '-af', `${trim},areverse,${trim},areverse,afade=t=in:d=0.01`,
      '-c:a', 'libmp3lame', '-b:a', '48k',
      file,
    ],
    { input: pcm },
  );
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${file}: ${result.stderr?.toString()}`);
}

const todo = Object.entries(script).filter(([id]) => !(id in done));

if (todo.length === 0) {
  console.log(`All ${Object.keys(script).length} clips are up to date.`);
} else {
  console.log(`Rendering ${todo.length} of ${Object.keys(script).length} clips with Kokoro (${voice}, speed ${speed})...`);
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
  let n = 0;
  for (const [id, text] of todo) {
    const audio = await tts.generate(text, { voice: voice as never, speed });
    encode(audio.audio, audio.sampling_rate, clipPath(id));
    done[id] = text;
    if (++n % 10 === 0) saveManifest();
    console.log(`[${n}/${todo.length}] ${id}: ${text}`);
  }
}

saveManifest();

// Everything Learn mode can say. Shared by the app (to pick clips) and
// scripts/gen-voice.ts (to render them), so clip ids always match.
import { KEY_MAP, LETTERS } from './letters';

/**
 * How each letter name is spelled for the speech model (a lone "A" gets read as "uh").
 * Spellings were checked against the phonemes the eSpeak phonemizer produces:
 * "ay" comes out as /aɪ/ (same as "eye"), so A uses "eigh" (/eɪ/); "eff" comes out
 * as "ee eff eff", so F uses "ef".
 */
export const LETTER_NAMES: Record<string, string> = {
  A: 'eigh', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'ef', G: 'jee', H: 'aitch', I: 'eye',
  J: 'jay', K: 'kay', L: 'el', M: 'em', N: 'en', O: 'oh', P: 'pee', Q: 'cue', R: 'ar',
  S: 'ess', T: 'tee', U: 'you', V: 'vee', W: 'double you', X: 'ex', Y: 'why', Z: 'zed',
};

/** Words the model would misread, spelled the way they should sound. */
const SAY_AS: Record<string, string> = {
  UFO: 'you ef oh',
  'X-ray': 'ex-ray',
  'X-ray fish': 'ex-ray fish',
  'X mark': 'ex mark',
  'Xmas tree': 'ex-mas tree',
  Zzz: 'zed zed zed',
};

export const PRAISE = ['Yes!', 'Great job!', 'You found it!', 'Awesome!', 'Super!', 'Well done!'];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const lc = (letter: string) => letter.toLowerCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const clips = {
  find: (letter: string) => `find-${lc(letter)}`,
  thats: (letter: string) => `thats-${lc(letter)}`,
  isFor: (letter: string, word: string) => `${lc(letter)}-is-for-${slug(word)}`,
  praise: (index: number) => `praise-${index}`,
};

/** Every clip, as id -> text to speak. */
export function voiceScript(): Record<string, string> {
  const out: Record<string, string> = {};
  PRAISE.forEach((text, i) => {
    out[clips.praise(i)] = text;
  });
  for (const letter of LETTERS) {
    const name = LETTER_NAMES[letter];
    out[clips.find(letter)] = `Find the letter ${name}.`;
    out[clips.thats(letter)] = `That's ${name}.`;
    for (const { word } of KEY_MAP[letter]) {
      out[clips.isFor(letter, word)] = `${cap(name)} is for ${SAY_AS[word] ?? word}!`;
    }
  }
  return out;
}

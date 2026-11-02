/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import confetti from 'canvas-confetti';
import {
  Flame,
  GraduationCap,
  Keyboard,
  Lock,
  RotateCcw,
  Settings as SettingsIcon,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { KEY_MAP, LETTERS, keyFromEvent, noteIndex, randomItem, type Pic } from './letters';
import { sfx, unlockAudio } from './audio';
import { preloadVoice, speak, stopVoice } from './voice';
import { PRAISE, clips } from './voiceLines';

type Mode = 'smash' | 'learn';
type Screen = 'start' | 'play';

interface Settings {
  sound: boolean;
  /** Spoken prompts and praise, Learn mode only. */
  voice: boolean;
  muted: boolean;
  order: 'random' | 'abc';
  hint: boolean;
  auto: boolean;
}

interface SmashItem {
  id: number;
  key: string;
  pic: Pic;
  x: number;
  y: number;
  rot: number;
  hue: number;
}

interface Target {
  letter: string;
  pic: Pic;
  id: number;
}

interface Flash {
  key: string;
  ok: boolean;
  id: number;
}

const DEFAULT_SETTINGS: Settings = { sound: true, voice: true, muted: false, order: 'random', hint: true, auto: false };
const STORAGE_KEY = 'keyboard-smasher:settings';
const MAX_ITEMS = 32;
const HOLD_TO_UNLOCK_MS = 2000;
const AUTO_INTERVAL_MS = 1600;
const CONFETTI_COLORS = ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa'];
const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;

let lastId = 0;
const uid = () => ++lastId;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const hueFor = (key: string) => (key.charCodeAt(0) * 47) % 360;
const keyLabel = (key: string) => (key === ' ' ? 'Space' : key);
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ---- Kid Lock helpers ---------------------------------------------------

type KeyboardLockApi = { lock?: (codes?: string[]) => Promise<void>; unlock?: () => void };
const keyboardLockApi = () => (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard;

async function enterFullscreen() {
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // Not supported (e.g. iPhone) or blocked - the in-page lock still works.
  }
  try {
    // Chrome/Edge only: captures Esc (must be held to exit), Alt+Tab, Windows key, Ctrl+W... while fullscreen.
    await keyboardLockApi()?.lock?.();
  } catch {
    // Keyboard Lock API unavailable.
  }
}

async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    return (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    return null;
  }
}

// ---- App ----------------------------------------------------------------

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [mode, setMode] = useState<Mode>('smash');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [items, setItems] = useState<SmashItem[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<Flash | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const nextTimerRef = useRef<number | undefined>(undefined);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  /** Bumped on mode switch / reset so a pending "next letter" from an old round is ignored. */
  const roundRef = useRef(0);

  const soundOn = settings.sound && !settings.muted;
  const voiceOn = settings.voice && !settings.muted;

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable (private mode) - settings just won't persist.
    }
  }, [settings]);

  useEffect(() => () => window.clearTimeout(nextTimerRef.current), []);

  // ---- Smash mode ----

  const spawn = useCallback(
    (key: string, at?: { x: number; y: number }) => {
      const pic = randomItem(KEY_MAP[key]);
      const item: SmashItem = {
        id: uid(),
        key,
        pic,
        x: at?.x ?? 10 + Math.random() * 80,
        y: at?.y ?? 24 + Math.random() * 56,
        rot: Math.random() * 30 - 15,
        hue: (hueFor(key) + Math.floor(Math.random() * 40)) % 360,
      };
      setItems((prev) => [...prev.slice(-(MAX_ITEMS - 1)), item]);
      if (soundOn) sfx.pop(noteIndex(key));
    },
    [soundOn],
  );

  const removeItem = useCallback((id: number) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

  // ---- Learn mode ----

  const newTarget = useCallback(
    (previous?: string) => {
      let letter: string;
      if (settings.order === 'abc') {
        letter = LETTERS[previous ? (LETTERS.indexOf(previous) + 1) % LETTERS.length : 0];
      } else {
        do letter = randomItem(LETTERS);
        while (letter === previous);
      }
      setTarget({ letter, pic: randomItem(KEY_MAP[letter]), id: uid() });
    },
    [settings.order],
  );

  const learnKey = useCallback(
    (key: string) => {
      if (!target || busyRef.current || !LETTERS.includes(key)) return;
      const card = cardRef.current;
      const animate = !prefersReducedMotion();

      if (key === target.letter) {
        busyRef.current = true;
        const nextStreak = streak + 1;
        setScore((n) => n + 1);
        setStreak(nextStreak);
        setFlash({ key, ok: true, id: uid() });
        if (soundOn) sfx.success();
        const big = nextStreak % 5 === 0;
        confetti({
          particleCount: big ? 180 : 80,
          spread: big ? 110 : 70,
          origin: { y: 0.5 },
          colors: CONFETTI_COLORS,
          disableForReducedMotion: true,
        });
        if (animate) {
          card?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], {
            duration: 450,
            easing: 'cubic-bezier(.34,1.56,.64,1)',
          });
        }
        const round = ++roundRef.current;
        const advance = (ms: number) => {
          if (round !== roundRef.current) return; // mode switched or score reset meanwhile
          nextTimerRef.current = window.setTimeout(() => {
            busyRef.current = false;
            newTarget(key);
          }, ms);
        };
        if (voiceOn) {
          // "Great job! Ay is for Apple!" after the chime, then move on once it has been said.
          const praise = clips.praise(Math.floor(Math.random() * PRAISE.length));
          void speak([praise, clips.isFor(key, target.pic.word)], { delay: soundOn ? 0.35 : 0 }).then((secs) =>
            advance(clamp((secs ?? 0) * 1000 + 300, 1100, 4500)),
          );
        } else {
          advance(1100);
        }
      } else {
        setStreak(0);
        setFlash({ key, ok: false, id: uid() });
        if (soundOn) sfx.wrong();
        // "That's bee. Find the letter ay." Skipped while already talking, so smashing stays calm.
        if (voiceOn) {
          void speak([clips.thats(key), clips.find(target.letter)], { ifIdle: true, delay: soundOn ? 0.3 : 0 });
        }
        if (animate) {
          card?.animate(
            [
              { transform: 'translateX(0)' },
              { transform: 'translateX(-14px)' },
              { transform: 'translateX(10px)' },
              { transform: 'translateX(-6px)' },
              { transform: 'translateX(0)' },
            ],
            { duration: 380, easing: 'ease-out' },
          );
        }
      }
    },
    [target, streak, soundOn, voiceOn, newTarget],
  );

  // Learn mode voice: warm up the common clips, then ask for each new letter.
  const learning = mode === 'learn' && screen === 'play';

  useEffect(() => {
    if (!learning || !voiceOn) return;
    preloadVoice([...PRAISE.map((_, i) => clips.praise(i)), ...LETTERS.map((letter) => clips.thats(letter))]);
  }, [learning, voiceOn]);

  useEffect(() => {
    if (!learning || !voiceOn) {
      stopVoice();
      return;
    }
    if (!target) return;
    preloadVoice([clips.isFor(target.letter, target.pic.word)]);
    void speak([clips.find(target.letter)]);
  }, [learning, voiceOn, target]);

  // ---- Input routing ----

  const handlerRef = useRef<(key: string) => void>(() => {});
  handlerRef.current = mode === 'smash' ? spawn : learnKey;
  const stateRef = useRef({ locked, screen, settingsOpen });
  stateRef.current = { locked, screen, settingsOpen };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const key = keyFromEvent(e);
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;

      if (s.locked) {
        // Swallow everything the browser lets us: F5, Ctrl+R, Ctrl+P, Ctrl+S, zoom, Tab, Backspace...
        e.preventDefault();
        e.stopPropagation();
        if (!document.fullscreenElement) void enterFullscreen();
      } else if (s.screen !== 'play' || s.settingsOpen || !key || !plain) {
        return; // unlocked: leave normal shortcuts alone for the grown-ups
      } else {
        e.preventDefault(); // stop Space scrolling / activating a focused button
      }

      if (!key || e.repeat || s.screen !== 'play') return;
      (document.activeElement as HTMLElement | null)?.blur?.();
      unlockAudio();
      handlerRef.current(key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.locked || (s.screen === 'play' && !s.settingsOpen && keyFromEvent(e))) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  }, []);

  // Auto play (handy on phones/tablets without a keyboard).
  useEffect(() => {
    if (!settings.auto || mode !== 'smash' || screen !== 'play') return;
    const timer = window.setInterval(() => handlerRef.current(randomItem(LETTERS)), AUTO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [settings.auto, mode, screen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Everything Kid Lock blocks besides keys.
  useEffect(() => {
    if (!locked) return;
    const prevent = (e: Event) => e.preventDefault();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault(); // Ctrl+scroll zoom
    };
    const onMouseButton = (e: MouseEvent) => {
      if (e.button > 2) e.preventDefault(); // mouse back/forward buttons
    };
    const onPointerUp = () => {
      if (!document.fullscreenElement) void enterFullscreen();
    };
    const onPopState = () => history.pushState(null, '', location.href); // trap the back button
    const onVisibility = async () => {
      if (document.visibilityState === 'visible') wakeLockRef.current = await requestWakeLock();
    };

    history.pushState(null, '', location.href);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('contextmenu', prevent, { capture: true });
    window.addEventListener('dragstart', prevent, { capture: true });
    window.addEventListener('selectstart', prevent, { capture: true });
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('mousedown', onMouseButton, { capture: true });
    window.addEventListener('mouseup', onMouseButton, { capture: true });
    window.addEventListener('auxclick', onMouseButton, { capture: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('contextmenu', prevent, { capture: true });
      window.removeEventListener('dragstart', prevent, { capture: true });
      window.removeEventListener('selectstart', prevent, { capture: true });
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('mousedown', onMouseButton, { capture: true });
      window.removeEventListener('mouseup', onMouseButton, { capture: true });
      window.removeEventListener('auxclick', onMouseButton, { capture: true });
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [locked]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  // ---- Actions ----

  const lock = useCallback(() => {
    unlockAudio();
    setSettingsOpen(false);
    setScreen('play');
    setLocked(true);
    void enterFullscreen();
    void requestWakeLock().then((sentinel) => {
      wakeLockRef.current = sentinel;
    });
  }, []);

  const unlock = useCallback(() => {
    setLocked(false);
    keyboardLockApi()?.unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    void wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    if (soundOn) sfx.tap();
  }, [soundOn]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    window.clearTimeout(nextTimerRef.current);
    busyRef.current = false;
    roundRef.current++;
    stopVoice();
    unlockAudio();
    setItems([]);
    setFlash(null);
    setMode(next);
    if (next === 'learn' && screen === 'play') {
      setStreak(0);
      newTarget();
    }
    if (soundOn) sfx.tap();
  };

  const start = (withLock: boolean) => {
    unlockAudio();
    if (mode === 'learn') newTarget();
    setScreen('play');
    if (soundOn) sfx.tap();
    if (withLock) lock();
  };

  const resetScore = () => {
    window.clearTimeout(nextTimerRef.current);
    busyRef.current = false;
    roundRef.current++;
    setScore(0);
    setStreak(0);
    newTarget(settings.order === 'abc' ? undefined : target?.letter);
  };

  const toggleMute = () => {
    update({ muted: !settings.muted });
    if (settings.muted && settings.sound) sfx.tap();
  };

  const onSurfacePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (mode !== 'smash' || screen !== 'play') return;
    unlockAudio();
    const rect = e.currentTarget.getBoundingClientRect();
    spawn(randomItem(LETTERS), {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100, 18, 86),
    });
  };

  const hue = mode === 'learn' && target ? hueFor(target.letter) : 232;

  return (
    <div className="app-bg fixed inset-0 overflow-hidden text-white" style={{ '--hue': hue } as CSSProperties}>
      {screen === 'play' && (
        <main
          className={`absolute inset-0 touch-none ${mode === 'smash' ? 'cursor-pointer' : ''}`}
          onPointerDown={onSurfacePointerDown}
        >
          {mode === 'smash' ? (
            <SmashView items={items} onDone={removeItem} />
          ) : (
            target && (
              <LearnView
                target={target}
                score={score}
                streak={streak}
                hint={settings.hint}
                flash={flash}
                cardRef={cardRef}
                locked={locked}
                onPress={(key) => {
                  unlockAudio();
                  learnKey(key);
                }}
                onReset={resetScore}
              />
            )
          )}
        </main>
      )}

      {screen === 'play' &&
        (locked ? (
          <LockedBar onUnlock={unlock} />
        ) : (
          <TopBar
            mode={mode}
            settings={settings}
            onMode={switchMode}
            onToggleAuto={() => update({ auto: !settings.auto })}
            onToggleMute={toggleMute}
            onOpenSettings={() => setSettingsOpen(true)}
            onLock={lock}
          />
        ))}

      {screen === 'start' && <StartScreen mode={mode} onMode={setMode} onStart={start} />}

      {locked && !isFullscreen && fullscreenSupported && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-4">
          <span className="fade-in rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10 backdrop-blur">
            Tap or press any key to go back to full screen
          </span>
        </div>
      )}

      {settingsOpen && !locked && (
        <SettingsSheet settings={settings} update={update} onClose={() => setSettingsOpen(false)} onLock={lock} />
      )}
    </div>
  );
}

// ---- Views --------------------------------------------------------------

function SmashView({ items, onDone }: { items: SmashItem[]; onDone: (id: number) => void }) {
  return (
    <>
      {items.length === 0 && (
        <div className="fade-in pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <div className="emoji floaty text-7xl sm:text-8xl" aria-hidden>
              ⌨️
            </div>
            <p className="mt-6 font-display text-2xl font-semibold text-white/55 sm:text-3xl">
              Press any key or tap the screen
            </p>
          </div>
        </div>
      )}
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
        >
          <div
            className="smash-item relative flex flex-col items-center"
            style={{ '--r': `${item.rot}deg`, '--h': item.hue } as CSSProperties}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) onDone(item.id);
            }}
          >
            <span className="smash-burst" aria-hidden />
            <span className="emoji text-[clamp(4.5rem,13vmin,8.5rem)]">{item.pic.emoji}</span>
            <span className="mt-2 flex items-baseline gap-2 rounded-full bg-white px-3.5 py-1 shadow-[0_8px_24px_rgb(0_0_0/0.35)]">
              <span
                className="font-display text-2xl font-bold leading-none"
                style={{ color: `hsl(${item.hue} 80% 40%)` }}
              >
                {keyLabel(item.key)}
              </span>
              {item.key !== ' ' && <span className="text-sm font-bold text-slate-600">{item.pic.word}</span>}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

function LearnView({
  target,
  score,
  streak,
  hint,
  flash,
  cardRef,
  locked,
  onPress,
  onReset,
}: {
  target: Target;
  score: number;
  streak: number;
  hint: boolean;
  flash: Flash | null;
  cardRef: RefObject<HTMLDivElement | null>;
  locked: boolean;
  onPress: (key: string) => void;
  onReset: () => void;
}) {
  const accent = `hsl(${hueFor(target.letter)} 90% 70%)`;
  const word = target.pic.word;

  return (
    <div className="absolute inset-0 flex flex-col items-center px-3 pt-32 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-24">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-[clamp(0.75rem,3vmin,2rem)]">
        <div className="flex items-center gap-2">
          <Stat icon={<Trophy className="size-5 text-amber-300" />} label="Score" value={score} />
          <Stat icon={<Flame className="size-5 text-orange-400" />} label="Streak" value={streak} />
          {!locked && (
            <IconButton label="Reset score" onClick={onReset}>
              <RotateCcw />
            </IconButton>
          )}
        </div>

        <div
          ref={cardRef}
          className="w-[min(22rem,84vw)] rounded-[2rem] bg-white/[0.07] px-6 py-[clamp(1rem,4vmin,2rem)] text-center shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
        >
          <div key={target.id} className="card-in">
            <div className="emoji text-[clamp(5rem,20vmin,10rem)]" aria-hidden>
              {target.pic.emoji}
            </div>
            <p className="mt-3 font-display text-[clamp(1.5rem,4.5vmin,2.25rem)] font-semibold text-white/85">
              <span style={{ color: accent }}>{word.slice(0, 1)}</span>
              {word.slice(1)}
            </p>
          </div>
        </div>

        <div className="text-center font-display" aria-live="polite">
          <p className="text-base font-semibold uppercase tracking-[0.2em] text-white/50">Find the letter</p>
          <p className="mt-1 text-[clamp(3rem,11vmin,5.5rem)] font-bold leading-none" style={{ color: accent }}>
            {target.letter}
            <span className="ml-3 text-[0.65em] text-white/35">{target.letter.toLowerCase()}</span>
          </p>
        </div>
      </div>

      <OnScreenKeyboard target={hint ? target.letter : null} flash={flash} onPress={onPress} />
    </div>
  );
}

function OnScreenKeyboard({
  target,
  flash,
  onPress,
}: {
  target: string | null;
  flash: Flash | null;
  onPress: (key: string) => void;
}) {
  return (
    <div className="mt-4 flex w-full max-w-3xl flex-col items-center gap-[clamp(4px,0.9vmin,8px)]" aria-label="Keyboard">
      {KEYBOARD_ROWS.map((row) => (
        <div key={row} className="flex justify-center gap-[clamp(3px,0.8vw,8px)]">
          {row.split('').map((key) => {
            const f = flash?.key === key ? flash : null;
            const classes = ['kb-key', key === target && 'kb-target', f && (f.ok ? 'kb-ok' : 'kb-bad')]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={f ? `${key}-${f.id}` : key}
                type="button"
                tabIndex={-1}
                aria-label={key}
                className={classes}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onPress(key);
                }}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function StartScreen({
  mode,
  onMode,
  onStart,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  onStart: (withLock: boolean) => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto p-6">
      <div className="sheet-in w-full max-w-lg text-center">
        <div className="emoji flex justify-center gap-3 text-6xl sm:text-7xl" aria-hidden>
          {['🦁', '🍎', '🚀', '🐙'].map((emoji, i) => (
            <span key={emoji} className="floaty" style={{ animationDelay: `${i * 0.3}s` }}>
              {emoji}
            </span>
          ))}
        </div>
        <h1 className="mt-8 font-display text-5xl font-bold tracking-tight sm:text-6xl">Keyboard Smasher</h1>
        <p className="mt-3 text-lg font-medium text-white/65">Press keys, see pictures, hear fun sounds.</p>

        <div className="mt-8 flex justify-center">
          <ModeSwitch mode={mode} onChange={onMode} />
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" className="btn-primary h-14 px-7 text-lg" onClick={() => onStart(true)}>
            <Lock className="size-5" />
            Start with Kid Lock
          </button>
          <button type="button" className="btn-secondary h-14 px-7 text-lg" onClick={() => onStart(false)}>
            Just play
          </button>
        </div>
        <p className="mx-auto mt-5 max-w-sm text-sm text-white/45">
          Kid Lock goes full screen and blocks shortcuts so little hands can’t leave the game. Hold the{' '}
          <Lock className="inline size-3.5 align-[-2px]" /> button for 2 seconds to exit.
        </p>
      </div>
    </div>
  );
}

// ---- Chrome -------------------------------------------------------------

function TopBar({
  mode,
  settings,
  onMode,
  onToggleAuto,
  onToggleMute,
  onOpenSettings,
  onLock,
}: {
  mode: Mode;
  settings: Settings;
  onMode: (mode: Mode) => void;
  onToggleAuto: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onLock: () => void;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-5">
      <div className="pointer-events-auto flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-linear-to-br from-indigo-500 to-pink-500 shadow-lg">
          <Zap className="size-5 fill-white text-white" />
        </span>
        <span className="hidden font-display text-xl font-bold tracking-tight lg:block">Keyboard Smasher</span>
      </div>

      <div className="pointer-events-auto order-last flex w-full justify-center sm:absolute sm:left-1/2 sm:w-auto sm:-translate-x-1/2">
        <ModeSwitch mode={mode} onChange={onMode} />
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {mode === 'smash' && (
          <IconButton
            label={settings.auto ? 'Stop auto play' : 'Auto play'}
            pressed={settings.auto}
            accent
            onClick={onToggleAuto}
          >
            <Zap className={settings.auto ? 'fill-slate-900' : ''} />
          </IconButton>
        )}
        <IconButton label={settings.muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>
          {settings.muted ? <VolumeX /> : <Volume2 />}
        </IconButton>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <SettingsIcon />
        </IconButton>
        <button type="button" className="btn-primary h-11 px-4" onClick={onLock} title="Kid Lock">
          <Lock className="size-4" />
          <span className="hidden sm:inline">Kid Lock</span>
        </button>
      </div>
    </header>
  );
}

function LockedBar({ onUnlock }: { onUnlock: () => void }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-end p-3 sm:p-5">
      <HoldToUnlock onUnlock={onUnlock} />
    </header>
  );
}

function HoldToUnlock({ onUnlock }: { onUnlock: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const circumference = 2 * Math.PI * 21;

  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="pointer-events-auto flex items-center gap-3">
      <span
        className={`text-sm font-semibold text-white/60 transition-opacity ${holding ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden
      >
        Keep holding…
      </span>
      <button
        type="button"
        aria-label="Hold for 2 seconds to unlock"
        title="Hold for 2 seconds to unlock"
        className="relative grid size-12 touch-none place-items-center rounded-full bg-black/30 text-white/50 ring-1 ring-white/10 backdrop-blur-md transition select-none hover:text-white/80"
        onPointerDown={(e) => {
          e.preventDefault();
          setHolding(true);
          timer.current = window.setTimeout(() => {
            setHolding(false);
            onUnlock();
          }, HOLD_TO_UNLOCK_MS);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
      >
        <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle
            cx="24"
            cy="24"
            r="21"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={holding ? 0 : circumference}
            style={{
              transition: holding
                ? `stroke-dashoffset ${HOLD_TO_UNLOCK_MS}ms linear`
                : 'stroke-dashoffset 200ms ease-out',
            }}
          />
        </svg>
        <Lock className="size-5" />
      </button>
    </div>
  );
}

function SettingsSheet({
  settings,
  update,
  onClose,
  onLock,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onLock: () => void;
}) {
  return (
    <div
      className="fade-in fixed inset-0 z-40 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="sheet-in max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-slate-900/95 p-5 shadow-2xl ring-1 ring-white/10 sm:p-6"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 id="settings-title" className="font-display text-2xl font-bold">
            Settings
          </h2>
          <IconButton label="Close settings" onClick={onClose} autoFocus>
            <X />
          </IconButton>
        </div>

        <SectionTitle>Sound</SectionTitle>
        <Toggle
          label="Sound effects"
          description="Pops, chimes and gentle boops"
          checked={settings.sound}
          onChange={(sound) => update({ sound })}
        />

        <SectionTitle>Learn mode</SectionTitle>
        <Segmented
          label="Letter order"
          value={settings.order}
          options={[
            ['random', 'Random'],
            ['abc', 'A to Z'],
          ]}
          onChange={(order) => update({ order })}
        />
        <Toggle
          label="Keyboard hint"
          description="Lights up the key to press"
          checked={settings.hint}
          onChange={(hint) => update({ hint })}
        />
        <Toggle
          label="Voice"
          description="Says the letter to find and cheers when it's right"
          checked={settings.voice}
          onChange={(voice) => update({ voice })}
        />

        <SectionTitle>Kid Lock</SectionTitle>
        <p className="px-3 text-sm leading-relaxed text-white/60">
          Goes full screen and blocks keyboard shortcuts, right-click, zoom, refresh and the back button. In Chrome and
          Edge it also captures Esc and most system keys like Alt+Tab and the Windows key. Hold the lock button for 2
          seconds to exit. No website can block Ctrl+Alt+Del.
        </p>
        <button type="button" className="btn-primary mt-4 h-12 w-full" onClick={onLock}>
          <Lock className="size-4" />
          Start Kid Lock
        </button>
      </div>
    </div>
  );
}

// ---- Small components ---------------------------------------------------

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: [Mode, string, ReactNode][] = [
    ['smash', 'Smash', <Keyboard className="size-4" />],
    ['learn', 'Learn', <GraduationCap className="size-4" />],
  ];
  return (
    <div role="group" aria-label="Game mode" className="inline-flex rounded-2xl bg-black/30 p-1 ring-1 ring-white/10 backdrop-blur-md">
      {options.map(([value, text, icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={`flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold transition-all ${
            mode === value ? 'bg-white text-slate-900 shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          {icon}
          {text}
        </button>
      ))}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  pressed,
  accent,
  autoFocus,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  accent?: boolean;
  autoFocus?: boolean;
  children: ReactNode;
}) {
  const highlighted = accent && pressed;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      autoFocus={autoFocus}
      onClick={onClick}
      className={`grid size-11 shrink-0 place-items-center rounded-2xl ring-1 backdrop-blur-md transition active:scale-95 [&>svg]:size-5 ${
        highlighted
          ? 'bg-amber-300 text-slate-900 ring-amber-200'
          : 'bg-black/30 text-white/75 ring-white/10 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-2xl bg-white/[0.07] px-4 ring-1 ring-white/10">
      {icon}
      <span className="text-xs font-bold uppercase tracking-wider text-white/50">{label}</span>
      <span className="min-w-[1.5ch] font-display text-xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 mb-1 px-3 text-xs font-bold uppercase tracking-[0.15em] text-white/40">{children}</h3>;
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl px-3 py-3 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span>
        <span className="block font-semibold">{label}</span>
        {description && <span className="block text-sm text-white/55">{description}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-400' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-3">
      <span className="font-semibold">{label}</span>
      <div role="group" aria-label={label} className="inline-flex rounded-xl bg-white/[0.08] p-1">
        {options.map(([optionValue, text]) => (
          <button
            key={optionValue}
            type="button"
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              value === optionValue ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

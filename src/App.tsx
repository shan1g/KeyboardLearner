/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { Keyboard, Maximize, Minimize, Play, RefreshCw, Trophy, Zap } from 'lucide-react';

// Letter to Emoji Mapping (Multiple emojis per letter)
const letterMap: Record<string, string[]> = {
  A: ["🍎", "🐜", "🎨"], 
  B: ["🐻", "🐝", "🎈"], 
  C: ["🐱", "🍰", "🚗"], 
  D: ["🐶", "🍩", "🥁"], 
  E: ["🐘", "🥚", "🔌"], 
  F: ["🐟", "🐠", "🍟"], 
  G: ["🦒", "🍇", "🎸"], 
  H: ["🎩", "👒", "🧢", "🏠"],
  I: ["🍦", "🦎", "🇮"], 
  J: ["🧃", "🕹️", "🐆"], 
  K: ["🐨", "🪁", "🔑"], 
  L: ["🦁", "🍋", "🍭"], 
  M: ["🌙", "🌑", "🐭", "🍄"], 
  N: ["👃", "🥜", "🍱"], 
  O: ["🐙", "🍊", "🦉"], 
  P: ["🐼", "🍕", "🐧"],
  Q: ["👑", "❓", "🧥"], 
  R: ["🤖", "🚀", "🌈"], 
  S: ["🍓", "🐍", "☀️"], 
  T: ["🐯", "🌮", "🚂"], 
  U: ["🦄", "☂️", "🛸"], 
  V: ["🎻", "🌋", "🚐"], 
  W: ["🐳", "🍉", "⌚"], 
  X: ["🎹", "❌", "🦴"], // Using piano/bone for X-ray/Xylophone vibes
  Y: ["🪀", "🧶", "⛵"], 
  Z: ["🦓", "⚡", "💤"],
  " ": ["🚀", "🛸", "🌌", "🛰️"] // Spacebar support
};

const letters = Object.keys(letterMap).filter(k => k !== " ");

type Mode = 'smash' | 'learn';

interface SmashItem {
  id: number;
  emoji: string;
  x: number;
  y: number;
  letter: string;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('smash');
  const [currentLetter, setCurrentLetter] = useState<string>('');
  const [score, setScore] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [smashItems, setSmashItems] = useState<SmashItem[]>([]);
  const [bgColor, setBgColor] = useState('#0f172a'); // Dark Slate 900
  const containerRef = useRef<HTMLDivElement>(null);
  const learnDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Initialize Learn Mode
  const pickNextLetter = useCallback(() => {
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    setCurrentLetter(randomLetter);
    // Change background color slightly (Darker hues)
    const hue = Math.floor(Math.random() * 360);
    setBgColor(`hsl(${hue}, 40%, 10%)`);
  }, []);

  useEffect(() => {
    if (mode === 'learn') {
      pickNextLetter();
    }
  }, [mode, pickNextLetter]);

  const handleSmash = useCallback((key: string) => {
    const letter = key === " " ? " " : key.toUpperCase();
    if (letterMap[letter]) {
      const emojis = letterMap[letter];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      const newItem: SmashItem = {
        id: Date.now(),
        emoji: randomEmoji,
        x: Math.random() * 80 + 10, // 10% to 90%
        y: Math.random() * 80 + 10,
        letter: letter === " " ? "SPACE" : letter
      };
      setSmashItems(prev => [...prev, newItem]);

      // Remove after animation
      setTimeout(() => {
        setSmashItems(prev => prev.filter(item => item.id !== newItem.id));
      }, 2000);
    }
  }, []);

  const handleLearn = useCallback((key: string) => {
    const pressed = key.toUpperCase();
    if (pressed === currentLetter) {
      // Success
      setScore(prev => prev + 1);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      if (learnDisplayRef.current) {
        gsap.timeline()
          .to(learnDisplayRef.current, { scale: 1.2, duration: 0.2, ease: "power2.out" })
          .to(learnDisplayRef.current, { scale: 1, duration: 0.5, ease: "bounce.out" });
      }

      pickNextLetter();
    } else if (letters.includes(pressed)) {
      // Incorrect
      if (learnDisplayRef.current) {
        gsap.to(learnDisplayRef.current, {
          x: 10,
          duration: 0.1,
          repeat: 5,
          yoyo: true,
          ease: "power2.inOut",
          onComplete: () => gsap.set(learnDisplayRef.current, { x: 0 })
        });
      }
    }
  }, [currentLetter, pickNextLetter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode === 'smash') {
        handleSmash(e.key);
      } else {
        handleLearn(e.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, handleSmash, handleLearn]);

  // GSAP Animation for Smash Items
  useEffect(() => {
    smashItems.forEach(item => {
      const el = document.getElementById(`emoji-${item.id}`);
      if (el && !el.dataset.animated) {
        el.dataset.animated = "true";
        gsap.timeline()
          .from(el, {
            scale: 0,
            rotation: Math.random() * 360 - 180,
            duration: 0.5,
            ease: "elastic.out(1, 0.3)"
          })
          .to(el, {
            y: "-=50",
            opacity: 0,
            duration: 1,
            delay: 0.5,
            ease: "power2.in"
          });
      }
    });
  }, [smashItems]);

  return (
    <div 
      ref={containerRef}
      className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: bgColor }}
    >
      {/* Header / Controls */}
      <div className="fixed top-8 left-0 right-0 flex flex-col items-center gap-4 z-50">
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter flex items-center gap-3 drop-shadow-2xl">
          <Zap className="w-10 h-10 text-yellow-400 fill-yellow-400" />
          KEYBOARD SMASHER
        </h1>
        
        <div className="flex items-center bg-slate-800/50 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-2xl">
          <button
            onClick={() => setMode('smash')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mode === 'smash' 
                ? 'bg-white text-slate-900 shadow-lg scale-105' 
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            SMASH MODE
          </button>
          <button
            onClick={() => setMode('learn')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mode === 'learn' 
                ? 'bg-white text-slate-900 shadow-lg scale-105' 
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Play className="w-4 h-4" />
            LEARN MODE
          </button>
        </div>
      </div>

      {/* Fullscreen Toggle */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-8 right-8 z-50 p-3 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl text-slate-300 hover:text-white transition-all"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
      </button>

      {/* Main Game Area */}
      <div className="relative w-full h-full flex items-center justify-center">
        {mode === 'smash' ? (
          <div className="w-full h-screen relative">
            {smashItems.map(item => (
              <div
                key={item.id}
                id={`emoji-${item.id}`}
                className="absolute pointer-events-none select-none flex flex-col items-center"
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
              >
                <span className="text-6xl md:text-8xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{item.emoji}</span>
                <span className="text-xl font-black text-white mt-2 bg-slate-800/80 px-3 py-1 rounded-full shadow-xl border border-slate-700">
                  {item.letter}
                </span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <p className="text-2xl font-bold text-slate-400 uppercase tracking-widest">
                Smash any key!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div 
              ref={learnDisplayRef}
              className="w-64 h-64 md:w-80 md:h-80 bg-slate-800 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center border-4 border-slate-700 relative"
            >
              <span className="text-9xl md:text-[10rem] leading-none mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                {currentLetter && letterMap[currentLetter] ? letterMap[currentLetter][0] : "❓"}
              </span>
              <div className="absolute -bottom-6 bg-white text-slate-900 px-8 py-3 rounded-2xl shadow-2xl">
                <span className="text-3xl font-black tracking-widest uppercase">PRESS {currentLetter}</span>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-8">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Score</span>
                <div className="bg-slate-800 px-6 py-2 rounded-xl shadow-md flex items-center gap-2 border border-slate-700">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="text-2xl font-black text-white">{score}</span>
                </div>
              </div>
              
              <button 
                onClick={() => { setScore(0); pickNextLetter(); }}
                className="p-4 bg-slate-800 rounded-xl shadow-md hover:shadow-lg transition-all border border-slate-700 text-slate-400 hover:text-white"
              >
                <RefreshCw className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="fixed bottom-8 text-slate-500 text-sm font-medium tracking-wide">
        {mode === 'smash' 
          ? "Tap any letter or SPACE on your keyboard to see magic happen!" 
          : "Can you find the letter on your keyboard?"}
      </div>
    </div>
  );
}

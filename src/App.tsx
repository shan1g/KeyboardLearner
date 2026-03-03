/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { Keyboard, Maximize, Minimize, Play, RefreshCw, Trophy, Zap } from 'lucide-react';

// Letter to Emoji Mapping
const letterMap: Record<string, string> = {
  A: "🍎", B: "🐻", C: "🐱", D: "🐶", E: "🐘", F: "🦊", G: "🦒", H: "🐹",
  I: "🍦", J: "🧃", K: "🐨", L: "🦁", M: "🐵", N: "🥜", O: "🐙", P: "🐼",
  Q: "👑", R: "🤖", S: "🍓", T: "🐯", U: "🦄", V: "🎻", W: "🐳", X: "❌",
  Y: "🧶", Z: "🦓"
};

const letters = Object.keys(letterMap);

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
  const [bgColor, setBgColor] = useState('#f8fafc');
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
    // Change background color slightly
    const hue = Math.floor(Math.random() * 360);
    setBgColor(`hsl(${hue}, 70%, 95%)`);
  }, []);

  useEffect(() => {
    if (mode === 'learn') {
      pickNextLetter();
    }
  }, [mode, pickNextLetter]);

  const handleSmash = useCallback((key: string) => {
    const letter = key.toUpperCase();
    if (letterMap[letter]) {
      const newItem: SmashItem = {
        id: Date.now(),
        emoji: letterMap[letter],
        x: Math.random() * 80 + 10, // 10% to 90%
        y: Math.random() * 80 + 10,
        letter: letter
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
        <h1 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
          <Zap className="w-10 h-10 text-yellow-500 fill-yellow-500" />
          KEYBOARD SMASHER
        </h1>
        
        <div className="flex items-center bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-xl">
          <button
            onClick={() => setMode('smash')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mode === 'smash' 
                ? 'bg-slate-800 text-white shadow-lg' 
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            SMASH MODE
          </button>
          <button
            onClick={() => setMode('learn')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mode === 'learn' 
                ? 'bg-slate-800 text-white shadow-lg' 
                : 'text-slate-600 hover:bg-slate-200'
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
        className="fixed top-8 right-8 z-50 p-3 bg-white/50 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl text-slate-600 hover:text-slate-900 transition-all"
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
                <span className="text-6xl md:text-8xl">{item.emoji}</span>
                <span className="text-xl font-black text-slate-800 mt-2 bg-white/80 px-3 py-1 rounded-full shadow-sm">
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
              className="w-64 h-64 md:w-80 md:h-80 bg-white rounded-[3rem] shadow-2xl flex flex-col items-center justify-center border-4 border-slate-100 relative"
            >
              <span className="text-9xl md:text-[10rem] leading-none mb-4">
                {letterMap[currentLetter]}
              </span>
              <div className="absolute -bottom-6 bg-slate-800 text-white px-8 py-3 rounded-2xl shadow-xl">
                <span className="text-3xl font-black tracking-widest">PRESS {currentLetter}</span>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-8">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Score</span>
                <div className="bg-white px-6 py-2 rounded-xl shadow-md flex items-center gap-2 border border-slate-100">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl font-black text-slate-800">{score}</span>
                </div>
              </div>
              
              <button 
                onClick={() => { setScore(0); pickNextLetter(); }}
                className="p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-slate-100 text-slate-600 hover:text-slate-900"
              >
                <RefreshCw className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="fixed bottom-8 text-slate-400 text-sm font-medium tracking-wide">
        {mode === 'smash' 
          ? "Tap any letter on your keyboard to see magic happen!" 
          : "Can you find the letter on your keyboard?"}
      </div>
    </div>
  );
}

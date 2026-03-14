import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';
import { motion } from 'motion/react';

export default function PomodoroTimer() {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive) {
      interval = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            setIsActive(false);
            const nextMode = mode === 'work' ? 'break' : 'work';
            setMode(nextMode);
            setMinutes(nextMode === 'work' ? 25 : 5);
            // Play sound or notification here if possible
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, minutes, seconds, mode]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setMinutes(mode === 'work' ? 25 : 5);
    setSeconds(0);
  };

  const switchMode = (newMode: 'work' | 'break') => {
    setIsActive(false);
    setMode(newMode);
    setMinutes(newMode === 'work' ? 25 : 5);
    setSeconds(0);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 p-4">
      <div className="flex space-x-3 mb-2">
        <button
          onClick={() => switchMode('work')}
          className={`px-5 py-2 rounded-2xl flex items-center gap-2 transition-all text-sm font-bold ${
            mode === 'work' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
              : 'bg-white text-slate-600 border border-slate-100'
          }`}
        >
          <Brain size={16} />
          Focus
        </button>
        <button
          onClick={() => switchMode('break')}
          className={`px-5 py-2 rounded-2xl flex items-center gap-2 transition-all text-sm font-bold ${
            mode === 'break' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
              : 'bg-white text-slate-600 border border-slate-100'
          }`}
        >
          <Coffee size={16} />
          Break
        </button>
      </div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-56 h-56 flex items-center justify-center rounded-full border-[12px] border-slate-50 bg-white shadow-xl"
      >
        <div className="text-5xl font-mono font-black text-slate-800 tracking-tighter">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </motion.div>

      <div className="flex space-x-6">
        <button
          onClick={toggleTimer}
          className={`p-5 rounded-3xl transition-all shadow-lg ${
            isActive 
              ? 'bg-orange-100 text-orange-600' 
              : 'bg-indigo-600 text-white shadow-indigo-200'
          }`}
        >
          {isActive ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
        </button>
        <button
          onClick={resetTimer}
          className="p-5 rounded-3xl bg-slate-100 text-slate-600 active:bg-slate-200 transition-all"
        >
          <RotateCcw size={28} />
        </button>
      </div>

      <div className="text-center text-slate-400 px-8">
        <p className="text-xs font-medium leading-relaxed">
          {mode === 'work' 
            ? "Stay focused on your tasks. You've got this!" 
            : "Time to recharge. Take a deep breath."}
        </p>
      </div>
    </div>
  );
}

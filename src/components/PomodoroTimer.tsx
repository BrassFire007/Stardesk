import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';
import { motion } from 'motion/react';

export default function PomodoroTimer() {
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            setIsActive(false);
            const nextMode = mode === 'work' ? 'break' : 'work';
            setMode(nextMode);
            return nextMode === 'work' ? 25 * 60 : 5 * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, mode]);

  const toggleTimer = React.useCallback(() => setIsActive(prev => !prev), []);

  const resetTimer = React.useCallback(() => {
    setIsActive(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
  }, [mode]);

  const switchMode = React.useCallback((newMode: 'work' | 'break') => {
    setIsActive(false);
    setMode(newMode);
    setTimeLeft(newMode === 'work' ? 25 * 60 : 5 * 60);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const totalTime = mode === 'work' ? 25 * 60 : 5 * 60;
  const percentage = timeLeft / totalTime;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);

  return (
    <div className="flex flex-col items-center justify-center space-y-6 p-4">
      <div className="flex space-x-3 mb-2">
        <button
          onClick={() => switchMode('work')}
          className={`px-5 py-2 rounded-2xl flex items-center gap-2 transition-all text-sm font-bold ${
            mode === 'work' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
          }`}
        >
          <Brain size={16} />
          Focus
        </button>
        <button
          onClick={() => switchMode('break')}
          className={`px-5 py-2 rounded-2xl flex items-center gap-2 transition-all text-sm font-bold ${
            mode === 'break' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none' 
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
          }`}
        >
          <Coffee size={16} />
          Break
        </button>
      </div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-64 h-64 flex items-center justify-center"
      >
        {/* Progress Ring SVG */}
        <svg className="absolute w-full h-full -rotate-90 transform" viewBox="0 0 220 220">
          {/* Background Circle */}
          <circle
            cx="110"
            cy="110"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-slate-100 dark:text-slate-800"
          />
          {/* Progress Circle */}
          <motion.circle
            cx="110"
            cy="110"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: "linear" }}
            strokeLinecap="round"
            className={mode === 'work' ? 'text-indigo-600' : 'text-emerald-600'}
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center w-52 h-52 rounded-full bg-white dark:bg-slate-900 shadow-inner">
          <div className="text-5xl font-mono font-black text-slate-800 dark:text-slate-100 tracking-tighter">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
            {mode === 'work' ? 'Focusing' : 'Resting'}
          </div>
        </div>
      </motion.div>

      <div className="flex space-x-6">
        <button
          onClick={toggleTimer}
          className={`p-5 rounded-3xl transition-all shadow-lg ${
            isActive 
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' 
              : 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none'
          }`}
        >
          {isActive ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
        </button>
        <button
          onClick={resetTimer}
          className="p-5 rounded-3xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-600 transition-all"
        >
          <RotateCcw size={28} />
        </button>
      </div>

      <div className="text-center text-slate-400 dark:text-slate-500 px-8">
        <p className="text-xs font-medium leading-relaxed">
          {mode === 'work' 
            ? "Stay focused on your tasks. You've got this!" 
            : "Time to recharge. Take a deep breath."}
        </p>
      </div>
    </div>
  );
}

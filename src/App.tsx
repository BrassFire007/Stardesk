/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Timer, 
  Trophy, 
  Home, 
  ChevronLeft,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import HomeworkTracker from './components/HomeworkTracker';
import PomodoroTimer from './components/PomodoroTimer';
import ExamTracker from './components/ExamTracker';
import { View } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [showQuote, setShowQuote] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'homework':
        return <HomeworkTracker />;
      case 'timer':
        return <PomodoroTimer />;
      case 'exams':
        return <ExamTracker />;
      default:
        return (
          <div className="flex flex-col gap-4 p-4">
            <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg mb-2">
              <h3 className="text-2xl font-bold mb-1">Hello Student!</h3>
              <p className="text-indigo-100 text-sm">Ready to crush your goals today?</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <MobileMenuCard 
                title="Homework" 
                icon={<BookOpen size={28} />}
                color="bg-white text-indigo-600"
                onClick={() => setCurrentView('homework')}
              />
              <MobileMenuCard 
                title="Timer" 
                icon={<Timer size={28} />}
                color="bg-white text-emerald-600"
                onClick={() => setCurrentView('timer')}
              />
            </div>
            
            <MobileMenuCard 
              title="Exam Performance" 
              icon={<Trophy size={28} />}
              color="bg-white text-amber-600"
              fullWidth
              onClick={() => setCurrentView('exams')}
            />

            <div className="mt-4 p-4 bg-slate-100 rounded-2xl border border-dashed border-slate-300 text-center">
              <p className="text-xs text-slate-500 italic">"The secret of getting ahead is getting started."</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex justify-center bg-slate-200 min-h-screen">
      {/* Mobile Container Emulator */}
      <div className="w-full max-w-[450px] bg-[#F8F9FC] min-h-screen flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Quote Bottom Sheet */}
        <AnimatePresence>
          {showQuote && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowQuote(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative bg-white pt-2 pb-10 px-8 rounded-t-[40px] shadow-2xl w-full max-w-[450px] text-center border-t border-slate-100"
              >
                {/* Drag Handle */}
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-2 mb-8" />
                
                <div className="bg-indigo-50 w-20 h-20 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <Sparkles className="text-indigo-600" size={40} />
                </div>
                
                <blockquote className="text-2xl font-black text-slate-800 leading-tight mb-4 px-4">
                  "Made by student for students"
                </blockquote>
                
                <div className="flex items-center justify-center gap-2 mb-10">
                  <div className="h-px w-8 bg-slate-200" />
                  <cite className="text-indigo-600 font-bold not-italic text-sm">
                    Chippa Shreyansh
                  </cite>
                  <div className="h-px w-8 bg-slate-200" />
                </div>

                <button
                  onClick={() => setShowQuote(false)}
                  className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black text-lg active:scale-[0.97] transition-all shadow-xl shadow-slate-200 uppercase tracking-wider"
                >
                  awesome!
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Status Bar Mockup */}
        <div className="h-6 bg-white flex items-center justify-between px-6 text-[10px] font-bold text-slate-400">
          <span>9:41</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full border border-slate-300" />
            <div className="w-3 h-3 rounded-full border border-slate-300" />
            <div className="w-5 h-3 rounded-sm border border-slate-300" />
          </div>
        </div>

        {/* Header */}
        <header className="bg-white px-6 py-4 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer active:opacity-70 transition-opacity"
            onClick={() => {
              setCurrentView('home');
              setShowQuote(true);
            }}
          >
            <div className="bg-indigo-600 p-1.5 rounded-xl text-white">
              <GraduationCap size={20} />
            </div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800">
              stardesk
            </h1>
          </div>
          <button className="p-2 text-slate-400 hover:text-indigo-600">
            <Sparkles size={20} />
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="px-6 pt-4">
                <h2 className="text-2xl font-black text-slate-800 capitalize">
                  {currentView === 'home' ? 'Dashboard' : currentView}
                </h2>
              </div>
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 py-3 flex justify-between items-center z-40">
          <NavButton 
            active={currentView === 'home'} 
            onClick={() => setCurrentView('home')} 
            icon={<Home size={24} />} 
            label="Home" 
          />
          <NavButton 
            active={currentView === 'homework'} 
            onClick={() => setCurrentView('homework')} 
            icon={<BookOpen size={24} />} 
            label="Tasks" 
          />
          <NavButton 
            active={currentView === 'timer'} 
            onClick={() => setCurrentView('timer')} 
            icon={<Timer size={24} />} 
            label="Focus" 
          />
          <NavButton 
            active={currentView === 'exams'} 
            onClick={() => setCurrentView('exams')} 
            icon={<Trophy size={24} />} 
            label="Exams" 
          />
        </nav>

        {/* Android Navigation Bar Mockup */}
        <div className="h-4 bg-white flex justify-center items-center pb-1">
          <div className="w-24 h-1 bg-slate-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function MobileMenuCard({ title, icon, color, onClick, fullWidth }: { 
  title: string; 
  icon: React.ReactNode; 
  color: string;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${color} ${fullWidth ? 'w-full' : 'flex-1'} p-6 rounded-[28px] shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3 text-center transition-all active:shadow-inner`}
    >
      <div className="p-3 rounded-2xl bg-slate-50">
        {icon}
      </div>
      <span className="font-bold text-sm text-slate-700">{title}</span>
    </motion.button>
  );
}

function NavButton({ active, onClick, icon, label }: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}
    >
      <motion.div
        animate={{ scale: active ? 1.1 : 1, y: active ? -2 : 0 }}
      >
        {icon}
      </motion.div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator"
          className="w-1 h-1 rounded-full bg-indigo-600 mt-0.5"
        />
      )}
    </button>
  );
}


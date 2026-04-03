/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { App as CapacitorApp } from '@capacitor/app';
import { 
  BookOpen, 
  Timer, 
  Trophy, 
  Home, 
  User as UserIcon,
  ChevronLeft,
  GraduationCap,
  MessageCircleQuestion,
  Sparkles,
  Moon,
  Sun,
  MessageSquare,
  LogIn
} from 'lucide-react';
import { auth, db, onAuthStateChanged, FirebaseUser, signInWithPopup, googleProvider, doc, setDoc, serverTimestamp, handleFirestoreError, OperationType } from './firebase';
import HomeworkTracker from './components/HomeworkTracker';
import PomodoroTimer from './components/PomodoroTimer';
import ExamTracker from './components/ExamTracker';
import UserProfile from './components/UserProfile';
import Chat from './components/Chat';
import DoubtTab from './components/DoubtTab';
import DeveloperOptions from './components/DeveloperOptions';
import { PullToRefresh } from './components/PullToRefresh';
import { View } from './types';
import { QUOTES } from './constants';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [showQuote, setShowQuote] = useState(false);
  const [dailyQuote] = useState(() => {
    const lastIndex = parseInt(localStorage.getItem('stardesk_last_quote_index') || '-1');
    const nextIndex = (lastIndex + 1) % QUOTES.length;
    localStorage.setItem('stardesk_last_quote_index', nextIndex.toString());
    return QUOTES[nextIndex];
  });
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('stardesk_theme') === 'dark');
  const [devClickCount, setDevClickCount] = useState(0);
  const [isChatActive, setIsChatActive] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const currentViewRef = React.useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Memoize theme toggle to prevent unnecessary re-renders of components that use it
  const toggleTheme = React.useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Memoize view switching
  const handleSetView = React.useCallback((view: View) => {
    setCurrentView(view);
    setIsChatActive(false);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('stardesk_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('stardesk_theme', 'light');
    }
  }, [isDarkMode]);

  // Sync user profile to Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setLoginLoading(false);
        setLoginError(null);
        
        const userRef = doc(db, 'users', u.uid);
        setDoc(userRef, {
          uid: u.uid,
          name: u.displayName || 'Student',
          email: u.email,
          photoURL: u.photoURL,
          lastSeen: serverTimestamp()
        }, { merge: true }).catch(err => {
          handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
        });
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code !== 'auth/cancelled-popup-request') {
        setLoginError(err.message);
      }
      setLoginLoading(false);
    }
  };

  const handleRefresh = React.useCallback(async () => {
    // Simulate a reload or refresh data
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.reload();
  }, []);

  useEffect(() => {
    const backHandler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (currentViewRef.current !== 'home') {
        setCurrentView('home');
      } else {
        // If we are on home, we can let the app close or handle exit logic
        CapacitorApp.exitApp();
      }
    });

    return () => {
      backHandler.then(h => h.remove());
    };
  }, []); // Run only once on mount

  const renderedView = React.useMemo(() => {
    switch (currentView) {
      case 'homework':
        return <HomeworkTracker />;
      case 'timer':
        return <PomodoroTimer />;
      case 'exams':
        return <ExamTracker />;
      case 'profile':
        return <UserProfile />;
      case 'chat':
        return <Chat onChatActiveChange={setIsChatActive} />;
      case 'doubt':
        return <DoubtTab onBack={() => handleSetView('home')} onChatActiveChange={setIsChatActive} />;
      case 'developer':
        return <DeveloperOptions />;
      default:
        const userName = user?.displayName || localStorage.getItem('stardesk_user_name') || 'Student';
        return (
          <div className="flex flex-col gap-4 p-4">
            <div className="bg-indigo-600 dark:bg-indigo-700 rounded-3xl p-6 text-white shadow-lg mb-2 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold mb-1">Hello {userName}!</h3>
                <p className="text-indigo-100 text-sm">Ready to crush your goals today?</p>
              </div>
              {!user && (
                <button 
                  onClick={handleLogin}
                  disabled={loginLoading}
                  className={`${loginLoading ? 'bg-white/10' : 'bg-white/20 hover:bg-white/30'} p-3 rounded-2xl transition-colors relative`}
                  title="Sign in"
                >
                  {loginLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <LogIn size={20} />
                  )}
                </button>
              )}
            </div>
            
            {loginError && (
              <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-100 dark:border-rose-800/50 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{loginError}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <MobileMenuCard 
                title="Homework" 
                icon={<BookOpen size={28} />}
                color="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                onClick={() => handleSetView('homework')}
              />
              <MobileMenuCard 
                title="Timer" 
                icon={<Timer size={28} />}
                color="bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400"
                onClick={() => handleSetView('timer')}
              />
            </div>
            
            <MobileMenuCard 
              title="Exam Performance" 
              icon={<Trophy size={28} />}
              color="bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400"
              fullWidth
              onClick={() => handleSetView('exams')}
            />

            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{dailyQuote}"</p>
            </div>
          </div>
        );
    }
  }, [currentView, user, loginLoading, loginError, dailyQuote, handleLogin, handleSetView]);

  return (
    <div className="flex justify-center bg-slate-200 min-h-screen transition-colors duration-300">
      {/* Mobile Container Emulator */}
      <div className={`w-full max-w-[450px] bg-[#F8F9FC] dark:bg-slate-900 h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
        
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
                className="relative bg-white dark:bg-slate-800 pt-2 pb-10 px-8 rounded-t-[40px] shadow-2xl w-full max-w-[450px] text-center border-t border-slate-100 dark:border-slate-700"
              >
                {/* Drag Handle */}
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-2 mb-8" />
                
                <div className="bg-indigo-50 dark:bg-indigo-900/30 w-20 h-20 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <Sparkles className="text-indigo-600 dark:text-indigo-400" size={40} />
                </div>
                
                <blockquote className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight mb-4 px-4">
                  "Made by student for students"
                </blockquote>
                
                <div className="flex items-center justify-center gap-2 mb-10">
                  <div className="h-px w-8 bg-slate-200 dark:bg-slate-700" />
                  <cite className="text-indigo-600 dark:text-indigo-400 font-bold not-italic text-sm">
                    Chippa Shreyansh
                  </cite>
                  <div className="h-px w-8 bg-slate-200 dark:bg-slate-700" />
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

        {/* Header */}
        <header className="bg-white dark:bg-slate-800 px-6 pt-10 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 transition-colors">
          <div className="flex items-center gap-3">
            {currentView !== 'home' && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleSetView('home')}
                className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <ChevronLeft size={24} />
              </motion.button>
            )}
            <div 
              className="flex items-center gap-2 cursor-pointer active:opacity-70 transition-opacity"
              onClick={() => {
                handleSetView('home');
                if (currentView === 'home') setShowQuote(true);
              }}
            >
              <div className="bg-indigo-600 p-1.5 rounded-xl text-white">
                <GraduationCap size={20} />
              </div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                stardesk
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative w-10 h-10 flex items-center justify-center"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isDarkMode ? 'dark' : 'light'}
                  initial={{ y: -20, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 20, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
            <button 
              onClick={() => {
                const newCount = devClickCount + 1;
                if (newCount >= 7) {
                  handleSetView('developer');
                  setDevClickCount(0);
                } else {
                  setDevClickCount(newCount);
                }
              }}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <Sparkles size={20} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col min-h-0 ${!isChatActive ? 'pb-24' : 'overflow-hidden'}`}>
          <PullToRefresh onRefresh={handleRefresh} disabled={isChatActive}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {!isChatActive && currentView !== 'doubt' && currentView !== 'chat' && (
                  <div className="px-6 pt-4 flex items-center justify-between">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 capitalize">
                      {currentView === 'home' ? 'Dashboard' : currentView}
                    </h2>
                    {currentView !== 'home' && (
                      <motion.button
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSetView('home')}
                        className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold text-sm active:scale-95 transition-transform bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl shadow-sm"
                      >
                        <ChevronLeft size={16} />
                        Dashboard
                      </motion.button>
                    )}
                  </div>
                )}
                {renderedView}
              </motion.div>
            </AnimatePresence>
          </PullToRefresh>
        </main>

        {/* Bottom Navigation Bar */}
        {!isChatActive && (
          <nav className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-t border-slate-100 dark:border-slate-700 px-6 py-3 flex justify-between items-center z-40 transition-colors">
            <NavButton 
              active={currentView === 'home'} 
              onClick={() => handleSetView('home')} 
              icon={<Home size={24} />} 
              label="Home" 
            />
            <NavButton 
              active={currentView === 'chat'} 
              onClick={() => handleSetView('chat')} 
              icon={<MessageSquare size={24} />} 
              label="Chat" 
            />
            <NavButton 
              active={currentView === 'doubt'} 
              onClick={() => handleSetView('doubt')} 
              icon={<MessageCircleQuestion size={24} />} 
              label="Doubt" 
            />
            <NavButton 
              active={currentView === 'profile'} 
              onClick={() => handleSetView('profile')} 
              icon={<UserIcon size={24} />} 
              label="You" 
            />
          </nav>
        )}
      </div>
    </div>
  );
}

const MobileMenuCard = React.memo(({ title, icon, color, onClick, fullWidth }: { 
  title: string; 
  icon: React.ReactNode; 
  color: string;
  onClick: () => void;
  fullWidth?: boolean;
}) => {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${color} ${fullWidth ? 'w-full' : 'flex-1'} p-6 rounded-[28px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center gap-3 text-center transition-all active:shadow-inner`}
    >
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50">
        {icon}
      </div>
      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{title}</span>
    </motion.button>
  );
});

const NavButton = React.memo(({ active, onClick, icon, label }: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
}) => {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}
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
          className="w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-0.5"
        />
      )}
    </button>
  );
});


import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { User as UserIcon, Camera, Trophy, Calendar, Award, LogOut, Moon, Sun, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Exam } from '../types';
import { auth, db, onAuthStateChanged, FirebaseUser, signInWithPopup, signInWithRedirect, getRedirectResult, googleProvider, signOut, collection, query, orderBy, onSnapshot, handleFirestoreError, OperationType, signInWithCredential, GoogleAuthProvider } from '../firebase';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export default function UserProfile() {
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setNewName(u?.displayName || '');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      const savedExams = localStorage.getItem('stardesk_exams');
      if (savedExams) {
        setExams(JSON.parse(savedExams));
      }
      return;
    }

    const path = `users/${user.uid}/exams`;
    const q = query(collection(db, path), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return unsubscribe;
  }, [user]);

  const handleSaveName = React.useCallback(() => {
    // Note: Updating displayName in Firebase Auth requires updateProfile
    // For now we'll just update local state and localStorage as a fallback
    localStorage.setItem('stardesk_user_name', newName);
    setIsEditing(false);
  }, [newName]);

  const handleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginError(null);
    
    const isNative = Capacitor.isNativePlatform();
    
    try {
      if (isNative) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        if (result.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          await signInWithCredential(auth, credential);
        } else {
          throw new Error('No ID token returned from Google Sign-In');
        }
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      let errorMessage = err.message;
      if (err.code === 'auth/unauthorized-domain') {
        errorMessage = "Domain not authorized. Please check your Firebase Console Authorized Domains.";
      } else if (err.message?.toLowerCase().includes('localhost')) {
        errorMessage = "Redirect error. Please rebuild the APK.";
      }
      
      if (!isNative && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment' || err.message?.toLowerCase().includes('popup'))) {
        setLoginError("Popup blocked. Trying redirect...");
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: any) {
          console.error('Redirect error:', redirectErr);
          setLoginError(`Redirect Error: ${redirectErr.message}`);
          setLoginLoading(false);
        }
      } else if (err.code !== 'auth/cancelled-popup-request') {
        setLoginError(`Login Error: ${errorMessage}`);
        setLoginLoading(false);
      } else {
        setLoginLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const averagePercentage = React.useMemo(() => {
    return exams.length > 0 
      ? (exams.reduce((acc, curr) => acc + curr.percentage, 0) / exams.length).toFixed(1)
      : '0';
  }, [exams]);

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  if (!user) {
    return (
      <div className="w-full p-8 flex flex-col items-center justify-center text-center space-y-6">
        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-8 rounded-[40px]">
          <UserIcon size={64} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Your Profile</h2>
          <p className="text-slate-500 dark:text-slate-400">Sign in to sync your progress and join the community.</p>
        </div>
        <button
          onClick={handleLogin}
          disabled={loginLoading}
          className={`${loginLoading ? 'bg-indigo-400' : 'bg-indigo-600'} text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95 transition-all flex items-center gap-2`}
        >
          {loginLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <LogIn size={20} />
          )}
          {loginLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        {loginError && (
          <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-100 dark:border-rose-800/50 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{loginError}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full p-4 space-y-6">
      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center relative">
        <div className="relative mb-4">
          <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
            alt={user.displayName || ''} 
            className="w-32 h-32 rounded-[40px] shadow-xl object-cover border-4 border-white dark:border-slate-800"
            referrerPolicy="no-referrer"
          />
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-8 h-8 rounded-full border-4 border-white dark:border-slate-800 shadow-sm" />
        </div>
        
        {isEditing ? (
          <div className="flex flex-col items-center gap-2">
            <input 
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)}
              className="text-2xl font-black text-center bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 dark:text-slate-100"
              autoFocus
            />
            <button 
              onClick={handleSaveName}
              className="text-indigo-600 dark:text-indigo-400 font-bold text-sm"
            >
              Save Name
            </button>
          </div>
        ) : (
          <div className="group relative">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">{user.displayName}</h2>
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute -right-6 top-1 text-slate-300 hover:text-indigo-500 transition-colors"
            >
              <Camera size={16} />
            </button>
          </div>
        )}
        <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">{user.email}</p>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-rose-500 font-bold text-sm hover:text-rose-600 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>

        <div className="grid grid-cols-2 gap-4 w-full mt-8">
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl text-center">
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{exams.length}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Exams Taken</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl text-center">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{averagePercentage}%</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Avg. Score</p>
          </div>
        </div>
      </div>

      {/* Exam Log Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />
            Exam History
          </h4>
        </div>

        {exams.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-slate-400 dark:text-slate-500 text-sm italic">No exams recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam) => (
              <HistoryItem key={exam.id} exam={exam} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const HistoryItem = React.memo(({ exam }: { exam: Exam }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${exam.percentage >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
          <Award size={20} />
        </div>
        <div>
          <h5 className="font-bold text-slate-800 dark:text-slate-100">{exam.name}</h5>
          <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Calendar size={12} />
            {new Date(exam.date).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-black text-slate-800 dark:text-slate-100">{exam.percentage}%</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Score</p>
      </div>
    </motion.div>
  );
});

import React, { useState, useEffect } from 'react';
import { User, Camera, Trophy, Calendar, Award, LogOut, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Exam } from '../types';

interface UserProfileProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export default function UserProfile({ isDarkMode, onToggleTheme }: UserProfileProps) {
  const [name, setName] = useState(() => localStorage.getItem('stardesk_user_name') || 'Student');
  const [photo, setPhoto] = useState(() => localStorage.getItem('stardesk_user_photo') || '');
  const [exams, setExams] = useState<Exam[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const savedExams = localStorage.getItem('stardesk_exams');
    if (savedExams) {
      setExams(JSON.parse(savedExams));
    }
  }, []);

  const handleSaveName = React.useCallback(() => {
    localStorage.setItem('stardesk_user_name', name);
    setIsEditing(false);
  }, [name]);

  const handlePhotoUpload = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPhoto(base64String);
        localStorage.setItem('stardesk_user_photo', base64String);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const averagePercentage = React.useMemo(() => {
    return exams.length > 0 
      ? (exams.reduce((acc, curr) => acc + curr.percentage, 0) / exams.length).toFixed(1)
      : '0';
  }, [exams]);

  return (
    <div className="w-full p-4 space-y-6">
      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center relative">
        {/* Theme Toggle */}
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onToggleTheme}
          className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center justify-center overflow-hidden"
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

        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-[32px] bg-indigo-50 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
            {photo ? (
              <img src={photo} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={40} className="text-indigo-300" />
            )}
          </div>
          <label className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg cursor-pointer hover:bg-indigo-700 transition-colors">
            <Camera size={16} />
            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          </label>
        </div>

        {isEditing ? (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-4 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="bg-indigo-600 text-white px-4 py-1 rounded-lg text-sm font-bold"
            >
              Save
            </button>
          </div>
        ) : (
          <h3 
            className="text-2xl font-black text-slate-800 dark:text-slate-100 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            onClick={() => setIsEditing(true)}
          >
            {name}
          </h3>
        )}
        <p className="text-slate-400 dark:text-slate-500 text-sm font-medium mt-1">Aspiring Scholar</p>

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

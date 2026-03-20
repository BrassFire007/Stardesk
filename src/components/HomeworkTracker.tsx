import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Circle, Calendar, Trash2, BookOpen, Bell, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Homework } from '../types';

export default function HomeworkTracker() {
  const [homeworks, setHomeworks] = useState<Homework[]>(() => {
    const saved = localStorage.getItem('stardesk_homeworks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newSubject, setNewSubject] = useState('');
  const [reminderOption, setReminderOption] = useState<'none' | '1h' | '1d' | '2d'>('none');

  useEffect(() => {
    localStorage.setItem('stardesk_homeworks', JSON.stringify(homeworks));
  }, [homeworks]);

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setHomeworks(prev => {
        let changed = false;
        const updated = prev.map(hw => {
          if (hw.reminderTime && !hw.reminderSent && !hw.completed) {
            const reminderDate = new Date(hw.reminderTime);
            if (now >= reminderDate) {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Homework Reminder", {
                  body: `Your homework "${hw.title}" is due soon!`,
                });
              }
              changed = true;
              return { ...hw, reminderSent: true };
            }
          }
          return hw;
        });
        return changed ? updated : prev;
      });
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const addHomework = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDate) return;

    const dueDateTime = new Date(`${newDate}T${newTime}`);
    let reminderTime: string | undefined;

    if (reminderOption !== 'none') {
      const rDate = new Date(dueDateTime);
      if (reminderOption === '1h') rDate.setHours(rDate.getHours() - 1);
      if (reminderOption === '1d') rDate.setDate(rDate.getDate() - 1);
      if (reminderOption === '2d') rDate.setDate(rDate.getDate() - 2);
      reminderTime = rDate.toISOString();
    }

    const newItem: Homework = {
      id: crypto.randomUUID(),
      title: newTitle,
      dueDate: dueDateTime.toISOString(),
      subject: newSubject || 'General',
      completed: false,
      reminderOption,
      reminderTime,
      reminderSent: false
    };

    setHomeworks(prev => [newItem, ...prev]);
    setNewTitle('');
    setNewDate('');
    setNewTime('09:00');
    setNewSubject('');
    setReminderOption('none');
  }, [newTitle, newDate, newTime, newSubject, reminderOption]);

  const toggleComplete = React.useCallback((id: string) => {
    setHomeworks(prev => prev.map(hw => 
      hw.id === id ? { ...hw, completed: !hw.completed } : hw
    ));
  }, []);

  const deleteHomework = React.useCallback((id: string) => {
    setHomeworks(prev => prev.filter(hw => hw.id !== id));
  }, []);

  return (
    <div className="w-full p-4 space-y-6">
      <form onSubmit={addHomework} className="bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
          <Plus size={20} className="text-indigo-600 dark:text-indigo-400" />
          Add New Task
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Task Title</label>
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Subject</label>
            <input
              type="text"
              placeholder="Subject (e.g. Math)"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Due Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Due Time</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Set Reminder</label>
            <div className="relative">
              <Bell size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={reminderOption}
                onChange={(e) => setReminderOption(e.target.value as any)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
              >
                <option value="none">No Reminder</option>
                <option value="1h">1 Hour Before</option>
                <option value="1d">1 Day Before</option>
                <option value="2d">2 Days Before</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="md:col-span-2 bg-indigo-600 dark:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
          >
            Add Homework
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {homeworks.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-gray-400"
            >
              <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
              <p>No homework added yet. Start by adding one above!</p>
            </motion.div>
          ) : (
            homeworks.map((hw) => (
              <HomeworkItem 
                key={hw.id} 
                hw={hw} 
                onToggle={toggleComplete} 
                onDelete={deleteHomework} 
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const HomeworkItem = React.memo(({ hw, onToggle, onDelete }: { 
  hw: Homework; 
  onToggle: (id: string) => void; 
  onDelete: (id: string) => void;
}) => {
  const isOverdue = !hw.completed && new Date(hw.dueDate) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
        hw.completed 
          ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-700 opacity-60' 
          : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onToggle(hw.id)}
          className={`transition-colors ${hw.completed ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400'}`}
        >
          {hw.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
        </button>
        <div>
          <h3 className={`font-bold ${hw.completed ? 'line-through text-gray-500 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
            {hw.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] mt-1">
            <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {hw.subject}
            </span>
            <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
              <Calendar size={12} />
              {new Date(hw.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            {hw.reminderOption && hw.reminderOption !== 'none' && (
              <span className={`flex items-center gap-1 font-medium ${hw.reminderSent ? 'text-slate-300' : 'text-indigo-500'}`}>
                <Bell size={12} />
                {hw.reminderOption === '1h' ? '1h before' : hw.reminderOption === '1d' ? '1d before' : '2d before'}
              </span>
            )}
          </div>
        </div>
      </div>
      <button 
        onClick={() => onDelete(hw.id)}
        className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
      >
        <Trash2 size={18} />
      </button>
    </motion.div>
  );
});

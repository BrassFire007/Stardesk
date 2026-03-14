import React, { useState } from 'react';
import { Plus, CheckCircle2, Circle, Calendar, Trash2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Homework } from '../types';

export default function HomeworkTracker() {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const addHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDate) return;

    const newItem: Homework = {
      id: crypto.randomUUID(),
      title: newTitle,
      dueDate: newDate,
      subject: newSubject || 'General',
      completed: false,
    };

    setHomeworks([newItem, ...homeworks]);
    setNewTitle('');
    setNewDate('');
    setNewSubject('');
  };

  const toggleComplete = (id: string) => {
    setHomeworks(homeworks.map(hw => 
      hw.id === id ? { ...hw, completed: !hw.completed } : hw
    ));
  };

  const deleteHomework = (id: string) => {
    setHomeworks(homeworks.filter(hw => hw.id !== id));
  };

  return (
    <div className="w-full p-4 space-y-6">
      <form onSubmit={addHomework} className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 space-y-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Plus size={20} className="text-indigo-600" />
          Add New Task
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="What needs to be done?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <input
            type="text"
            placeholder="Subject (e.g. Math)"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
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
              <motion.div
                key={hw.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  hw.completed 
                    ? 'bg-gray-50 border-gray-100 opacity-60' 
                    : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleComplete(hw.id)}
                    className={`transition-colors ${hw.completed ? 'text-emerald-500' : 'text-gray-300 hover:text-indigo-500'}`}
                  >
                    {hw.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  <div>
                    <h3 className={`font-medium ${hw.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                      {hw.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                        {hw.subject}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        Due: {new Date(hw.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => deleteHomework(hw.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

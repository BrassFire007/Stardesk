import React, { useState, useEffect } from 'react';
import { Plus, Trophy, Calendar, Trash2, BarChart3, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Exam } from '../types';

export default function ExamTracker() {
  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem('stardesk_exams');
    return saved ? JSON.parse(saved) : [];
  });
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [marks, setMarks] = useState('');
  const [total, setTotal] = useState('');
  const [rank, setRank] = useState('');

  useEffect(() => {
    localStorage.setItem('stardesk_exams', JSON.stringify(exams));
  }, [exams]);

  const addExam = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date || !marks || !total) return;

    const marksNum = parseFloat(marks);
    const totalNum = parseFloat(total);
    const percentage = (marksNum / totalNum) * 100;

    const newExam: Exam = {
      id: crypto.randomUUID(),
      name,
      date,
      marks: marksNum,
      totalMarks: totalNum,
      percentage: parseFloat(percentage.toFixed(2)),
      rank: rank ? parseInt(rank) : undefined,
    };

    if (percentage < 40) {
      window.open("https://youtu.be/QDia3e12czc?si=Dm5DRdlga8W03c6M", "_blank");
    }

    setExams(prev => [newExam, ...prev]);
    setName('');
    setDate('');
    setMarks('');
    setTotal('');
    setRank('');
  }, [name, date, marks, total, rank]);

  const deleteExam = React.useCallback((id: string) => {
    setExams(prev => prev.filter(e => e.id !== id));
  }, []);

  return (
    <div className="w-full p-4 space-y-6">
      <form onSubmit={addExam} className="bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
          <Trophy size={20} className="text-amber-500" />
          Log Exam Result
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Exam Name (e.g. Midterm Physics)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          <input
            type="number"
            placeholder="Marks Obtained"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          <input
            type="number"
            placeholder="Total Marks"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          <input
            type="number"
            placeholder="Rank (Optional)"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          <button
            type="submit"
            className="bg-amber-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 dark:shadow-none"
          >
            Add Result
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {exams.map((exam) => (
            <ExamItem 
              key={exam.id} 
              exam={exam} 
              onDelete={deleteExam} 
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const ExamItem = React.memo(({ exam, onDelete }: { 
  exam: Exam; 
  onDelete: (id: string) => void;
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all relative group"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">{exam.name}</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar size={14} />
            {new Date(exam.date).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {exam.percentage}%
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider font-bold">Score</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-50 dark:border-slate-700">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-slate-200 font-semibold">
            <BarChart3 size={16} className="text-indigo-500 dark:text-indigo-400" />
            {exam.marks}/{exam.totalMarks}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold">Marks</p>
        </div>
        <div className="text-center border-x border-gray-50 dark:border-slate-700">
          <div className="flex items-center justify-center gap-1 text-gray-700 dark:text-slate-200 font-semibold">
            <Hash size={16} className="text-emerald-500 dark:text-emerald-400" />
            {exam.rank || 'N/A'}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold">Rank</p>
        </div>
        <div className="text-center">
          <div className={`text-sm font-bold ${exam.percentage >= 80 ? 'text-emerald-500 dark:text-emerald-400' : exam.percentage >= 50 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
            {exam.percentage >= 80 ? 'Excellent' : exam.percentage >= 50 ? 'Good' : 'Needs Work'}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold">Status</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700 flex justify-center">
        <button 
          onClick={() => onDelete(exam.id)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-sm font-medium"
        >
          <Trash2 size={16} />
          Delete Record
        </button>
      </div>
    </motion.div>
  );
});

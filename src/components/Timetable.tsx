import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, onAuthStateChanged, collection, query, onSnapshot, addDoc, doc, deleteDoc, handleFirestoreError, OperationType } from '../firebase';
import { Plus, X } from 'lucide-react';

interface TimetableEvent {
  id: string;
  title: string;
  dayOfWeek: number; // 0 = Monday, ..., 6 = Sunday
  startTime: string; // HH:mm format, e.g., '09:00'
  endTime: string;   // HH:mm format, e.g., '10:30'
  color: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = [
  'bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 
  'bg-amber-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-blue-500'
];

export default function Timetable() {
  const [user, setUser] = useState(auth.currentUser);
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('stardesk_timetable');
      if (saved) setEvents(JSON.parse(saved));
      setLoading(false);
      return;
    }

    const savedForUser = localStorage.getItem(`stardesk_timetable_${user.uid}`);
    if (savedForUser) {
      setEvents(JSON.parse(savedForUser));
      setLoading(false);
    }

    const path = `users/${user.uid}/timetable`;
    const q = query(collection(db, path));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const evts: TimetableEvent[] = [];
      snapshot.forEach((doc) => {
        evts.push({ id: doc.id, ...doc.data() } as TimetableEvent);
      });
      setEvents(evts);
      localStorage.setItem(`stardesk_timetable_${user.uid}`, JSON.stringify(evts));
      setLoading(false);
    }, (error) => {
      console.warn("Firestore error, loading from local cache fallback", error);
      const saved = localStorage.getItem(`stardesk_timetable_${user.uid}`);
      if (saved) setEvents(JSON.parse(saved));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const saveEvents = (newEvents: TimetableEvent[]) => {
    if (!user) {
      localStorage.setItem('stardesk_timetable', JSON.stringify(newEvents));
    }
    setEvents(newEvents);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const newEvent: Omit<TimetableEvent, 'id'> = {
      title,
      dayOfWeek,
      startTime,
      endTime,
      color: selectedColor
    };

    if (user) {
      const eventWithId = { ...newEvent, id: Date.now().toString(), offline: true };
      setEvents(prev => [...prev, eventWithId]); // Optimistic update
      
      const path = `users/${user.uid}/timetable`;
      try {
        await addDoc(collection(db, path), newEvent);
      } catch (err) {
        console.warn("Firestore error adding timetable event:", err);
      }
    } else {
      const eventWithId = { ...newEvent, id: Date.now().toString() };
      saveEvents([...events, eventWithId]);
    }

    setTitle('');
    setShowAddModal(false);
  };

  const handleDelete = async (id: string, titleStr: string) => {
    if (!window.confirm(`Delete ${titleStr}?`)) {
      return;
    }

    if (user) {
      setEvents(events.filter(e => e.id !== id)); // Optimistic delete
      const path = `users/${user.uid}/timetable`;
      try {
        await deleteDoc(doc(db, path, id));
      } catch (err) {
        console.warn("Firestore error deleting timetable event:", err);
      }
    } else {
      saveEvents(events.filter(e => e.id !== id));
    }
  };

  // Convert "HH:mm" to minutes from 00:00
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Constants for timetable rendering
  const minHour = 8;
  const maxHour = 20;
  const hourHeight = 60; // 1 pixel per minute

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      <div className="px-4 py-4 md:px-8 flex justify-end">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-transform font-bold text-sm"
        >
          <Plus size={18} /> Add Event
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-24 md:px-8 custom-scrollbar">
        {loading ? (
          <div className="animate-pulse space-y-4">
             <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          </div>
        ) : (
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-4 overflow-x-auto">
             <div className="min-w-[500px] sm:min-w-[700px]">
               {/* Header: Days */}
               <div className="flex border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-4">
                 <div className="w-12 sm:w-16 flex-shrink-0"></div> {/* Time column offset */}
                 {DAYS.map(day => (
                   <div key={day} className="flex-1 text-center font-bold text-slate-400 text-xs sm:text-sm">
                     {day}
                   </div>
                 ))}
               </div>

               {/* Grid */}
               <div className="relative flex" style={{ height: (maxHour - minHour) * hourHeight }}>
                 {/* Time Labels */}
                 <div className="w-12 sm:w-16 flex-shrink-0 border-r border-slate-100 dark:border-slate-700/50 flex flex-col justify-between" style={{ height: '100%' }}>
                   {Array.from({ length: maxHour - minHour + 1 }).map((_, i) => (
                     <div key={i} className="text-[10px] sm:text-xs font-medium text-slate-400 text-right pr-2 absolute w-12 sm:w-16" style={{ top: i * hourHeight - 8 }}>
                       {i + minHour}:00
                     </div>
                   ))}
                 </div>

                 {/* Day Columns */}
                 <div className="flex-1 flex relative">
                   {/* Horizontal grid lines */}
                   {Array.from({ length: maxHour - minHour }).map((_, i) => (
                      <div 
                        key={i} 
                        className="absolute w-full border-t border-slate-100 dark:border-slate-700/50" 
                        style={{ top: (i + 1) * hourHeight, zIndex: 0 }}
                      />
                   ))}

                   {/* Day columns for events */}
                   {DAYS.map((_, dayIndex) => {
                     const dayEvents = events.filter(e => e.dayOfWeek === dayIndex);
                     return (
                       <div key={dayIndex} className="flex-1 relative border-r border-slate-50 dark:border-slate-700/30 last:border-r-0 h-full">
                         {dayEvents.map(event => {
                           const startMins = timeToMinutes(event.startTime);
                           const endMins = timeToMinutes(event.endTime);
                           const topMins = Math.max(0, startMins - (minHour * 60));
                           let heightMins = endMins - startMins;
                           
                           if (heightMins < 15) heightMins = 15; // Minimum hit target
                           if (startMins >= maxHour * 60 || endMins <= minHour * 60) return null;

                           return (
                             <div 
                               key={event.id}
                               className={`absolute w-[calc(100%-4px)] left-[2px] sm:w-[calc(100%-8px)] sm:left-1 rounded-lg p-1 sm:p-2 text-white shadow-sm overflow-hidden text-[10px] sm:text-xs flex flex-col gap-0.5 sm:gap-1 transition-transform cursor-pointer hover:scale-[1.02] ${event.color}`}
                               style={{ 
                                 top: topMins, 
                                 height: heightMins,
                                 zIndex: 10
                               }}
                               onClick={() => handleDelete(event.id, event.title)}
                             >
                               <div className="font-bold truncate leading-tight">{event.title}</div>
                               {heightMins >= 45 && (
                                 <div className="opacity-90 leading-tight hidden sm:block">
                                   {event.startTime} - {event.endTime}
                                 </div>
                               )}
                             </div>
                           )
                         })}
                       </div>
                     );
                   })}
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl p-6 custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Add Event</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl p-3 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 font-medium"
                    placeholder="e.g. Mathematics"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">Day</label>
                  <div className="grid grid-cols-4 gap-2">
                    {DAYS.map((day, idx) => (
                      <div
                        key={day}
                        onClick={() => setDayOfWeek(idx)}
                        className={`p-2 rounded-xl text-center text-xs font-bold cursor-pointer transition-colors ${
                          dayOfWeek === idx 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl p-3 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl p-3 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Color</label>
                  <div className="flex flex-wrap gap-3">
                    {COLORS.map(color => (
                      <div
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full cursor-pointer ${color} border-2 transition-transform ${
                          selectedColor === color ? 'border-white dark:border-slate-800 scale-110 shadow-lg' : 'border-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-6 bg-indigo-600 text-white p-4 rounded-xl font-black text-lg active:scale-95 transition-transform"
                >
                  Save Event
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

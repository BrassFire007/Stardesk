import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, X, ShieldAlert } from 'lucide-react';
import { 
  auth, db, onAuthStateChanged, 
  collection, addDoc, serverTimestamp, 
  handleFirestoreError, OperationType, FirebaseUser
} from '../firebase';

export default function DeveloperOptions() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !user) return;
    try {
      await addDoc(collection(db, 'groups'), {
        name: groupName,
        description: "Developer-created group",
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setGroupName('');
      setIsCreating(false);
      console.log('Group created successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'groups');
    }
  };

  if (!user) return <div className="p-8 text-center text-slate-500">Please sign in to access developer options.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex items-start gap-3">
        <ShieldAlert className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
        <div>
          <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200">Developer Mode Active</h4>
          <p className="text-xs text-amber-700 dark:text-amber-300">Use these tools with caution. Changes affect the live database.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Database Tools</h3>
        
        {isCreating ? (
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={createGroup}
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-3 shadow-lg"
          >
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Create New Group</h4>
              <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>
            <input 
              autoFocus
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group Name"
              className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 dark:text-slate-100"
            />
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold text-sm active:scale-95 transition-transform"
            >
              Confirm Creation
            </button>
          </motion.form>
        ) : (
          <button 
            onClick={() => setIsCreating(true)}
            className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-bold text-sm"
          >
            <span>Create New Group</span>
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

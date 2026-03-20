import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Users, User, Send, Plus, Search, ChevronRight, X, LogOut, Settings, Trash2, Edit2, MoreVertical } from 'lucide-react';
import { 
  auth, db, googleProvider, signInWithPopup, onAuthStateChanged, 
  collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, 
  doc, setDoc, getDoc, handleFirestoreError, OperationType, FirebaseUser,
  where, getDocs, signOut, updateDoc, deleteDoc, arrayUnion
} from '../firebase';
import { GroupChat, DirectChat, Message, UserProfileData } from '../types';

interface ChatProps {
  onChatActiveChange?: (active: boolean) => void;
}

export default function Chat({ onChatActiveChange }: ChatProps) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeTab, setActiveTab] = useState<'group' | 'direct'>('group');
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [directs, setDirects] = useState<(DirectChat & { otherUser?: UserProfileData })[]>([]);
  const [selectedChat, setSelectedChat] = useState<{ type: 'group' | 'direct', id: string, name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfileData[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    onChatActiveChange?.(!!selectedChat);
  }, [selectedChat, onChatActiveChange]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync User to Firestore
  useEffect(() => {
    if (!user) return;
    const syncUser = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const userData = {
          uid: user.uid,
          name: user.displayName || 'Anonymous',
          email: user.email || '',
          photoURL: user.photoURL || '',
          lastSeen: new Date().toISOString()
        };
        
        if (!userDoc.exists()) {
          await setDoc(userRef, { ...userData, role: 'user' });
        } else {
          await updateDoc(userRef, userData);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    };
    syncUser();
  }, [user?.uid]);

  // Fetch Groups
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const g = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as GroupChat))
        .filter(group => !group.deletedBy?.includes(user.uid));
      setGroups(g);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'groups'));
    return unsubscribe;
  }, [user?.uid]);

  // Fetch Direct Chats
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'direct_chats'), 
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const d = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as DirectChat))
        .filter(chat => !chat.deletedBy?.includes(user.uid));
      
      const directsWithUsers = await Promise.all(d.map(async chat => {
        const otherUserId = chat.participants.find(id => id !== user.uid);
        if (otherUserId) {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          return { ...chat, otherUser: userDoc.data() as UserProfileData };
        }
        return chat;
      }));
      
      setDirects(directsWithUsers);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'direct_chats'));
    return unsubscribe;
  }, [user?.uid]);

  // Fetch Messages for Selected Chat
  useEffect(() => {
    if (!selectedChat?.id || !user?.uid) return;
    const path = selectedChat.type === 'group' 
      ? `groups/${selectedChat.id}/messages` 
      : `direct_chats/${selectedChat.id}/messages`;
    
    const q = query(collection(db, path), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const m = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(m);
    }, (err) => handleFirestoreError(err, OperationType.LIST, path));
    return unsubscribe;
  }, [selectedChat?.id, selectedChat?.type, user?.uid]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !user) return;

    const path = selectedChat.type === 'group' 
      ? `groups/${selectedChat.id}/messages` 
      : `direct_chats/${selectedChat.id}/messages`;

    try {
      if (editingMessage) {
        await updateDoc(doc(db, path, editingMessage.id), {
          text: newMessage,
          updatedAt: serverTimestamp()
        });
        setEditingMessage(null);
      } else {
        await addDoc(collection(db, path), {
          senderId: user.uid,
          senderName: user.displayName || 'Anonymous',
          senderPhoto: user.photoURL || '',
          text: newMessage,
          timestamp: serverTimestamp()
        });
      }
      setNewMessage('');

      // Update last message for direct chats
      if (selectedChat.type === 'direct') {
        await setDoc(doc(db, 'direct_chats', selectedChat.id), {
          lastMessage: newMessage,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, editingMessage ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!selectedChat || !user) return;
    const path = selectedChat.type === 'group' 
      ? `groups/${selectedChat.id}/messages` 
      : `direct_chats/${selectedChat.id}/messages`;
    
    try {
      await deleteDoc(doc(db, path, messageId));
      setContextMenuMessage(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const deleteChat = () => {
    if (!selectedChat || !user) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteChat = async () => {
    if (!selectedChat || !user) return;
    
    const chatPath = selectedChat.type === 'group' ? 'groups' : 'direct_chats';
    const messagesPath = `${chatPath}/${selectedChat.id}/messages`;
    
    try {
      // 1. Fetch all messages
      const msgsSnapshot = await getDocs(collection(db, messagesPath));
      
      // 2. Delete all messages
      const deletePromises = msgsSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      
      // 3. Add system message
      await addDoc(collection(db, messagesPath), {
        senderId: 'system',
        senderName: 'System',
        senderPhoto: '',
        text: `This chat has been deleted by ${user.displayName}.`,
        timestamp: serverTimestamp()
      });
      
      // 4. Update chat document to hide for current user and update last message
      await updateDoc(doc(db, chatPath, selectedChat.id), {
        deletedBy: arrayUnion(user.uid),
        lastMessage: `This chat has been deleted by ${user.displayName}.`,
        updatedAt: serverTimestamp()
      });
      
      setSelectedChat(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, chatPath);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setShowProfile(false);
      setSelectedChat(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // Fetch users for search when search is opened
  useEffect(() => {
    if (!isSearchingUser || !user?.uid) return;
    
    const fetchInitialUsers = async () => {
      try {
        const q = query(collection(db, 'users'), limit(50));
        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map(doc => doc.data() as UserProfileData)
          .filter(u => u.uid !== user.uid);
        setSearchResults(results);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    
    fetchInitialUsers();
  }, [isSearchingUser, user?.uid]);

  const searchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!searchQuery.trim()) {
      // If empty, reset to initial list
      const q = query(collection(db, 'users'), limit(50));
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => doc.data() as UserProfileData)
        .filter(u => u.uid !== user.uid);
      setSearchResults(results);
      return;
    }
    
    try {
      // Search by email or name (client-side filtering for better UX with small datasets)
      const q = query(collection(db, 'users'), limit(100));
      const snapshot = await getDocs(q);
      const allUsers = snapshot.docs.map(doc => doc.data() as UserProfileData);
      
      const term = searchQuery.toLowerCase().trim();
      const filtered = allUsers.filter(u => 
        u.uid !== user.uid && 
        (u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term))
      );
      
      setSearchResults(filtered);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  };

  const startDirectChat = async (otherUser: UserProfileData) => {
    if (!user) return;
    
    // Check if chat already exists
    const existing = directs.find(d => d.participants.includes(otherUser.uid));
    if (existing) {
      setSelectedChat({ type: 'direct', id: existing.id, name: otherUser.name });
      setIsSearchingUser(false);
      return;
    }

    try {
      const chatRef = await addDoc(collection(db, 'direct_chats'), {
        participants: [user.uid, otherUser.uid],
        updatedAt: serverTimestamp(),
        lastMessage: ''
      });
      setSelectedChat({ type: 'direct', id: chatRef.id, name: otherUser.name });
      setIsSearchingUser(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'direct_chats');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-6 rounded-[40px] mb-6">
          <MessageSquare size={48} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Join the Conversation</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Sign in with Google to start chatting with other students.</p>
        <button
          onClick={handleLogin}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95 transition-all"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {showProfile ? (
        <div className="flex flex-col h-full">
          {/* Profile Header */}
          <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
            <button onClick={() => setShowProfile(false)} className="p-2 text-slate-400">
              <ChevronRight className="rotate-180" size={24} />
            </button>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">My Profile</h3>
          </div>

          {/* Profile Content */}
          <div className="flex-1 p-6 flex flex-col items-center">
            <div className="relative mb-6">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt={user.displayName || ''} 
                className="w-32 h-32 rounded-[40px] shadow-xl object-cover border-4 border-white dark:border-slate-800"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-8 h-8 rounded-full border-4 border-white dark:border-slate-800 shadow-sm" />
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">{user.displayName}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">{user.email}</p>

            <div className="w-full space-y-3">
              <button 
                onClick={handleLogout}
                className="w-full p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <LogOut size={20} />
                Log Out
              </button>
            </div>
          </div>
        </div>
      ) : selectedChat ? (
        <div className="flex flex-col h-full">
          {/* Chat Header */}
          <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedChat(null)} className="p-2 text-slate-400">
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                {selectedChat.name[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{selectedChat.name}</h3>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  {selectedChat.type === 'group' ? 'Group Chat' : 'Direct Message'}
                </p>
              </div>
            </div>
            {selectedChat.type === 'direct' && (
              <button 
                onClick={deleteChat}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
            {messages.map((msg) => (
              <MessageItem 
                key={msg.id}
                msg={msg}
                isOwn={msg.senderId === user.uid}
                isSystem={msg.senderId === 'system'}
                onLongPress={() => msg.senderId === user.uid && setContextMenuMessage(msg)}
              />
            ))}
            
            {/* Delete Chat Confirmation Modal */}
            <AnimatePresence>
              {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center"
                  >
                    <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-[28px] flex items-center justify-center mx-auto mb-6">
                      <Trash2 className="text-rose-600" size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">Delete Chat?</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
                      This chat and all its messages will be permanently deleted. This action cannot be undone.
                    </p>
                    <div className="space-y-3">
                      <button 
                        onClick={confirmDeleteChat}
                        className="w-full bg-rose-600 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-rose-200 dark:shadow-none"
                      >
                        Yes, Delete Everything
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-bold active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            
            {/* Context Menu Overlay */}
            <AnimatePresence>
              {contextMenuMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setContextMenuMessage(null)}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Message Actions</p>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingMessage(contextMenuMessage);
                        setNewMessage(contextMenuMessage.text);
                        setContextMenuMessage(null);
                      }}
                      className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-bold transition-colors"
                    >
                      <Edit2 size={18} />
                      Edit Message
                    </button>
                    <button 
                      onClick={() => deleteMessage(contextMenuMessage.id)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 font-bold transition-colors"
                    >
                      <Trash2 size={18} />
                      Delete Message
                    </button>
                    <button 
                      onClick={() => setContextMenuMessage(null)}
                      className="w-full p-4 text-slate-400 font-bold border-t border-slate-100 dark:border-slate-700"
                    >
                      Cancel
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 pb-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
            {editingMessage && (
              <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-lg mb-1">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Editing Message</span>
                <button type="button" onClick={() => { setEditingMessage(null); setNewMessage(''); }} className="text-indigo-600">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 dark:text-slate-100"
              />
              <button 
                type="submit"
                className="bg-indigo-600 text-white p-2 rounded-xl active:scale-95 transition-transform"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header with Profile Toggle */}
          <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <MessageSquare size={18} />
              </div>
              <h1 className="font-black text-slate-800 dark:text-slate-100 tracking-tight">STUDENT CHAT</h1>
            </div>
            <button 
              onClick={() => setShowProfile(true)}
              className="w-10 h-10 rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 active:scale-90 transition-transform"
            >
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex p-4 gap-2">
            <button
              onClick={() => setActiveTab('group')}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'group' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Users size={18} />
              Groups
            </button>
            <button
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'direct' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <User size={18} />
              Direct
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 space-y-3">
            {activeTab === 'group' ? (
              <>
                {groups.map(group => (
                  <ChatListItem 
                    key={group.id}
                    title={group.name}
                    subtitle={group.description}
                    onClick={() => setSelectedChat({ type: 'group', id: group.id, name: group.name })}
                  />
                ))}
              </>
            ) : (
              <>
                {isSearchingUser ? (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-3 shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Find User</h4>
                      <button type="button" onClick={() => { setIsSearchingUser(false); setSearchResults([]); }} className="text-slate-400">
                        <X size={18} />
                      </button>
                    </div>
                    <form onSubmit={searchUsers} className="flex gap-2">
                      <input 
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or email..."
                        className="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 dark:text-slate-100"
                      />
                      <button 
                        type="submit"
                        className="bg-indigo-600 text-white p-2 rounded-xl active:scale-95 transition-transform"
                      >
                        <Search size={20} />
                      </button>
                    </form>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {searchResults.map(res => (
                        <button
                          key={res.uid}
                          onClick={() => startDirectChat(res)}
                          className="w-full p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg flex items-center gap-3 text-left transition-colors"
                        >
                          <img src={res.photoURL} alt={res.name} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{res.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{res.email}</p>
                          </div>
                        </button>
                      ))}
                      {searchQuery && searchResults.length === 0 && (
                        <p className="text-center text-[10px] text-slate-400 py-2">No users found with this email.</p>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <button 
                    onClick={() => setIsSearchingUser(true)}
                    className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm"
                  >
                    <Search size={18} />
                    Find Users
                  </button>
                )}
                {directs.map(chat => (
                  <ChatListItem 
                    key={chat.id}
                    title={chat.otherUser?.name || 'Unknown User'}
                    subtitle={chat.lastMessage || 'No messages yet'}
                    photo={chat.otherUser?.photoURL}
                    onClick={() => setSelectedChat({ type: 'direct', id: chat.id, name: chat.otherUser?.name || 'Unknown User' })}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ChatListItem = React.memo(({ title, subtitle, photo, onClick }: { title: string, subtitle: string, photo?: string, onClick: () => void }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 text-left"
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center">
        {photo ? (
          <img src={photo} alt={title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-lg font-bold text-slate-400">{title[0].toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{title}</h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-slate-300" />
    </motion.button>
  );
});

const MessageItem = React.memo(({ msg, isOwn, isSystem, onLongPress }: { msg: Message, isOwn: boolean, isSystem?: boolean, onLongPress: () => void }) => {
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    if (isSystem) return;
    const timer = setTimeout(() => {
      onLongPress();
    }, 600);
    setPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-slate-100 dark:bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
            {msg.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      <img 
        src={msg.senderPhoto || `https://ui-avatars.com/api/?name=${msg.senderName}`} 
        alt={msg.senderName} 
        className="w-8 h-8 rounded-full shadow-sm"
        referrerPolicy="no-referrer"
      />
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">{msg.senderName}</span>
        <div className={`p-3 rounded-2xl text-sm transition-all active:scale-[0.98] select-none ${
          isOwn 
            ? 'bg-indigo-600 text-white rounded-tr-none' 
            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700'
        }`}>
          {msg.text}
        </div>
      </div>
    </div>
  );
});

import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, Users, User, Search, ChevronRight, X, LogOut, Trash2, Edit2 } from 'lucide-react';
import { 
  auth, db, googleProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, 
  collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, 
  doc, setDoc, getDoc, handleFirestoreError, OperationType, FirebaseUser,
  where, getDocs, signOut, updateDoc, deleteDoc, arrayUnion, signInWithCredential, GoogleAuthProvider
} from '../firebase';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GroupChat, DirectChat, Message, UserProfileData } from '../types';
import MessageBar from './MessageBar';

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
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfileData[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChatActiveChange?.(!!selectedChat);
    return () => onChatActiveChange?.(false);
  }, [selectedChat, onChatActiveChange]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      try {
        const d = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as DirectChat))
          .filter(chat => !chat.deletedBy?.includes(user.uid));
        
        // Use a local variable to avoid stale closures in the async map
        const currentUserId = user.uid;
        
        const directsWithUsers = await Promise.all(d.map(async chat => {
          const otherUserId = chat.participants.find(id => id !== currentUserId);
          if (otherUserId) {
            const userRef = doc(db, 'users', otherUserId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              return { ...chat, otherUser: userDoc.data() as UserProfileData };
            }
          }
          return chat;
        }));
        
        // Only update if we are still on the same user
        if (auth.currentUser?.uid === currentUserId) {
          setDirects(directsWithUsers);
        }
      } catch (err) {
        console.error("Error processing direct chats:", err);
      }
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

  const handleSendMessage = React.useCallback(async () => {
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
  }, [newMessage, selectedChat, user, editingMessage]);

  const deleteMessage = React.useCallback(async (messageId: string) => {
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
  }, [selectedChat, user]);

  const deleteChat = React.useCallback(() => {
    if (!selectedChat || !user) return;
    setShowDeleteConfirm(true);
  }, [selectedChat, user]);

  const confirmDeleteChat = React.useCallback(async () => {
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
  }, [selectedChat, user]);

  const handleLogin = React.useCallback(async () => {
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
      console.error("Login failed", err);
      
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
  }, [loginLoading]);

  const handleLogout = React.useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      setShowProfile(false);
      setSelectedChat(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  }, []);

  // Real-time User Search
  useEffect(() => {
    if (!isSearchingUser || !user?.uid) return;
    
    const performSearch = async () => {
      try {
        const term = searchQuery.toLowerCase().trim();
        const q = query(collection(db, 'users'), limit(100));
        const snapshot = await getDocs(q);
        const allUsers = snapshot.docs.map(doc => doc.data() as UserProfileData);
        
        if (!term) {
          setSearchResults(allUsers.filter(u => u.uid !== user.uid).slice(0, 50));
          return;
        }

        const filtered = allUsers.filter(u => 
          u.uid !== user.uid && 
          (u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term))
        );
        
        setSearchResults(filtered);
      } catch (err) {
        console.error("Error searching users:", err);
      }
    };
    
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, isSearchingUser, user?.uid]);

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
          disabled={loginLoading}
          className={`${loginLoading ? 'bg-indigo-400' : 'bg-indigo-600'} text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95 transition-all flex items-center gap-2`}
        >
          {loginLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {loginLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>
        {loginError && (
          <p className="mt-4 text-xs text-rose-500 font-medium bg-rose-50 dark:bg-rose-900/20 px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-800/50">
            {loginError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Sidebar for Desktop / List for Mobile */}
      <div className={`flex flex-col h-full bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 transition-all ${
        selectedChat ? 'hidden lg:flex lg:w-80' : 'w-full lg:w-80'
      }`}>
        {showProfile ? (
          <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
              <button onClick={() => setShowProfile(false)} className="p-2 text-slate-400">
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">My Profile</h3>
            </div>
            <div className="flex-1 p-6 flex flex-col items-center">
              <div className="relative mb-6">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt={user.displayName || ''} className="w-24 h-24 rounded-[32px] shadow-xl object-cover border-4 border-white dark:border-slate-800" referrerPolicy="no-referrer" />
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800" />
              </div>
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-1">{user.displayName}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 font-medium">{user.email}</p>
              <button onClick={handleLogout} className="w-full p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all text-sm">
                <LogOut size={18} />
                Log Out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 flex justify-between items-center border-b border-slate-50 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <MessageSquare size={18} />
                </div>
                <h1 className="font-black text-slate-800 dark:text-slate-100 tracking-tight text-sm">CHATS</h1>
              </div>
              <button onClick={() => setShowProfile(true)} className="w-8 h-8 rounded-lg overflow-hidden border-2 border-slate-100 dark:border-slate-700">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-3 gap-1 bg-slate-50/50 dark:bg-slate-900/20">
              <button
                onClick={() => setActiveTab('group')}
                className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'group' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors'}`}
              >
                <Users size={14} /> Groups
              </button>
              <button
                onClick={() => setActiveTab('direct')}
                className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'direct' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors'}`}
              >
                <User size={14} /> Direct
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeTab === 'group' ? (
                groups.map(group => (
                  <ChatListItem 
                    key={group.id} 
                    title={group.name} 
                    subtitle={group.description} 
                    active={selectedChat?.id === group.id}
                    onClick={() => setSelectedChat({ type: 'group', id: group.id, name: group.name })} 
                  />
                ))
              ) : (
                <>
                  {isSearchingUser ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase">Find Student</span>
                        <button onClick={() => { setIsSearchingUser(false); setSearchResults([]); }}><X size={14} className="text-indigo-400" /></button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                        <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-white dark:bg-slate-800 border-none rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20" />
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {searchResults.map(res => (
                          <button key={res.uid} onClick={() => startDirectChat(res)} className="w-full p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 text-left">
                            <img src={res.photoURL} alt={res.name} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                            <div className="min-w-0"><p className="text-xs font-bold truncate dark:text-slate-100">{res.name}</p></div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <button onClick={() => setIsSearchingUser(true)} className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-indigo-600 text-xs font-bold">
                      <Search size={14} /> Find Pupils
                    </button>
                  )}
                  {directs.map(chat => (
                    <ChatListItem 
                      key={chat.id} 
                      title={chat.otherUser?.name || 'User'} 
                      subtitle={chat.lastMessage || 'New connection'} 
                      photo={chat.otherUser?.photoURL} 
                      active={selectedChat?.id === chat.id}
                      onClick={() => setSelectedChat({ type: 'direct', id: chat.id, name: chat.otherUser?.name || 'User' })} 
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 ${!selectedChat ? 'hidden lg:flex lg:items-center lg:justify-center' : 'flex'}`}>
        {!selectedChat ? (
          <div className="text-center p-8 opacity-20">
            <MessageSquare size={64} className="mx-auto mb-4" />
            <p className="font-bold">Select a conversation to start chatting</p>
          </div>
        ) : (
          <div className="flex flex-col h-full w-full max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedChat(null)} className="lg:hidden p-2 text-slate-400">
                  <ChevronRight className="rotate-180" size={20} />
                </button>
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                  {selectedChat.name[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{selectedChat.name}</h3>
                  <div className="flex items-center gap-1.5 leading-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Now</p>
                  </div>
                </div>
              </div>
              {selectedChat.type === 'direct' && (
                <button onClick={deleteChat} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
              )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <MessageItem 
                  key={msg.id} 
                  msg={msg} 
                  isOwn={msg.senderId === user.uid} 
                  isSystem={msg.senderId === 'system'} 
                  onLongPress={() => msg.senderId === user.uid && setContextMenuMessage(msg)} 
                />
              ))}
            </div>

            {/* Message Bar */}
            <div className="mt-auto">
              {editingMessage && (
                <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-between border-t border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Editing Message</span>
                  <button onClick={() => { setEditingMessage(null); setNewMessage(''); }}><X size={14} className="text-indigo-400" /></button>
                </div>
              )}
              <MessageBar value={newMessage} onChange={setNewMessage} onSend={handleSendMessage} />
            </div>
          </div>
        )}
      </div>

      {/* Confirmation & Menus (Same as before but omitted for brevity in search replacement) */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-sm p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6"><Trash2 className="text-rose-600" size={32} /></div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">Clear Conversation?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">Everything will be removed. You can't undo this action.</p>
              <div className="space-y-3">
                <button onClick={confirmDeleteChat} className="w-full bg-rose-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-rose-100 dark:shadow-none">Delete Permanently</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="w-full text-slate-400 font-bold text-sm">Dismiss</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {contextMenuMessage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setContextMenuMessage(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl w-full max-w-[280px] overflow-hidden">
              <button onClick={() => { setEditingMessage(contextMenuMessage); setNewMessage(contextMenuMessage.text); setContextMenuMessage(null); }} className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-bold text-sm border-b border-slate-50 dark:border-slate-700/50"><Edit2 size={16} /> Edit Message</button>
              <button onClick={() => deleteMessage(contextMenuMessage.id)} className="w-full p-4 flex items-center gap-3 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 font-bold text-sm"><Trash2 size={16} /> Remove Message</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ChatListItem = React.memo(({ title, subtitle, photo, active, onClick }: { title: string, subtitle: string, photo?: string, active?: boolean, onClick: () => void }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full p-3 rounded-2xl flex items-center gap-3 text-left transition-all ${
        active 
          ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30' 
          : 'bg-white dark:bg-slate-800 border border-transparent shadow-sm hover:border-slate-200 dark:hover:border-slate-700'
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
        {photo ? (
          <img src={photo} alt={title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-sm font-bold text-slate-400">{title[0].toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-bold truncate ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-100'}`}>{title}</h4>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{subtitle}</p>
      </div>
      {!active && <ChevronRight size={14} className="text-slate-200" />}
    </motion.button>
  );
});

const MessageItem = React.memo(({ msg, isOwn, isSystem, onLongPress }: { msg: Message, isOwn: boolean, isSystem?: boolean, onLongPress: () => void }) => {
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown>
              {msg.text}
            </ReactMarkdown>
          </div>
        </div>
        <span className={`text-[9px] font-bold text-slate-400 mt-1 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  );
});

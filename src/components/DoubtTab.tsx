import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { MessageCircleQuestion, AlertCircle, Loader2, Trash2, Camera as CameraIcon, Image as ImageIcon, Key, Plus, X } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import MessageBar from './MessageBar';
import { auth, db, doc, getDoc, setDoc } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string;
  timestamp?: string;
}

interface DoubtTabProps {
  onBack?: () => void;
  onChatActiveChange?: (active: boolean) => void;
}

export default function DoubtTab({ onBack, onChatActiveChange }: DoubtTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [activeKeyIndex, setActiveKeyIndex] = useState<number>(0);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChatActiveChange?.(true);
    return () => onChatActiveChange?.(false);
  }, [onChatActiveChange]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      let keysLoadedFromDb = false;
      if (u) {
        try {
          const keysDoc = await getDoc(doc(db, `users/${u.uid}/private/apikeys`));
          if (keysDoc.exists()) {
            const data = keysDoc.data();
            setApiKeys(data.keys || []);
            setActiveKeyIndex(data.activeIndex || 0);
            keysLoadedFromDb = true;
          }
        } catch (err) {
          console.error("Failed to load API keys from db:", err);
        }
      }
      if (!keysLoadedFromDb) {
        const savedKeys = localStorage.getItem('stardesk_gemini_keys');
        if (savedKeys) {
          const parsed = JSON.parse(savedKeys);
          setApiKeys(parsed.keys || []);
          setActiveKeyIndex(parsed.activeIndex || 0);
        }
      }
    });

    const savedDoubts = localStorage.getItem('stardesk_doubts');
    if (savedDoubts) {
      setMessages(JSON.parse(savedDoubts));
    }
    setLoadingMessages(false);
    return unsubscribe;
  }, []);

  useEffect(() => {
    localStorage.setItem('stardesk_gemini_keys', JSON.stringify({ keys: apiKeys, activeIndex: activeKeyIndex }));
    if (user) {
      setDoc(doc(db, `users/${user.uid}/private/apikeys`), {
        keys: apiKeys,
        activeIndex: activeKeyIndex,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error("Failed to sync API keys to db:", err);
      });
    }
  }, [apiKeys, activeKeyIndex, user]);

  useEffect(() => {
    localStorage.setItem('stardesk_doubts', JSON.stringify(messages));
  }, [messages]);

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAttachmentClick = React.useCallback(() => {
    setShowAttachmentOptions(prev => !prev);
  }, []);

  const takePhoto = async () => {
    setShowAttachmentOptions(false);
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });
      if (image.base64String) {
        setSelectedImage(`data:image/${image.format};base64,${image.base64String}`);
      }
    } catch (e: any) {
      console.error("Camera error:", e);
      if (e.message !== "User cancelled photos app") {
        setError("Could not access camera.");
      }
    }
  };

  const choosePhoto = async () => {
    setShowAttachmentOptions(false);
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });
      if (image.base64String) {
        setSelectedImage(`data:image/${image.format};base64,${image.base64String}`);
      }
    } catch (e: any) {
      console.error("Gallery error:", e);
      if (e.message !== "User cancelled photos app") {
        setError("Could not access gallery.");
      }
    }
  };

  const handleSubmit = React.useCallback(async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage = input.trim();
    const userImage = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    
    const newUserMsg: ChatMessage = { 
      role: 'user', 
      content: userMessage, 
      image: userImage || undefined,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);
    setError(null);

    try {
      let apiKey = apiKeys[activeKeyIndex];
      if (!apiKey) {
        apiKey = process.env.GEMINI_API_KEY || '';
      }
      if (!apiKey) {
        setShowApiKeysModal(true);
        setMessages(prev => prev.slice(0, -1));
        setInput(userMessage);
        setSelectedImage(userImage);
        setError("Please add an API key first.");
        setIsLoading(false);
        return;
      }

      let text = "";

      if (apiKey.startsWith('sk-or-') || apiKey.startsWith('xai-') || apiKey.startsWith('sk-') || apiKey.startsWith('gsk_')) {
        let endpoint = 'https://api.openai.com/v1/chat/completions';
        let model = 'gpt-4o-mini';
        
        if (apiKey.startsWith('sk-or-')) {
          endpoint = 'https://openrouter.ai/api/v1/chat/completions';
          model = 'openrouter/auto';
        } else if (apiKey.startsWith('xai-')) {
          endpoint = 'https://api.x.ai/v1/chat/completions';
          model = 'grok-beta';
        } else if (apiKey.startsWith('gsk_')) {
          endpoint = 'https://api.groq.com/openai/v1/chat/completions';
          model = 'llama-3.3-70b-versatile';
        }

        const openAiMessages = [
          { role: 'system', content: "You are Beacon AI, a helpful study assistant for Stardesk. Help students solve their doubts clearly and concisely. Use markdown for formatting." },
          ...messages.map(m => {
            const content: any[] = [];
            if (m.content) {
              content.push({ type: "text", text: m.content });
            }
            if (m.image) {
              content.push({ type: "image_url", image_url: { url: m.image } });
            }
            return { role: m.role === 'model' ? 'assistant' : 'user', content };
          }),
          {
            role: 'user',
            content: [
              { type: "text", text: userMessage || "Analyze this image" },
              ...(userImage ? [{ type: "image_url", image_url: { url: userImage } }] : [])
            ]
          }
        ];

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${apiKey}`,
            ...(apiKey.startsWith('sk-or-') ? {
               'HTTP-Referer': window.location.href,
               'X-Title': 'Beacon AI'
            } : {})
          },
          body: JSON.stringify({
            model,
            messages: openAiMessages
          })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        text = data.choices[0].message.content;

      } else if (apiKey.startsWith('sk-ant-')) {
        const anthropicMessages = [
          ...messages.map(m => {
            const content: any[] = [];
            if (m.image) {
              const base64Data = m.image.split(',')[1];
              const mimeType = m.image.split(';')[0].split(':')[1];
              content.push({ type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } });
            }
            if (m.content) {
              content.push({ type: "text", text: m.content });
            }
            return { role: m.role === 'model' ? 'assistant' : 'user', content };
          }),
          {
            role: 'user',
            content: [
              ...(userImage ? [{ type: "image", source: { type: "base64", media_type: userImage.split(';')[0].split(':')[1], data: userImage.split(',')[1] } }] : []),
              { type: "text", text: userMessage || "Analyze this image" }
            ]
          }
        ];
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerously-allow-browser': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            system: "You are Beacon AI, a helpful study assistant. Help students solve their doubts clearly and concisely.",
            messages: anthropicMessages
          })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        text = data.content[0].text;

      } else {
        const ai = new GoogleGenAI({ apiKey });
        const model = "gemini-3.5-flash"; 
        
        const contents = [
          ...messages.map(m => ({
            role: m.role,
            parts: [
              ...(m.image ? [{ inlineData: { data: m.image.split(',')[1], mimeType: 'image/jpeg' } }] : []),
              { text: m.content || (m.image ? "Analyze this image" : "") }
            ]
          })),
          { 
            role: 'user', 
            parts: [
              ...(userImage ? [{ inlineData: { data: userImage.split(',')[1], mimeType: 'image/jpeg' } }] : []),
              { text: userMessage || "Analyze this image" }
            ] 
          }
        ];

        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: "You are Beacon AI, a helpful study assistant for Stardesk. Help students solve their doubts clearly and concisely. Use markdown for formatting. If an image is provided, analyze it carefully to help with the student's doubt.",
            }
          });

          if (!response.text) {
            throw new Error("No response from Gemini.");
          }
          text = response.text;
        } catch (e: any) {
          const stringifiedError = e instanceof Error ? e.message : String(e);
          if (stringifiedError.includes('403') || stringifiedError.includes('PERMISSION_DENIED')) {
             throw new Error("The default API key is restricted. Please add your own API key using the 'API Keys' menu at the top right.");
          }
          throw e;
        }
      }

      if (text) {
        const modelMsg: ChatMessage = { 
          role: 'model', 
          content: text,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, modelMsg]);
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      setError(err.message || "An error occurred while connecting to the AI.");
    } finally {
      setIsLoading(false);
    }
  }, [input, selectedImage, isLoading, messages, apiKeys, activeKeyIndex]);

  const clearChat = React.useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyInput.trim()) return;
    setApiKeys(prev => [...prev, newKeyInput.trim()]);
    setNewKeyInput('');
    if (apiKeys.length === 0) setActiveKeyIndex(0);
  };

  const removeKey = (index: number) => {
    const newKeys = apiKeys.filter((_, i) => i !== index);
    setApiKeys(newKeys);
    if (activeKeyIndex === index) {
      setActiveKeyIndex(Math.max(0, newKeys.length - 1));
    } else if (activeKeyIndex > index) {
      setActiveKeyIndex(prev => prev - 1);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative">
      <div className="absolute top-4 right-4 z-20">
        <button 
          onClick={() => setShowApiKeysModal(true)} 
          className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full shadow-sm hover:scale-105 transition-transform"
        >
          <Key size={14} /> API Keys
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 pt-16 p-4 space-y-4">
        {loadingMessages ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-3xl mb-4">
              <MessageCircleQuestion size={32} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Ask anything! I'm Beacon AI, ready to help you with your studies.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none shadow-md'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm'
              }`}>
                {msg.image && (
                  <img 
                    src={msg.image} 
                    alt="Doubt" 
                    className="w-full rounded-lg mb-2 shadow-sm border border-white/20" 
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${msg.role === 'user' ? 'text-white' : ''}`}>
                  <ReactMarkdown>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
              <span className="text-[9px] font-bold text-slate-400 mt-1 px-1">
                {formatTime(msg.timestamp)}
              </span>
            </motion.div>
          ))
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-2">
              <Loader2 className="animate-spin text-indigo-600" size={16} />
              <span className="text-xs font-medium text-slate-500">Beacon AI is thinking...</span>
            </div>
          </motion.div>
        )}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-100 dark:border-rose-800/50 flex items-center gap-3">
            <AlertCircle className="text-rose-500" size={16} />
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
          </div>
        )}
      </div>

        {/* Input */}
      <div className="relative">
        <AnimatePresence>
          {showApiKeysModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowApiKeysModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Key size={20} className="text-indigo-600" /> API Keys
                  </h3>
                  <button onClick={() => setShowApiKeysModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X size={24} />
                  </button>
                </div>
                
                <p className="text-xs text-slate-500 mb-4">Add your API keys here (Gemini, OpenRouter, Grok, Claude, OpenAI, Groq). You can switch between them if one runs out of quota. Keys are stored locally on your device.</p>
                
                <div className="space-y-3 max-h-48 overflow-y-auto mb-4 p-1">
                  {apiKeys.length === 0 ? (
                    <div className="text-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium">No keys added yet.</p>
                    </div>
                  ) : (
                    apiKeys.map((key, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${activeKeyIndex === idx ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                        <div className="flex-1 overflow-hidden" onClick={() => setActiveKeyIndex(idx)}>
                          <p className="text-xs font-mono truncate text-slate-600 dark:text-slate-300 font-medium cursor-pointer">
                            {key.replace(/(.{4}).*(.{4})/, '$1....$2')}
                          </p>
                          {activeKeyIndex === idx && <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Active Key</span>}
                        </div>
                        <button onClick={() => removeKey(idx)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg ml-2">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddKey} className="flex gap-2">
                  <input
                    type="password"
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    placeholder="Enter API Key"
                    className="flex-1 bg-slate-100 dark:bg-slate-900 border-none rounded-xl p-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="submit" className="bg-indigo-600 text-white p-3 rounded-xl active:scale-95 transition-transform flex items-center justify-center">
                    <Plus size={20} />
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAttachmentOptions && (
            <>
              {/* Invisible backdrop to dismiss popover */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setShowAttachmentOptions(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-4 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 flex flex-col p-1 w-48"
              >
                <button 
                  onClick={takePhoto}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors flex items-center gap-3"
                >
                  <CameraIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Take a photo
                </button>
                <button 
                  onClick={choosePhoto}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors flex items-center gap-3"
                >
                  <ImageIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Choose a file
                </button>
              </motion.div>
            </>
          )}

          {selectedImage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3 z-30"
            >
              <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-600">
                <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-0 right-0 bg-rose-500 text-white p-0.5 rounded-bl-lg shadow-sm"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="text-xs text-slate-500 font-medium italic">Image ready to send...</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div>
          <MessageBar
            value={input}
            onChange={setInput}
            onSend={handleSubmit}
            onAttachment={handleAttachmentClick}
            placeholder="Ask a doubt..."
            isLoading={isLoading}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

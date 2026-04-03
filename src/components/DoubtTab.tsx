import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { MessageCircleQuestion, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import MessageBar from './MessageBar';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChatActiveChange?.(true);
    return () => onChatActiveChange?.(false);
  }, [onChatActiveChange]);

  useEffect(() => {
    const saved = localStorage.getItem('stardesk_doubts');
    if (saved) {
      setMessages(JSON.parse(saved));
    }
    setLoadingMessages(false);
  }, []);

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

  const handleCameraClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

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
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini service is not configured. Please check your environment.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview"; 
      
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

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: "You are a helpful study assistant for Stardesk. Help students solve their doubts clearly and concisely. Use markdown for formatting. If an image is provided, analyze it carefully to help with the student's doubt.",
        }
      });

      const text = response.text;
      if (text) {
        const modelMsg: ChatMessage = { 
          role: 'model', 
          content: text,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, modelMsg]);
      } else {
        throw new Error("No response from Gemini.");
      }
    } catch (err: any) {
      console.error("Gemini Error:", err);
      setError(err.message || "An error occurred while connecting to Gemini.");
    } finally {
      setIsLoading(false);
    }
  }, [input, selectedImage, isLoading, messages]);

  const clearChat = React.useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
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
              Ask anything! I'm powered by Gemini to help you with your studies.
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
              <span className="text-xs font-medium text-slate-500">Gemini is thinking...</span>
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
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3"
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
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
        />
        
        <MessageBar
          value={input}
          onChange={setInput}
          onSend={handleSubmit}
          onCamera={handleCameraClick}
          placeholder="Ask a doubt..."
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

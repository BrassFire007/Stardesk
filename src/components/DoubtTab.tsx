import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { MessageCircleQuestion, AlertCircle, Loader2, Trash2, Camera as CameraIcon, Image as ImageIcon } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
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
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [shakeSticker, setShakeSticker] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const triggerStickerShake = () => {
    setShakeSticker(prev => prev + 1);
  };

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
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please add your GEMINI_API_KEY in the AI Studio 'Settings > Secrets' panel and rebuild the app.");
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
        {/* Coming Soon Sticker */}
        <div className="absolute top-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <motion.div
            animate={{ 
              rotate: -10, 
              x: shakeSticker % 2 === 0 ? 0 : [-5, 5, -5, 0] 
            }}
            transition={{ duration: 0.4 }}
            className="bg-yellow-400 p-2 rounded-lg shadow-lg border-2 border-yellow-500 transform -rotate-10 pointer-events-auto"
            onClick={triggerStickerShake}
          >
            <p className="text-yellow-900 font-black text-xs uppercase tracking-wider">
              Gemini Coming Soon!
            </p>
          </motion.div>
        </div>

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
        
        <div onClick={triggerStickerShake}>
          <MessageBar
            value=""
            onChange={() => {}}
            onSend={() => {}}
            onAttachment={handleAttachmentClick}
            placeholder="Ask a doubt..."
            isLoading={false}
            disabled={true}
          />
        </div>
      </div>
    </div>
  );
}

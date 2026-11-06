import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MessageCircleQuestion, AlertCircle, Loader2, Trash2, Camera as CameraIcon, Image as ImageIcon, RotateCcw } from 'lucide-react';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChatActiveChange?.(true);
    return () => onChatActiveChange?.(false);
  }, [onChatActiveChange]);

  useEffect(() => {
    try {
      const savedDoubts = localStorage.getItem('stardesk_doubts');
      if (savedDoubts) {
        setMessages(JSON.parse(savedDoubts));
      }
    } catch (e) {
      console.error("Failed to load saved doubts:", e);
    }
    setLoadingMessages(false);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('stardesk_doubts', JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save doubts:", e);
    }
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

  const executeStream = React.useCallback(async (historyMessages: ChatMessage[]) => {
    setIsLoading(true);
    setError(null);
    let streamStarted = false;

    try {
      const contents = historyMessages.map(m => ({
        role: m.role,
        parts: [
          ...(m.image ? [{ 
            inlineData: { 
              data: m.image.split(',')[1] || '', 
              mimeType: (m.image.split(';')[0].split(':')[1]) || 'image/jpeg' 
            } 
          }] : []),
          { text: m.content || (m.image ? "Analyze this image" : "") }
        ]
      }));

      const response = await fetch("/api/gemini/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          contents,
          config: {
            systemInstruction: "You are Beacon AI, a helpful study assistant for Stardesk. Help students solve their doubts clearly, patiently, and concisely. Format all mathematical symbols, equations, and variables using LaTeX: enclose inline math in $...$ (e.g. $x^2 + y^2 = r^2$ or $\\frac{a}{b}$) and block math in $$...$$. Use markdown for headings, bold text, lists, and tables. If an image is provided, analyze it thoroughly to solve the student's doubt step-by-step.",
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to connect to Beacon AI." }));
        throw new Error(errorData.error || "Failed to connect to Beacon AI.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream available.");

      const decoder = new TextDecoder();
      let fullText = "";
      
      // Add empty message for model to start streaming into
      setMessages(prev => [...prev, { role: 'model', content: '', timestamp: new Date().toISOString() }]);
      streamStarted = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) throw new Error(data.error);
              if (data.text) {
                fullText += data.text;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  if (newMsgs.length > 0) {
                    newMsgs[newMsgs.length - 1] = {
                      ...newMsgs[newMsgs.length - 1],
                      content: fullText
                    };
                  }
                  return newMsgs;
                });
              }
            } catch (e: any) {
              if (e.message && !e.message.includes("JSON")) {
                throw e;
              }
            }
          }
        }
      }

      if (!fullText.trim()) {
        throw new Error("No response received from Beacon AI. Please try again.");
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      if (streamStarted) {
        // Remove empty placeholder if nothing was streamed
        setMessages(prev => {
          if (prev.length > 0 && prev[prev.length - 1].role === 'model' && !prev[prev.length - 1].content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
      setError(err.message || "An error occurred while connecting to Beacon AI.");
    } finally {
      setIsLoading(false);
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

    const nextHistory = [...messages, newUserMsg];
    setMessages(nextHistory);
    await executeStream(nextHistory);
  }, [input, selectedImage, isLoading, messages, executeStream]);

  const handleRetry = React.useCallback(async () => {
    if (isLoading || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'user') return;
    await executeStream(messages);
  }, [isLoading, messages, executeStream]);

  const clearChat = React.useCallback(() => {
    setMessages([]);
    localStorage.removeItem('stardesk_doubts');
    setError(null);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative">
      <div className="absolute top-4 right-4 z-20">
        {messages.length > 0 && (
          <button 
            onClick={clearChat} 
            title="Clear chat"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 hover:border-rose-200 transition-colors"
          >
            <Trash2 size={13} /> Clear
          </button>
        )}
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
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
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
          <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-100 dark:border-rose-800/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="text-rose-500 shrink-0" size={16} />
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium truncate">{error}</p>
            </div>
            {messages.length > 0 && messages[messages.length - 1].role === 'user' && !isLoading && (
              <button
                onClick={handleRetry}
                className="shrink-0 flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-100/70 dark:bg-rose-900/40 transition-colors shadow-xs"
              >
                <RotateCcw size={12} /> Retry
              </button>
            )}
          </div>
        )}
      </div>

        {/* Input */}
      <div className="relative">


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

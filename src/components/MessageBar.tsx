import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Camera, Loader2 } from 'lucide-react';

interface MessageBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  onCamera?: () => void;
  className?: string;
}

export const MessageBar: React.FC<MessageBarProps> = ({
  value,
  onChange,
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  isLoading = false,
  onCamera,
  className = ""
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max height 120px
      textarea.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled && !isLoading) {
        onSend();
      }
    }
  }, [value, disabled, isLoading, onSend]);

  const handleSend = React.useCallback((e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled && !isLoading) {
      onSend();
    }
  }, [value, disabled, isLoading, onSend]);

  return (
    <div className={`p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 transition-colors ${className}`}>
      <div className="max-w-3xl mx-auto flex items-end gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm focus-within:shadow-md focus-within:border-indigo-300 dark:focus-within:border-indigo-900/50 transition-all outline-none">
        
        {/* Camera Button (Optional) */}
        {onCamera && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onCamera}
            className="p-2.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-white dark:hover:bg-slate-800 shadow-none hover:shadow-sm"
          >
            <Camera size={20} />
          </motion.button>
        )}

        {/* Input Field */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm py-2.5 px-1 resize-none min-h-[40px] max-h-[120px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 scrollbar-hide"
        />

        {/* Send Button */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="p-2.5 text-indigo-600 dark:text-indigo-400"
            >
              <Loader2 size={20} className="animate-spin" />
            </motion.div>
          ) : (
            <motion.button
              key="send"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              className={`p-2.5 rounded-full transition-all flex items-center justify-center ${
                value.trim() 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}
            >
              <Send size={20} className={value.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      
      {/* Typing Indicator (Optional dots) */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex justify-center gap-1 mt-2"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                className="w-1 h-1 rounded-full bg-indigo-400"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MessageBar;

import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useSpring } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, disabled }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const yRaw = useMotionValue(0);
  const y = useSpring(yRaw, { damping: 20, stiffness: 150 });
  
  const rotate = useTransform(yRaw, [0, 100], [0, 360]);
  const opacity = useTransform(yRaw, [0, 50, 100], [0, 0.5, 1]);
  
  const startY = useRef(0);
  const startX = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing || disabled) return;
      if (container.scrollTop <= 1) {
        startY.current = e.touches[0].pageY;
        startX.current = e.touches[0].pageX;
        pulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling.current || isRefreshing) return;
      
      const currentY = e.touches[0].pageY;
      const currentX = e.touches[0].pageX;
      const diffY = currentY - startY.current;
      const diffX = Math.abs(currentX - startX.current);
      
      // If horizontal movement is more than vertical, it's probably a swipe, not a pull
      if (diffX > Math.abs(diffY) && diffX > 20) {
        pulling.current = false;
        yRaw.set(0);
        setPullProgress(0);
        return;
      }

      if (diffY > 0 && container.scrollTop <= 1) {
        // Resistance: logarithmic-like feel
        const pull = Math.min(diffY * 0.4, 150);
        yRaw.set(pull);
        setPullProgress(Math.min(pull / 100, 1));
        
        if (diffY > 10) {
          if (e.cancelable) e.preventDefault();
        }
      } else if (diffY < 0) {
        pulling.current = false;
        yRaw.set(0);
        setPullProgress(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!pulling.current || isRefreshing) return;
      pulling.current = false;
      
      if (yRaw.get() >= 100) {
        setIsRefreshing(true);
        yRaw.set(60);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          yRaw.set(0);
          setPullProgress(0);
        }
      } else {
        yRaw.set(0);
        setPullProgress(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, yRaw, disabled]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-hide relative min-h-0 overscroll-none">
      <motion.div 
        style={{ y }}
        className="flex-1 flex flex-col min-h-0 overflow-x-hidden"
      >
        {/* Refresh Indicator */}
        <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none" style={{ transform: 'translateY(-100%)' }}>
          <motion.div 
            style={{ opacity, rotate, y: 40 }}
            className="bg-white dark:bg-slate-800 p-2.5 rounded-full shadow-xl border border-slate-100 dark:border-slate-700 z-50"
          >
            <RefreshCw 
              size={22} 
              className={`text-indigo-600 dark:text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} 
            />
          </motion.div>
        </div>
        
        {children}
      </motion.div>
    </div>
  );
};

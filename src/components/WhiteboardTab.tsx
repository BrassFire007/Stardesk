import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  PenTool, 
  Eraser, 
  Download, 
  FilePlus, 
  Home, 
  RotateCcw, 
  Sparkles, 
  X, 
  AlertCircle, 
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import MessageBar from './MessageBar';

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface WhiteboardPage {
  id: string;
  name: string;
  strokes: Stroke[];
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string;
}

export default function WhiteboardTab({ onBack }: { onBack?: () => void }) {
  const [pages, setPages] = useState<WhiteboardPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Zoom and Pan state: 0.25x (zoom out) to 3.0x (zoom in)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  
  // Sync refs to avoid stale closures in event handlers
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<Stroke | null>(null);

  // Beacon AI Vision state
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [aiFollowUpInput, setAiFollowUpInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const solutionEndRef = useRef<HTMLDivElement>(null);

  // Gesture tracking refs
  const touchStateRef = useRef<{
    mode: 'none' | 'draw' | 'pinch_pan';
    initialDistance: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    initialMidpoint: { x: number; y: number };
  }>({
    mode: 'none',
    initialDistance: 0,
    initialZoom: 1,
    initialPan: { x: 0, y: 0 },
    initialMidpoint: { x: 0, y: 0 }
  });

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('stardesk_whiteboard_pages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPages(parsed);
        if (parsed.length > 0) {
          setActivePageId(parsed[0].id);
        } else {
          createNewPage();
        }
      } catch (e) {
        console.error("Failed to parse whiteboard pages", e);
        createNewPage();
      }
    } else {
      createNewPage();
    }
  }, []);

  // Save to local storage on pages change
  useEffect(() => {
    if (pages.length > 0) {
      localStorage.setItem('stardesk_whiteboard_pages', JSON.stringify(pages));
    }
  }, [pages]);

  const activePage = pages.find(p => p.id === activePageId);

  // Redraw canvas with zoom & pan transforms
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePage) return;
    
    // Set actual canvas resolution to match display size
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Reset any previous transform & clear entire canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const isDarkMode = document.documentElement.classList.contains('dark');

    // Apply current pan and zoom
    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);

    // Draw all strokes in world coordinate space
    activePage.strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;

      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const isStrokeEraser = stroke.color === '#ffffff';
      if (isStrokeEraser) {
        ctx.strokeStyle = isDarkMode ? '#1e293b' : '#ffffff';
      } else {
        ctx.strokeStyle = stroke.color;
      }
      
      ctx.lineWidth = stroke.width;

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    ctx.restore();
  }, [activePage]);

  // Redraw canvas when active page, zoom, or pan changes
  useEffect(() => {
    redrawCanvas();
  }, [activePageId, zoom, pan, redrawCanvas]);

  const createNewPage = () => {
    const newPage: WhiteboardPage = {
      id: Date.now().toString(),
      name: `Board ${pages.length + 1}`,
      strokes: []
    };
    setPages(prev => [...prev, newPage]);
    setActivePageId(newPage.id);
  };

  const deletePage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPages(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activePageId === id) {
        if (filtered.length > 0) {
          setActivePageId(filtered[0].id);
        } else {
          setActivePageId(null);
        }
      }
      return filtered;
    });
    if (pages.length === 1 && pages[0].id === id) {
       createNewPage();
    }
  };

  // Convert screen coordinates into world canvas coordinates (accounting for zoom and pan)
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return {
      x: (screenX - panRef.current.x) / zoomRef.current,
      y: (screenY - panRef.current.y) / zoomRef.current
    };
  }, []);

  // Helper to calculate distance between two touch points
  const getTouchDistance = (t1: React.Touch | Touch, t2: React.Touch | Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Helper to calculate midpoint between two touches
  const getTouchMidpoint = (t1: React.Touch | Touch, t2: React.Touch | Touch) => {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };
  };

  // Handle Mouse Wheel Zoom & Pan
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentZ = zoomRef.current;
    const currentP = panRef.current;

    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(Math.max(currentZ * factor, 0.25), 3.0);

    const newPanX = mouseX - (mouseX - currentP.x) * (newZoom / currentZ);
    const newPanY = mouseY - (mouseY - currentP.y) * (newZoom / currentZ);

    zoomRef.current = newZoom;
    panRef.current = { x: newPanX, y: newPanY };
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  // Attach non-passive native wheel listener to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Touch Handlers for 1-finger drawing vs 2-finger zoom/pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      if (isDrawing) {
        setIsDrawing(false);
        currentPathRef.current = null;
        redrawCanvas();
      }
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = getTouchDistance(t1, t2);
      const mid = getTouchMidpoint(t1, t2);

      touchStateRef.current = {
        mode: 'pinch_pan',
        initialDistance: dist,
        initialZoom: zoomRef.current,
        initialPan: { ...panRef.current },
        initialMidpoint: mid
      };
      return;
    }

    if (e.touches.length === 1 && touchStateRef.current.mode !== 'pinch_pan') {
      touchStateRef.current.mode = 'draw';
      setIsDrawing(true);
      const worldPoint = screenToWorld(e.touches[0].clientX, e.touches[0].clientY);
      
      currentPathRef.current = {
        points: [worldPoint],
        color: isEraser ? '#ffffff' : color,
        width: isEraser ? 20 : lineWidth
      };

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.translate(panRef.current.x, panRef.current.y);
        ctx.scale(zoomRef.current, zoomRef.current);
        ctx.beginPath();
        ctx.moveTo(worldPoint.x, worldPoint.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentPathRef.current.color;
        ctx.lineWidth = currentPathRef.current.width;
        ctx.restore();
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = getTouchDistance(t1, t2);
      const mid = getTouchMidpoint(t1, t2);

      const state = touchStateRef.current;
      if (state.mode !== 'pinch_pan' || state.initialDistance <= 0) {
        touchStateRef.current = {
          mode: 'pinch_pan',
          initialDistance: dist,
          initialZoom: zoomRef.current,
          initialPan: { ...panRef.current },
          initialMidpoint: mid
        };
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const midX = mid.x - rect.left;
      const midY = mid.y - rect.top;

      const scaleMultiplier = dist / state.initialDistance;
      const targetZoom = Math.min(Math.max(state.initialZoom * scaleMultiplier, 0.25), 3.0);

      const panDeltaX = mid.x - state.initialMidpoint.x;
      const panDeltaY = mid.y - state.initialMidpoint.y;

      const newPanX = midX - (midX - state.initialPan.x) * (targetZoom / state.initialZoom) + panDeltaX;
      const newPanY = midY - (midY - state.initialPan.y) * (targetZoom / state.initialZoom) + panDeltaY;

      zoomRef.current = targetZoom;
      panRef.current = { x: newPanX, y: newPanY };
      setZoom(targetZoom);
      setPan({ x: newPanX, y: newPanY });
      return;
    }

    if (e.touches.length === 1 && touchStateRef.current.mode === 'draw' && isDrawing && currentPathRef.current) {
      e.preventDefault();
      const worldPoint = screenToWorld(e.touches[0].clientX, e.touches[0].clientY);
      const points = currentPathRef.current.points;
      const lastPoint = points[points.length - 1];

      if (Math.abs(worldPoint.x - lastPoint.x) > 1 || Math.abs(worldPoint.y - lastPoint.y) > 1) {
        points.push(worldPoint);

        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.translate(panRef.current.x, panRef.current.y);
          ctx.scale(zoomRef.current, zoomRef.current);
          
          const isDarkMode = document.documentElement.classList.contains('dark');
          if (isEraser) {
            ctx.strokeStyle = isDarkMode ? '#1e293b' : '#ffffff';
          } else {
            ctx.strokeStyle = currentPathRef.current.color;
          }
          ctx.lineWidth = currentPathRef.current.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(worldPoint.x, worldPoint.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      if (touchStateRef.current.mode === 'draw' && isDrawing && currentPathRef.current && activePageId) {
        const stroke = currentPathRef.current;
        if (stroke.points.length > 0) {
          setPages(prev => prev.map(p => 
            p.id === activePageId 
              ? { ...p, strokes: [...p.strokes, stroke] }
              : p
          ));
        }
      }
      setIsDrawing(false);
      currentPathRef.current = null;
      touchStateRef.current.mode = 'none';
      redrawCanvas();
    } else if (e.touches.length === 1) {
      touchStateRef.current.mode = 'none';
      setIsDrawing(false);
      currentPathRef.current = null;
    }
  };

  // Mouse Handlers for Desktop drawing
  const startDrawingMouse = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDrawing(true);
    const worldPoint = screenToWorld(e.clientX, e.clientY);
    
    currentPathRef.current = {
      points: [worldPoint],
      color: isEraser ? '#ffffff' : color,
      width: isEraser ? 20 : lineWidth
    };

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.beginPath();
      ctx.moveTo(worldPoint.x, worldPoint.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = currentPathRef.current.color;
      ctx.lineWidth = currentPathRef.current.width;
      ctx.restore();
    }
  };

  const drawMouse = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing || !currentPathRef.current) return;

    const worldPoint = screenToWorld(e.clientX, e.clientY);
    const points = currentPathRef.current.points;
    const lastPoint = points[points.length - 1];

    if (Math.abs(worldPoint.x - lastPoint.x) > 1 || Math.abs(worldPoint.y - lastPoint.y) > 1) {
      points.push(worldPoint);

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.translate(panRef.current.x, panRef.current.y);
        ctx.scale(zoomRef.current, zoomRef.current);
        
        const isDarkMode = document.documentElement.classList.contains('dark');
        if (isEraser) {
          ctx.strokeStyle = isDarkMode ? '#1e293b' : '#ffffff';
        } else {
          ctx.strokeStyle = currentPathRef.current.color;
        }
        ctx.lineWidth = currentPathRef.current.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(worldPoint.x, worldPoint.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const stopDrawingMouse = () => {
    if (isDrawing && currentPathRef.current && activePageId) {
      const stroke = currentPathRef.current;
      if (stroke.points.length > 0) {
        setPages(prev => prev.map(p => 
          p.id === activePageId 
            ? { ...p, strokes: [...p.strokes, stroke] }
            : p
        ));
      }
    }
    setIsDrawing(false);
    currentPathRef.current = null;
    redrawCanvas();
  };

  // Re-draw when window resizes to maintain resolution
  useEffect(() => {
    const handleResize = () => redrawCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  const clearCanvas = () => {
    if (!activePageId) return;
    setPages(prev => prev.map(p => 
      p.id === activePageId ? { ...p, strokes: [] } : p
    ));
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const resetZoomAndPan = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Capture canvas cleanly for AI vision (white background with black/colored strokes for maximum OCR accuracy)
  const captureCanvasImage = useCallback((): string | null => {
    if (!activePage || activePage.strokes.length === 0) {
      return null;
    }

    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Create an offscreen canvas to render a clean, high-contrast, bounded snapshot
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(canvas.width, 800);
    offscreen.height = Math.max(canvas.height, 600);

    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    // Fill white background for clear readability
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // If canvas is currently panned/zoomed, we can render the current view or centered strokes
    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);

    activePage.strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Keep eraser white
      if (stroke.color === '#ffffff') {
        ctx.strokeStyle = '#ffffff';
      } else {
        ctx.strokeStyle = stroke.color;
      }
      ctx.lineWidth = stroke.width;

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    ctx.restore();

    return offscreen.toDataURL('image/jpeg', 0.88);
  }, [activePage]);

  // Execute Gemini Streaming API for Whiteboard Problem Solving
  const executeAiStream = useCallback(async (messagesHistory: ChatMessage[]) => {
    setIsAiLoading(true);
    setAiError(null);
    let streamStarted = false;

    try {
      const contents = messagesHistory.map(m => ({
        role: m.role,
        parts: [
          ...(m.image ? [{
            inlineData: {
              data: m.image.split(',')[1] || '',
              mimeType: (m.image.split(';')[0].split(':')[1]) || 'image/jpeg'
            }
          }] : []),
          { text: m.content || "Please analyze the handwritten problem, question, or diagram on this whiteboard and provide a step-by-step mathematical/scientific solution." }
        ]
      }));

      const response = await fetch("/api/gemini/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          contents,
          config: {
            systemInstruction: "You are Beacon AI, the expert academic problem solver inside the Stardesk Whiteboard. The student has drawn or written a math, science, engineering, or general academic problem/diagram on their canvas.\n\n1. Transcribe the problem clearly under a '## Problem Statement' heading.\n2. Provide a clear, structured, step-by-step solution with explanations for each step.\n3. Clearly highlight the final answer or conclusion in a '## Final Answer' box or bold text.\n4. Format all mathematical symbols, equations, and variables using standard LaTeX: inline math in $...$ (e.g. $x^2 + 5x + 6 = 0$, $\\frac{a}{b}$) and block equations in $$...$$.\n5. Be patient, rigorous, and supportive.",
          }
        })
      });

      if (!response.ok) {
        let errMessage = "Failed to solve problem";
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch {
          errMessage = `Server error: ${response.statusText || response.status}`;
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error("No readable stream response from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      // Append placeholder for assistant response
      setAiMessages(prev => [...prev, { role: 'model', content: '' }]);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") {
              done = true;
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                streamStarted = true;
                setAiMessages(prev => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  if (lastIndex >= 0 && updated[lastIndex].role === 'model') {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: updated[lastIndex].content + parsed.text
                    };
                  }
                  return updated;
                });
              }
            } catch (jsonErr: any) {
              if (jsonErr.message && !jsonErr.message.includes("Unexpected token")) {
                throw jsonErr;
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Beacon AI Whiteboard Error:", err);
      let errMsg = err?.message || "Failed to solve the whiteboard problem.";
      if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) {
        errMsg = "Beacon AI is experiencing high demand. Please tap Retry in a few seconds.";
      }
      setAiError(errMsg);
      if (!streamStarted) {
        setAiMessages(prev => {
          if (prev.length > 0 && prev[prev.length - 1].role === 'model' && !prev[prev.length - 1].content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    } finally {
      setIsAiLoading(false);
    }
  }, []);

  // Trigger Beacon AI problem solving
  const handleAskBeacon = () => {
    if (!activePage || activePage.strokes.length === 0) {
      setToastMessage("Draw or write a problem on the whiteboard first!");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const dataUrl = captureCanvasImage();
    if (!dataUrl) {
      setToastMessage("Could not capture whiteboard. Please try again.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setCapturedImage(dataUrl);
    setAiError(null);
    setIsAiSheetOpen(true);
    setIsExpanded(false);

    const initialUserMsg: ChatMessage = {
      role: 'user',
      content: "Please inspect this whiteboard problem and provide a complete step-by-step solution with formulas.",
      image: dataUrl
    };

    setAiMessages([initialUserMsg]);
    executeAiStream([initialUserMsg]);
  };

  // Follow-up question submission
  const handleSendFollowUp = () => {
    if (!aiFollowUpInput.trim() || isAiLoading) return;
    const text = aiFollowUpInput.trim();
    setAiFollowUpInput('');

    const followUpMsg: ChatMessage = {
      role: 'user',
      content: text
    };

    const nextHistory = [...aiMessages, followUpMsg];
    setAiMessages(nextHistory);
    executeAiStream(nextHistory);
  };

  // Retry previous AI call
  const handleRetryAi = () => {
    if (aiMessages.length === 0) return;
    // Remove last empty model response if present
    const cleaned = aiMessages.filter((m, i) => !(i === aiMessages.length - 1 && m.role === 'model' && !m.content));
    setAiMessages(cleaned);
    executeAiStream(cleaned);
  };

  // Auto-scroll solution content on stream update
  useEffect(() => {
    if (isAiSheetOpen) {
      solutionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, isAiLoading]);

  const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];
  const isTransformed = Math.abs(zoom - 1) > 0.02 || Math.abs(pan.x) > 5 || Math.abs(pan.y) > 5;

  return (
    <div className="absolute inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col select-none overflow-hidden">
      <div className="flex-1 relative w-full h-full bg-white dark:bg-slate-800 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawingMouse}
          onMouseMove={drawMouse}
          onMouseUp={stopDrawingMouse}
          onMouseLeave={stopDrawingMouse}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="absolute inset-0 w-full h-full cursor-crosshair bg-white dark:bg-slate-800 touch-none"
        />

        {/* Top Floating Bar */}
        <div className="absolute top-[env(safe-area-inset-top,16px)] left-4 right-4 z-50 flex items-center gap-2">
          {/* Back to Home Button */}
          <button
            onClick={() => onBack?.()}
            className="p-3 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0"
            title="Back to Home"
          >
            <Home size={22} />
          </button>
          
          {/* Scrollable Tabs */}
          <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
            {pages.map(page => (
              <button
                key={page.id}
                onClick={() => setActivePageId(page.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap text-sm font-bold transition-all ${
                  activePageId === page.id 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {page.name}
                {pages.length > 1 && (
                  <Trash2 
                    size={14} 
                    className={`ml-1 hover:text-red-400 ${activePageId === page.id ? 'text-indigo-200' : 'text-slate-400'}`}
                    onClick={(e) => deletePage(page.id, e)}
                  />
                )}
              </button>
            ))}
            <button
              onClick={createNewPage}
              className="flex items-center justify-center min-w-[40px] px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              title="New Whiteboard"
            >
              <FilePlus size={18} />
            </button>
          </div>
        </div>

        {/* Floating Zoom & Pan Reset Indicator */}
        <AnimatePresence>
          {isTransformed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute top-[calc(env(safe-area-inset-top,16px)+64px)] right-4 z-40"
            >
              <button
                onClick={resetZoomAndPan}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-full shadow-md text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all"
                title="Reset zoom to 100%"
              >
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  {Math.round(zoom * 100)}%
                </span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <RotateCcw size={12} />
                  Reset
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty Canvas Toast Prompt */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md border border-slate-700 flex items-center gap-2"
            >
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Whiteboard Floating Toolbar */}
        <div className="absolute bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-200/60 dark:border-slate-700/60 rounded-full px-3 sm:px-4 py-2 flex items-center gap-2 z-40 w-max max-w-[96vw]">
          {!isEraser && (
            <div className="flex gap-1.5 border-r border-slate-200 dark:border-slate-700 pr-2 mr-1 overflow-x-auto scrollbar-hide py-1">
               {COLORS.filter(c => c !== '#ffffff').map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full border-2 ${color === c ? 'border-primary shadow-md scale-110' : 'border-transparent opacity-80 hover:opacity-100'} transition-all`}
                  style={{ backgroundColor: c }}
                  title="Color Picker"
                />
              ))}
            </div>
          )}
          
          <button
            onClick={() => setIsEraser(false)}
            className={`p-2 shrink-0 rounded-full transition-colors ${!isEraser ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
            title="Pen"
          >
            <PenTool size={20} />
          </button>
          
          <button
            onClick={() => setIsEraser(true)}
            className={`p-2 shrink-0 rounded-full transition-colors ${isEraser ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
            title="Eraser"
          >
            <Eraser size={20} />
          </button>

          <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>

          {/* 🌟 Beacon AI Whiteboard Vision Button 🌟 */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleAskBeacon}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-md shadow-indigo-500/20 text-xs font-bold transition-all shrink-0 cursor-pointer"
            title="Beacon AI: Solve Whiteboard Problem"
          >
            <Sparkles size={16} className="animate-pulse" />
            <span className="hidden sm:inline">Ask Beacon</span>
            <span className="sm:hidden">Beacon</span>
          </motion.button>
          
          <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>
          
          <button
            onClick={clearCanvas}
            className="p-2 shrink-0 rounded-full text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Clear All"
          >
            <Trash2 size={20} />
          </button>
          
          <button
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) {
                 const link = document.createElement('a');
                 link.download = `${activePage?.name || 'whiteboard'}.png`;
                 link.href = canvas.toDataURL();
                 link.click();
              }
            }}
            className="p-2 shrink-0 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
            title="Download Whiteboard"
          >
            <Download size={20} />
          </button>
        </div>

        {/* 📋 Floating Beacon AI Solution Bottom Sheet Modal 📋 */}
        <AnimatePresence>
          {isAiSheetOpen && (
            <div className="fixed inset-0 z-[110] flex items-end justify-center pointer-events-none">
              {/* Dimmed Backdrop (tappable to close) */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAiSheetOpen(false)}
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs pointer-events-auto"
              />

              {/* Bottom Sheet Drawer */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className={`relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col pointer-events-auto overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'h-[92vh]' : 'h-[75vh] max-h-[640px]'
                } sm:mb-6 sm:mx-4`}
              >
                {/* Drag Handle */}
                <div 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 cursor-pointer"
                  title="Click to toggle expand"
                />

                {/* Sheet Header */}
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                          Beacon AI Solver
                        </h3>
                        {isAiLoading && (
                          <span className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                            Analyzing canvas...
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Visual solution & explanation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Expand/Compress Button */}
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>

                    {/* Close Button */}
                    <button
                      onClick={() => setIsAiSheetOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Sheet Content Area */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {/* Thumbnail of Whiteboard Canvas Analyzed */}
                  {capturedImage && (
                    <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                      <img 
                        src={capturedImage} 
                        alt="Whiteboard Capture" 
                        className="w-16 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs" 
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Captured Snapshot
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                          {activePage?.name || 'Active Whiteboard'} ({activePage?.strokes.length || 0} strokes)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Messages / Solutions */}
                  {aiMessages.map((msg, index) => {
                    if (msg.role === 'user' && index === 0) {
                      // Skip rendering the initial system trigger prompt
                      return null;
                    }

                    const isUser = msg.role === 'user';
                    return (
                      <div key={index} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                            <Sparkles size={14} />
                          </div>
                        )}
                        <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                          isUser 
                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm' 
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700/80 shadow-xs'
                        }`}>
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
                              {msg.content ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              ) : isAiLoading ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                                  <span className="ml-1">Solving problem step-by-step...</span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Error State with In-Place Retry */}
                  {aiError && (
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/50 flex items-start gap-3">
                      <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                          {aiError}
                        </p>
                        <button
                          onClick={handleRetryAi}
                          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs active:scale-95 transition-all"
                        >
                          <RefreshCw size={12} />
                          Retry Solution
                        </button>
                      </div>
                    </div>
                  )}

                  <div ref={solutionEndRef} />
                </div>

                {/* Follow-Up Input Message Bar */}
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                  <MessageBar
                    value={aiFollowUpInput}
                    onChange={setAiFollowUpInput}
                    onSend={handleSendFollowUp}
                    placeholder="Ask a follow-up question (e.g. explain step 2)..."
                    disabled={isAiLoading}
                    isLoading={isAiLoading}
                    className="p-0 border-0 bg-transparent"
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

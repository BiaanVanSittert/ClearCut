import React, { useEffect, useRef, useState, useCallback } from 'react';
import { segmentForeground } from '@imgly/background-removal';
import { getMagicWandMask } from '../utils/magicWand';
import { Download, Eraser, Sparkles, Wand2, Loader2, Undo2, ZoomIn, ZoomOut, Maximize, Paintbrush, Check, Hand } from 'lucide-react';
import { saveProject } from '../utils/projectStorage';
import type { ProjectData } from '../utils/projectStorage';

interface WorkspaceProps {
  originalFile: File;
  originalUrl: string;
  projectData?: ProjectData | null;
  onSave?: (url: string) => void;
  onCancel?: () => void;
}

type Tool = 'ai' | 'eraser' | 'restore' | 'magic-wand' | 'pan';

export const Workspace: React.FC<WorkspaceProps> = ({ originalFile, originalUrl, projectData, onSave, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [activeTool, setActiveTool] = useState<Tool>('ai');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Settings
  const [brushSize, setBrushSize] = useState(20);
  const [wandTolerance, setWandTolerance] = useState(30);
  
  // Viewport/Zoom
  const [zoom, setZoom] = useState(1);
  
  // State
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  
  const [history, setHistory] = useState<ImageData[]>([]);
  const [wandMask, setWandMask] = useState<Uint8Array | null>(null);
  
  // Single-stroke logic for eraser/restore
  const [strokeSnapshot, setStrokeSnapshot] = useState<ImageData | null>(null);
  const [strokePoints, setStrokePoints] = useState<{x: number, y: number}[]>([]);
  
  // AI Mask State
  const [aiMask, setAiMask] = useState<ImageData | null>(null);

  // Export states
  const [exportFormat, setExportFormat] = useState('image/png');
  const [exportQuality, setExportQuality] = useState(100);

  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, imageData]);
  }, []);

  const saveProjectAuto = () => {
    if (projectData && !onSave && canvasRef.current) {
      saveProject({
        ...projectData,
        editedUrl: canvasRef.current.toDataURL('image/png'),
        timestamp: Date.now()
      });
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Pop the last state
    const newHistory = [...history];
    const prevState = newHistory.pop()!;
    setHistory(newHistory);
    
    // Redraw
    canvas.width = prevState.width;
    canvas.height = prevState.height;
    ctx.putImageData(prevState, 0, 0);
    
    if (projectData && !onSave) {
      saveProject({
        ...projectData,
        editedUrl: canvas.toDataURL('image/png'),
        timestamp: Date.now()
      });
    }
    
    // Clear any active masks
    setWandMask(null);
    setAiMask(null);
    clearMaskCanvas();
    
    saveProjectAuto();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  useEffect(() => {
    const img = new Image();
    img.src = (projectData && !onSave && projectData.editedUrl) ? projectData.editedUrl : originalUrl;
    img.onload = () => {
      imageObjRef.current = img;
      resetCanvas(img);
    };
  }, [originalUrl, projectData, onSave]);

  const resetCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const MAX_WIDTH = 1200;
    const scale = Math.min(MAX_WIDTH / img.width, 1);
    
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    if (maskCanvasRef.current) {
      maskCanvasRef.current.width = canvas.width;
      maskCanvasRef.current.height = canvas.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    setHistory([]);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 40;
      const zoomX = (rect.width - padding) / canvas.width;
      const zoomY = (rect.height - padding) / canvas.height;
      setZoom(Math.min(zoomX, zoomY, 1));
    }
  };

  const clearMaskCanvas = () => {
    const mCanvas = maskCanvasRef.current;
    if (!mCanvas) return;
    const mCtx = mCanvas.getContext('2d');
    if (mCtx) mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
  };

  const handleRunAI = async () => {
    setIsProcessing(true);
    setProgress(0);
    try {
      const blob = await segmentForeground(originalFile, {
        progress: (_key: string, current: number, total: number) => {
          setProgress(Math.round((current / total) * 100));
        }
      });
      
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const canvas = canvasRef.current;
        const mCanvas = maskCanvasRef.current;
        if (!canvas || !mCanvas) return;
        
        // Draw the blob mask to a temporary canvas to read its pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d');
        if (!tCtx) return;
        
        tCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        const maskData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Highlight background area in red on maskCanvasRef
        const mCtx = mCanvas.getContext('2d');
        if (!mCtx) return;
        
        const highlightData = mCtx.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < maskData.data.length; i += 4) {
          // Assuming segmentForeground returns an alpha mask where foreground alpha > 0
          // If the background is removed, alpha will be 0.
          if (maskData.data[i + 3] === 0 || maskData.data[i] === 0) { // Check alpha or dark pixel (some models return grayscale)
            highlightData.data[i] = 239;     // R
            highlightData.data[i + 1] = 68;  // G
            highlightData.data[i + 2] = 68;  // B
            highlightData.data[i + 3] = 128; // A
          }
        }
        mCtx.putImageData(highlightData, 0, 0);
        
        setAiMask(maskData);
        setIsProcessing(false);
      };
    } catch (e) {
      console.error(e);
      alert('Failed to detect background.');
      setIsProcessing(false);
    }
  };

  const confirmAiRemoval = () => {
    if (!aiMask) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    saveHistory();
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < aiMask.data.length; i += 4) {
      if (aiMask.data[i + 3] === 0 || aiMask.data[i] === 0) {
        imageData.data[i + 3] = 0; // set alpha to 0 for background
      }
    }
    ctx.putImageData(imageData, 0, 0);
    setAiMask(null);
    clearMaskCanvas();
    saveProjectAuto();
  };

  const cancelAiRemoval = () => {
    setAiMask(null);
    clearMaskCanvas();
  };

  const getCanvasMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x: Math.floor(x), y: Math.floor(y) };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'ai') return;
    
    // Middle click triggers pan regardless of tool
    if (e.button === 1 || activeTool === 'pan') {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      if (containerRef.current) {
        setScrollStart({ left: containerRef.current.scrollLeft, top: containerRef.current.scrollTop });
      }
      return;
    }
    
    if (e.button !== 0) return; // Only left click for drawing

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasMousePosition(e);

    if (activeTool === 'magic-wand') {
      if (wandMask) {
        const index = y * canvas.width + x;
        if (wandMask[index] === 1) {
          saveHistory();
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < wandMask.length; i++) {
            if (wandMask[i] === 1) {
              imageData.data[i * 4 + 3] = 0; 
            }
          }
          ctx.putImageData(imageData, 0, 0);
          setWandMask(null);
          clearMaskCanvas();
          saveProjectAuto();
          return;
        } else {
          setWandMask(null);
          clearMaskCanvas();
          return;
        }
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = getMagicWandMask(imageData, x, y, wandTolerance);
      setWandMask(mask);
      
      const mCanvas = maskCanvasRef.current;
      if (mCanvas) {
        const mCtx = mCanvas.getContext('2d');
        if (mCtx) {
          const maskImageData = mCtx.createImageData(canvas.width, canvas.height);
          for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 1) {
              maskImageData.data[i * 4] = 239;     
              maskImageData.data[i * 4 + 1] = 68;  
              maskImageData.data[i * 4 + 2] = 68;  
              maskImageData.data[i * 4 + 3] = 128; 
            }
          }
          mCtx.putImageData(maskImageData, 0, 0);
        }
      }
    } else if (activeTool === 'eraser' || activeTool === 'restore') {
      saveHistory(); 
      setIsDrawing(true);
      setStrokePoints([{ x, y }]);
      setStrokeSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
      
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Restore tool
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.clip();
        if (imageObjRef.current) {
          ctx.drawImage(imageObjRef.current, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      if (containerRef.current) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        containerRef.current.scrollLeft = scrollStart.left - dx;
        containerRef.current.scrollTop = scrollStart.top - dy;
      }
      return;
    }

    const { x, y } = getCanvasMousePosition(e);
    
    // Draw brush outline
    if (activeTool === 'eraser' || activeTool === 'restore') {
      const mCanvas = maskCanvasRef.current;
      const mCtx = mCanvas?.getContext('2d');
      if (mCanvas && mCtx) {
        mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
        mCtx.beginPath();
        mCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        mCtx.strokeStyle = 'white';
        mCtx.lineWidth = Math.max(1, 2 / zoom);
        mCtx.stroke();
        mCtx.strokeStyle = 'black';
        mCtx.lineWidth = Math.max(0.5, 1 / zoom);
        mCtx.stroke();
      }
    }

    if (!isDrawing || (activeTool !== 'eraser' && activeTool !== 'restore')) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newPoints = [...strokePoints, { x, y }];
    setStrokePoints(newPoints);

    if (activeTool === 'eraser') {
      if (strokeSnapshot) {
        ctx.putImageData(strokeSnapshot, 0, 0); // Restore to start of stroke
      }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(newPoints[0].x, newPoints[0].y);
      for (let i = 1; i < newPoints.length; i++) {
        ctx.lineTo(newPoints[i].x, newPoints[i].y);
      }
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (activeTool === 'restore') {
      if (strokeSnapshot) {
        ctx.putImageData(strokeSnapshot, 0, 0);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(newPoints[0].x, newPoints[0].y);
      for (let i = 1; i < newPoints.length; i++) {
        ctx.lineTo(newPoints[i].x, newPoints[i].y);
      }
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(); // We can't stroke an image directly. We need to clip to stroke!
      
      // Wait, we can't clip to a stroke. We have to stroke a path and then use destination-in or similar?
      // Actually, drawing the original image over a stroke path:
      // We can use a temporary canvas for the stroke, then draw original image with source-in!
      ctx.restore();

      // Better fallback for Restore tool since we can't clip a stroke easily:
      // We just draw circles at every interpolated point. It might be slightly larger, but much simpler.
      if (strokeSnapshot) {
        ctx.putImageData(strokeSnapshot, 0, 0);
      }
      ctx.save();
      ctx.beginPath();
      for (let p of newPoints) {
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
      }
      ctx.clip();
      if (imageObjRef.current) {
        ctx.drawImage(imageObjRef.current, 0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    if (activeTool === 'eraser' || activeTool === 'restore') {
      if (isDrawing) saveProjectAuto();
      setIsDrawing(false);
      setStrokeSnapshot(null);
      setStrokePoints([]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.globalCompositeOperation = 'source-over'; 
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    handleCanvasMouseUp();
    if (activeTool === 'eraser' || activeTool === 'restore') {
      clearMaskCanvas();
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL(exportFormat, exportQuality / 100);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clearcut_export.${exportFormat.split('/')[1]}`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%', flex: 1 }}>
      {/* Sidebar Tools */}
      <div className="glass-panel" style={{ width: '280px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Tools</h3>
          <button 
            className="btn" 
            style={{ padding: '0.4rem', background: 'transparent', color: history.length ? 'var(--text-main)' : 'var(--text-muted)' }}
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo"
          >
            <Undo2 size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            className={`btn ${activeTool === 'ai' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setActiveTool('ai')}
          >
            <Sparkles size={18} /> AI Removal
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className={`btn ${activeTool === 'pan' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => { setActiveTool('pan'); setWandMask(null); setAiMask(null); clearMaskCanvas(); }}
              title="Pan (Drag to move)"
            >
              <Hand size={18} /> Pan
            </button>
            <button 
              className={`btn ${activeTool === 'eraser' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => { setActiveTool('eraser'); setWandMask(null); setAiMask(null); clearMaskCanvas(); }}
            >
              <Eraser size={18} /> Erase
            </button>
            <button 
              className={`btn ${activeTool === 'restore' ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => { setActiveTool('restore'); setWandMask(null); setAiMask(null); clearMaskCanvas(); }}
              title="Restore original pixels"
            >
              <Paintbrush size={18} /> Restore
            </button>
          </div>
          <button 
            className={`btn ${activeTool === 'magic-wand' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => { setActiveTool('magic-wand'); setAiMask(null); }}
          >
            <Wand2 size={18} /> Magic Wand
          </button>
        </div>

        {(activeTool === 'eraser' || activeTool === 'restore') && (
          <div>
            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Brush Size: {brushSize}px</h4>
            <input 
              type="range" 
              min="5" max="100" 
              value={brushSize} 
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {activeTool === 'magic-wand' && (
          <div>
            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Hardness/Tolerance: {wandTolerance}</h4>
            <input 
              type="range" 
              min="0" max="150" 
              value={wandTolerance} 
              onChange={(e) => setWandTolerance(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Click an area to highlight. Double-click to delete. Click outside to cancel.
            </p>
          </div>
        )}

        {activeTool === 'ai' && (
          <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-sm)' }}>
            {!aiMask ? (
              <>
                <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Automatically detect and highlight the background using local AI.
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleRunAI} disabled={isProcessing}>
                  {isProcessing ? <><Loader2 className="animate-spin" size={18} /> Processing {progress}%</> : 'Detect Background'}
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Background is highlighted in red.
                </p>
                <button className="btn btn-primary" onClick={confirmAiRemoval} style={{ background: '#10b981' }}>
                  <Check size={18} /> Confirm Delete
                </button>
                <button className="btn btn-secondary" onClick={cancelAiRemoval}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        <hr style={{ borderColor: 'var(--border-color)' }} />

        {onSave ? (
          <div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Edit Sticker</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary" style={{ background: '#10b981' }} onClick={() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                onSave(canvas.toDataURL('image/png'));
              }}>
                <Check size={18} /> Save & Return
              </button>
              {onCancel && (
                <button className="btn btn-secondary" onClick={onCancel}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Export Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Format</label>
                <select 
                  value={exportFormat} 
                  onChange={(e) => setExportFormat(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                >
                  <option value="image/png">PNG (Transparent)</option>
                  <option value="image/webp">WEBP</option>
                  <option value="image/jpeg">JPEG (Solid BG)</option>
                </select>
              </div>
              
              {exportFormat !== 'image/png' && (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Quality: {exportQuality}%</label>
                  <input 
                    type="range" 
                    min="1" max="100" 
                    value={exportQuality} 
                    onChange={(e) => setExportQuality(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <button className="btn btn-primary" onClick={handleExport}>
                <Download size={18} /> Export Image
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Editor Toolbar */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>Editor Workspace</span>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-dark)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
            <button className="btn" style={{ padding: '0.4rem', background: 'transparent' }} onClick={() => setZoom(z => Math.max(0.1, z - 0.2))}>
              <ZoomOut size={16} />
            </button>
            <span style={{ fontSize: '0.85rem', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button className="btn" style={{ padding: '0.4rem', background: 'transparent' }} onClick={() => setZoom(z => Math.min(5, z + 0.2))}>
              <ZoomIn size={16} />
            </button>
            <button className="btn" style={{ padding: '0.4rem', background: 'transparent', marginLeft: '0.5rem' }} onClick={() => setZoom(1)}>
              <Maximize size={16} />
            </button>
          </div>
        </div>
        
        {/* Interactive Canvas Container */}
        <div ref={containerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-conic-gradient(#222 0% 25%, #1a1a1a 0% 50%) 50% / 20px 20px' }}>
          <div style={{ position: 'relative', transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}>
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                cursor: isPanning ? 'grabbing' : activeTool === 'pan' ? 'grab' : (activeTool === 'eraser' || activeTool === 'restore') ? 'none' : activeTool === 'magic-wand' ? 'pointer' : 'default',
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
              onContextMenu={(e) => e.preventDefault()}
            />
            {/* Mask Overlay Canvas */}
            <canvas
              ref={maskCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>
      
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

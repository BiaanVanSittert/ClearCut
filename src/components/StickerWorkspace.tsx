import React, { useEffect, useState } from 'react';
import { extractStickers } from '../utils/stickerUtils';
import type { StickerRect } from '../utils/stickerUtils';
import { removeBackground } from '@imgly/background-removal';
import JSZip from 'jszip';
import { Download, Loader2, Sparkles, Trash2, Scissors, Edit2, CheckSquare, Square, Undo, LayoutGrid } from 'lucide-react';
import { Workspace } from './Workspace';
import { saveProject } from '../utils/projectStorage';
import type { ProjectData } from '../utils/projectStorage';

interface StickerWorkspaceProps {
  originalFile: File;
  originalUrl: string;
  projectData?: ProjectData | null;
}

export interface Sticker {
  id: string;
  originalUrl: string;
  processedUrl?: string;
  isProcessing: boolean;
}

export const StickerWorkspace: React.FC<StickerWorkspaceProps> = ({ originalUrl, projectData }) => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [history, setHistory] = useState<Sticker[][]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  
  const [editingStickerId, setEditingStickerId] = useState<string | null>(null);
  const [addWhiteOutline, setAddWhiteOutline] = useState(false);

  // Push state to history
  const saveHistory = (newState: Sticker[]) => {
    setHistory(prev => [...prev, stickers].slice(-15)); // Keep last 15 states
    setStickers(newState);
    
    // Auto-save to project storage
    if (projectData) {
      saveProject({
        ...projectData,
        stickers: newState,
        timestamp: Date.now()
      });
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setStickers(previous);
  };

  useEffect(() => {
    // If we loaded an existing project with stickers, use them
    if (projectData && projectData.stickers && projectData.stickers.length > 0) {
      setStickers(projectData.stickers);
      return;
    }

    const process = async () => {
      setIsExtracting(true);
      try {
        const rects = await extractStickers(originalUrl, 1, 0.005);
        const crops = await cropStickers(originalUrl, rects);
        const newStickers = crops.map((url, i) => ({
          id: `sticker-${Date.now()}-${i}`,
          originalUrl: url,
          isProcessing: false
        }));
        setStickers(newStickers);
        if (projectData) {
          saveProject({ ...projectData, stickers: newStickers, timestamp: Date.now() });
        }
      } catch (e: any) {
        console.error('Failed to extract stickers:', e);
        setExtractError("Failed to extract stickers. Ensure there is clear contrast or try a smaller image.");
        try {
          // Fallback to single sticker if extraction fails
          const newStickers = [{
            id: `sticker-${Date.now()}-fallback`,
            originalUrl,
            isProcessing: false
          }];
          setStickers(newStickers);
        } catch(fallbackErr) {
          // Ignore
        }
      } finally {
        setIsExtracting(false);
      }
    };
    process();
  }, [originalUrl]);

  const cropStickers = (imageUrl: string, rects: StickerRect[]): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve([]);
        
        const urls: string[] = [];
        rects.forEach(rect => {
          canvas.width = rect.w;
          canvas.height = rect.h;
          ctx.clearRect(0, 0, rect.w, rect.h);
          ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
          urls.push(canvas.toDataURL('image/png'));
        });
        resolve(urls);
      };
    });
  };

  const removeBgForSticker = async (stickerUrl: string): Promise<string> => {
    const blob = await removeBackground(stickerUrl);
    return URL.createObjectURL(blob);
  };

  const applyWhiteOutline = async (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const padding = 10;
        const canvas = document.createElement('canvas');
        canvas.width = img.width + padding * 2;
        canvas.height = img.height + padding * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(url);

        // 1. Dilate alpha mask by drawing the image in a circle
        const steps = 32; // Higher is smoother
        for (let i = 0; i < steps; i++) {
          const angle = (Math.PI * 2 * i) / steps;
          const dx = Math.cos(angle) * padding;
          const dy = Math.sin(angle) * padding;
          ctx.drawImage(img, padding + dx, padding + dy);
        }
        
        // 2. Color the dilated mask solid white
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 3. Draw the original image perfectly on top
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, padding, padding);
        
        resolve(canvas.toDataURL('image/png'));
      };
    });
  };

  const handleBulkProcess = async () => {
    setIsBulkProcessing(true);
    setGlobalProgress(0);
    saveHistory(stickers);
    
    // Only process selected if any are selected, otherwise process all non-processed
    const targetIds = selectedIds.size > 0 
      ? new Set(selectedIds) 
      : new Set(stickers.filter(s => !s.processedUrl).map(s => s.id));
      
    const targetStickers = stickers.filter(s => targetIds.has(s.id));
    
    for (let i = 0; i < targetStickers.length; i++) {
      const targetId = targetStickers[i].id;
      
      setStickers(prev => prev.map(s => s.id === targetId ? { ...s, isProcessing: true } : s));
      
      try {
        let processedUrl = await removeBgForSticker(targetStickers[i].originalUrl);
        if (addWhiteOutline) {
          processedUrl = await applyWhiteOutline(processedUrl);
        }
        setStickers(prev => prev.map(s => s.id === targetId ? { ...s, processedUrl, isProcessing: false } : s));
      } catch (e) {
        console.error('Failed to process sticker:', e);
        setStickers(prev => prev.map(s => s.id === targetId ? { ...s, isProcessing: false } : s));
      }
      
      setGlobalProgress(Math.round(((i + 1) / targetStickers.length) * 100));
    }
    setIsBulkProcessing(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    saveHistory(stickers);
    setStickers(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSplitFurther = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const target = stickers.find(s => s.id === id);
    if (!target) return;
    
    // Set processing
    setStickers(prev => prev.map(s => s.id === id ? { ...s, isProcessing: true } : s));
    
    try {
      // Re-extract with zero dilation and smaller area threshold to split clumped stickers
      const rects = await extractStickers(target.originalUrl, 0, 0.001);
      if (rects.length > 1) {
        saveHistory(stickers);
        const crops = await cropStickers(target.originalUrl, rects);
        const newStickers = crops.map((url, i) => ({
          id: `sticker-${Date.now()}-split-${i}`,
          originalUrl: url,
          isProcessing: false
        }));
        
        setStickers(prev => {
          const index = prev.findIndex(s => s.id === id);
          if (index === -1) return prev;
          const next = [...prev];
          next.splice(index, 1, ...newStickers);
          return next;
        });
      } else {
        alert('Could not detect multiple sub-stickers. You may need to manually erase parts in Edit mode.');
        setStickers(prev => prev.map(s => s.id === id ? { ...s, isProcessing: false } : s));
      }
    } catch (err) {
      console.error(err);
      setStickers(prev => prev.map(s => s.id === id ? { ...s, isProcessing: false } : s));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getExportData = async (zipFormat: boolean = true) => {
    const targets = selectedIds.size > 0 ? stickers.filter(s => selectedIds.has(s.id)) : stickers;
    
    if (zipFormat) {
      const zip = new JSZip();
      const promises = targets.map(async (sticker, index) => {
        const url = sticker.processedUrl || sticker.originalUrl;
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(`sticker_${index + 1}.png`, blob);
      });
      await Promise.all(promises);
      const content = await zip.generateAsync({ type: 'blob' });
      return URL.createObjectURL(content);
    } else {
      // Export as single sheet
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      const cols = Math.ceil(Math.sqrt(targets.length));
      const rows = Math.ceil(targets.length / cols);
      const cellSize = 512;
      
      canvas.width = cols * cellSize;
      canvas.height = rows * cellSize;
      
      const promises = targets.map(async (sticker, index) => {
        const url = sticker.processedUrl || sticker.originalUrl;
        const img = new Image();
        img.src = url;
        await new Promise(r => img.onload = r);
        
        const x = (index % cols) * cellSize;
        const y = Math.floor(index / cols) * cellSize;
        
        // Scale to fit cell while maintaining aspect ratio
        const scale = Math.min((cellSize - 40) / img.width, (cellSize - 40) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const ox = x + (cellSize - w) / 2;
        const oy = y + (cellSize - h) / 2;
        
        ctx.drawImage(img, ox, oy, w, h);
      });
      await Promise.all(promises);
      return canvas.toDataURL('image/png');
    }
  };

  const handleExportZip = async () => {
    const url = await getExportData(true);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stickers_pack.zip';
      a.click();
    }
  };

  const handleExportSheet = async () => {
    const url = await getExportData(false);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stickers_sheet.png';
      a.click();
    }
  };

  if (editingStickerId) {
    const stickerToEdit = stickers.find(s => s.id === editingStickerId);
    if (stickerToEdit) {
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
          <Workspace 
            originalFile={new File([], 'sticker.png')} 
            originalUrl={stickerToEdit.originalUrl} 
            initialImageUrl={stickerToEdit.processedUrl || stickerToEdit.originalUrl}
            onSave={(newUrl) => {
              saveHistory(stickers);
              setStickers(prev => prev.map(s => {
                if (s.id === editingStickerId) {
                  if (s.processedUrl && s.processedUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(s.processedUrl);
                  }
                  return { ...s, processedUrl: newUrl };
                }
                return s;
              }));
              setEditingStickerId(null);
            }}
            onCancel={() => setEditingStickerId(null)}
          />
        </div>
      );
    }
  }

  if (isExtracting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
        <h2>Detecting Stickers...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Using OpenCV to detect individual objects on your image.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%', flex: 1 }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '280px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1.1rem' }}>Extracted Items</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${stickers.length} total`}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={handleUndo} disabled={history.length === 0} title="Undo">
            <Undo size={18} />
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.2rem' }} onClick={() => setSelectedIds(new Set(stickers.map(s => s.id)))}>Select All</button>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.2rem' }} onClick={() => setSelectedIds(new Set())}>Clear</button>
          {selectedIds.size > 0 && (
            <button className="btn btn-secondary" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.2rem' }} onClick={() => {
              saveHistory(stickers);
              stickers.forEach(s => {
                if (selectedIds.has(s.id)) {
                  if (s.originalUrl && s.originalUrl.startsWith('blob:')) URL.revokeObjectURL(s.originalUrl);
                  if (s.processedUrl && s.processedUrl.startsWith('blob:')) URL.revokeObjectURL(s.processedUrl);
                }
              });
              setStickers(prev => prev.filter(s => !selectedIds.has(s.id)));
              setSelectedIds(new Set());
            }}>Delete</button>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <input 
            type="checkbox" 
            id="outline-toggle"
            checked={addWhiteOutline}
            onChange={(e) => setAddWhiteOutline(e.target.checked)}
          />
          <label htmlFor="outline-toggle" style={{ cursor: 'pointer' }}>Add White Sticker Outline</label>
        </div>
        
        <button 
          className="btn btn-primary" 
          onClick={handleBulkProcess} 
          disabled={isBulkProcessing || stickers.every(s => s.processedUrl)}
        >
          {isBulkProcessing ? (
            <><Loader2 className="animate-spin" size={18} /> Processing {globalProgress}%</>
          ) : (
            <><Sparkles size={18} /> {selectedIds.size > 0 ? 'Remove BG (Selected)' : 'Auto Remove All BGs'}</>
          )}
        </button>

        <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

        <button 
          className="btn btn-primary" 
          style={{ background: stickers.length === 0 ? 'var(--bg-panel)' : '#10b981' }} 
          onClick={handleExportZip}
          disabled={stickers.length === 0}
        >
          <Download size={18} /> {selectedIds.size > 0 ? 'Export Selected to ZIP' : 'Export All to ZIP'}
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={handleExportSheet}
          disabled={stickers.length === 0}
        >
          <LayoutGrid size={18} /> {selectedIds.size > 0 ? 'Export Selected as Sheet' : 'Export All as Sheet'}
        </button>
      </div>

      {/* Grid */}
      <div className="glass-panel" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {extractError && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid #ef4444', 
            color: '#ef4444', 
            padding: '1rem', 
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{extractError}</span>
            <button className="btn" style={{ padding: '0.25rem 0.5rem', minWidth: 0, border: '1px solid #ef4444', color: '#ef4444', background: 'transparent' }} onClick={() => setExtractError(null)}>Dismiss</button>
          </div>
        )}

        {stickers.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No stickers detected.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
            {stickers.map((sticker) => {
              const isSelected = selectedIds.has(sticker.id);
              return (
                <div 
                  key={sticker.id} 
                  onClick={() => toggleSelection(sticker.id)}
                  style={{
                    background: 'repeating-conic-gradient(#333 0% 25%, transparent 0% 25%, transparent 0% 50%) 50% / 20px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    aspectRatio: '1/1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 4px rgba(99, 102, 241, 0.2)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <img 
                    src={sticker.processedUrl || sticker.originalUrl} 
                    alt="Sticker Crop" 
                    style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} 
                  />
                  
                  {/* Selection Checkbox */}
                  <div style={{ position: 'absolute', top: '8px', left: '8px', color: isSelected ? 'var(--primary-color)' : 'rgba(255,255,255,0.5)' }}>
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                  </div>

                  {/* Actions Bar */}
                  <div 
                    onClick={e => e.stopPropagation()}
                    style={{ 
                      position: 'absolute', 
                      bottom: '8px', 
                      left: '8px', 
                      right: '8px', 
                      display: 'flex', 
                      justifyContent: 'center',
                      gap: '0.25rem',
                      background: 'rgba(0,0,0,0.7)',
                      padding: '0.25rem',
                      borderRadius: 'var(--radius-sm)',
                      opacity: 0.8,
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    {!sticker.processedUrl && (
                      <button className="icon-btn-small" title="Split Further" onClick={(e) => handleSplitFurther(e, sticker.id)}>
                        <Scissors size={14} />
                      </button>
                    )}
                    <button className="icon-btn-small" title="Edit Manually" onClick={(e) => { e.stopPropagation(); setEditingStickerId(sticker.id); }}>
                      <Edit2 size={14} />
                    </button>
                    <button className="icon-btn-small" style={{ color: '#ef4444' }} title="Delete Sticker" onClick={(e) => handleDelete(e, sticker.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {sticker.isProcessing && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 className="animate-spin" size={32} color="white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .icon-btn-small {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-btn-small:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
};

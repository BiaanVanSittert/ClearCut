export interface StickerData {
  id: string;
  originalUrl: string;
  processedUrl?: string;
  isProcessing?: boolean;
}

export interface ProjectData {
  id: string;
  name: string;
  mode: 'single' | 'sticker';
  timestamp: number;
  originalUrl: string; // DataURL or Blob URL
  stickers?: StickerData[]; // Array of stickers
  editedUrl?: string; // DataURL or Blob URL for single mode
}

interface StoredStickerData {
  id: string;
  isProcessing?: boolean;
  originalBlob?: Blob;
  processedBlob?: Blob;
}

interface StoredProjectData {
  id: string;
  name: string;
  mode: 'single' | 'sticker';
  timestamp: number;
  originalBlob: Blob;
  stickers?: StoredStickerData[]; // Array of stickers with blobs
  editedBlob?: Blob;
}

const DB_NAME = 'ClearCutDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const urlToBlob = async (url?: string): Promise<Blob> => {
  if (!url) return new Blob();
  try {
    const res = await fetch(url);
    if (!res.ok && !url.startsWith('blob:') && !url.startsWith('data:')) {
      return new Blob();
    }
    return await res.blob();
  } catch (err) {
    console.warn('Failed to convert URL to Blob in storage:', err);
    return new Blob();
  }
};

export const saveProject = async (project: ProjectData): Promise<void> => {
  const db = await openDB();
  
  // Convert DataURLs to Blobs for efficient IndexedDB storage
  const storedProject: StoredProjectData = {
    id: project.id,
    name: project.name,
    mode: project.mode,
    timestamp: project.timestamp,
    originalBlob: await urlToBlob(project.originalUrl),
  };
  
  if (project.editedUrl) {
    storedProject.editedBlob = await urlToBlob(project.editedUrl);
  }
  
  if (project.stickers) {
    storedProject.stickers = await Promise.all(project.stickers.map(async (s) => {
      const sticker: StoredStickerData = { id: s.id, isProcessing: s.isProcessing };
      if (s.originalUrl) sticker.originalBlob = await urlToBlob(s.originalUrl);
      if (s.processedUrl) sticker.processedBlob = await urlToBlob(s.processedUrl);
      return sticker;
    }));
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(storedProject);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const loadProjects = async (): Promise<ProjectData[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const storedProjects = request.result as StoredProjectData[];
      
      const projects: ProjectData[] = storedProjects.map(sp => {
        const proj: ProjectData = {
          id: sp.id,
          name: sp.name,
          mode: sp.mode,
          timestamp: sp.timestamp,
          originalUrl: sp.originalBlob ? URL.createObjectURL(sp.originalBlob) : ''
        };
        
        if (sp.editedBlob) {
          proj.editedUrl = URL.createObjectURL(sp.editedBlob);
        }
        
        if (sp.stickers) {
          proj.stickers = sp.stickers.map(s => {
            const sticker: StickerData = {
              id: s.id,
              isProcessing: s.isProcessing,
              originalUrl: s.originalBlob ? URL.createObjectURL(s.originalBlob) : ''
            };
            if (s.processedBlob) sticker.processedUrl = URL.createObjectURL(s.processedBlob);
            return sticker;
          });
        }
        
        return proj;
      });
      
      // Sort by newest first
      resolve(projects.sort((a, b) => b.timestamp - a.timestamp));
    };
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const clearAllProjects = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const revokeProjectUrls = (project: ProjectData) => {
  const revoke = (url?: string) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };
  revoke(project.originalUrl);
  revoke(project.editedUrl);
  if (project.stickers) {
    project.stickers.forEach(s => {
      revoke(s.originalUrl);
      revoke(s.processedUrl);
    });
  }
};

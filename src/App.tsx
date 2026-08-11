import { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { Workspace } from './components/Workspace';
import { StickerWorkspace } from './components/StickerWorkspace';
import { Layers, Sparkles, FolderOpen } from 'lucide-react';
import { ProjectsModal } from './components/ProjectsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { saveProject } from './utils/projectStorage';
import type { ProjectData } from './utils/projectStorage';
import './index.css';

type Mode = 'single' | 'sticker';

function App() {
  const [mode, setModeState] = useState<Mode>(() => {
    const saved = localStorage.getItem('clearcut_mode');
    return (saved === 'single' || saved === 'sticker') ? saved : 'single';
  });

  const setMode = (newMode: Mode) => {
    setModeState(newMode);
    localStorage.setItem('clearcut_mode', newMode);
  };
  const [uploadedImage, setUploadedImage] = useState<{ file: File | null, url: string } | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);

  const handleImageLoaded = async (file: File, url: string) => {
    const newProject: ProjectData = {
      id: `proj_${Date.now()}`,
      name: file.name,
      mode,
      timestamp: Date.now(),
      originalUrl: url
    };
    await saveProject(newProject);
    setCurrentProject(newProject);
    setUploadedImage({ file, url });
  };

  const handleReset = () => {
    setUploadedImage(null);
    setCurrentProject(null);
  };

  const handleLoadProject = (proj: ProjectData) => {
    setMode(proj.mode || (proj.stickers && proj.stickers.length > 0 ? 'sticker' : 'single'));
    setCurrentProject(proj);
    // Since we don't have the File object, we can just pass null, but we have the URL
    setUploadedImage({ file: null, url: proj.originalUrl });
    setShowProjects(false);
  };

  const handleModeSwitch = async (newMode: Mode) => {
    setMode(newMode);
    if (currentProject) {
      const updated = { ...currentProject, mode: newMode };
      setCurrentProject(updated);
      await saveProject(updated);
    }
  };

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          onClick={handleReset}
          title="Return Home"
        >
          <div style={{ background: 'var(--primary-color)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
            <img src="/favicon.svg" alt="Logo" style={{ width: 24, height: 24, filter: 'brightness(0) invert(1)' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>ClearCut</h1>
        </div>
        
        {/* Mode Selector & Projects Button */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {!uploadedImage && (
            <button 
              className="btn btn-secondary"
              onClick={() => setShowProjects(true)}
            >
              <FolderOpen size={18} /> Projects
            </button>
          )}
          <div style={{ display: 'flex', background: 'var(--bg-panel)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
            <button 
              className={`btn ${mode === 'single' ? 'btn-secondary active' : 'btn-secondary'}`}
              style={{ border: 'none', boxShadow: 'none' }}
              onClick={() => handleModeSwitch('single')}
            >
              <Sparkles size={18} /> Single Image
            </button>
            <button 
              className={`btn ${mode === 'sticker' ? 'btn-secondary active' : 'btn-secondary'}`}
              style={{ border: 'none', boxShadow: 'none' }}
              onClick={() => handleModeSwitch('sticker')}
            >
              <Layers size={18} /> Sticker Pack
            </button>
          </div>
        </div>
      </header>

      <ErrorBoundary>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!uploadedImage ? (
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                {mode === 'single' ? 'Remove Backgrounds Instantly' : 'Extract Sticker Packs'}
              </h2>
              <p style={{ color: 'var(--text-muted)' }}>
                {mode === 'single' 
                  ? 'Use AI to remove backgrounds locally in your browser. No data leaves your device.'
                  : 'Upload a sheet of stickers and we will automatically split them and remove the background.'}
              </p>
            </div>
            <ImageUploader onImageLoaded={handleImageLoaded} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
            <div style={{ marginBottom: '1rem' }}>
              <button className="btn btn-secondary" onClick={handleReset}>
                &larr; Upload Another
              </button>
            </div>
            {mode === 'single' ? (
              <Workspace 
                originalFile={uploadedImage.file || new File([], 'image.png')} 
                originalUrl={uploadedImage.url} 
                projectData={currentProject}
              />
            ) : (
              <StickerWorkspace 
                originalFile={uploadedImage.file || new File([], 'image.png')} 
                originalUrl={uploadedImage.url} 
                projectData={currentProject}
              />
            )}
          </div>
        )}
        </main>
      </ErrorBoundary>

      <footer style={{ 
        marginTop: '3rem', 
        padding: '1.5rem 0', 
        borderTop: '1px solid var(--border-color)', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.85rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <span>&copy; {new Date().getFullYear()} ClearCut. All rights reserved.</span>
          <span>Version 1.0.0</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="https://github.com/BiaanVanSittert" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>GitHub Profile</a>
          <a href="https://github.com/BiaanVanSittert/ClearCut/issues" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>Report Issues</a>
        </div>
      </footer>

      {showProjects && (
        <ProjectsModal 
          onClose={() => setShowProjects(false)} 
          onLoad={handleLoadProject} 
        />
      )}
    </>
  );
}

export default App;

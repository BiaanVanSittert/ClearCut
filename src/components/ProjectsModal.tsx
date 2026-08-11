import React, { useEffect, useState } from 'react';
import { loadProjects, deleteProject, clearAllProjects, revokeProjectUrls } from '../utils/projectStorage';
import type { ProjectData } from '../utils/projectStorage';
import { Trash2, FolderOpen, AlertCircle } from 'lucide-react';

interface ProjectsModalProps {
  onClose: () => void;
  onLoad: (project: ProjectData) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({ onClose, onLoad }) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const list = await loadProjects();
    setProjects(list);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      const proj = projects.find(p => p.id === id);
      if (proj) revokeProjectUrls(proj);
      await deleteProject(id);
      fetchProjects();
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete ALL projects? This cannot be undone.')) {
      projects.forEach(p => revokeProjectUrls(p));
      await clearAllProjects();
      fetchProjects();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="glass-panel" style={{ width: '600px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <FolderOpen size={24} /> Saved Projects
          </h2>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projects.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No saved projects found.</p>
            </div>
          ) : (
            projects.map(proj => (
              <div 
                key={proj.id} 
                onClick={() => onLoad(proj)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: 'var(--bg-dark)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  transition: 'border-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                  <img 
                    src={proj.editedUrl || proj.originalUrl} 
                    alt="Project preview" 
                    style={{ width: '64px', height: '64px', objectFit: 'contain', background: 'black', borderRadius: '4px', flexShrink: 0 }} 
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proj.mode === 'single' ? 'Single Image' : `Sticker Pack (${proj.stickers?.length || 0} stickers)`} 
                      {' • '} 
                      {new Date(proj.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button 
                  className="btn" 
                  style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}
                  onClick={(e) => handleDelete(e, proj.id)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>

        {projects.length > 0 && (
          <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
            <button className="btn" style={{ color: '#ef4444' }} onClick={handleClearAll}>
              Delete All Projects
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const list = await loadProjects();
    setProjects(list);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const proj = projects.find(p => p.id === id);
    if (proj) revokeProjectUrls(proj);
    await deleteProject(id);
    setDeletingId(null);
    await fetchProjects();
  };

  const handleClearAll = async () => {
    projects.forEach(p => revokeProjectUrls(p));
    await clearAllProjects();
    setConfirmClearAll(false);
    await fetchProjects();
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

                {deletingId === proj.id ? (
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button 
                      className="btn" 
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: '#ef4444', color: 'white' }}
                      onClick={(e) => handleDelete(e, proj.id)}
                    >
                      Delete
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => setDeletingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button 
                    className="btn" 
                    style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(proj.id);
                    }}
                    title="Delete Project"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {projects.length > 0 && (
          <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
            {confirmClearAll ? (
              <>
                <span style={{ fontSize: '0.85rem', color: '#ef4444', marginRight: '0.5rem' }}>Delete all saved projects?</span>
                <button className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={handleClearAll}>
                  Yes, Delete All
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirmClearAll(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }} onClick={() => setConfirmClearAll(true)}>
                Delete All Projects
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

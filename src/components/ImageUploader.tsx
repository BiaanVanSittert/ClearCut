import React, { useCallback, useState } from 'react';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onImageLoaded: (file: File, objectUrl: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file.');
      return;
    }
    const url = URL.createObjectURL(file);
    onImageLoaded(file, url);
  }, [onImageLoaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  return (
    <div 
      className={`glass-panel animate-fade-in ${isDragging ? 'dropzone-active' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        borderStyle: isDragging ? 'solid' : 'dashed',
        borderWidth: '2px',
        cursor: 'pointer',
        textAlign: 'center',
        minHeight: '400px'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <input 
        id="file-upload" 
        type="file" 
        accept="image/*" 
        style={{ display: 'none' }} 
        onChange={handleFileInput}
      />
      
      <UploadCloud size={64} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
        Drag & Drop your image here
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Supports PNG, JPG, WEBP, and more.
      </p>
      
      <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); document.getElementById('file-upload')?.click(); }}>
        <ImageIcon size={18} />
        Browse Files
      </button>
    </div>
  );
};

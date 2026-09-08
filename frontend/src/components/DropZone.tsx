'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { UploadCloud, AlertCircle } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
}

export function DropZone({
  onFileSelect,
  acceptedTypes = ['image/png', 'image/jpeg', 'image/webp'],
  maxSizeMB = 10,
  disabled = false,
  className,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelect = useCallback((file: File) => {
    if (!acceptedTypes.includes(file.type)) {
      setError(`Invalid file type. Supported: ${acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`);
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File exceeds maximum size of ${maxSizeMB}MB`);
      return;
    }
    setError(null);
    onFileSelect(file);
  }, [acceptedTypes, maxSizeMB, onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  }, [disabled, validateAndSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  }, [validateAndSelect]);

  return (
    <div className={cn('relative', className)}>
      <input
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileChange}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all duration-150 cursor-pointer',
          isDragging
            ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-900 scale-[0.99]'
            : 'border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 hover:border-black dark:hover:border-white hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
      >
        <div className="w-12 h-12 mb-3 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-black dark:text-white">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="text-base font-semibold text-black dark:text-white">
          {isDragging ? 'Drop screenshot here' : 'Drag & drop your UI screenshot here'}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Supports PNG, JPG, or WebP up to {maxSizeMB}MB
        </p>
        {error && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-black dark:text-white bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 rounded-lg font-medium" role="alert">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </label>
    </div>
  );
}
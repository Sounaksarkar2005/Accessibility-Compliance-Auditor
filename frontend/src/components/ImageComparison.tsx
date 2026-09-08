'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Violation } from '@/types';
import { Eye, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ImageComparisonProps {
  originalUrl: string;
  fixedUrl?: string;
  annotatedUrl?: string;
  violations?: Violation[];
}

export function ImageComparison({
  originalUrl,
  fixedUrl,
  annotatedUrl,
  violations = [],
}: ImageComparisonProps) {
  const [mode, setMode] = useState<'original' | 'annotated' | 'fixed'>('annotated');

  const tabs = [
    { value: 'annotated' as const, label: 'Annotated Violations', icon: AlertTriangle, disabled: !annotatedUrl },
    { value: 'fixed' as const, label: 'Remediated Preview', icon: CheckCircle2, disabled: !fixedUrl },
    { value: 'original' as const, label: 'Original Screenshot', icon: Eye, disabled: !originalUrl },
  ];

  const currentImage = mode === 'original' ? originalUrl : mode === 'fixed' ? fixedUrl : (annotatedUrl || originalUrl);

  return (
    <div className="space-y-4">
      <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800" role="tablist">
        {tabs.map(({ value, label, icon: Icon, disabled }) => (
          <button
            key={value}
            onClick={() => !disabled && setMode(value)}
            disabled={disabled}
            role="tab"
            aria-selected={mode === value}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150',
              mode === value
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white',
              disabled && 'opacity-30 cursor-not-allowed hover:text-neutral-600 dark:hover:text-neutral-400',
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 shadow-inner">
        {currentImage ? (
          <img
            src={currentImage}
            alt={mode === 'original' ? 'Original screenshot' : mode === 'fixed' ? 'Auto-remediated preview' : 'Annotated violations preview'}
            className="w-full h-auto max-h-[550px] object-contain mx-auto transition-all"
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-neutral-400 dark:text-neutral-600 text-sm">
            No preview image available
          </div>
        )}

        {mode === 'annotated' && violations.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-black/90 dark:bg-white/95 backdrop-blur text-white dark:text-black text-xs font-semibold px-3.5 py-2 rounded-lg border border-neutral-800 dark:border-neutral-200 shadow-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white dark:bg-black"></span>
            <span>{violations.length} accessibility violation{violations.length !== 1 ? 's' : ''} detected</span>
          </div>
        )}

        {mode === 'fixed' && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-black/90 dark:bg-white/95 backdrop-blur text-white dark:text-black text-xs font-semibold px-3.5 py-2 rounded-lg border border-neutral-800 dark:border-neutral-200 shadow-xl flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Remediated for WCAG contrast compliance</span>
          </div>
        )}
      </div>
    </div>
  );
}
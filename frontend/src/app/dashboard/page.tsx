'use client';

import { useState, useCallback } from 'react';
import { DropZone } from '@/components/DropZone';
import { ViolationCard } from '@/components/ViolationCard';
import { ImageComparison } from '@/components/ImageComparison';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn, formatDate } from '@/lib/utils';
import { Violation } from '@/types';
import { ShieldCheck, Sparkles, RefreshCw, FileText, Share2, AlertCircle } from 'lucide-react';

interface AuditResult {
  audit: {
    audit_id: string;
    source_type: string;
    source_ref: string;
    status: string;
    created_at: string;
    cloudinary_public_id?: string;
  };
  violations: Violation[];
  annotatedUrl?: string;
  fixedUrl?: string;
  responsiveUrls?: Array<{ breakpoint: number; url: string }>;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byRule: Record<string, number>;
  };
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});

  const pollForResults = useCallback(async (id: string) => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/audit/results?auditId=${id}`);
        const data = await res.json();
        if (data.audit?.status === 'complete' || data.violations?.length) {
          setResult(data);
          setPolling(false);
          return;
        }
      } catch {
        // Continue polling
      }
    }
    setPolling(false);
    setError('Analysis timed out. Please try again or check back shortly.');
  }, []);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceType', 'screenshot');
      formData.append('userId', 'demo-user');

      const res = await fetch('/api/audit/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setPolling(true);
      pollForResults(data.auditId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [file, pollForResults]);

  const handleExplain = useCallback(async (violationId: string) => {
    if (explanations[violationId]) return;
    try {
      const res = await fetch('/api/audit/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violationId }),
      });
      const data = await res.json();
      setExplanations((prev) => ({ ...prev, [violationId]: data.explanation }));
    } catch {
      setExplanations((prev) => ({ ...prev, [violationId]: 'Failed to load explanation' }));
    }
  }, [explanations]);

  if (!result) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100 transition-colors">
        <header className="bg-white/90 dark:bg-black/90 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-black dark:text-white">
                  Accessibility Compliance Auditor
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Automated WCAG 2.2 analysis powered by Cloudinary + Snowflake
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-black dark:text-white">
                Upload Screenshot for Compliance Audit
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Upload your UI screenshot to detect contrast violations, element tagging, and calculate remediated palettes.
              </p>
            </div>

            <DropZone onFileSelect={handleFileSelect} disabled={uploading || polling} />

            {error && (
              <div className="mt-4 p-3.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-black dark:text-white text-sm flex items-center gap-2" role="alert">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-850">
              <div className="flex items-center gap-2">
                {file && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <span className="w-2 h-2 rounded-full bg-black dark:bg-white"></span>
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || uploading || polling}
                className={cn(
                  'w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2',
                  file && !uploading && !polling
                    ? 'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.98]'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                )}
              >
                {(uploading || polling) && (
                  <RefreshCw className="w-4 h-4 animate-spin text-current" />
                )}
                <span>
                  {uploading ? 'Uploading...' : polling ? 'Analyzing Accessibility...' : 'Run Compliance Audit'}
                </span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100 transition-colors">
      <header className="bg-white/90 dark:bg-black/90 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-black dark:text-white">
                Accessibility Compliance Auditor
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {result.summary.total} violation{result.summary.total !== 1 ? 's' : ''} detected • {formatDate(result.audit.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setResult(null)}
              className="px-3.5 py-1.5 text-xs font-bold text-black dark:text-white bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors"
            >
              New Audit
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <ImageComparison
          originalUrl={result.annotatedUrl || ''}
          fixedUrl={result.fixedUrl}
          annotatedUrl={result.annotatedUrl}
          violations={result.violations}
        />

        <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-black dark:text-white">
                Compliance Violations ({result.violations.length})
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Evaluated against WCAG 2.2 Level A, AA, and AAA standards
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(result.summary.bySeverity).map(([severity, count]) => (
                <span
                  key={severity}
                  className={cn(
                    'px-2.5 py-1 text-xs font-bold rounded-lg border',
                    severity === 'A' && 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white',
                    severity === 'AA' && 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black border-neutral-800 dark:border-neutral-200',
                    severity === 'AAA' && 'bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white border-neutral-300 dark:border-neutral-700'
                  )}
                >
                  Level {severity}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {result.violations.map((v, i) => (
              <ViolationCard
                key={v.violation_id}
                violation={v}
                index={i}
                onExplain={handleExplain}
                explanation={explanations[v.violation_id]}
              />
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-black dark:text-white">
            Export & Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold text-black dark:text-white bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <FileText className="w-4 h-4" />
              <span>Download VPAT (PDF)</span>
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold text-black dark:text-white bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <Share2 className="w-4 h-4" />
              <span>Copy PR Comment</span>
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 rounded-xl text-xs font-bold transition-colors">
              <Sparkles className="w-4 h-4" />
              <span>Re-run at AAA Level</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
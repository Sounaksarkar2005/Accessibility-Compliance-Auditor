'use client';

import { useState } from 'react';
import { Violation } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface ViolationCardProps {
  violation: Violation;
  index: number;
  onExplain: (violationId: string) => void;
  explanation?: string;
}

const severityStyle: Record<'A' | 'AA' | 'AAA', string> = {
  A: 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white font-bold',
  AA: 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-950 border-neutral-800 dark:border-neutral-200',
  AAA: 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700',
};

export function ViolationCard({ violation, index, onExplain, explanation }: ViolationCardProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-950 shadow-sm transition-all hover:border-neutral-400 dark:hover:border-neutral-600">
      <div className="flex items-start gap-3.5">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-xs font-bold text-black dark:text-white">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={cn('px-2.5 py-0.5 rounded-full text-xs border', severityStyle[violation.severity as 'A' | 'AA' | 'AAA'] || severityStyle.AA)}>
              Level {violation.severity}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800">
              WCAG {violation.rule}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
              {violation.type}
            </span>
          </div>

          <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
            <strong className="text-black dark:text-white font-semibold">Element:</strong>{' '}
            <code className="text-black dark:text-white bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded text-xs font-mono border border-neutral-200 dark:border-neutral-800">
              {violation.element_selector}
            </code>
          </p>

          {violation.actualRatio && violation.requiredRatio && (
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
              <strong className="text-black dark:text-white font-semibold">Contrast:</strong>{' '}
              <span className="font-bold text-black dark:text-white">{violation.actualRatio.toFixed(2)}:1</span>{' '}
              <span className="text-xs text-neutral-500 dark:text-neutral-400">(Required: {violation.requiredRatio}:1)</span>
            </p>
          )}

          {violation.current_hex && violation.suggested_hex && (
            <div className="flex flex-wrap items-center gap-3 mb-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-900 px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-800">
                <span className="w-3.5 h-3.5 rounded border border-neutral-400 dark:border-neutral-600 shadow-sm" style={{ backgroundColor: violation.current_hex }}></span>
                Current: <strong className="font-mono text-black dark:text-white">{violation.current_hex}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-black dark:text-white bg-neutral-200/80 dark:bg-neutral-800 px-2.5 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 font-medium">
                <span className="w-3.5 h-3.5 rounded border border-neutral-400 dark:border-neutral-500 shadow-sm" style={{ backgroundColor: violation.suggested_hex }}></span>
                Remediated: <strong className="font-mono text-black dark:text-white">{violation.suggested_hex}</strong>
              </span>
            </div>
          )}

          <button
            onClick={() => {
              if (!explanation) onExplain(violation.violation_id);
              setShow(!show);
            }}
            className="text-xs font-semibold text-black dark:text-white hover:opacity-75 inline-flex items-center gap-1.5 transition-opacity pt-1 underline underline-offset-4"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {explanation ? (show ? 'Hide Explanation' : 'Show Explanation') : 'Explain Remediation'}
            {show ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {show && explanation && (
        <div className="mt-3.5 p-3.5 bg-neutral-100/70 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
          {explanation}
        </div>
      )}
    </div>
  );
}
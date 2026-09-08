'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black flex items-center justify-center transition-colors">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">Loading Accessibility Compliance Auditor...</p>
      </div>
    </div>
  );
}
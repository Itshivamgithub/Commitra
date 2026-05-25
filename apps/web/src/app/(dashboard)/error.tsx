'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Error:', error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full flex-col items-center justify-center space-y-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-10 w-10 text-red-500" />
      </div>
      
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
        <p className="text-sm text-slate-400 max-w-md">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
      </div>

      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
      >
        <RefreshCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

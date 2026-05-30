'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Repository } from '@commitra/types';
import { 
  RefreshCw, 
  Star, 
  GitFork, 
  Lock, 
  Globe, 
  Clock, 
  AlertTriangle,
  FolderSync
} from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import useSWR from 'swr';

const sparklineFetcher = (url: string) => api.get(url).then(res => res.data.data);

function Sparkline({ repoId }: { repoId: string }) {
  const { data } = useSWR(`/api/analytics/${repoId}/commits?range=7d`, sparklineFetcher);
  
  if (!data?.timeline) return (
    <div className="h-10 w-full bg-slate-900/50 animate-pulse rounded" />
  );

  return (
    <div className="h-10 w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.timeline}>
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="hsl(var(--primary))"
            fillOpacity={0.1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardHome() {
  console.log('DashboardHome rendering...');
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    setError(null);
    try {
      console.log('Fetching repositories from API...');
      const response = await api.get('/api/repos');
      console.log('API Response:', response.data);
      if (response.data.success) {
        setRepos(response.data.data);
      } else {
        setError(response.data.error || 'Failed to fetch repositories');
      }
    } catch (err: any) {
      console.error('Failed to fetch repositories:', err);
      setError(err.response?.data?.error || err.message || 'An unexpected error occurred');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleGlobalSync = async () => {
    setIsSyncing(true);
    try {
      await api.post('/api/repos/sync');
      fetchRepos();
    } catch (error) {
      console.error('Failed to sync repositories:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatRelativeTime = (date: string | Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Overview of your connected GitHub repositories.</p>
        </div>
        <button
          onClick={handleGlobalSync}
          disabled={isSyncing}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:opacity-50"
        >
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <FolderSync className="h-4 w-4" />
          )}
          {isSyncing ? 'Syncing...' : 'Sync All Repos'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-red-500">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-semibold">Error: {error}</p>
          </div>
          <button 
            onClick={fetchRepos}
            className="mt-2 text-xs font-bold underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {isLoadingRepos ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900/50" />
          ))}
        </div>
      ) : repos?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-20 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900">
            <GitFork className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">No repositories found</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Click the &quot;Sync All Repos&quot; button to fetch your repositories from GitHub.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {repos?.map((repo) => (
            <Link
              key={repo.id}
              href={`/repos/${repo.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-5 transition-all hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/40"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/80 text-sm font-bold text-slate-600 dark:text-slate-300">
                    {repo.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {repo.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {repo.isPrivate ? (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-500/80 font-medium uppercase tracking-wider">
                          <Lock className="h-2.5 w-2.5" /> Private
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-500/80 font-medium uppercase tracking-wider">
                          <Globe className="h-2.5 w-2.5" /> Public
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Star className="h-3 w-3" /> {repo.stars}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex-1">
                <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {repo.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50 pt-4">
                <div className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${repo.language ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                  <span className="text-xs font-medium text-slate-500">{repo.language || 'Plain Text'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{formatRelativeTime(repo.lastPushedAt)}</span>
                </div>
              </div>

              {/* Sparkline visualization at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                <Sparkline repoId={repo.id} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

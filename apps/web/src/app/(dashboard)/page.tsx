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

export default function DashboardHome() {
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [langFilter, setLangFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastPushedAt');
  const [order, setOrder] = useState('desc');

  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (langFilter) params.append('language', langFilter);
      if (sortBy) params.append('sort', sortBy);
      if (order) params.append('order', order);

      const response = await api.get(`/api/repos?${params.toString()}`);
      setRepos(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load repositories');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      await api.post('/api/repos/sync');
      await fetchRepos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sync repositories with GitHub');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langFilter, sortBy, order]);

  // Relative time helper
  const formatRelativeTime = (dateString: string | Date | null) => {
    if (!dateString) return 'never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Language Dot Color helper
  const getLanguageColor = (lang: string | null) => {
    if (!lang) return 'bg-slate-500';
    const colors: Record<string, string> = {
      TypeScript: 'bg-blue-500',
      JavaScript: 'bg-yellow-400',
      Go: 'bg-cyan-500',
      Rust: 'bg-orange-600',
      Python: 'bg-indigo-400',
      HTML: 'bg-red-500',
      CSS: 'bg-purple-500',
      Java: 'bg-amber-600',
      C: 'bg-gray-400',
      'C++': 'bg-pink-500',
      'C#': 'bg-green-500',
      Ruby: 'bg-red-600',
    };
    return colors[lang] || 'bg-indigo-500';
  };

  // List of common languages for filter dropdown
  const languagesList = ['TypeScript', 'JavaScript', 'Go', 'Rust', 'Python', 'Java', 'Ruby', 'HTML', 'CSS'];

  return (
    <div className="space-y-8">
      {/* Title + Action Top section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Your repositories</h1>
          <p className="text-sm text-slate-400 mt-1">Manage and sync repositories connected to your account.</p>
        </div>
        
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync repositories'}</span>
        </button>
      </div>

      {/* Filter and Sort bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-4 glass-panel rounded-xl">
        <div className="flex items-center gap-3">
          {/* Language filter */}
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Languages</option>
            {languagesList.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>

          {/* Sort selection */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="lastPushedAt">Recently Pushed</option>
            <option value="stars">Stars</option>
            <option value="forks">Forks</option>
            <option value="name">Name</option>
            <option value="syncedAt">Recently Synced</option>
          </select>

          {/* Order toggler */}
          <button
            onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
            className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-350 hover:bg-slate-800 hover:text-white"
          >
            {order === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        </div>

        <div className="text-xs text-slate-500">
          {repos ? `${repos.length} repos found` : 'Searching...'}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-900/30 bg-red-950/10 p-4 text-sm text-red-400 animate-pulse">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Repos Grid */}
      {isLoadingRepos ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-panel h-[160px] animate-pulse rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="h-5 w-2/3 bg-slate-800 rounded"></div>
                <div className="h-5 w-16 bg-slate-800 rounded-full"></div>
              </div>
              <div className="h-8 w-full bg-slate-800/50 rounded"></div>
              <div className="flex items-center gap-6 pt-2">
                <div className="h-4 w-16 bg-slate-800 rounded"></div>
                <div className="h-4 w-12 bg-slate-800 rounded"></div>
                <div className="h-4 w-12 bg-slate-800 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : repos === null || repos.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-900 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 mb-4">
            <FolderSync className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No repositories synced yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Import your repositories from GitHub to get contributor details and trend insights.
          </p>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync repositories'}</span>
          </button>
        </div>
      ) : (
        /* Grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {repos.map((repo) => (
            <Link
              key={repo.id}
              href={`/repos/${repo.id}`}
              className="glass-panel flex flex-col justify-between rounded-xl p-6 transition-all duration-200 hover:-translate-y-[2px] hover:border-slate-700 hover:shadow-lg hover:shadow-indigo-500/5 hover:bg-slate-900/10 group"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors text-base truncate">
                    {repo.name}
                  </h3>
                  
                  {/* Badge */}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                    repo.isPrivate 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {repo.isPrivate ? (
                      <>
                        <Lock className="h-2.5 w-2.5" />
                        <span>Private</span>
                      </>
                    ) : (
                      <>
                        <Globe className="h-2.5 w-2.5" />
                        <span>Public</span>
                      </>
                    )}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                  {repo.description || 'No description provided.'}
                </p>
              </div>

              {/* Footer info inside Card */}
              <div className="mt-6 flex items-center gap-6 text-xs text-slate-500">
                {repo.language && (
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${getLanguageColor(repo.language)}`} />
                    <span>{repo.language}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-yellow-500/80" />
                  <span>{repo.stars}</span>
                </div>

                <div className="flex items-center gap-1">
                  <GitFork className="h-3.5 w-3.5 text-blue-500/80" />
                  <span>{repo.forks}</span>
                </div>

                <div className="flex items-center gap-1 ml-auto text-[10px]">
                  <Clock className="h-3 w-3" />
                  <span>{formatRelativeTime(repo.lastPushedAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

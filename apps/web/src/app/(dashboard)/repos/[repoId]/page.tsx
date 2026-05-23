'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Repository } from '@commitra/types';
import { 
  ArrowLeft, 
  Star, 
  GitFork, 
  Calendar, 
  ShieldAlert, 
  ExternalLink,
  Code2,
  Lock,
  Globe,
  Clock,
  RefreshCw
} from 'lucide-react';

export default function RepoDetailPage() {
  const { repoId } = useParams();
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepoDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get(`/api/repos/${repoId}`);
        setRepo(response.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to retrieve repository details');
      } finally {
        setIsLoading(false);
      }
    };

    if (repoId) {
      fetchRepoDetail();
    }
  }, [repoId]);

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-6 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-slate-200">Failed to load repository</h3>
        <p className="text-sm text-slate-450 mt-2">{error || 'Repository details could not be found.'}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-2 text-xs text-slate-405 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to repositories</span>
      </button>

      {/* Repo Title section */}
      <div className="glass-panel rounded-2xl p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/50 border border-slate-800 text-indigo-400">
              <Code2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold text-white">{repo.name}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                  repo.isPrivate 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {repo.isPrivate ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                  <span>{repo.isPrivate ? 'Private' : 'Public'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{repo.fullName}</p>
            </div>
          </div>

          <a
            href={repo.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-800 hover:text-white"
          >
            <span>View on GitHub</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Description */}
        <div className="border-t border-slate-900 pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</h3>
          <p className="text-sm text-slate-350 mt-2">
            {repo.description || 'No description available for this repository.'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-slate-900 pt-6">
          <div className="rounded-xl bg-slate-950/50 p-4 border border-slate-900">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Language</span>
            <span className="text-sm font-semibold text-slate-200 block mt-1">{repo.language || 'Unknown'}</span>
          </div>

          <div className="rounded-xl bg-slate-950/50 p-4 border border-slate-900">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Default Branch</span>
            <span className="text-sm font-semibold text-slate-200 block mt-1">{repo.defaultBranch}</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-slate-950/50 p-4 border border-slate-900">
            <Star className="h-5 w-5 text-yellow-500/80" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Stars</span>
              <span className="text-sm font-semibold text-slate-200 block">{repo.stars}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-slate-950/50 p-4 border border-slate-900">
            <GitFork className="h-5 w-5 text-blue-500/80" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Forks</span>
              <span className="text-sm font-semibold text-slate-200 block">{repo.forks}</span>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between border-t border-slate-900 pt-6 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>GitHub Created: {new Date(repo.githubCreatedAt || '').toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Last Pushed: {repo.lastPushedAt ? new Date(repo.lastPushedAt).toLocaleString() : 'never'}</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>Last Synced: {new Date(repo.syncedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

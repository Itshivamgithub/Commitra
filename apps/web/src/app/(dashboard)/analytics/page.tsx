'use client';

import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  GitPullRequest, 
  Search
} from 'lucide-react';
import { StatCard } from '@/components/charts/StatCard';
import { api } from '@/lib/api';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => api.get(url).then(res => res.data.data);

export default function AnalyticsPage() {
  const { data: repos, isLoading: isLoadingRepos } = useSWR('/api/repos', fetcher);

  // For now, since we don't have a global analytics endpoint, 
  // we'll show a summary of all repositories and an invitation to compare them.
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Global insights across all your connected repositories.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Total Repositories" 
          value={repos?.length || 0} 
          isLoading={isLoadingRepos} 
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <StatCard 
          label="Active This Week" 
          value={repos?.filter((r: any) => new Date(r.lastPushedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length || 0} 
          isLoading={isLoadingRepos}
          icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
        />
        <StatCard 
          label="Total Stars" 
          value={repos?.reduce((acc: number, r: any) => acc + r.stars, 0) || 0} 
          isLoading={isLoadingRepos}
          icon={<Users className="h-4 w-4 text-yellow-400" />}
        />
        <StatCard 
          label="Total Forks" 
          value={repos?.reduce((acc: number, r: any) => acc + r.forks, 0) || 0} 
          isLoading={isLoadingRepos}
          icon={<GitPullRequest className="h-4 w-4 text-blue-400" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Repository Comparison</h2>
            <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Select repositories <Search className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="h-[300px] flex items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            <div className="text-center p-6">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select multiple repositories from the dashboard to compare their performance side-by-side.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Top Repositories</h2>
          <div className="space-y-4">
            {isLoadingRepos ? (
              [1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-slate-900 animate-pulse rounded-lg" />)
            ) : (
              repos?.slice(0, 5).sort((a: any, b: any) => b.stars - a.stars).map((repo: any) => (
                <Link 
                  key={repo.id} 
                  href={`/repos/${repo.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-900 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 flex items-center justify-center rounded bg-slate-800 text-xs font-bold text-slate-400">
                      {repo.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200 group-hover:text-indigo-400">{repo.name}</p>
                      <p className="text-[10px] text-slate-500">{repo.language || 'Plain Text'}</p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-400">
                    {repo.stars} stars
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

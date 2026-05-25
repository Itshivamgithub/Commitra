'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useCommitAnalytics } from '@/hooks/useCommitAnalytics';
import { AreaChart } from '@/components/charts/AreaChart';
import { StatCard } from '@/components/charts/StatCard';
import useSWR from 'swr';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then((res) => res.data.data);

export default function CommitsPage() {
  const { repoId } = useParams() as { repoId: string };
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [page, setPage] = useState(1);
  const { data: analytics, isLoading: isAnalyticsLoading } = useCommitAnalytics(repoId, range);
  
  const { data: commitListData, isLoading: isListLoading } = useSWR(
    `/api/analytics/${repoId}/commits/list?page=${page}&limit=20`,
    fetcher
  );

  const ranges: { label: string; value: '7d' | '30d' | '90d' }[] = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Commits Analytics</h2>
        <div className="flex bg-muted rounded-lg p-1">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                range === r.value ? 'bg-background shadow-sm' : 'hover:text-primary'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card text-card-foreground rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Commit Activity</h3>
        <AreaChart
          data={analytics?.timeline ?? []}
          xKey="date"
          series={[
            { key: 'count', color: 'hsl(var(--primary))', name: 'Commits' },
            { key: 'additions', color: '#10b981', name: 'Additions' },
            { key: 'deletions', color: '#ef4444', name: 'Deletions' },
          ]}
          isLoading={isAnalyticsLoading}
          height={350}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Commits" value={analytics?.totalInRange ?? 0} isLoading={isAnalyticsLoading} />
        <StatCard label="Peak Day" value={analytics?.peakDay?.count ?? 0} delta={{ value: 0, isPositive: true, label: `on ${analytics?.peakDay?.date ?? '-'}` }} isLoading={isAnalyticsLoading} />
        <StatCard 
          label="Avg per Day" 
          value={analytics?.timeline?.length ? (analytics.totalInRange / analytics.timeline.length).toFixed(1) : 0} 
          isLoading={isAnalyticsLoading} 
        />
      </div>

      <div className="bg-card text-card-foreground rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Commits List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium">
              <tr>
                <th className="px-6 py-3">SHA</th>
                <th className="px-6 py-3">Message</th>
                <th className="px-6 py-3">Author</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isListLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4 h-12 bg-muted/20"></td>
                  </tr>
                ))
              ) : commitListData?.commits?.length > 0 ? (
                commitListData.commits.map((commit: any) => (
                  <tr key={commit.sha} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">{commit.sha.substring(0, 7)}</td>
                    <td className="px-6 py-4 max-w-md truncate">{commit.message}</td>
                    <td className="px-6 py-4">{commit.authorLogin || commit.authorName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(commit.committedAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-green-600">+{commit.additions}</span>
                      <span className="text-red-600 ml-2">-{commit.deletions}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No commits found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {commitListData?.pagination && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, commitListData.pagination.total)} of {commitListData.pagination.total} commits
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border rounded text-xs disabled:opacity-50 hover:bg-muted"
              >
                Previous
              </button>
              <button
                disabled={page >= commitListData.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border rounded text-xs disabled:opacity-50 hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

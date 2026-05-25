'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { usePRAnalytics } from '@/hooks/usePRAnalytics';
import { StatCard } from '@/components/charts/StatCard';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function PullRequestsPage() {
  const { repoId } = useParams() as { repoId: string };
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { data, isLoading } = usePRAnalytics(repoId, range);

  const ranges: { label: string; value: '7d' | '30d' | '90d' }[] = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Pull Requests</h2>
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
        <h3 className="text-lg font-semibold mb-4">PR Activity</h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={data?.timeline ?? []}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" />
              <Bar dataKey="opened" name="Opened" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="merged" name="Merged" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="closed" name="Closed" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Avg Merge Time" value={`${data?.avgMergeTimeHours?.toFixed(1) ?? 0}h`} isLoading={isLoading} />
        <StatCard label="Merge Rate" value={`${Math.round(data?.mergeRate ?? 0)}%`} isLoading={isLoading} />
        <StatCard label="Avg Reviews" value={data?.reviewStats?.avgReviewCount?.toFixed(1) ?? 0} isLoading={isLoading} />
        <StatCard label="Avg Comments" value={data?.reviewStats?.avgCommentCount?.toFixed(1) ?? 0} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-card rounded-lg border flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Open PRs</p>
            <p className="text-3xl font-bold mt-1">
              {data?.timeline?.reduce((sum: number, t: any) => sum + t.opened, 0) ?? 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-amber-500"></div>
          </div>
        </div>
        <div className="p-6 bg-card rounded-lg border flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Merged PRs</p>
            <p className="text-3xl font-bold mt-1">
              {data?.timeline?.reduce((sum: number, t: any) => sum + t.merged, 0) ?? 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
          </div>
        </div>
        <div className="p-6 bg-card rounded-lg border flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Closed PRs</p>
            <p className="text-3xl font-bold mt-1">
              {data?.timeline?.reduce((sum: number, t: any) => sum + (t.closed || 0), 0) ?? 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-slate-500/10 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-slate-500"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

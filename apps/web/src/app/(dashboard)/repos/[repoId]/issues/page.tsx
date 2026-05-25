'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useIssueAnalytics } from '@/hooks/useIssueAnalytics';
import { StatCard } from '@/components/charts/StatCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';

export default function IssuesPage() {
  const { repoId } = useParams() as { repoId: string };
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { data, isLoading } = useIssueAnalytics(repoId, range);

  const ranges: { label: string; value: '7d' | '30d' | '90d' }[] = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Issues</h2>
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
        <h3 className="text-lg font-semibold mb-4">Issue Activity</h3>
        <AreaChart
          data={data?.timeline ?? []}
          xKey="date"
          series={[
            { key: 'opened', color: '#f43f5e', name: 'Opened' }, // coral-ish
            { key: 'closed', color: '#14b8a6', name: 'Closed' }, // teal-ish
          ]}
          isLoading={isLoading}
          height={350}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Resolution Rate" value={`${Math.round(data?.resolutionRate ?? 0)}%`} isLoading={isLoading} />
        <StatCard label="Avg Close Time" value={`${data?.avgCloseTimeHours?.toFixed(1) ?? 0}h`} isLoading={isLoading} />
        <StatCard 
          label="Total Opened" 
          value={data?.timeline?.reduce((sum: number, t: any) => sum + t.opened, 0) ?? 0} 
          isLoading={isLoading} 
        />
        <StatCard 
          label="Total Closed" 
          value={data?.timeline?.reduce((sum: number, t: any) => sum + t.closed, 0) ?? 0} 
          isLoading={isLoading} 
        />
      </div>

      <div className="bg-card text-card-foreground rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Top Labels</h3>
        <BarChart 
          data={data?.topLabels ?? []} 
          xKey="label" 
          yKey="count" 
          horizontal 
          color="#8b5cf6" 
          height={300} 
        />
      </div>
    </div>
  );
}

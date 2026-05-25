'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useContributors } from '@/hooks/useContributors';
import { PieChart } from '@/components/charts/PieChart';

export default function ContributorsPage() {
  const { repoId } = useParams() as { repoId: string };
  const { data, isLoading } = useContributors(repoId);

  const contributors = data?.contributors ?? [];
  
  // Prepare pie chart data
  const topContributors = contributors.slice(0, 6);
  const others = contributors.slice(6);
  const othersCommits = others.reduce((sum: number, c: any) => sum + c.totalCommits, 0);
  
  const pieData = topContributors.map((c: any) => ({
    name: c.login,
    value: c.totalCommits,
  }));
  
  if (othersCommits > 0) {
    pieData.push({ name: 'Others', value: othersCommits });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Contributors</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-card text-card-foreground rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Commit Share</h3>
          <PieChart data={pieData} isLoading={isLoading} height={350} />
        </div>
        
        <div className="lg:col-span-2 bg-card text-card-foreground rounded-lg border overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Top Contributors</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium">
                <tr>
                  <th className="px-6 py-3">Contributor</th>
                  <th className="px-6 py-3">Commits</th>
                  <th className="px-6 py-3 text-right">Additions</th>
                  <th className="px-6 py-3 text-right">Deletions</th>
                  <th className="px-6 py-3">Last Activity</th>
                  <th className="px-6 py-3 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-4 h-12 bg-muted/20"></td>
                    </tr>
                  ))
                ) : contributors.length > 0 ? (
                  contributors.map((c: any) => (
                    <tr key={c.login} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://github.com/${c.login}.png?size=32`} 
                            alt={c.login} 
                            className="h-8 w-8 rounded-full bg-muted"
                            onError={(e) => {
                               (e.target as any).src = `https://ui-avatars.com/api/?name=${c.login}`;
                            }}
                          />
                          <span className="font-medium">{c.login}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{c.totalCommits}</td>
                      <td className="px-6 py-4 text-right text-green-600">+{c.totalAdditions.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-red-600">-{c.totalDeletions.toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs">{new Date(c.lastCommit).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right font-medium">{c.percentageOfTotal}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No contributors found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

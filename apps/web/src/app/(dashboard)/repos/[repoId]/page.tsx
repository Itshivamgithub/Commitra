'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRepoOverview } from '@/hooks/useRepoOverview';
import { useComplexity } from '@/hooks/useComplexity';
import { useRepoSocket } from '@/hooks/useRepoSocket';
import { useSocket } from '@/providers/SocketProvider';
import { StatCard } from '@/components/charts/StatCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { api } from '@/lib/api';
import { RefreshCw, Code, AlertCircle, Activity, Bell, ShieldCheck, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useSWR from 'swr';

export default function RepoOverviewPage() {
  const { repoId } = useParams() as { repoId: string };
  const { overview, isLoading, mutate } = useRepoOverview(repoId);
  const { data: complexity, mutate: mutateComplexity } = useComplexity(repoId);
  const { socket } = useSocket();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Real-time updates for this repo
  useRepoSocket(repoId);

  useEffect(() => {
    if (!socket || !currentJobId) return;

    const handleProgress = (data: any) => {
      if (data.jobId === currentJobId) {
        setSyncProgress(data.progress);
        setSyncMessage(data.message);
      }
    };

    const handleCompleted = (data: any) => {
      if (data.jobId === currentJobId) {
        setIsSyncing(false);
        setSyncProgress(0);
        setSyncMessage('');
        setCurrentJobId(null);
        mutate();
        mutateComplexity();
        toast.success('Repository sync complete!');
      }
    };

    const handleFailed = (data: any) => {
      if (data.jobId === currentJobId) {
        setIsSyncing(false);
        setSyncProgress(0);
        setSyncMessage('');
        setCurrentJobId(null);
        toast.error(`Sync failed: ${data.reason}`);
      }
    };

    socket.on('job:progress', handleProgress);
    socket.on('job:completed', handleCompleted);
    socket.on('job:failed', handleFailed);

    return () => {
      socket.off('job:progress', handleProgress);
      socket.off('job:completed', handleCompleted);
      socket.off('job:failed', handleFailed);
    };
  }, [socket, currentJobId, mutate, mutateComplexity]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncMessage('Queuing sync job...');
    try {
      const response = await api.post(`/api/analytics/${repoId}/sync`);
      const { jobId } = response.data.data;
      setCurrentJobId(jobId);
    } catch (error: any) {
      setIsSyncing(false);
      toast.error(error.response?.data?.error || 'Failed to start sync');
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <StatCard key={i} label="..." value="..." isLoading />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
          <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Repository Overview</h2>
        <div className="flex items-center gap-4">
          {isSyncing && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground font-medium">{syncMessage || 'Syncing...'} {syncProgress}%</span>
              <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300" 
                  style={{ width: `${syncProgress}%` }} 
                />
              </div>
            </div>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync analytics'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Commits" value={overview?.totalCommits ?? 0} />
        <StatCard label="Open PRs" value={overview?.openPRs ?? 0} />
        <StatCard label="Merged PRs" value={overview?.mergedPRs ?? 0} />
        <StatCard label="Open Issues" value={overview?.openIssues ?? 0} />
        <StatCard 
          label="Avg PR Merge" 
          value={`${overview?.avgPRMergeTime?.toFixed(1) ?? 0}h`} 
        />
        <StatCard 
          label="Avg Issue Close" 
          value={`${overview?.avgIssueCloseTime?.toFixed(1) ?? 0}h`} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card text-card-foreground rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Commit Activity (Last 30 Days)</h3>
          <CommitActivityChart repoId={repoId} />
        </div>
        <div className="bg-card text-card-foreground rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Top Contributors</h3>
          <BarChart 
            data={overview?.topContributors ?? []} 
            xKey="login" 
            yKey="commits" 
            horizontal 
            height={300}
          />
        </div>
      </div>

      {/* Webhook Status Section */}
      <WebhookStatusSection repoId={repoId} />

      {/* Complexity Section */}
      <div className="bg-card text-card-foreground rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-6">
          <Code className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Code Complexity Analysis</h3>
        </div>
        
        {complexity ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Complexity Score</p>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold">{Math.round(complexity.complexityScore)}</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    complexity.complexityScore < 25 ? 'bg-green-100 text-green-700' :
                    complexity.complexityScore < 50 ? 'bg-blue-100 text-blue-700' :
                    complexity.complexityScore < 75 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {complexity.complexityLabel}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Files</p>
                  <p className="text-lg font-semibold">{complexity.totalFiles.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Estimated Lines</p>
                  <p className="text-lg font-semibold">{complexity.totalLines.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <p className="text-sm text-muted-foreground mb-4 text-center">Language Distribution</p>
              <div className="h-[200px]">
                <PieChart 
                  data={complexity.languageBreakdown.map((l: any) => ({ name: l.language, value: l.percentage }))} 
                  height={200}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Run a sync to generate complexity analysis</p>
          </div>
        )}
      </div>

      {/* Live Activity Feed */}
      <LiveActivityFeed repoId={repoId} />
    </div>
  );
}

function WebhookStatusSection({ repoId }: { repoId: string }) {
  const { data, isLoading, mutate } = useSWR(`/api/webhooks/${repoId}/status`, (url) => 
    api.get(url).then(res => res.data.data)
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const toggleWebhook = async () => {
    setIsUpdating(true);
    try {
      if (data?.enabled) {
        await api.delete(`/api/webhooks/${repoId}`);
        toast.success('Auto-sync disabled');
      } else {
        await api.post(`/api/webhooks/${repoId}/register`);
        toast.success('Auto-sync enabled');
      }
      await mutate();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update webhook status');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <div className="h-20 bg-muted animate-pulse rounded-lg" />;

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${data?.enabled ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'}`}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">GitHub Auto-Sync</h3>
            <p className="text-xs text-muted-foreground">Automatically sync data when you push commits or open PRs</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {data?.enabled && (
            <div className="hidden md:block text-right">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Listening for</p>
              <p className="text-[10px] font-medium">push, pull_request, issues</p>
            </div>
          )}
          <button
            onClick={toggleWebhook}
            disabled={isUpdating}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              data?.enabled 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isUpdating ? 'Updating...' : data?.enabled ? 'Disable Auto-Sync' : 'Enable Auto-Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LiveActivityFeed({ repoId }: { repoId: string }) {
  const [activities, setActivity] = useState<any[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleWebhook = (data: any) => {
      if (data.repoId === repoId) {
        setActivity(prev => [{
          id: Math.random().toString(),
          type: data.event,
          message: data.message,
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 5));
      }
    };

    socket.on('webhook:received', handleWebhook);
    return () => {
      socket.off('webhook:received', handleWebhook);
    };
  }, [socket, repoId]);

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Live Activity</h3>
      </div>
      
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">No recent activity detected</p>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-primary/20 transition-all">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary mt-0.5">
                <Bell className="h-3 w-3" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{act.message}</p>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] uppercase font-bold text-primary/70">{act.type}</span>
                   <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                     <Clock className="h-2.5 w-2.5" />
                     {new Date(act.timestamp).toLocaleTimeString()}
                   </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Helper component for commit activity in overview
function CommitActivityChart({ repoId }: { repoId: string }) {
  const { data, isLoading } = useSWR(`/api/analytics/${repoId}/commits?range=30d`, (url) => 
    api.get(url).then(res => res.data.data)
  );

  return (
    <AreaChart 
      data={data?.timeline ?? []} 
      xKey="date" 
      series={[{ key: 'count', color: 'hsl(var(--primary))', name: 'Commits' }]} 
      isLoading={isLoading}
      height={300}
    />
  );
}

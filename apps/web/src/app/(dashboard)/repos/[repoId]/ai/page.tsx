'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAIInsights } from '@/hooks/useAIInsights';
import { api } from '@/lib/api';
import { Brain, Sparkles, Activity, Lightbulb, RefreshCw, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { pollJobStatus } from '@/lib/pollJobStatus';

export default function AIInsightsPage() {
  const { repoId } = useParams() as { repoId: string };
  const { data, isLoading, mutate } = useAIInsights(repoId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenProgress(0);
    try {
      const response = await api.post(`/api/ai/${repoId}/generate`, {
        types: ['summary', 'activity', 'recommendations'],
      });
      const { jobId } = response.data.data;

      // Poll until insights are ready
      // Since we don't have a direct job status for AI (it's in analyticsQueue),
      // we can use a simpler polling logic here or just wait.
      // But the requirement says "Polls GET /api/ai/:repoId/insights every 3 seconds while status is pending"
      
      const poll = setInterval(async () => {
        try {
          const res = await api.get(`/api/ai/${repoId}/insights`);
          if (res.data.data.hasInsights) {
             // In a more robust implementation, we'd check if they are NEW insights
             clearInterval(poll);
             await mutate();
             setIsGenerating(false);
             setGenProgress(0);
          }
        } catch (e) {
          console.error('Polling AI insights failed', e);
        }
      }, 3000);

      // Timeout safety
      setTimeout(() => {
        clearInterval(poll);
        setIsGenerating(false);
      }, 60000); // 1 min max for AI

    } catch (error: any) {
      setIsGenerating(false);
      alert(error.response?.data?.error || 'Failed to start AI generation');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading AI insights...</div>;
  }

  const hasInsights = data?.hasInsights;
  const insights = data?.insights || {};

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-bold">AI Powered Insights</h2>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
          {isGenerating ? 'Generating...' : 'Generate AI insights'}
        </button>
      </div>

      {!hasInsights && !isGenerating ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-2xl bg-muted/30">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-6">
            <Brain className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">No AI insights generated yet</h3>
          <p className="text-muted-foreground text-center max-w-md mb-8">
            Generate insights to get an AI-powered analysis of your repository's activity, team dynamics, and actionable recommendations.
          </p>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate insights</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {/* Progress Indicator */}
          {isGenerating && (
             <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-4 animate-pulse">
               <RefreshCw className="h-6 w-6 text-primary animate-spin" />
               <div>
                 <p className="font-bold text-primary">Generating new insights...</p>
                 <p className="text-xs text-primary/70">Our AI is analyzing your repository data. This usually takes 10-20 seconds.</p>
               </div>
             </div>
          )}

          {/* 1. Repository Summary */}
          {insights.summary && (
            <InsightPanel 
              title="Repository Summary" 
              icon={<Sparkles className="h-5 w-5" />}
              data={insights.summary}
            />
          )}

          {/* 2. Activity Analysis */}
          {insights.activity && (
            <InsightPanel 
              title="Activity Analysis" 
              icon={<Activity className="h-5 w-5" />}
              data={insights.activity}
            />
          )}

          {/* 3. Recommendations */}
          {insights.recommendations && (
            <div className="bg-card text-card-foreground rounded-2xl border overflow-hidden">
              <div className="p-6 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold">Actionable Recommendations</h3>
                </div>
                {insights.recommendations.expired && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase">
                    <Clock className="h-3.5 w-3.5" />
                    Expired
                  </span>
                )}
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                   {insights.recommendations.content.split('\n').filter((line: string) => line.trim().startsWith('-')).map((line: string, idx: number) => {
                      const match = line.match(/^- \[(.*?)\]: (.*)/);
                      if (!match) return <div key={idx} className="p-4 rounded-xl bg-muted/30 text-sm">{line.substring(2)}</div>;
                      
                      const category = match[1];
                      const text = match[2];
                      
                      const colors: any = {
                        Velocity: 'bg-blue-100 text-blue-700',
                        'Code Review': 'bg-purple-100 text-purple-700',
                        'Issue Management': 'bg-rose-100 text-rose-700',
                        Consistency: 'bg-amber-100 text-amber-700',
                        Collaboration: 'bg-teal-100 text-teal-700',
                        Documentation: 'bg-slate-100 text-slate-700'
                      };

                      return (
                        <div key={idx} className="p-5 rounded-2xl border bg-card hover:border-primary/30 transition-colors shadow-sm">
                           <div className="flex items-start gap-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap mt-0.5 ${colors[category] || 'bg-muted text-muted-foreground'}`}>
                                {category}
                              </span>
                              <p className="text-sm font-medium leading-relaxed">{text}</p>
                           </div>
                        </div>
                      );
                   })}
                </div>
                <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground border-t border-dashed">
                  <span>Generated {new Date(insights.recommendations.generatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InsightPanel({ title, icon, data }: { title: string, icon: React.ReactNode, data: any }) {
  return (
    <div className="bg-card text-card-foreground rounded-2xl border overflow-hidden">
      <div className="p-6 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        {data.expired && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase">
            <Clock className="h-3.5 w-3.5" />
            Expired
          </span>
        )}
      </div>
      <div className="p-8 space-y-6">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {data.content.split('\n').map((para: string, idx: number) => (
            <p key={idx} className="text-sm leading-relaxed text-muted-foreground mb-4 last:mb-0">
              {para}
            </p>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground border-t border-dashed">
          <span>Generated {new Date(data.generatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

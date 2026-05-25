'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useHealthScore } from '@/hooks/useHealthScore';
import { StatCard } from '@/components/charts/StatCard';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from 'recharts';
import { CheckCircle2, AlertTriangle, Info, Clock, TrendingUp, TrendingDown } from 'lucide-react';

export default function HealthPage() {
  const { repoId } = useParams() as { repoId: string };
  const { health, isLoading } = useHealthScore(repoId);

  if (isLoading) {
    return <div className="p-8 text-center">Loading health score...</div>;
  }

  if (!health) {
    return (
      <div className="p-12 text-center border-2 border-dashed rounded-xl">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-bold">No health score available</h3>
        <p className="text-muted-foreground mt-2">Sync this repository to calculate its health score.</p>
      </div>
    );
  }

  const scoreData = [{ value: health.overallScore }];

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-emerald-500';
    if (grade.startsWith('B')) return 'bg-blue-500';
    if (grade.startsWith('C')) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="space-y-8">
      {/* Score Hero */}
      <div className="bg-card text-card-foreground rounded-2xl border p-8 flex flex-col md:flex-row items-center gap-12">
        <div className="relative h-48 w-48">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="80%"
              outerRadius="100%"
              data={scoreData}
              startAngle={90}
              endAngle={450}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background
                dataKey="value"
                cornerRadius={10}
                fill={getScoreColor(health.overallScore)}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-extrabold">{Math.round(health.overallScore)}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Overall</span>
          </div>
        </div>

        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <h2 className="text-3xl font-bold">Repository Health</h2>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-white font-bold text-sm ${getGradeColor(health.grade)}`}>
              Grade: {health.grade}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Calculated {new Date(health.calculatedAt).toLocaleString()}</span>
            </div>
            {health.scoreDelta !== null && (
              <div className={`flex items-center gap-1 font-medium ${health.scoreDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {health.scoreDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{Math.abs(health.scoreDelta).toFixed(1)} points since last sync</span>
              </div>
            )}
          </div>
          
          <p className="text-muted-foreground max-w-2xl">
            This score is a weighted average of commit consistency, PR health, issue responsiveness, code activity, and community engagement.
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(health.categories).map(([key, cat]: any) => (
          <div key={key} className="bg-card rounded-xl border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1')}</p>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{Math.round(cat.score)}</span>
              <span className="text-[10px] font-medium text-muted-foreground">/ 100</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${cat.score >= 70 ? 'bg-emerald-500' : cat.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                style={{ width: `${cat.score}%` }} 
              />
            </div>
            <p className={`text-[10px] font-bold uppercase ${cat.score >= 70 ? 'text-emerald-600' : cat.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {cat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Insights List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          Health Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {health.insights.map((insight: string, idx: number) => {
            const isWarning = /no commits|dragging|only 1|consider|Needs attention/i.test(insight);
            return (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border-l-4 bg-card shadow-sm border ${isWarning ? 'border-l-yellow-500' : 'border-l-emerald-500'}`}
              >
                <div className="flex items-start gap-3">
                  {isWarning ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium">{insight}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

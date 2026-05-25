'use client';

import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
  horizontal?: boolean;
  isLoading?: boolean;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  xKey,
  yKey,
  color = 'hsl(var(--primary))',
  horizontal = false,
  isLoading,
  height = 300,
}) => {
  if (isLoading) {
    return (
      <div 
        className="w-full bg-muted animate-pulse rounded-lg" 
        style={{ height }} 
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div 
        className="w-full flex items-center justify-center bg-muted/20 rounded-lg border border-dashed" 
        style={{ height }}
      >
        <p className="text-muted-foreground">No data available for this period</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 10, right: 30, left: 40, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} stroke="hsl(var(--muted))" />
          {horizontal ? (
            <>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey={xKey} 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                width={80}
              />
            </>
          ) : (
            <>
              <XAxis 
                dataKey={xKey} 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
            </>
          )}
          <Tooltip 
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              borderColor: 'hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px'
            }}
          />
          <Bar dataKey={yKey} fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} barSize={20} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChart;

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, delta, isLoading, icon }) => {
  if (isLoading) {
    return (
      <div className="bg-card text-card-foreground rounded-lg border shadow-sm p-6 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-2"></div>
        <div className="h-8 w-16 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border shadow-sm p-6 relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <div className="text-slate-500 group-hover:text-indigo-400 transition-colors">{icon}</div>}
      </div>
      <div className="flex items-baseline space-x-2 mt-1">
        <h3 className="text-2xl font-bold">{value}</h3>
        {delta && (
          <span className={`text-xs font-medium ${delta.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {delta.isPositive ? '+' : ''}{delta.value} {delta.label}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;

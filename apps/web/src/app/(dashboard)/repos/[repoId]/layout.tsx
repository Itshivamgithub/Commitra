'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { repoId: string };
}) {
  const pathname = usePathname();
  const repoId = params.repoId;

  const tabs = [
    { name: 'Overview', href: `/repos/${repoId}` },
    { name: 'Commits', href: `/repos/${repoId}/commits` },
    { name: 'Contributors', href: `/repos/${repoId}/contributors` },
    { name: 'Pull Requests', href: `/repos/${repoId}/pull-requests` },
    { name: 'Issues', href: `/repos/${repoId}/issues` },
    { name: 'Health', href: `/repos/${repoId}/health` },
    { name: 'AI Insights', href: `/repos/${repoId}/ai` },
  ];

  return (
    <div className="flex flex-col space-y-6 p-8 pt-6">
      <div className="flex items-center space-x-4 border-b">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`pb-3 text-sm font-medium transition-colors hover:text-primary ${
                isActive
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}

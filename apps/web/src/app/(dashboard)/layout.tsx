'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/auth';
import { 
  LayoutDashboard, 
  GitFork, 
  BarChart3, 
  LogOut, 
  Code2, 
  ChevronRight, 
  User as UserIcon 
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar - 240px (w-60) */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-900 bg-slate-950/50 backdrop-blur-xl">
        {/* Logo area */}
        <div className="flex h-16 items-center gap-2 border-b border-slate-900 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 shadow-md shadow-indigo-500/10">
            <Code2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Commitra</span>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-900"
          >
            <LayoutDashboard className="h-4 w-4 text-indigo-400" />
            <span>Dashboard</span>
            <ChevronRight className="ml-auto h-3 w-3 text-slate-500" />
          </Link>

          <div
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-slate-900/10 hover:text-slate-400"
            title="Coming soon in Phase 2"
          >
            <GitFork className="h-4 w-4" />
            <span>Repositories</span>
            <span className="ml-auto rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
              Soon
            </span>
          </div>

          <div
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-slate-900/10 hover:text-slate-400"
            title="Coming soon in Phase 2"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
            <span className="ml-auto rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
              Soon
            </span>
          </div>
        </nav>

        {/* User profile / footer in sidebar */}
        <div className="border-t border-slate-900 p-4">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="h-9 w-9 rounded-full ring-2 ring-indigo-500/20"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                <UserIcon className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-semibold text-white">
                {user.displayName || user.username}
              </p>
              <p className="truncate text-[10px] text-slate-500">@{user.username}</p>
            </div>
            <button
              onClick={() => logout()}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-900 hover:text-slate-350"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-900 bg-slate-950/80 px-8 backdrop-blur-md">
          <div className="flex items-center">
            <h2 className="text-sm font-semibold text-slate-400">Platform Workspace</h2>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              GitHub Help
            </a>
            <div className="h-4 w-[1px] bg-slate-900" />
            <span className="rounded bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400">
              Developer Sandbox
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="min-h-[calc(100vh-4rem)] p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

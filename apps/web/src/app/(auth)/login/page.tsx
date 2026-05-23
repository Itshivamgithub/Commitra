'use client';

import React, { useState } from 'react';
import { useUser } from '@/context/auth';
import { Github, Code2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    login();
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo/Wordmark */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Code2 className="h-6 w-6 text-indigo-400" />
            </div>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
            Commitra
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            GitHub Insights meets Datadog
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-8 shadow-2xl shadow-indigo-500/5">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-slate-200">Welcome to Commitra</h2>
            <p className="mt-1 text-xs text-slate-400">
              Connect your GitHub account to sync your repositories, contributor analytics, and insights.
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="relative flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-slate-100 hover:shadow-lg hover:shadow-white/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
            ) : (
              <>
                <Github className="h-5 w-5 fill-current" />
                <span>Sign in with GitHub</span>
                <ArrowRight className="h-4 w-4 ml-auto text-slate-500" />
              </>
            )}
          </button>

          <div className="mt-6 flex flex-col gap-2 text-center text-[10px] text-slate-500">
            <p>By signing in, you grant read access to your public/private repositories and email profile details.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-slate-600">
          Commitra &copy; {new Date().getFullYear()} — Built for high-velocity teams.
        </div>
      </div>
    </div>
  );
}

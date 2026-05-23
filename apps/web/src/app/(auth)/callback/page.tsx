'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/auth';
import { setAccessToken } from '@/lib/api';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { rehydrate } = useUser();
  
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setAccessToken(token);
      rehydrate().then(() => {
        router.push('/');
      });
    } else {
      router.push('/login?error=no_token_callback');
    }
  }, [searchParams, rehydrate, router]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent"></div>
        <p className="text-lg font-medium text-slate-300">Authenticating with GitHub...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 rounded-full border-2 border-slate-800" />
          <p className="text-slate-400 text-lg font-medium">Loading auth context...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}

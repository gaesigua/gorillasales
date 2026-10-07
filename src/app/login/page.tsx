'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { loginAction } from '@/actions/auth';
import { LogIn, Lock } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  // Only allow same-site relative redirects (blocks open redirects like //evil.com)
  const fromPath = from && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    const res = await loginAction(email, password);
    setLoading(false);

    if (res.success) {
      router.push(fromPath);
      router.refresh();
    } else {
      setError(res.error || 'Login failed');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md p-7 shadow-sm space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-yellow-500/10 border border-yellow-500/30 mb-1">
          <AppLogo size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">GorillaSales Enterprise</h1>
        <p className="text-xs text-slate-500">
          Multi-Tenant Coffee Distribution CRM & SFA Platform
        </p>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-center">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Work Email Address
          </label>
          <input
            type="email"
            required
            placeholder="eric.m@gorillacoffee.rw"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
            />
            <Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50 shadow-sm"
        >
          {loading ? (
            'Authenticating...'
          ) : (
            <>
              <LogIn size={16} />
              Sign In to Workspace
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="p-8 bg-white border border-slate-200 rounded-md text-center text-slate-600 text-sm">Loading workspace auth...</div>}>
          <LoginForm />
        </Suspense>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500 mt-4">
          GorillaSales Enterprise CRM · Protected by JWT HTTP-Only Cookie Session Guards
        </p>
      </div>
    </div>
  );
}

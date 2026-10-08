'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/actions/auth';

/** Email + password sign-in, as a classic fieldset. Used on the homepage and /login. */
export default function SignInForm({ autoFocus = false }: { autoFocus?: boolean }) {
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
    <form onSubmit={handleSubmit}>
      <fieldset className="border border-border bg-card p-3">
        <legend className="bg-gold px-2 font-bold text-black">Staff sign in</legend>

        {error && <p className="mb-2 border border-negative bg-negative-bg px-2 py-1 text-sm text-negative">{error}</p>}

        <label htmlFor="email" className="block text-sm font-bold">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-2 w-full px-1.5 py-1 text-sm"
        />
        <label htmlFor="password" className="block text-sm font-bold">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full px-1.5 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full border border-brand bg-brand px-4 py-1.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">Forgotten your password? Ask your manager to reset it.</p>
      </fieldset>
    </form>
  );
}

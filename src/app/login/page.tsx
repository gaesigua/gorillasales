'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/actions/auth';

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
    <form onSubmit={handleSubmit}>
      <fieldset className="border border-border bg-card p-4">
        <legend className="px-1 font-bold">Sign in</legend>

        {error && <p className="mb-3 border border-negative bg-negative-bg px-2 py-1 text-sm text-negative">{error}</p>}

        <table className="w-full border-0 [&_td]:border-0 [&_tr]:bg-transparent">
          <tbody>
            <tr>
              <td className="w-24 py-1 pr-2 text-sm">
                <label htmlFor="email">Email:</label>
              </td>
              <td className="py-1">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-1.5 py-1 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-2 text-sm">
                <label htmlFor="password">Password:</label>
              </td>
              <td className="py-1">
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-1.5 py-1 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td />
              <td className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="border border-brand bg-brand px-4 py-1 text-sm font-bold text-white disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-brand px-4 py-2 text-white">
        <a href="/" className="text-lg font-bold text-white no-underline">
          GorillaSales
        </a>
        <span className="ml-3 text-sm">Sales &amp; distribution system</span>
      </div>
      <div className="mx-auto max-w-sm px-4 pt-12">
        <Suspense fallback={<p className="text-sm">Loading...</p>}>
          <LoginForm />
        </Suspense>
        <p className="mt-3 text-xs text-muted-foreground">
          Forgotten your password? Ask your manager or administrator to reset it in Users.
        </p>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import PublicHeader from '@/components/brand/PublicHeader';
import PublicFooter from '@/components/brand/PublicFooter';
import SignInForm from '@/components/auth/SignInForm';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 sm:grid-cols-[1fr_300px]">
        <div className="hidden sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/coffee-cherries.webp"
            alt="Ripe coffee cherries on the branch"
            width={1100}
            height={720}
            className="h-auto w-full border border-border"
          />
        </div>
        <div>
          <Suspense fallback={<p className="text-sm">Loading...</p>}>
            <SignInForm autoFocus />
          </Suspense>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

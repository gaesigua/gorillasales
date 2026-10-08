import Link from 'next/link';
import PublicHeader from '@/components/brand/PublicHeader';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-bold">Page not found (404)</h1>
        <p className="mt-2 text-sm">The page you asked for does not exist or has moved.</p>
        <p className="mt-4 text-sm">
          <Link href="/dashboard">Go to the dashboard</Link> · <Link href="/">Home page</Link>
        </p>
      </div>
    </div>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-brand px-4 py-2 text-lg font-bold text-white">GorillaSales</div>
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-xl font-bold">Page not found (404)</h1>
        <p className="mt-2 text-sm">The page you asked for does not exist or has moved.</p>
        <p className="mt-4 text-sm">
          <Link href="/dashboard">Go to the dashboard</Link> · <Link href="/">Home page</Link>
        </p>
      </div>
    </div>
  );
}

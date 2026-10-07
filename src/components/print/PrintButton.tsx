'use client';

import Link from 'next/link';

/** Toolbar shown above a printable document; hidden on paper. */
export default function PrintBar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <p className="no-print mb-4 flex items-center gap-4 text-sm">
      <button onClick={() => window.print()} className="border border-brand bg-brand px-3 py-1 font-bold text-white">
        Print
      </button>
      <Link href={backHref}>{backLabel}</Link>
    </p>
  );
}

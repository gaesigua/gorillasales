import Link from 'next/link';
import BrandMark from './BrandMark';
import { COMPANY } from '@/lib/company';

/** Black bar with the gold mark, for pages outside the app (home, sign-in, 404). */
export default function PublicHeader({ right }: { right?: React.ReactNode }) {
  return (
    <div className="border-b-4 border-gold bg-brand text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-3 text-white no-underline">
          <BrandMark size={40} />
          <span>
            <span className="block text-xl font-bold leading-tight">GorillaSales</span>
            <span className="block text-xs text-gray-300">
              {COMPANY.name} · sales &amp; distribution
            </span>
          </span>
        </Link>
        {right}
      </div>
    </div>
  );
}

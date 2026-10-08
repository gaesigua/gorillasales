import { Suspense } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import PublicHeader from '@/components/brand/PublicHeader';
import PublicFooter from '@/components/brand/PublicFooter';
import SignInForm from '@/components/auth/SignInForm';

const PRODUCTS = [
  { src: '/brand/product-bag.webp', name: 'Roasted ground coffee', w: 188, h: 360 },
  { src: '/brand/product-instant.webp', name: 'Instant coffee sachets', w: 360, h: 290 },
  { src: '/brand/product-beans.webp', name: 'Coffee beans', w: 360, h: 300 },
];

const MODULES: [string, string][] = [
  ['Visits & orders', 'Daily field visits with the order taken on the spot — also with no signal.'],
  ['Deliveries', 'Delivery runs from the warehouse, driver stops and cash collected.'],
  ['Receivables', 'Invoices, MoMo / bank / cash payments, credit notes and aging.'],
  ['Stock', 'Inventory by roast batch, roast runs and stock movements.'],
  ['Customers & routes', 'Accounts, credit terms and weekly visit routes per officer.'],
  ['Targets & reports', 'Pipeline, monthly targets, commission and printable reports.'],
];

export default async function PublicHomePage() {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader
        right={
          session ? (
            <Link href="/dashboard" className="text-sm text-white underline">
              Go to dashboard
            </Link>
          ) : null
        }
      />

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="grid gap-6 sm:grid-cols-[1fr_300px]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/coffee-cherries.webp"
              alt="Ripe coffee cherries on the branch"
              width={1100}
              height={720}
              className="h-auto w-full border border-border"
            />
            <p className="mt-1 text-xs text-muted-foreground">Rwandan Arabica, from cherry to cup.</p>
          </div>

          <div>
            {session ? (
              <fieldset className="border border-border p-3">
                <legend className="bg-gold px-2 font-bold text-black">Signed in</legend>
                <p className="text-sm">
                  You are signed in as <strong>{session.name}</strong>.
                </p>
                <p className="mt-2 text-sm">
                  <Link href="/dashboard">Dashboard</Link> · <Link href="/daily-sales-entry">Log a visit</Link>
                </p>
              </fieldset>
            ) : (
              <Suspense fallback={<p className="text-sm">Loading...</p>}>
                <SignInForm />
              </Suspense>
            )}

            <h1 className="mt-5 text-lg font-bold">GorillaSales</h1>
            <p className="mt-1 text-sm">
              The sales and distribution system of {"Gorilla's Coffee"}: from the visit to the delivery to the payment.
            </p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <caption className="bg-gold-pale border border-b-0 border-border px-2 py-1 text-left font-bold">
            What GorillaSales covers
          </caption>
          <tbody>
            {MODULES.map(([name, text]) => (
              <tr key={name}>
                <td className="w-44 px-2 py-1 align-top font-bold">{name}</td>
                <td className="px-2 py-1">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-6 mb-2 border-b-2 border-gold pb-1 text-base font-bold">Our products</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PRODUCTS.map((p) => (
            <li key={p.name} className="flex items-center gap-3 border border-border p-2">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.name} width={p.w} height={p.h} className="max-h-24 w-auto" loading="lazy" />
              </span>
              <strong className="text-sm">{p.name}</strong>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          Full range and stockists: <a href="https://gorillascoffee.com">gorillascoffee.com</a>
        </p>
      </div>

      <PublicFooter />
    </div>
  );
}

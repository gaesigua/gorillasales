'use client';

import React from 'react';
import Link from 'next/link';

const MODULES: [string, string][] = [
  ['Visits', 'Daily field visits by sales officers, with the order taken on the spot.'],
  ['Orders', 'Multi-line sales orders, credit-limit checks and manager approval of held orders.'],
  ['Deliveries', 'Delivery runs from the warehouse: picking lists, driver stops and cash collected.'],
  ['Receivables', 'Invoices, payments (cash, MoMo, bank), credit notes and an aging report.'],
  ['Inventory', 'Stock by roast batch with roast and expiry dates, roast runs and stock movements.'],
  ['Customers & routes', 'Customer accounts, credit terms and weekly visit routes per officer.'],
  ['Pipeline & targets', 'Deals by stage, a weighted forecast, monthly targets and commission.'],
  ['Reports', 'Monthly sales report and weekly customer reports, ready to print or export.'],
];

export default function HomePageClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between bg-brand px-4 py-2 text-white">
        <span>
          <span className="text-lg font-bold">GorillaSales</span>
          <span className="ml-3 hidden text-sm sm:inline">Sales &amp; distribution system</span>
        </span>
        <Link href={isLoggedIn ? '/dashboard' : '/login'} className="text-sm text-white underline">
          {isLoggedIn ? 'Go to dashboard' : 'Sign in'}
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">GorillaSales</h1>
        <p className="mt-2 text-sm">
          Sales force automation and sales operations for a coffee roasting and distribution business in Rwanda. Prices
          in RWF, VAT at 18%, payments by cash, mobile money or bank.
        </p>

        <table className="mt-6 w-full text-sm">
          <caption className="pb-1 text-left font-bold">What it covers</caption>
          <tbody>
            {MODULES.map(([name, text]) => (
              <tr key={name}>
                <td className="w-44 px-2 py-1 align-top font-bold">{name}</td>
                <td className="px-2 py-1">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-6 text-sm">
          {isLoggedIn ? (
            <Link href="/dashboard">Go to your dashboard</Link>
          ) : (
            <>
              Staff: <Link href="/login">sign in here</Link>. Accounts are created by your manager or administrator.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

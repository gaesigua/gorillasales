import React from 'react';

export interface PartyDetails {
  name: string;
  tin: string;
  lines: string[];
}

/** Seller / buyer block and document title used by printed invoices and credit notes. */
export default function DocumentHeader({
  title,
  number,
  seller,
  buyer,
  facts,
}: {
  title: string;
  number: string;
  seller: PartyDetails;
  buyer: PartyDetails;
  facts: [string, string][];
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-2">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/gorillas-coffee-logo.png"
            alt="Gorilla's Coffee"
            width={72}
            height={110}
            className="h-auto w-[72px]"
          />
          <div>
            <p className="text-xl font-bold">{seller.name}</p>
            {seller.tin && <p className="text-sm">TIN: {seller.tin}</p>}
            {seller.lines.map((l) => (
              <p key={l} className="text-sm">
                {l}
              </p>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{title}</p>
          <p className="font-mono text-lg">{number}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-6">
        <div>
          <p className="text-xs font-bold">Bill to</p>
          <p className="font-bold">{buyer.name}</p>
          {buyer.tin && <p className="text-sm">TIN: {buyer.tin}</p>}
          {buyer.lines.map((l) => (
            <p key={l} className="text-sm">
              {l}
            </p>
          ))}
        </div>
        <table className="text-sm">
          <tbody>
            {facts.map(([k, v]) => (
              <tr key={k}>
                <th className="bg-[var(--table-head)] px-2 py-0.5 text-left font-bold">{k}</th>
                <td className="px-2 py-0.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

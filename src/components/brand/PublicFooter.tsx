import { COMPANY, PARTNERS } from '@/lib/company';

/** Classic grey footer: contact details, certifications and partners, copyright. */
export default function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-8 border-t-4 border-gold bg-[#ececec] text-sm">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <table className="w-full border-0 text-sm [&_td]:border-0 [&_td]:align-top [&_tr]:bg-transparent">
          <tbody>
            <tr className="flex flex-col gap-3 sm:table-row">
              <td className="sm:w-1/3 sm:pr-4">
                <strong>{COMPANY.name}</strong>
                <br />
                {COMPANY.addressLines.map((l) => (
                  <span key={l}>
                    {l}
                    <br />
                  </span>
                ))}
              </td>
              <td className="sm:w-1/3 sm:pr-4">
                <strong>Contact</strong>
                <br />
                Phone: <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}>{COMPANY.phone}</a>
                <br />
                Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                <br />
                Website: <a href={COMPANY.website}>gorillascoffee.com</a>
              </td>
              <td className="sm:w-1/3">
                <strong>GorillaSales</strong>
                <br />
                Staff system for orders, visits, deliveries and receivables. Accounts are created by your manager.
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 mb-2 text-xs font-bold">Certifications &amp; partners</p>
        <ul className="flex flex-wrap items-center gap-2">
          {PARTNERS.map((p) => (
            <li key={p.file} className="border border-border bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/${p.file}`} alt={p.name} title={p.name} className="h-9 w-auto" loading="lazy" />
            </li>
          ))}
        </ul>

        <p className="mt-4 border-t border-border pt-2 text-center text-xs text-muted-foreground">
          © {year} {COMPANY.name} · {COMPANY.tagline} · <a href={COMPANY.website}>gorillascoffee.com</a>
        </p>
      </div>
    </footer>
  );
}

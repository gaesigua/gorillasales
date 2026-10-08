import { prisma } from '@/lib/prisma';
import { requirePageSession } from '@/lib/tenant';
import { ROLE_LABELS } from '@/lib/roles';
import { APP_VERSION, COMPANY } from '@/lib/company';

export const metadata = { title: 'Help' };

export default async function HelpPage() {
  const session = await requirePageSession();
  const admins = await prisma.user.findMany({
    where: { organizationId: session.organizationId, isActive: true, role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true, name: true, email: true, phone: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  const h2 = 'mt-6 mb-2 border-b-2 border-gold pb-1 text-base font-bold';
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <h1 className="text-xl font-bold">Help</h1>
      <p className="mt-1 text-muted-foreground">GorillaSales version {APP_VERSION}</p>

      <h2 className={h2}>Working with no signal</h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Before going out, open the <strong>Visits</strong> page once while you have a connection. The phone keeps a
          copy of it, with your customers, products and prices.
        </li>
        <li>
          With no signal, a line under the tabs says <strong>No connection</strong>. Log visits and orders as usual:
          they are saved on the phone and listed under <em>Saved on this phone, not yet sent</em>.
        </li>
        <li>
          When the connection returns they are sent automatically, or press <strong>Send now</strong>. Prices, credit
          limits and stock are checked when a visit is sent, so an order may arrive on credit hold.
        </li>
        <li>
          A visit marked <strong>Not accepted</strong> shows the reason; fix the cause and press <em>Try again</em>, or
          delete it.
        </li>
        <li>
          <strong>Logging out deletes unsent visits from the phone</strong> (you are warned first). Send them before
          handing the phone to someone else.
        </li>
        <li>Other pages need the internet.</li>
      </ol>

      <h2 className={h2}>Add GorillaSales to your phone</h2>
      <p>
        Android (Chrome): menu ⋮ → <em>Add to Home screen</em>. iPhone (Safari): Share → <em>Add to Home Screen</em>. It
        opens straight on the Visits page.
      </p>

      <h2 className={h2}>Keyboard shortcuts (Visits page)</h2>
      <table className="w-full">
        <tbody>
          <tr>
            <td className="w-40 px-2 py-1 font-bold">Tab</td>
            <td className="px-2 py-1">Next field</td>
          </tr>
          <tr>
            <td className="px-2 py-1 font-bold">Enter in Quantity</td>
            <td className="px-2 py-1">Go to the next product line (adds one at the end)</td>
          </tr>
          <tr>
            <td className="px-2 py-1 font-bold">Ctrl + Enter</td>
            <td className="px-2 py-1">Save the visit</td>
          </tr>
        </tbody>
      </table>

      <h2 className={h2}>Printing</h2>
      <p>
        Invoices and credit notes: open the invoice under <strong>Receivables</strong> and click <em>Print</em>. Reports
        print without the menus.
      </p>

      <h2 id="contacts" className={h2}>
        Who to contact
      </h2>
      <p className="mb-2">
        Accounts, passwords, roles, prices and targets are managed by your administrators and managers:
      </p>
      {admins.length === 0 ? (
        <p className="text-muted-foreground">No active administrators found.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left">Name</th>
              <th className="px-2 py-1 text-left">Role</th>
              <th className="px-2 py-1 text-left">Email</th>
              <th className="px-2 py-1 text-left">Phone</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="px-2 py-1">{a.name}</td>
                <td className="px-2 py-1">{ROLE_LABELS[a.role]}</td>
                <td className="px-2 py-1">
                  <a href={`mailto:${a.email}`}>{a.email}</a>
                </td>
                <td className="px-2 py-1">
                  {a.phone ? <a href={`tel:${a.phone.replace(/\s/g, '')}`}>{a.phone}</a> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3">
        {COMPANY.name} office: {COMPANY.addressLines.join(', ')} · Phone{' '}
        <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`}>{COMPANY.phone}</a> ·{' '}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
      </p>
    </div>
  );
}

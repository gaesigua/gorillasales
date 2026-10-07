import { requirePageSession } from '@/lib/tenant';
import { agingOf, listCreditNotes, listInvoices } from '@/lib/data/receivables';
import { addDaysToDate, todayKigali } from '@/lib/dates';
import type { Invoice } from '@/lib/types';
import ReceivablesClient from './components/ReceivablesClient';

const RECENT_DAYS = 180;

interface PageProps {
  searchParams: Promise<{ customer?: string; q?: string }>;
}

export default async function ReceivablesPage({ searchParams }: PageProps) {
  const session = await requirePageSession();
  const params = await searchParams;
  const today = todayKigali();

  // Every invoice with a balance, plus everything issued in the last 180 days
  const [open, recent, creditNotes] = await Promise.all([
    listInvoices(session, today, { openOnly: true }),
    listInvoices(session, today, { from: addDaysToDate(today, -RECENT_DAYS), limit: 3000 }),
    listCreditNotes(session, { limit: 300 }),
  ]);
  const byId = new Map<string, Invoice>();
  [...open, ...recent].forEach((i) => byId.set(i.id, i));
  const invoices = [...byId.values()].sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0));

  return (
    <ReceivablesClient
      invoices={invoices}
      aging={agingOf(open, today)}
      creditNotes={creditNotes}
      today={today}
      initialCustomerId={params.customer ?? ''}
      initialSearch={params.q ?? ''}
    />
  );
}

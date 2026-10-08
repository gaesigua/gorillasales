import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { invoiceScope, requirePageSession } from '@/lib/tenant';
import { creditNoteInclude, toCreditNoteDTO } from '@/lib/data/receivables';
import { customerDetails, sellerDetails } from '@/lib/data/printing';
import { formatRWFFull } from '@/lib/format';
import { RETURN_DISPOSITION_LABELS } from '@/lib/types';
import DocumentHeader from '@/components/print/DocumentHeader';
import PrintBar from '@/components/print/PrintButton';

// The title is printed at the top of the page and becomes the "Save as PDF" file name
export async function generateMetadata({ params }: { params: Promise<{ creditNoteId: string }> }): Promise<Metadata> {
  const session = await requirePageSession();
  const { creditNoteId } = await params;
  const cn = await prisma.creditNote.findFirst({
    where: { id: creditNoteId, invoice: invoiceScope(session) },
    select: { creditNoteNumber: true, invoice: { select: { invoiceNumber: true, customer: { select: { name: true } } } } },
  });
  if (!cn) return { title: { absolute: 'Credit note not found' } };
  const number = cn.creditNoteNumber ?? `Credit request on ${cn.invoice.invoiceNumber}`;
  return { title: { absolute: `${number} · ${cn.invoice.customer.name}` } };
}

export default async function CreditNotePrintPage({ params }: { params: Promise<{ creditNoteId: string }> }) {
  const session = await requirePageSession();
  const { creditNoteId } = await params;
  const row = await prisma.creditNote.findFirst({
    where: { id: creditNoteId, invoice: invoiceScope(session) },
    include: creditNoteInclude,
  });
  if (!row) notFound();
  const cn = toCreditNoteDTO(row, '');
  const [seller, buyer] = await Promise.all([
    sellerDetails(session.organizationId),
    customerDetails(session.organizationId, cn.customerId),
  ]);
  const draft = cn.status !== 'APPROVED';

  return (
    <div className="mx-auto max-w-3xl bg-white">
      <PrintBar backHref={`/receivables?q=${cn.invoiceNumber}`} backLabel="Back to receivables" />

      {draft && (
        <p className="mb-3 border-2 border-negative px-2 py-1 text-center font-bold text-negative">
          {cn.status === 'PENDING_APPROVAL' ? 'NOT YET APPROVED — NOT A VALID CREDIT NOTE' : 'REJECTED — NOT A VALID CREDIT NOTE'}
        </p>
      )}

      <DocumentHeader
        title="CREDIT NOTE"
        number={cn.creditNoteNumber || '(pending)'}
        seller={seller}
        buyer={buyer}
        facts={[
          ['Date', cn.issueDate || cn.requestedOn],
          ['Against invoice', cn.invoiceNumber],
          ['Sales rep', cn.salesperson],
        ]}
      />

      <p className="mt-4 text-sm">
        <strong>Reason:</strong> {cn.reason}
      </p>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left">Product</th>
            <th className="px-2 py-1 text-left">Goods</th>
            <th className="px-2 py-1 text-right">Quantity</th>
            <th className="px-2 py-1 text-right">Unit price</th>
            <th className="px-2 py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {cn.lines.map((l, i) => (
            <tr key={i}>
              <td className="px-2 py-1">{l.productName}</td>
              <td className="px-2 py-1">{RETURN_DISPOSITION_LABELS[l.disposition]}</td>
              <td className="px-2 py-1 text-right font-tabular">{l.quantity}</td>
              <td className="px-2 py-1 text-right font-tabular">{formatRWFFull(l.unitPrice)}</td>
              <td className="px-2 py-1 text-right font-tabular">{formatRWFFull(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="[&_td]:px-2 [&_td]:py-1">
          <tr>
            <td colSpan={4} className="text-right">Total excl. VAT</td>
            <td className="text-right font-tabular">{formatRWFFull(cn.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right">VAT</td>
            <td className="text-right font-tabular">{formatRWFFull(cn.vatAmount)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right font-bold">Total credited</td>
            <td className="text-right font-bold font-tabular">{formatRWFFull(cn.total)}</td>
          </tr>
          {cn.refunded > 0 && (
            <tr>
              <td colSpan={4} className="text-right">Of which refunded</td>
              <td className="text-right font-tabular">{formatRWFFull(cn.refunded)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      <p className="mt-6 border-t border-border pt-2 text-xs">
        This credit note reduces the amount owed on invoice {cn.invoiceNumber}. All amounts in RWF.
      </p>
    </div>
  );
}

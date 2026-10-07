import { notFound } from 'next/navigation';
import { requirePageSession } from '@/lib/tenant';
import { getInvoice } from '@/lib/data/receivables';
import { customerDetails, sellerDetails } from '@/lib/data/printing';
import { todayKigali } from '@/lib/dates';
import { formatRWFFull } from '@/lib/format';
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types';
import DocumentHeader from '@/components/print/DocumentHeader';
import PrintBar from '@/components/print/PrintButton';

export default async function InvoicePrintPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const session = await requirePageSession();
  const { invoiceId } = await params;
  const invoice = await getInvoice(session, invoiceId, todayKigali());
  if (!invoice) notFound();
  const [seller, buyer] = await Promise.all([
    sellerDetails(session.organizationId),
    customerDetails(session.organizationId, invoice.customerId),
  ]);
  const received = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const refunded = invoice.refunds.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mx-auto max-w-3xl bg-white">
      <PrintBar backHref={`/receivables?q=${invoice.invoiceNumber}`} backLabel="Back to receivables" />

      <DocumentHeader
        title="TAX INVOICE"
        number={invoice.invoiceNumber}
        seller={seller}
        buyer={buyer}
        facts={[
          ['Invoice date', invoice.issueDate],
          ['Due date', invoice.dueDate],
          ['Order', invoice.orderNumber],
          ['Sales rep', invoice.salesperson],
          ['EBM receipt', invoice.ebmReceiptNumber || '—'],
          ['Status', INVOICE_STATUS_LABELS[invoice.status]],
        ]}
      />

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr>
            <th className="w-8 px-2 py-1 text-right">#</th>
            <th className="px-2 py-1 text-left">Product</th>
            <th className="px-2 py-1 text-right">Quantity</th>
            <th className="px-2 py-1 text-right">Unit price</th>
            <th className="px-2 py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={l.orderLineId}>
              <td className="px-2 py-1 text-right">{i + 1}</td>
              <td className="px-2 py-1">{l.productName}</td>
              <td className="px-2 py-1 text-right font-tabular">{l.quantity}</td>
              <td className="px-2 py-1 text-right font-tabular">{formatRWFFull(l.unitPrice)}</td>
              <td className="px-2 py-1 text-right font-tabular">{formatRWFFull(l.quantity * l.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="[&_td]:px-2 [&_td]:py-1">
          <tr>
            <td colSpan={4} className="text-right">Total excl. VAT</td>
            <td className="text-right font-tabular">{formatRWFFull(invoice.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right">VAT {invoice.vatRate}%</td>
            <td className="text-right font-tabular">{formatRWFFull(invoice.vatAmount)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right font-bold">Total incl. VAT</td>
            <td className="text-right font-bold font-tabular">{formatRWFFull(invoice.total)}</td>
          </tr>
          {invoice.credited > 0 && (
            <tr>
              <td colSpan={4} className="text-right">Less credit notes</td>
              <td className="text-right font-tabular">−{formatRWFFull(invoice.credited)}</td>
            </tr>
          )}
          {invoice.paid !== 0 && (
            <tr>
              <td colSpan={4} className="text-right">Less paid</td>
              <td className="text-right font-tabular">−{formatRWFFull(invoice.paid)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={4} className="text-right font-bold">Balance due</td>
            <td className="text-right font-bold font-tabular">{formatRWFFull(invoice.balance)}</td>
          </tr>
        </tfoot>
      </table>

      {invoice.payments.length > 0 && (
        <table className="mt-5 w-full text-sm">
          <caption className="pb-1 text-left font-bold">Payments received</caption>
          <thead>
            <tr>
              <th className="px-2 py-1 text-left">Receipt</th>
              <th className="px-2 py-1 text-left">Date</th>
              <th className="px-2 py-1 text-left">Method</th>
              <th className="px-2 py-1 text-left">Reference</th>
              <th className="px-2 py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.payments.map((p) => (
              <tr key={p.id}>
                <td className="px-2 py-1 font-mono">{p.paymentNumber}</td>
                <td className="px-2 py-1">{p.paidOn}</td>
                <td className="px-2 py-1">{PAYMENT_METHOD_LABELS[p.method]}</td>
                <td className="px-2 py-1">{p.reference || '—'}</td>
                <td className="px-2 py-1 text-right font-tabular">{formatRWFFull(p.amount)}</td>
              </tr>
            ))}
          </tbody>
          {refunded > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="px-2 py-1 text-right">
                  Received {formatRWFFull(received)}, refunded {formatRWFFull(refunded)}
                </td>
                <td className="px-2 py-1 text-right font-tabular">{formatRWFFull(invoice.paid)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {invoice.creditNotes.some((cn) => cn.status === 'APPROVED') && (
        <p className="mt-4 text-sm">
          Credit notes:{' '}
          {invoice.creditNotes
            .filter((cn) => cn.status === 'APPROVED')
            .map((cn) => `${cn.creditNoteNumber} (${formatRWFFull(cn.total)})`)
            .join(', ')}
        </p>
      )}

      <p className="mt-6 border-t border-border pt-2 text-xs">
        All amounts in RWF. Please quote {invoice.invoiceNumber} with your payment. Payment due by{' '}
        {invoice.dueDate}.
      </p>
    </div>
  );
}

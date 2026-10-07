import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { stringToDateColumn } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';

export interface CustomerBalance {
  outstanding: number; // still owed on issued invoices, after approved credit notes and refunds
  overdue: number; // part of outstanding that is past its due date
  openOrders: number; // value of held/confirmed orders not yet invoiced
}

const ZERO: CustomerBalance = { outstanding: 0, overdue: 0, openOrders: 0 };

/** Receivable balances per customer, computed from invoices, payments and open orders. */
export async function getCustomerBalances(
  organizationId: string,
  today: string,
  customerIds?: string[]
): Promise<Map<string, CustomerBalance>> {
  const customerFilter = customerIds
    ? customerIds.length
      ? Prisma.sql`AND i."customerId" IN (${Prisma.join(customerIds)})`
      : Prisma.sql`AND FALSE`
    : Prisma.empty;

  const [invoiceRows, openOrders] = await Promise.all([
    prisma.$queryRaw<{ customerId: string; outstanding: Prisma.Decimal; overdue: Prisma.Decimal }[]>`
      WITH settled AS (
        SELECT i."id", i."customerId", i."dueDate",
               i."total" - COALESCE(c.credited, 0) - (COALESCE(p.paid, 0) - COALESCE(r.refunded, 0)) AS due
        FROM "invoices" i
        LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "payments" GROUP BY "invoiceId") p ON p."invoiceId" = i."id"
        LEFT JOIN (SELECT "invoiceId", SUM("total") AS credited FROM "credit_notes" WHERE "status" = 'APPROVED' GROUP BY "invoiceId") c
          ON c."invoiceId" = i."id"
        LEFT JOIN (SELECT cn."invoiceId", SUM(rf."amount") AS refunded FROM "refunds" rf
                   JOIN "credit_notes" cn ON cn."id" = rf."creditNoteId" GROUP BY cn."invoiceId") r ON r."invoiceId" = i."id"
        WHERE i."organizationId" = ${organizationId} AND i."voidedAt" IS NULL ${customerFilter}
      )
      SELECT "customerId",
             SUM(due) AS outstanding,
             SUM(CASE WHEN "dueDate" < ${stringToDateColumn(today)} THEN due ELSE 0 END) AS overdue
      FROM settled
      WHERE due > 0
      GROUP BY "customerId"`,
    prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        organizationId,
        status: { in: ['PENDING_APPROVAL', 'CONFIRMED'] },
        ...(customerIds ? { customerId: { in: customerIds } } : {}),
      },
      _sum: { total: true },
    }),
  ]);

  const balances = new Map<string, CustomerBalance>();
  const get = (id: string) => {
    if (!balances.has(id)) balances.set(id, { ...ZERO });
    return balances.get(id)!;
  };
  invoiceRows.forEach((r) => {
    const b = get(r.customerId);
    b.outstanding = toNumber(r.outstanding);
    b.overdue = toNumber(r.overdue);
  });
  openOrders.forEach((r) => (get(r.customerId).openOrders = toNumber(r._sum.total)));
  return balances;
}

export async function getCustomerBalance(organizationId: string, today: string, customerId: string): Promise<CustomerBalance> {
  return (await getCustomerBalances(organizationId, today, [customerId])).get(customerId) ?? { ...ZERO };
}

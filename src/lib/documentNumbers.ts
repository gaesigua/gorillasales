import 'server-only';

import type { DocumentType, Prisma } from '@prisma/client';

const PREFIX: Record<DocumentType, string> = {
  SALES_ORDER: 'SO',
  INVOICE: 'INV',
  PAYMENT: 'RCT',
};

/**
 * Next sequential document number for an organization, e.g. INV-000124. Must run inside
 * the transaction that creates the document so a rollback does not leave a gap.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
  type: DocumentType
): Promise<string> {
  const seq = await tx.documentSequence.upsert({
    where: { organizationId_type: { organizationId, type } },
    create: { organizationId, type, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `${PREFIX[type]}-${String(seq.lastNumber).padStart(6, '0')}`;
}

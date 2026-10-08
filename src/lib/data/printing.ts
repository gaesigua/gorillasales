import 'server-only';

import { prisma } from '@/lib/prisma';
import type { PartyDetails } from '@/components/print/DocumentHeader';
import { COMPANY } from '@/lib/company';

/** Seller details for printed documents. */
export async function sellerDetails(organizationId: string): Promise<PartyDetails> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true, tin: true } });
  return {
    name: org.name,
    tin: org.tin ?? '',
    lines: [...COMPANY.addressLines, `Tel: ${COMPANY.phone} · ${COMPANY.email}`],
  };
}

/** Buyer details (address, phone) for printed documents. */
export async function customerDetails(organizationId: string, customerId: string): Promise<PartyDetails> {
  const c = await prisma.customer.findFirstOrThrow({
    where: { id: customerId, organizationId },
    select: { name: true, tin: true, address: true, area: true, sector: true, district: true, phone: true, contactPerson: true },
  });
  const place = [c.sector, c.district].filter(Boolean).join(', ');
  return {
    name: c.name,
    tin: c.tin ?? '',
    lines: [c.address || c.area, place, c.contactPerson ? `Attn: ${c.contactPerson}` : '', c.phone ? `Tel: ${c.phone}` : ''].filter(
      (l): l is string => !!l
    ),
  };
}

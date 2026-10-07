'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canViewAllReps, requireSession } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { customerInclude, toCustomerDTO } from '@/lib/data/customers';
import type { ActionResult, Customer } from '@/lib/types';

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(200),
  category: z.string().trim().min(1, 'Select a category').max(120),
  customerType: z.enum(['NEW_CUSTOMER', 'EXISTING_CUSTOMER']).default('NEW_CUSTOMER'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']).default('PROSPECT'),
  area: z.string().trim().min(1, 'Area is required').max(120),
  contactPerson: optionalText(120),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: optionalText(40),
  address: optionalText(300),
  salespersonId: z.string().optional().or(z.literal('')),
  mainProductId: z.string().optional().or(z.literal('')),
  monthlyPotential: z.coerce.number().min(0).default(0),
  creditLimit: z.coerce.number().min(0).default(0),
  remarks: optionalText(2000),
});

export type CreateCustomerInput = z.input<typeof customerSchema>;

/** Next sequential customer code for the organization, e.g. CUST-0042. */
async function nextCustomerCode(organizationId: string): Promise<string> {
  const codes = await prisma.customer.findMany({
    where: { organizationId, code: { startsWith: 'CUST-' } },
    select: { code: true },
  });
  const max = codes.reduce((m, c) => Math.max(m, Number(c.code?.slice(5)) || 0), 0);
  return `CUST-${String(max + 1).padStart(4, '0')}`;
}

export async function createCustomer(input: CreateCustomerInput): Promise<ActionResult<Customer>> {
  return runAction('createCustomer', async () => {
    const session = await requireSession();
    const { organizationId } = session;
    const data = customerSchema.parse(input);

    // Sales officers can only register customers for themselves
    const salespersonId = canViewAllReps(session) ? data.salespersonId || null : session.userId;
    if (salespersonId) {
      const rep = await prisma.user.findFirst({ where: { id: salespersonId, organizationId }, select: { id: true } });
      if (!rep) throw new UserFacingError('Salesperson not found.');
    }
    if (data.mainProductId) {
      const product = await prisma.product.findFirst({
        where: { id: data.mainProductId, organizationId },
        select: { id: true },
      });
      if (!product) throw new UserFacingError('Product not found.');
    }

    const customer = await prisma.customer.create({
      data: {
        organizationId,
        code: await nextCustomerCode(organizationId),
        name: data.name,
        category: data.category,
        customerType: data.customerType,
        status: data.status,
        area: data.area,
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        salespersonId,
        mainProductId: data.mainProductId || null,
        monthlyPotential: data.monthlyPotential,
        creditLimit: data.creditLimit,
        remarks: data.remarks || null,
      },
      include: customerInclude,
    });

    await audit(session, 'CREATE_CUSTOMER', 'Customer', customer.id, { name: customer.name, code: customer.code });
    revalidatePath('/', 'layout');
    return toCustomerDTO(customer);
  });
}

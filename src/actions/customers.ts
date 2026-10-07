'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { canViewAllReps, customerScope, requireSession } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { todayKigali } from '@/lib/dates';
import { customerInclude, toCustomerDTO } from '@/lib/data/customers';
import { getCustomerBalance } from '@/lib/data/balances';
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
  tin: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'TIN must be 9 digits')
    .optional()
    .or(z.literal('')),
  province: optionalText(60),
  district: optionalText(60),
  sector: optionalText(60),
  mainProductId: z.string().optional().or(z.literal('')),
  monthlyPotential: z.coerce.number().min(0).default(0),
  remarks: optionalText(2000),
  // Manager-only commercial terms
  salespersonId: z.string().optional().or(z.literal('')),
  priceListId: z.string().optional().or(z.literal('')),
  creditLimit: z.coerce.number().min(0).default(0),
  paymentTermsDays: z.coerce.number().int().min(0).max(180).default(0),
});

export type CustomerInput = z.input<typeof customerSchema>;
export type CreateCustomerInput = CustomerInput;

/** Next sequential customer code for the organization, e.g. CUST-0042. */
async function nextCustomerCode(organizationId: string): Promise<string> {
  const codes = await prisma.customer.findMany({
    where: { organizationId, code: { startsWith: 'CUST-' } },
    select: { code: true },
  });
  const max = codes.reduce((m, c) => Math.max(m, Number(c.code?.slice(5)) || 0), 0);
  return `CUST-${String(max + 1).padStart(4, '0')}`;
}

/** Checks that referenced records belong to the organization. */
async function assertReferences(organizationId: string, data: z.output<typeof customerSchema>) {
  const [rep, product, priceList] = await Promise.all([
    data.salespersonId
      ? prisma.user.findFirst({ where: { id: data.salespersonId, organizationId }, select: { id: true } })
      : true,
    data.mainProductId
      ? prisma.product.findFirst({ where: { id: data.mainProductId, organizationId }, select: { id: true } })
      : true,
    data.priceListId
      ? prisma.priceList.findFirst({ where: { id: data.priceListId, organizationId }, select: { id: true } })
      : true,
  ]);
  if (!rep) throw new UserFacingError('Salesperson not found.');
  if (!product) throw new UserFacingError('Product not found.');
  if (!priceList) throw new UserFacingError('Price list not found.');
}

function profileFields(data: z.output<typeof customerSchema>) {
  return {
    name: data.name,
    category: data.category,
    customerType: data.customerType,
    status: data.status,
    area: data.area,
    contactPerson: data.contactPerson || null,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    tin: data.tin || null,
    province: data.province || null,
    district: data.district || null,
    sector: data.sector || null,
    mainProductId: data.mainProductId || null,
    monthlyPotential: data.monthlyPotential,
    remarks: data.remarks || null,
  };
}

async function reload(session: UserSession, customerId: string): Promise<Customer> {
  revalidatePath('/', 'layout');
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, include: customerInclude });
  return toCustomerDTO(customer, undefined, await getCustomerBalance(session.organizationId, todayKigali(), customerId));
}

/**
 * Register a customer. Sales officers register customers for themselves on cash-on-delivery
 * terms; credit limits, payment terms and price lists are set by managers.
 */
export async function createCustomer(input: CustomerInput): Promise<ActionResult<Customer>> {
  return runAction('createCustomer', async () => {
    const session = await requireSession();
    const { organizationId } = session;
    const data = customerSchema.parse(input);
    const isManager = canViewAllReps(session);
    if (!isManager) {
      data.salespersonId = session.userId;
      data.priceListId = '';
      data.creditLimit = 0;
      data.paymentTermsDays = 0;
    }
    await assertReferences(organizationId, data);

    const customer = await prisma.customer.create({
      data: {
        organizationId,
        code: await nextCustomerCode(organizationId),
        ...profileFields(data),
        salespersonId: data.salespersonId || null,
        priceListId: data.priceListId || null,
        creditLimit: data.creditLimit,
        paymentTermsDays: data.paymentTermsDays,
      },
    });

    await audit(session, 'CREATE_CUSTOMER', 'Customer', customer.id, { name: customer.name, code: customer.code });
    return reload(session, customer.id);
  });
}

/**
 * Update a customer. Sales officers may edit the profile of their own customers;
 * commercial terms (rep, price list, credit limit, payment terms) are manager-only.
 */
export async function updateCustomer(customerId: string, input: CustomerInput): Promise<ActionResult<Customer>> {
  return runAction('updateCustomer', async () => {
    const session = await requireSession();
    const existing = await prisma.customer.findFirst({
      where: { id: z.string().parse(customerId), ...customerScope(session) },
    });
    if (!existing) throw new UserFacingError('Customer not found.');
    const data = customerSchema.parse(input);
    const isManager = canViewAllReps(session);
    await assertReferences(session.organizationId, data);

    const commercial = isManager
      ? {
          salespersonId: data.salespersonId || null,
          priceListId: data.priceListId || null,
          creditLimit: data.creditLimit,
          paymentTermsDays: data.paymentTermsDays,
        }
      : {};
    await prisma.customer.update({ where: { id: existing.id }, data: { ...profileFields(data), ...commercial } });

    await audit(session, 'UPDATE_CUSTOMER', 'Customer', existing.id, {
      before: {
        salespersonId: existing.salespersonId,
        creditLimit: existing.creditLimit.toString(),
        paymentTermsDays: existing.paymentTermsDays,
        priceListId: existing.priceListId,
        status: existing.status,
      },
      after: { ...commercial, status: data.status },
    });
    return reload(session, existing.id);
  });
}

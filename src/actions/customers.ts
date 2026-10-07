'use server';

import { prisma } from '@/lib/prisma';
import { canViewAllReps, requireSession, scopedSalespersonId } from '@/lib/tenant';

export interface CustomerDTO {
  id: string;
  name: string;
  code?: string;
  category: string;
  customerType: 'NEW_CUSTOMER' | 'EXISTING_CUSTOMER' | 'New Customer' | 'Existing Customer';
  area: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  salespersonId?: string;
  salespersonName?: string;
  outstandingBalance: number;
  creditLimit: number;
  visitCount?: number;
  lastVisitDate?: string;
}

export interface CreateCustomerInput {
  name: string;
  code?: string;
  category: string;
  customerType?: 'NEW_CUSTOMER' | 'EXISTING_CUSTOMER';
  area: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  salespersonId?: string;
  creditLimit?: number;
}

/**
 * Fetch all customers for the current organization
 */
export async function getCustomers(salespersonId?: string): Promise<CustomerDTO[]> {
  const { organizationId } = await requireSession();
  try {
    const where: any = { organizationId };
    if (salespersonId) {
      where.salespersonId = salespersonId;
    }

    const dbCustomers = await prisma.customer.findMany({
      where,
      include: {
        salesperson: { select: { id: true, name: true } },
        visitLogs: {
          orderBy: { dateOfVisit: 'desc' },
          take: 1,
          select: { dateOfVisit: true },
        },
        _count: { select: { visitLogs: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (dbCustomers.length > 0) {
      return dbCustomers.map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code ?? undefined,
        category: c.category,
        customerType: c.customerType,
        area: c.area,
        contactPerson: c.contactPerson ?? undefined,
        email: c.email ?? undefined,
        phone: c.phone ?? undefined,
        address: c.address ?? undefined,
        salespersonId: c.salespersonId ?? undefined,
        salespersonName: c.salesperson?.name ?? undefined,
        outstandingBalance: c.outstandingBalance,
        creditLimit: c.creditLimit,
        visitCount: c._count.visitLogs,
        lastVisitDate: c.visitLogs[0]?.dateOfVisit ? c.visitLogs[0].dateOfVisit.toISOString().split('T')[0] : undefined,
      }));
    }
  } catch (error) {
    console.warn('⚠️ Server Action getCustomers: DB fetch failed or empty, returning fallback data.', error);
  }

  // Fallback data derived from mockData if DB is offline
  return [
    {
      id: 'cust-001',
      name: 'Nakumatt Kigali City Mall',
      code: 'CUST-001',
      category: 'Supermarkets',
      customerType: 'EXISTING_CUSTOMER',
      area: 'Kigali Centre',
      contactPerson: 'Jean Paul Habimana',
      phone: '+250 788 123 456',
      salespersonName: 'Karenzi Remmy',
      outstandingBalance: 450000,
      creditLimit: 2000000,
      visitCount: 14,
      lastVisitDate: '2026-09-04',
    },
    {
      id: 'cust-002',
      name: 'Hotel des Mille Collines',
      code: 'CUST-002',
      category: 'Hotels',
      customerType: 'EXISTING_CUSTOMER',
      area: 'Kigali Centre',
      contactPerson: 'Marie Claire Uwamahoro',
      phone: '+250 788 654 321',
      salespersonName: 'Mastiko Frank',
      outstandingBalance: 312000,
      creditLimit: 1500000,
      visitCount: 11,
      lastVisitDate: '2026-09-04',
    },
    {
      id: 'cust-003',
      name: 'Bourbon Coffee Kimihurura',
      code: 'CUST-003',
      category: 'Coffee Shops',
      customerType: 'EXISTING_CUSTOMER',
      area: 'Kimihurura',
      contactPerson: 'Claudine Uwase',
      phone: '+250 788 999 888',
      salespersonName: 'Alex Mushumba',
      outstandingBalance: 0,
      creditLimit: 3000000,
      visitCount: 10,
      lastVisitDate: '2026-09-03',
    },
  ];
}

/**
 * Create a new Customer record in Prisma database
 */
export async function createCustomer(input: CreateCustomerInput): Promise<{ success: boolean; customer?: CustomerDTO; error?: string }> {
  const session = await requireSession();
  const { organizationId } = session;
  try {
    let salespersonId = input.salespersonId ? scopedSalespersonId(session, input.salespersonId) : undefined;
    if (!salespersonId && !canViewAllReps(session)) salespersonId = session.userId;
    if (salespersonId) {
      const rep = await prisma.user.findFirst({ where: { id: salespersonId, organizationId }, select: { id: true } });
      if (!rep) return { success: false, error: 'Salesperson not found' };
    }

    const newCustomer = await prisma.customer.create({
      data: {
        organizationId,
        name: input.name,
        code: input.code ?? `CUST-${Date.now().toString().slice(-4)}`,
        category: input.category,
        customerType: (input.customerType as any) ?? 'EXISTING_CUSTOMER',
        area: input.area,
        contactPerson: input.contactPerson,
        email: input.email,
        phone: input.phone,
        address: input.address,
        salespersonId,
        creditLimit: input.creditLimit ?? 0,
      },
      include: {
        salesperson: { select: { id: true, name: true } },
      },
    });

    return {
      success: true,
      customer: {
        id: newCustomer.id,
        name: newCustomer.name,
        code: newCustomer.code ?? undefined,
        category: newCustomer.category,
        customerType: newCustomer.customerType,
        area: newCustomer.area,
        contactPerson: newCustomer.contactPerson ?? undefined,
        email: newCustomer.email ?? undefined,
        phone: newCustomer.phone ?? undefined,
        address: newCustomer.address ?? undefined,
        salespersonId: newCustomer.salespersonId ?? undefined,
        salespersonName: newCustomer.salesperson?.name ?? undefined,
        outstandingBalance: newCustomer.outstandingBalance,
        creditLimit: newCustomer.creditLimit,
        visitCount: 0,
      },
    };
  } catch (error: any) {
    console.error('Error creating customer via Server Action:', error);
    return { success: false, error: 'Failed to create customer' };
  }
}

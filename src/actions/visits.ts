'use server';

import { prisma } from '@/lib/prisma';
import { requireSession, scopedSalespersonId } from '@/lib/tenant';
import { visitLogs as mockVisits } from '@/lib/mockData';

export interface VisitLogDTO {
  id: string;
  timestamp: string;
  salespersonId?: string;
  salesperson: string;
  dateOfVisit: string;
  customerId?: string;
  customerName: string;
  area: string;
  customerCategory: string;
  visitOutcome: string;
  productId?: string;
  productCategory: string;
  quantity: number;
  unitPrice: number;
  salesValue: number;
  paymentStatus: string;
  customerType: string;
  nextFollowUpDate: string;
  remarks: string;
}

export interface CreateVisitInput {
  salespersonId: string;
  customerId: string;
  dateOfVisit: string;
  visitOutcome: string;
  productId?: string;
  productCategory?: string;
  quantity: number;
  unitPrice: number;
  paymentStatus: 'PAID' | 'CREDIT' | 'PENDING' | 'OVERDUE' | 'PARTIAL' | 'Paid' | 'Credit' | 'Pending';
  nextFollowUpDate?: string;
  remarks?: string;
}

/**
 * Fetch all Visit Logs for the current organization
 */
export async function getVisitLogs(salespersonId?: string): Promise<VisitLogDTO[]> {
  const session = await requireSession();
  const { organizationId } = session;
  try {
    const where: any = { organizationId };
    const repId = scopedSalespersonId(session, salespersonId);
    if (repId) {
      where.salespersonId = repId;
    }

    const dbLogs = await prisma.visitLog.findMany({
      where,
      include: {
        salesperson: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, area: true, category: true, customerType: true } },
        product: { select: { id: true, name: true, category: true } },
      },
      orderBy: { dateOfVisit: 'desc' },
    });

    if (dbLogs.length > 0) {
      return dbLogs.map((v: any) => ({
        id: v.id,
        timestamp: v.createdAt.toISOString(),
        salespersonId: v.salespersonId,
        salesperson: v.salesperson.name,
        dateOfVisit: v.dateOfVisit.toISOString().split('T')[0],
        customerId: v.customerId,
        customerName: v.customer.name,
        area: v.customer.area,
        customerCategory: v.customer.category,
        visitOutcome: v.visitOutcome,
        productId: v.productId ?? undefined,
        productCategory: v.product?.name ?? v.product?.category ?? 'Coffee Products',
        quantity: v.quantity,
        unitPrice: v.unitPrice,
        salesValue: v.salesValue,
        paymentStatus: v.paymentStatus,
        customerType: v.customer.customerType,
        nextFollowUpDate: v.nextFollowUpDate ? v.nextFollowUpDate.toISOString().split('T')[0] : '',
        remarks: v.remarks ?? '',
      }));
    }
  } catch (error) {
    console.warn('⚠️ Server Action getVisitLogs: DB fetch failed or empty, returning mock data.', error);
  }

  // Fallback to mockVisits
  return mockVisits.map((v: any) => ({
    ...v,
    timestamp: v.timestamp || new Date().toISOString(),
  }));
}

/**
 * Record a new Sales Visit in database
 */
export async function createVisitLog(input: CreateVisitInput): Promise<{ success: boolean; visit?: VisitLogDTO; error?: string }> {
  const session = await requireSession();
  const { organizationId } = session;
  try {
    // Sales officers always log visits as themselves; managers may log for a rep in their org
    const salespersonId = scopedSalespersonId(session, input.salespersonId) ?? session.userId;
    const [rep, customer, product] = await Promise.all([
      prisma.user.findFirst({ where: { id: salespersonId, organizationId }, select: { id: true } }),
      prisma.customer.findFirst({ where: { id: input.customerId, organizationId }, select: { id: true } }),
      input.productId
        ? prisma.product.findFirst({ where: { id: input.productId, organizationId }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (!rep) return { success: false, error: 'Salesperson not found' };
    if (!customer) return { success: false, error: 'Customer not found' };
    if (input.productId && !product) return { success: false, error: 'Product not found' };

    const salesValue = input.quantity * input.unitPrice;

    // Convert string status to PaymentStatus enum
    let statusEnum: any = 'PENDING';
    const s = input.paymentStatus.toUpperCase();
    if (s.includes('PAID')) statusEnum = 'PAID';
    else if (s.includes('CREDIT')) statusEnum = 'CREDIT';
    else if (s.includes('OVERDUE')) statusEnum = 'OVERDUE';

    const newVisit = await prisma.visitLog.create({
      data: {
        organizationId,
        salespersonId,
        customerId: input.customerId,
        dateOfVisit: new Date(input.dateOfVisit),
        visitOutcome: input.visitOutcome,
        productId: input.productId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        salesValue,
        paymentStatus: statusEnum,
        nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : null,
        remarks: input.remarks,
      },
      include: {
        salesperson: { select: { name: true } },
        customer: { select: { name: true, area: true, category: true, customerType: true } },
        product: { select: { name: true, category: true } },
      },
    });

    return {
      success: true,
      visit: {
        id: newVisit.id,
        timestamp: newVisit.createdAt.toISOString(),
        salespersonId: newVisit.salespersonId,
        salesperson: newVisit.salesperson.name,
        dateOfVisit: newVisit.dateOfVisit.toISOString().split('T')[0],
        customerId: newVisit.customerId,
        customerName: newVisit.customer.name,
        area: newVisit.customer.area,
        customerCategory: newVisit.customer.category,
        visitOutcome: newVisit.visitOutcome,
        productId: newVisit.productId ?? undefined,
        productCategory: newVisit.product?.name ?? newVisit.product?.category ?? 'Coffee Products',
        quantity: newVisit.quantity,
        unitPrice: newVisit.unitPrice,
        salesValue: newVisit.salesValue,
        paymentStatus: newVisit.paymentStatus,
        customerType: newVisit.customer.customerType,
        nextFollowUpDate: newVisit.nextFollowUpDate ? newVisit.nextFollowUpDate.toISOString().split('T')[0] : '',
        remarks: newVisit.remarks ?? '',
      },
    };
  } catch (error: any) {
    console.error('Error creating visit log via Server Action:', error);
    return { success: false, error: 'Failed to create visit log' };
  }
}

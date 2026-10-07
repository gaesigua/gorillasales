'use server';

import { prisma } from '@/lib/prisma';
import { requireSession, scopedSalespersonId } from '@/lib/tenant';
import { pipelineDeals as mockDeals } from '@/lib/mockData';

export interface PipelineDealDTO {
  id: string;
  customer: string;
  customerId?: string;
  area: string;
  contactPerson: string;
  potentialValue: number;
  salesperson: string;
  salespersonId?: string;
  stage: string;
  stageId?: string;
  lastContact: string;
  nextAction: string;
  followUpDate: string;
  probability: number;
  weightedValue: number;
  remarks: string;
}

export interface PipelineStageDTO {
  id: string;
  name: string;
  probability: number;
  sortOrder: number;
  color?: string;
}

export interface CreateDealInput {
  title: string;
  customerId: string;
  salespersonId: string;
  stageId: string;
  potentialValue: number;
  probability: number;
  nextAction?: string;
  followUpDate?: string;
  remarks?: string;
}

/**
 * Fetch all Pipeline Deals
 */
export async function getPipelineDeals(salespersonId?: string): Promise<PipelineDealDTO[]> {
  const session = await requireSession();
  const { organizationId } = session;
  try {
    const where: any = { organizationId };
    const repId = scopedSalespersonId(session, salespersonId);
    if (repId) {
      where.salespersonId = repId;
    }

    const dbDeals = await prisma.pipelineDeal.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, area: true, contactPerson: true } },
        salesperson: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, probability: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (dbDeals.length > 0) {
      return dbDeals.map((d: any) => ({
        id: d.id,
        customer: d.customer.name,
        customerId: d.customerId,
        area: d.customer.area,
        contactPerson: d.customer.contactPerson ?? 'Contact Person',
        potentialValue: d.potentialValue,
        salesperson: d.salesperson.name,
        salespersonId: d.salespersonId,
        stage: d.stage.name,
        stageId: d.stageId,
        lastContact: d.lastContact.toISOString().split('T')[0],
        nextAction: d.nextAction ?? '',
        followUpDate: d.followUpDate ? d.followUpDate.toISOString().split('T')[0] : '',
        probability: d.probability || d.stage.probability,
        weightedValue: d.weightedValue || (d.potentialValue * (d.probability || d.stage.probability)) / 100,
        remarks: d.remarks ?? '',
      }));
    }
  } catch (error) {
    console.warn('⚠️ Server Action getPipelineDeals: DB fetch failed or empty, returning mock data.', error);
  }

  // Fallback to mockDeals
  return mockDeals.map((d: any) => ({
    ...d,
    id: d.id,
  }));
}

/**
 * Fetch Pipeline Stages
 */
export async function getPipelineStages(): Promise<PipelineStageDTO[]> {
  const { organizationId } = await requireSession();
  try {
    const stages = await prisma.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
    });

    if (stages.length > 0) {
      return stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        probability: s.probability,
        sortOrder: s.sortOrder,
        color: s.color ?? undefined,
      }));
    }
  } catch (error) {
    console.warn('⚠️ Server Action getPipelineStages: DB fetch failed, returning default stages.', error);
  }

  return [
    { id: 'stg-1', name: 'Lead', probability: 10, sortOrder: 1, color: '#94A3B8' },
    { id: 'stg-2', name: 'Contacted', probability: 25, sortOrder: 2, color: '#3B82F6' },
    { id: 'stg-3', name: 'Proposal Sent', probability: 40, sortOrder: 3, color: '#8B5CF6' },
    { id: 'stg-4', name: 'Negotiation', probability: 65, sortOrder: 4, color: '#EC4899' },
    { id: 'stg-5', name: 'Closing', probability: 80, sortOrder: 5, color: '#F59E0B' },
    { id: 'stg-6', name: 'Won', probability: 100, sortOrder: 6, color: '#10B981' },
    { id: 'stg-7', name: 'Lost', probability: 0, sortOrder: 7, color: '#EF4444' },
  ];
}

/**
 * Update Deal Stage & recalculate weighted value
 */
export async function updateDealStage(dealId: string, stageId: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();
  const { organizationId } = session;
  try {
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, organizationId },
    });

    if (!stage) return { success: false, error: 'Stage not found' };

    // Sales officers may only move their own deals
    const deal = await prisma.pipelineDeal.findFirst({
      where: { id: dealId, organizationId, salespersonId: scopedSalespersonId(session) },
    });

    if (!deal) return { success: false, error: 'Deal not found' };

    const probability = stage.probability;
    const weightedValue = (deal.potentialValue * probability) / 100;

    await prisma.pipelineDeal.update({
      where: { id: dealId },
      data: {
        stageId,
        probability,
        weightedValue,
        lastContact: new Date(),
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating deal stage via Server Action:', error);
    return { success: false, error: 'Failed to update deal stage' };
  }
}

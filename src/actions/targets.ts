'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/tenant';
import { monthlyTargets as mockTargets } from '@/lib/mockData';

export interface RepTargetDTO {
  id: string;
  salesperson: string;
  salespersonId?: string;
  month: number;
  year: number;
  target: number;
  targetWeightKg: number;
  actualSales: number;
  achievementPct: number;
}

export async function getMonthlyTargets(month?: number, year?: number): Promise<RepTargetDTO[]> {
  const targetMonth = month ?? new Date().getMonth();
  const targetYear = year ?? new Date().getFullYear();

  const { organizationId } = await requireSession();

  try {
    const dbTargets = await prisma.monthlyTarget.findMany({
      where: { organizationId, month: targetMonth, year: targetYear },
      include: {
        salesperson: { select: { id: true, name: true } },
      },
    });

    if (dbTargets.length > 0) {
      // Calculate actual sales per salesperson for this month
      const startOfMonth = new Date(targetYear, targetMonth, 1);
      const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

      const actuals = await prisma.visitLog.groupBy({
        by: ['salespersonId'],
        where: {
          organizationId,
          dateOfVisit: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { salesValue: true },
      });

      const actualMap = new Map<string, number>();
      actuals.forEach((a: any) => {
        if (a.salespersonId) actualMap.set(a.salespersonId, a._sum.salesValue || 0);
      });

      return dbTargets.map((t: any) => {
        const actualSales = actualMap.get(t.salespersonId) || 0;
        const achievementPct = t.targetAmount > 0 ? Number(((actualSales / t.targetAmount) * 100).toFixed(1)) : 0;

        return {
          id: t.id,
          salesperson: t.salesperson.name,
          salespersonId: t.salespersonId,
          month: t.month,
          year: t.year,
          target: t.targetAmount,
          targetWeightKg: t.targetWeightKg,
          actualSales,
          achievementPct,
        };
      });
    }
  } catch (error) {
    console.warn('⚠️ getMonthlyTargets DB error, returning mock targets:', error);
  }

  // Fallback to mockTargets
  return mockTargets.map((t) => ({
    id: t.id,
    salesperson: t.salesperson,
    month: targetMonth,
    year: targetYear,
    target: t.target,
    targetWeightKg: 450,
    actualSales: t.actualSales,
    achievementPct: t.achievementPct,
  }));
}

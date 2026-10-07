'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/tenant';

export interface ProductDTO {
  id: string;
  name: string;
  sku?: string;
  category: string;
  unitPrice: number;
  unitOfMeasure: string;
  isActive: boolean;
}

export async function getProducts(): Promise<ProductDTO[]> {
  const { organizationId } = await requireSession();
  try {
    const dbProducts = await prisma.product.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });

    if (dbProducts.length > 0) {
      return dbProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? undefined,
        category: p.category,
        unitPrice: p.unitPrice,
        unitOfMeasure: p.unitOfMeasure,
        isActive: p.isActive,
      }));
    }
  } catch (error) {
    console.warn('⚠️ getProducts DB error, returning defaults:', error);
  }

  return [
    { id: 'pn-1', name: '250G Roasted Coffee', category: 'Roasted Coffee', unitPrice: 2600, unitOfMeasure: 'Pack', isActive: true },
    { id: 'pn-2', name: '500G MG', category: 'Roasted Coffee', unitPrice: 4800, unitOfMeasure: 'Pack', isActive: true },
    { id: 'pn-3', name: '1KG Roasted Coffee', category: 'Roasted Coffee', unitPrice: 9000, unitOfMeasure: 'KG', isActive: true },
    { id: 'pn-4', name: 'Instant Coffee Sachets', category: 'Instant', unitPrice: 1500, unitOfMeasure: 'Box', isActive: true },
    { id: 'pn-5', name: 'Green Coffee Beans', category: 'Green Coffee', unitPrice: 7500, unitOfMeasure: 'KG', isActive: true },
  ];
}

import 'server-only';

import { prisma } from './prisma';
import { toNumber } from './domain/money';

/**
 * Unit price per product for a customer: their price list's price when the list has the
 * product, otherwise the product's list price.
 */
export async function resolveUnitPrices(
  organizationId: string,
  priceListId: string | null,
  productIds: string[]
): Promise<Map<string, number>> {
  const [products, listItems] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, id: { in: productIds } },
      select: { id: true, unitPrice: true },
    }),
    priceListId
      ? prisma.priceListItem.findMany({
          where: { priceListId, productId: { in: productIds }, priceList: { organizationId, isActive: true } },
          select: { productId: true, unitPrice: true },
        })
      : Promise.resolve([]),
  ]);
  const prices = new Map(products.map((p) => [p.id, toNumber(p.unitPrice)]));
  listItems.forEach((i) => prices.set(i.productId, toNumber(i.unitPrice)));
  return prices;
}

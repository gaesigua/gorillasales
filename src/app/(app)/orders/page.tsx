import { requirePageSession } from '@/lib/tenant';
import { listOrders } from '@/lib/data/orders';
import { getPriceBook, listCustomerOptions } from '@/lib/data/config';
import { addDaysToDate, todayKigali } from '@/lib/dates';
import type { Order } from '@/lib/types';
import OrdersClient from './components/OrdersClient';

const RECENT_DAYS = 90;

interface PageProps {
  searchParams: Promise<{ new?: string; q?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const session = await requirePageSession();
  const params = await searchParams;
  const today = todayKigali();

  // Every open order regardless of age, plus everything from the last 90 days
  const [openOrders, recentOrders, customers, priceBook] = await Promise.all([
    listOrders(session, { status: ['PENDING_APPROVAL', 'CONFIRMED'] }),
    listOrders(session, { from: addDaysToDate(today, -RECENT_DAYS), limit: 2000 }),
    listCustomerOptions(session),
    getPriceBook(session),
  ]);
  const byId = new Map<string, Order>();
  [...openOrders, ...recentOrders].forEach((o) => byId.set(o.id, o));
  const orders = [...byId.values()].sort((a, b) => (a.orderDate < b.orderDate ? 1 : a.orderDate > b.orderDate ? -1 : 0));

  return (
    <OrdersClient
      orders={orders}
      customers={customers}
      priceBook={priceBook}
      today={today}
      initialNewCustomerId={params.new ?? ''}
      initialSearch={params.q ?? ''}
    />
  );
}

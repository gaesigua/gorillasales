import { requirePageSession } from '@/lib/tenant';
import { getProductStock, listBatches, listMovements, listRoastRuns } from '@/lib/data/inventory';
import { todayKigali } from '@/lib/dates';
import InventoryClient from './components/InventoryClient';

export default async function InventoryPage() {
  const session = await requirePageSession();
  const today = todayKigali();
  const [stock, batches, movements, roastRuns] = await Promise.all([
    getProductStock(session, today),
    listBatches(session, today),
    listMovements(session),
    listRoastRuns(session),
  ]);
  return <InventoryClient stock={stock} batches={batches} movements={movements} roastRuns={roastRuns} today={today} />;
}

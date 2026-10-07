// Route (beat plan) scheduling and visit compliance. Dates are YYYY-MM-DD strings.

export interface RouteSchedule {
  weekday: number; // 1 = Monday ... 7 = Sunday
  frequency: 'WEEKLY' | 'BIWEEKLY';
  startDate: string;
}

export const WEEKDAY_LABELS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** ISO weekday (1 = Monday ... 7 = Sunday) of a calendar date. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Whether a route is due on a date: right weekday, on/after its start, and on-week for fortnightly routes. */
export function isRouteDay(route: RouteSchedule, date: string): boolean {
  if (date < route.startDate || isoWeekday(date) !== route.weekday) return false;
  if (route.frequency === 'WEEKLY') return true;
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${route.startDate}T00:00:00Z`)) / 86400000);
  return Math.floor(days / 7) % 2 === 0;
}

export interface PlannedStop {
  date: string;
  salespersonId: string;
  customerId: string;
  routeName: string;
}

/** Every planned (date, rep, customer) in [from, to] inclusive; a customer is planned at most once per rep per day. */
export function plannedStops(
  routes: (RouteSchedule & { name: string; salespersonId: string; customerIds: string[] })[],
  from: string,
  to: string
): PlannedStop[] {
  const out: PlannedStop[] = [];
  const seen = new Set<string>();
  for (let d = from; d <= to; d = nextDay(d)) {
    for (const r of routes) {
      if (!isRouteDay(r, d)) continue;
      for (const customerId of r.customerIds) {
        const key = `${d}|${r.salespersonId}|${customerId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ date: d, salespersonId: r.salespersonId, customerId, routeName: r.name });
      }
    }
  }
  return out;
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface VisitRef {
  date: string;
  salespersonId: string;
  customerId: string;
}

export interface Compliance {
  planned: number;
  visited: number; // planned stops with a visit by that rep to that customer on that day
  offRoute: number; // visits that were not on the plan for that day
  pct: number;
  missed: PlannedStop[];
}

/** Planned-vs-actual visits. A planned stop counts as visited only on its planned day. */
export function routeCompliance(planned: PlannedStop[], visits: VisitRef[]): Compliance {
  const visitKeys = new Set(visits.map((v) => `${v.date}|${v.salespersonId}|${v.customerId}`));
  const plannedKeys = new Set(planned.map((p) => `${p.date}|${p.salespersonId}|${p.customerId}`));
  const missed = planned.filter((p) => !visitKeys.has(`${p.date}|${p.salespersonId}|${p.customerId}`));
  const visited = planned.length - missed.length;
  return {
    planned: planned.length,
    visited,
    offRoute: [...visitKeys].filter((k) => !plannedKeys.has(k)).length,
    pct: planned.length ? Math.round((visited / planned.length) * 1000) / 10 : 0,
    missed,
  };
}

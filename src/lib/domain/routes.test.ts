import { describe, expect, it } from 'vitest';
import { isRouteDay, isoWeekday, plannedStops, routeCompliance } from './routes';

// 2026-10-05 is a Monday
describe('isRouteDay', () => {
  const weekly = { weekday: 1, frequency: 'WEEKLY' as const, startDate: '2026-09-07' };
  const fortnightly = { weekday: 1, frequency: 'BIWEEKLY' as const, startDate: '2026-09-07' };

  it('knows ISO weekdays', () => {
    expect(isoWeekday('2026-10-05')).toBe(1);
    expect(isoWeekday('2026-10-11')).toBe(7);
  });
  it('weekly routes run every matching weekday', () => {
    expect(isRouteDay(weekly, '2026-10-05')).toBe(true);
    expect(isRouteDay(weekly, '2026-10-12')).toBe(true);
    expect(isRouteDay(weekly, '2026-10-06')).toBe(false);
  });
  it('fortnightly routes run every other week from the start date', () => {
    expect(isRouteDay(fortnightly, '2026-09-07')).toBe(true);
    expect(isRouteDay(fortnightly, '2026-09-14')).toBe(false);
    expect(isRouteDay(fortnightly, '2026-09-21')).toBe(true);
    expect(isRouteDay(fortnightly, '2026-10-05')).toBe(true);
  });
  it('nothing before the start date', () => {
    expect(isRouteDay(weekly, '2026-08-31')).toBe(false);
  });
});

describe('plannedStops and compliance', () => {
  const routes = [
    { name: 'Remera Mon', salespersonId: 'rep', customerIds: ['a', 'b'], weekday: 1, frequency: 'WEEKLY' as const, startDate: '2026-01-05' },
    { name: 'Overlap Mon', salespersonId: 'rep', customerIds: ['b'], weekday: 1, frequency: 'WEEKLY' as const, startDate: '2026-01-05' },
  ];

  it('lists each customer once per rep per day', () => {
    const plan = plannedStops(routes, '2026-10-05', '2026-10-11');
    expect(plan.map((p) => p.customerId)).toEqual(['a', 'b']);
  });

  it('counts visits on the planned day and lists missed stops', () => {
    const plan = plannedStops(routes, '2026-10-05', '2026-10-12'); // two Mondays -> 4 stops
    const c = routeCompliance(plan, [
      { date: '2026-10-05', salespersonId: 'rep', customerId: 'a' },
      { date: '2026-10-05', salespersonId: 'rep', customerId: 'b' },
      { date: '2026-10-13', salespersonId: 'rep', customerId: 'a' }, // a day late: off-route
    ]);
    expect(c).toMatchObject({ planned: 4, visited: 2, offRoute: 1, pct: 50 });
    expect(c.missed.map((m) => `${m.date}:${m.customerId}`)).toEqual(['2026-10-12:a', '2026-10-12:b']);
  });

  it('a visit by another rep does not count', () => {
    const plan = plannedStops(routes, '2026-10-05', '2026-10-05');
    expect(routeCompliance(plan, [{ date: '2026-10-05', salespersonId: 'other', customerId: 'a' }]).visited).toBe(0);
  });
});

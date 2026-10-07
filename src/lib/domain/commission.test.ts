import { describe, expect, it } from 'vitest';
import { calculateCommission, type CommissionRuleInput } from './commission';

const rules: CommissionRuleInput[] = [
  { id: 'base', name: 'Base Commission', type: 'percentage', value: 2, thresholdPct: 0 },
  { id: 'target', name: 'Target Bonus', type: 'percentage', value: 3, thresholdPct: 100 },
  { id: 'stretch', name: 'Stretch Bonus', type: 'percentage', value: 1.5, thresholdPct: 120 },
  { id: 'top', name: 'Top Performer Bonus', type: 'flat', value: 50000, thresholdPct: 150 },
];

describe('calculateCommission', () => {
  it('pays only the base rate below target', () => {
    const r = calculateCommission(rules, 3_000_000, 4_000_000);
    expect(r.achievementPct).toBe(75);
    expect(r.lines.map((l) => l.ruleId)).toEqual(['base']);
    expect(r.total).toBe(60_000);
  });

  it('adds the target bonus at exactly 100%', () => {
    expect(calculateCommission(rules, 4_000_000, 4_000_000).total).toBe(80_000 + 120_000);
  });

  it('stacks every rule whose threshold is met', () => {
    const r = calculateCommission(rules, 6_000_000, 4_000_000); // 150%
    expect(r.lines.map((l) => l.ruleId)).toEqual(['base', 'target', 'stretch', 'top']);
    expect(r.total).toBe(120_000 + 180_000 + 90_000 + 50_000);
  });

  it('applies only 0% threshold rules when there is no target', () => {
    const r = calculateCommission(rules, 1_000_000, 0);
    expect(r.achievementPct).toBe(0);
    expect(r.lines.map((l) => l.ruleId)).toEqual(['base']);
  });

  it('pays nothing with no sales', () => {
    expect(calculateCommission(rules, 0, 4_000_000)).toEqual({ achievementPct: 0, lines: [], total: 0 });
  });
});

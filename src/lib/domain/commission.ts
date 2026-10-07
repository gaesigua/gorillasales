// Commission engine: applies the organization's rules to one rep's month.

export interface CommissionRuleInput {
  id: string;
  name: string;
  type: 'percentage' | 'flat';
  value: number; // percent of sales, or flat RWF
  thresholdPct: number; // minimum target achievement % for the rule to apply (0 = always)
}

export interface CommissionResult {
  achievementPct: number;
  lines: { ruleId: string; name: string; amount: number }[];
  total: number;
}

/**
 * Each rule whose threshold is met pays out independently: percentage rules pay
 * value% of actual sales, flat rules pay their fixed amount. Without a target,
 * achievement is 0%, so only rules with a 0% threshold apply.
 */
export function calculateCommission(rules: CommissionRuleInput[], actualSales: number, target: number): CommissionResult {
  const achievementPct = target > 0 ? (actualSales / target) * 100 : 0;
  const lines = rules
    .filter((r) => achievementPct >= r.thresholdPct)
    .map((r) => ({
      ruleId: r.id,
      name: r.name,
      amount: Math.round((r.type === 'percentage' ? (actualSales * r.value) / 100 : r.value) * 100) / 100,
    }))
    .filter((l) => l.amount > 0);
  return {
    achievementPct: Math.round(achievementPct * 10) / 10,
    lines,
    total: Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100,
  };
}

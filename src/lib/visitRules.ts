// Business rules for classifying visits. These deliberately do not depend on the
// (configurable) visit-outcome labels, so renaming an outcome cannot break reports.

export function isOrder(v: { salesValue: number }): boolean {
  return v.salesValue > 0;
}

export function needsFollowUp(v: { nextFollowUpDate: string }): boolean {
  return !!v.nextFollowUpDate;
}

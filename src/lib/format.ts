export function formatRWF(value: number): string {
  if (value >= 1000000) {
    return `RWF ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `RWF ${(value / 1000).toFixed(0)}K`;
  }
  return `RWF ${value.toLocaleString()}`;
}

export function formatRWFFull(value: number): string {
  return `RWF ${value.toLocaleString('en-US')}`;
}

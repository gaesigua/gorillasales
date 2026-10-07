/** Temporary id for rows created in the browser before they are saved. */
export function newTempId(prefix: string): string {
  return `new-${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

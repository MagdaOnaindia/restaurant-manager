/** "12,50" | "12.50" | "12" → cents (1250). Returns null if not a valid amount. */
export function parseEurosToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, ".").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

/** Cents → "12,50" (for inputs). */
export function centsToEurosInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

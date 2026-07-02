/** "12,50" | "12.50" | "12" → céntimos (1250). Devuelve null si no es un importe válido. */
export function parseEurosToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, ".").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

/** Céntimos → "12,50" (para inputs). */
export function centsToEurosInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

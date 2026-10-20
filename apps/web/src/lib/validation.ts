// Validasi bahwa nilai adalah bilangan bulat positif
export function isPositiveInteger(value: unknown): value is number {
  if (typeof value !== 'number') return false;
  return Number.isInteger(value) && value > 0;
}

// Parse angka dari string, return null jika invalid
export function parsePositiveInteger(value: string | number): number | null {
  const num = typeof value === 'string' ? Number(value.trim()) : value;
  if (isNaN(num) || !isPositiveInteger(num)) return null;
  return num;
}

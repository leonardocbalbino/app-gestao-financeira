/** Compara versões semânticas simples ("1.2.10" > "1.2.9"). Retorna -1, 0 ou 1. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export function isBelowMinimum(current: string | null | undefined, minimum: string): boolean {
  if (!current) return false;
  return compareVersions(current, minimum) < 0;
}

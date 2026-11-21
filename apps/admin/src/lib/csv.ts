/**
 * CSV compatível com Excel pt-BR (separador ";", BOM UTF-8) e protegido contra
 * injeção de fórmulas (=, +, -, @ no início viram texto).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'string' ? value : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const BOM = String.fromCharCode(0xfeff);
const CRLF = String.fromCharCode(13, 10);

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(';'), ...rows.map((r) => r.map(csvCell).join(';'))];
  return BOM + lines.join(CRLF) + CRLF;
}

/**
 * CSV para exportaciones del panel (Fase 06: asistencia HU-30, postulaciones HU-31) y lectura de
 * listas (correos Moodle HU-25/27). Funciones PURAS.
 *
 * Exportación compatible con Excel: BOM UTF-8 (acentos), separador coma, CRLF, comillas dobles
 * cuando hace falta y protección contra inyección de fórmulas (=, +, -, @ al inicio → prefijo ').
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | Date | null | undefined;
}

const BOM = '\uFEFF';

/** Escapa un valor para una celda CSV. */
export function csvCell(value: string | number | boolean | Date | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Documento CSV (con BOM) a partir de filas y columnas. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(',')),
  ];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/** Divide una línea CSV respetando comillas dobles. */
export function parseCsvLine(line: string, separator = ','): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      cells.push(current);
      current = '';
    } else current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/**
 * Extrae correos de un CSV o de texto libre (uno por línea, o separados por coma/punto y coma).
 * Si la primera fila tiene una columna `email`/`correo`, usa esa columna; si no, toma de cada fila
 * la primera celda que parezca correo. No valida el formato: lo hace quien importa.
 */
export function extractEmailsFromCsv(text: string): string[] {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const separator = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const header = parseCsvLine(lines[0], separator).map((h) => h.toLowerCase());
  const column = header.findIndex((h) =>
    ['email', 'e-mail', 'correo', 'correo electrónico', 'correo electronico'].includes(h),
  );
  const rows = column >= 0 ? lines.slice(1) : lines;
  const emails: string[] = [];
  for (const line of rows) {
    const cells = parseCsvLine(line, separator);
    if (column >= 0) {
      if (cells[column]) emails.push(cells[column]);
      continue;
    }
    const candidate = cells.find((c) => c.includes('@'));
    if (candidate) emails.push(candidate);
    else if (cells.length === 1 && cells[0]) emails.push(cells[0]);
  }
  return emails;
}

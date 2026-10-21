/**
 * Generador mínimo de PDF de una página (texto con Helvetica / Helvetica-Bold, codificación
 * WinAnsi: acentos, ñ, ¿¡, guiones y comillas tipográficas). Sin dependencias: suficiente para el
 * recibo de pago de HU-26 (no es factura fiscal). Coordenadas en puntos (carta: 612 × 792).
 */

export type PdfLine =
  | {
      text: string;
      size?: number;
      bold?: boolean;
      color?: 'muted' | 'default';
      spaceBefore?: number;
    }
  | { rule: true; spaceBefore?: number }
  | { pairs: Array<[label: string, value: string]>; size?: number; spaceBefore?: number };

export interface PdfDocument {
  title: string;
  lines: PdfLine[];
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 56;

/** Caracteres fuera de Latin-1 que WinAnsi sí incluye. */
const WIN_ANSI_EXTRA: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  '„': 0x84,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
};

function toWinAnsi(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 63;
    if (WIN_ANSI_EXTRA[char] !== undefined) bytes.push(WIN_ANSI_EXTRA[char]);
    else if (code >= 0x20 && code <= 0x7e) bytes.push(code);
    else if (code >= 0xa0 && code <= 0xff) bytes.push(code);
    else bytes.push(0x3f); // "?"
  }
  return Buffer.from(bytes);
}

/** Cadena literal PDF: escapa \ ( ) y codifica en WinAnsi (latin1 en el archivo). */
function pdfString(text: string): string {
  return `(${toWinAnsi(text)
    .toString('latin1')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')})`;
}

function textOp(x: number, y: number, size: number, bold: boolean, text: string, gray = 0): string {
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${gray} g ${x} ${y.toFixed(2)} Td ${pdfString(text)} Tj ET`;
}

export function renderSimplePdf(doc: PdfDocument): Buffer {
  const ops: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;
  for (const line of doc.lines) {
    y -= line.spaceBefore ?? 0;
    if ('rule' in line) {
      y -= 6;
      ops.push(
        `0.8 G 0.75 w ${MARGIN} ${y.toFixed(2)} m ${PAGE_WIDTH - MARGIN} ${y.toFixed(2)} l S`,
      );
      y -= 10;
    } else if ('pairs' in line) {
      const size = line.size ?? 11;
      for (const [label, value] of line.pairs) {
        y -= size * 1.6;
        ops.push(textOp(MARGIN, y, size, true, label, 0.35));
        ops.push(textOp(MARGIN + 170, y, size, false, value));
      }
    } else {
      const size = line.size ?? 11;
      y -= size * 1.5;
      ops.push(textOp(MARGIN, y, size, !!line.bold, line.text, line.color === 'muted' ? 0.4 : 0));
    }
  }
  const content = Buffer.from(ops.join('\n'), 'latin1');

  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    ),
    Buffer.from(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ),
    Buffer.from(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
      content,
      Buffer.from('\nendstream'),
    ]),
    Buffer.concat([
      Buffer.from('<< /Title '),
      Buffer.from(pdfString(doc.title), 'latin1'),
      Buffer.from(' /Producer (Escuela Itinerante del Agua) >>'),
    ]),
  ];

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets: number[] = [];
  let length = chunks[0].length;
  objects.forEach((body, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      body,
      Buffer.from('\nendobj\n'),
    ]);
    chunks.push(chunk);
    length += chunk.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n` +
    `startxref\n${length}\n%%EOF\n`;
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
}

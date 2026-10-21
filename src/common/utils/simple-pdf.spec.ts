import { renderSimplePdf } from './simple-pdf';

describe('simple-pdf', () => {
  it('genera un PDF válido con xref y texto WinAnsi (acentos)', () => {
    const pdf = renderSimplePdf({
      title: 'Recibo PAG-000001',
      lines: [
        { text: 'Escuela Itinerante del Agua', bold: true, size: 18 },
        { rule: true },
        { pairs: [['Concepto', 'Cuota 2 de 3 — Diplomado (Ecotecnologías)']] },
      ],
    });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('Ecotecnolog\xedas'); // í en WinAnsi
    expect(text).toContain('\\(Ecotecnolog'); // paréntesis escapados
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
  });
});

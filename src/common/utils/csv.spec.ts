import { csvCell, extractEmailsFromCsv, parseCsvLine, toCsv } from './csv';

describe('csv', () => {
  it('escapa comas, comillas y saltos de línea', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(72)).toBe('72');
  });

  it('neutraliza fórmulas de Excel en textos', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('+52')).toBe("'+52");
    expect(csvCell(-5)).toBe('-5');
  });

  it('toCsv agrega BOM, encabezados y CRLF', () => {
    const csv = toCsv(
      [{ name: 'Ana Núñez', percent: 72 }],
      [
        { header: 'Nombre', value: (r) => r.name },
        { header: '% asistencia', value: (r) => r.percent },
      ],
    );
    expect(csv).toBe('\uFEFFNombre,% asistencia\r\nAna Núñez,72\r\n');
  });

  it('parseCsvLine respeta comillas', () => {
    expect(parseCsvLine('"a,b", c ,"d ""e"""')).toEqual(['a,b', 'c', 'd "e"']);
  });

  it('extractEmailsFromCsv: columna email, texto libre y punto y coma', () => {
    expect(extractEmailsFromCsv('Nombre,Email\nAna,ana@x.mx\nBeto,"beto@x.mx"\n')).toEqual([
      'ana@x.mx',
      'beto@x.mx',
    ]);
    expect(extractEmailsFromCsv('ana@x.mx\r\nbeto@x.mx')).toEqual(['ana@x.mx', 'beto@x.mx']);
    expect(extractEmailsFromCsv('nombre;correo\nAna;ana@x.mx')).toEqual(['ana@x.mx']);
    expect(extractEmailsFromCsv('Ana López,ana@x.mx,MX')).toEqual(['ana@x.mx']);
    expect(extractEmailsFromCsv('')).toEqual([]);
  });
});

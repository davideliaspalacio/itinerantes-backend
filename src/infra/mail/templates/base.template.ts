/**
 * Plantilla HTML base de los correos (layout simple, compatible con clientes de correo:
 * tablas + estilos en línea). Cada fase construye su contenido y lo envuelve con `renderEmail`.
 */
export interface EmailLayoutOptions {
  /** Título visible dentro del correo. */
  title: string;
  /** Texto de vista previa (preheader) que muestran algunos clientes. */
  preheader?: string;
  /** Párrafos de contenido (texto plano; se escapan). */
  paragraphs: string[];
  /** Valor destacado en grande tras los párrafos (p. ej. un código OTP). */
  highlight?: string;
  /** Párrafos que van después del valor destacado. */
  afterHighlight?: string[];
  /** Botón de acción opcional. */
  action?: { label: string; url: string };
  /** Nota al pie (p. ej. "Si no solicitaste este correo, ignóralo."). */
  footerNote?: string;
}

const BRAND_NAME = 'Escuela Itinerante del Agua';
const BRAND_COLOR = '#0f6e8c';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Devuelve `{ html, text }` listos para `MailService.send`. */
export function renderEmail(options: EmailLayoutOptions): { html: string; text: string } {
  const toParagraphs = (items: string[] = []): string =>
    items
      .map(
        (p) =>
          `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1f2933;">${escapeHtml(p)}</p>`,
      )
      .join('');
  const highlightHtml = options.highlight
    ? `<p style="margin:8px 0 24px;font-size:32px;line-height:40px;letter-spacing:8px;font-weight:700;font-family:'Courier New',monospace;color:#102a43;background:#f3f6f8;border-radius:6px;padding:12px 16px;text-align:center;">${escapeHtml(options.highlight)}</p>`
    : '';
  const paragraphsHtml =
    toParagraphs(options.paragraphs) + highlightHtml + toParagraphs(options.afterHighlight);

  const actionHtml = options.action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td style="border-radius:6px;background:${BRAND_COLOR};">
         <a href="${escapeHtml(options.action.url)}" style="display:inline-block;padding:12px 24px;font-size:16px;color:#ffffff;text-decoration:none;font-weight:600;">${escapeHtml(options.action.label)}</a>
       </td></tr></table>`
    : '';

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.title)}</title></head>
<body style="margin:0;padding:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(options.preheader ?? '')}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${BRAND_COLOR};padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700;">${BRAND_NAME}</td></tr>
        <tr><td style="padding:32px 24px 8px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#102a43;">${escapeHtml(options.title)}</h1>
          ${paragraphsHtml}
          ${actionHtml}
        </td></tr>
        <tr><td style="padding:16px 24px 24px;font-size:13px;line-height:20px;color:#7b8794;border-top:1px solid #e4e7eb;">
          ${escapeHtml(options.footerNote ?? 'Este es un correo automático, por favor no respondas a este mensaje.')}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    options.title,
    '',
    ...options.paragraphs,
    ...(options.highlight ? ['', options.highlight, ''] : []),
    ...(options.afterHighlight ?? []),
    ...(options.action ? ['', `${options.action.label}: ${options.action.url}`] : []),
    '',
    options.footerNote ?? '',
    `— ${BRAND_NAME}`,
  ]
    .join('\n')
    .trim();

  return { html, text };
}

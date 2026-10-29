/**
 * Plantilla HTML base de los correos, con la identidad visual del frontend (ui-kit/_tokens.scss):
 * fondo crema, logo verde, tarjeta blanca, botón "píldora" verde y pie verde.
 *
 * Compatible con clientes de correo: tablas + estilos en línea, sin fuentes web (Gmail no las
 * carga) ni SVG. Cada fase construye su contenido y lo envuelve con `renderEmail`.
 */
export interface EmailLayoutOptions {
  /** Título visible dentro del correo. */
  title: string;
  /** Texto de vista previa (preheader) que muestran algunos clientes. */
  preheader?: string;
  /** Etiqueta corta sobre el título (p. ej. "Pagos", "Formación"). */
  eyebrow?: string;
  /** `alert` = aviso que requiere acción (cobro fallido, mora): franja de atención. */
  tone?: 'default' | 'alert';
  /** Párrafos de contenido (texto plano; se escapan). */
  paragraphs: string[];
  /** Valor destacado en grande tras los párrafos (p. ej. un código OTP). */
  highlight?: string;
  /** Datos clave en formato etiqueta → valor (fecha, monto, folio...). */
  details?: { label: string; value: string }[];
  /** Párrafos que van después del valor destacado y los datos. */
  afterHighlight?: string[];
  /** Botón de acción opcional. */
  action?: { label: string; url: string };
  /** Nota al pie (p. ej. "Si no solicitaste este correo, ignóralo."). */
  footerNote?: string;
}

const BRAND_NAME = 'Escuela Itinerante del Agua';
const SITE_URL = 'https://www.itinerantesdelagua.com';
/** Logo verde publicado en el sitio público (PNG: los clientes de correo no siempre leen WebP). */
const DEFAULT_LOGO_URL = `${SITE_URL}/assets/images/logoGreen.png`;

/** Colores de marca (projects/ui-kit/src/styles/_tokens.scss del frontend). */
const C = {
  primary: '#3f5644',
  onPrimary: '#fbf8f0',
  surface: '#fbf8f0',
  text: '#1b1e30',
  muted: '#5f6457',
  line: '#ebe4d3',
  sun: '#eaa700',
  danger: '#b5452b',
  dangerSoft: '#f8e9e3',
  card: '#ffffff',
} as const;

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function logoUrl(): string {
  return process.env.MAIL_LOGO_URL?.trim() || DEFAULT_LOGO_URL;
}

/** Devuelve `{ html, text }` listos para `MailService.send`. */
export function renderEmail(options: EmailLayoutOptions): { html: string; text: string } {
  const p = (items: string[] = []): string =>
    items
      .map(
        (t) =>
          `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${C.text};">${escapeHtml(t)}</p>`,
      )
      .join('');

  const eyebrowHtml = options.eyebrow
    ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:${C.primary};">${escapeHtml(options.eyebrow)}</p>`
    : '';

  const alertHtml =
    options.tone === 'alert'
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;"><tr>
           <td style="background:${C.dangerSoft};border-left:4px solid ${C.danger};border-radius:8px;padding:12px 16px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:700;color:${C.danger};">Requiere tu atención</td>
         </tr></table>`
      : '';

  const highlightHtml = options.highlight
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 24px;"><tr>
         <td align="center" style="background:${C.surface};border:2px dashed ${C.primary};border-radius:14px;padding:18px 12px;font-family:'Courier New',Courier,monospace;font-size:36px;line-height:44px;letter-spacing:10px;font-weight:700;color:${C.primary};">${escapeHtml(options.highlight)}</td>
       </tr></table>`
    : '';

  const detailsHtml = options.details?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 24px;background:${C.surface};border-radius:14px;">
         ${options.details
           .map(
             (
               d,
               i,
             ) => `<tr><td style="padding:14px 18px;${i > 0 ? `border-top:1px solid ${C.line};` : ''}">
               <p style="margin:0 0 2px;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${C.muted};">${escapeHtml(d.label)}</p>
               <p style="margin:0;font-family:${FONT};font-size:16px;line-height:22px;font-weight:700;color:${C.text};">${escapeHtml(d.value)}</p>
             </td></tr>`,
           )
           .join('')}
       </table>`
    : '';

  const actionHtml = options.action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 12px;"><tr>
         <td style="border-radius:999px;background:${C.primary};">
           <a href="${escapeHtml(options.action.url)}" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${C.onPrimary};text-decoration:none;border-radius:999px;">${escapeHtml(options.action.label)}</a>
         </td></tr></table>
       <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${escapeHtml(options.action.url)}" style="color:${C.primary};word-break:break-all;">${escapeHtml(options.action.url)}</a></p>`
    : '';

  const footerNote =
    options.footerNote ?? 'Este es un correo automático, por favor no respondas a este mensaje.';

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.surface};-webkit-text-size-adjust:100%;">
  <span style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(options.preheader ?? '')}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.surface};">
    <tr><td align="center" style="padding:28px 12px 40px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
        <tr><td align="center" style="padding:0 0 22px;">
          <a href="${SITE_URL}" style="text-decoration:none;"><img src="${escapeHtml(logoUrl())}" width="200" alt="${BRAND_NAME}" style="display:block;width:200px;max-width:65%;height:auto;border:0;"></a>
        </td></tr>
        <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td style="padding:36px 32px 12px;">
              ${eyebrowHtml}
              <h1 style="margin:0 0 14px;font-family:${FONT};font-size:26px;line-height:32px;font-weight:700;color:${C.primary};">${escapeHtml(options.title)}</h1>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;"><tr><td style="width:56px;height:4px;background:${C.sun};border-radius:4px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
              ${alertHtml}
              ${p(options.paragraphs)}
              ${highlightHtml}
              ${detailsHtml}
              ${p(options.afterHighlight)}
              ${actionHtml}
            </td></tr>
            <tr><td style="padding:20px 32px 28px;">
              <p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">${escapeHtml(footerNote)}</p>
            </td></tr>
            <tr><td style="background:${C.primary};padding:18px 32px;">
              <p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;font-weight:700;color:${C.onPrimary};">${BRAND_NAME}</p>
              <p style="margin:2px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.onPrimary};"><a href="${SITE_URL}" style="color:${C.onPrimary};text-decoration:underline;">itinerantesdelagua.com</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    options.title,
    '',
    ...(options.tone === 'alert' ? ['Requiere tu atención.', ''] : []),
    ...options.paragraphs,
    ...(options.highlight ? ['', options.highlight, ''] : []),
    ...(options.details?.map((d) => `${d.label}: ${d.value}`) ?? []),
    ...(options.afterHighlight ?? []),
    ...(options.action ? ['', `${options.action.label}: ${options.action.url}`] : []),
    '',
    footerNote,
    `— ${BRAND_NAME}`,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { html, text };
}

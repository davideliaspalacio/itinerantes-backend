/**
 * Validación de enlaces que captura el equipo en el panel (Fase 06). Funciones PURAS.
 */

function parseHttps(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function hostIs(url: URL, domain: string): boolean {
  const host = url.hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

/** URL `https://` bien formada. */
export function isHttpsUrl(value: string): boolean {
  return parseHttps(value) !== null;
}

/** Enlace de Zoom (HU-31: entrevista "URL zoom.us"). */
export function isZoomUrl(value: string): boolean {
  const url = parseHttps(value);
  return !!url && hostIs(url, 'zoom.us');
}

/** Enlace de sesión en vivo (HU-29: "URL de zoom.us o meet.google.com"). */
export function isMeetingUrl(value: string): boolean {
  const url = parseHttps(value);
  return !!url && (hostIs(url, 'zoom.us') || url.hostname.toLowerCase() === 'meet.google.com');
}

/** Grupo de WhatsApp (HU-27 paso 7: "URL chat.whatsapp.com"). */
export function isWhatsappGroupUrl(value: string): boolean {
  const url = parseHttps(value);
  return !!url && url.hostname.toLowerCase() === 'chat.whatsapp.com' && url.pathname.length > 1;
}

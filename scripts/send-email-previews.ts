/**
 * Vistas previas de TODOS los correos de la plataforma, armados con las mismas funciones que usa la
 * API (textos reales + plantilla base), con datos de ejemplo. Sirve para aprobar el diseño.
 *
 *   # Guardar los HTML en una carpeta (sin enviar nada):
 *   pnpm email:previews --out tmp/email-previews
 *   # Enviarlos por Resend (asunto con prefijo "[Vista previa N/M]"):
 *   RESEND_API_KEY=re_... pnpm email:previews --to persona@correo.com
 *
 * Variables opcionales: MAIL_FROM (remitente) y FRONTEND_URL (base de los botones).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { NotificationPriority, NotificationType } from '../src/generated/prisma/client';
import { OtpPurpose } from '../src/generated/prisma/enums';
import { renderEmail, type EmailLayoutOptions } from '../src/infra/mail/templates/base.template';
import {
  type ApplicationMessageContext,
  balanceReminderMessage,
  interviewReminderMessage,
  interviewScheduledMessage,
  statusChangeMessage,
} from '../src/modules/applications/policies/application-messages.policy';
import { buildOtpEmail } from '../src/modules/auth/auth.mails';
import {
  recordingPublishedMessage,
  sessionCancelledMessage,
  sessionRescheduledMessage,
  sessionScheduledMessage,
  sessionsGeneratedMessage,
} from '../src/modules/live-sessions/admin/policies/session-admin.policy';
import {
  buildNotificationEmail,
  defaultPriority,
} from '../src/modules/notifications/notifications.policy';
import { PORTAL_LINKS } from '../src/modules/notifications/portal-links';
import {
  accessRestoredMessage,
  accessSuspendedMessage,
} from '../src/modules/payments/admin/policies/admin-payments.policy';
import {
  installmentFailedMessage,
  installmentPaidMessage,
  installmentUpcomingMessage,
  paymentConfirmedMessage,
  planDelinquentMessage,
  transferRejectedMessage,
  transferValidatedMessage,
} from '../src/modules/payments/policies/payment-messages.policy';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://www.itinerantesdelagua.com';
const FROM =
  process.env.MAIL_FROM ?? 'Escuela Itinerante del Agua <no-reply@itinerantesdelagua.com>';
const TZ = 'America/Mexico_City';
const NAME = 'María José Núñez';

// --- Datos de ejemplo ---------------------------------------------------------------------------
const day = (offsetDays: number, hour: number, minute = 0): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hour + 6, minute, 0, 0); // hora CDMX (UTC-6)
  return d;
};
const offer = {
  id: 'b8a5c1d2-0000-4000-8000-000000000001',
  name: 'Diplomado en Ecotecnologías del Agua',
};
const mxn = (pesos: number) => ({ amountCents: pesos * 100, currency: 'MXN' as const });
const appCtx: ApplicationMessageContext = {
  applicationId: 'a1b2c3d4-0000-4000-8000-000000000002',
  kind: 'SCHOLARSHIP',
  folio: 'BEC-000123',
  offer,
  userTimezone: TZ,
  requestedScholarshipType: { name: 'Aguas Libres', requiresInterview: true },
  assignedScholarshipTypeName: 'Aguas Libres',
  assignedPercent: 50,
  balance: mxn(5100),
  responseDueAt: day(5, 23, 59),
  interview: { startsAt: day(3, 11) },
};

interface Preview {
  group: string;
  name: string;
  subject: string;
  layout: EmailLayoutOptions;
}

/** Igual que `NotificationsService.notify` → correo. */
function notification(
  group: string,
  name: string,
  m: {
    type: NotificationType;
    title: string;
    body: string;
    action?: { label: string; path: string };
    priority?: NotificationPriority;
    email?: unknown;
  },
): Preview {
  const custom =
    typeof m.email === 'object' && m.email !== null
      ? (m.email as {
          subject?: string;
          paragraphs?: string[];
          details?: { label: string; value: string }[];
        })
      : undefined;
  const { subject, layout } = buildNotificationEmail({
    fullName: NAME,
    type: m.type,
    priority: m.priority ?? defaultPriority(m.type),
    title: m.title,
    body: m.body,
    frontendUrl: FRONTEND_URL,
    action: m.action,
    custom,
  });
  return { group, name, subject, layout };
}

function must<T>(value: T | null): T {
  if (!value) throw new Error('Mensaje vacío');
  return value;
}

function previews(): Preview[] {
  const otpVerify = buildOtpEmail(OtpPurpose.EMAIL_VERIFICATION, {
    fullName: NAME,
    code: '482913',
    ttlMinutes: 10,
  });
  const otpReset = buildOtpEmail(OtpPurpose.PASSWORD_RESET, {
    fullName: NAME,
    code: '730154',
    ttlMinutes: 10,
  });
  const sessions = { label: 'Ver mis sesiones', path: PORTAL_LINKS.sessions() };
  const F = 'Tu formación';
  const A = 'Postulaciones y becas';
  const P = 'Pagos';

  return [
    // --- Cuenta
    { group: 'Cuenta', name: 'Validación de cuenta (código OTP)', ...otpVerify },
    { group: 'Cuenta', name: 'Recuperar contraseña (código OTP)', ...otpReset },

    // --- Contacto
    {
      group: 'Contacto',
      name: 'Acuse al visitante',
      subject: 'Recibimos tu mensaje',
      layout: {
        title: '¡Gracias! Recibimos tu mensaje.',
        eyebrow: 'Contacto',
        paragraphs: [
          'Hola, Lucía Hernández:',
          'Recibimos tu mensaje sobre "Escuela". El equipo de la Escuela Itinerante del Agua lo revisará y te responderá a este correo lo antes posible.',
        ],
        footerNote: 'Si no enviaste este mensaje, puedes ignorar este correo.',
      },
    },

    // --- Formación
    notification(F, 'Inscripción confirmada (compra / inscripción)', {
      type: 'ENROLLMENT_CONFIRMED',
      title: `Inscripción confirmada: ${offer.name}`,
      body: `Ya estás inscrito en ${offer.name}. Primera sesión: 12/11/2026 18:00 hora CDMX. Encuentra todo en tu aula.`,
      action: { label: 'Ir a mi aula', path: PORTAL_LINKS.classroom(offer.id) },
    }),
    notification(F, 'Nueva sesión agendada (a los alumnos de la clase)', {
      ...sessionScheduledMessage({
        offerName: offer.name,
        startsAt: day(7, 18),
        endsAt: day(7, 20),
        moduleTitle: 'Módulo 2 · Captación de agua de lluvia',
        userTimezone: TZ,
      }),
      action: sessions,
    }),
    notification(F, 'Varias sesiones agendadas (generación del calendario)', {
      ...sessionsGeneratedMessage({
        offerName: offer.name,
        count: 12,
        firstStartsAt: day(7, 18),
        firstEndsAt: day(7, 20),
        lastStartsAt: day(84, 18),
        userTimezone: TZ,
      }),
      action: sessions,
    }),
    notification(F, 'Sesión reprogramada', {
      ...sessionRescheduledMessage({
        offerName: offer.name,
        previousStartsAt: day(7, 18),
        startsAt: day(9, 18),
        reason: 'La docente tiene un compromiso académico.',
        userTimezone: TZ,
      }),
      action: sessions,
    }),
    notification(F, 'Sesión cancelada', {
      ...sessionCancelledMessage({
        offerName: offer.name,
        startsAt: day(7, 18),
        reason: 'Día festivo.',
        userTimezone: TZ,
      }),
      action: sessions,
    }),
    notification(F, 'Registra tu asistencia (al terminar la sesión)', {
      type: 'ATTENDANCE_OPEN',
      title: 'Registra tu asistencia',
      body: `Terminó la sesión del 12/11/2026 18:00 (hora CDMX) de ${offer.name}. El registro cierra en 48 h: hasta el 14/11/2026 20:00 hora CDMX.`,
      action: { label: 'Registrar asistencia', path: PORTAL_LINKS.attendance('s1') },
    }),
    notification(F, 'Recordatorio de asistencia (enviado por el equipo)', {
      type: 'ATTENDANCE_OPEN',
      title: `Recuerda registrar tu asistencia: ${offer.name}`,
      body: 'Aún no registras tu asistencia a la sesión. El registro cierra el 14/11/2026 20:00 hora CDMX.',
      action: { label: 'Registrar asistencia', path: PORTAL_LINKS.attendance('s1') },
    }),
    notification(F, 'Nuevo módulo / material disponible', {
      type: 'MATERIAL_PUBLISHED',
      title: 'Nuevo módulo disponible: Captación de agua de lluvia',
      body: `Ya puedes consultar el módulo «Captación de agua de lluvia» de ${offer.name} con 3 materiales en tu aula.`,
      action: { label: 'Ver materiales', path: PORTAL_LINKS.materials(offer.id) },
    }),
    notification(F, 'Grabación disponible', {
      ...recordingPublishedMessage({
        offerName: offer.name,
        startsAt: day(-1, 18),
        userTimezone: TZ,
      }),
      action: { label: 'Ver materiales', path: PORTAL_LINKS.materials(offer.id) },
    }),
    notification(F, 'Grupo de WhatsApp disponible', {
      type: 'WHATSAPP_GROUP_AVAILABLE',
      title: `Grupo de WhatsApp: ${offer.name}`,
      body: 'El grupo de WhatsApp de tu formación ya está disponible en tu aula.',
      action: { label: 'Unirme al grupo', path: PORTAL_LINKS.classroom(offer.id) },
    }),
    notification(F, 'Formación de Moodle vinculada', {
      type: 'MOODLE_ENROLLMENT_LINKED',
      title: `Tu formación ya está en el portal: ${offer.name}`,
      body: `Vinculamos tu inscripción de Moodle a ${offer.name}. Encuéntrala en Mi formación (etiqueta "Vía Moodle") con sus materiales y sesiones. No necesitas pagar de nuevo.`,
      action: { label: 'Ir a mi aula', path: PORTAL_LINKS.classroom(offer.id) },
    }),

    // --- Postulaciones y becas
    notification(A, 'Postulación enviada', must(statusChangeMessage('SUBMITTED', appCtx))),
    notification(A, 'Entrevista agendada', interviewScheduledMessage(appCtx)),
    notification(A, 'Recordatorio de entrevista (24 h antes)', interviewReminderMessage(appCtx)),
    notification(
      A,
      'Beca aprobada (pendiente de pago)',
      must(statusChangeMessage('APPROVED_PENDING_PAYMENT', appCtx)),
    ),
    notification(
      A,
      'Postulación aprobada (confirma tu participación)',
      must(
        statusChangeMessage('APPROVED_PENDING_CONFIRMATION', {
          ...appCtx,
          kind: 'OPEN_CALL',
          folio: 'CONV-000045',
        }),
      ),
    ),
    notification(A, 'Inscrita tras la postulación', must(statusChangeMessage('ENROLLED', appCtx))),
    notification(A, 'No seleccionada', must(statusChangeMessage('NOT_SELECTED', appCtx))),
    notification(A, 'Postulación vencida', must(statusChangeMessage('EXPIRED', appCtx))),
    notification(A, 'Recordatorio: el plazo de pago vence pronto', balanceReminderMessage(appCtx)),

    // --- Pagos
    notification(
      P,
      'Pago confirmado (compra)',
      paymentConfirmedMessage({
        offerId: offer.id,
        offerName: offer.name,
        folio: 'PAG-000981',
        concept: 'Pago completo',
        amount: mxn(10200),
        enrolled: true,
      }),
    ),
    notification(
      P,
      'Cuota pagada',
      installmentPaidMessage({
        offerName: offer.name,
        folio: 'PAG-000990',
        sequence: 2,
        count: 3,
        amount: mxn(3400),
      }),
    ),
    notification(
      P,
      'Próximo cobro de cuota',
      installmentUpcomingMessage({
        offerName: offer.name,
        sequence: 3,
        count: 3,
        amount: mxn(3400),
        dueAt: day(3, 9),
        cardBrand: 'visa',
        cardLast4: '4242',
        timezone: TZ,
      }),
    ),
    notification(
      P,
      'Cobro de cuota fallido',
      installmentFailedMessage({
        offerName: offer.name,
        sequence: 2,
        count: 3,
        amount: mxn(3400),
        nextRetryAt: day(2, 9),
        failureMessage: 'Fondos insuficientes',
        timezone: TZ,
      }),
    ),
    notification(
      P,
      'Plan en mora',
      planDelinquentMessage({ offerName: offer.name, pending: mxn(6800), accessSuspended: false }),
    ),
    notification(
      P,
      'Acceso suspendido por mora',
      accessSuspendedMessage({ offerName: offer.name }),
    ),
    notification(
      P,
      'Acceso restablecido',
      accessRestoredMessage({ offerId: offer.id, offerName: offer.name }),
    ),
    notification(
      P,
      'Transferencia validada',
      transferValidatedMessage({
        offerId: offer.id,
        offerName: offer.name,
        folio: 'PAG-001002',
        amount: mxn(5100),
      }),
    ),
    notification(
      P,
      'Comprobante de transferencia rechazado',
      transferRejectedMessage({
        applicationId: appCtx.applicationId,
        offerName: offer.name,
        reason: 'AMOUNT_MISMATCH',
        note: 'El comprobante indica $5,000 y el saldo es $5,100.',
        dueAt: day(4, 23, 59),
      }),
    ),
  ];
}

async function sendResend(apiKey: string, to: string, subject: string, html: string, text: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function main(): Promise<void> {
  const to = arg('to');
  const out = arg('out');
  if (!to && !out) throw new Error('Uso: pnpm email:previews --out <carpeta> | --to <correo>');
  const list = previews();

  if (out) {
    const dir = resolve(out);
    mkdirSync(dir, { recursive: true });
    const index: string[] = [];
    list.forEach((p, i) => {
      const file = `${String(i + 1).padStart(2, '0')}.html`;
      writeFileSync(join(dir, file), renderEmail(p.layout).html);
      index.push(
        `<li><a href="${file}">${p.group} — ${p.name}</a> <small>(${p.subject})</small></li>`,
      );
    });
    writeFileSync(
      join(dir, 'index.html'),
      `<meta charset="utf-8"><h1>Correos</h1><ol>${index.join('')}</ol>`,
    );
    console.log(`${list.length} vistas previas en ${dir}`);
  }

  if (to) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('Falta RESEND_API_KEY');
    for (const [i, p] of list.entries()) {
      const { html, text } = renderEmail(p.layout);
      const subject = `[Vista previa ${i + 1}/${list.length} · ${p.group}] ${p.name} — ${p.subject}`;
      await sendResend(apiKey, to, subject, html, text);
      console.log(`✓ ${i + 1}/${list.length} ${p.group} — ${p.name}`);
      await new Promise((r) => setTimeout(r, 700)); // límite de Resend (2/s)
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

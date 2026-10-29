import type { EmailLayoutOptions } from '../../infra/mail/templates/base.template';
import { OtpPurpose } from '../../generated/prisma/enums';

/** Correo con el código OTP (HU-03 verificación / HU-05 recuperación), en español. */
export function buildOtpEmail(
  purpose: OtpPurpose,
  params: { fullName: string; code: string; ttlMinutes: number },
): { subject: string; layout: EmailLayoutOptions } {
  const firstName = params.fullName.split(' ')[0] ?? params.fullName;
  const expiry = `El código vence en ${params.ttlMinutes} minutos. Si pides uno nuevo, este dejará de funcionar.`;

  if (purpose === OtpPurpose.PASSWORD_RESET) {
    return {
      subject: `${params.code} es tu código para recuperar tu contraseña`,
      layout: {
        title: 'Recupera tu contraseña',
        eyebrow: 'Tu cuenta',
        preheader: `Tu código de recuperación es ${params.code}`,
        paragraphs: [
          `Hola, ${firstName}:`,
          'Recibimos una solicitud para restablecer la contraseña de tu cuenta en el portal de la Escuela Itinerante del Agua. Ingresa este código para continuar:',
        ],
        highlight: params.code,
        afterHighlight: [expiry],
        footerNote:
          'Si no solicitaste recuperar tu contraseña, ignora este correo: tu contraseña actual sigue funcionando. Nunca compartas este código.',
      },
    };
  }

  return {
    subject: `${params.code} es tu código de verificación`,
    layout: {
      title: 'Verifica tu correo',
      eyebrow: 'Tu cuenta',
      preheader: `Tu código de verificación es ${params.code}`,
      paragraphs: [
        `Hola, ${firstName}:`,
        'Gracias por registrarte en el portal educativo de la Escuela Itinerante del Agua. Para activar tu cuenta, ingresa este código:',
      ],
      highlight: params.code,
      afterHighlight: [expiry],
      footerNote:
        'Si no creaste una cuenta, ignora este correo. Nunca compartas este código con nadie.',
    },
  };
}

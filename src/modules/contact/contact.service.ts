import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/errors/app.exception';
import { hmacSha256Hex } from '../../common/utils/crypto';
import type { Env } from '../../config/env.schema';
import { ContactStatus, ContactSubject } from '../../generated/prisma/client';
import { CaptchaService } from '../../infra/captcha/captcha.service';
import { MailService } from '../../infra/mail/mail.service';
import { renderEmail } from '../../infra/mail/templates/base.template';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  CONTACT_ORIGIN_LABELS,
  CONTACT_PROJECT_TYPE_LABELS,
  CONTACT_SERVICE_LABELS,
  CONTACT_SUBJECT_LABELS,
} from './contact.labels';
import type { ContactMessageResponseDto, CreateContactMessageRequestDto } from './dto/contact.dto';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

/**
 * Formulario de Contacto (HU-38 / HU-01). Sin bandeja en el panel (Anexo A): se registra en BD con
 * estado NEW y se notifica por correo al buzón del equipo, con acuse al visitante.
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly inbox?: string;
  private readonly ipSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly captcha: CaptchaService,
    config: ConfigService<Env, true>,
  ) {
    this.inbox =
      config.get('CONTACT_INBOX_EMAIL', { infer: true }) ??
      config.get('MAIL_TEAM_INBOX', { infer: true });
    this.ipSecret =
      config.get('IP_HASH_SECRET', { infer: true }) ??
      `ip:${config.get('JWT_ACCESS_SECRET', { infer: true })}`;
  }

  async create(
    dto: CreateContactMessageRequestDto,
    meta: RequestMeta,
  ): Promise<ContactMessageResponseDto> {
    // Honeypot: un bot llenó el campo oculto. Se responde como éxito sin guardar ni enviar nada.
    if (dto.website && dto.website.trim() !== '') {
      this.logger.warn({ origin: dto.origin }, 'Contacto descartado por honeypot');
      return { id: randomUUID(), status: ContactStatus.NEW, createdAt: new Date() };
    }

    if (!(await this.captcha.verify(dto.captchaToken, meta.ip))) {
      throw new AppException('CONTACT_CAPTCHA_FAILED');
    }

    const isDesign = dto.subject === ContactSubject.DESIGN_CONSULTING;
    const message = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        organization: dto.organization || null,
        phoneCountryCode: dto.phone?.countryCode ?? null,
        phoneNumber: dto.phone?.number ?? null,
        subject: dto.subject,
        projectType: isDesign ? dto.projectType : null,
        projectLocation: isDesign ? dto.projectLocation : null,
        service: isDesign ? dto.service : null,
        message: dto.message,
        privacyAcceptedAt: new Date(),
        origin: dto.origin,
        ipHash: meta.ip ? hmacSha256Hex(this.ipSecret, meta.ip) : null,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      },
    });

    await Promise.all([this.sendAcknowledgement(message), this.notifyTeam(message)]);
    return { id: message.id, status: message.status, createdAt: message.createdAt };
  }

  private async sendAcknowledgement(message: {
    name: string;
    email: string;
    subject: ContactSubject;
  }): Promise<void> {
    try {
      await this.mail.sendLayout(message.email, 'Recibimos tu mensaje', {
        title: '¡Gracias! Recibimos tu mensaje.',
        paragraphs: [
          `Hola, ${message.name}:`,
          `Recibimos tu mensaje sobre "${CONTACT_SUBJECT_LABELS[message.subject]}". El equipo de la Escuela Itinerante del Agua lo revisará y te responderá a este correo lo antes posible.`,
        ],
        footerNote: 'Si no enviaste este mensaje, puedes ignorar este correo.',
      });
    } catch (error) {
      this.logger.error({ err: error }, 'No se pudo enviar el acuse de contacto');
    }
  }

  private async notifyTeam(message: {
    id: string;
    name: string;
    email: string;
    organization: string | null;
    phoneCountryCode: string | null;
    phoneNumber: string | null;
    subject: ContactSubject;
    projectType: keyof typeof CONTACT_PROJECT_TYPE_LABELS | null;
    projectLocation: string | null;
    service: keyof typeof CONTACT_SERVICE_LABELS | null;
    message: string;
    origin: keyof typeof CONTACT_ORIGIN_LABELS;
  }): Promise<void> {
    if (!this.inbox) {
      this.logger.warn('CONTACT_INBOX_EMAIL/MAIL_TEAM_INBOX no configurado: sin notificación');
      return;
    }
    const lines = [
      `Nombre: ${message.name}`,
      `Correo: ${message.email}`,
      ...(message.organization ? [`Organización: ${message.organization}`] : []),
      ...(message.phoneNumber
        ? [`Teléfono / WhatsApp: ${message.phoneCountryCode ?? ''} ${message.phoneNumber}`]
        : []),
      `Asunto: ${CONTACT_SUBJECT_LABELS[message.subject]}`,
      `Origen: ${CONTACT_ORIGIN_LABELS[message.origin]}`,
      ...(message.projectType
        ? [
            `Tipo de proyecto: ${CONTACT_PROJECT_TYPE_LABELS[message.projectType]}`,
            `Ubicación del proyecto: ${message.projectLocation ?? ''}`,
            `Servicio de interés: ${message.service ? CONTACT_SERVICE_LABELS[message.service] : ''}`,
          ]
        : []),
      'Mensaje:',
      message.message,
      `Id: ${message.id}`,
    ];
    try {
      await this.mail.send({
        to: this.inbox,
        replyTo: message.email,
        subject: `[Contacto] ${CONTACT_SUBJECT_LABELS[message.subject]} — ${message.name}`,
        ...renderTeamEmail(lines),
      });
    } catch (error) {
      this.logger.error({ err: error }, 'No se pudo notificar el contacto al equipo');
    }
  }
}

function renderTeamEmail(lines: string[]): { html: string; text: string } {
  return renderEmail({
    title: 'Nuevo mensaje de Contacto',
    paragraphs: lines,
    footerNote: 'Responde a este correo para contestar directamente a quien escribió.',
  });
}

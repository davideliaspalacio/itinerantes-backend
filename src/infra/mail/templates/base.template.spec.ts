import { buildNotificationEmail } from '../../../modules/notifications/notifications.policy';
import { renderEmail } from './base.template';

describe('renderEmail (plantilla con la marca)', () => {
  it('escapa el contenido y muestra logo, etiqueta, datos y botón', () => {
    const { html, text } = renderEmail({
      title: 'Pago <confirmado>',
      eyebrow: 'Pagos',
      paragraphs: ['Hola, <b>Ana</b>:'],
      details: [{ label: 'Monto', value: '$5,100.00 MXN' }],
      action: { label: 'Ver mis pagos', url: 'https://ejemplo.com/a?b=1&c=2' },
    });
    expect(html).toContain('Pago &lt;confirmado&gt;');
    expect(html).toContain('Hola, &lt;b&gt;Ana&lt;/b&gt;:');
    expect(html).toContain('logoGreen.png');
    expect(html).toContain('#3f5644');
    expect(html).toContain('https://ejemplo.com/a?b=1&amp;c=2');
    expect(html).not.toContain('Requiere tu atención');
    expect(text).toContain('Monto: $5,100.00 MXN');
    expect(text).toContain('Ver mis pagos: https://ejemplo.com/a?b=1&c=2');
  });

  it('tono de alerta para avisos de prioridad alta (mora, cobro fallido)', () => {
    const { layout } = buildNotificationEmail({
      fullName: 'Ana López',
      type: 'PLAN_DELINQUENT',
      priority: 'HIGH',
      title: 'Tu plan está en mora',
      body: 'Tienes saldo pendiente.',
      frontendUrl: 'https://portal.example.com/',
      action: { label: 'Pagar ahora', path: '/portal/perfil/pagos' },
      custom: { details: [{ label: 'Saldo', value: '$1.00 MXN' }] },
    });
    expect(layout).toMatchObject({
      eyebrow: 'Pagos',
      tone: 'alert',
      paragraphs: ['Hola, Ana:', 'Tienes saldo pendiente.'],
      action: { url: 'https://portal.example.com/portal/perfil/pagos' },
    });
    expect(renderEmail(layout).html).toContain('Requiere tu atención');
  });
});

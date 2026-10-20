import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import type { MailDriver } from './mail.types';
import { renderEmail } from './templates/base.template';

describe('MailService', () => {
  const driver: MailDriver = {
    name: 'console',
    send: jest.fn().mockResolvedValue({ driver: 'console' }),
  };
  const config = { get: jest.fn().mockReturnValue('EIA <no-reply@example.com>') };
  const service = new MailService(driver, config as unknown as ConfigService<never, true>);

  it('agrega el remitente configurado y delega en el driver', async () => {
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    await service.sendLayout('ana@example.com', 'Hola', { title: 'Hola', paragraphs: ['Texto'] });
    expect(driver.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'EIA <no-reply@example.com>',
        to: 'ana@example.com',
        subject: 'Hola',
        html: expect.stringContaining('<h1'),
        text: expect.stringContaining('Texto'),
      }),
    );
  });

  it('rechaza mensajes sin contenido', async () => {
    await expect(service.send({ to: 'a@b.c', subject: 'x' })).rejects.toThrow();
  });

  it('la plantilla escapa HTML', () => {
    const { html } = renderEmail({ title: '<script>', paragraphs: ['a & b'] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('a &amp; b');
  });
});

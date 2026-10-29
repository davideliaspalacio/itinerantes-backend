import { Module } from '@nestjs/common';
import { AdminContactController } from './admin-contact.controller';
import { AdminContactService } from './admin-contact.service';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

/** Contacto (HU-38 / HU-01): formulario público y bandeja del panel (`/admin/contact-messages`). */
@Module({
  controllers: [ContactController, AdminContactController],
  providers: [ContactService, AdminContactService],
})
export class ContactModule {}

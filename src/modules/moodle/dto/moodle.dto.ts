import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { FormationCardDto } from '../../enrollments/dto/enrollments.response.dto';

export class RedeemMoodleCodeRequestDto {
  @ApiProperty({
    example: 'K7QM-3XPA',
    description: 'Código XXXX-XXXX que entregó el equipo (mayúsculas/espacios y guion opcionales).',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  code!: string;
}

/** Resultado de "¿No ves tu formación?" (HU-25). */
export class MoodleLinkResultDto {
  @ApiProperty({
    example: true,
    description:
      'false → "No encontramos una inscripción asociada a tu correo": ofrece código de acceso o ' +
      'contacto con la Escuela (correo y WhatsApp).',
  })
  found!: boolean;

  @ApiProperty({
    type: [FormationCardDto],
    description:
      'Formaciones vinculadas AHORA (banner de éxito descartable). Las ya vinculadas antes no se ' +
      'repiten; aparecen en Mi formación con `origin = MOODLE` ("Vía Moodle").',
  })
  linked!: FormationCardDto[];
}

/** Fase 06 (HU-27): resultado de cargar la lista de correos de una oferta Moodle. */
export interface MoodleRosterImportResult {
  added: number;
  duplicates: number;
  invalid: string[];
  /** Personas ya registradas que quedaron vinculadas al cargar la lista. */
  linkedUsers: number;
}

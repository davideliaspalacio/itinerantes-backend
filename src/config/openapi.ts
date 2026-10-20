import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { APP_VERSION } from '../app.version';
import { ErrorDetailDto, ErrorResponseDto } from '../common/dto/error-response.dto';
import { PaginationMetaDto } from '../common/dto/pagination.dto';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = '/docs';
export const OPENAPI_JSON_PATH = '/docs/openapi.json';
export const BEARER_AUTH_NAME = 'bearer';

const DESCRIPTION = `
API REST de la plataforma eLearning **Escuela Itinerante del Agua** (sitio público, portal del participante y panel administrativo).

## Autenticación
Las rutas son **protegidas por defecto**. Envía el token de acceso en el header
\`Authorization: Bearer <accessToken>\`. El token se obtiene con \`POST /api/v1/auth/login\` y se renueva con
\`POST /api/v1/auth/refresh\` (Fase 01). Las rutas públicas se indican en cada operación (sin candado).

## Formato de error (único en toda la API)
\`\`\`json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Los datos enviados no son válidos.",
  "details": [{ "field": "email", "code": "IS_EMAIL", "message": "Debe ser un correo electrónico válido." }],
  "requestId": "3f1c2a9e-5b7d-4c1e-9f0a-2d8b6e4c1a7f"
}
\`\`\`
- Usa \`code\` (estable) para decidir qué mostrar; \`message\` es un texto en español apto para mostrar.
- \`details\` (opcional) trae errores por campo para pintar en el formulario.
- \`requestId\` también llega en el header \`X-Request-Id\`; inclúyelo al reportar un problema.
- Códigos HTTP: 400 validación, 401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto,
  422 regla de negocio, 429 demasiadas solicitudes, 5xx error del servidor.

## Paginación
Los listados aceptan \`?page=1&pageSize=20\` (máx. 100) y responden
\`{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 } }\`.
Un recurso individual se devuelve como objeto plano.

## Fechas
Todas las fechas son **ISO 8601 en UTC** (\`2026-11-07T16:00:00.000Z\`). El frontend las convierte a la zona
del usuario. La hora oficial de las actividades es \`America/Mexico_City\` (CDMX, UTC−6).

## Dinero
Montos en **centavos enteros** con su moneda: \`{ "amountCents": 1020000, "currency": "MXN" }\` = $10,200.00 MXN.
Monedas: \`MXN\` y \`USD\` (nunca se suman ni convierten).

## Enums
Valores en inglés \`SCREAMING_SNAKE_CASE\` (p. ej. \`PENDING_PAYMENT\`). Las guías en \`docs/frontend/\` incluyen la
tabla enum → texto en español.

## Rate limiting
Límite global por IP; endpoints sensibles (login, OTP, contacto) tienen límites más estrictos. Al excederlo: \`429\`
con \`code: "RATE_LIMITED"\`.
`.trim();

export interface OpenApiOptions {
  /** URL base del servidor que aparece en la documentación. */
  serverUrl?: string;
}

/** Configuración base del documento OpenAPI (sin paths). Reutilizada por main.ts y scripts/export-openapi.ts. */
export function buildOpenApiConfig(options: OpenApiOptions = {}): Omit<OpenAPIObject, 'paths'> {
  const builder = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Escuela Itinerante del Agua — API')
    .setDescription(DESCRIPTION)
    .setVersion(APP_VERSION)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token de acceso obtenido en POST /api/v1/auth/login.',
      },
      BEARER_AUTH_NAME,
    )
    // Por defecto todo requiere auth; las rutas @Public() lo anulan con security: [].
    .addSecurityRequirements(BEARER_AUTH_NAME);

  if (options.serverUrl) {
    builder.addServer(options.serverUrl);
  }
  return builder.build();
}

/** Genera el documento OpenAPI completo a partir de una app (no requiere que esté escuchando). */
export function createOpenApiDocument(
  app: INestApplication,
  options: OpenApiOptions = {},
): OpenAPIObject {
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig(options), {
    extraModels: [ErrorResponseDto, ErrorDetailDto, PaginationMetaDto],
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
  return document;
}

import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { ERROR_CODES, ErrorCode } from '../errors/error-codes';

/**
 * Documenta en OpenAPI las respuestas de error posibles de un endpoint, agrupadas por status,
 * con un ejemplo por código. Todos usan el esquema `ErrorResponseDto`.
 *
 * Los códigos genéricos que aplican a casi todo (`VALIDATION_ERROR`, `RATE_LIMITED`,
 * `INTERNAL_ERROR`, `UNAUTHORIZED`) conviene listarlos explícitamente cuando el endpoint los
 * produce, para que el frontend sepa qué manejar.
 *
 * @example
 * @ApiErrorResponses('VALIDATION_ERROR', 'AUTH_EMAIL_ALREADY_REGISTERED', 'RATE_LIMITED')
 */
export function ApiErrorResponses(...codes: ErrorCode[]): MethodDecorator & ClassDecorator {
  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of codes) {
    const status = ERROR_CODES[code].status;
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }

  const decorators = [...byStatus.entries()].map(([status, statusCodes]) =>
    ApiResponse({
      status,
      description: `Error. \`code\` posibles: ${statusCodes.map((c) => `\`${c}\``).join(', ')}`,
      content: {
        'application/json': {
          schema: { $ref: getSchemaPath(ErrorResponseDto) },
          examples: Object.fromEntries(
            statusCodes.map((code) => [
              code,
              {
                summary: code,
                value: {
                  statusCode: status,
                  code,
                  message: ERROR_CODES[code].message,
                  ...(code === 'VALIDATION_ERROR'
                    ? {
                        details: [
                          {
                            field: 'email',
                            code: 'IS_EMAIL',
                            message: 'Debe ser un correo electrónico válido.',
                          },
                        ],
                      }
                    : {}),
                  requestId: '3f1c2a9e-5b7d-4c1e-9f0a-2d8b6e4c1a7f',
                },
              },
            ]),
          ),
        },
      },
    }),
  );

  return applyDecorators(ApiExtraModels(ErrorResponseDto), ...decorators);
}

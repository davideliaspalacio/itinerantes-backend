/**
 * `fetch` global simulado para las pruebas UNITARIAS de los proveedores de reuniones
 * (src/infra/meetings/*.spec.ts): nunca se llama a Zoom ni a Google de verdad.
 */

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export interface FakeResponse {
  status: number;
  body?: unknown;
}

function toResponse({ status, body }: FakeResponse): Response {
  const text = status === 204 || body === undefined ? null : JSON.stringify(body);
  return new Response(text, { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Reemplaza `globalThis.fetch`. `route(call)` decide la respuesta (o un `Error` para simular un fallo
 * de red / timeout). Devuelve las llamadas registradas y `restore()`.
 */
export function mockFetch(route: (call: RecordedCall) => FakeResponse | Error): {
  calls: RecordedCall[];
  restore: () => void;
} {
  const original = globalThis.fetch;
  const calls: RecordedCall[] = [];
  const fake = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const call: RecordedCall = {
      url: input instanceof Request ? input.url : String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? init.body : undefined,
    };
    calls.push(call);
    const result = route(call);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(toResponse(result));
  };
  globalThis.fetch = fake;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/** Error como el que lanza `fetch` cuando vence `AbortSignal.timeout`. */
export function timeoutError(): Error {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
}

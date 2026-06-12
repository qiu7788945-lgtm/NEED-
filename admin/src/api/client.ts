export const apiBaseUrl = 'http://localhost:4000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

export interface AdminApiErrorOptions {
  fallbackMessage?: string;
  friendlyErrorMessages?: Record<string, string>;
  notifyOnUnauthorized?: boolean;
}

interface AdminRequestOptions extends Omit<RequestInit, 'body' | 'credentials' | 'method'> {
  method?: HttpMethod;
  body?: unknown;
}

let unauthorizedHandler: (() => void) | null = null;

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function isUnauthorizedError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError && error.status === 401;
}

function buildApiUrl(path: string) {
  if (path.startsWith('http')) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

function isRawBody(body: unknown): body is BodyInit {
  return (
    typeof body === 'string'
    || body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof Blob
    || body instanceof ArrayBuffer
  );
}

async function parseResponse<TData>(response: Response): Promise<ApiResponse<TData>> {
  const text = await response.text();

  if (!text) {
    return {
      ok: response.ok,
      message: response.statusText || 'OK',
    };
  }

  try {
    return JSON.parse(text) as ApiResponse<TData>;
  } catch {
    return {
      ok: false,
      message: response.statusText || 'Request failed',
    };
  }
}

function getErrorMessage<TData>(body: ApiResponse<TData>, options: AdminApiErrorOptions) {
  if (body.code && options.friendlyErrorMessages?.[body.code]) {
    return options.friendlyErrorMessages[body.code];
  }

  return body.message || options.fallbackMessage || '请求失败，请稍后再试。';
}

export async function requestJson<TData>(
  path: string,
  options: AdminRequestOptions = {},
  errorOptions: AdminApiErrorOptions = {},
): Promise<TData> {
  const { body, headers: inputHeaders, ...requestOptions } = options;
  const headers = new Headers(inputHeaders);
  let requestBody: BodyInit | undefined;

  if (body !== undefined) {
    if (isRawBody(body)) {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...requestOptions,
    credentials: 'include',
    headers,
    body: requestBody,
  });
  const responseBody = await parseResponse<TData>(response);

  if (response.status === 401 && errorOptions.notifyOnUnauthorized !== false) {
    unauthorizedHandler?.();
  }

  if (!response.ok || !responseBody.ok) {
    throw new AdminApiError(
      getErrorMessage(responseBody, errorOptions),
      response.status,
      responseBody.code,
    );
  }

  if (!('data' in responseBody)) {
    throw new AdminApiError(
      getErrorMessage(responseBody, errorOptions),
      response.status,
      responseBody.code,
    );
  }

  return responseBody.data as TData;
}

export function getJson<TData>(path: string, errorOptions?: AdminApiErrorOptions) {
  return requestJson<TData>(path, { method: 'GET' }, errorOptions);
}

export function postJson<TData>(path: string, body?: unknown, errorOptions?: AdminApiErrorOptions) {
  return requestJson<TData>(path, { method: 'POST', body }, errorOptions);
}

export function putJson<TData>(path: string, body?: unknown, errorOptions?: AdminApiErrorOptions) {
  return requestJson<TData>(path, { method: 'PUT', body }, errorOptions);
}

export function patchJson<TData>(path: string, body?: unknown, errorOptions?: AdminApiErrorOptions) {
  return requestJson<TData>(path, { method: 'PATCH', body }, errorOptions);
}

export function deleteJson<TData>(path: string, body?: unknown, errorOptions?: AdminApiErrorOptions) {
  return requestJson<TData>(path, { method: 'DELETE', body }, errorOptions);
}

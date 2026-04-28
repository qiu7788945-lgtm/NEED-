export interface ApiResponse<TData = unknown> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
  details?: unknown;
}

export function success<TData>(data: TData, message = 'OK'): ApiResponse<TData> {
  return {
    ok: true,
    message,
    data,
  };
}

export function fail(message: string, code = 'ERROR', details?: unknown): ApiResponse {
  return {
    ok: false,
    message,
    code,
    details,
  };
}

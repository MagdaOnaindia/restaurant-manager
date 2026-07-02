const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly errors?: FieldError[],
  ) {
    super(message);
  }
}

async function rawRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = "Ha ocurrido un error";
  let code: string | undefined;
  let errors: FieldError[] | undefined;
  try {
    const body = await res.json();
    message = body.message ?? message;
    code = body.code;
    errors = body.errors;
  } catch {
    /* respuesta sin JSON */
  }
  return new ApiError(res.status, message, code, errors);
}

/**
 * Llama a la API con cookies. Si el access token ha caducado (401),
 * intenta renovar la sesión una vez con el refresh token y reintenta.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await rawRequest(path, init);
  if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
    const refreshed = await rawRequest("/auth/refresh", { method: "POST" });
    if (refreshed.ok) {
      res = await rawRequest(path, init);
    }
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export const apiPut = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });

export const apiGet = <T>(path: string) => api<T>(path);

export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });

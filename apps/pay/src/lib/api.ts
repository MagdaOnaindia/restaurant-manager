export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let message = "Ha ocurrido un error";
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      /* sin JSON */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => req<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

/** Identificador anónimo y estable de este comensal en este dispositivo. */
export function getSessionId(): string {
  const KEY = "rms.pay.session";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `s-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

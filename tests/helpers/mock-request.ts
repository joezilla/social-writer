import { NextRequest } from "next/server";

const BASE_URL = "http://localhost:3000";

export function createRequest(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const init: Record<string, unknown> = { method, headers: { ...headers } };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(url, init as any);
}

export async function parseResponse(res: Response) {
  const status = res.status;
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status, body: body as Record<string, unknown> };
}

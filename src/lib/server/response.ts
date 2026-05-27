export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const status = init?.status ?? 200;
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(body), {
    ...init,
    status,
    headers,
  });
}

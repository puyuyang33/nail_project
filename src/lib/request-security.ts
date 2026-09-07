import "server-only";

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function rejectUntrustedOrigin(request: Request) {
  return hasTrustedOrigin(request)
    ? null
    : Response.json({ error: "Invalid request origin." }, { status: 403 });
}

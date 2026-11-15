// Next puede normalizar 127.0.0.1 a localhost en nextUrl. Host conserva el
// destino de la petición; nunca se toma un dominio de X-Forwarded-Host.
export function mismoOrigen(req: {
  headers: Headers;
  nextUrl: { protocol: string };
}) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (
      url.origin === origin &&
      url.protocol === req.nextUrl.protocol &&
      url.host.toLowerCase() === host.toLowerCase()
    );
  } catch {
    return false;
  }
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const recurso = request.nextUrl.pathname;
  if (
    recurso === "/manifest.webmanifest" ||
    recurso.startsWith("/icons/") ||
    recurso === "/logo-alexmar-sin-telefono.png" ||
    recurso.startsWith("/vehiculos/")
  )
    return response;
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await db.auth.getUser();
  const ruta = request.nextUrl.pathname;
  const publica =
    ruta === "/" ||
    ruta === "/bloqueado" ||
    ruta === "/manifest.webmanifest" ||
    ruta.startsWith("/icons/") ||
    ruta === "/logo-alexmar-sin-telefono.png" ||
    ruta.startsWith("/vehiculos/");
  function terminar(r: NextResponse) {
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    r.headers.set("Cache-Control", "private, no-store");
    return r;
  }
  if (!user && !publica && !ruta.startsWith("/api/"))
    return terminar(NextResponse.redirect(new URL("/", request.url)));
  if (user && !publica && ruta !== "/api/acceso/estado") {
    const { data: perfil, error } = await db.rpc("mi_perfil");
    if (error)
      return terminar(
        NextResponse.json(
          { error: "No se pudo verificar el permiso." },
          { status: 503 },
        ),
      );
    const api = ruta.startsWith("/api/");
    if (!perfil) {
      if (api)
        return terminar(
          NextResponse.json({ error: "Perfil inactivo." }, { status: 403 }),
        );
      return terminar(
        NextResponse.redirect(new URL("/?error=sin-perfil", request.url)),
      );
    }
    if (ruta !== "/api/acceso/estado") {
      if (perfil.bloqueado) {
        if (api)
          return terminar(
            NextResponse.json(
              { error: "Acceso general bloqueado." },
              { status: 403 },
            ),
          );
        return terminar(
          NextResponse.redirect(new URL("/bloqueado", request.url)),
        );
      }
      if (perfil.rol !== "administrador" && ruta !== "/consulta") {
        if (api)
          return terminar(
            NextResponse.json(
              { error: "Solo puedes consultar precios." },
              { status: 403 },
            ),
          );
        return terminar(
          NextResponse.redirect(new URL("/consulta", request.url)),
        );
      }
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export function configurado() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
export async function conexion() {
  if (!configurado())
    throw new Error(
      "Falta conectar el Supabase nuevo. Revisa las variables de entorno.",
    );
  const almacen = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (entradas) => {
          try {
            entradas.forEach(({ name, value, options }) =>
              almacen.set(name, value, options),
            );
          } catch {
            /* El proxy actualiza cookies desde componentes de servidor. */
          }
        },
      },
    },
  );
}
export async function sesion() {
  const db = await conexion();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/");
  const { data: perfil, error: fallo } = await db.rpc("mi_perfil");
  if (fallo)
    throw new Error(
      "No se pudo verificar el acceso. Aplica la migración del proyecto nuevo.",
    );
  if (!perfil) redirect("/?error=sin-perfil");
  return {
    db,
    perfil: perfil as { id: string; nombre: string; rol: string },
    user,
  };
}
export async function consultar<T>(
  nombre: string,
  parametros: Record<string, unknown> = {},
): Promise<T> {
  const { db } = await sesion();
  const { data, error } = await db.rpc(nombre, parametros);
  if (error) throw new Error(error.message);
  return data as T;
}

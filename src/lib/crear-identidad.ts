import "server-only";
import { createClient } from "@supabase/supabase-js";
export function gestionIdentidadesDisponible() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}
export function gestionIdentidades() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Falta habilitar la creación de usuarios en el servidor.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.admin;
}

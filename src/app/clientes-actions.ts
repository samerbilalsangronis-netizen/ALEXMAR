"use server";
import { sesion } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function crearClienteCredito(f: FormData) {
  let id = "";
  try {
    const { db, perfil } = await sesion();
    if (perfil.rol !== "administrador")
      throw new Error("Solo Administrativo puede crear cuentas.");
    if (!/^[a-f0-9-]{36}$/i.test(String(f.get("id") || "")))
      throw new Error("Identificador de cuenta inválido.");
    const nombre = String(f.get("nombre") || "").trim();
    if (nombre.length < 2 || nombre.length > 200)
      throw new Error("Indica un nombre de 2 a 200 caracteres.");
    const { data, error } = await db.rpc("guardar_cliente", {
      p: {
        id: String(f.get("id") || ""),
        nombre,
        documento: String(f.get("documento") || ""),
        telefono: String(f.get("telefono") || ""),
        direccion: String(f.get("direccion") || ""),
      },
    });
    if (error) throw new Error(error.message);
    id = data;
    revalidatePath("/clientes");
  } catch (e) {
    redirect(
      "/clientes/nuevo?error=" +
        encodeURIComponent(
          e instanceof Error ? e.message : "No se pudo crear la cuenta.",
        ),
    );
  }
  redirect("/clientes/" + id + "?accion=cargo");
}

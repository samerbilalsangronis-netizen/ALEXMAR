"use server";
import { sesion } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function anularCompra(f: FormData) {
  const id = String(f.get("id") || ""),
    proveedor = String(f.get("proveedor") || "");
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^[a-f0-9-]{36}$/i.test(proveedor))
    throw new Error("Comprobante inválido.");
  const ruta = "/proveedores/" + proveedor + "/recepciones/" + id;
  try {
    const { db, perfil } = await sesion();
    if (perfil.rol !== "administrador")
      throw new Error("Solo el administrador puede anular.");
    if (f.get("revisado") !== "on")
      throw new Error("Confirma la revisión antes de anular.");
    const { data: compra, error: lectura } = await db.rpc("ficha_compra", {
      p_id: id,
    });
    if (lectura) throw new Error(lectura.message);
    if (!compra || compra.proveedor_id !== proveedor)
      throw new Error("Compra no encontrada.");
    const { error } = await db.rpc("anular_compra", {
      p_id: id,
      p_motivo: String(f.get("motivo") || ""),
    });
    if (error) throw new Error(error.message);
    for (const p of [
      ruta,
      "/proveedores/" + proveedor,
      "/inventario",
      "/panel",
      "/reportes",
    ])
      revalidatePath(p);
  } catch (e) {
    redirect(
      ruta +
        "?error=" +
        encodeURIComponent(
          e instanceof Error ? e.message : "No se pudo anular.",
        ),
    );
  }
  redirect(ruta + "?guardado=1");
}

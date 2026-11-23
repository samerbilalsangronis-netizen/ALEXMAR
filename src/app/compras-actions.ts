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
    const { error } = await db.rpc("anular_orden_compra", {
      p_id: id,
      p_version: Number(f.get("version")),
      p_revisado: f.get("revisado") === "on",
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

export type ResultadoCorreccionCompra = { error?: string; guardado?: boolean };
async function corregirCompra(
  f: FormData,
  tipo: "orden" | "abono",
): Promise<ResultadoCorreccionCompra> {
  try {
    const { db, perfil } = await sesion();
    if (perfil.rol !== "administrador")
      throw new Error("Solo el administrador puede corregir órdenes y abonos.");
    const id = String(f.get("compra_id") || ""),
      proveedor = String(f.get("proveedor") || ""),
      version = String(f.get("version") || "");
    if (
      !/^[a-f0-9-]{36}$/i.test(id) ||
      !/^[a-f0-9-]{36}$/i.test(proveedor) ||
      !/^[1-9][0-9]{0,9}$/.test(version)
    )
      throw new Error("Orden o versión inválida. Recarga el comprobante.");
    const { data: doc, error: lectura } = await db.rpc("ficha_compra", {
      p_id: id,
    });
    if (lectura) throw new Error(lectura.message);
    if (!doc || doc.proveedor_id !== proveedor)
      throw new Error("Orden no encontrada.");
    const decimal = (valor: FormDataEntryValue | null) =>
      String(valor || "")
        .trim()
        .replace(",", ".");
    const comun = {
      version: Number(version),
      motivo: String(f.get("motivo") || ""),
    };
    const { error } =
      tipo === "orden"
        ? await db.rpc("editar_compra", {
            p: {
              ...comun,
              id,
              referencia: String(f.get("referencia") || ""),
              observaciones: String(f.get("observaciones") || ""),
              lineas: f
                .getAll("linea_id")
                .map((linea) => ({
                  id: String(linea),
                  cantidad: decimal(f.get("cantidad_" + linea)),
                  costo_unitario: decimal(f.get("costo_" + linea)),
                })),
            },
          })
        : await db.rpc("corregir_pago_compra", {
            p: {
              ...comun,
              compra_id: id,
              id: String(f.get("pago_id") || ""),
              accion: String(f.get("accion") || ""),
              monto: decimal(f.get("monto")),
              metodo: String(f.get("metodo") || ""),
              referencia: String(f.get("referencia") || ""),
              revisado: f.get("revisado") === "on",
            },
          });
    if (error) {
      if (["PGRST202", "42883"].includes(error.code))
        throw new Error(
          "Activa el SQL 014 en Supabase para corregir órdenes y abonos.",
        );
      throw new Error(error.message);
    }
    for (const ruta of [
      "/proveedores",
      "/proveedores/" + proveedor,
      "/proveedores/" + proveedor + "/recepciones/" + id,
      "/inventario",
      "/consulta",
      "/panel",
      "/reportes",
    ])
      revalidatePath(ruta);
    return { guardado: true };
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "No se pudo guardar la corrección.",
    };
  }
}
export async function editarOrdenCompra(
  _: ResultadoCorreccionCompra,
  f: FormData,
) {
  return corregirCompra(f, "orden");
}
export async function corregirAbonoCompra(
  _: ResultadoCorreccionCompra,
  f: FormData,
) {
  return corregirCompra(f, "abono");
}

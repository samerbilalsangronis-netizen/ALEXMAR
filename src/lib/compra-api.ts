import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { conexion } from "./supabase";
import { mismoOrigen } from "./origen";
export async function escribirCompra(
  req: NextRequest,
  accion: "recibir" | "pagar" | "precio",
) {
  try {
    if (!mismoOrigen(req))
      return NextResponse.json(
        { error: "Origen no autorizado." },
        { status: 403 },
      );
    const db = await conexion();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const { data: perfil, error: fallo } = await db.rpc("mi_perfil");
    if (
      fallo ||
      !(
        accion === "pagar" ? ["administrador"] : ["administrador", "inventario"]
      ).includes(perfil?.rol)
    )
      return NextResponse.json(
        { error: "No tienes permiso para esta operación." },
        { status: 403 },
      );
    if (
      Number(req.headers.get("content-length") || 0) >
      (accion === "recibir" ? 3200000 : 200000)
    )
      return NextResponse.json(
        { error: "La solicitud supera el tamaño permitido." },
        { status: 413 },
      );
    const texto = await req.text();
    if (
      new TextEncoder().encode(texto).length >
      (accion === "recibir" ? 3200000 : 200000)
    )
      throw new Error("La solicitud supera el tamaño permitido.");
    const p = JSON.parse(texto);
    const { data, error } = await db.rpc(
      {
        recibir: p.foto ? "recibir_compra_con_foto" : "recibir_compra",
        pagar: "pagar_compra",
        precio: "asignar_precio_venta",
      }[accion],
      { p },
    );
    if (
      error?.code === "23505" &&
      error.message.includes("compra_referencia_proveedor")
    )
      throw new Error(
        "Ya existe una recepción con esa referencia para este proveedor. Revisa sus comprobantes antes de repetirla.",
      );
    if (error)
      throw new Error(
        ["PGRST202", "42883", "42P01"].includes(error.code)
          ? p.foto
            ? "Aplica el SQL 020 para guardar fotos de facturas."
            : "Falta activar compras y recepciones con SQL 010."
          : error.message,
      );
    return NextResponse.json({ id: data });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo registrar la operación.",
      },
      { status: 400 },
    );
  }
}

import { mismoOrigen } from "@/lib/origen";
import { NextRequest, NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
export async function POST(req: NextRequest) {
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
    if (fallo || !["administrador"].includes(perfil?.rol))
      return NextResponse.json(
        { error: "No tienes permiso para facturar." },
        { status: 403 },
      );
    const texto = await req.text();
    if (new TextEncoder().encode(texto).length > 200000)
      throw new Error("La venta supera el tamaño permitido.");
    const p = JSON.parse(texto);
    const { data, error } = await db.rpc("emitir_factura_rapida", { p });
    if (error) {
      if (error.code === "PGRST202")
        throw new Error(
          "Falta activar la actualización de facturación (SQL 018) en el proyecto nuevo.",
        );
      throw new Error(error.message);
    }
    return NextResponse.json({ id: data });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo guardar el borrador.",
      },
      { status: 400 },
    );
  }
}

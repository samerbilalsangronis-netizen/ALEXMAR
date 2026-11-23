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
    if (new TextEncoder().encode(texto).length > 10000)
      throw new Error("El producto supera el tamaño permitido.");
    const entrada = JSON.parse(texto);
    const { data, error } = await db.rpc("vincular_producto_pendiente", {
      p_linea: entrada.linea,
      p_variante: entrada.variante,
    });
    if (error) {
      if (["PGRST202", "42883"].includes(error.code))
        throw new Error(
          "Aplica el SQL 018 para completar productos pendientes.",
        );
      throw new Error(error.message);
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "No se pudo crear el producto.",
      },
      { status: 400 },
    );
  }
}

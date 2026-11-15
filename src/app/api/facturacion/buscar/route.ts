import { NextRequest, NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
import { pagina } from "@/lib/formatos";
export async function GET(req: NextRequest) {
  try {
    const db = await conexion();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const { data: perfil, error: fallo } = await db.rpc("mi_perfil");
    if (fallo || !["administrador", "ventas"].includes(perfil?.rol))
      return NextResponse.json(
        { error: "No tienes permiso para facturar." },
        { status: 403 },
      );
    const p = req.nextUrl.searchParams;
    const tipo = p.get("tipo");
    if (!["productos", "clientes"].includes(tipo || ""))
      throw new Error("Búsqueda inválida.");
    const { data, error } = await db.rpc(
      tipo === "productos" ? "buscar_productos" : "buscar_clientes",
      {
        p: {
          q: (p.get("q") || "").slice(0, 200),
          pagina: pagina(p.get("pagina")),
          estado: "activos",
        },
      },
    );
    if (error) throw new Error(error.message);
    const filas =
      tipo === "productos"
        ? data.filas.map((a: Record<string, unknown>) => ({
            id: a.id,
            variante_id: a.variante_id,
            nombre: a.nombre,
            precio: a.precio,
            disponible: a.disponible,
          }))
        : data.filas.map((c: Record<string, unknown>) => ({
            id: c.id,
            nombre: c.nombre,
            documento: c.documento,
          }));
    return NextResponse.json(
      { ...data, filas },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo buscar." },
      { status: 400 },
    );
  }
}

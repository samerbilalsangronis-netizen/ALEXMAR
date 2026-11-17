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
    if (fallo || !["administrador", "inventario"].includes(perfil?.rol))
      return NextResponse.json(
        { error: "No tienes permiso para registrar compras." },
        { status: 403 },
      );
    const p = req.nextUrl.searchParams;
    const { data, error } = await db.rpc("buscar_productos", {
      p: {
        q: (p.get("q") || "").slice(0, 200),
        pagina: pagina(p.get("pagina")),
        estado: "activos",
      },
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(
      {
        filas: data.filas.map((a: Record<string, unknown>) => ({
          id: a.id,
          variante_id: a.variante_id,
          nombre: a.nombre,
          costo: a.costo,
          precio: a.precio,
          disponible: a.disponible,
          referencia: a.referencia,
        })),
        total: data.total,
        paginas: data.paginas,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo buscar." },
      { status: 400 },
    );
  }
}

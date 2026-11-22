import { NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
import { documentoFactura, estiloFactura } from "@/lib/documento-factura";
import { type Venta } from "@/lib/ventas";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Documento inválido.");
    const db = await conexion();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const { data: perfil, error: fallo } = await db.rpc("mi_perfil");
    if (fallo || !["administrador", "ventas"].includes(perfil?.rol))
      return NextResponse.json(
        { error: "No tienes permiso para imprimir facturas." },
        { status: 403 },
      );
    const { data, error } = await db.rpc("ficha_venta", { p_id: id });
    if (error) throw new Error(error.message);
    if (!data)
      return NextResponse.json(
        { error: "Documento no encontrado." },
        { status: 404 },
      );
    const v = data as Venta;
    const body = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Factura ALEXMAR</title><style>body{margin:24px;background:#edf0f3}button{padding:12px;margin:20px;cursor:pointer}@media print{body{margin:0;background:white}}${estiloFactura}</style></head><body><button class="no-imprimir" onclick="window.print()">Imprimir / Guardar PDF</button>${documentoFactura(v)}</body></html>`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo imprimir." },
      { status: 400 },
    );
  }
}

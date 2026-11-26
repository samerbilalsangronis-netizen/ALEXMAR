import { NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = await conexion(),
    {
      data: { user },
    } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const { data: perfil, error: fallo } = await db.rpc("mi_perfil");
  if (fallo || perfil?.rol !== "administrador")
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id))
    return new NextResponse(null, { status: 404 });
  const { data, error } = await db.rpc("leer_foto_compra", { p_id: id });
  if (error)
    return NextResponse.json(
      { error: "No se pudo consultar la foto." },
      { status: 400 },
    );
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(data.base64, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="factura-proveedor.jpg"',
    },
  });
}

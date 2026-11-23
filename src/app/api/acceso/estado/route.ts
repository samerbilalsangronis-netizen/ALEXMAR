import { NextResponse } from "next/server";
import { tipoAcceso } from "@/lib/accesos";
import { conexion } from "@/lib/supabase";
export async function GET() {
  try {
    const db = await conexion();
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    if (error || !user)
      return NextResponse.json(
        { activo: false },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    const { data, error: fallo } = await db.rpc("mi_perfil");
    if (fallo)
      return NextResponse.json(
        { error: "No se pudo verificar el acceso." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    return NextResponse.json(
      { activo: Boolean(data), bloqueado: Boolean(data?.bloqueado) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo verificar el acceso." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

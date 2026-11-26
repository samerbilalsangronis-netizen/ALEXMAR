import { NextRequest, NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
import { pagina } from "@/lib/formatos";
export async function GET(req: NextRequest) {
  const db = await conexion(),
    {
      data: { user },
    } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const { data: perfil, error: fallo } = await db.rpc("mi_perfil");
  if (fallo || perfil?.rol !== "administrador")
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  const p = req.nextUrl.searchParams,
    tipo = p.get("tipo"),
    id = p.get("id");
  if (
    !["cuenta", "factura", "historico"].includes(tipo || "") ||
    !/^[a-f0-9-]{36}$/i.test(id || "")
  )
    return NextResponse.json({ error: "Abono inválido." }, { status: 400 });
  const { data, error } = await db.rpc("historial_correcciones_abono", {
    p_tipo: tipo,
    p_id: id,
    p_pagina: pagina(p.get("pagina")),
  });
  if (error)
    return NextResponse.json(
      { error: "No se pudo consultar el historial. Verifica SQL 021." },
      { status: 400 },
    );
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

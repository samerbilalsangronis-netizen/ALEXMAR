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
    if (fallo || !["administrador", "ventas"].includes(perfil?.rol))
      return NextResponse.json(
        { error: "No tienes permiso para facturar." },
        { status: 403 },
      );
    const texto = await req.text();
    if (new TextEncoder().encode(texto).length > 200000)
      throw new Error("La venta supera el tamaño permitido.");
    const entrada = JSON.parse(texto);
    if (
      typeof entrada.nombre !== "string" ||
      entrada.nombre.trim().length < 2 ||
      entrada.nombre.length > 200
    )
      throw new Error("Escribe el nombre del cliente (2–200 caracteres).");
    if (!/^[a-f0-9-]{36}$/i.test(entrada.id))
      throw new Error("Identificador inválido.");
    const p = {
      id: entrada.id,
      nombre: entrada.nombre.trim(),
      documento: String(entrada.documento || "")
        .trim()
        .slice(0, 80),
      telefono: String(entrada.telefono || "")
        .trim()
        .slice(0, 80),
      direccion: String(entrada.direccion || "")
        .trim()
        .slice(0, 500),
    };
    const { data, error } = await db.rpc("guardar_cliente", { p });
    if (error) {
      if (error.code === "PGRST202")
        throw new Error(
          "Falta activar la actualización de facturación (SQL 011) en el proyecto nuevo.",
        );
      throw new Error(error.message);
    }
    return NextResponse.json({
      id: data,
      nombre: p.nombre,
      documento: p.documento,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo registrar el cliente.",
      },
      { status: 400 },
    );
  }
}

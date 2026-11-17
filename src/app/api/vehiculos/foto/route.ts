import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { conexion } from "@/lib/supabase";
import { mismoOrigen } from "@/lib/origen";
import { tipoImagen } from "@/lib/fotos";
export async function POST(req: NextRequest) {
  if (!mismoOrigen(req))
    return NextResponse.json(
      { error: "Origen no autorizado." },
      { status: 403 },
    );
  try {
    const db = await conexion();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const { data: perfil, error: perfilError } = await db.rpc("mi_perfil");
    if (perfilError || perfil?.rol !== "administrador")
      return NextResponse.json(
        { error: "Solo el administrador puede cambiar fotos." },
        { status: 403 },
      );
    if (Number(req.headers.get("content-length") || 0) > 3100000)
      return NextResponse.json(
        { error: "La foto supera 3 MB." },
        { status: 413 },
      );
    const form = await req.formData();
    const f = form.get("foto"),
      nombre = String(form.get("nombre") || "").trim();
    if (
      !nombre ||
      nombre.length > 100 ||
      !(f instanceof File) ||
      f.size > 3000000 ||
      !f.size
    )
      return NextResponse.json(
        {
          error:
            "Selecciona una foto JPG, PNG o WebP de hasta 3 MB y un vehículo válido.",
        },
        { status: 400 },
      );
    const bytes = new Uint8Array(await f.arrayBuffer()),
      tipo = tipoImagen(bytes);
    if (!tipo || f.type !== tipo.mime)
      return NextResponse.json(
        { error: "El archivo debe ser una imagen JPG, PNG o WebP válida." },
        { status: 400 },
      );
    const archivo = `${user.id}/${randomUUID()}.${tipo.extension}`;
    const bucket = db.storage.from("alexmar-vehiculos");
    const { error: subida } = await bucket.upload(archivo, bytes, {
      contentType: tipo.mime,
      upsert: false,
    });
    if (subida)
      throw new Error(
        "No se pudo guardar la imagen. Comprueba que SQL 009 esté instalado y vuelve a intentarlo.",
      );
    const { error } = await db.rpc("guardar_foto_vehiculo", {
      p_nombre: nombre,
      p_archivo: archivo,
    });
    if (error) {
      await bucket.remove([archivo]);
      throw new Error(error.message);
    }
    return NextResponse.json({ guardado: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo guardar la foto." },
      { status: 400 },
    );
  }
}

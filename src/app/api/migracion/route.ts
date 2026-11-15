import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { conexion } from "@/lib/supabase";
import { tablas, leerCSV, analizar, type Datos } from "@/lib/migracion";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
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
    if (fallo || perfil?.rol !== "administrador")
      return NextResponse.json(
        { error: "Solo el administrador puede importar." },
        { status: 403 },
      );
    if (Number(req.headers.get("content-length") || 0) > 12_000_000)
      return NextResponse.json(
        {
          error:
            "Los archivos superan 12 MB. Se necesita un importador por lotes.",
        },
        { status: 413 },
      );
    const form = await req.formData();
    const datos = {} as Datos;
    let bytes = 0;
    for (const t of tablas) {
      const f = form.get(t);
      if (!(f instanceof File)) throw new Error(`Adjunta el CSV de ${t}.`);
      bytes += f.size;
      if (bytes > 12_000_000) throw new Error("El conjunto supera 12 MB.");
      datos[t] = leerCSV(await f.text(), t);
    }
    const informe = analizar(datos);
    const huella = createHash("sha256")
      .update(JSON.stringify(datos))
      .digest("hex");
    if (form.get("accion") !== "confirmar")
      return NextResponse.json({ ...informe, huella });
    if (form.get("huella") !== huella)
      throw new Error("Los archivos cambiaron. Repite la simulación.");
    if (!informe.puedeImportar)
      return NextResponse.json(
        {
          error: "Hay errores de validación pendientes. Importación bloqueada.",
          ...informe,
        },
        { status: 422 },
      );
    const { data, error } = await db.rpc("importar_inicial", {
      p: datos,
      p_huella: huella,
      p_conciliacion: informe.conciliacion,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ importado: true, resultado: data });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "No se pudo procesar la importación.",
      },
      { status: 400 },
    );
  }
}

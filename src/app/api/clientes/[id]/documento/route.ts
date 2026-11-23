import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
import { mismoOrigen } from "@/lib/origen";
import { crearPdfCliente, type DatosPdfCliente } from "@/lib/pdf-cliente";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!mismoOrigen(req))
      return NextResponse.json(
        { error: "Origen no autorizado." },
        { status: 403 },
      );
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/i.test(id))
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    const db = await conexion();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const { data: perfil, error: fallo } = await db.rpc("mi_perfil");
    if (fallo || perfil?.rol !== "administrador")
      return NextResponse.json(
        { error: "Solo Administrativo puede generar documentos." },
        { status: 403 },
      );
    const bruto = await req.text();
    if (bruto.length > 1000) throw new Error("Petición demasiado grande.");
    const p = JSON.parse(bruto || "{}");
    if (p.listar) {
      const { data, error } = await db.rpc("buscar_ventas", {
        p: {
          cliente_id: id,
          estado: "confirmada",
          pagina: Math.max(1, Number(p.pagina) || 1),
        },
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    if (p.revocar) {
      const { error } = await db.rpc("revocar_pdf_compartido", {
        p_id: p.revocar,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ revocado: true });
    }
    const factura = p.factura || null;
    let datos: DatosPdfCliente;
    if (factura) {
      if (!/^[a-f0-9-]{36}$/i.test(factura))
        throw new Error("Factura inválida.");
      const { data, error } = await db.rpc("ficha_venta", { p_id: factura });
      if (error) throw new Error(error.message);
      if (!data || data.cliente_id !== id || data.estado !== "confirmada")
        return NextResponse.json(
          { error: "Factura no disponible para este cliente." },
          { status: 404 },
        );
      datos = {
        tipo: "factura",
        factura: data,
        generado: new Date().toISOString(),
      };
    } else {
      const { data, error } = await db.rpc("documento_cuenta_pdf", {
        p_cliente: id,
      });
      if (error) {
        if (["PGRST202", "42883"].includes(error.code))
          throw new Error(
            "Aplica el SQL 019 para generar y compartir documentos PDF.",
          );
        throw new Error(error.message);
      }
      datos = { tipo: "cuenta", cuenta: data, generado: data.generado };
    }
    const pdf = await crearPdfCliente(datos);
    if (pdf.byteLength > 4194304)
      throw new Error(
        "El documento supera los 4 MB. Utiliza la exportación completa de la cuenta.",
      );
    const token = randomBytes(32).toString("hex"),
      nombre =
        (factura
          ? "factura-" +
            String(datos.tipo === "factura" ? datos.factura.numero : "")
          : "cuenta-" + id) + ".pdf";
    const { data, error } = await db.rpc("guardar_pdf_compartido", {
      p_cliente: id,
      p_factura: factura,
      p_token: token,
      p_nombre: nombre,
      p_base64: Buffer.from(pdf).toString("base64"),
    });
    if (error)
      throw new Error(
        ["PGRST202", "42883"].includes(error.code)
          ? "Aplica el SQL 019 para activar los enlaces PDF."
          : error.message,
      );
    return NextResponse.json(
      {
        id: data.id,
        vence: data.vence,
        nombre,
        ruta: "/compartir/pdf/" + token,
        tipo: datos.tipo,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo generar el PDF." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

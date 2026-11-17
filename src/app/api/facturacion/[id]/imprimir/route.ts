import { NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
import { fecha, monto, cantidad } from "@/lib/formatos";
import { numeroVenta, type Venta } from "@/lib/ventas";
function h(v: unknown) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
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
    const body = `<!doctype html><html lang="es"><meta charset="utf-8"><title>${h(numeroVenta(v))} · ALEXMAR</title><style>body{font:13px Arial;color:#202124;margin:30px;max-width:1000px}header{display:flex;justify-content:space-between;align-items:center}img{width:140px;height:auto}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{padding:10px;text-align:left;border-bottom:1px solid #ddd}tr{break-inside:avoid}.totales{text-align:right}.estado{color:#a33c12}@media print{button{display:none}body{margin:0}}</style><header><img src="/logo-alexmar-sin-telefono.png" alt="Escudería Alexmar"><div><h1>${h(numeroVenta(v))}</h1><p class="estado">${h(v.estado.toUpperCase())}</p><p>${h(fecha(v.emitido || v.creado))} · USD · America/Caracas</p></div></header><h2>${h(v.cliente.nombre)}</h2><p>${h(v.cliente.documento)} · ${h(v.cliente.telefono)}<br>${h(v.cliente.direccion)}</p>${v.vence ? "<p>Vencimiento: " + h(v.vence) + "</p>" : ""}${v.estado === "borrador" ? "<p>Borrador / presupuesto: todavía no registra una venta.</p>" : ""}${v.estado === "anulada" ? "<p>ANULADA · " + h(v.motivo_anulacion) + "</p>" : ""}<table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio USD</th><th>Importe USD</th></tr></thead><tbody>${v.lineas.map((l) => `<tr><td>${h(l.descripcion)}</td><td>${h(cantidad(l.cantidad))}</td><td>${h(monto(l.precio))}</td><td>${h(monto(l.importe))}</td></tr>`).join("")}</tbody></table><section class="totales"><p>Subtotal: ${h(monto(v.subtotal))}</p><p>Descuento: ${h(monto(v.descuento))} · Impuesto: 0</p><h2>Total: ${h(monto(v.total))}</h2><p>Total exacto USD: ${h(v.total)}</p><p>Pago inicial ${!v.emitido ? "previsto" : ""}: ${h(monto(v.abono))} · ${h(v.metodo_pago)}</p></section><p>${h(v.observaciones)}</p><p>Documento comercial · ALEXMAR</p><button onclick="window.print()">Imprimir / Guardar PDF</button></html>`;
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

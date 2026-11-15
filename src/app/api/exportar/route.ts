import { NextRequest, NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
import { fecha, monto } from "@/lib/formatos";
import type { Estado } from "@/app/(privado)/clientes/[id]/page";
function html(s: unknown) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
function celda(s: unknown) {
  let v = String(s ?? "");
  if (/^[=+@\-\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replaceAll('"', '""') + '"';
}
export async function GET(req: NextRequest) {
  try {
    const db = await conexion();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const p = req.nextUrl.searchParams;
    const base = {
      p_id: p.get("id"),
      p_desde: p.get("desde") || null,
      p_hasta: p.get("hasta") || null,
      p_moneda: p.get("moneda") || "USD",
    };
    const filas: Estado["filas"] = [];
    let estado: Estado | undefined;
    for (let i = 1; ; i++) {
      const { data, error } = await db.rpc("estado_cliente", {
        ...base,
        p_pagina: i,
      });
      if (error) throw new Error(error.message);
      const d = data as Estado;
      if (!d.cliente) throw new Error("Cliente no encontrado.");
      estado ??= d;
      filas.push(...d.filas);
      if (i >= d.paginas) break;
      if (d.filas.length === 0)
        throw new Error("La exportación no pudo recuperar todas las páginas.");
    }
    const info = estado!;
    if (filas.length !== info.total)
      throw new Error(
        "Los datos cambiaron durante la exportación. Repite la descarga.",
      );
    const metadatos = [
      ["ALEXMAR · Estado de cuenta", info.cliente!.nombre],
      ["Moneda", info.moneda],
      ["Desde", p.get("desde") || "Inicio"],
      ["Hasta", p.get("hasta") || "Hoy"],
      ["Generado", new Date().toISOString()],
      ["Zona", "America/Caracas"],
      ["Saldo anterior", info.anterior],
      ["Saldo final", info.final],
    ];
    const cabecera = ["Fecha", "Descripción", "Cargo", "Abono", "Saldo"];
    const valores = filas.map((f) => [
      fecha(f.fecha),
      f.descripcion,
      f.tipo === "CARGO" ? f.importe : "",
      f.tipo === "ABONO" ? f.importe : "",
      f.saldo,
    ]);
    if (p.get("formato") === "html") {
      const body = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Estado de cuenta ALEXMAR</title><style>body{font:13px Arial;margin:35px;color:#202a32}table{width:100%;border-collapse:collapse}td,th{padding:9px;text-align:left;border-bottom:1px solid #ddd}th{background:#eee}tr{break-inside:avoid}header{margin-bottom:25px}@media print{button{display:none}body{margin:0}}</style><header><h1>ALEXMAR</h1><h2>${html(info.cliente!.nombre)}</h2><p>${html(info.moneda)} · ${html(p.get("desde") || "Inicio")} — ${html(p.get("hasta") || "Hoy")} · Generado ${html(fecha(new Date().toISOString()))}</p><p>Saldo anterior: ${html(monto(info.anterior, info.moneda))} · Saldo final: ${html(monto(info.final, info.moneda))}</p><button onclick="window.print()">Imprimir / Guardar PDF</button></header><table><thead><tr>${cabecera.map((v) => "<th>" + html(v) + "</th>").join("")}</tr></thead><tbody>${valores.map((r) => "<tr>" + r.map((v) => "<td>" + html(v) + "</td>").join("") + "</tr>").join("")}</tbody></table></html>`;
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        },
      });
    }
    const csv =
      "\uFEFF" +
      [...metadatos, [], cabecera, ...valores]
        .map((r) => r.map(celda).join(","))
        .join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="estado_cuenta.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo exportar." },
      { status: 400 },
    );
  }
}

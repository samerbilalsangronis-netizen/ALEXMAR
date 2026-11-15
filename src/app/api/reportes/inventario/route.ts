import { recuperarReporte } from "@/lib/reportes";
import { NextRequest, NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
import { fecha, type Producto, type Pagina } from "@/lib/formatos";
function celda(v: unknown) {
  let s = String(v ?? "");
  if (/^\s*[=+@\-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
function html(v: unknown) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export async function GET(req: NextRequest) {
  try {
    const db = await conexion();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const { data: perfil, error: fallo } = await db.rpc("mi_perfil");
    if (fallo || !perfil)
      return NextResponse.json(
        { error: "Sin acceso activo." },
        { status: 403 },
      );
    const costos = ["administrador", "inventario"].includes(perfil.rol);
    const p = req.nextUrl.searchParams;
    const filtros = {
      q: p.get("q") || "",
      stock: p.get("stock") || "",
      precio: p.get("precio") || "",
      estado: p.get("estado") || "activos",
    };
    const filas = await recuperarReporte<Producto>(async (pagina) => {
      const { data, error } = await db.rpc("buscar_productos", {
        p: { ...filtros, pagina, orden: "nombre" },
      });
      if (error) throw new Error(error.message);
      return data as Pagina<Producto>;
    });
    const meta = [
      ["ALEXMAR · Inventario completo"],
      ["Generado", fecha(new Date().toISOString()), "America/Caracas"],
      ["Moneda", "USD"],
      ["Búsqueda", filtros.q],
      ["Estado", filtros.estado],
      ["Existencia", filtros.stock || "Todas"],
      ["Precio", filtros.precio || "Todos"],
      ["Registros", filas.length],
    ];
    const cabecera = [
      "Producto",
      "Referencia",
      "Categoría",
      "Marca",
      "Ubicación",
      "Activo",
      "Físico",
      "Reservado",
      "Disponible",
      "Mínimo",
      "Precio USD",
      ...(costos ? ["Costo USD"] : []),
    ];
    const valores = filas.map((a) => [
      a.nombre,
      a.referencia,
      a.categoria,
      a.marca,
      a.ubicacion,
      a.activo ? "Sí" : "No",
      a.fisico,
      a.reservado,
      a.disponible,
      a.minimo,
      a.precio ?? "Pendiente de precio",
      ...(costos ? [a.costo ?? "No disponible"] : []),
    ]);
    if (p.get("formato") === "html")
      return new NextResponse(
        `<!doctype html><html lang="es"><meta charset="utf-8"><title>ALEXMAR · Inventario</title><style>body{font:12px Arial;margin:24px}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}tr{break-inside:avoid}@media print{button{display:none}}</style><h1>ALEXMAR · Inventario</h1>${meta
          .slice(1)
          .map((r) => `<p>${r.map(html).join(" · ")}</p>`)
          .join(
            "",
          )}<button onclick="window.print()">Imprimir / Guardar PDF</button><table><thead><tr>${cabecera.map((c) => `<th>${html(c)}</th>`).join("")}</tr></thead><tbody>${valores.map((r) => `<tr>${r.map((c) => `<td>${html(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></html>`,
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "private, no-store",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
          },
        },
      );
    return new NextResponse(
      "\uFEFF" +
        [...meta, [], cabecera, ...valores]
          .map((r) => r.map(celda).join(","))
          .join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="alexmar_inventario.csv"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo generar el reporte.",
      },
      { status: 400 },
    );
  }
}

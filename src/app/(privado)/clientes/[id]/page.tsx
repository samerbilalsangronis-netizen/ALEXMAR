import Link from "next/link";
import { notFound } from "next/navigation";
import { consultar } from "@/lib/supabase";
import { Pagina, monto, fecha, pagina } from "@/lib/formatos";
import { Cabecera, Paginacion } from "@/components/comunes";
import { Imprimir } from "@/components/imprimir";
import type { Cliente } from "../page";
export type Estado = Pagina<{
  id: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  importe: string;
  saldo: string;
}> & {
  cliente: Cliente | null;
  anterior: string;
  final: string;
  cargos: string;
  abonos: string;
  moneda: string;
};
export default async function Cuenta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const p = await searchParams;
  const d = await consultar<Estado>("estado_cliente", {
    p_id: id,
    p_desde: p.desde || null,
    p_hasta: p.hasta || null,
    p_pagina: pagina(p.pagina),
    p_moneda: ["USD", "VES", "COP"].includes(p.moneda) ? p.moneda : "USD",
  });
  if (!d.cliente) notFound();
  const q = new URLSearchParams({
    id,
    desde: p.desde || "",
    hasta: p.hasta || "",
    moneda: d.moneda,
  });
  return (
    <>
      <Link className="no-imprimir" href="/clientes">
        ← Volver a clientes
      </Link>
      <Cabecera
        titulo={d.cliente.nombre}
        subtitulo={
          "Estado de cuenta · " +
          d.moneda +
          " · " +
          (d.cliente.documento || "Sin documento")
        }
      >
        <div className="acciones">
          <Imprimir />
          <a
            className="boton secundario no-imprimir"
            href={"/api/exportar?" + q}
          >
            Descargar CSV completo
          </a>
        </div>
      </Cabecera>
      <section className="panel no-imprimir">
        <form className="filtros">
          <label>
            Desde
            <input name="desde" type="date" defaultValue={p.desde} />
          </label>
          <label>
            Hasta
            <input name="hasta" type="date" defaultValue={p.hasta} />
          </label>
          <label>
            Moneda
            <select name="moneda" defaultValue={d.moneda}>
              <option>USD</option>
              <option>VES</option>
              <option>COP</option>
            </select>
          </label>
          <button>Consultar</button>
        </form>
      </section>
      <p className="solo-imprimir">
        Periodo: {p.desde || "Desde el inicio"} — {p.hasta || "Hasta hoy"} ·
        Generado {fecha(new Date().toISOString())} · America/Caracas
      </p>
      <section className="indicadores">
        <article>
          <small>SALDO ANTERIOR</small>
          <strong>{monto(d.anterior, d.moneda)}</strong>
        </article>
        <article>
          <small>CARGOS DEL PERIODO</small>
          <strong>{monto(d.cargos, d.moneda)}</strong>
        </article>
        <article>
          <small>ABONOS DEL PERIODO</small>
          <strong>{monto(d.abonos, d.moneda)}</strong>
        </article>
        <article>
          <small>SALDO FINAL</small>
          <strong>{monto(d.final, d.moneda)}</strong>
        </article>
      </section>
      <section className="panel">
        <p className="muted">
          Los saldos incluyen todos los movimientos del filtro. Para imprimir
          todos, abre la versión completa.
        </p>
        <a
          className="no-imprimir"
          href={"/api/exportar?" + q + "&formato=html"}
        >
          Abrir estado completo para imprimir / PDF →
        </a>
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Cargo</th>
                <th>Abono</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {d.filas.map((m) => (
                <tr key={m.id}>
                  <td>{fecha(m.fecha)}</td>
                  <td>{m.descripcion}</td>
                  <td>
                    {m.tipo === "CARGO" ? monto(m.importe, d.moneda) : "—"}
                  </td>
                  <td>
                    {m.tipo === "ABONO" ? monto(m.importe, d.moneda) : "—"}
                  </td>
                  <td>{monto(m.saldo, d.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacion
          {...d}
          ruta={"/clientes/" + id}
          parametros={{
            desde: p.desde || "",
            hasta: p.hasta || "",
            moneda: d.moneda,
          }}
        />
      </section>
    </>
  );
}

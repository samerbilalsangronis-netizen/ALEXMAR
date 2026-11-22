import Link from "next/link";
import { ActivarFacturacion } from "@/components/activar-facturacion";
import { notFound } from "next/navigation";
import DecimalBase from "decimal.js";
import { sesion } from "@/lib/supabase";
import { type Pagina, monto, fecha, pagina } from "@/lib/formatos";
import { Cabecera, Paginacion } from "@/components/comunes";
import { TablaFacturas, type ListaFacturas } from "@/components/tabla-facturas";
import type { Cliente } from "../page";
const Decimal = DecimalBase.clone({ precision: 128 });
export type Estado = Pagina<{
  id: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  importe: string;
  saldo: string;
  cantidad?: string | null;
  precio_unitario?: string | null;
}> & {
  cliente: Cliente | null;
  anterior: string;
  final: string;
  cargos: string;
  abonos: string;
  moneda: string;
};
class FaltaActualizacion extends Error {}
export default async function Cuenta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const { db, perfil } = await sesion();
  if (!["administrador", "ventas"].includes(perfil.rol)) notFound();
  async function consultar<T>(
    nombre: string,
    parametros: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await db.rpc(nombre, parametros);
    if (error && ["PGRST202", "42883"].includes(error.code))
      throw new FaltaActualizacion();
    if (error) throw new Error(error.message);
    return data as T;
  }
  const p = await searchParams;
  const vista = ["historia", "cuenta"].includes(p.vista) ? p.vista : "facturas";
  const moneda = ["USD", "VES", "COP"].includes(p.moneda) ? p.moneda : "USD";
  const args = { p_id: id, p_moneda: moneda };
  const datos = await Promise.all([
    consultar<Estado>("estado_cliente", args),
    consultar<Estado>("historial_cliente_anterior", args),
    consultar<ListaFacturas>("buscar_ventas", {
      p: {
        cliente_id: id,
        pagina: vista === "facturas" ? pagina(p.pagina) : 1,
        cobro: p.cobro || "",
        desde: p.desde || "",
        hasta: p.hasta || "",
      },
    }),
  ]).catch((e) => {
    if (e instanceof FaltaActualizacion) return null;
    throw e;
  });
  if (!datos) return <ActivarFacturacion />;
  const [global, historico, facturas] = datos;
  if (!global.cliente) notFound();
  const deudaNueva = new Decimal(global.final).minus(historico.final).toFixed();
  const rpc =
    vista === "historia" ? "historial_cliente_anterior" : "estado_cliente";
  const d =
    vista === "facturas"
      ? null
      : !p.desde && !p.hasta && pagina(p.pagina) === 1
        ? vista === "historia"
          ? historico
          : global
        : await consultar<Estado>(rpc, {
            ...args,
            p_desde: p.desde || null,
            p_hasta: p.hasta || null,
            p_pagina: pagina(p.pagina),
          });
  const exportar = new URLSearchParams({
    id,
    desde: p.desde || "",
    hasta: p.hasta || "",
    moneda,
    ...(vista === "historia" ? { origen: "anterior" } : {}),
  });
  const ruta = "/clientes/" + id;
  return (
    <>
      <Link href="/clientes">← Clientes</Link>
      <Cabecera
        titulo={global.cliente.nombre}
        subtitulo={
          (global.cliente.documento || "Sin documento") +
          " · " +
          (global.cliente.telefono || "Sin teléfono")
        }
      >
        <Link className="boton" href="/facturacion/nueva">
          Nueva factura
        </Link>
      </Cabecera>
      <section className="indicadores factura-indicadores">
        <article>
          <small>CUENTA TOTAL · {moneda}</small>
          <strong>{monto(global.final, moneda)}</strong>
          <span>Todos los movimientos del cliente</span>
        </article>
        <article>
          <small>SISTEMA ANTERIOR · {moneda}</small>
          <strong>{monto(historico.final, moneda)}</strong>
          <Link href={ruta + "?vista=historia&moneda=" + moneda}>
            Ver productos e historial →
          </Link>
        </article>
        <article>
          <small>OPERACIONES NUEVAS · {moneda}</small>
          <strong>{monto(deudaNueva, moneda)}</strong>
          <span>Facturas y otros movimientos fuera del origen</span>
        </article>
      </section>
      <nav
        className="factura-pestanas panel"
        aria-label="Historial del cliente"
      >
        {[
          ["facturas", "Facturas nuevas"],
          ["historia", "Historial del sistema anterior"],
          ["cuenta", "Cuenta completa"],
        ].map(([v, t]) => (
          <Link
            key={v}
            aria-current={vista === v ? "page" : undefined}
            href={ruta + "?vista=" + v + "&moneda=" + moneda}
          >
            {t}
          </Link>
        ))}
      </nav>
      <section className="panel factura-filtros">
        <form>
          <input type="hidden" name="vista" value={vista} />
          <div className="factura-filtro-fila">
            <label>
              Desde
              <input type="date" name="desde" defaultValue={p.desde} />
            </label>
            <label>
              Hasta
              <input type="date" name="hasta" defaultValue={p.hasta} />
            </label>
            {vista === "facturas" ? (
              <label>
                Estado de cobro
                <select name="cobro" defaultValue={p.cobro || ""}>
                  <option value="">Todos</option>
                  <option value="pendiente">Por cobrar</option>
                  <option value="pagada">Pagadas</option>
                </select>
              </label>
            ) : (
              <label>
                Moneda
                <select name="moneda" defaultValue={moneda}>
                  <option>USD</option>
                  <option>VES</option>
                  <option>COP</option>
                </select>
              </label>
            )}
            <button className="secundario">Consultar</button>
          </div>
        </form>
      </section>
      {vista === "facturas" ? (
        <section className="panel">
          <h2>Facturas nuevas · USD</h2>
          <p className="muted">
            La deuda importada se conserva en el historial anterior. Aquí solo
            aparecen documentos creados en ALEXMAR.
          </p>
          <TablaFacturas d={facturas} />
          <Paginacion
            {...facturas}
            ruta={ruta}
            parametros={{
              vista,
              cobro: p.cobro || "",
              desde: p.desde || "",
              hasta: p.hasta || "",
              moneda,
            }}
          />
        </section>
      ) : (
        d && (
          <section className="panel">
            <h2>
              {vista === "historia"
                ? "Historial del sistema anterior"
                : "Cuenta completa"}
            </h2>
            <p>
              {vista === "historia"
                ? "Descripciones originales de productos, cargos, abonos y correcciones de la importación. Estos movimientos no se convierten en facturas nuevas."
                : "Todos los movimientos activos, incluidos importación, facturas y sus pagos."}
            </p>
            <p>
              Saldo anterior: <strong>{monto(d.anterior, moneda)}</strong> ·
              Cargos: {monto(d.cargos, moneda)} · Abonos:{" "}
              {monto(d.abonos, moneda)} · Saldo final:{" "}
              <strong>{monto(d.final, moneda)}</strong>
            </p>
            <div className="acciones">
              <a
                className="boton secundario"
                href={"/api/exportar?" + exportar}
              >
                CSV completo
              </a>
              <a
                className="boton secundario"
                href={"/api/exportar?" + exportar + "&formato=html"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Imprimir / PDF completo
              </a>
            </div>
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto / descripción original</th>
                    {vista === "historia" && (
                      <>
                        <th>Cantidad original</th>
                        <th>Precio unitario original</th>
                      </>
                    )}
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
                      {vista === "historia" && (
                        <>
                          <td>
                            {m.cantidad && m.cantidad !== "null"
                              ? m.cantidad
                              : "—"}
                          </td>
                          <td>
                            {m.precio_unitario && m.precio_unitario !== "null"
                              ? m.precio_unitario
                              : "—"}
                          </td>
                        </>
                      )}
                      <td>
                        {m.tipo === "CARGO" ? monto(m.importe, moneda) : "—"}
                      </td>
                      <td>
                        {m.tipo === "ABONO" ? monto(m.importe, moneda) : "—"}
                      </td>
                      <td>{monto(m.saldo, moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.total && (
                <p className="vacio">No hay movimientos en este periodo.</p>
              )}
            </div>
            <Paginacion
              {...d}
              ruta={ruta}
              parametros={{
                vista,
                moneda,
                desde: p.desde || "",
                hasta: p.hasta || "",
              }}
            />
          </section>
        )
      )}
    </>
  );
}

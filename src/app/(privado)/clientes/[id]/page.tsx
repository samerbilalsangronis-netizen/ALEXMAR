import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { type Pagina, monto, fecha, pagina } from "@/lib/formatos";
import { Cabecera, Paginacion, Avisos } from "@/components/comunes";
import { TablaFacturas, type ListaFacturas } from "@/components/tabla-facturas";
import { Plegable } from "@/components/plegable";
import { PdfCliente } from "@/components/pdf-cliente";
import { AbonoCuenta } from "@/components/abono-cuenta";
import { ActivarRapida } from "@/components/activar-rapida";
import { EditorVentaRapida } from "@/components/editor-venta-rapida";
import type { Cliente } from "../page";
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
  if (perfil.rol !== "administrador") notFound();
  async function consultar<T>(
    nombre: string,
    parametros: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await db.rpc(nombre, parametros);
    if (error) throw new Error(error.message);
    return data as T;
  }
  const p = await searchParams;
  const moneda = ["USD", "VES", "COP"].includes(p.moneda) ? p.moneda : "USD";
  const args = { p_id: id, p_moneda: moneda };
  const global = await consultar<Estado>("estado_cliente", args);
  if (!global.cliente) notFound();
  const ruta = "/clientes/" + id;
  const d =
    !p.desde && !p.hasta && pagina(p.pagina) === 1
      ? global
      : await consultar<Estado>("estado_cliente", {
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
  });
  let productos;
  let config;
  if (p.accion === "cargo") {
    [productos, config] = await Promise.all([
      consultar<{ filas: Record<string, unknown>[]; paginas: number }>(
        "buscar_productos",
        { p: { pagina: 1, estado: "activos" } },
      ),
      consultar<{ descontar_stock?: boolean; version_rapida?: number }>(
        "configuracion_facturacion",
        {},
      ),
    ]);
  }
  const facturas =
    p.vista === "facturas"
      ? await consultar<ListaFacturas>("buscar_ventas", {
          p: { cliente_id: id, pagina: pagina(p.documentos_pagina) },
        })
      : null;
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
        <div className="acciones">
          <PdfCliente id={id} nombre={global.cliente.nombre} />
          <Link
            className="boton"
            href={ruta + "?accion=cargo#operacion-cuenta"}
          >
            Cargar productos
          </Link>
          <Link
            className="boton secundario"
            href={ruta + "?accion=abono#operacion-cuenta"}
          >
            Registrar abono
          </Link>
        </div>
      </Cabecera>
      <Avisos p={p} />
      <section className="indicadores factura-indicadores">
        <article>
          <small>CUENTA TOTAL · {moneda}</small>
          <strong>{monto(global.final, moneda)}</strong>
          <span>Saldo pendiente del cliente</span>
        </article>
        <article>
          <small>TOTAL CARGADO · {moneda}</small>
          <strong>{monto(global.cargos, moneda)}</strong>
          <span>Productos y cargos acumulados</span>
        </article>
        <article>
          <small>TOTAL ABONADO · {moneda}</small>
          <strong>{monto(global.abonos, moneda)}</strong>
          <span>Abonos y pagos acumulados</span>
        </article>
      </section>
      {p.accion && (
        <section id="operacion-cuenta">
          <div className="acciones">
            <h2>
              {p.accion === "cargo"
                ? "Cargar productos a la cuenta"
                : "Abonar a la cuenta"}
            </h2>
            <Link className="boton secundario" href={ruta}>
              Cerrar y ver historial
            </Link>
          </div>
          {p.accion === "cargo" &&
            productos &&
            (config?.version_rapida ? (
              <EditorVentaRapida
                key={id}
                clave={randomUUID()}
                cliente={{
                  id,
                  nombre: global.cliente.nombre,
                  documento: global.cliente.documento || undefined,
                }}
                productos={productos.filas.map((r) => ({
                  id: String(r.id),
                  variante_id: String(r.variante_id),
                  nombre: String(r.nombre),
                  precio: r.precio === null ? null : String(r.precio),
                  disponible: String(r.disponible),
                }))}
              />
            ) : (
              <ActivarRapida />
            ))}
          {p.accion === "abono" && (
            <AbonoCuenta
              id={id}
              saldo={
                moneda === "USD"
                  ? global.final
                  : (
                      await consultar<Estado>("estado_cliente", {
                        p_id: id,
                        p_moneda: "USD",
                      })
                    ).final
              }
            />
          )}
        </section>
      )}
      <section className="panel factura-filtros">
        <Plegable
          titulo="Filtros del historial"
          preferencia="alexmar-cuenta-filtros"
          cerradoInicial
        >
          <form className="factura-filtro-fila">
            <label>
              Desde
              <input type="date" name="desde" defaultValue={p.desde} />
            </label>
            <label>
              Hasta
              <input type="date" name="hasta" defaultValue={p.hasta} />
            </label>
            <label>
              Moneda
              <select name="moneda" defaultValue={moneda}>
                <option>USD</option>
                <option>VES</option>
                <option>COP</option>
              </select>
            </label>
            <button className="secundario">Consultar</button>
            <Link href={ruta}>Quitar filtros</Link>
          </form>
        </Plegable>
      </section>
      <section className="panel">
        <h2>Historial completo</h2>
        <p className="muted">
          Todos los productos, cargos y abonos del cliente en una misma cuenta.
        </p>
        {(p.desde || p.hasta) && (
          <p>
            Saldo al inicio: {monto(d.anterior, moneda)} · Cargos del periodo:{" "}
            {monto(d.cargos, moneda)} · Abonos del periodo:{" "}
            {monto(d.abonos, moneda)} · Saldo al cierre:{" "}
            {monto(d.final, moneda)}
          </p>
        )}
        <div className="acciones">
          <a className="boton secundario" href={"/api/exportar?" + exportar}>
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
                <th>Producto / descripción</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
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
                    {m.cantidad && m.cantidad !== "null" ? m.cantidad : "—"}
                  </td>
                  <td>
                    {m.precio_unitario && m.precio_unitario !== "null"
                      ? monto(m.precio_unitario, moneda)
                      : "—"}
                  </td>
                  <td>{m.tipo === "CARGO" ? monto(m.importe, moneda) : "—"}</td>
                  <td>{m.tipo === "ABONO" ? monto(m.importe, moneda) : "—"}</td>
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
          parametros={{ moneda, desde: p.desde || "", hasta: p.hasta || "" }}
        />
      </section>
      <details className="panel" open={Boolean(facturas)}>
        <summary>Comprobantes del cliente</summary>
        {facturas ? (
          <>
            <TablaFacturas d={facturas} />
            <Paginacion
              {...facturas}
              ruta={ruta}
              parametroPagina="documentos_pagina"
              parametros={{ vista: "facturas", moneda }}
            />
          </>
        ) : (
          <p>
            <Link className="boton secundario" href={ruta + "?vista=facturas"}>
              Consultar comprobantes
            </Link>
          </p>
        )}
      </details>
    </>
  );
}

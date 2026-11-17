import Link from "next/link";
import {
  ArrowUpRight,
  TrendingUp,
  Wallet,
  ShoppingBag,
  Users,
  Info,
} from "lucide-react";
import { sesion } from "@/lib/supabase";
import { monto, cantidad } from "@/lib/formatos";
import { periodoActual, type AnaliticaDatos } from "@/lib/analitica";
import { GraficoMargen } from "./grafico-margen";
export async function Analitica({
  parametros = {},
}: {
  parametros?: Record<string, string>;
}) {
  const { db, perfil } = await sesion();
  if (perfil.rol === "lectura") return null;
  const porDefecto = periodoActual();
  const desde = parametros.desde || porDefecto.desde,
    hasta = parametros.hasta || porDefecto.hasta;
  const { data, error } = await db.rpc("analitica_comercial", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) {
    if (error.code === "42P01")
      return (
        <section className="panel activacion" role="alert">
          <Info size={24} />
          <div>
            <h2>Activa la corrección de los gráficos</h2>
            <p>
              Falta una estructura de la actualización de importaciones. SQL 009
              corrige los gráficos sin modificar tus datos ni exigir repetir esa
              importación.
            </p>
            {perfil.rol === "administrador" && (
              <a
                className="boton secundario"
                target="_blank"
                rel="noopener noreferrer"
                href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261117000900_graficos_fotos_vehiculos.sql"
              >
                Abrir corrección SQL 009 <ArrowUpRight size={16} />
              </a>
            )}
          </div>
        </section>
      );

    if (!["PGRST202", "42883"].includes(error.code))
      return (
        <section className="aviso" role="alert">
          <h2>No se pudieron cargar los gráficos</h2>
          <p>{error.message}</p>
          <Link href="?">Restablecer período</Link>
        </section>
      );
    return (
      <section className="panel activacion">
        <Info size={24} />
        <div>
          <h2>Tus nuevos gráficos están listos para conectar</h2>
          <p className="muted">
            El administrador debe activar la actualización de analítica (SQL
            008). Tus datos actuales siguen disponibles.
          </p>
          {perfil.rol === "administrador" && (
            <a
              className="boton secundario"
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261117000800_analitica_vehiculos.sql"
            >
              Abrir SQL 008 <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      </section>
    );
  }
  const d = data as AnaliticaDatos,
    i = d.inventario,
    v = d.ventas;
  const max = Math.max(...(v?.serie.map((x) => Number(x.total)) || []), 1);
  return (
    <div className="analitica">
      {v && (
        <>
          <div className="titulo-seccion">
            <div>
              <span className="etiqueta">EL PULSO DE TU NEGOCIO</span>
              <h2>Ventas y clientes</h2>
            </div>
            <form className="periodo">
              {Object.entries(parametros)
                .filter(
                  ([k]) =>
                    !["desde", "hasta", "pagina", "error", "guardado"].includes(
                      k,
                    ),
                )
                .map(([k, v]) => (
                  <input type="hidden" key={k} name={k} value={v} />
                ))}
              <label>
                Desde
                <input
                  aria-label="Ventas desde"
                  type="date"
                  name="desde"
                  required
                  defaultValue={desde}
                />
              </label>
              <label>
                Hasta
                <input
                  aria-label="Ventas hasta"
                  type="date"
                  name="hasta"
                  required
                  defaultValue={hasta}
                />
              </label>
              <button className="secundario">Actualizar</button>
            </form>
          </div>
          <section className="indicadores indicadores-ventas">
            <article>
              <span className="icono-metrica">
                <Wallet size={20} />
              </span>
              <small>VENTAS EMITIDAS · USD</small>
              <strong>{monto(v.total)}</strong>
              <span className="muted">En el período seleccionado</span>
            </article>
            <article>
              <span className="icono-metrica">
                <ShoppingBag size={20} />
              </span>
              <small>FACTURAS EMITIDAS</small>
              <strong>{cantidad(v.facturas)}</strong>
              <Link href="/facturacion?estado=confirmada">
                Ver documentos ↗
              </Link>
            </article>
            <article>
              <span className="icono-metrica">
                <TrendingUp size={20} />
              </span>
              <small>TICKET PROMEDIO · USD</small>
              <strong>
                {v.ticket === null ? "Sin ventas" : monto(v.ticket)}
              </strong>
              <span className="muted">Ventas ÷ facturas</span>
            </article>
          </section>
          <div className="rejilla-analitica">
            <section className="panel grafico-ventas">
              <div className="titulo-seccion">
                <div>
                  <span className="etiqueta">EVOLUCIÓN</span>
                  <h2>Ventas por mes</h2>
                </div>
                <span className="leyenda">
                  <i /> USD
                </span>
              </div>
              {v.facturas > 0 ? (
                <>
                  <div
                    className="columnas"
                    role="img"
                    aria-label="Ventas mensuales; importes en la tabla inferior"
                  >
                    {v.serie.map((x) => (
                      <div className="columna" key={x.mes}>
                        <small>{monto(x.total)}</small>
                        <div className="columna-pista">
                          <span
                            style={{
                              height: `${(Number(x.total) / max) * 100}%`,
                            }}
                          />
                        </div>
                        <span>
                          {x.mes.slice(5)}/{x.mes.slice(2, 4)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <details className="datos-grafico">
                    <summary>Ver importes por mes</summary>
                    <table>
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th>Facturas</th>
                          <th>Venta USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.serie.map((x) => (
                          <tr key={x.mes}>
                            <td>{x.mes}</td>
                            <td>{x.facturas}</td>
                            <td>{monto(x.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              ) : (
                <div className="vacio">
                  <TrendingUp size={34} />
                  <h3>Tu próxima venta empieza aquí</h3>
                  <p>Aún no hay facturas emitidas en este período.</p>
                  <Link className="boton secundario" href="/facturacion/nueva">
                    Crear una factura
                  </Link>
                </div>
              )}
              <p className="nota-grafico">
                Facturas confirmadas de esta web. Excluye borradores,
                presupuestos, anuladas y cargos históricos. Los meses extremos
                incluyen solo los días del período.
              </p>
            </section>
            <section className="panel ranking">
              <span className="etiqueta">RELACIONES QUE CRECEN</span>
              <h2>Mejores clientes</h2>
              <p className="muted">Por importe facturado en el período</p>
              {v.clientes.length ? (
                <ol>
                  {v.clientes.map((c, n) => (
                    <li key={c.id}>
                      <span className="puesto">
                        {String(n + 1).padStart(2, "0")}
                      </span>
                      <Link href={"/clientes/" + c.id}>
                        <strong>{c.nombre}</strong>
                        <small>{c.facturas} facturas</small>
                      </Link>
                      <b>{monto(c.total)}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="vacio">
                  <Users size={30} />
                  <p>El ranking aparecerá cuando emitas facturas.</p>
                </div>
              )}
              <details className="datos-grafico">
                <summary>Actividad del sistema anterior</summary>
                <p className="nota-grafico">
                  Todo el historial migrado · USD. Orden por cargos de clientes
                  vigentes. Son movimientos de cuenta; no equivalen a ventas
                  verificadas ni usan el período de arriba.
                </p>
                {d.historial_clientes?.length ? (
                  <ol>
                    {d.historial_clientes.map((c, n) => (
                      <li key={c.id}>
                        <span className="puesto">{n + 1}</span>
                        <Link href={"/clientes/" + c.id}>
                          <strong>{c.nombre}</strong>
                          <small>Abonos: {monto(c.abonos)}</small>
                        </Link>
                        <b>{monto(c.cargos)}</b>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">Sin cargos históricos disponibles.</p>
                )}
              </details>
              <Link className="enlace-texto" href="/clientes">
                Todos los clientes <ArrowUpRight size={15} />
              </Link>
            </section>
          </div>
        </>
      )}
      {i && (
        <>
          <div className="titulo-seccion">
            <div>
              <span className="etiqueta">OPORTUNIDAD EN TUS ESTANTES</span>
              <h2>Rentabilidad potencial del inventario</h2>
            </div>
            <span className="estado">Actual · USD</span>
          </div>
          <section className="indicadores indicadores-ventas">
            <article>
              <small>INVERSIÓN AL COSTO</small>
              <strong>{monto(i.costo)}</strong>
              <span className="muted">Stock con costo y precio conocidos</span>
            </article>
            <article>
              <small>VALOR A PRECIO DE VENTA</small>
              <strong>{monto(i.venta)}</strong>
              <span className="muted">Mismo conjunto de productos</span>
            </article>
            <article className="metrica-acento">
              <small>MARGEN POTENCIAL</small>
              <strong>{monto(i.margen)}</strong>
              <span>
                {i.porcentaje === null
                  ? "Sin base para porcentaje"
                  : cantidad(i.porcentaje) + " % sobre el valor de venta"}
              </span>
            </article>
          </section>
          <div className="rejilla-analitica">
            <section className="panel">
              <span className="etiqueta">DÓNDE ESTÁ EL MARGEN</span>
              <h2>Comparativa por categoría</h2>
              <GraficoMargen filas={i.categorias} />
              <p className="nota-grafico">
                Margen = (precio de venta − costo actual) × existencia física
                positiva. Porcentaje = margen ÷ valor de venta × 100. No es
                utilidad realizada; no incluye gastos, descuentos ni costo
                histórico de ventas.
              </p>
            </section>
            <section className="panel cobertura">
              <span className="etiqueta">CALIDAD DE LOS DATOS</span>
              <h2>
                Una base más completa,
                <br />
                mejores decisiones.
              </h2>
              <div
                className="anillo"
                style={
                  {
                    "--progreso": `${i.total ? (i.completos / i.total) * 100 : 0}%`,
                  } as React.CSSProperties
                }
              >
                <strong>
                  {i.total ? Math.round((i.completos / i.total) * 100) : 0}%
                  <small>con costo y precio</small>
                </strong>
              </div>
              <p>
                {cantidad(i.completos)} de {cantidad(i.total)} productos activos
                incluidos
              </p>
              <dl>
                <div>
                  <dt>Sin costo</dt>
                  <dd>{cantidad(i.sin_costo)}</dd>
                </div>
                <div>
                  <dt>Sin precio</dt>
                  <dd>{cantidad(i.sin_precio)}</dd>
                </div>
                <div>
                  <dt>Costo registrado en cero</dt>
                  <dd>{cantidad(i.costo_cero)}</dd>
                </div>
                <div>
                  <dt>Existencia negativa excluida del valor</dt>
                  <dd>{cantidad(i.stock_negativo)}</dd>
                </div>
              </dl>
              <p className="nota-grafico">
                Los datos faltantes no se sustituyen por cero. Los costos
                explícitos en cero sí se incluyen. Los conteos sin costo y sin
                precio pueden coincidir.
              </p>
              <Link href="/inventario" className="enlace-texto">
                Completar mi inventario <ArrowUpRight size={15} />
              </Link>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

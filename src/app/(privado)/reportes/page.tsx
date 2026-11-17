import { Analitica } from "@/components/analitica";
import Link from "next/link";
import { consultar, sesion } from "@/lib/supabase";
import { Cabecera, Paginacion } from "@/components/comunes";
import {
  cantidad,
  monto,
  fecha,
  pagina,
  type Pagina,
  type Producto,
} from "@/lib/formatos";
export type Metricas = {
  productos_activos: number;
  sin_precio: number;
  agotadas: number;
  bajo_minimo: number;
  proveedores_activos?: number;
  clientes_activos?: number;
  cuentas?: { moneda: string; cargos: string; abonos: string; saldo: string }[];
};
export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { perfil } = await sesion();
  const p = await searchParams;
  const filtros = {
    q: p.q || "",
    stock: p.stock || "",
    estado: p.estado || "activos",
    precio: p.precio || "",
  };
  const [m, d] = await Promise.all([
    consultar<Metricas>("metricas_generales"),
    consultar<Pagina<Producto>>("buscar_productos", {
      p: { ...filtros, pagina: pagina(p.pagina) },
    }),
  ]);
  const costos = ["administrador", "inventario"].includes(perfil.rol);
  const consulta = new URLSearchParams(filtros).toString();
  return (
    <>
      <Cabecera
        titulo="Reportes y métricas"
        subtitulo={`Situación actual · ${fecha(new Date().toISOString())} · America/Caracas`}
      />
      <Analitica parametros={p} />
      <h2>Estado del catálogo activo</h2>
      <section className="indicadores">
        <article>
          <small>PRODUCTOS ACTIVOS</small>
          <strong>{cantidad(m.productos_activos)}</strong>
        </article>
        <article>
          <small>VARIANTES SIN PRECIO</small>
          <strong>{cantidad(m.sin_precio)}</strong>
        </article>
        <article>
          <small>VARIANTES AGOTADAS</small>
          <strong>{cantidad(m.agotadas)}</strong>
        </article>
        <article>
          <small>VARIANTES BAJO MÍNIMO</small>
          <strong>{cantidad(m.bajo_minimo)}</strong>
        </article>
      </section>
      <p className="muted">
        Indicadores de todo el catálogo activo, independientes de los filtros
        del detalle. Disponible = existencia física menos reservas activas.
      </p>
      {(m.proveedores_activos !== undefined ||
        m.clientes_activos !== undefined) && (
        <section className="panel">
          <h2>Directorio comercial</h2>
          {m.proveedores_activos !== undefined && (
            <p>
              Proveedores activos:{" "}
              <strong>{cantidad(m.proveedores_activos)}</strong>
            </p>
          )}
          {m.clientes_activos !== undefined && (
            <p>
              Clientes activos: <strong>{cantidad(m.clientes_activos)}</strong>
            </p>
          )}
        </section>
      )}
      {m.cuentas && (
        <section className="panel">
          <h2>Cuentas de clientes por moneda</h2>
          <p className="muted">
            Todo el historial activo de clientes vigentes, sin filtro de fechas.
            Cargos y abonos históricos no equivalen a ventas ni cobros del
            período.
          </p>
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Moneda</th>
                  <th>Cargos</th>
                  <th>Abonos</th>
                  <th>Saldo neto</th>
                </tr>
              </thead>
              <tbody>
                {m.cuentas.map((c) => (
                  <tr key={c.moneda}>
                    <td>{c.moneda}</td>
                    <td>{monto(c.cargos, c.moneda)}</td>
                    <td>{monto(c.abonos, c.moneda)}</td>
                    <td>{monto(c.saldo, c.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="boton secundario no-imprimir" href="/clientes">
            Consultar estados de cuenta →
          </Link>
        </section>
      )}
      <section className="panel">
        <h2>Detalle de inventario</h2>
        <form className="filtros no-imprimir">
          {p.desde && <input type="hidden" name="desde" value={p.desde} />}
          {p.hasta && <input type="hidden" name="hasta" value={p.hasta} />}
          <label>
            Buscar
            <input
              name="q"
              placeholder="Nombre, referencia o vehículo"
              defaultValue={p.q}
            />
          </label>
          <label>
            Existencia
            <select name="stock" defaultValue={p.stock || ""}>
              <option value="">Todas</option>
              <option value="disponible">Disponible</option>
              <option value="agotado">Agotado</option>
              <option value="bajo">Bajo mínimo</option>
            </select>
          </label>
          <label>
            Precio
            <select name="precio" defaultValue={p.precio || ""}>
              <option value="">Todos</option>
              <option value="sin">Sin precio</option>
              <option value="con">Con precio</option>
            </select>
          </label>
          <label>
            Estado
            <select name="estado" defaultValue={p.estado || "activos"}>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <button>Aplicar filtros</button>
        </form>
        <div className="acciones no-imprimir">
          <a
            className="boton secundario"
            href={"/api/reportes/inventario?" + consulta}
          >
            Descargar CSV completo
          </a>
          <a
            className="boton secundario"
            target="_blank"
            rel="noopener noreferrer"
            href={"/api/reportes/inventario?" + consulta + "&formato=html"}
          >
            Imprimir / PDF completo
          </a>
        </div>
        <p className="subtitulo">
          {d.total} resultados · Estado: {filtros.estado} · Existencia:{" "}
          {filtros.stock || "todas"} · Precio: {filtros.precio || "todos"} ·
          Búsqueda: {filtros.q || "sin términos"} · USD
        </p>
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Producto / referencia</th>
                <th>Ubicación</th>
                <th>Físico</th>
                <th>Reservado</th>
                <th>Disponible</th>
                <th>Precio USD</th>
                {costos && <th>Costo USD</th>}
              </tr>
            </thead>
            <tbody>
              {d.filas.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={"/inventario/" + a.id}>{a.nombre}</Link>
                    <br />
                    <small>{a.referencia || "Sin referencia"}</small>
                  </td>
                  <td>{a.ubicacion || "—"}</td>
                  <td>{cantidad(a.fisico)}</td>
                  <td>{cantidad(a.reservado)}</td>
                  <td>{cantidad(a.disponible)}</td>
                  <td>{monto(a.precio)}</td>
                  {costos && (
                    <td>
                      {a.costo == null ? "No disponible" : monto(a.costo)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.total === 0 && (
          <p className="vacio">
            No hay productos para estos filtros. Si todavía no cargaste el
            historial, revisa la importación con el administrador.
          </p>
        )}
        <Paginacion
          {...d}
          ruta="/reportes"
          parametros={{
            ...filtros,
            ...(p.desde ? { desde: p.desde } : {}),
            ...(p.hasta ? { hasta: p.hasta } : {}),
          }}
        />
      </section>
      <section className="panel">
        <h2>Reportes pendientes de las próximas fases</h2>
        <p className="muted">
          Utilidad realizada con costo histórico, compras y deuda de
          proveedores, trabajos, nómina y gastos requieren sus módulos y
          operaciones registradas. Todavía no están disponibles.
        </p>
      </section>
    </>
  );
}

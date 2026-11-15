import Link from "next/link";
import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { Cabecera, Paginacion } from "@/components/comunes";
import { monto, fecha, pagina, type Pagina } from "@/lib/formatos";
import { numeroVenta } from "@/lib/ventas";
type Fila = {
  id: string;
  numero: number | null;
  tipo: string;
  estado: string;
  cliente: string;
  creado: string;
  total: string;
  abono: string;
};
export default async function Facturacion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { db, perfil } = await sesion();
  if (!["administrador", "ventas"].includes(perfil.rol)) notFound();
  const p = await searchParams;
  const { data, error } = await db.rpc("buscar_ventas", {
    p: { q: p.q || "", estado: p.estado || "", pagina: pagina(p.pagina) },
  });
  if (error && !["PGRST202", "42883"].includes(error.code))
    throw new Error(error.message);
  const d = data as Pagina<Fila> | null;
  return (
    <>
      <Cabecera
        titulo="Facturación"
        subtitulo="Productos y servicios · USD · Impuesto 0"
      >
        {!error && (
          <Link className="boton" href="/facturacion/nueva">
            Nueva factura
          </Link>
        )}
      </Cabecera>
      {error ? (
        <section className="aviso">
          <h2>Activa la facturación</h2>
          <p>
            El administrador debe aplicar una sola vez la{" "}
            <a
              href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261115000600_facturacion.sql"
              target="_blank"
              rel="noopener noreferrer"
            >
              actualización de facturación (SQL 006)
            </a>{" "}
            en el proyecto nuevo. No repitas la importación.
          </p>
        </section>
      ) : (
        <>
          <section className="panel">
            <form className="filtros">
              <label>
                Cliente o número
                <input
                  name="q"
                  defaultValue={p.q}
                  placeholder="Nombre o V-000001"
                />
              </label>
              <label>
                Estado
                <select name="estado" defaultValue={p.estado || ""}>
                  <option value="">Todos</option>
                  <option value="borrador">Borradores y presupuestos</option>
                  <option value="confirmada">Emitidas</option>
                  <option value="anulada">Anuladas</option>
                </select>
              </label>
              <button>Buscar</button>
            </form>
          </section>
          <section className="panel">
            <h2>Documentos</h2>
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Total USD</th>
                    <th>Pago inicial USD</th>
                  </tr>
                </thead>
                <tbody>
                  {d!.filas.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <Link href={"/facturacion/" + v.id}>
                          {numeroVenta(v)} →
                        </Link>
                      </td>
                      <td>{v.cliente}</td>
                      <td>{fecha(v.creado)}</td>
                      <td>{v.estado}</td>
                      <td>{monto(v.total)}</td>
                      <td>{monto(v.abono)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {d!.total === 0 && (
              <p className="vacio">
                Todavía no hay documentos para estos filtros. Crea una factura
                para empezar.
              </p>
            )}
            <Paginacion
              {...d!}
              ruta="/facturacion"
              parametros={{ q: p.q || "", estado: p.estado || "" }}
            />
          </section>
          <p className="muted">
            Los borradores y presupuestos no descuentan stock ni generan deuda.
            Al emitir se registran venta, existencia y pago inicial juntos. Las
            anulaciones conservan el historial.
          </p>
        </>
      )}
    </>
  );
}

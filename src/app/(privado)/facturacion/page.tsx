import { FormularioVivo } from "@/components/formulario-vivo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { sesion } from "@/lib/supabase";
import { Cabecera, Paginacion } from "@/components/comunes";
import { monto, pagina } from "@/lib/formatos";
import { TablaFacturas, type ListaFacturas } from "@/components/tabla-facturas";
export default async function Facturacion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { db, perfil } = await sesion();
  if (!["administrador", "ventas"].includes(perfil.rol)) notFound();
  const p = await searchParams;
  const filtros = {
    q: p.q || "",
    estado: p.estado || "vigentes",
    cobro: p.cobro || "",
    desde: p.desde || "",
    hasta: p.hasta || "",
  };
  let { data, error } = await db.rpc("buscar_ventas", {
    p: { ...filtros, pagina: pagina(p.pagina) },
  });
  const pendiente020 = !error && data && data.version_operacion !== 20;
  if (pendiente020 && filtros.estado === "vigentes") {
    const anterior = await db.rpc("buscar_ventas", {
      p: { ...filtros, estado: "", pagina: pagina(p.pagina) },
    });
    data = anterior.data;
    error = anterior.error;
  }
  if (error && !["PGRST202", "42883"].includes(error.code))
    throw new Error(error.message);
  const d = data as ListaFacturas | null;
  const activo = (estado: string, cobro: string) =>
    filtros.estado === estado && filtros.cobro === cobro;
  return (
    <>
      <Cabecera
        titulo="Ventas"
        subtitulo="Registra cada venta de contado. Genera su factura cuando la necesites."
      >
        {d?.resumen && (
          <div className="acciones">
            <Link className="boton" href="/facturacion/nueva">
              <Plus size={17} /> Registrar venta
            </Link>
            <Link className="boton secundario" href="/clientes">
              Clientes a crédito →
            </Link>
          </div>
        )}
      </Cabecera>
      {pendiente020 && (
        <section className="aviso">
          <strong>Activa las mejoras de operación</strong>
          <p>
            Aplica una vez el{" "}
            <a href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261126002000_operacion_simplificada.sql">
              SQL 020
            </a>{" "}
            en Supabase después de 019. Mientras tanto se muestra tu listado
            anterior completo. No repitas la importación.
          </p>
        </section>
      )}
      {!d?.resumen ? (
        <section className="aviso">
          <h2>Actualiza la facturación</h2>
          <p>
            Aplica una vez el{" "}
            <a href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261122001100_facturacion_clientes.sql">
              SQL 011
            </a>{" "}
            completo en Supabase, después del SQL 006. No repitas la
            importación.
          </p>
        </section>
      ) : (
        <>
          <section className="panel factura-filtros">
            <FormularioVivo>
              <label>
                Buscar factura
                <input
                  name="q"
                  defaultValue={p.q}
                  placeholder="Número, cliente, cédula / RIF o producto…"
                />
              </label>
              <div className="factura-filtro-fila">
                <label>
                  Desde
                  <input type="date" name="desde" defaultValue={p.desde} />
                </label>
                <label>
                  Hasta
                  <input type="date" name="hasta" defaultValue={p.hasta} />
                </label>
                <input type="hidden" name="estado" value={filtros.estado} />
                <input type="hidden" name="cobro" value={filtros.cobro} />

                <Link href="/facturacion">Limpiar</Link>
                <span className="etiqueta">USD</span>
              </div>
            </FormularioVivo>
            <nav className="factura-pestanas" aria-label="Estado de facturas">
              {[
                ["Activas", "vigentes", ""],
                ["Por cobrar", "confirmada", "pendiente"],
                ["Pagadas", "confirmada", "pagada"],
                ["Anuladas", "anulada", ""],
                ["Borradores", "borrador", ""],
              ].map(([nombre, estado, cobro]) => (
                <Link
                  key={nombre}
                  aria-current={activo(estado, cobro) ? "page" : undefined}
                  href={
                    "/facturacion?" +
                    new URLSearchParams({ ...filtros, estado, cobro })
                  }
                >
                  {nombre}
                </Link>
              ))}
            </nav>
          </section>
          <section className="indicadores factura-indicadores">
            <article>
              <small>VENDIDO USD</small>
              <strong>{monto(d.resumen.facturado)}</strong>
              <span>{d.resumen.emitidas} ventas registradas</span>
            </article>
            <article>
              <small>COBRADO USD</small>
              <strong>{monto(d.resumen.cobrado)}</strong>
              <span>Pagos de estas facturas</span>
            </article>
            <article>
              <small>POR COBRAR USD</small>
              <strong>{monto(d.resumen.pendiente)}</strong>
              <span>Saldo de estas facturas</span>
            </article>
          </section>
          <section className="panel factura-listado">
            <TablaFacturas d={d} puedeAnular={perfil.rol === "administrador"} />
            <Paginacion {...d} ruta="/facturacion" parametros={filtros} />
          </section>
          <p className="muted">
            Los totales incluyen todas las páginas de la consulta. Borradores y
            anuladas no suman. Las cuentas a crédito se consultan en cada
            cliente.
          </p>
        </>
      )}
    </>
  );
}

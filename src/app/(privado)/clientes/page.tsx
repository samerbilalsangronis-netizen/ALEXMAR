import Link from "next/link";
import { consultar } from "@/lib/supabase";
import { Pagina, monto, pagina } from "@/lib/formatos";
import { Cabecera, Avisos, Paginacion, Vacio } from "@/components/comunes";
import Decimal from "decimal.js";
import { FormularioVivo } from "@/components/formulario-vivo";
export type Cliente = {
  id: string;
  nombre: string;
  documento: string;
  telefono: string;
  direccion: string;
  saldo: string;
  aproximado?: boolean;
};
export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const d = await consultar<Pagina<Cliente>>("buscar_clientes", {
    p: { q: p.q || "", pagina: pagina(p.pagina) },
  });
  return (
    <>
      <Cabecera
        titulo="Clientes"
        subtitulo="Cuentas a crédito, productos y abonos de cada cliente."
      >
        <Link className="boton" href="/clientes/nuevo">
          Nuevo cliente
        </Link>
      </Cabecera>
      <Avisos p={p} />
      <section className="panel">
        <FormularioVivo className="busqueda">
          <input
            name="q"
            aria-label="Buscar cliente"
            placeholder="Nombre, documento o teléfono…"
            defaultValue={p.q}
          />
        </FormularioVivo>
      </section>
      {d.filas.length ? (
        <div className="productos">
          {d.filas.map((c) => (
            <Link className="producto" key={c.id} href={"/clientes/" + c.id}>
              <span className="etiqueta">CLIENTE</span>
              <h3>{c.nombre}</h3>
              {c.aproximado && <small>Coincidencia aproximada</small>}
              <p className="muted">
                {c.documento || "Sin documento"} ·{" "}
                {c.telefono || "Sin teléfono"}
              </p>
              <div className="producto-precio">
                <span>
                  {new Decimal(c.saldo).lt(0) ? "Pagó de más" : "Debe"} · USD
                </span>
                <strong>{monto(new Decimal(c.saldo).abs().toFixed())}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Vacio texto="No hay clientes para esta búsqueda" />
      )}
      <Paginacion {...d} ruta="/clientes" parametros={p.q ? { q: p.q } : {}} />
    </>
  );
}

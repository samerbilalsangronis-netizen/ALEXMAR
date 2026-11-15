import Link from "next/link";
import { consultar } from "@/lib/supabase";
import { Pagina, monto, pagina } from "@/lib/formatos";
import { Cabecera, Avisos, Paginacion, Vacio } from "@/components/comunes";
import { guardarCliente } from "@/app/actions";
export type Cliente = {
  id: string;
  nombre: string;
  documento: string;
  telefono: string;
  direccion: string;
  saldo: string;
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
        titulo="Clientes y cuentas"
        subtitulo="Historial completo y saldos separados por moneda."
      />
      <Avisos p={p} />
      <section className="panel">
        <form className="busqueda">
          <input
            name="q"
            aria-label="Buscar cliente"
            placeholder="Nombre, documento o teléfono…"
            defaultValue={p.q}
          />
          <button>Buscar</button>
        </form>
      </section>
      {d.filas.length ? (
        <div className="productos">
          {d.filas.map((c) => (
            <Link className="producto" key={c.id} href={"/clientes/" + c.id}>
              <span className="etiqueta">CLIENTE</span>
              <h3>{c.nombre}</h3>
              <p className="muted">
                {c.documento || "Sin documento"} ·{" "}
                {c.telefono || "Sin teléfono"}
              </p>
              <div className="producto-precio">
                <span>
                  {Number(c.saldo) < 0 ? "Pagó de más" : "Debe"} · USD
                </span>
                <strong>{monto(Math.abs(Number(c.saldo)))}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Vacio texto="No hay clientes para esta búsqueda" />
      )}
      <Paginacion {...d} ruta="/clientes" parametros={p.q ? { q: p.q } : {}} />
      <details className="panel">
        <summary>Registrar cliente</summary>
        <form action={guardarCliente} className="formulario">
          <label>
            Nombre
            <input name="nombre" required />
          </label>
          <label>
            Documento
            <input name="documento" />
          </label>
          <label>
            Teléfono
            <input name="telefono" />
          </label>
          <label>
            Dirección
            <input name="direccion" />
          </label>
          <button>Guardar cliente</button>
        </form>
      </details>
    </>
  );
}

import { FormularioVivo } from "@/components/formulario-vivo";
import { sesion } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Cabecera, Paginacion, Vacio } from "@/components/comunes";
import { monto, pagina, type Pagina } from "@/lib/formatos";
type Precio = {
  id: string;
  variante_id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  marca: string;
  referencia: string;
  compatibilidad: string;
  variante: string;
  precio: string | null;
};
export default async function Consulta({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { db, perfil } = await sesion();
  if (!["administrador", "lectura"].includes(perfil.rol)) notFound();
  if (perfil.version_accesos !== 13)
    return (
      <section className="aviso">
        <h1>Acceso general pendiente de activar</h1>
        <p>Solicita a administración activar SQL 013.</p>
      </section>
    );
  const p = await searchParams;
  const { data, error } = await db.rpc("catalogo_general", {
    p: { q: p.q || "", pagina: pagina(p.pagina) },
  });
  if (error) throw new Error(error.message);
  const d = data as Pagina<Precio>;
  return (
    <>
      <Cabecera
        titulo="Consulta de precios"
        subtitulo="Encuentra el producto y consulta su precio de venta en USD."
      />
      <section className="panel">
        <FormularioVivo className="busqueda">
          <label className="sr-only" htmlFor="buscar-precio">
            Buscar producto
          </label>
          <input
            id="buscar-precio"
            name="q"
            defaultValue={p.q}
            placeholder="Nombre, primeras letras, marca o vehículo…"
            autoComplete="off"
          />
        </FormularioVivo>
      </section>
      <div className="precios-generales">
        {d.filas.map((a) => (
          <article className="panel precio-general" key={a.variante_id}>
            <span className="etiqueta">{a.categoria || "Producto"}</span>
            <h2>{a.nombre}</h2>
            {a.variante !== "Principal" && <p>{a.variante}</p>}
            {a.referencia && (
              <p className="muted">Referencia: {a.referencia}</p>
            )}
            {a.marca && <p>{a.marca}</p>}
            {a.compatibilidad && <p className="muted">{a.compatibilidad}</p>}
            <strong className="precio-consulta">{monto(a.precio)}</strong>
            <small>Precio de venta · USD</small>
          </article>
        ))}
      </div>
      {!d.total && <Vacio texto="No hay coincidencias para esta búsqueda" />}
      <Paginacion {...d} ruta="/consulta" parametros={{ q: p.q || "" }} />
    </>
  );
}

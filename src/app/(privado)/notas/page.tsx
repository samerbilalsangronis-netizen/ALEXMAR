import { consultar } from "@/lib/supabase";
import { Pagina, pagina } from "@/lib/formatos";
import { Cabecera, Paginacion, Avisos } from "@/components/comunes";
import { guardarNota } from "@/app/actions";
export default async function Notas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const d = await consultar<
    Pagina<{ id: string; titulo: string; contenido: string }>
  >("listar_notas", { p_pagina: pagina(p.pagina) });
  return (
    <>
      <Cabecera
        titulo="Notas"
        subtitulo="Anotaciones privadas del administrador."
      />
      <Avisos p={p} />
      <div className="productos">
        {d.filas.map((n) => (
          <article className="producto nota" key={n.id}>
            <h3>{n.titulo || "Sin título"}</h3>
            <p>{n.contenido}</p>
          </article>
        ))}
      </div>
      <Paginacion {...d} ruta="/notas" />
      <section className="panel">
        <h2>Nueva nota</h2>
        <form action={guardarNota} className="formulario">
          <label>
            Título
            <input name="titulo" />
          </label>
          <label>
            Contenido
            <textarea name="contenido" required />
          </label>
          <button>Guardar nota</button>
        </form>
      </section>
    </>
  );
}

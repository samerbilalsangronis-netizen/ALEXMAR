import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { Plus, FilePenLine, StickyNote } from "lucide-react";
import { sesion } from "@/lib/supabase";
import { type Pagina, pagina } from "@/lib/formatos";
import { Cabecera, Paginacion, Avisos } from "@/components/comunes";
import { ContenidoNota } from "@/components/contenido-nota";
import { EliminarNota } from "@/components/eliminar-nota";
import { EditorNota } from "@/components/editor-nota";
type Nota = { id: string; titulo: string; contenido: string };
export default async function Notas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const { db, perfil } = await sesion();
  if (perfil.rol !== "administrador") notFound();
  if (p.nueva === "1")
    return (
      <>
        <Cabecera
          titulo="Nueva nota"
          subtitulo="Una hoja para tus ideas, pendientes y recordatorios."
        />
        <EditorNota id={randomUUID()} />
      </>
    );
  const { data, error } = await db.rpc("listar_notas", {
    p_pagina: pagina(p.pagina),
  });
  if (error) throw new Error(error.message);
  const d = data as Pagina<Nota>;
  if (!p.editar && d.pagina > d.paginas) redirect("/notas?pagina=" + d.paginas);
  if (p.editar) {
    const n = d.filas.find((n) => n.id === p.editar);
    if (!n) notFound();
    return (
      <>
        <Cabecera
          titulo="Editar nota"
          subtitulo="Actualiza el texto, los colores y los stickers de tu nota."
        />
        <EditorNota key={n.id} {...n} regreso={"/notas?pagina=" + d.pagina} />
      </>
    );
  }
  return (
    <>
      <Cabecera
        titulo="Tus notas"
        subtitulo="Ideas y recordatorios privados del personal administrativo."
      >
        <Link className="boton" href="/notas?nueva=1">
          <Plus size={18} aria-hidden="true" /> Nueva nota
        </Link>
      </Cabecera>
      <Avisos p={p} />
      {!d.total && (
        <section className="panel vacio">
          <StickyNote size={32} aria-hidden="true" />
          <h2>Tu próxima idea empieza aquí</h2>
          <p>
            Crea una nota y dale tu estilo con colores, resaltados y stickers.
          </p>
          <Link href="/notas?nueva=1" className="boton">
            Crear mi primera nota
          </Link>
        </section>
      )}
      <div className="productos notas-listado">
        {d.filas.map((n) => (
          <article className="producto nota" key={n.id}>
            <span className="etiqueta">NOTA PRIVADA</span>
            <h2>{n.titulo || "Sin título"}</h2>
            <ContenidoNota contenido={n.contenido} />
            <Link
              className="boton secundario"
              href={"/notas?editar=" + n.id + "&pagina=" + d.pagina}
            >
              <FilePenLine size={16} aria-hidden="true" /> Abrir y editar
            </Link>
            <EliminarNota id={n.id} titulo={n.titulo} />
          </article>
        ))}
      </div>
      <Paginacion {...d} ruta="/notas" />
    </>
  );
}

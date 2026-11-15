import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
export function Cabecera({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="cabecera">
      <div>
        <span className="etiqueta">ALEXMAR / GESTIÓN</span>
        <h1>{titulo}</h1>
        <p className="muted">{subtitulo}</p>
      </div>
      {children}
    </header>
  );
}
export function Avisos({ p }: { p: Record<string, string> }) {
  return (
    <>
      {p.error && (
        <p role="alert" className="aviso">
          {p.error}
        </p>
      )}
      {p.guardado && (
        <p role="status" className="exito">
          Cambios guardados.
        </p>
      )}
    </>
  );
}
export function Paginacion({
  total,
  pagina,
  paginas,
  ruta,
  parametros = {},
}: {
  total: number;
  pagina: number;
  paginas: number;
  ruta: string;
  parametros?: Record<string, string>;
}) {
  function href(n: number) {
    const p = new URLSearchParams(parametros);
    p.set("pagina", String(n));
    return ruta + "?" + p;
  }
  return (
    <nav className="paginacion" aria-label="Paginación">
      <span>
        {total} resultados · Página {pagina} de {paginas}
      </span>
      <div>
        {pagina > 1 && (
          <Link className="boton secundario" href={href(pagina - 1)}>
            <ChevronLeft size={16} /> Anterior
          </Link>
        )}
        {pagina < paginas && (
          <Link className="boton secundario" href={href(pagina + 1)}>
            Siguiente <ChevronRight size={16} />
          </Link>
        )}
      </div>
    </nav>
  );
}
export function Vacio({ texto }: { texto: string }) {
  return (
    <div className="vacio">
      <PackageSearch size={38} />
      <h3>{texto}</h3>
      <p>Prueba otros términos o limpia los filtros.</p>
    </div>
  );
}

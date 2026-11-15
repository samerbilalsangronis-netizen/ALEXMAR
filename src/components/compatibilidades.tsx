import Link from "next/link";
import { guardarCompatibilidad, eliminarCompatibilidad } from "@/app/actions";
import type { Pagina } from "@/lib/formatos";

export type Compatibilidad = {
  id: string;
  marca: string;
  modelo: string;
  anio_desde: number | null;
  anio_hasta: number | null;
  universal: boolean;
};
function Campos({ dato }: { dato?: Compatibilidad }) {
  return (
    <>
      <label>
        Marca del vehículo
        <input name="marca" maxLength={100} defaultValue={dato?.marca} />
      </label>
      <label>
        Modelo del vehículo
        <input name="modelo" maxLength={150} defaultValue={dato?.modelo} />
      </label>
      <label>
        Desde el año
        <input
          name="anio_desde"
          type="number"
          min={1886}
          max={2200}
          defaultValue={dato?.anio_desde ?? ""}
        />
      </label>
      <label>
        Hasta el año
        <input
          name="anio_hasta"
          type="number"
          min={1886}
          max={2200}
          defaultValue={dato?.anio_hasta ?? ""}
        />
      </label>
      <label className="checkbox">
        <input
          name="universal"
          type="checkbox"
          defaultChecked={dato?.universal}
        />
        Universal (deja marca, modelo y años vacíos)
      </label>
    </>
  );
}
export function Compatibilidades({
  producto,
  datos,
  edita,
  parametros,
}: {
  producto: string;
  datos: Pagina<Compatibilidad>;
  edita: boolean;
  parametros: Record<string, string>;
}) {
  const contexto = (
    <>
      {["volver", "pagina", "compat_pagina"].map((k) => (
        <input key={k} name={k} type="hidden" value={parametros[k] || ""} />
      ))}
    </>
  );
  function href(n: number) {
    const q = new URLSearchParams();
    if (parametros.volver) q.set("volver", parametros.volver);
    if (parametros.pagina) q.set("pagina", parametros.pagina);
    q.set("compat_pagina", String(n));
    return `/inventario/${producto}?${q}#compatibilidades`;
  }
  return (
    <section className="panel" id="compatibilidades">
      <h2>Compatibilidades verificadas</h2>
      <p>
        Registra solo compatibilidades comprobadas. El texto histórico declarado
        se conserva por separado. Sin años conocidos, no se confirma un año
        específico.
      </p>
      {datos.total === 0 && (
        <p>No hay compatibilidades verificadas registradas.</p>
      )}
      {datos.filas.map((c) => (
        <article key={c.id}>
          <h3>{c.universal ? "Universal" : `${c.marca} ${c.modelo}`}</h3>
          {!c.universal && (
            <p>
              {c.anio_desde === null && c.anio_hasta === null
                ? "Años por verificar"
                : `${c.anio_desde ?? "Sin inicio indicado"} — ${c.anio_hasta ?? "Sin fin indicado"}`}
            </p>
          )}
          {edita && (
            <details>
              <summary>Editar o eliminar compatibilidad</summary>
              <form action={guardarCompatibilidad} className="formulario">
                {contexto}
                <input name="producto" type="hidden" value={producto} />
                <input name="id" type="hidden" value={c.id} />
                <Campos dato={c} />
                <button>Guardar compatibilidad</button>
              </form>
              <form action={eliminarCompatibilidad}>
                {contexto}
                <input name="producto" type="hidden" value={producto} />
                <input name="id" type="hidden" value={c.id} />
                <label className="checkbox">
                  <input name="confirmar" type="checkbox" required />
                  Confirmo eliminar esta compatibilidad verificada
                </label>
                <button className="secundario">Eliminar compatibilidad</button>
              </form>
            </details>
          )}
        </article>
      ))}
      <nav className="paginacion" aria-label="Páginas de compatibilidades">
        <span>
          {datos.total} compatibilidades · Página {datos.pagina} de{" "}
          {datos.paginas}
        </span>
        <div>
          {datos.pagina > 1 && (
            <Link href={href(datos.pagina - 1)}>← Anterior</Link>
          )}{" "}
          {datos.pagina < datos.paginas && (
            <Link href={href(datos.pagina + 1)}>Siguiente →</Link>
          )}
        </div>
      </nav>
      {edita && (
        <details>
          <summary>Añadir compatibilidad verificada</summary>
          <form action={guardarCompatibilidad} className="formulario">
            {contexto}
            <input name="producto" type="hidden" value={producto} />
            <Campos />
            <button>Añadir compatibilidad</button>
          </form>
        </details>
      )}
    </section>
  );
}

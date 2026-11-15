import type { ClasificacionProducto } from "@/lib/catalogo";
import Link from "next/link";
import {
  Compatibilidades,
  type Compatibilidad,
} from "@/components/compatibilidades";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { consultar, sesion } from "@/lib/supabase";
import {
  Producto,
  Pagina,
  monto,
  cantidad,
  fecha,
  pagina,
} from "@/lib/formatos";
import {
  guardarProducto,
  ajustarStock,
  guardarClasificacion,
} from "@/app/actions";
import { Cabecera, Avisos, Paginacion } from "@/components/comunes";
export default async function Ficha({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const p = await searchParams;
  const { db, perfil } = await sesion();
  const edita = ["administrador", "inventario"].includes(perfil.rol);
  const [a, k, compatibilidades, respuestaClasificacion] = await Promise.all([
    consultar<Producto | null>("ficha_producto", { p_id: id }),
    consultar<
      Pagina<{
        id: string;
        creado: string;
        cantidad: string;
        motivo: string;
        saldo: string;
      }>
    >("kardex", { p_id: id, p_pagina: pagina(p.pagina) }),
    consultar<Pagina<Compatibilidad>>("listar_compatibilidades", {
      p_producto: id,
      p_pagina: pagina(p.compat_pagina),
    }),
    db.rpc("clasificacion_producto", { p_id: id }),
  ]);
  if (!a) notFound();
  if (
    respuestaClasificacion.error &&
    !["PGRST202", "42883"].includes(respuestaClasificacion.error.code)
  )
    throw new Error(respuestaClasificacion.error.message);
  const clasificacion = respuestaClasificacion.error
    ? null
    : (respuestaClasificacion.data as ClasificacionProducto);

  const campos = [
    ["nombre", "Nombre"],
    ["categoria", "Etiqueta original / libre"],
    ["marca", "Marca"],
    ["referencia", "Referencia"],
    ["alias", "Alias y palabras de búsqueda"],
    ["compatibilidad", "Compatibilidad declarada"],
    ["ubicacion", "Ubicación"],
  ] as const;
  return (
    <>
      <Link href={"/inventario?" + (p.volver || "")}>
        ← Volver a resultados
      </Link>
      <Cabecera
        titulo={a.nombre}
        subtitulo={a.categoria || "Producto sin categoría"}
      />
      <Avisos p={p} />
      <section className="indicadores">
        <article>
          <small>PRECIO DE VENTA · USD</small>
          <strong>{monto(a.precio)}</strong>
        </article>
        <article>
          <small>EXISTENCIA FÍSICA</small>
          <strong>{cantidad(a.fisico)}</strong>
        </article>
        <article>
          <small>RESERVADO</small>
          <strong>{cantidad(a.reservado)}</strong>
        </article>
        {edita && (
          <article>
            <small>COSTO · USD</small>
            <strong>
              {a.costo === null ? "No disponible" : monto(a.costo)}
            </strong>
          </article>
        )}
      </section>
      <section className="panel">
        <h2>Información del producto</h2>
        {edita ? (
          <form action={guardarProducto} className="formulario">
            <input name="id" value={id} type="hidden" />
            {campos.map(([k, t]) => (
              <label key={k}>
                {t}
                <input
                  name={k}
                  defaultValue={String(a[k] || "")}
                  required={k === "nombre"}
                />
              </label>
            ))}
            <label>
              Descripción
              <textarea name="descripcion" defaultValue={a.descripcion || ""} />
            </label>
            <label>
              Costo USD
              <input
                name="costo"
                inputMode="decimal"
                defaultValue={a.costo || ""}
              />
            </label>
            <label>
              Precio de venta USD
              <input
                name="precio"
                inputMode="decimal"
                defaultValue={a.precio || ""}
              />
            </label>
            <label>
              Stock mínimo
              <input
                name="minimo"
                inputMode="decimal"
                defaultValue={a.minimo}
                required
              />
            </label>
            <label className="checkbox">
              <input name="activo" type="checkbox" defaultChecked={a.activo} />
              Activo
            </label>
            <button>Guardar cambios</button>
          </form>
        ) : (
          <>
            <p>{a.descripcion || "Sin descripción adicional."}</p>
            <p>
              Compatibilidad declarada: {a.compatibilidad || "Por verificar"}
            </p>
          </>
        )}
      </section>
      {clasificacion && (
        <section className="panel">
          <h2>Organización del catálogo</h2>
          <p>
            Categoría de pieza: <strong>{clasificacion.categoria}</strong>
          </p>
          <p>
            Vehículos mencionados:{" "}
            <strong>{clasificacion.vehiculos.join(" · ")}</strong>
          </p>
          <p className="muted">
            Esta organización permite encontrar el producto. No certifica
            compatibilidad ni años. La etiqueta original se conserva por
            separado.
          </p>
          {edita && (
            <details>
              <summary>Personalizar categoría y grupos de vehículo</summary>
              <form action={guardarClasificacion} className="formulario">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="volver" value={p.volver || ""} />
                <label>
                  Tu categoría
                  <input
                    name="categoria_grupo"
                    maxLength={100}
                    placeholder={clasificacion.categoria}
                    defaultValue={clasificacion.categoria_manual || ""}
                  />
                  <small>Vacío: volver a la sugerencia automática.</small>
                </label>
                <label>
                  Tus grupos de vehículo
                  <input
                    name="vehiculos_grupo"
                    placeholder={clasificacion.vehiculos.join(", ")}
                    defaultValue={
                      clasificacion.vehiculos_manuales?.join(", ") || ""
                    }
                  />
                  <small>
                    Separados por coma. Vacío: detectar desde el texto. Usa Por
                    identificar si quieres dejarlo sin asignar.
                  </small>
                </label>
                <button>Guardar clasificación</button>
              </form>
            </details>
          )}
        </section>
      )}
      <Compatibilidades
        producto={id}
        datos={compatibilidades}
        edita={edita}
        parametros={p}
      />
      {edita && (
        <details className="panel">
          <summary>Ajustar existencia por conteo</summary>
          <form action={ajustarStock} className="formulario">
            <input name="id" value={id} type="hidden" />
            <input name="clave" value={randomUUID()} type="hidden" />
            <label>
              Existencia física contada
              <input name="contado" inputMode="decimal" required />
            </label>
            <label>
              Motivo
              <input name="motivo" required minLength={5} />
            </label>
            <button>Registrar ajuste</button>
            <small>Se registra la diferencia como movimiento trazable.</small>
          </form>
        </details>
      )}
      <section className="panel">
        <h2>Kardex</h2>
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Motivo</th>
                <th>Movimiento</th>
                <th>Saldo físico</th>
              </tr>
            </thead>
            <tbody>
              {k.filas.map((m) => (
                <tr key={m.id}>
                  <td>{fecha(m.creado)}</td>
                  <td>{m.motivo}</td>
                  <td>{cantidad(m.cantidad)}</td>
                  <td>{cantidad(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacion
          {...k}
          ruta={"/inventario/" + id}
          parametros={{
            ...(p.volver ? { volver: p.volver } : {}),
            ...(p.compat_pagina ? { compat_pagina: p.compat_pagina } : {}),
          }}
        />
      </section>
    </>
  );
}

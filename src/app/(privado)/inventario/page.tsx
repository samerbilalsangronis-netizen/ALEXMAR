import { Plegable } from "@/components/plegable";
import type { GruposInventario, OpcionesCatalogo } from "@/lib/catalogo";
import Link from "next/link";
import { Search, Plus, SlidersHorizontal } from "lucide-react";
import { consultar, sesion } from "@/lib/supabase";
import { Producto, Pagina, monto, cantidad, pagina } from "@/lib/formatos";
import { Cabecera, Paginacion, Avisos, Vacio } from "@/components/comunes";
import { guardarProducto, guardarConsulta } from "@/app/actions";
export default async function Inventario({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const { db, perfil } = await sesion();
  const edita = ["administrador", "inventario"].includes(perfil.rol);
  const [d, opciones, respuestaGrupos] = await Promise.all([
    consultar<Pagina<Producto & { aproximado: boolean }>>("buscar_productos", {
      p: { ...p, pagina: pagina(p.pagina) },
    }),
    consultar<OpcionesCatalogo>("opciones_catalogo"),
    db.rpc("grupos_inventario", { p: { ...p } }),
  ]);
  if (
    respuestaGrupos.error &&
    !["PGRST202", "42883"].includes(respuestaGrupos.error.code)
  )
    throw new Error(respuestaGrupos.error.message);
  const grupos = respuestaGrupos.error
    ? null
    : (respuestaGrupos.data as GruposInventario);
  const o = {
    ...opciones,
    vehiculos: opciones.vehiculos || [],
    categorias_origen: opciones.categorias_origen || [],
  };
  const activos = Object.entries(p).filter(
    ([k, v]) => v && !["pagina", "error", "guardado"].includes(k),
  );
  const filtrosGuardados = new URLSearchParams(
    Object.fromEntries(activos),
  ).toString();
  const regreso = new URLSearchParams({
    ...Object.fromEntries(activos),
    ...(p.pagina ? { pagina: p.pagina } : {}),
  }).toString();
  const agrupacion = p.agrupar === "vehiculo" ? "vehiculo" : "categoria";
  const seleccionados =
    agrupacion === "categoria"
      ? grupos?.categorias || []
      : grupos?.vehiculos || [];
  function enlace(cambios: Record<string, string>) {
    const q = new URLSearchParams(Object.fromEntries(activos));
    for (const [k, v] of Object.entries(cambios)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.delete("pagina");
    return "/inventario?" + q;
  }
  const nombresFiltros: Record<string, string> = {
    categoria: "Categoría",
    modelo: "Vehículo mencionado",
    categoria_origen: "Etiqueta original",
    vehiculo: "Compatibilidad declarada",
    q: "Búsqueda",
    stock: "Existencias",
    precio: "Precio",
    anio: "Año verificado",
  };
  return (
    <>
      <Cabecera
        titulo="Inventario"
        subtitulo="Explora tus piezas por categoría o vehículo y combina tus propios filtros."
      >
        <div className="acciones">
          <a className="boton secundario" href="#filtros-inventario">
            Buscar y filtrar
          </a>
          {edita && (
            <a className="boton" href="#nuevo">
              <Plus size={18} />
              Nuevo producto
            </a>
          )}
        </div>
      </Cabecera>
      <Avisos p={p} />
      {!grupos && (
        <section className="aviso">
          <strong>
            La organización por piezas y vehículos está pendiente de activar.
          </strong>{" "}
          {edita ? (
            <span>
              Aplica la{" "}
              <a
                href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261115000500_catalogo_organizado.sql"
                target="_blank"
                rel="noopener noreferrer"
              >
                actualización de clasificación
              </a>{" "}
              en el proyecto nuevo. Tus productos siguen disponibles abajo; no
              necesitas importarlos de nuevo.
            </span>
          ) : (
            "El administrador debe activar esta función. Tus productos siguen disponibles abajo."
          )}
        </section>
      )}
      {grupos && (
        <section className="panel explorar-inventario">
          <Plegable
            titulo="Categorías y vehículos"
            preferencia="alexmar:grupos-inventario"
          >
            <div className="encabezado-grupos">
              <div>
                <span className="etiqueta">TU CATÁLOGO ORGANIZADO</span>
                <h2>Encuentra lo que necesitas</h2>
              </div>
              <nav className="selector-grupos" aria-label="Agrupar inventario">
                <Link
                  href={enlace({ agrupar: "categoria" })}
                  aria-current={agrupacion === "categoria" ? "page" : undefined}
                >
                  Por categoría
                </Link>
                <Link
                  href={enlace({ agrupar: "vehiculo" })}
                  aria-current={agrupacion === "vehiculo" ? "page" : undefined}
                >
                  Por vehículo
                </Link>
              </nav>
            </div>
            <p className="muted">
              {grupos.total} productos con los filtros actuales.{" "}
              {agrupacion === "vehiculo"
                ? "Un producto puede aparecer en varios vehículos mencionados. No se confirma compatibilidad ni año a partir del nombre."
                : "Cada producto tiene una categoría de pieza. Los casos ambiguos quedan en Por clasificar y se pueden corregir desde su ficha."}
            </p>
            <div className="grupos-inventario">
              {seleccionados.map((g) => (
                <Link
                  key={g.nombre}
                  href={enlace(
                    agrupacion === "categoria"
                      ? { categoria: g.nombre }
                      : { modelo: g.nombre },
                  )}
                  className="grupo-inventario"
                >
                  <span>{g.nombre}</span>
                  <strong>{cantidad(g.total)}</strong>
                  <small>Ver productos →</small>
                </Link>
              ))}
            </div>
            {seleccionados.length === 0 && (
              <p>
                No hay grupos para estos filtros. Limpia algún filtro para
                continuar.
              </p>
            )}
          </Plegable>
        </section>
      )}
      <section className="panel buscador" id="filtros-inventario">
        <form key={filtrosGuardados}>
          <input type="hidden" name="agrupar" value={agrupacion} />
          <div className="busqueda">
            <Search size={21} />
            <input
              aria-label="Buscar productos"
              name="q"
              placeholder="Nombre, referencia, marca o vehículo…"
              defaultValue={p.q}
            />
            <button>Buscar</button>
          </div>
          <Plegable
            titulo="Filtros personalizados"
            preferencia="alexmar:filtros-inventario"
          >
            <div className="filtros">
              <label>
                Categoría de pieza
                <select name="categoria" defaultValue={p.categoria || ""}>
                  <option value="">Todas</option>
                  {p.categoria && !o.categorias.includes(p.categoria) && (
                    <option value={p.categoria}>
                      {p.categoria} (etiqueta original)
                    </option>
                  )}
                  {o.categorias.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Vehículo mencionado
                <select
                  name="modelo"
                  defaultValue={p.modelo || ""}
                  disabled={!grupos}
                >
                  <option value="">Todos</option>
                  {o.vehiculos.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Precio
                <select name="precio" defaultValue={p.precio || ""}>
                  <option value="">Todos</option>
                  <option value="sin">Pendiente de precio</option>
                  <option value="con">Con precio</option>
                </select>
              </label>
              <label>
                Existencias
                <select name="stock" defaultValue={p.stock || ""}>
                  <option value="">Todas</option>
                  <option value="disponible">Disponible</option>
                  <option value="agotado">Agotado</option>
                  <option value="bajo">Bajo mínimo</option>
                </select>
              </label>
              <label>
                Orden
                <select name="orden" defaultValue={p.orden || "relevancia"}>
                  <option value="relevancia">Relevancia</option>
                  <option value="nombre">Nombre</option>
                  <option value="precio">Precio ascendente</option>
                  <option value="existencia">Mayor existencia</option>
                </select>
              </label>
            </div>
            <details
              open={Boolean(
                p.vehiculo ||
                  p.anio ||
                  p.marca ||
                  p.ubicacion ||
                  p.estado ||
                  p.precio_min ||
                  p.precio_max ||
                  p.categoria_origen,
              )}
            >
              <summary>
                <SlidersHorizontal size={16} /> Más filtros
              </summary>
              <div className="filtros">
                <label>
                  Marca
                  <select name="marca" defaultValue={p.marca || ""}>
                    <option value="">Todas</option>
                    {o.marcas.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Compatibilidad declarada (texto)
                  <input
                    name="vehiculo"
                    defaultValue={p.vehiculo}
                    placeholder="Texto del origen…"
                  />
                </label>
                <label>
                  Año confirmado
                  <input
                    name="anio"
                    type="number"
                    min="1900"
                    max="2200"
                    defaultValue={p.anio}
                  />
                </label>
                <label>
                  Ubicación
                  <input name="ubicacion" defaultValue={p.ubicacion} />
                </label>
                <label>
                  Precio mínimo USD
                  <input
                    name="precio_min"
                    type="number"
                    min="0"
                    step="0.0001"
                    defaultValue={p.precio_min}
                  />
                </label>
                <label>
                  Precio máximo USD
                  <input
                    name="precio_max"
                    type="number"
                    min="0"
                    step="0.0001"
                    defaultValue={p.precio_max}
                  />
                </label>
                <label>
                  Etiqueta original
                  <select
                    name="categoria_origen"
                    defaultValue={p.categoria_origen || ""}
                  >
                    <option value="">Todas</option>
                    {o.categorias_origen.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Estado
                  <select name="estado" defaultValue={p.estado || "activos"}>
                    <option value="activos">Activos</option>
                    <option value="inactivos">Inactivos</option>
                    <option value="todos">Todos</option>
                  </select>
                </label>
              </div>
              <small>
                Las agrupaciones sugieren piezas y vehículos a partir del texto
                o de tu clasificación manual. No certifican compatibilidad; el
                año solo consulta registros verificados.
              </small>
            </details>
          </Plegable>
          <div className="acciones">
            <button className="secundario">Aplicar filtros</button>
            <Link href="/inventario">Limpiar todos</Link>
          </div>
        </form>
        {activos.length > 0 && (
          <div className="chips">
            {activos
              .filter(([k]) => k !== "agrupar")
              .map(([k, v]) => {
                const q = new URLSearchParams(
                  Object.fromEntries(activos.filter(([a]) => a !== k)),
                );
                return (
                  <Link key={k} href={"/inventario?" + q}>
                    {nombresFiltros[k] || k}: {v} ×
                  </Link>
                );
              })}
          </div>
        )}
        {o.consultas.length > 0 && (
          <div className="chips">
            {o.consultas.map((c) => (
              <Link key={c.nombre} href={"/inventario?" + c.filtros}>
                {c.nombre}
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className="encabezado-lista">
        <h2>
          Catálogo <span>{d.total}</span>
        </h2>
        <span className="muted">Moneda de precios: USD</span>
      </div>
      {d.filas.length === 0 ? (
        <Vacio texto="No hay productos para esta búsqueda" />
      ) : (
        <div className="productos">
          {d.filas.map((a) => (
            <Link
              className="producto"
              key={a.id}
              href={
                "/inventario/" + a.id + "?volver=" + encodeURIComponent(regreso)
              }
            >
              <div className="producto-superior">
                <span className="etiqueta">
                  {a.categoria || "SIN CATEGORÍA"}
                </span>
                <span
                  className={
                    "estado " +
                    (Number(a.disponible) <= 0
                      ? "rojo"
                      : Number(a.disponible) < Number(a.minimo)
                        ? "ambar"
                        : "verde")
                  }
                >
                  {Number(a.disponible) <= 0
                    ? "Agotado"
                    : Number(a.disponible) < Number(a.minimo)
                      ? "Bajo mínimo"
                      : "Disponible"}
                </span>
              </div>
              <h3>{a.nombre}</h3>
              <p className="compatibilidad">
                {a.vehiculos?.join(" · ") ||
                  a.compatibilidad ||
                  "Vehículo por identificar"}
              </p>
              {a.referencia && (
                <small>
                  Ref. {a.referencia} · {a.marca}
                </small>
              )}
              {a.aproximado && (
                <small className="ambar">Coincidencia aproximada</small>
              )}
              <div className="producto-precio">
                <strong className={a.precio === null ? "pendiente" : ""}>
                  {monto(a.precio)}
                </strong>
                <span>
                  <b>{cantidad(a.disponible)}</b> disponibles
                </span>
              </div>
              <div className="producto-pie">
                <span>
                  Físicas {cantidad(a.fisico)} · Reservadas{" "}
                  {cantidad(a.reservado)}
                </span>
                <span>{a.ubicacion || "Sin ubicación"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Paginacion
        {...d}
        ruta="/inventario"
        parametros={Object.fromEntries(activos)}
      />
      {activos.length > 0 && (
        <details className="panel">
          <summary>Guardar esta consulta</summary>
          <form action={guardarConsulta} className="formulario">
            <input type="hidden" name="filtros" value={filtrosGuardados} />
            <label>
              Nombre
              <input name="nombre" required maxLength={80} />
            </label>
            <button>Guardar consulta</button>
          </form>
        </details>
      )}
      {edita && (
        <details className="panel" id="nuevo">
          <summary>
            <Plus size={18} /> Registrar producto
          </summary>
          <form action={guardarProducto} className="formulario">
            <label>
              Nombre
              <input name="nombre" required />
            </label>
            <label>
              Categoría
              <input name="categoria" />
            </label>
            <label>
              Descripción
              <textarea name="descripcion" />
            </label>
            <label>
              Compatibilidad declarada
              <input
                name="compatibilidad"
                placeholder="No se asignan vehículos automáticamente"
              />
            </label>
            <label>
              Marca
              <input name="marca" />
            </label>
            <label>
              Referencia
              <input name="referencia" />
            </label>
            <label>
              Alias / palabras de búsqueda
              <input name="alias" />
            </label>
            <label>
              Ubicación
              <input name="ubicacion" />
            </label>
            <label>
              Costo USD
              <input name="costo" inputMode="decimal" />
            </label>
            <label>
              Precio de venta USD
              <input name="precio" inputMode="decimal" />
            </label>
            <label>
              Stock mínimo
              <input
                name="minimo"
                inputMode="decimal"
                defaultValue="0"
                required
              />
            </label>
            <label className="checkbox">
              <input name="activo" type="checkbox" defaultChecked />
              Activo
            </label>
            <button>Crear producto</button>
            <small>
              Registra la existencia inicial desde el ajuste de su ficha.
            </small>
          </form>
        </details>
      )}
    </>
  );
}

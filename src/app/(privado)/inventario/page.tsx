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
  const { perfil } = await sesion();
  const edita = ["administrador", "inventario"].includes(perfil.rol);
  const [d, o] = await Promise.all([
    consultar<Pagina<Producto & { aproximado: boolean }>>("buscar_productos", {
      p: { ...p, pagina: pagina(p.pagina) },
    }),
    consultar<{
      categorias: string[];
      marcas: string[];
      consultas: { nombre: string; filtros: string }[];
    }>("opciones_catalogo"),
  ]);
  const activos = Object.entries(p).filter(
    ([k, v]) => v && !["pagina", "error", "guardado"].includes(k),
  );
  const regreso = new URLSearchParams(Object.fromEntries(activos)).toString();
  return (
    <>
      <Cabecera
        titulo="Inventario"
        subtitulo="La pieza correcta. Su precio. Lo que hay disponible."
      >
        {edita && (
          <a className="boton" href="#nuevo">
            <Plus size={18} />
            Nuevo producto
          </a>
        )}
      </Cabecera>
      <Avisos p={p} />
      <section className="panel buscador">
        <form>
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
          <div className="filtros">
            <label>
              Categoría
              <select name="categoria" defaultValue={p.categoria || ""}>
                <option value="">Todas</option>
                {o.categorias.map((c) => (
                  <option key={c}>{c}</option>
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
                p.precio_max,
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
                Vehículo
                <input
                  name="vehiculo"
                  defaultValue={p.vehiculo}
                  placeholder="Hilux, Cargo…"
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
                Estado
                <select name="estado" defaultValue={p.estado || "activos"}>
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                  <option value="todos">Todos</option>
                </select>
              </label>
            </div>
            <small>
              El año solo consulta compatibilidades estructuradas verificadas;
              el texto histórico no confirma años.
            </small>
          </details>
          <div className="acciones">
            <button className="secundario">Aplicar filtros</button>
            <Link href="/inventario">Limpiar todos</Link>
          </div>
        </form>
        {activos.length > 0 && (
          <div className="chips">
            {activos.map(([k, v]) => {
              const q = new URLSearchParams(
                Object.fromEntries(activos.filter(([a]) => a !== k)),
              );
              return (
                <Link key={k} href={"/inventario?" + q}>
                  {k}: {v} ×
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
                {a.compatibilidad || "Compatibilidad por verificar"}
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
            <input type="hidden" name="filtros" value={regreso} />
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

"use client";
import { LeerFotoCompra } from "./leer-foto-compra";
import { type FotoFactura, type RenglonLeido } from "@/lib/lectura-factura";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  PackagePlus,
  CheckCircle2,
  Trash2,
  Truck,
  ArrowRight,
} from "lucide-react";
import DecimalBase from "decimal.js";
import { monto, cantidad } from "@/lib/formatos";
import type { LineaRecepcion } from "@/lib/compras";
const Decimal = DecimalBase.clone({ precision: 128 });
type Resultado = {
  id: string;
  variante_id: string;
  nombre: string;
  costo: string | null;
  precio: string | null;
  disponible: string;
  referencia: string;
};
export function EditorRecepcion({
  proveedor,
  clave,
}: {
  proveedor: { id: string; nombre: string };
  clave: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(""),
    [pagina, setPagina] = useState(1),
    [resultados, setResultados] = useState<{
      filas: Resultado[];
      paginas: number;
    } | null>(null),
    [buscando, setBuscando] = useState(false),
    [errorBusqueda, setErrorBusqueda] = useState("");
  const [lineas, setLineas] = useState<LineaRecepcion[]>([]),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [revisado, setRevisado] = useState(false),
    [paso, setPaso] = useState<"editar" | "revisar">("editar"),
    [referencia, setReferencia] = useState(""),
    [observaciones, setObservaciones] = useState("");
  const [foto, setFoto] = useState<FotoFactura | null>(null),
    [totalFoto, setTotalFoto] = useState<string | null>(null),
    [omitidasFoto, setOmitidasFoto] = useState<string[]>([]),
    [opcionesFoto, setOpcionesFoto] = useState<Record<string, Resultado[]>>({});
  async function cargarFoto(
    filas: RenglonLeido[],
    imagen: FotoFactura,
    total: string | null,
    omitidas: string[],
  ) {
    if (lineas.length + filas.length > 200)
      throw new Error(
        "Una compra admite hasta 200 líneas. Divide el documento.",
      );
    const normal = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    const nuevas: LineaRecepcion[] = [],
      opciones: Record<string, Resultado[]> = {};
    for (const f of filas) {
      const r = await fetch(
        "/api/compras/buscar?" + new URLSearchParams({ q: f.nombre }),
      );
      const d = await r.json();
      if (!r.ok)
        throw new Error(
          d.error || "No se pudo contrastar el inventario. Inténtalo de nuevo.",
        );
      const key = crypto.randomUUID(),
        exactas = (d.filas as Resultado[]).filter(
          (p) => normal(p.nombre) === normal(f.nombre),
        );
      opciones[key] = d.filas;
      const existente = exactas.length === 1 ? exactas[0] : null;
      nuevas.push({
        ocr_key: key,
        variante_id: existente?.variante_id || null,
        nombre: existente?.nombre || f.nombre,
        cantidad: f.cantidad,
        costo_unitario: f.costo,
        ...(!existente
          ? {
              nuevo: {
                id: crypto.randomUUID(),
                nombre: f.nombre,
                categoria: "",
              },
            }
          : {}),
      });
    }
    setLineas((ls) => [...ls, ...nuevas]);
    setOpcionesFoto((old) => ({ ...old, ...opciones }));
    setFoto(imagen);
    setTotalFoto(total);
    setOmitidasFoto(omitidas);
    setRevisado(false);
  }
  const tablaRecibida = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (foto)
      tablaRecibida.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [foto]);
  const numero = (x: string) => x.trim().replace(",", ".");
  useEffect(() => {
    if (!q.trim()) {
      setResultados(null);
      setBuscando(false);
      setErrorBusqueda("");
      return;
    }
    const c = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      setErrorBusqueda("");
      try {
        const r = await fetch(
          "/api/compras/buscar?" +
            new URLSearchParams({ q, pagina: String(pagina) }),
          { signal: c.signal },
        );
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "No se pudo buscar.");
        setResultados(d);
      } catch (e) {
        if (!c.signal.aborted)
          setErrorBusqueda(
            e instanceof Error ? e.message : "No se pudo buscar.",
          );
      } finally {
        if (!c.signal.aborted) setBuscando(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [q, pagina]);
  let total = "";
  try {
    const t = lineas.reduce(
      (s, l) =>
        s.plus(new Decimal(numero(l.cantidad)).times(numero(l.costo_unitario))),
      new Decimal(0),
    );
    if (t.isFinite() && !t.isNegative() && lineas.length) total = t.toFixed();
  } catch {}
  function elegir(p: Resultado) {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.variante_id === p.variante_id);
      if (i >= 0)
        return ls.map((l, n) =>
          n === i
            ? {
                ...l,
                cantidad: (() => {
                  try {
                    const n = new Decimal(numero(l.cantidad) || "0");
                    return n.isFinite() ? n.plus(1).toFixed() : l.cantidad;
                  } catch {
                    return l.cantidad;
                  }
                })(),
              }
            : l,
        );
      return [
        ...ls,
        {
          variante_id: p.variante_id,
          nombre: p.nombre,
          cantidad: "1",
          costo_unitario: p.costo || "",
        },
      ];
    });
  }
  function editar(
    i: number,
    campo: "cantidad" | "costo_unitario",
    valor: string,
  ) {
    setLineas((ls) =>
      ls.map((l, n) => (n === i ? { ...l, [campo]: valor } : l)),
    );
  }
  function revisar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!lineas.length || !total) {
      setError("Añade productos con cantidad y costo válidos.");
      return;
    }
    if (
      lineas.some((l) => {
        try {
          return (
            new Decimal(numero(l.cantidad)).lte(0) ||
            new Decimal(numero(l.costo_unitario)).lt(0)
          );
        } catch {
          return true;
        }
      })
    ) {
      setError("Revisa cantidades y costos.");
      return;
    }
    setRevisado(false);
    setPaso("revisar");
  }
  async function confirmar() {
    setOcupado(true);
    setError("");
    try {
      const r = await fetch("/api/compras/recibir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clave,
          proveedor_id: proveedor.id,
          moneda: "USD",
          referencia,
          observaciones,
          ...(foto ? { foto } : {}),
          lineas: lineas.map((l) => ({
            variante_id: l.variante_id,
            cantidad: numero(l.cantidad),
            costo_unitario: numero(l.costo_unitario),
            ...(l.nuevo ? { nuevo: l.nuevo } : {}),
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo registrar.");
      router.push("/proveedores/" + proveedor.id + "/recepciones/" + d.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="recepcion-editor">
      <section className="panel recepcion-proveedor">
        <Truck size={24} />
        <div>
          <span className="etiqueta">RECIBIR DE</span>
          <h2>{proveedor.nombre}</h2>
          <p className="muted">
            USD · Compra a crédito · Último costo recibido
          </p>
        </div>
      </section>
      {paso === "editar" ? (
        <>
          {!foto && <LeerFotoCompra cargar={cargarFoto} disabled={ocupado} />}
          {foto && (
            <div className="panel">
              <p className="exito">
                Foto incorporada a esta compra. Se guardará al confirmar. Revisa
                cada coincidencia del catálogo y cada importe.
              </p>
              <details>
                <summary>Ver foto y líneas sin incorporar</summary>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="foto-factura-previa"
                  src={"data:image/jpeg;base64," + foto.base64}
                  alt="Factura de proveedor para comparar con la tabla"
                />
                {omitidasFoto.length > 0 && (
                  <>
                    <p>
                      Estas líneas no se cargaron automáticamente. Añade
                      manualmente los productos que falten:
                    </p>
                    <pre className="texto-ocr">{omitidasFoto.join("\n")}</pre>
                  </>
                )}
              </details>
              <button
                type="button"
                className="secundario"
                onClick={() => {
                  setFoto(null);
                  setTotalFoto(null);
                }}
              >
                Retirar foto
              </button>
            </div>
          )}
          <section className="panel">
            <span className="etiqueta">01 · ELIGE LO QUE LLEGÓ</span>
            <h2>Añadir productos</h2>
            <label htmlFor="buscar-productos-compra">
              Buscar en tu inventario
            </label>
            <div className="busqueda">
              <Search size={18} />
              <input
                id="buscar-productos-compra"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPagina(1);
                  setResultados(null);
                }}
                placeholder="Starlink, faro, referencia…"
              />
            </div>
            {buscando && <p role="status">Buscando…</p>}
            {errorBusqueda && (
              <p className="aviso" role="alert">
                {errorBusqueda}
              </p>
            )}
            <div className="resultados-venta">
              {resultados?.filas.map((p) => (
                <button
                  className="secundario resultado-venta"
                  type="button"
                  key={p.variante_id}
                  onClick={() => elegir(p)}
                >
                  <strong>{p.nombre}</strong>
                  <small>
                    {cantidad(p.disponible)} disponibles · Último costo:{" "}
                    {p.costo === null ? "Sin registrar" : monto(p.costo)}
                  </small>
                  <span>Añadir a la recepción +</span>
                </button>
              ))}
            </div>
            {resultados?.filas.length === 0 && (
              <p className="muted">
                No hay productos con ese nombre. Puedes crear uno nuevo abajo.
              </p>
            )}
            <div className="acciones">
              {pagina > 1 && (
                <button
                  type="button"
                  className="secundario"
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </button>
              )}
              {resultados && pagina < resultados.paginas && (
                <button
                  type="button"
                  className="secundario"
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </button>
              )}
            </div>
            <details className="crear-producto-compra">
              <summary>¿No existe todavía? Crear producto nuevo</summary>
              <p className="muted">
                Revisa primero el buscador. Solo se creará al confirmar la
                recepción, con precio de venta pendiente.
              </p>
              <form
                className="formulario"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const nombre = String(f.get("nombre") || "").trim();
                  if (!nombre) return;
                  setLineas((ls) => [
                    ...ls,
                    {
                      variante_id: null,
                      nombre,
                      cantidad: "1",
                      costo_unitario: "",
                      nuevo: {
                        id: crypto.randomUUID(),
                        nombre,
                        categoria: String(f.get("categoria") || "").trim(),
                      },
                    },
                  ]);
                  e.currentTarget.reset();
                }}
              >
                <label>
                  Nombre del producto nuevo
                  <input
                    name="nombre"
                    maxLength={200}
                    required
                    placeholder="Kit Starlink…"
                  />
                </label>
                <label>
                  Categoría o etiqueta
                  <input
                    name="categoria"
                    maxLength={100}
                    placeholder="Conectividad, iluminación…"
                  />
                </label>
                <button type="submit" className="secundario">
                  <Plus size={17} /> Añadir producto nuevo
                </button>
              </form>
            </details>
          </section>
          <form onSubmit={revisar} ref={tablaRecibida}>
            <section className="panel">
              <span className="etiqueta">02 · CANTIDADES Y COSTOS</span>
              <h2>Mercancía recibida</h2>
              {!lineas.length && (
                <div className="vacio">
                  <PackagePlus size={34} />
                  <p>Selecciona un producto o crea uno nuevo para empezar.</p>
                </div>
              )}
              {lineas.map((l, i) => (
                <div
                  className="linea-editor linea-recepcion"
                  key={l.ocr_key || l.variante_id || l.nuevo!.id}
                >
                  <div>
                    {l.nuevo ? (
                      <label>
                        Producto
                        <input
                          value={l.nombre}
                          maxLength={200}
                          required
                          onChange={(e) =>
                            setLineas((ls) =>
                              ls.map((x, n) =>
                                n === i
                                  ? {
                                      ...x,
                                      nombre: e.target.value,
                                      nuevo: {
                                        ...x.nuevo!,
                                        nombre: e.target.value,
                                      },
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                    ) : (
                      <strong>{l.nombre}</strong>
                    )}
                    {l.ocr_key && (
                      <label>
                        Registro en inventario
                        <select
                          value={l.variante_id || ""}
                          onChange={(e) =>
                            setLineas((ls) =>
                              ls.map((x, n) => {
                                if (n !== i) return x;
                                const p = opcionesFoto[l.ocr_key!]?.find(
                                  (p) => p.variante_id === e.target.value,
                                );
                                return p
                                  ? {
                                      ...x,
                                      variante_id: p.variante_id,
                                      nombre: p.nombre,
                                      nuevo: undefined,
                                    }
                                  : {
                                      ...x,
                                      variante_id: null,
                                      nuevo: {
                                        id: crypto.randomUUID(),
                                        nombre: x.nombre,
                                        categoria: "",
                                      },
                                    };
                              }),
                            )
                          }
                        >
                          <option value="">
                            Crear producto nuevo (revisar)
                          </option>
                          {opcionesFoto[l.ocr_key]?.map((p) => (
                            <option key={p.variante_id} value={p.variante_id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <small className="muted">
                      {l.nuevo
                        ? "Nuevo · precio de venta pendiente"
                        : "Producto existente · conserva su precio de venta"}
                    </small>
                  </div>
                  <label>
                    Cantidad recibida
                    <input
                      aria-label={"Cantidad recibida " + (i + 1)}
                      value={l.cantidad}
                      inputMode="decimal"
                      required
                      onChange={(e) => editar(i, "cantidad", e.target.value)}
                    />
                  </label>
                  <label>
                    Costo unitario USD
                    <input
                      aria-label={"Costo unitario " + (i + 1)}
                      value={l.costo_unitario}
                      inputMode="decimal"
                      required
                      onChange={(e) =>
                        editar(i, "costo_unitario", e.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="secundario"
                    aria-label={"Quitar producto " + (i + 1)}
                    onClick={() =>
                      setLineas((ls) => ls.filter((_, n) => n !== i))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {totalFoto && total && (
                <p
                  className={
                    new Decimal(total).eq(totalFoto) ? "exito" : "aviso"
                  }
                >
                  Total leído en la foto: {monto(totalFoto)} · Total de la
                  tabla: {monto(total)}.{" "}
                  {new Decimal(total).eq(totalFoto)
                    ? "Coinciden."
                    : "Son diferentes: revisa si faltan productos, impuestos o descuentos."}
                </p>
              )}
              <div className="formulario">
                <label>
                  Factura o referencia del proveedor
                  <input
                    value={referencia}
                    maxLength={100}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Opcional; ayuda a evitar duplicados"
                  />
                </label>
                <label>
                  Observaciones
                  <textarea
                    value={observaciones}
                    maxLength={4000}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </label>
              </div>
              <div className="total-factura">
                <span>Total a deber al proveedor · USD</span>
                <strong>
                  {total ? monto(total) : "Añade cantidades y costos"}
                </strong>
                {total && <small>Total exacto USD: {total}</small>}
              </div>
              <button disabled={!lineas.length || !total}>
                Revisar recepción <ArrowRight size={17} />
              </button>
              <p className="nota-grafico">
                Ingresa el costo unitario final. No se añade impuesto ni gastos
                automáticamente. Revisar todavía no modifica inventario ni
                cuentas.
              </p>
            </section>
          </form>
        </>
      ) : (
        <section className="panel">
          <span className="etiqueta">03 · CONFIRMA LO RECIBIDO</span>
          <h2>Revisa antes de sumar al inventario</h2>
          {foto && <p>Se guardará la foto de la factura con esta compra.</p>}
          {totalFoto && total && !new Decimal(total).eq(totalFoto) && (
            <p className="aviso">
              El total de la foto ({monto(totalFoto)}) difiere de la tabla (
              {monto(total)}). Vuelve a editar si falta un concepto. Se
              registrará únicamente el total de la tabla.
            </p>
          )}
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Unidades que entran</th>
                  <th>Costo unitario</th>
                  <th>Total USD</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {l.nombre}
                      {l.nuevo && (
                        <small className="muted">
                          {" "}
                          · Se creará; venta pendiente
                        </small>
                      )}
                    </td>
                    <td>{cantidad(numero(l.cantidad))}</td>
                    <td>{monto(numero(l.costo_unitario))}</td>
                    <td>
                      {monto(
                        new Decimal(numero(l.cantidad))
                          .times(numero(l.costo_unitario))
                          .toFixed(),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="total-factura">
            <span>Deuda nueva con {proveedor.nombre}</span>
            <strong>{monto(total)}</strong>
            <small>Total exacto USD: {total}</small>
          </div>
          <p>
            Al confirmar se suman las unidades, se actualiza el último costo y
            se registra la deuda en una sola operación. Los productos existentes
            conservan su precio de venta.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={revisado}
              onChange={(e) => setRevisado(e.target.checked)}
              disabled={ocupado}
            />{" "}
            Confirmo que recibí esta mercancía y revisé cantidades, costos y
            proveedor.
          </label>
          <div className="acciones">
            <button
              type="button"
              disabled={ocupado || !revisado}
              onClick={confirmar}
            >
              <CheckCircle2 size={18} />
              {ocupado ? "Registrando…" : "Confirmar recepción y deuda"}
            </button>
            <button
              type="button"
              className="secundario"
              disabled={ocupado}
              onClick={() => setPaso("editar")}
            >
              Volver a editar
            </button>
          </div>
        </section>
      )}
      {error && (
        <p className="aviso" role="alert">
          {error}{" "}
          <a href={"/proveedores/" + proveedor.id + "/recepciones/" + clave}>
            Comprobar si se registró →
          </a>
        </p>
      )}
    </div>
  );
}

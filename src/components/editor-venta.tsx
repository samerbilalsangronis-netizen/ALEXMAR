"use client";
import { METODOS_PAGO } from "@/lib/pagos";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, Check, ArrowLeft } from "lucide-react";
import DecimalBase from "decimal.js";
import { NuevoProductoVenta } from "./nuevo-producto-venta";
import { monto, cantidad } from "@/lib/formatos";
import type { LineaVenta, Venta } from "@/lib/ventas";
const Decimal = DecimalBase.clone({ precision: 128 });
export type ResultadoVenta = {
  id: string;
  variante_id?: string;
  nombre: string;
  documento?: string;
  precio?: string | null;
  disponible?: string;
};
type Resultados = { filas: ResultadoVenta[]; paginas: number };
export function Busqueda({
  tipo,
  elegir,
  inicial,
  permitirSinPrecio = false,
}: {
  tipo: "clientes" | "productos";
  elegir: (r: ResultadoVenta) => void;
  inicial?: Resultados;
  permitirSinPrecio?: boolean;
}) {
  const id = useId(),
    [q, setQ] = useState(""),
    [pagina, setPagina] = useState(1),
    [d, setD] = useState<Resultados | null>(inicial || null),
    [error, setError] = useState(""),
    [abierto, setAbierto] = useState(false),
    [indice, setIndice] = useState(-1),
    [cargando, setCargando] = useState(false);
  const cache = useRef(
    new Map<string, Resultados>(inicial ? [["|1", inicial]] : []),
  );
  useEffect(() => {
    const clave = q + "|" + pagina,
      cached = cache.current.get(clave);
    let vigente = true;
    if (cached) {
      setD(cached);
      setCargando(false);
      setError("");
      return;
    }
    const c = new AbortController();
    setCargando(true);
    setError("");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          "/api/facturacion/buscar?" +
            new URLSearchParams({ tipo, q, pagina: String(pagina) }),
          { signal: c.signal },
        );
        const valor = await r.json();
        if (!r.ok) throw new Error(valor.error || "No se pudo buscar.");
        if (vigente) {
          if (cache.current.size >= 30)
            cache.current.delete(cache.current.keys().next().value!);
          cache.current.set(clave, valor);
          setD(valor);
          setIndice(-1);
        }
      } catch (e) {
        if (vigente) {
          setError(e instanceof Error ? e.message : "No se pudo buscar.");
          setD(null);
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }, 140);
    return () => {
      vigente = false;
      clearTimeout(t);
      c.abort();
    };
  }, [q, pagina, tipo]);
  const seleccionar = (r: ResultadoVenta) => {
    if (tipo === "productos" && r.precio == null && !permitirSinPrecio) return;
    elegir(r);
    setAbierto(false);
    setQ("");
    setPagina(1);
    setIndice(-1);
  };
  return (
    <div
      className="factura-combobox"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false);
      }}
    >
      <label htmlFor={id}>
        {tipo === "clientes" ? "Buscar cliente" : "Añadir producto"}
      </label>
      <div className="factura-buscador">
        <Search size={17} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={abierto}
          aria-controls={id + "-lista"}
          aria-activedescendant={
            abierto && indice >= 0 ? id + "-" + indice : undefined
          }
          placeholder={
            tipo === "clientes"
              ? "Nombre, cédula / RIF o teléfono"
              : "Escribe las primeras letras: filtro Toyota…"
          }
          value={q}
          onFocus={() => setAbierto(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setPagina(1);
            setIndice(-1);
            setAbierto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setAbierto(false);
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setAbierto(true);
              setIndice((i) =>
                Math.max(
                  0,
                  Math.min(
                    (d?.filas.length || 1) - 1,
                    i + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (abierto && !cargando && indice >= 0 && d?.filas[indice])
                seleccionar(d.filas[indice]);
              else setAbierto(true);
            }
          }}
        />
      </div>
      {abierto && (
        <div className="factura-sugerencias">
          {cargando && <p role="status">Buscando…</p>}
          {error && <p role="alert">{error}</p>}
          <div
            id={id + "-lista"}
            role="listbox"
            aria-label={
              tipo === "clientes"
                ? "Clientes encontrados"
                : "Productos encontrados"
            }
            aria-busy={cargando}
          >
            {d?.filas.map((r, i) => (
              <button
                id={id + "-" + i}
                key={r.variante_id || r.id}
                role="option"
                aria-selected={i === indice}
                type="button"
                disabled={
                  cargando ||
                  (tipo === "productos" &&
                    r.precio == null &&
                    !permitirSinPrecio)
                }
                className={i === indice ? "seleccionado" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => seleccionar(r)}
              >
                <span>
                  <strong>{r.nombre}</strong>
                  <small>
                    {tipo === "clientes"
                      ? r.documento || "Sin documento"
                      : cantidad(r.disponible) + " disponibles"}
                  </small>
                </span>
                <b>
                  {tipo === "productos"
                    ? r.precio == null && permitirSinPrecio
                      ? "Definir precio"
                      : monto(r.precio)
                    : "Seleccionar"}
                </b>
              </button>
            ))}
          </div>
          {!cargando && d?.filas.length === 0 && (
            <p>No hay coincidencias. Prueba con menos palabras.</p>
          )}
          {d && d.paginas > 1 && (
            <div className="acciones">
              <button
                type="button"
                className="secundario"
                disabled={pagina === 1 || cargando}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </button>
              <small>
                Página {pagina} de {d.paginas}
              </small>
              <button
                type="button"
                className="secundario"
                disabled={pagina >= d.paginas || cargando}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function NuevoCliente({ elegir }: { elegir: (r: ResultadoVenta) => void }) {
  const [abierto, setAbierto] = useState(false),
    [nombre, setNombre] = useState(""),
    [documento, setDocumento] = useState(""),
    [telefono, setTelefono] = useState(""),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const clave = useRef<string | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const foco = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (abierto) {
      dialogo.current?.showModal();
      foco.current?.focus();
    } else dialogo.current?.close();
  }, [abierto]);
  async function crear() {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      clave.current ??= crypto.randomUUID();
      const r = await fetch("/api/facturacion/cliente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: clave.current,
            nombre,
            documento,
            telefono,
          }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo registrar.");
      elegir(d);
      setAbierto(false);
      setNombre("");
      setDocumento("");
      setTelefono("");
      clave.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <button
        className="texto factura-enlace"
        type="button"
        onClick={() => setAbierto(true)}
      >
        + Cliente nuevo
      </button>
      <dialog
        className="factura-dialogo"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (nombre.trim().length >= 2) void crear();
          }
        }}
        ref={dialogo}
        onCancel={(e) => {
          if (ocupado) e.preventDefault();
          else setAbierto(false);
        }}
        aria-labelledby="titulo-cliente-nuevo"
      >
        <h2 id="titulo-cliente-nuevo">Registrar cliente</h2>
        <p>Se seleccionará en esta factura al guardar.</p>
        {error && (
          <p role="alert" className="aviso">
            {error}
          </p>
        )}
        <label>
          Nombre del cliente
          <input
            ref={foco}
            value={nombre}
            maxLength={200}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label>
          Cédula / RIF (opcional)
          <input
            value={documento}
            maxLength={80}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </label>
        <label>
          Teléfono (opcional)
          <input
            value={telefono}
            maxLength={80}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </label>
        <div className="acciones">
          <button
            type="button"
            className="secundario"
            disabled={ocupado}
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupado || nombre.trim().length < 2}
            onClick={crear}
          >
            {ocupado ? "Guardando…" : "Guardar y seleccionar"}
          </button>
        </div>
      </dialog>
    </>
  );
}
export function EditorVenta({
  clave,
  administrador,
  inicial,
  clientes,
  productos,
  descontarStock = true,
  cuentaCliente,
}: {
  clave: string;
  administrador: boolean;
  inicial: Venta | null;
  clientes?: Resultados;
  productos?: Resultados;
  descontarStock?: boolean;
  cuentaCliente?: ResultadoVenta;
}) {
  const router = useRouter(),
    [cliente, setCliente] = useState<ResultadoVenta | null>(
      inicial?.cliente_id
        ? {
            id: inicial.cliente_id,
            nombre: inicial.cliente.nombre,
            documento: inicial.cliente.documento || undefined,
          }
        : cuentaCliente || null,
    ),
    [lineas, setLineas] = useState<LineaVenta[]>(inicial?.lineas || []);
  const [condicion, setCondicion] = useState<"contado" | "credito">(
      inicial
        ? inicial.condicion ||
            (new Decimal(inicial.abono).eq(inicial.total)
              ? "contado"
              : "credito")
        : cuentaCliente
          ? "credito"
          : "contado",
    ),
    [abono, setAbono] = useState(inicial?.abono || "0"),
    [descuento, setDescuento] = useState(inicial?.descuento || "0"),
    [metodo, setMetodo] = useState(inicial?.metodo_pago || "Efectivo"),
    [vence, setVence] = useState(inicial?.vence || ""),
    [notas, setNotas] = useState(inicial?.observaciones || ""),
    [gratis, setGratis] = useState(inicial?.permite_gratis || false),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [revision, setRevision] = useState(false);
  const [busquedaVersion, setBusquedaVersion] = useState(0);
  const enviando = useRef(false);
  const revisionRef = useRef<HTMLElement>(null);
  const numero = (s: string) => s.trim().replace(",", ".");
  let subtotal = "",
    total = "",
    saldo = "",
    pago = "";
  try {
    subtotal = lineas
      .reduce(
        (s, l) =>
          s.plus(
            new Decimal(numero(l.cantidad) || 0).times(numero(l.precio) || 0),
          ),
        new Decimal(0),
      )
      .toFixed();
    total = new Decimal(subtotal).minus(numero(descuento) || 0).toFixed();
    pago = condicion === "contado" ? total : numero(abono) || "0";
    saldo = new Decimal(total).minus(pago).toFixed();
  } catch {}
  function editar(
    i: number,
    k: "cantidad" | "precio" | "descripcion",
    v: string,
  ) {
    setLineas((ls) =>
      ls.map((l, n) =>
        n === i
          ? {
              ...l,
              [k]: v,
              ...(k === "precio" && l.variante_id
                ? { precio_personalizado: true }
                : {}),
            }
          : l,
      ),
    );
    setError("");
  }
  function agregar(r: ResultadoVenta) {
    if (r.precio == null && !administrador) return;
    if (
      lineas.length >= 200 &&
      !lineas.some((l) => l.variante_id === r.variante_id)
    ) {
      setError("La factura admite hasta 200 líneas.");
      return;
    }
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.variante_id === r.variante_id);
      if (i < 0)
        return [
          ...ls,
          {
            variante_id: r.variante_id!,
            descripcion: r.nombre,
            cantidad: "1",
            precio: r.precio ?? "",
            ...(r.precio == null ? { precio_personalizado: true } : {}),
          },
        ];
      return ls.map((l, n) =>
        n === i
          ? {
              ...l,
              cantidad:
                l.precio_personalizado || l.precio === r.precio
                  ? new Decimal(numero(l.cantidad) || 0).plus(1).toFixed()
                  : l.cantidad,
              precio: l.precio_personalizado ? l.precio : (r.precio ?? ""),
            }
          : l,
      );
    });
    setError("");
  }
  function validar() {
    if (!cliente) throw new Error("Selecciona un cliente.");
    if (!lineas.length)
      throw new Error("Añade al menos un producto o servicio.");
    if (
      !total ||
      !new Decimal(total).isFinite() ||
      new Decimal(total).lt(0) ||
      !saldo ||
      !new Decimal(saldo).isFinite() ||
      new Decimal(saldo).lt(0) ||
      !new Decimal(pago).isFinite() ||
      new Decimal(pago).lt(0)
    )
      throw new Error("Revisa cantidades, precios, descuento y abono.");
    for (const l of lineas) {
      if (!numero(l.cantidad) || !numero(l.precio))
        throw new Error("Completa las cantidades y los precios.");
      const c = new Decimal(numero(l.cantidad)),
        v = new Decimal(numero(l.precio));
      if (
        !c.isFinite() ||
        !v.isFinite() ||
        !c.gt(0) ||
        c.gte(100000000) ||
        c.decimalPlaces() > 4 ||
        v.lt(0)
      )
        throw new Error(
          "Revisa cantidades positivas (hasta 4 decimales) y precios no negativos.",
        );
      if (!l.variante_id && !l.descripcion.trim())
        throw new Error("Escribe la descripción del servicio.");
    }
  }
  function revisar(e: React.FormEvent) {
    e.preventDefault();
    try {
      validar();
      setError("");
      setRevision(true);
      setTimeout(() => revisionRef.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisa los datos.");
    }
  }
  async function guardar(emitir: boolean) {
    if (enviando.current) return;
    try {
      validar();
      enviando.current = true;
      setOcupado(true);
      setError("");
      const p = {
        id: clave,
        version: inicial?.version || 0,
        cliente_id: cliente!.id,
        moneda: "USD",
        tipo: "factura",
        condicion,
        impuesto_tasa: "0",
        lineas: lineas.map((l) => ({
          ...l,
          cantidad: numero(l.cantidad),
          precio: numero(l.precio),
        })),
        descuento: numero(descuento) || "0",
        abono: pago,
        metodo_pago: new Decimal(pago).gt(0) ? metodo : "",
        vence: condicion === "credito" ? vence : "",
        observaciones: notas,
        permite_gratis: gratis,
      };
      const r = await fetch(
          "/api/facturacion/guardar" + (emitir ? "?emitir=1" : ""),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          },
        ),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
      router.push(
        cuentaCliente && emitir
          ? "/clientes/" + cuentaCliente.id + "?guardado=1"
          : "/facturacion/" + d.id,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      setBusquedaVersion((v) => v + 1);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  const hoy = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    dateStyle: "medium",
  }).format(new Date());
  return (
    <form className="factura-rapida" onSubmit={revisar} aria-busy={ocupado}>
      <p className="factura-stock-aviso">
        {descontarStock
          ? "Inventario activo: al emitir se descontarán las piezas y se comprobará la existencia disponible."
          : "Descuento de inventario desactivado: puedes vender sin existencia registrada. Esta factura no cambiará las cantidades del inventario."}
        {administrador && (
          <a href="/configuracion#inventario"> Configurar inventario →</a>
        )}
      </p>
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
      {revision ? (
        <section
          className="panel factura-revision"
          ref={revisionRef}
          tabIndex={-1}
        >
          <span className="eyebrow">ANTES DE EMITIR</span>
          <h2>
            {cuentaCliente
              ? "Revisa el cargo a la cuenta"
              : "Revisa tu factura"}
          </h2>
          <p>
            <strong>{cliente?.nombre}</strong> ·{" "}
            {condicion === "contado" ? "Contado" : "Crédito"} · USD
          </p>
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Producto / servicio</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td>{l.descripcion}</td>
                    <td>{cantidad(l.cantidad)}</td>
                    <td>{monto(l.precio)}</td>
                    <td>
                      {monto(
                        new Decimal(numero(l.cantidad))
                          .times(numero(l.precio))
                          .toFixed(),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="factura-revision-total">
            <strong>Total {monto(total)}</strong>
            <p>
              Cobrar ahora: {monto(pago)}
              {new Decimal(pago).gt(0) ? " · " + metodo : ""}
            </p>
            <p>Saldo pendiente: {monto(saldo)}</p>
            <small>Total exacto USD: {total}</small>
          </div>
          <p>
            Al emitir se registrarán la factura y su cobro.{" "}
            {descontarStock
              ? "Se descontarán las existencias."
              : "No se descontará inventario."}{" "}
            El número se asigna al emitir.
          </p>
          <div className="acciones">
            <button
              type="button"
              className="secundario"
              disabled={ocupado}
              onClick={() => setRevision(false)}
            >
              <ArrowLeft size={16} /> Volver a editar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => guardar(true)}
            >
              <Check size={16} />
              {ocupado
                ? "Guardando…"
                : cuentaCliente
                  ? "Confirmar cargo a la cuenta"
                  : "Confirmar y emitir"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="panel factura-cabecera-form">
            <div className="factura-cliente">
              {!cuentaCliente && (
                <Busqueda
                  tipo="clientes"
                  elegir={setCliente}
                  key={"clientes-" + busquedaVersion}
                  inicial={busquedaVersion === 0 ? clientes : undefined}
                />
              )}
              {cliente && (
                <div className="factura-cliente-elegido">
                  <Check size={16} />
                  <strong>{cliente.nombre}</strong>
                  <small>{cliente.documento}</small>
                  {!cuentaCliente && (
                    <button
                      type="button"
                      className="texto"
                      onClick={() => setCliente(null)}
                    >
                      Cambiar
                    </button>
                  )}
                </div>
              )}
              {!cuentaCliente && <NuevoCliente elegir={setCliente} />}
            </div>
            <div className="factura-fecha">
              <small>Fecha de emisión</small>
              <strong>{hoy}</strong>
              <span className="etiqueta">USD · Impuesto 0</span>
            </div>
            {cuentaCliente ? (
              <p className="etiqueta">
                Cargo a la cuenta del cliente · Crédito
              </p>
            ) : (
              <fieldset className="factura-condicion">
                <legend>Condición de venta</legend>
                <div className="factura-segmentos">
                  {(["contado", "credito"] as const).map((c) => (
                    <label key={c}>
                      <input
                        type="radio"
                        name="condicion"
                        checked={condicion === c}
                        onChange={() => setCondicion(c)}
                      />
                      <span>{c === "contado" ? "Contado" : "Crédito"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </section>
          <section className="panel factura-productos">
            {administrador && (
              <p className="muted">
                El precio se toma del inventario. Puedes editar el precio
                unitario para esta operación; el total es cantidad × precio y el
                catálogo conserva su precio.
              </p>
            )}
            <Busqueda
              tipo="productos"
              elegir={agregar}
              key={"productos-" + busquedaVersion}
              inicial={busquedaVersion === 0 ? productos : undefined}
            />
            {administrador && (
              <NuevoProductoVenta
                elegir={(r) => {
                  agregar(r);
                  setBusquedaVersion((v) => v + 1);
                }}
              />
            )}
            {lineas.length === 0 ? (
              <div className="factura-vacia">
                <Search size={28} />
                <h2>
                  {cuentaCliente
                    ? "¿Qué productos vas a cargar?"
                    : "¿Qué vas a facturar?"}
                </h2>
                <p>
                  Busca por nombre o primeras letras. El precio de venta se
                  coloca solo.
                </p>
                <small>Ejemplo: filtro Toyota</small>
              </div>
            ) : (
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Producto / servicio</th>
                      <th>Cantidad</th>
                      <th>Precio unitario USD</th>
                      <th>Total USD</th>
                      <th>
                        <span className="sr-only">Quitar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => {
                      let importe = "";
                      try {
                        importe = new Decimal(numero(l.cantidad) || 0)
                          .times(numero(l.precio) || 0)
                          .toFixed();
                      } catch {}
                      return (
                        <tr key={i}>
                          <td>
                            {l.variante_id ? (
                              <>
                                <strong>{l.descripcion}</strong>
                                <small className="factura-catalogo">
                                  {l.precio_personalizado
                                    ? "Precio para esta operación"
                                    : "Precio de inventario"}
                                </small>
                              </>
                            ) : (
                              <input
                                aria-label={"Descripción servicio " + (i + 1)}
                                value={l.descripcion}
                                required
                                onChange={(e) =>
                                  editar(i, "descripcion", e.target.value)
                                }
                              />
                            )}
                          </td>
                          <td>
                            <input
                              className="factura-numero"
                              aria-label={"Cantidad " + l.descripcion}
                              inputMode="decimal"
                              value={l.cantidad}
                              required
                              onChange={(e) =>
                                editar(i, "cantidad", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            {l.variante_id && !administrador ? (
                              <strong>{monto(l.precio)}</strong>
                            ) : (
                              <input
                                className="factura-numero"
                                aria-label={
                                  l.variante_id
                                    ? "Precio unitario " + l.descripcion
                                    : "Precio servicio " + (i + 1)
                                }
                                inputMode="decimal"
                                value={l.precio}
                                required
                                onChange={(e) =>
                                  editar(i, "precio", e.target.value)
                                }
                              />
                            )}
                          </td>
                          <td>
                            {importe ? monto(importe) : "Revisa cantidad"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secundario factura-quitar"
                              aria-label={"Quitar " + l.descripcion}
                              onClick={() =>
                                setLineas((ls) => ls.filter((_, n) => i !== n))
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button
              type="button"
              className="secundario factura-servicio"
              disabled={lineas.length >= 200}
              onClick={() =>
                setLineas((ls) => [
                  ...ls,
                  {
                    variante_id: null,
                    descripcion: "",
                    cantidad: "1",
                    precio: "",
                  },
                ])
              }
            >
              <Plus size={16} /> Añadir servicio / instalación
            </button>
          </section>
          <div className="factura-pie-form">
            <div>
              <section className="panel factura-cobro">
                <h2>
                  {condicion === "contado"
                    ? "Cobro al contado"
                    : "Abono y vencimiento"}
                </h2>
                {condicion === "contado" ? (
                  <p>
                    Se registrará el cobro completo de{" "}
                    <strong>{total ? monto(total) : "—"}</strong>.
                  </p>
                ) : (
                  <div className="filtros">
                    <label>
                      Abono inicial USD
                      <input
                        inputMode="decimal"
                        value={abono}
                        onChange={(e) => setAbono(e.target.value)}
                      />
                    </label>
                    <label>
                      Vencimiento (opcional)
                      <input
                        type="date"
                        value={vence}
                        onChange={(e) => setVence(e.target.value)}
                      />
                    </label>
                  </div>
                )}
                <label>
                  Método de cobro
                  <select
                    aria-label="Método de cobro"
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                  >
                    {METODOS_PAGO.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </section>
            </div>
            <aside className="panel factura-resumen">
              <div>
                <span>Subtotal</span>
                <strong>{subtotal ? monto(subtotal) : "—"}</strong>
              </div>
              <div>
                <span>Descuento</span>
                <span>{monto(descuento || "0")}</span>
              </div>
              <div>
                <span>Impuesto</span>
                <span>0 %</span>
              </div>
              <div className="factura-gran-total">
                <span>Total USD</span>
                <strong>{total ? monto(total) : "—"}</strong>
              </div>
              <div>
                <span>Saldo pendiente</span>
                <strong>{saldo ? monto(saldo) : "—"}</strong>
              </div>
              <small>Total exacto: {total || "—"} USD</small>
            </aside>
          </div>
          <footer className="factura-barra">
            <div>
              <small>TOTAL USD</small>
              <strong>{total ? monto(total) : "—"}</strong>
            </div>
            <div className="acciones">
              {!cuentaCliente && (
                <button
                  type="button"
                  className="secundario"
                  disabled={ocupado}
                  onClick={() => guardar(false)}
                >
                  {ocupado ? "Guardando…" : "Guardar borrador"}
                </button>
              )}
              <button
                type="submit"
                disabled={ocupado || !lineas.length || !cliente}
              >
                {cuentaCliente ? "Revisar cargo" : "Revisar y emitir"}
              </button>
            </div>
          </footer>
        </>
      )}
    </form>
  );
}

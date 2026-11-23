"use client";
import { useEffect, useRef, useState, useId } from "react";
import { useRouter } from "next/navigation";
import DecimalBase from "decimal.js";
import { Plus, Trash2 } from "lucide-react";
import { METODOS_PAGO } from "@/lib/pagos";
import { monto } from "@/lib/formatos";
import {
  lineasRapidas,
  importeVisible,
  totalRapido,
  normalDecimal,
  type FilaRapida,
} from "@/lib/venta-rapida";
import type { ResultadoVenta } from "./editor-venta";
const Decimal = DecimalBase.clone({ precision: 128 });
function vacia(): FilaRapida {
  return {
    clave: crypto.randomUUID(),
    cantidad: "1",
    descripcion: "",
    precio: "",
    variante_id: null,
    tipo: "producto",
  };
}
function CeldaProducto({
  fila,
  actualizar,
  inicial,
  indice,
}: {
  fila: FilaRapida;
  actualizar: (c: Partial<FilaRapida>) => void;
  inicial: ResultadoVenta[];
  indice: number;
}) {
  const [abierto, setAbierto] = useState(false),
    [opciones, setOpciones] = useState(inicial),
    [error, setError] = useState(""),
    [seleccion, setSeleccion] = useState(-1);
  const id = useId();
  useEffect(() => {
    if (!abierto || fila.tipo === "servicio") return;
    if (!fila.descripcion.trim()) {
      setOpciones(inicial);
      setError("");
      return;
    }
    const c = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          "/api/facturacion/buscar?" +
            new URLSearchParams({
              tipo: "productos",
              q: fila.descripcion,
              pagina: "1",
            }),
          { signal: c.signal },
        );
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "No se pudo buscar.");
        setOpciones(d.filas);
        setError("");
      } catch (e) {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo buscar.");
      }
    }, 140);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [abierto, fila.descripcion, fila.tipo, inicial]);
  function elegir(r: ResultadoVenta) {
    actualizar({
      descripcion: r.nombre,
      variante_id: r.variante_id!,
      precio: r.precio ?? "",
      tipo: "producto",
    });
    setAbierto(false);
    setSeleccion(-1);
  }
  return (
    <div
      className="rapida-producto"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false);
      }}
    >
      <input
        aria-label={`Producto o servicio fila ${indice + 1}`}
        data-col="1"
        value={fila.descripcion}
        role="combobox"
        aria-expanded={abierto && fila.tipo !== "servicio"}
        aria-controls={id}
        aria-autocomplete="list"
        placeholder="Escribe el nombre o elige del inventario"
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          actualizar({ descripcion: e.target.value, variante_id: null });
          setAbierto(true);
          setSeleccion(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setAbierto(false);
            e.stopPropagation();
          }
          if (
            abierto &&
            e.altKey &&
            opciones.length &&
            fila.tipo !== "servicio" &&
            ["ArrowDown", "ArrowUp"].includes(e.key)
          ) {
            e.preventDefault();
            e.stopPropagation();
            setSeleccion((n) =>
              Math.max(
                0,
                Math.min(
                  opciones.length - 1,
                  n + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          }
          if (
            e.key === "Enter" &&
            abierto &&
            seleccion >= 0 &&
            opciones[seleccion]
          ) {
            e.preventDefault();
            e.stopPropagation();
            elegir(opciones[seleccion]);
          }
        }}
      />
      {abierto && fila.tipo !== "servicio" && (
        <div id={id} role="listbox" className="rapida-sugerencias">
          {opciones.map((r, i) => (
            <button
              type="button"
              role="option"
              aria-selected={i === seleccion}
              key={r.variante_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(r)}
            >
              {r.nombre} ·{" "}
              {r.precio === null ? "Definir precio" : monto(r.precio)}
            </button>
          ))}
          {error && <p role="alert">{error}</p>}
          <small>
            Puedes dejar el nombre escrito para completar su inventario después.
          </small>
        </div>
      )}
      <div className="rapida-tipo">
        <button
          type="button"
          className="texto"
          title="Cambiar entre producto y servicio o instalación"
          onClick={() => {
            actualizar({
              tipo: fila.tipo === "producto" ? "servicio" : "producto",
              variante_id: null,
            });
            setAbierto(false);
          }}
        >
          {fila.tipo === "servicio"
            ? "Servicio / instalación"
            : fila.variante_id
              ? "Vinculado al inventario"
              : "Producto"}
        </button>
        {fila.descripcion.trim() &&
          !fila.variante_id &&
          fila.tipo === "producto" && <small>Pendiente de inventario</small>}
      </div>
    </div>
  );
}
export function EditorVentaRapida({
  clave,
  cliente,
  productos,
}: {
  clave: string;
  cliente?: ResultadoVenta;
  productos: ResultadoVenta[];
}) {
  const [filas, setFilas] = useState<FilaRapida[]>(() =>
      Array.from({ length: 15 }, (_, i) => ({
        clave: "fila-" + i,
        cantidad: "1",
        descripcion: "",
        precio: "",
        variante_id: null,
        tipo: "producto",
      })),
    ),
    [metodo, setMetodo] = useState("Efectivo"),
    [abono, setAbono] = useState("0"),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [revision, setRevision] = useState(false);
  const tabla = useRef<HTMLDivElement>(null),
    enviando = useRef(false),
    router = useRouter(),
    ident = useRef(clave).current;
  const hayCambios = filas.some(
    (f) =>
      f.descripcion.trim() ||
      f.precio.trim() ||
      (f.cantidad && f.cantidad !== "1"),
  );
  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambios]);
  let total = "",
    usadas = 0;
  try {
    const validas = filas.filter((f) => f.descripcion.trim());
    usadas = validas.length;
    total = validas
      .reduce((s, f) => {
        const valor = importeVisible(f);
        if (valor === null) throw new Error("Completa los importes");
        return s.plus(valor);
      }, new Decimal(0))
      .toFixed();
  } catch {}
  function actualizar(i: number, c: Partial<FilaRapida>) {
    setFilas((fs) => fs.map((f, n) => (n === i ? { ...f, ...c } : f)));
    setRevision(false);
    setError("");
  }
  function navegar(e: React.KeyboardEvent<HTMLElement>) {
    if (e.defaultPrevented || !tabla.current) return;
    const el = e.target as HTMLInputElement,
      row = Number(el.closest("tr")?.getAttribute("data-fila")),
      col = Number(el.dataset.col);
    let r = row,
      c = col;
    if (e.key === "ArrowUp") r--;
    else if (e.key === "ArrowDown") r++;
    else if (e.key === "Enter") c++;
    else if (e.key === "ArrowLeft" && el.selectionStart === 0) c--;
    else if (e.key === "ArrowRight" && el.selectionEnd === el.value.length) c++;
    else return;
    if (c > 2) {
      r++;
      c = 0;
    }
    if (c < 0) {
      r--;
      c = 2;
    }
    const destino = tabla.current.querySelector<HTMLInputElement>(
      `tr[data-fila="${r}"] input[data-col="${c}"]`,
    );
    if (destino) {
      e.preventDefault();
      destino.focus();
      destino.select();
    }
  }
  async function emitir(f: HTMLFormElement) {
    if (enviando.current) return;
    setError("");
    try {
      const ls = lineasRapidas(filas),
        suma = totalRapido(ls),
        pago = cliente ? normalDecimal(abono) || "0" : suma;
      if (
        !/^[0-9]{1,16}(\.[0-9]{1,84})?$/.test(pago) ||
        new Decimal(pago).gt(suma)
      )
        throw new Error("Revisa el abono: no puede superar el total.");
      if (!revision) {
        setRevision(true);
        return;
      }
      enviando.current = true;
      setOcupado(true);
      const fd = new FormData(f);
      const p = {
        id: ident,
        version: 0,
        cliente_id: cliente?.id || null,
        cliente_contado: cliente
          ? undefined
          : {
              nombre: String(fd.get("nombre") || ""),
              documento: String(fd.get("documento") || ""),
              telefono: String(fd.get("telefono") || ""),
              direccion: "",
            },
        condicion: cliente ? "credito" : "contado",
        moneda: "USD",
        descuento: "0",
        abono: pago,
        metodo_pago: new Decimal(pago).gt(0) ? metodo : "",
        lineas: ls,
        observaciones: "",
        permite_gratis: false,
      };
      const r = await fetch("/api/facturacion/rapida", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo emitir.");
      router.push(
        cliente
          ? "/clientes/" + cliente.id + "?guardado=1"
          : "/facturacion/" + d.id,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo emitir.");
      setRevision(false);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  return (
    <form
      className="venta-rapida"
      onSubmit={(e) => {
        e.preventDefault();
        void emitir(e.currentTarget);
      }}
    >
      <fieldset disabled={ocupado}>
        {cliente ? (
          <section className="panel">
            <strong>{cliente.nombre}</strong>
            <p>Cargo a su cuenta a crédito.</p>
          </section>
        ) : (
          <details className="panel" open>
            <summary>
              Datos para el comprobante · No crea una cuenta de cliente
            </summary>
            <div className="filtros">
              <label>
                Nombre (opcional)
                <input
                  name="nombre"
                  maxLength={200}
                  placeholder="Consumidor final"
                />
              </label>
              <label>
                Cédula / RIF (opcional)
                <input name="documento" maxLength={80} />
              </label>
              <label>
                Teléfono (opcional)
                <input name="telefono" maxLength={80} />
              </label>
            </div>
          </details>
        )}
        <section className="panel">
          <h2>Productos y servicios</h2>
          <p className="muted">
            Completa las filas que necesites. ↑ ↓ cambian de fila; ← → cambian
            de campo al inicio o final del texto. Enter avanza. Alt + ↑ ↓
            recorre las sugerencias y Enter selecciona; Escape las cierra.
          </p>
          <div ref={tabla} className="tabla-contenedor tabla-rapida">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cantidad</th>
                  <th>Producto / servicio</th>
                  <th>Precio unitario USD</th>
                  <th>Total USD</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const importe = f.descripcion.trim()
                    ? importeVisible(f)
                    : null;
                  return (
                    <tr key={f.clave} data-fila={i}>
                      <td>{i + 1}</td>
                      <td>
                        <input
                          data-col="0"
                          aria-label={`Cantidad fila ${i + 1}`}
                          inputMode="decimal"
                          value={f.cantidad}
                          maxLength={20}
                          onChange={(e) =>
                            actualizar(i, { cantidad: e.target.value })
                          }
                          onKeyDown={navegar}
                        />
                      </td>
                      <td
                        onKeyDown={(e) => {
                          if (e.target instanceof HTMLInputElement) navegar(e);
                        }}
                      >
                        <CeldaProducto
                          fila={f}
                          indice={i}
                          actualizar={(c) => actualizar(i, c)}
                          inicial={productos}
                        />
                      </td>
                      <td>
                        <input
                          data-col="2"
                          aria-label={`Precio fila ${i + 1}`}
                          inputMode="decimal"
                          value={f.precio}
                          maxLength={100}
                          onChange={(e) =>
                            actualizar(i, { precio: e.target.value })
                          }
                          onKeyDown={navegar}
                        />
                      </td>
                      <td>{importe ? monto(importe) : "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="secundario"
                          aria-label={`Vaciar fila ${i + 1}`}
                          onClick={() =>
                            actualizar(i, {
                              descripcion: "",
                              cantidad: "1",
                              precio: "",
                              variante_id: null,
                              tipo: "producto",
                            })
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
          <button
            type="button"
            className="secundario"
            disabled={filas.length >= 200}
            onClick={() =>
              setFilas((fs) => [
                ...fs,
                ...Array.from({ length: Math.min(5, 200 - fs.length) }, vacia),
              ])
            }
          >
            <Plus size={17} /> Agregar 5 filas
          </button>
        </section>
        <section className="panel filtros">
          <label>
            Método de pago
            <select
              aria-label="Método de pago"
              value={metodo}
              onChange={(e) => {
                setMetodo(e.target.value);
                setRevision(false);
              }}
            >
              {METODOS_PAGO.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          {cliente && (
            <label>
              Abono recibido ahora USD
              <input
                aria-label="Abono recibido ahora USD"
                inputMode="decimal"
                value={abono}
                onChange={(e) => {
                  setAbono(e.target.value);
                  setRevision(false);
                }}
              />
            </label>
          )}
          <div>
            <span>{cliente ? "Total a cargar" : "Cobro al contado"}</span>
            <strong className="rapida-total">
              {total ? monto(total) : "Completa los precios"}
            </strong>
            <small>
              {usadas} líneas · Total exacto USD: {total || "—"}
            </small>
          </div>
        </section>
        {revision && (
          <section className="panel exito" role="status">
            <strong>
              Revisión: {monto(total)} · {cliente ? cliente.nombre : "Contado"}
            </strong>
            <p>
              Se guardarán las filas completas. Los productos escritos sin
              vínculo quedarán en Productos sin cargar; los servicios no se
              añaden al inventario.
            </p>
            <button
              type="button"
              className="secundario"
              onClick={() => setRevision(false)}
            >
              Volver a editar
            </button>
          </section>
        )}
        <div className="acciones">
          <button disabled={ocupado}>
            {ocupado
              ? "Guardando…"
              : revision
                ? cliente
                  ? "Confirmar cargo a la cuenta"
                  : "Confirmar y emitir factura"
                : cliente
                  ? "Revisar cargo"
                  : "Revisar factura"}
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

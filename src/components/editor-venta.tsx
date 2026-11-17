"use client";
import {
  Search,
  UserRound,
  PackagePlus,
  ReceiptText,
  Plus,
  Check,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DecimalBase from "decimal.js";
import { monto, cantidad } from "@/lib/formatos";
import type { LineaVenta, Venta } from "@/lib/ventas";
const Decimal = DecimalBase.clone({ precision: 128 });
type Resultado = {
  id: string;
  variante_id?: string;
  nombre: string;
  documento?: string;
  precio?: string | null;
  disponible?: string;
};
function Busqueda({
  tipo,
  elegir,
}: {
  tipo: "clientes" | "productos";
  elegir: (r: Resultado) => void;
}) {
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [d, setD] = useState<{ filas: Resultado[]; paginas: number } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(async () => {
      setCargando(true);
      setError("");
      setD(null);
      try {
        const r = await fetch(
          "/api/facturacion/buscar?" +
            new URLSearchParams({ tipo, q, pagina: String(pagina) }),
          { signal: c.signal },
        );
        if (!r.ok) {
          const e = await r.json();
          throw new Error(e.error || "No se pudo buscar.");
        }
        setD(await r.json());
      } catch (e) {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo buscar.");
      } finally {
        if (!c.signal.aborted) setCargando(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [q, pagina, tipo]);
  return (
    <div className="busqueda-factura">
      <label>
        {tipo === "clientes" ? "Buscar cliente" : "Buscar producto por nombre"}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPagina(1);
          }}
          placeholder={
            tipo === "clientes"
              ? "Nombre, documento o teléfono"
              : "Nombre, referencia o vehículo"
          }
        />
      </label>
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
      {cargando && <p role="status">Buscando…</p>}
      <div className="resultados-venta">
        {d?.filas.map((r) => (
          <button
            type="button"
            className="secundario resultado-venta"
            key={r.id}
            onClick={() => elegir(r)}
          >
            <strong>{r.nombre}</strong>
            <small>
              {tipo === "productos"
                ? `${monto(r.precio)} · ${cantidad(r.disponible)} disponibles`
                : r.documento || "Sin documento"}
            </small>
            <span>
              {tipo === "productos"
                ? "Añadir a la factura +"
                : "Seleccionar cliente →"}
            </span>
          </button>
        ))}
      </div>
      {d?.filas.length === 0 && <p>No hay resultados para esta búsqueda.</p>}
      <div className="acciones">
        {pagina > 1 && (
          <button
            type="button"
            className="secundario"
            onClick={() => setPagina((n) => n - 1)}
          >
            Anterior
          </button>
        )}
        {d && pagina < d.paginas && (
          <button
            type="button"
            className="secundario"
            onClick={() => setPagina((n) => n + 1)}
          >
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}
export function EditorVenta({
  clave,
  administrador,
  inicial,
}: {
  clave: string;
  administrador: boolean;
  inicial: Venta | null;
}) {
  const router = useRouter();
  const [cliente, setCliente] = useState<Resultado | null>(
    inicial ? { id: inicial.cliente_id, nombre: inicial.cliente.nombre } : null,
  );
  const [lineas, setLineas] = useState<LineaVenta[]>(inicial?.lineas || []);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [descuento, setDescuento] = useState(inicial?.descuento || "0");
  const [abono, setAbono] = useState(inicial?.abono || "0");
  const numero = (s: string) => s.trim().replace(",", ".");
  let total = "";
  try {
    total = lineas
      .reduce(
        (s, l) =>
          s.plus(
            new Decimal(numero(l.cantidad) || 0).times(numero(l.precio) || 0),
          ),
        new Decimal(0),
      )
      .minus(numero(descuento) || 0)
      .toFixed();
  } catch {}
  function editar(
    i: number,
    k: "descripcion" | "cantidad" | "precio",
    v: string,
  ) {
    setLineas((ls) => ls.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  }
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cliente) {
      setError("Selecciona un cliente.");
      return;
    }
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    setError("");
    try {
      const r = await fetch("/api/facturacion/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clave,
          version: inicial?.version || 0,
          cliente_id: cliente.id,
          moneda: "USD",
          impuesto_tasa: "0",
          tipo: f.get("tipo"),
          lineas: lineas.map((l) => ({
            ...l,
            cantidad: numero(l.cantidad),
            precio: numero(l.precio),
          })),
          descuento: numero(descuento),
          abono: numero(abono),
          metodo_pago: f.get("metodo_pago"),
          vence: f.get("vence"),
          observaciones: f.get("observaciones"),
          permite_gratis: f.get("permite_gratis") === "on",
        }),
      });
      if (!r.headers.get("content-type")?.includes("application/json"))
        throw new Error(`No se pudo guardar (HTTP ${r.status}).`);
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "No se pudo guardar.");
      router.push("/facturacion/" + d.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="flujo-factura">
      <nav className="pasos-factura" aria-label="Preparar factura">
        <span className={cliente ? "completo" : ""}>
          <UserRound size={17} /> 01 · Cliente {cliente && <Check size={14} />}
        </span>
        <span className={lineas.length ? "completo" : ""}>
          <PackagePlus size={17} /> 02 · Piezas y servicios
        </span>
        <span>
          <ReceiptText size={17} /> 03 · Revisar y emitir
        </span>
      </nav>
      <div className="seleccion-factura">
        <section className="panel">
          <span className="etiqueta">EMPECEMOS POR LA PERSONA</span>
          <h2>1. Cliente</h2>
          {cliente && (
            <p className="exito">
              Seleccionado: <strong>{cliente.nombre}</strong>
            </p>
          )}
          <details open={!cliente}>
            <summary>
              {cliente ? "Cambiar cliente" : "Seleccionar cliente"}
            </summary>
            <Busqueda tipo="clientes" elegir={setCliente} />
          </details>
        </section>
        <section className="panel">
          <span className="etiqueta">ARMA TU VENTA</span>
          <h2>2. Productos y servicios</h2>
          <details open>
            <summary>Añadir productos del inventario</summary>
            <Busqueda
              tipo="productos"
              elegir={(p) =>
                setLineas((ls) => [
                  ...ls,
                  {
                    variante_id: p.variante_id!,
                    descripcion: p.nombre,
                    cantidad: "1",
                    precio: p.precio || "",
                  },
                ])
              }
            />
          </details>
          <button
            type="button"
            className="secundario"
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
            <Plus size={17} /> Añadir servicio
          </button>
        </section>
      </div>
      <form onSubmit={guardar} className="documento-factura">
        <fieldset disabled={ocupado} className="panel editor-factura">
          <legend>Tu factura</legend>
          <p className="muted">{lineas.length} líneas · USD · Impuesto 0</p>
          {lineas.map((l, i) => (
            <div key={l.id || i} className="linea-editor">
              <label>
                {l.variante_id ? "Producto" : "Servicio"}
                <input
                  aria-label={"Descripción " + (i + 1)}
                  value={l.descripcion}
                  readOnly={Boolean(l.variante_id)}
                  required
                  onChange={(e) => editar(i, "descripcion", e.target.value)}
                />
              </label>
              <label>
                Cantidad
                <input
                  aria-label={"Cantidad " + (i + 1)}
                  value={l.cantidad}
                  inputMode="decimal"
                  required
                  onChange={(e) => editar(i, "cantidad", e.target.value)}
                />
              </label>
              <label>
                Precio USD
                <input
                  aria-label={"Precio " + (i + 1)}
                  value={l.precio}
                  inputMode="decimal"
                  required
                  readOnly={Boolean(l.variante_id) && !administrador}
                  onChange={(e) => editar(i, "precio", e.target.value)}
                />
              </label>
              <button
                type="button"
                className="secundario"
                onClick={() => setLineas((ls) => ls.filter((_, n) => i !== n))}
                aria-label={"Quitar línea " + (i + 1)}
              >
                Quitar
              </button>
            </div>
          ))}
          {lineas.length === 0 && <p>Añade al menos un producto o servicio.</p>}
          <div className="atajos-pago">
            <span>Forma de cobro</span>
            <button
              type="button"
              className="secundario"
              onClick={() => setAbono("0")}
            >
              A crédito
            </button>
            <button
              type="button"
              className="secundario"
              disabled={!total || new Decimal(total).isNegative()}
              onClick={() => setAbono(total)}
            >
              Contado · total completo
            </button>
          </div>
          <div className="formulario">
            <label>
              Documento
              <select name="tipo" defaultValue={inicial?.tipo || "factura"}>
                <option value="factura">Borrador de factura</option>
                <option value="presupuesto">Presupuesto</option>
              </select>
            </label>
            <label>
              Descuento autorizado USD
              <input
                value={descuento}
                inputMode="decimal"
                readOnly={!administrador}
                onChange={(e) => setDescuento(e.target.value)}
              />
            </label>
            <label>
              Pago inicial USD
              <input
                value={abono}
                inputMode="decimal"
                required
                onChange={(e) => setAbono(e.target.value)}
              />
              <small>
                0 para crédito; el total para contado; un monto menor para pago
                parcial.
              </small>
            </label>
            <label>
              Método del pago inicial
              <select
                name="metodo_pago"
                defaultValue={inicial?.metodo_pago || ""}
              >
                <option value="">Selecciona si hay pago</option>
                {[
                  "Efectivo",
                  "Transferencia",
                  "Pago móvil",
                  "Tarjeta",
                  "Otro",
                ].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Vencimiento
              <input
                type="date"
                name="vence"
                defaultValue={inicial?.vence || ""}
              />
            </label>
            <label>
              Observaciones
              <textarea
                name="observaciones"
                maxLength={4000}
                defaultValue={inicial?.observaciones || ""}
              />
            </label>
            {administrador && (
              <label className="checkbox">
                <input
                  name="permite_gratis"
                  type="checkbox"
                  defaultChecked={inicial?.permite_gratis}
                />
                Autorizo las líneas o entregas gratuitas de este documento
              </label>
            )}
          </div>
          <div className="total-factura">
            <span>Total estimado · impuesto 0</span>
            <strong>{total ? monto(total) : "Revisa los importes"}</strong>
            <small>
              Total exacto USD: {total || "—"}. Revisa el cálculo definitivo en
              el borrador.
            </small>
          </div>
          {error && (
            <p className="aviso" role="alert">
              {error}
            </p>
          )}
          <button
            className="guardar-factura"
            disabled={ocupado || !cliente || lineas.length === 0}
          >
            {ocupado ? "Guardando…" : "Guardar y revisar borrador"}{" "}
            <ArrowRight size={17} />
          </button>
          <p className="muted">
            Este paso no descuenta existencias ni registra un cobro. Emitirás la
            factura después de revisar el borrador.
          </p>
        </fieldset>
      </form>
    </div>
  );
}

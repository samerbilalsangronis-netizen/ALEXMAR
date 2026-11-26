"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, History } from "lucide-react";
import DecimalBase from "decimal.js";
import { METODOS_PAGO } from "@/lib/pagos";
import { monto, type Pagina } from "@/lib/formatos";
import type { AbonoEditable, CorreccionAbono } from "@/lib/abonos";
const Decimal = DecimalBase.clone({ precision: 128 });
const fechaHora = (s: string) =>
  new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(new Date(s));
export function CorregirAbonoCliente({ abono }: { abono: AbonoEditable }) {
  const dialog = useRef<HTMLDialogElement>(null),
    intento = useRef<{ clave: string; firma: string } | null>(null),
    enviando = useRef(false),
    router = useRouter();
  const [abierto, setAbierto] = useState(false),
    [importe, setImporte] = useState(abono.actual),
    [metodo, setMetodo] = useState(abono.metodo),
    [referencia, setReferencia] = useState(abono.referencia),
    [motivo, setMotivo] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revisar, setRevisar] = useState(false),
    [historial, setHistorial] = useState<Pagina<CorreccionAbono> | null>(null),
    [pagina, setPagina] = useState(1),
    [cargando, setCargando] = useState(false),
    [errorHistoria, setErrorHistoria] = useState("");
  useEffect(() => {
    if (!abierto) return;
    const c = new AbortController();
    setCargando(true);
    setErrorHistoria("");
    fetch(
      "/api/clientes/abonos/historial?" +
        new URLSearchParams({
          tipo: abono.tipo,
          id: abono.id,
          pagina: String(pagina),
        }),
      { signal: c.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setHistorial(d);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setErrorHistoria(e.message || "No se pudo consultar.");
      })
      .finally(() => {
        if (!c.signal.aborted) setCargando(false);
      });
    return () => c.abort();
  }, [abierto, abono.tipo, abono.id, pagina]);
  function abrir() {
    setImporte(abono.actual);
    setMetodo(abono.metodo);
    setReferencia(abono.referencia);
    setMotivo("");
    setRevisar(false);
    setError("");
    setHistorial(null);
    setPagina(1);
    setAbierto(true);
    dialog.current?.showModal();
  }
  function cerrar() {
    setAbierto(false);
    dialog.current?.close();
  }
  function preparar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const n = importe.trim().replace(",", ".");
    if (
      !/^[0-9]{1,16}(\.[0-9]{1,84})?$/.test(n) ||
      new Decimal(n).gte("10000000000000000")
    ) {
      setError(
        "Indica un monto de cero en adelante, sin separadores de miles.",
      );
      return;
    }
    if (motivo.trim().length < 5) {
      setError("Escribe el motivo de la corrección.");
      return;
    }
    setRevisar(true);
  }
  async function guardar() {
    if (enviando.current) return;
    enviando.current = true;
    setBusy(true);
    setError("");
    try {
      const p = {
        id: abono.id,
        tipo: abono.tipo,
        cliente_id: abono.cliente_id,
        revision: abono.revision,
        monto: importe.trim().replace(",", "."),
        metodo,
        referencia: referencia.trim(),
        motivo: motivo.trim(),
        confirmado: true,
      };
      const firma = JSON.stringify(p);
      if (intento.current?.firma !== firma)
        intento.current = { clave: crypto.randomUUID(), firma };
      const r = await fetch("/api/clientes/abonos/corregir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...p, clave: intento.current!.clave }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo corregir.");
      cerrar();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo corregir.");
      setRevisar(false);
    } finally {
      enviando.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="secundario" onClick={abrir}>
        <Pencil size={15} />
        {abono.editable ? "Editar abono" : "Ver abono"}
      </button>
      <dialog
        ref={dialog}
        className="factura-dialogo correccion-abono"
        aria-label="Corregir abono"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setAbierto(false);
        }}
      >
        <h2>Corregir abono</h2>
        <p>
          Original: <strong>{monto(abono.original, abono.moneda)}</strong> ·{" "}
          {fechaHora(abono.creado)} · {abono.autor}
        </p>
        <small>
          Importe original exacto: {abono.original} {abono.moneda}
        </small>
        <p>
          Importe vigente: <strong>{monto(abono.actual, abono.moneda)}</strong>.
          El original se conserva; cada corrección queda registrada con
          responsable y motivo.
        </p>
        {!abono.editable && <p className="aviso">{abono.impedimento}</p>}
        {abono.editable && (
          <form onSubmit={preparar} className="formulario">
            <label>
              Monto correcto {abono.moneda}
              <input
                value={importe}
                inputMode="decimal"
                required
                readOnly={revisar || busy}
                onChange={(e) => setImporte(e.target.value)}
              />
            </label>
            <label>
              Método correcto
              <select
                aria-label="Método correcto"
                value={metodo}
                disabled={revisar || busy}
                onChange={(e) => setMetodo(e.target.value)}
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Referencia
              <input
                value={referencia}
                maxLength={200}
                readOnly={revisar || busy}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </label>
            <label>
              Motivo de corrección
              <textarea
                value={motivo}
                minLength={5}
                maxLength={1000}
                required
                readOnly={revisar || busy}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            <small>
              Si el abono completo fue registrado por error, puedes dejar el
              monto correcto en 0.
            </small>
            {!revisar && <button>Revisar corrección</button>}
          </form>
        )}
        {revisar && (
          <section className="panel">
            <p>
              Cambiar de {monto(abono.actual, abono.moneda)} a{" "}
              <strong>{monto(importe.replace(",", "."), abono.moneda)}</strong>{" "}
              por {metodo}.
            </p>
            <p>
              El saldo se recalculará y se ajustarán las aplicaciones a
              facturas. Esta operación registra una corrección; no mueve dinero
              en bancos.
            </p>
            <div className="acciones">
              <button
                type="button"
                className="secundario"
                disabled={busy}
                onClick={() => setRevisar(false)}
              >
                Volver a editar
              </button>
              <button type="button" disabled={busy} onClick={guardar}>
                {busy ? "Guardando…" : "Confirmar corrección"}
              </button>
            </div>
          </section>
        )}
        {error && (
          <p className="aviso" role="alert">
            {error}
          </p>
        )}
        <details>
          <summary>
            <History size={16} />
            Historial de correcciones ({abono.correcciones})
          </summary>
          {cargando && <p role="status">Consultando…</p>}
          {errorHistoria && <p role="alert">{errorHistoria}</p>}
          {historial?.filas.map((c) => (
            <article className="panel" key={c.id}>
              <strong>
                {monto(c.anterior, abono.moneda)} →{" "}
                {monto(c.nuevo, abono.moneda)}
              </strong>
              {(new Decimal(c.anterior).decimalPlaces() > 2 ||
                new Decimal(c.nuevo).decimalPlaces() > 2) && (
                <small>
                  Importes exactos: {c.anterior} → {c.nuevo} {abono.moneda}
                </small>
              )}
              <p>
                {c.metodo_anterior} → {c.metodo} ·{" "}
                {c.referencia || "Sin referencia"}
              </p>
              <p>{c.motivo}</p>
              <small>
                {fechaHora(c.creado)} · {c.autor}
              </small>
            </article>
          ))}
          {historial?.total === 0 && (
            <p>
              Este abono conserva sus datos originales y todavía no tiene
              correcciones.
            </p>
          )}
          <div className="acciones">
            {pagina > 1 && (
              <button
                type="button"
                className="secundario"
                onClick={() => setPagina(pagina - 1)}
              >
                Anteriores
              </button>
            )}
            {historial && pagina < historial.paginas && (
              <button
                type="button"
                className="secundario"
                onClick={() => setPagina(pagina + 1)}
              >
                Siguientes
              </button>
            )}
          </div>
        </details>
        <button
          type="button"
          className="secundario"
          disabled={busy}
          onClick={cerrar}
        >
          Cerrar
        </button>
      </dialog>
    </>
  );
}

"use client";
import { METODOS_PAGO } from "@/lib/pagos";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { monto } from "@/lib/formatos";
export function CobroFactura({ id, saldo }: { id: string; saldo: string }) {
  const router = useRouter(),
    [importe, setImporte] = useState(saldo),
    [metodo, setMetodo] = useState("Efectivo"),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [confirmando, setConfirmando] = useState(false);
  const intento = useRef<{
    idempotencia: string;
    monto: string;
    metodo: string;
  } | null>(null);
  const enviando = useRef(false);
  useEffect(() => {
    setImporte(saldo);
  }, [saldo]);
  async function cobrar() {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setError("");
    try {
      const normal = importe.trim().replace(",", ".");
      if (
        !intento.current ||
        intento.current.monto !== normal ||
        intento.current.metodo !== metodo
      )
        intento.current = {
          idempotencia: crypto.randomUUID(),
          monto: normal,
          metodo,
        };
      const r = await fetch("/api/facturacion/cobrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...intento.current }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo registrar el cobro.");
      intento.current = null;
      setImporte("");
      setConfirmando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cobrar.");
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  return (
    <section className="panel">
      <h2>Registrar cobro</h2>
      <p>
        Saldo pendiente: <strong>{monto(saldo)}</strong>
      </p>
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
      <form
        className="filtros"
        onSubmit={(e) => {
          e.preventDefault();
          const normal = importe.trim().replace(",", ".");
          if (
            !/^[0-9]{1,16}(\.[0-9]{1,84})?$/.test(normal) ||
            !new Decimal(normal).gt(0) ||
            new Decimal(normal).gt(saldo)
          ) {
            setError("Indica un monto positivo que no supere el saldo.");
            return;
          }
          setError("");
          setConfirmando(true);
        }}
      >
        <label>
          Monto USD
          <input
            inputMode="decimal"
            required
            readOnly={confirmando}
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
          />
        </label>
        <label>
          Método
          <select
            aria-label="Método"
            disabled={confirmando}
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
          >
            {METODOS_PAGO.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        {!confirmando && <button>Revisar cobro</button>}
      </form>
      {confirmando && (
        <div className="factura-confirmar-cobro">
          <p>
            Confirmo que recibí{" "}
            <strong>{monto(importe.replace(",", "."))}</strong> por {metodo}.
            Este registro reducirá la deuda del cliente.
          </p>
          <div className="acciones">
            <button
              type="button"
              className="secundario"
              disabled={ocupado}
              onClick={() => setConfirmando(false)}
            >
              Volver
            </button>
            <button type="button" disabled={ocupado} onClick={cobrar}>
              {ocupado ? "Registrando…" : "Confirmar cobro recibido"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { monto } from "@/lib/formatos";
export function AbonoCuenta({ id, saldo }: { id: string; saldo: string }) {
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
    saldo: string;
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
          saldo,
        };
      const r = await fetch("/api/clientes/abonar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: intento.current.idempotencia,
            cliente_id: id,
            monto: intento.current.monto,
            metodo: intento.current.metodo,
            moneda: "USD",
            saldo_esperado: intento.current.saldo,
            confirmado: true,
          }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo registrar el abono.");
      intento.current = null;
      setImporte("");
      setConfirmando(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar el abono.",
      );
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  if (new Decimal(saldo).lte(0))
    return (
      <section className="panel">
        <h2>Registrar abono</h2>
        <p>Este cliente no tiene saldo pendiente en USD para abonar.</p>
      </section>
    );
  return (
    <section className="panel">
      <h2>Registrar abono</h2>
      <p>
        Saldo pendiente: <strong>{monto(saldo)}</strong>
      </p>
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
      <p className="muted">
        Se aplica al saldo acumulado y después a los comprobantes pendientes por
        antigüedad. Solo registra dinero que ya recibiste.
      </p>
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
            disabled={confirmando}
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
          >
            {["Efectivo", "Transferencia", "Pago móvil", "Tarjeta", "Otro"].map(
              (m) => (
                <option key={m}>{m}</option>
              ),
            )}
          </select>
        </label>
        {!confirmando && <button>Revisar abono</button>}
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
              {ocupado ? "Registrando…" : "Confirmar abono recibido"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

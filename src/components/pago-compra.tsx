"use client";
import { METODOS_PAGO } from "@/lib/pagos";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { monto } from "@/lib/formatos";
export function PagoCompra({
  compra,
  clave,
  saldo,
}: {
  compra: string;
  clave: string;
  saldo: string;
}) {
  const router = useRouter();
  const [id, setId] = useState(clave),
    [importe, setImporte] = useState(""),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [confirmado, setConfirmado] = useState(false);
  async function registrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    setError("");
    try {
      const r = await fetch("/api/compras/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          compra_id: compra,
          monto: importe.trim().replace(",", "."),
          metodo: f.get("metodo"),
          referencia: f.get("referencia"),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo registrar el pago.");
      setId(crypto.randomUUID());
      setImporte("");
      setConfirmado(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar el pago.",
      );
    } finally {
      setOcupado(false);
    }
  }
  return (
    <details className="panel no-imprimir">
      <summary>Registrar pago al proveedor</summary>
      <p className="muted">
        Registra un pago que ya realizaste. Este formulario no mueve dinero de
        una cuenta bancaria. Saldo de esta compra: {monto(saldo)}.
      </p>
      <form onSubmit={registrar}>
        <fieldset disabled={ocupado} className="formulario">
          <label>
            Importe pagado USD
            <input
              value={importe}
              inputMode="decimal"
              required
              onChange={(e) => {
                setImporte(e.target.value);
                setConfirmado(false);
              }}
            />
          </label>
          <button
            type="button"
            className="secundario"
            onClick={() => {
              setImporte(saldo);
              setConfirmado(false);
            }}
          >
            Completar con el saldo
          </button>
          <label>
            Método del pago
            <select name="metodo" aria-label="Método del pago" required>
              <option value="">Selecciona</option>
              {METODOS_PAGO.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Referencia del pago
            <input name="referencia" maxLength={200} />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />{" "}
            Confirmo que este pago se realizó al proveedor.
          </label>
          <button disabled={!confirmado || ocupado}>
            {ocupado ? "Registrando…" : "Registrar pago realizado"}
          </button>
        </fieldset>
        {error && (
          <p className="aviso" role="alert">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}

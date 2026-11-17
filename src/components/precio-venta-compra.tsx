"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function PrecioVentaCompra({
  producto,
  nombre,
}: {
  producto: string;
  nombre: string;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(""),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    try {
      const r = await fetch("/api/compras/precio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: producto,
          precio: valor.trim().replace(",", "."),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo asignar el precio.");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo asignar el precio.",
      );
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="asignar-precio" onSubmit={guardar}>
      <label>
        Precio de venta USD · {nombre}
        <input
          value={valor}
          inputMode="decimal"
          required
          placeholder="Precio al cliente"
          disabled={ocupado}
          onChange={(e) => setValor(e.target.value)}
        />
      </label>
      <button disabled={ocupado || !valor.trim()}>
        {ocupado ? "Guardando…" : "Guardar precio de venta"}
      </button>
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Busqueda, type ResultadoVenta } from "./editor-venta";
import { NuevoProductoVenta } from "./nuevo-producto-venta";
export function CompletarProductoPendiente({
  linea,
  nombre,
  precio,
  productos,
}: {
  linea: string;
  nombre: string;
  precio: string;
  productos: ResultadoVenta[];
}) {
  const [elegido, setElegido] = useState<ResultadoVenta | null>(null),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    router = useRouter();
  async function vincular() {
    if (!elegido?.variante_id) return;
    setOcupado(true);
    setError("");
    try {
      const r = await fetch("/api/inventario/pendientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linea, variante: elegido.variante_id }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo vincular.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo vincular.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <details>
      <summary>Completar producto en inventario</summary>
      <p className="muted">
        Vincula al producto correcto o créalo. El nombre, precio e importe
        cobrados se conservan.
      </p>
      <Busqueda
        tipo="productos"
        permitirSinPrecio
        elegir={setElegido}
        inicial={{ filas: productos, paginas: 1 }}
      />
      <NuevoProductoVenta
        elegir={setElegido}
        nombreInicial={nombre}
        precioInicial={precio}
      />
      {elegido && (
        <>
          <p>
            Seleccionado: <strong>{elegido.nombre}</strong> ·{" "}
            <Link href={"/inventario/" + elegido.id}>
              Ver inventario y existencias
            </Link>
          </p>
          <button type="button" disabled={ocupado} onClick={vincular}>
            {ocupado ? "Vinculando…" : "Vincular y completar"}
          </button>
        </>
      )}
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}

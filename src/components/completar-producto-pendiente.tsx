"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Busqueda, type ResultadoVenta } from "./editor-venta";
import { guardarGestion } from "@/lib/gestion-cliente";
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
  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    try {
      const f = Object.fromEntries(new FormData(e.currentTarget));
      await guardarGestion("registrar_pendiente", {
        ...f,
        linea,
        stock: String(f.stock).replace(",", "."),
        precio: String(f.precio).replace(",", "."),
        costo: String(f.costo).replace(",", "."),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <details>
      <summary>Completar producto en inventario</summary>
      <p className="muted">
        Completa el producto aquí. La cantidad es la que tienes físicamente hoy;
        el precio cobrado en la venta se conserva.
      </p>
      <form className="formulario" onSubmit={crear}>
        <label>
          Nombre del producto
          <input
            name="nombre"
            required
            minLength={2}
            maxLength={200}
            defaultValue={nombre}
          />
        </label>
        <label>
          Stock físico actual
          <input
            name="stock"
            inputMode="decimal"
            required
            placeholder="Unidades que tienes hoy"
          />
        </label>
        <label>
          Precio de venta USD
          <input
            name="precio"
            inputMode="decimal"
            required
            defaultValue={precio}
          />
        </label>
        <label>
          Costo USD (opcional)
          <input name="costo" inputMode="decimal" />
        </label>
        <label>
          Referencia (opcional)
          <input name="referencia" maxLength={100} />
        </label>
        <label>
          Categoría (opcional)
          <input name="categoria" maxLength={100} />
        </label>
        <button disabled={ocupado}>
          {ocupado ? "Guardando…" : "Agregar al inventario"}
        </button>
      </form>
      <details>
        <summary>Vincular producto existente</summary>
        <p>
          Si ya existe en el catálogo, selecciona el registro para evitar
          duplicados.
        </p>
        <Busqueda
          tipo="productos"
          permitirSinPrecio
          elegir={setElegido}
          inicial={{ filas: productos, paginas: 1 }}
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
      </details>
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}

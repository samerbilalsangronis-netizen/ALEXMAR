"use client";
import { useEffect, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import { PackagePlus } from "lucide-react";
import type { ResultadoVenta } from "./editor-venta";
export function NuevoProductoVenta({
  elegir,
  nombreInicial = "",
  precioInicial = "",
}: {
  elegir: (r: ResultadoVenta) => void;
  nombreInicial?: string;
  precioInicial?: string;
}) {
  const formularioId = "alta-producto-" + useId();
  const [abierto, setAbierto] = useState(false),
    [ocupado, setOcupado] = useState(false),
    [error, setError] = useState("");
  const intento = useRef<{ firma: string; id: string } | null>(null),
    enviando = useRef(false);
  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setError("");
    try {
      const f = new FormData(e.currentTarget),
        datos = {
          nombre: String(f.get("nombre") || "").trim(),
          precio: String(f.get("precio") || "")
            .trim()
            .replace(",", "."),
          referencia: String(f.get("referencia") || "").trim(),
          categoria: String(f.get("categoria") || "").trim(),
        };
      const firma = JSON.stringify(datos);
      if (intento.current?.firma !== firma)
        intento.current = { firma, id: crypto.randomUUID() };
      const r = await fetch("/api/facturacion/producto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, id: intento.current!.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo crear el producto.");
      elegir(d);
      intento.current = null;
      setAbierto(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo crear el producto.",
      );
    } finally {
      setOcupado(false);
      enviando.current = false;
    }
  }
  return (
    <div className="nuevo-producto-venta">
      {!abierto ? (
        <button
          type="button"
          className="secundario"
          onClick={() => setAbierto(true)}
        >
          <PackagePlus size={17} aria-hidden="true" /> ¿No está? Crear producto
          en inventario
        </button>
      ) : (
        <section className="panel" aria-label="Crear producto en inventario">
          <h3>Nuevo producto en inventario</h3>
          <p className="muted">
            Se guardará en el catálogo y se añadirá a esta operación. Empieza
            sin existencias ni costo; registra su recepción o conteo cuando
            corresponda.
          </p>
          <div role="group" aria-label="Datos del nuevo producto">
            <label>
              Nombre del producto
              <input
                name="nombre"
                defaultValue={nombreInicial}
                form={formularioId}
                required
                minLength={2}
                maxLength={200}
                disabled={ocupado}
              />
            </label>
            <label>
              Precio de venta USD
              <input
                name="precio"
                defaultValue={precioInicial}
                form={formularioId}
                inputMode="decimal"
                required
                disabled={ocupado}
              />
            </label>
            <label>
              Referencia
              <input
                name="referencia"
                form={formularioId}
                maxLength={100}
                disabled={ocupado}
              />
            </label>
            <label>
              Categoría
              <input
                name="categoria"
                form={formularioId}
                maxLength={100}
                disabled={ocupado}
              />
            </label>
            <div className="acciones">
              <button
                type="button"
                className="secundario"
                disabled={ocupado}
                onClick={() => setAbierto(false)}
              >
                Cancelar alta de producto
              </button>
              <button type="submit" form={formularioId} disabled={ocupado}>
                {ocupado ? "Creando…" : "Guardar en inventario y añadir"}
              </button>
            </div>
          </div>
          {error && (
            <p className="aviso" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      {/* Formulario asociado: se monta fuera del formulario de venta mediante portal. */}
      <FormularioProducto crear={crear} id={formularioId} />
    </div>
  );
}

function FormularioProducto({
  crear,
  id,
}: {
  crear: (e: React.FormEvent<HTMLFormElement>) => void;
  id: string;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado
    ? createPortal(
        <form
          id={id}
          onSubmit={(e) => {
            e.stopPropagation();
            void crear(e);
          }}
        />,
        document.body,
      )
    : null;
}

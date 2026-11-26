"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus } from "lucide-react";
import { guardarGestion } from "@/lib/gestion-cliente";
export function MoverExistencia({ id }: { id: string }) {
  const [tipo, setTipo] = useState("entrada"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    clave = useRef(""),
    router = useRouter();
  function abrir(t: string) {
    setTipo(t);
    setError("");
    clave.current = crypto.randomUUID();
    dialog.current?.showModal();
  }
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      const p = Object.fromEntries(new FormData(form));
      await guardarGestion("mover_existencia", {
        ...p,
        cantidad: String(p.cantidad).replace(",", "."),
        id,
        tipo,
        clave: clave.current,
      });
      form.reset();
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="acciones no-imprimir">
        <button
          className="secundario"
          disabled={busy}
          onClick={() => abrir("entrada")}
        >
          <Plus size={17} />
          Agregar unidades
        </button>
        <button
          className="secundario"
          disabled={busy}
          onClick={() => abrir("salida")}
        >
          <Minus size={17} />
          Retirar unidades
        </button>
      </div>
      <dialog
        ref={dialog}
        className="factura-dialogo"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        aria-label={
          tipo === "entrada" ? "Agregar unidades" : "Retirar unidades"
        }
      >
        <h2>{tipo === "entrada" ? "Agregar unidades" : "Retirar unidades"}</h2>
        <p>
          Indica cuántas unidades entran o salen. El movimiento conservará
          fecha, responsable y motivo.
        </p>
        {tipo === "salida" && (
          <p>
            Para una venta, usa «Registrar venta» y se contabilizará también en
            rendimiento.
          </p>
        )}
        <form onSubmit={guardar} className="formulario">
          <label>
            Cantidad
            <input
              name="cantidad"
              inputMode="decimal"
              required
              disabled={busy}
            />
          </label>
          <label>
            Motivo
            <input
              name="motivo"
              minLength={5}
              maxLength={1000}
              required
              disabled={busy}
            />
          </label>
          {error && (
            <p className="aviso" role="alert">
              {error}
            </p>
          )}
          <div className="acciones">
            <button
              type="button"
              disabled={busy}
              className="secundario"
              onClick={() => dialog.current?.close()}
            >
              Volver
            </button>
            <button disabled={busy}>
              {busy ? "Guardando…" : "Registrar movimiento"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { guardarGestion } from "@/lib/gestion-cliente";
export function GestionPersona({
  tipo,
  dato,
}: {
  tipo: "cliente" | "proveedor";
  dato: {
    id: string;
    nombre: string;
    documento?: string;
    telefono?: string;
    direccion?: string;
  };
}) {
  const [editar, setEditar] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    router = useRouter();
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await guardarGestion("editar_cliente", {
        ...Object.fromEntries(new FormData(e.currentTarget)),
        id: dato.id,
      });
      setEditar(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function retirar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await guardarGestion("retirar_" + tipo, { id: dato.id });
      dialog.current?.close();
      router.push(tipo === "cliente" ? "/clientes" : "/proveedores");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gestion-persona no-imprimir">
      <div className="acciones">
        {tipo === "cliente" && (
          <button
            className="secundario"
            onClick={() => {
              setEditar(!editar);
              setError("");
            }}
          >
            <Pencil size={16} />
            {editar ? "Cerrar edición" : "Editar datos"}
          </button>
        )}
        <button
          className="icono secundario peligro"
          aria-label={"Eliminar " + tipo}
          title={"Eliminar " + tipo}
          onClick={() => {
            setError("");
            dialog.current?.showModal();
          }}
        >
          <Trash2 size={17} />
        </button>
      </div>
      {editar && (
        <form className="panel formulario" onSubmit={guardar}>
          {(
            [
              ["nombre", "Nombre"],
              ["documento", "Cédula / RIF"],
              ["telefono", "Teléfono"],
              ["direccion", "Dirección"],
            ] as const
          ).map(([k, t]) => (
            <label key={k}>
              {t}
              <input
                name={k}
                disabled={busy}
                required={k === "nombre"}
                minLength={k === "nombre" ? 2 : undefined}
                maxLength={
                  k === "direccion" ? 1000 : k === "nombre" ? 200 : 100
                }
                defaultValue={dato[k] || ""}
              />
            </label>
          ))}
          <button disabled={busy}>
            {busy ? "Guardando…" : "Guardar datos"}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
      <dialog
        ref={dialog}
        className="factura-dialogo"
        aria-label={"Eliminar " + tipo}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <h2>Eliminar {tipo}</h2>
        <p>
          <strong>{dato.nombre}</strong> dejará de aparecer en el directorio. Su
          cuenta debe estar en cero; las operaciones y documentos se conservarán
          en el historial.
        </p>
        <form onSubmit={retirar}>
          <label className="checkbox">
            <input type="checkbox" required />
            Confirmo retirar a esta persona del listado.
          </label>
          {error && (
            <p className="aviso" role="alert">
              {error}
            </p>
          )}
          <div className="acciones">
            <button
              type="button"
              className="secundario"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Volver
            </button>
            <button className="peligro" disabled={busy}>
              {busy ? "Eliminando…" : "Confirmar eliminación"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

"use client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { eliminarHojaNota } from "@/app/notas-actions";
export function EliminarNota({ id, titulo }: { id: string; titulo: string }) {
  const [abierto, setAbierto] = useState(false),
    [estado, accion, pendiente] = useActionState(eliminarHojaNota, {});
  const dialogo = useRef<HTMLDialogElement>(null),
    router = useRouter();
  useEffect(() => {
    if (abierto) dialogo.current?.showModal();
    else dialogo.current?.close();
  }, [abierto]);
  useEffect(() => {
    if (estado.eliminado) {
      setAbierto(false);
      router.refresh();
    }
  }, [estado, router]);
  return (
    <>
      <button
        type="button"
        className="secundario peligro"
        onClick={() => setAbierto(true)}
      >
        <Trash2 size={16} aria-hidden="true" /> Eliminar nota
      </button>
      <dialog
        ref={dialogo}
        className="factura-dialogo"
        aria-label="Eliminar nota"
        onCancel={() => setAbierto(false)}
      >
        <h2>Eliminar nota</h2>
        <p>¿Quieres retirar «{titulo || "Sin título"}» de tus notas?</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            startTransition(() => accion(f));
          }}
        >
          <input type="hidden" name="id" value={id} />
          <fieldset disabled={pendiente} className="formulario">
            <label className="checkbox">
              <input type="checkbox" name="confirmado" required /> Confirmo que
              ya no necesito esta nota.
            </label>
            <div className="acciones">
              <button
                type="button"
                className="secundario"
                onClick={() => setAbierto(false)}
              >
                Cancelar
              </button>
              <button className="peligro">
                {pendiente ? "Eliminando…" : "Confirmar eliminación"}
              </button>
            </div>
          </fieldset>
          {estado.error && (
            <p className="aviso" role="alert">
              {estado.error}
            </p>
          )}
        </form>
      </dialog>
    </>
  );
}

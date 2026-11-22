"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Ban } from "lucide-react";
import { anularVenta } from "@/app/actions";
import { monto } from "@/lib/formatos";
function Confirmar() {
  const { pending } = useFormStatus();
  return (
    <button className="peligro" disabled={pending}>
      {pending ? "Anulando…" : "Confirmar anulación"}
    </button>
  );
}
export function AnularFactura({
  id,
  version,
  pagado,
  emitida,
  abrir = false,
}: {
  id: string;
  version: number;
  pagado: string;
  emitida: boolean;
  abrir?: boolean;
}) {
  const [abierto, setAbierto] = useState(abrir);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (abierto) dialogo.current?.showModal();
    else dialogo.current?.close();
  }, [abierto]);
  const hayCobro = emitida && Number(pagado) > 0;
  return (
    <>
      <button
        type="button"
        className="secundario peligro"
        onClick={() => setAbierto(true)}
      >
        <Ban size={17} />
        Anular factura
      </button>
      <dialog
        className="factura-dialogo"
        ref={dialogo}
        onCancel={() => setAbierto(false)}
        aria-labelledby="anular-titulo"
      >
        <h2 id="anular-titulo">Anular factura</h2>
        <p>
          Se conservará el documento con estado Anulada y se revertirán su cargo
          y sus cobros. Solo se devolverán existencias si esta factura las
          descontó.
        </p>
        <form action={anularVenta} className="formulario">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="version" value={version} />
          <label>
            Motivo de anulación
            <input
              name="motivo"
              minLength={5}
              maxLength={1000}
              required
              autoFocus
            />
          </label>
          {hayCobro && (
            <label className="checkbox">
              <input type="checkbox" name="reembolso" required />
              Confirmo haber revertido o reembolsado los cobros por{" "}
              {monto(pagado)}.
            </label>
          )}
          <label className="checkbox">
            <input name="confirmar" type="checkbox" required />
            Confirmo anular esta factura y conservar su historial.
          </label>
          <div className="acciones">
            <button
              type="button"
              className="secundario"
              onClick={() => setAbierto(false)}
            >
              Volver
            </button>
            <Confirmar />
          </div>
        </form>
      </dialog>
    </>
  );
}

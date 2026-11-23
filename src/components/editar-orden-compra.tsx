"use client";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { editarOrdenCompra, corregirAbonoCompra } from "@/app/compras-actions";
import type { Compra } from "@/lib/compras";
import { monto } from "@/lib/formatos";
const Exacto = Decimal.clone({ precision: 128 });
const metodos = ["Efectivo", "Transferencia", "Pago móvil", "Tarjeta", "Otro"];
function Ocultos({ compra }: { compra: Compra }) {
  return (
    <>
      <input type="hidden" name="compra_id" value={compra.id} />
      <input type="hidden" name="proveedor" value={compra.proveedor_id} />
      <input type="hidden" name="version" value={compra.version} />
    </>
  );
}
function Motivo() {
  return (
    <label>
      Motivo de la corrección
      <textarea name="motivo" required minLength={5} maxLength={2000} />
    </label>
  );
}
function Mensaje({ error, guardado }: { error?: string; guardado?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  return (
    <>
      {error && (
        <p ref={ref} tabIndex={-1} role="alert" className="aviso">
          {error}
        </p>
      )}
      {guardado && (
        <p role="status" className="exito">
          Corrección guardada. Los saldos están actualizados.
        </p>
      )}
    </>
  );
}
export function EditarOrdenCompra({ compra }: { compra: Compra }) {
  const [estado, accion, pendiente] = useActionState(editarOrdenCompra, {});
  const router = useRouter();
  const [lineas, setLineas] = useState(
    compra.lineas.map((l) => ({
      id: l.id,
      cantidad: l.cantidad,
      costo: l.costo_unitario,
    })),
  );
  useEffect(() => {
    if (estado.guardado) router.refresh();
  }, [estado, router]);
  useEffect(() => {
    setLineas(
      compra.lineas.map((l) => ({
        id: l.id,
        cantidad: l.cantidad,
        costo: l.costo_unitario,
      })),
    );
  }, [compra.version, compra.lineas]);
  let total: string | null = null;
  try {
    total = lineas
      .reduce(
        (s, l) =>
          s.plus(
            new Exacto(l.cantidad.replace(",", ".")).times(
              l.costo.replace(",", "."),
            ),
          ),
        new Exacto(0),
      )
      .toFixed();
  } catch {
    /* Mostrar pendiente de completar, nunca sustituir errores por cero. */
  }
  function cambiar(id: string, campo: "cantidad" | "costo", valor: string) {
    setLineas((actual) =>
      actual.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)),
    );
  }
  return (
    <details className="panel no-imprimir" id="editar-orden">
      <summary>Editar orden</summary>
      <p className="muted">
        Corrige cantidades, costos, referencia u observaciones. El total y la
        deuda se recalculan; las existencias cambian solo por la diferencia de
        unidades. Si hubo movimientos posteriores, puedes corregir referencia y
        observaciones.
      </p>
      <form
        action={accion}
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          startTransition(() => accion(datos));
        }}
      >
        <Ocultos compra={compra} />
        <fieldset disabled={pendiente} className="formulario">
          <label>
            Referencia del proveedor
            <input
              name="referencia"
              defaultValue={compra.referencia}
              maxLength={100}
            />
          </label>
          {compra.lineas.map((l, i) => (
            <fieldset className="panel" key={l.id}>
              <legend>{l.descripcion}</legend>
              <input type="hidden" name="linea_id" value={l.id} />
              <label>
                Cantidad
                <input
                  name={"cantidad_" + l.id}
                  inputMode="decimal"
                  required
                  maxLength={100}
                  value={lineas[i]?.cantidad ?? ""}
                  onChange={(e) => cambiar(l.id, "cantidad", e.target.value)}
                />
              </label>
              <label>
                Costo unitario USD
                <input
                  name={"costo_" + l.id}
                  inputMode="decimal"
                  required
                  maxLength={100}
                  value={lineas[i]?.costo ?? ""}
                  onChange={(e) => cambiar(l.id, "costo", e.target.value)}
                />
              </label>
            </fieldset>
          ))}
          <p className="metrica-acento">
            Nuevo total USD:{" "}
            <strong>
              {total === null ? "Completa cantidades y costos" : monto(total)}
            </strong>
            {total !== null && (
              <small className="muted"> · Exacto: {total}</small>
            )}
          </p>
          <p className="muted">
            Abonos vigentes: {monto(compra.pagado)}. El total no puede ser menor
            que lo ya abonado.
          </p>
          <label>
            Observaciones
            <textarea
              name="observaciones"
              defaultValue={compra.observaciones}
              maxLength={4000}
            />
          </label>
          <Motivo />
          <button>
            {pendiente ? "Guardando…" : "Guardar cambios de la orden"}
          </button>
        </fieldset>
        <Mensaje {...estado} />
      </form>
    </details>
  );
}
export function CorregirAbonoCompra({
  compra,
  pago,
}: {
  compra: Compra;
  pago: Compra["pagos"]["filas"][number];
}) {
  const [estado, accion, pendiente] = useActionState(corregirAbonoCompra, {});
  const [tipo, setTipo] = useState("editar");
  const router = useRouter();
  useEffect(() => {
    if (estado.guardado) router.refresh();
  }, [estado, router]);
  return (
    <details className="no-imprimir">
      <summary>Editar o anular abono</summary>
      <form
        action={accion}
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          startTransition(() => accion(datos));
        }}
      >
        <Ocultos compra={compra} />
        <input type="hidden" name="pago_id" value={pago.id} />
        <fieldset disabled={pendiente} className="formulario">
          <label>
            Acción
            <select
              name="accion"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="editar">Editar abono</option>
              <option value="anular">Anular abono</option>
            </select>
          </label>
          {tipo === "editar" && (
            <>
              <label>
                Importe correcto USD
                <input
                  name="monto"
                  inputMode="decimal"
                  required
                  defaultValue={pago.monto}
                  maxLength={105}
                />
              </label>
              <label>
                Método de pago
                <select name="metodo" defaultValue={pago.metodo}>
                  {metodos.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Referencia del abono
                <input
                  name="referencia"
                  defaultValue={pago.referencia}
                  maxLength={200}
                />
              </label>
            </>
          )}
          <Motivo />
          <label className="checkbox">
            <input type="checkbox" name="revisado" required />
            Confirmo el importe realmente pagado y que resolví cualquier
            reintegro necesario, o que era un registro de prueba sin pago real.
          </label>
          <button className={tipo === "anular" ? "secundario" : ""}>
            {pendiente
              ? "Guardando…"
              : tipo === "anular"
                ? "Anular este abono"
                : "Guardar corrección del abono"}
          </button>
        </fieldset>
        <Mensaje {...estado} />
      </form>
    </details>
  );
}

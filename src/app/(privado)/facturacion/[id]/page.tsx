import Link from "next/link";
import { notFound } from "next/navigation";
import DecimalBase from "decimal.js";
const Decimal = DecimalBase.clone({ precision: 128 });
import { sesion } from "@/lib/supabase";
import { numeroVenta, type Venta } from "@/lib/ventas";
import { Cabecera, Avisos } from "@/components/comunes";
import { monto, cantidad, fecha } from "@/lib/formatos";
import { emitirVenta, anularVenta } from "@/app/actions";
export default async function FichaVenta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const { db, perfil } = await sesion();
  if (!["administrador", "ventas"].includes(perfil.rol)) notFound();
  const { data, error } = await db.rpc("ficha_venta", { p_id: id });
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const v = data as Venta;
  const p = await searchParams;
  const pendiente =
    v.estado === "anulada"
      ? "0"
      : new Decimal(v.total).minus(v.abono).toFixed();
  return (
    <>
      <Link href="/facturacion">← Volver a facturación</Link>
      <Cabecera
        titulo={numeroVenta(v)}
        subtitulo={`${v.estado} · USD · ${fecha(v.emitido || v.creado)}`}
      >
        <a
          className="boton secundario"
          href={"/api/facturacion/" + id + "/imprimir"}
          target="_blank"
          rel="noopener noreferrer"
        >
          Imprimir / PDF
        </a>
      </Cabecera>
      <Avisos p={p} />
      {v.estado === "borrador" && (
        <p className="aviso">
          Revisa cantidades, precios, cliente y pago inicial. Este borrador
          todavía no afecta stock ni cuentas.
        </p>
      )}
      {v.estado === "anulada" && (
        <p className="aviso">
          Documento anulado: {v.motivo_anulacion}. Los importes originales se
          conservan para el historial.
        </p>
      )}
      <section className="panel">
        <h2>{v.cliente.nombre}</h2>
        <p>
          {v.cliente.documento || "Sin documento"} ·{" "}
          {v.cliente.telefono || "Sin teléfono"}
        </p>
        <p>{v.cliente.direccion}</p>
        {v.vence && <p>Vencimiento: {v.vence}</p>}
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Cantidad</th>
                <th>Precio USD</th>
                <th>Importe USD</th>
              </tr>
            </thead>
            <tbody>
              {v.lineas.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.descripcion}
                    <br />
                    <small>{l.variante_id ? "Producto" : "Servicio"}</small>
                  </td>
                  <td>{cantidad(l.cantidad)}</td>
                  <td>{monto(l.precio)}</td>
                  <td>{monto(l.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="total-factura">
          <p>
            Subtotal: {monto(v.subtotal)} · Descuento: {monto(v.descuento)} ·
            Impuesto: 0
          </p>
          <strong>Total: {monto(v.total)}</strong>
          <small>Total exacto USD: {v.total}</small>
          <p>
            {!v.emitido ? "Pago inicial previsto" : "Pago inicial"}:{" "}
            {monto(v.abono)}
            {v.metodo_pago ? " · " + v.metodo_pago : ""}
            <br />
            {v.estado === "borrador"
              ? "Saldo previsto"
              : "Saldo a cobrar"}: {monto(pendiente)}
          </p>
        </div>
        <p>{v.observaciones}</p>
      </section>
      {v.estado === "borrador" && (
        <section className="panel no-imprimir">
          <h2>Revisar y emitir</h2>
          <Link
            className="boton secundario"
            href={"/facturacion/nueva?editar=" + id}
          >
            Editar borrador
          </Link>
          <form action={emitirVenta} className="formulario">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="version" value={v.version} />
            <label className="checkbox">
              <input type="checkbox" name="confirmar" required />
              Revisé el documento y confirmo registrar la venta y el pago
              inicial indicado.
            </label>
            <button>Emitir factura</button>
            <small>
              Descuenta productos disponibles y registra el cargo y el pago
              inicial en una sola transacción.
            </small>
          </form>
        </section>
      )}
      {v.pagos.length > 0 && (
        <section className="panel">
          <h2>Registro del pago inicial</h2>
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Método</th>
                  <th>Monto USD</th>
                </tr>
              </thead>
              <tbody>
                {v.pagos.map((a, i) => (
                  <tr key={i}>
                    <td>{fecha(a.creado)}</td>
                    <td>{a.tipo}</td>
                    <td>{a.metodo}</td>
                    <td>{monto(a.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {perfil.rol === "administrador" && v.estado !== "anulada" && (
        <details className="panel no-imprimir">
          <summary>Anular documento</summary>
          <form action={anularVenta} className="formulario">
            <input type="hidden" name="id" value={id} />
            <label>
              Motivo
              <input name="motivo" minLength={5} required />
            </label>
            {v.estado === "confirmada" && new Decimal(v.abono).gt(0) && (
              <label className="checkbox">
                <input name="reembolso" type="checkbox" required />
                Confirmo haber revertido el cobro o entregado el reembolso de{" "}
                {monto(v.abono)}.
              </label>
            )}
            <label className="checkbox">
              <input type="checkbox" name="confirmar" required />
              Confirmo anular este documento conservando su historial.
            </label>
            <button>Anular documento</button>
          </form>
          <p>
            Una factura emitida genera movimientos de reversión de stock, cuenta
            y pago inicial. Una devolución parcial requiere el módulo de
            devoluciones.
          </p>
        </details>
      )}
    </>
  );
}

import Link from "next/link";
import { ActivarFacturacion } from "@/components/activar-facturacion";
import { documentoFactura, estiloFactura } from "@/lib/documento-factura";
import { AnularFactura } from "@/components/anular-factura";
import { CobroFactura } from "@/components/cobro-factura";
import { notFound } from "next/navigation";
import DecimalBase from "decimal.js";
const Decimal = DecimalBase.clone({ precision: 128 });
import { sesion } from "@/lib/supabase";
import { numeroVenta, type Venta } from "@/lib/ventas";
import { Cabecera, Avisos } from "@/components/comunes";
import { monto, fecha } from "@/lib/formatos";
import { emitirVenta } from "@/app/actions";
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
  if (typeof data.saldo !== "string") return <ActivarFacturacion />;
  const v = data as Venta;
  const p = await searchParams;
  return (
    <>
      <Link href="/facturacion">← Volver a facturación</Link>
      <Cabecera
        titulo={numeroVenta(v)}
        subtitulo={`${v.estado === "confirmada" ? "Emitida" : v.estado === "borrador" ? "Borrador" : "Anulada"} · USD · ${fecha(v.emitido || v.creado)}`}
      >
        <a
          className="boton secundario"
          href={"/api/facturacion/" + id + "/imprimir"}
          target="_blank"
          rel="noopener noreferrer"
        >
          Imprimir / PDF
        </a>
        {perfil.rol === "administrador" && v.estado !== "anulada" && (
          <AnularFactura
            id={id}
            version={v.version}
            pagado={v.pagado}
            emitida={v.estado === "confirmada"}
            abrir={p.anular === "1"}
          />
        )}
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
      <div className="factura-papel-contenedor">
        <style>{estiloFactura}</style>
        <div dangerouslySetInnerHTML={{ __html: documentoFactura(v) }} />
      </div>
      <p className="muted">
        <Link href={"/clientes/" + v.cliente_id}>
          Ver cuenta e historial de {v.cliente.nombre} →
        </Link>
      </p>
      {v.estado === "confirmada" && new Decimal(v.saldo).gt(0) && (
        <CobroFactura id={id} saldo={v.saldo} />
      )}
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
              Registra el cargo y el cobro inicial en una sola transacción. El
              descuento de inventario depende de la configuración vigente al
              emitir.
            </small>
          </form>
        </section>
      )}
      {v.pagos.length > 0 && (
        <section className="panel">
          <h2>Pagos e historial de cobros</h2>
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
      {v.estado === "confirmada" && (
        <p className="muted">
          {v.descontar_stock === false
            ? "Esta factura se emitió sin descontar inventario."
            : "Esta factura se emitió con el descuento de inventario activado."}
        </p>
      )}
    </>
  );
}

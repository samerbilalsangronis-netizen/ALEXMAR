import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { sesion } from "@/lib/supabase";
import { Cabecera, Avisos, Paginacion } from "@/components/comunes";
import { ActivarCompras } from "@/components/activar-compras";
import { PrecioVentaCompra } from "@/components/precio-venta-compra";
import { PagoCompra } from "@/components/pago-compra";
import { Imprimir } from "@/components/imprimir";
import { anularCompra } from "@/app/compras-actions";
import { monto, cantidad, fecha, pagina } from "@/lib/formatos";
import { numeroCompra, type Compra } from "@/lib/compras";
export default async function ComprobanteCompra({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; compra: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id, compra } = await params,
    p = await searchParams;
  const { db, perfil } = await sesion();
  if (
    !["administrador", "inventario"].includes(perfil.rol) ||
    !/^[a-f0-9-]{36}$/i.test(id) ||
    !/^[a-f0-9-]{36}$/i.test(compra)
  )
    notFound();
  const { data, error } = await db.rpc("ficha_compra", {
    p_id: compra,
    p_pagos_pagina: pagina(p.pagos_pagina),
  });
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      return <ActivarCompras administrador={perfil.rol === "administrador"} />;
    throw new Error(error.message);
  }
  if (!data || data.proveedor_id !== id) notFound();
  const c = data as Compra;
  return (
    <>
      <Cabecera
        titulo={"Recepción " + numeroCompra(c.numero)}
        subtitulo={
          c.proveedor_snapshot.nombre + " · " + fecha(c.creado) + " · USD"
        }
      >
        <div className="acciones">
          <Link className="boton secundario" href={"/proveedores/" + id}>
            Cuenta del proveedor
          </Link>
          <Imprimir />
        </div>
      </Cabecera>
      <Avisos p={p} />
      <p className={c.estado === "anulada" ? "aviso" : "exito"}>
        {c.estado === "anulada"
          ? "Recepción anulada: " + c.motivo_anulacion
          : "Mercancía recibida. Las unidades y la deuda ya están registradas."}
      </p>
      <section className="indicadores indicadores-ventas">
        <article>
          <small>TOTAL DE LA COMPRA</small>
          <strong>{monto(c.total)}</strong>
        </article>
        <article>
          <small>PAGADO AL PROVEEDOR</small>
          <strong>{monto(c.pagado)}</strong>
        </article>
        <article className="metrica-acento">
          <small>SALDO PENDIENTE</small>
          <strong>{monto(c.saldo)}</strong>
        </article>
      </section>
      {c.estado === "confirmada" &&
        c.lineas.some((l) => l.precio_venta === null) && (
          <section className="panel precios-pendientes">
            <span className="etiqueta">SIGUIENTE PASO</span>
            <h2>Pendiente de precio de venta</h2>
            <p>
              Las unidades ya están en inventario. Asigna el precio antes de
              vender estos productos.
            </p>
            <div className="precios-recibidos">
              {c.lineas
                .filter((l) => l.precio_venta === null)
                .map((l) => (
                  <PrecioVentaCompra
                    key={l.id}
                    producto={l.producto_id}
                    nombre={l.descripcion}
                  />
                ))}
            </div>
          </section>
        )}
      <section className="panel">
        <h2>Productos recibidos</h2>
        {c.referencia && (
          <p>
            Referencia del proveedor: <strong>{c.referencia}</strong>
          </p>
        )}
        <div className="tabla-contenedor tabla-compras">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Costo unitario USD</th>
                <th>Total USD</th>
                <th>Precio de venta actual</th>
              </tr>
            </thead>
            <tbody>
              {c.lineas.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={"/inventario/" + l.producto_id}>
                      {l.descripcion}
                    </Link>
                  </td>
                  <td>{cantidad(l.cantidad)}</td>
                  <td>{monto(l.costo_unitario)}</td>
                  <td>{monto(l.importe)}</td>
                  <td>
                    {l.precio_venta === null ? (
                      <Link
                        className="enlace-texto"
                        href={"/inventario/" + l.producto_id}
                      >
                        Asignar precio de venta →
                      </Link>
                    ) : (
                      monto(l.precio_venta)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Total exacto USD: {c.total}. El costo y las cantidades del comprobante
          se conservan aunque el catálogo cambie.
        </p>
        {c.observaciones && <p>{c.observaciones}</p>}
      </section>
      {c.estado === "confirmada" &&
        perfil.rol === "administrador" &&
        new Decimal(c.saldo).gt(0) && (
          <PagoCompra compra={c.id} clave={randomUUID()} saldo={c.saldo} />
        )}
      <section className="panel">
        <h2>Pagos registrados</h2>
        <p className="muted">
          Página {c.pagos.pagina} de {c.pagos.paginas} · {c.pagos.total} pagos
          en total. Los indicadores incluyen todos los pagos.
        </p>
        {c.pagos.total ? (
          <div className="tabla-contenedor tabla-compras">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Referencia</th>
                  <th>Monto USD</th>
                </tr>
              </thead>
              <tbody>
                {c.pagos.filas.map((pg) => (
                  <tr key={pg.id}>
                    <td>{fecha(pg.creado)}</td>
                    <td>{pg.metodo}</td>
                    <td>{pg.referencia || "—"}</td>
                    <td>{monto(pg.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No hay pagos registrados para esta compra.</p>
        )}
      </section>
      <Paginacion
        {...c.pagos}
        ruta={"/proveedores/" + id + "/recepciones/" + c.id}
        parametros={{}}
        parametroPagina="pagos_pagina"
      />
      {perfil.rol === "administrador" && c.estado === "confirmada" && (
        <details className="panel no-imprimir">
          <summary>Anular una recepción incorrecta</summary>
          <p className="muted">
            Solo si no tiene pagos, operaciones posteriores ni cambios de costo,
            y las unidades siguen libres. Se revierten stock y deuda y se
            restaura el costo anterior; el comprobante se conserva.
          </p>
          <form action={anularCompra} className="formulario">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="proveedor" value={id} />
            <label>
              Motivo de la anulación
              <textarea name="motivo" required minLength={5} maxLength={2000} />
            </label>
            <label className="checkbox">
              <input name="revisado" type="checkbox" required /> Confirmo que
              esta recepción es incorrecta y revisé su reversión.
            </label>
            <button>Anular recepción y revertir</button>
          </form>
        </details>
      )}
    </>
  );
}

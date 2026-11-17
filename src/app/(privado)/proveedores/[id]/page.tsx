import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft, PackagePlus } from "lucide-react";
import { sesion } from "@/lib/supabase";
import { Cabecera, Paginacion } from "@/components/comunes";
import { ActivarCompras } from "@/components/activar-compras";
import { monto, cantidad, fecha, pagina } from "@/lib/formatos";
import { numeroCompra, type ProveedorCompras } from "@/lib/compras";
export default async function ProveedorDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params,
    p = await searchParams;
  const { db, perfil } = await sesion();
  if (!["administrador", "inventario"].includes(perfil.rol)) notFound();
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const { data, error } = await db.rpc("ficha_proveedor_compras", {
    p_id: id,
    p_pagina: pagina(p.pagina),
    p_productos_pagina: pagina(p.productos_pagina),
    p_q: p.q || "",
  });
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      return <ActivarCompras administrador={perfil.rol === "administrador"} />;
    throw new Error(error.message);
  }
  if (!data) notFound();
  const d = data as ProveedorCompras;
  return (
    <>
      <Cabecera
        titulo={d.proveedor.nombre}
        subtitulo="Recepciones, productos suministrados y cuenta por pagar · USD"
      >
        <div className="acciones">
          <Link className="boton secundario" href="/proveedores">
            <ArrowLeft size={16} /> Proveedores
          </Link>
          {d.proveedor.activo && d.proveedor.monedas.includes("USD") && (
            <Link
              className="boton"
              href={"/proveedores/" + id + "/recepciones/nueva"}
            >
              <Plus size={17} /> Recibir mercancía
            </Link>
          )}
        </div>
      </Cabecera>
      <section className="indicadores indicadores-ventas">
        <article>
          <small>COMPRAS RECIBIDAS · USD</small>
          <strong>{monto(d.resumen.comprado)}</strong>
          <span className="muted">Excluye recepciones anuladas</span>
        </article>
        <article>
          <small>PAGOS REGISTRADOS · USD</small>
          <strong>{monto(d.resumen.pagado)}</strong>
        </article>
        <article className="metrica-acento">
          <small>PENDIENTE CON EL PROVEEDOR</small>
          <strong>{monto(d.resumen.saldo)}</strong>
        </article>
      </section>
      <p className="muted">
        Saldo de todas las compras recibidas, independiente de la página o
        búsqueda. Facturar al cliente descuenta inventario; la deuda al
        proveedor baja al registrar sus pagos.
      </p>
      <section className="panel">
        <span className="etiqueta">PRODUCTOS QUE TE SUMINISTRA</span>
        <h2>Mercancía de este proveedor</h2>
        <form className="busqueda">
          <input
            name="q"
            aria-label="Buscar productos del proveedor"
            defaultValue={p.q}
            placeholder="Starlink, faro, referencia…"
          />
          <button>Buscar</button>
        </form>
        <div className="tabla-contenedor tabla-compras">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Unidades recibidas</th>
                <th>Último costo de este proveedor</th>
                <th>Precio de venta actual</th>
                <th>Última recepción</th>
              </tr>
            </thead>
            <tbody>
              {d.productos.filas.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={"/inventario/" + a.producto_id}>
                      {a.nombre}
                    </Link>
                  </td>
                  <td>{cantidad(a.cantidad_recibida)}</td>
                  <td>{monto(a.ultimo_costo)}</td>
                  <td>
                    {a.precio_venta === null ? (
                      <Link
                        className="enlace-texto"
                        href={"/inventario/" + a.producto_id}
                      >
                        Asignar precio de venta →
                      </Link>
                    ) : (
                      monto(a.precio_venta)
                    )}
                  </td>
                  <td>{fecha(a.ultima_recepcion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.productos.total && (
          <div className="vacio">
            <PackagePlus size={30} />
            <p>No hay productos recibidos para esta consulta.</p>
          </div>
        )}
        <Paginacion
          {...d.productos}
          ruta={"/proveedores/" + id}
          parametros={p}
          parametroPagina="productos_pagina"
        />
        <p className="nota-grafico">
          Cantidades recibidas acumuladas, sin recepciones anuladas. No son las
          existencias actuales: las ventas descuentan del inventario común. Se
          muestra el último costo de este proveedor; el costo del catálogo usa
          la recepción más reciente de cualquier proveedor.
        </p>
      </section>
      <section className="panel">
        <h2>Recepciones y pagos</h2>
        <div className="tabla-contenedor tabla-compras">
          <table>
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Fecha</th>
                <th>Referencia</th>
                <th>Estado</th>
                <th>Total USD</th>
                <th>Pagado USD</th>
                <th>Pendiente USD</th>
              </tr>
            </thead>
            <tbody>
              {d.compras.filas.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={"/proveedores/" + id + "/recepciones/" + c.id}>
                      {numeroCompra(c.numero)} →
                    </Link>
                  </td>
                  <td>{fecha(c.creado)}</td>
                  <td>{c.referencia || "—"}</td>
                  <td>{c.estado === "anulada" ? "Anulada" : "Recibida"}</td>
                  <td>{monto(c.total)}</td>
                  <td>{monto(c.pagado)}</td>
                  <td>{monto(c.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.compras.total && (
          <p className="vacio">
            Aún no hay recepciones. Selecciona Recibir mercancía para registrar
            la primera.
          </p>
        )}
        <Paginacion {...d.compras} ruta={"/proveedores/" + id} parametros={p} />
      </section>
    </>
  );
}

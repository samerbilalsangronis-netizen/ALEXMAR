import Link from "next/link";
import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { Cabecera, Paginacion } from "@/components/comunes";
import { ActivarRapida } from "@/components/activar-rapida";
import { CompletarProductoPendiente } from "@/components/completar-producto-pendiente";
import { monto, pagina, type Pagina } from "@/lib/formatos";
type Pendiente = {
  linea_id: string;
  venta_id: string;
  numero: number;
  cliente: string;
  descripcion: string;
  cantidad: string;
  precio: string;
  importe: string;
};
export default async function Pendientes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { db, perfil } = await sesion();
  if (perfil.rol !== "administrador") notFound();
  const p = await searchParams;
  const { data, error } = await db.rpc("listar_productos_sin_cargar", {
    p_pagina: pagina(p.pagina),
  });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code)) return <ActivarRapida />;
    throw new Error(error.message);
  }
  const d = data as Pagina<Pendiente>;
  const { data: productos, error: fallo } = await db.rpc("buscar_productos", {
    p: { estado: "activos", pagina: 1 },
  });
  if (fallo) throw new Error(fallo.message);
  const seleccion = productos.filas.map(
    (r: {
      id: string;
      variante_id: string;
      nombre: string;
      precio: string | null;
      disponible: string;
    }) => ({
      id: r.id,
      variante_id: r.variante_id,
      nombre: r.nombre,
      precio: r.precio,
      disponible: r.disponible,
    }),
  );
  return (
    <>
      <Link href="/inventario">← Inventario</Link>
      <Cabecera
        titulo="Productos sin cargar"
        subtitulo="Productos ya facturados que aún necesitan vincularse al inventario."
      />
      <p className="muted">
        {d.total} pendientes. No son nuevas deudas ni entradas de stock. Si la
        venta descontaba inventario, se comprobarán y descontarán sus unidades
        al vincular.
      </p>
      <div className="productos">
        {d.filas.map((l) => (
          <article className="producto" key={l.linea_id}>
            <h2>{l.descripcion}</h2>
            <p>
              {l.cantidad} × {monto(l.precio)} · Total {monto(l.importe)}
            </p>
            <p>
              {l.cliente} ·{" "}
              <Link href={"/facturacion/" + l.venta_id}>
                Factura V-{l.numero}
              </Link>
            </p>
            <CompletarProductoPendiente
              linea={l.linea_id}
              nombre={l.descripcion}
              precio={l.precio}
              productos={seleccion}
            />
          </article>
        ))}
      </div>
      {!d.total && (
        <section className="panel vacio">
          No hay productos pendientes de completar.
        </section>
      )}
      <Paginacion {...d} ruta="/inventario/pendientes" />
    </>
  );
}

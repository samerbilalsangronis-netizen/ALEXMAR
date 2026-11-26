import Link from "next/link";
import { ActivarFacturacion } from "@/components/activar-facturacion";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { Cabecera } from "@/components/comunes";
import { EditorVentaRapida } from "@/components/editor-venta-rapida";
import { ActivarRapida } from "@/components/activar-rapida";
import { EditorVenta } from "@/components/editor-venta";
import type { Venta } from "@/lib/ventas";
export default async function Nueva({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { db, perfil } = await sesion();
  if (!["administrador", "ventas"].includes(perfil.rol)) notFound();
  const { data: config, error: pendiente } = await db.rpc(
    "configuracion_facturacion",
  );
  if (pendiente && !["PGRST202", "42883"].includes(pendiente.code))
    throw new Error(pendiente.message);
  if (!config || config.version !== 11) return <ActivarFacturacion />;
  const p = await searchParams;
  if (!config.version_rapida && !p.editar) return <ActivarRapida />;
  let inicial: Venta | null = null;
  if (p.editar) {
    if (!/^[a-f0-9-]{36}$/i.test(p.editar)) notFound();
    const { data, error } = await db.rpc("ficha_venta", { p_id: p.editar });
    if (error) throw new Error(error.message);
    if (!data || data.estado !== "borrador") notFound();
    inicial = data;
  }
  const [clientes, productos] = await Promise.all([
    db.rpc("buscar_clientes", { p: { pagina: 1, estado: "activos" } }),
    db.rpc("buscar_productos", { p: { pagina: 1, estado: "activos" } }),
  ]);
  if (clientes.error || productos.error)
    throw new Error(clientes.error?.message || productos.error?.message);
  const seleccion = {
    filas: productos.data.filas.map(
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
    ),
    paginas: productos.data.paginas,
  };
  let productoInicial;
  if (p.producto && /^[a-f0-9-]{36}$/i.test(p.producto)) {
    const { data, error } = await db.rpc("ficha_producto", {
      p_id: p.producto,
    });
    if (error) throw new Error(error.message);
    if (data?.activo)
      productoInicial = {
        id: data.id,
        variante_id: data.variante_id,
        nombre: data.nombre,
        precio: data.precio,
        disponible: data.disponible,
      };
  }
  return (
    <>
      <Link href="/facturacion">← Ventas</Link>
      <Cabecera
        titulo={inicial ? "Editar borrador" : "Registrar venta"}
        subtitulo={
          inicial
            ? "Borrador existente · USD"
            : "Contado · 15 filas rápidas · USD"
        }
      />
      {!inicial ? (
        <EditorVentaRapida
          clave={randomUUID()}
          productos={seleccion.filas}
          productoInicial={productoInicial}
        />
      ) : (
        <EditorVenta
          clave={inicial?.id || randomUUID()}
          administrador={perfil.rol === "administrador"}
          inicial={inicial}
          descontarStock={config.descontar_stock ?? true}
          clientes={{
            filas: clientes.data.filas.map(
              (r: { id: string; nombre: string; documento?: string }) => ({
                id: r.id,
                nombre: r.nombre,
                documento: r.documento,
              }),
            ),
            paginas: clientes.data.paginas,
          }}
          productos={seleccion}
        />
      )}
    </>
  );
}

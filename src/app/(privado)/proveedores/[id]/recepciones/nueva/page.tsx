import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { Cabecera } from "@/components/comunes";
import { ActivarCompras } from "@/components/activar-compras";
import { EditorRecepcion } from "@/components/editor-recepcion";
export default async function NuevaRecepcion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db, perfil } = await sesion();
  if (
    !["administrador", "inventario"].includes(perfil.rol) ||
    !/^[a-f0-9-]{36}$/i.test(id)
  )
    notFound();
  const { data, error } = await db.rpc("ficha_proveedor_compras", { p_id: id });
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      return <ActivarCompras administrador={perfil.rol === "administrador"} />;
    throw new Error(error.message);
  }
  if (!data) notFound();
  if (!data.proveedor.activo || !data.proveedor.monedas.includes("USD"))
    return (
      <section className="aviso">
        <h1>Proveedor no disponible para recepción en USD</h1>
        <Link href={"/proveedores/" + id}>Volver a su cuenta</Link>
      </section>
    );
  return (
    <>
      <Cabecera
        titulo="Recibir mercancía"
        subtitulo="Elige productos, cantidades y costo. Al confirmar se actualizan inventario y cuenta por pagar juntos."
      >
        <Link className="boton secundario" href={"/proveedores/" + id}>
          Volver al proveedor
        </Link>
      </Cabecera>
      <EditorRecepcion clave={randomUUID()} proveedor={data.proveedor} />
    </>
  );
}

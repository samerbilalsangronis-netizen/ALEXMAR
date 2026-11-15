import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { Cabecera } from "@/components/comunes";
import { EditorVenta } from "@/components/editor-venta";
import type { Venta } from "@/lib/ventas";
export default async function Nueva({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { db, perfil } = await sesion();
  if (!["administrador", "ventas"].includes(perfil.rol)) notFound();
  const p = await searchParams;
  let inicial: Venta | null = null;
  if (p.editar) {
    if (!/^[a-f0-9-]{36}$/i.test(p.editar)) notFound();
    const { data, error } = await db.rpc("ficha_venta", { p_id: p.editar });
    if (error) throw new Error(error.message);
    if (!data || data.estado !== "borrador") notFound();
    inicial = data;
  }
  return (
    <>
      <Cabecera
        titulo={inicial ? "Editar borrador" : "Nueva factura"}
        subtitulo="Selecciona cliente y piezas por nombre. Revisa el borrador antes de emitir."
      />
      <EditorVenta
        clave={inicial?.id || randomUUID()}
        administrador={perfil.rol === "administrador"}
        inicial={inicial}
      />
    </>
  );
}

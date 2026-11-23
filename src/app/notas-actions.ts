"use server";
import { sesion } from "@/lib/supabase";
import { guardarContenidoNota } from "@/lib/notas";
import { revalidatePath } from "next/cache";
export async function guardarHojaNota(
  _: { error?: string; id?: string },
  f: FormData,
): Promise<{ error?: string; id?: string }> {
  try {
    const { db, perfil } = await sesion();
    if (perfil.rol !== "administrador")
      throw new Error("Solo el personal administrativo puede guardar notas.");
    const id = String(f.get("id") || ""),
      titulo = String(f.get("titulo") || "").trim(),
      bruto = String(f.get("fragmentos") || "");
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        id,
      )
    )
      throw new Error("Identificador de nota inválido.");
    if (titulo.length > 200)
      throw new Error("El título admite hasta 200 caracteres.");
    if (bruto.length > 300000) throw new Error("La nota es demasiado grande.");
    let fragmentos;
    try {
      fragmentos = JSON.parse(bruto);
    } catch {
      throw new Error(
        "No se pudo leer la nota. Conserva el texto y vuelve a intentar.",
      );
    }
    const contenido = guardarContenidoNota(fragmentos);
    const { error } = await db.rpc("guardar_nota", {
      p: { id, titulo, contenido },
    });
    if (error) throw new Error(error.message);
    revalidatePath("/notas");
    return { id };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "No se pudo guardar. Tu texto sigue en la hoja.",
    };
  }
}

export async function eliminarHojaNota(
  _: { error?: string; eliminado?: boolean },
  f: FormData,
): Promise<{ error?: string; eliminado?: boolean }> {
  try {
    const { db, perfil } = await sesion();
    if (perfil.rol !== "administrador")
      throw new Error("Solo el personal administrativo puede eliminar notas.");
    if (f.get("confirmado") !== "on")
      throw new Error("Confirma que quieres eliminar esta nota.");
    const { error } = await db.rpc("eliminar_nota", {
      p_id: String(f.get("id") || ""),
    });
    if (error) {
      if (["PGRST202", "42883"].includes(error.code))
        throw new Error(
          "Aplica el SQL 015 para activar la eliminación de notas.",
        );
      throw new Error(error.message);
    }
    revalidatePath("/notas");
    return { eliminado: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudo eliminar la nota.",
    };
  }
}

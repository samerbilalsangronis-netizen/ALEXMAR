"use server";
import { conexion, sesion } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { decimal } from "@/lib/formatos";
export async function entrar(form: FormData) {
  const db = await conexion();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("correo")),
    password: String(form.get("clave")),
  });
  if (error) redirect("/?error=credenciales");
  redirect("/inventario");
}
export async function salir() {
  const db = await conexion();
  await db.auth.signOut();
  redirect("/");
}
async function ejecutar(
  nombre: string,
  params: Record<string, unknown>,
  ruta: string,
) {
  try {
    const { db } = await sesion();
    const { error } = await db.rpc(nombre, params);
    if (error) throw error;
    revalidatePath(ruta);
  } catch (e) {
    redirect(
      ruta +
        "?error=" +
        encodeURIComponent(
          e instanceof Error ? e.message : "No se pudo guardar.",
        ),
    );
  }
  redirect(ruta + "?guardado=1");
}
export async function guardarProducto(f: FormData) {
  const id = String(f.get("id") || "");
  const ruta = id ? "/inventario/" + id : "/inventario";
  let datos;
  try {
    datos = {
      id: id || null,
      nombre: String(f.get("nombre") || "").trim(),
      descripcion: String(f.get("descripcion") || ""),
      categoria: String(f.get("categoria") || ""),
      compatibilidad: String(f.get("compatibilidad") || ""),
      marca: String(f.get("marca") || ""),
      referencia: String(f.get("referencia") || ""),
      alias: String(f.get("alias") || ""),
      ubicacion: String(f.get("ubicacion") || ""),
      precio: decimal(f.get("precio")),
      costo: decimal(f.get("costo")),
      minimo: decimal(f.get("minimo"), true),
      activo: f.get("activo") === "on",
    };
  } catch (e) {
    redirect(ruta + "?error=" + encodeURIComponent((e as Error).message));
  }
  await ejecutar("guardar_producto", { p: datos }, ruta);
}
export async function ajustarStock(f: FormData) {
  const id = String(f.get("id"));
  let contado;
  try {
    contado = decimal(f.get("contado"), true);
  } catch (e) {
    redirect(
      "/inventario/" +
        id +
        "?error=" +
        encodeURIComponent((e as Error).message),
    );
  }
  await ejecutar(
    "ajustar_stock",
    {
      p_id: id,
      p_contado: contado,
      p_motivo: String(f.get("motivo")),
      p_clave: String(f.get("clave")),
    },
    "/inventario/" + id,
  );
}
export async function guardarCliente(f: FormData) {
  await ejecutar(
    "guardar_cliente",
    {
      p: {
        id: f.get("id") || null,
        nombre: f.get("nombre"),
        documento: f.get("documento"),
        telefono: f.get("telefono"),
        direccion: f.get("direccion"),
      },
    },
    "/clientes",
  );
}
export async function guardarNota(f: FormData) {
  await ejecutar(
    "guardar_nota",
    {
      p: {
        id: f.get("id") || null,
        titulo: f.get("titulo"),
        contenido: f.get("contenido"),
      },
    },
    "/notas",
  );
}
export async function guardarUsuario(f: FormData) {
  await ejecutar(
    "asignar_perfil",
    {
      p_id: f.get("id"),
      p_nombre: f.get("nombre"),
      p_rol: f.get("rol"),
      p_activo: f.get("activo") === "on",
    },
    "/configuracion",
  );
}
export async function guardarConsulta(f: FormData) {
  await ejecutar(
    "guardar_consulta",
    { p_nombre: f.get("nombre"), p_filtros: f.get("filtros") },
    "/inventario",
  );
}

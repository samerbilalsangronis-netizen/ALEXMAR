"use server";
import { conexion, sesion } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { identificadorAuth } from "@/lib/accesos";
import { decimal } from "@/lib/formatos";
export async function entrar(form: FormData) {
  const db = await conexion();
  let email: string;
  const portal =
    form.get("acceso") === "general" ? "general" : "administrativo";
  try {
    email = identificadorAuth(
      String(form.get("identificador") || form.get("correo") || ""),
    );
  } catch {
    redirect("/?error=credenciales&acceso=" + portal);
  }
  const { error } = await db.auth.signInWithPassword({
    email,
    password: String(form.get("clave") || ""),
  });
  if (error) redirect("/?error=credenciales&acceso=" + portal);
  const { data: entrada, error: fallo } = await db.rpc("registrar_ingreso", {
    p_portal: portal,
  });
  if (fallo || !entrada?.permitido) {
    await db.auth.signOut({ scope: "local" });
    const motivo = fallo
      ? "activar-accesos"
      : entrada?.motivo === "bloqueado"
        ? "bloqueado"
        : entrada?.motivo === "portal_incorrecto"
          ? "portal"
          : "sin-perfil";
    redirect("/?error=" + motivo + "&acceso=" + portal);
  }
  redirect(portal === "general" ? "/consulta" : "/panel");
}
export async function salir() {
  const db = await conexion();
  await db.auth.signOut({ scope: "local" });
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
  const { perfil } = await sesion();
  if (perfil.rol !== "administrador" || perfil.version_accesos !== 13)
    redirect(
      "/configuracion?error=" +
        encodeURIComponent(
          "Activa SQL 013 y usa una cuenta administrativa para gestionar accesos.",
        ),
    );
  if (!["administrador", "lectura"].includes(String(f.get("rol"))))
    redirect(
      "/configuracion?error=" +
        encodeURIComponent("Selecciona Administrativo o General."),
    );

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

async function cambiarCompatibilidad(f: FormData, eliminar: boolean) {
  const producto = String(f.get("producto") || "");
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      producto,
    )
  ) {
    throw new Error("Producto inválido.");
  }
  const ruta = "/inventario/" + producto;
  const contexto = new URLSearchParams();
  for (const k of ["volver", "pagina", "compat_pagina"]) {
    const valor = String(f.get(k) || "");
    if (valor) contexto.set(k, valor);
  }
  try {
    const { db, perfil } = await sesion();
    if (!["administrador", "inventario"].includes(perfil.rol)) {
      throw new Error("No tienes permiso para esta operación.");
    }
    if (eliminar && f.get("confirmar") !== "on")
      throw new Error("Confirma la eliminación.");
    const { error } = eliminar
      ? await db.rpc("eliminar_compatibilidad", {
          p_producto: producto,
          p_id: f.get("id"),
        })
      : await db.rpc("guardar_compatibilidad", {
          p_producto: producto,
          p: {
            id: f.get("id") || null,
            marca: String(f.get("marca") || "").trim(),
            modelo: String(f.get("modelo") || "").trim(),
            anio_desde: f.get("anio_desde") || null,
            anio_hasta: f.get("anio_hasta") || null,
            universal: f.get("universal") === "on",
          },
        });
    if (error) throw new Error(error.message);
    revalidatePath(ruta);
    revalidatePath("/inventario");
  } catch (e) {
    contexto.set(
      "error",
      e instanceof Error ? e.message : "No se pudo guardar.",
    );
    redirect(ruta + "?" + contexto + "#compatibilidades");
  }
  contexto.set("guardado", "1");
  redirect(ruta + "?" + contexto + "#compatibilidades");
}
export async function guardarCompatibilidad(f: FormData) {
  await cambiarCompatibilidad(f, false);
}
export async function eliminarCompatibilidad(f: FormData) {
  await cambiarCompatibilidad(f, true);
}

export async function guardarProveedor(f: FormData) {
  const { perfil } = await sesion();
  if (!["administrador", "inventario"].includes(perfil.rol))
    throw new Error("No tienes permiso para guardar proveedores.");
  const campos = [
    "nombre",
    "documento",
    "contacto",
    "telefono",
    "correo",
    "direccion",
    "ciudad",
    "categorias",
    "marcas",
    "condiciones",
    "notas",
  ];
  await ejecutar(
    "guardar_proveedor",
    {
      p: {
        ...Object.fromEntries(
          campos.map((k) => [k, String(f.get(k) || "").trim()]),
        ),
        id: f.get("id") || null,
        monedas: f.getAll("monedas"),
        activo: f.get("activo") === "on",
      },
    },
    "/proveedores",
  );
}

export async function guardarClasificacion(f: FormData) {
  const id = String(f.get("id") || "");
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new Error("Producto inválido.");
  const ruta = "/inventario/" + id;
  const q = new URLSearchParams();
  if (f.get("volver")) q.set("volver", String(f.get("volver")));
  try {
    const { db, perfil } = await sesion();
    if (!["administrador", "inventario"].includes(perfil.rol))
      throw new Error("No tienes permiso para clasificar productos.");
    const vehiculos = String(f.get("vehiculos_grupo") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const { error } = await db.rpc("guardar_clasificacion", {
      p_id: id,
      p_categoria: String(f.get("categoria_grupo") || "").trim() || null,
      p_vehiculos: vehiculos.length ? vehiculos : null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/inventario");
    revalidatePath("/reportes");
    revalidatePath(ruta);
  } catch (e) {
    q.set("error", e instanceof Error ? e.message : "No se pudo clasificar.");
    redirect(ruta + "?" + q);
  }
  q.set("guardado", "1");
  redirect(ruta + "?" + q);
}

export async function emitirVenta(f: FormData) {
  const id = String(f.get("id") || "");
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Venta inválida.");
  const ruta = "/facturacion/" + id;
  try {
    const { db, perfil } = await sesion();
    if (!["administrador", "ventas"].includes(perfil.rol))
      throw new Error("No tienes permiso para emitir.");
    if (f.get("confirmar") !== "on")
      throw new Error("Revisa y confirma la emisión de la factura.");
    const { error } = await db.rpc("emitir_venta", {
      p_id: id,
      p_version: Number(f.get("version")),
    });
    if (error) throw new Error(error.message);
    for (const p of [
      ruta,
      "/facturacion",
      "/inventario",
      "/clientes",
      "/panel",
      "/reportes",
    ])
      revalidatePath(p);
  } catch (e) {
    redirect(
      ruta +
        "?error=" +
        encodeURIComponent(
          e instanceof Error ? e.message : "No se pudo emitir.",
        ),
    );
  }
  redirect(ruta + "?guardado=1");
}
export async function anularVenta(f: FormData) {
  const id = String(f.get("id") || "");
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Venta inválida.");
  const ruta = "/facturacion/" + id;
  try {
    const { db, perfil } = await sesion();
    if (perfil.rol !== "administrador")
      throw new Error("Solo el administrador puede anular.");
    if (f.get("confirmar") !== "on") throw new Error("Confirma la anulación.");
    const { error } = await db.rpc("anular_factura_revisada", {
      p_version: Number(f.get("version")),
      p_id: id,
      p_motivo: String(f.get("motivo") || ""),
      p_reembolso: f.get("reembolso") === "on",
    });
    if (error) throw new Error(error.message);
    for (const p of [
      ruta,
      "/facturacion",
      "/inventario",
      "/clientes",
      "/panel",
      "/reportes",
    ])
      revalidatePath(p);
  } catch (e) {
    redirect(
      ruta +
        "?error=" +
        encodeURIComponent(
          e instanceof Error ? e.message : "No se pudo anular.",
        ),
    );
  }
  redirect(ruta + "?guardado=1");
}

export async function configurarInventario(f: FormData) {
  const ruta = "/configuracion";
  try {
    const { db, perfil } = await sesion();
    if (perfil.rol !== "administrador")
      throw new Error("Solo el administrador puede configurar inventario.");
    const { error } = await db.rpc("configurar_descuento_stock", {
      p_activo: f.get("descontar_stock") === "on",
      p_version: Number(f.get("version_stock")),
    });
    if (error) throw new Error(error.message);
    for (const p of [ruta, "/facturacion", "/facturacion/nueva", "/panel"])
      revalidatePath(p);
  } catch (e) {
    redirect(
      ruta +
        "?error=" +
        encodeURIComponent(
          e instanceof Error
            ? e.message
            : "No se pudo guardar la configuración.",
        ),
    );
  }
  redirect(ruta + "?guardado=1#inventario");
}

export async function bloquearGenerales(f: FormData) {
  const ruta = "/configuracion";
  try {
    const { db, perfil } = await sesion();
    if (perfil.rol !== "administrador")
      throw new Error("Solo administración puede cambiar el bloqueo.");
    const { error } = await db.rpc("bloquear_acceso_general", {
      p_bloquear: f.get("bloquear") === "true",
      p_version: Number(f.get("version")),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
  } catch (e) {
    redirect(
      ruta +
        "?error=" +
        encodeURIComponent(
          e instanceof Error ? e.message : "No se pudo cambiar el bloqueo.",
        ),
    );
  }
  redirect(ruta + "?guardado=1#personal");
}

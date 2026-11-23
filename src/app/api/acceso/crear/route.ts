import { NextRequest, NextResponse } from "next/server";
import { conexion } from "@/lib/supabase";
import { mismoOrigen } from "@/lib/origen";
import { correoDeUsuario, usuarioCanonico } from "@/lib/accesos";
import {
  gestionIdentidades,
  gestionIdentidadesDisponible,
} from "@/lib/crear-identidad";
class CampoInvalido extends Error {}
export async function POST(req: NextRequest) {
  if (!mismoOrigen(req))
    return NextResponse.json(
      { error: "Origen no autorizado." },
      { status: 403 },
    );
  try {
    const db = await conexion();
    const {
      data: { user },
      error: falloAuth,
    } = await db.auth.getUser();
    if (falloAuth || !user)
      return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    const { data: perfil, error: falloPerfil } = await db.rpc("mi_perfil");
    if (falloPerfil || perfil?.rol !== "administrador")
      return NextResponse.json(
        { error: "Solo administración puede crear usuarios." },
        { status: 403 },
      );
    if (perfil.version_accesos !== 13)
      return NextResponse.json(
        { error: "Activa SQL 013 antes de registrar usuarios." },
        { status: 409 },
      );
    if (!gestionIdentidadesDisponible())
      return NextResponse.json(
        {
          error:
            "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor. Puedes crear la identidad desde Authentication y asignar su acceso en este panel.",
        },
        { status: 503 },
      );
    const texto = await req.text();
    if (new TextEncoder().encode(texto).length > 12000)
      throw new CampoInvalido("Formulario demasiado grande.");
    const p = JSON.parse(texto);
    const nombre = String(p.nombre || "").trim(),
      usuario = (() => {
        try {
          return usuarioCanonico(String(p.usuario || ""));
        } catch {
          throw new CampoInvalido(
            "Revisa el nombre de usuario: letras, números, puntos o espacios.",
          );
        }
      })();
    if (nombre.length < 2 || nombre.length > 200)
      throw new CampoInvalido("Escribe el nombre completo (2–200 caracteres).");
    if (
      typeof p.clave !== "string" ||
      p.clave.length < 8 ||
      p.clave.length > 128
    )
      throw new CampoInvalido(
        "La contraseña debe tener entre 8 y 128 caracteres.",
      );
    if (!["administrativo", "general"].includes(p.acceso))
      throw new CampoInvalido("Selecciona el acceso.");
    const admin = gestionIdentidades();
    // El correo interno es un identificador de Auth; el empleado inicia con su usuario.
    const { data, error } = await admin.createUser({
      email: correoDeUsuario(usuario),
      password: p.clave,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (error || !data.user)
      return NextResponse.json(
        {
          error:
            "No se pudo crear la identidad. Revisa si el usuario ya existe o si la contraseña cumple la política de Supabase.",
        },
        { status: 409 },
      );
    const creado = data.user.id;
    // La asignación usa el JWT del administrador, no privilegios de servicio.
    const { error: falloAsignacion } = await db.rpc("asignar_perfil", {
      p_id: creado,
      p_nombre: nombre,
      p_rol: p.acceso === "administrativo" ? "administrador" : "lectura",
      p_activo: true,
    });
    if (falloAsignacion) {
      const { error: falloReversion } = await admin.deleteUser(creado);
      return NextResponse.json(
        {
          error: falloReversion
            ? "La identidad se creó pero falta asignar el acceso. Revisa Authentication antes de reintentar."
            : "No se pudo asignar el acceso. Se revirtió la identidad recién creada.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { creado: true, usuario, acceso: p.acceso },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CampoInvalido
            ? e.message
            : "No se pudo completar el registro. Revisa los datos y la conexión.",
      },
      { status: 400 },
    );
  }
}

import { consultar } from "@/lib/supabase";
import { Cabecera, Avisos } from "@/components/comunes";
import { guardarUsuario } from "@/app/actions";
export default async function Configuracion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const perfiles =
    await consultar<
      { id: string; nombre: string; rol: string; activo: boolean }[]
    >("listar_perfiles");
  return (
    <>
      <Cabecera
        titulo="Usuarios y acceso"
        subtitulo="Permisos verificados en el servidor y en la base de datos."
      />
      <Avisos p={p} />
      <section className="panel">
        <h2>Usuarios autorizados</h2>
        {perfiles.map((p) => (
          <p key={p.id}>
            <strong>{p.nombre}</strong> · {p.rol} ·{" "}
            {p.activo ? "Activo" : "Inactivo"}
          </p>
        ))}
      </section>
      <section className="panel">
        <h2>Asignar o actualizar acceso</h2>
        <p>
          Crea primero el usuario en Supabase → Authentication → Users. Copia su
          UUID aquí.
        </p>
        <form action={guardarUsuario} className="formulario">
          <label>
            ID del usuario
            <input name="id" required pattern="[a-fA-F0-9-]{36}" />
          </label>
          <label>
            Nombre
            <input name="nombre" required />
          </label>
          <label>
            Rol
            <select name="rol">
              <option value="ventas">
                Ventas: catálogo, clientes y cuentas
              </option>
              <option value="inventario">
                Inventario: catálogo, costos y ajustes
              </option>
              <option value="lectura">Lectura: catálogo sin costos</option>
              <option value="administrador">
                Administrador: todos los módulos disponibles
              </option>
            </select>
          </label>
          <label className="checkbox">
            <input name="activo" type="checkbox" defaultChecked />
            Activo
          </label>
          <button>Guardar acceso</button>
        </form>
      </section>
    </>
  );
}

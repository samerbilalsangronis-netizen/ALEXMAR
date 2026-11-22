import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { Cabecera, Avisos } from "@/components/comunes";
import { guardarUsuario, configurarInventario } from "@/app/actions";
export default async function Configuracion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const { db, perfil } = await sesion();
  if (perfil.rol !== "administrador") notFound();
  const [usuarios, config] = await Promise.all([
    db.rpc("listar_perfiles"),
    db.rpc("configuracion_facturacion"),
  ]);
  if (usuarios.error) throw new Error(usuarios.error.message);
  if (config.error && !["PGRST202", "42883"].includes(config.error.code))
    throw new Error(config.error.message);
  const perfiles = usuarios.data as {
    id: string;
    nombre: string;
    rol: string;
    activo: boolean;
  }[];
  const activo = config.data?.descontar_stock;
  return (
    <>
      <Cabecera
        titulo="Configuración"
        subtitulo="Permisos verificados en el servidor y en la base de datos."
      />
      <Avisos p={p} />
      <section className="panel" id="inventario">
        <h2>Inventario al facturar</h2>
        {typeof activo === "boolean" ? (
          <form
            key={config.data.version_stock}
            action={configurarInventario}
            className="formulario"
          >
            <input
              name="version_stock"
              type="hidden"
              value={config.data.version_stock}
            />
            <label className="checkbox">
              <input
                name="descontar_stock"
                type="checkbox"
                defaultChecked={activo}
              />
              Descontar inventario al facturar
            </label>
            <p>
              {activo
                ? "Activo: se comprueba disponibilidad y cada factura descuenta sus piezas."
                : "Desactivado: se permite vender sin existencias registradas y las facturas no cambian el inventario."}
            </p>
            <small>
              Actívalo cuando termines el conteo. Solo afecta facturas que se
              emitan después; no descuenta ventas anteriores retroactivamente.
              Al estar activo, una existencia insuficiente bloquea la venta.
            </small>
            <button>Guardar configuración de inventario</button>
          </form>
        ) : (
          <p className="aviso">
            Aplica una vez el{" "}
            <a href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261122001200_control_stock_rendimiento.sql">
              SQL 012
            </a>{" "}
            para activar esta opción.
          </p>
        )}
      </section>
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

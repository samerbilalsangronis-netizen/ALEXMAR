import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { CrearPersonal } from "@/components/crear-personal";
import { gestionIdentidadesDisponible } from "@/lib/crear-identidad";
import { pagina, type Pagina } from "@/lib/formatos";
import { Cabecera, Avisos, Paginacion } from "@/components/comunes";
import {
  guardarUsuario,
  configurarInventario,
  bloquearGenerales,
} from "@/app/actions";
export default async function Configuracion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const { db, perfil } = await sesion();
  if (perfil.rol !== "administrador") notFound();
  const [usuarios, config, control, ingresos] = await Promise.all([
    db.rpc("listar_perfiles"),
    db.rpc("configuracion_facturacion"),
    db.rpc("estado_control_acceso"),
    db.rpc("historial_accesos", {
      p_pagina: pagina(p.pagina_accesos),
      p_usuario: p.persona || null,
    }),
  ]);
  if (usuarios.error) throw new Error(usuarios.error.message);
  if (config.error && !["PGRST202", "42883"].includes(config.error.code))
    throw new Error(config.error.message);
  const perfiles = usuarios.data as {
    id: string;
    nombre: string;
    rol: string;
    activo: boolean;
    usuario?: string;
  }[];
  const activo = config.data?.descontar_stock;
  for (const respuesta of [control, ingresos])
    if (
      respuesta.error &&
      !["PGRST202", "42883"].includes(respuesta.error.code)
    )
      throw new Error(respuesta.error.message);
  const accesosActivos =
    !control.error && !ingresos.error && perfil.version_accesos === 13;
  const historial = ingresos.data as Pagina<{
    id: string;
    nombre: string;
    acceso: string;
    portal: string;
    resultado: string;
    creado: string;
  }> | null;
  const fechaHora = (s: string) =>
    new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(s));
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
      <section className="panel" id="personal">
        <h2>Acceso del personal</h2>
        {!accesosActivos ? (
          <p className="aviso">
            Aplica una vez el{" "}
            <a href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261123001300_accesos_personal.sql">
              SQL 013
            </a>{" "}
            para activar separación de accesos, registro de entradas y bloqueo
            general.
          </p>
        ) : (
          <>
            <div
              className={control.data.generales_bloqueados ? "aviso" : "exito"}
            >
              <strong>
                {control.data.generales_bloqueados
                  ? "Acceso general bloqueado"
                  : "Acceso general habilitado"}
              </strong>
              <p>
                {control.data.generales_bloqueados
                  ? "Solo los administrativos pueden trabajar. Los empleados no pueden consultar precios."
                  : "Los empleados autorizados pueden consultar productos y precios de venta."}
              </p>
            </div>
            <form action={bloquearGenerales} className="acciones">
              <input
                name="version"
                type="hidden"
                value={control.data.version}
              />
              <input
                name="bloquear"
                type="hidden"
                value={String(!control.data.generales_bloqueados)}
              />
              <button
                className={control.data.generales_bloqueados ? "" : "peligro"}
              >
                {control.data.generales_bloqueados
                  ? "Permitir acceso general"
                  : "Bloquear acceso general"}
              </button>
            </form>
            <small>
              También bloquea nuevas consultas de sesiones abiertas. Las
              pantallas de empleados comprueban el permiso cada 10 segundos y al
              volver a la ventana.
            </small>
          </>
        )}
      </section>
      {accesosActivos && (
        <>
          <CrearPersonal habilitado={gestionIdentidadesDisponible()} />
          <section className="panel">
            <h2>Usuarios autorizados</h2>
            <p>
              Administrativo: gestión completa. General: solo consulta de
              productos y precios de venta.
            </p>
            <div className="personal-lista">
              {perfiles.map((persona) => (
                <form
                  action={guardarUsuario}
                  className="personal-fila"
                  key={
                    persona.id +
                    ":" +
                    persona.rol +
                    ":" +
                    String(persona.activo) +
                    ":" +
                    persona.nombre
                  }
                >
                  <input type="hidden" name="id" value={persona.id} />
                  <label>
                    Nombre
                    {persona.usuario && (
                      <small>Ingreso: {persona.usuario}</small>
                    )}
                    <input
                      name="nombre"
                      defaultValue={persona.nombre}
                      minLength={2}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label>
                    Acceso
                    <select name="rol" defaultValue={persona.rol}>
                      <option value="administrador">Administrativo</option>
                      <option value="lectura">General</option>
                    </select>
                  </label>
                  <label className="checkbox">
                    <input
                      name="activo"
                      type="checkbox"
                      defaultChecked={persona.activo}
                    />
                    Activo
                  </label>
                  <button className="secundario">Guardar acceso</button>
                </form>
              ))}
            </div>
          </section>
          <details className="panel">
            <summary>
              Asignar acceso a una identidad existente de Supabase
            </summary>
            <p>
              Si ya creaste la cuenta desde Authentication → Users, copia su
              UUID. Para ingresar con un usuario sin correo, la identidad debe
              usar usuario@accesos.alexmar.invalid; reemplaza usuario por el
              nombre de ingreso normalizado, con puntos en lugar de espacios.
              Las cuentas existentes con correo mantienen ese correo para
              ingresar.
            </p>
            <form action={guardarUsuario} className="formulario">
              <label>
                ID de Authentication
                <input name="id" required pattern="[a-fA-F0-9-]{36}" />
              </label>
              <label>
                Nombre completo
                <input name="nombre" required minLength={2} maxLength={200} />
              </label>
              <label>
                Acceso
                <select name="rol" defaultValue="lectura">
                  <option value="lectura">General · productos y precios</option>
                  <option value="administrador">
                    Administrativo · gestión completa
                  </option>
                </select>
              </label>
              <label className="checkbox">
                <input name="activo" type="checkbox" defaultChecked />
                Activo
              </label>
              <button>Asignar acceso existente</button>
            </form>
          </details>
          <section className="panel">
            <h2>Registro de entradas</h2>
            <p className="muted">
              Sesiones autenticadas, tipo de acceso y resultado · hora de
              Venezuela.
            </p>
            <form className="filtros">
              <label>
                Persona
                <select name="persona" defaultValue={p.persona || ""}>
                  <option value="">Todo el personal</option>
                  {perfiles.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secundario">Consultar entradas</button>
            </form>
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Persona</th>
                    <th>Acceso</th>
                    <th>Ingreso seleccionado</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial?.filas.map((x) => (
                    <tr key={x.id}>
                      <td>{fechaHora(x.creado)}</td>
                      <td>{x.nombre}</td>
                      <td>
                        {x.acceso === "administrativo"
                          ? "Administrativo"
                          : "General"}
                      </td>
                      <td>
                        {x.portal === "administrativo"
                          ? "Administrativo"
                          : "General"}
                      </td>
                      <td>
                        {(
                          {
                            permitido: "Permitido",
                            bloqueado: "Bloqueado",
                            portal_incorrecto: "Ingreso incorrecto",
                            inactivo: "Inactivo",
                          } as Record<string, string>
                        )[x.resultado] || x.resultado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historial?.total === 0 && (
              <p>No hay entradas registradas todavía.</p>
            )}
            {historial && (
              <Paginacion
                {...historial}
                ruta="/configuracion"
                parametros={{ persona: p.persona || "" }}
                parametroPagina="pagina_accesos"
              />
            )}
          </section>
        </>
      )}
    </>
  );
}

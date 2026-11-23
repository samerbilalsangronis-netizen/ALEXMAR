import Link from "next/link";
import { Tema } from "@/components/tema";
import { Marca } from "@/components/marca";
import { configurado } from "@/lib/supabase";
import { entrar } from "./actions";
export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const general = p.acceso === "general";
  return (
    <main className="acceso">
      <div className="tema-acceso">
        <Tema />
      </div>
      <section className="marca-acceso">
        <span className="etiqueta">AUTOPERIQUITOS Y ROTULADOS</span>
        <Marca portada />
        <h1>
          Todo tu negocio.
          <br />
          <span>En un solo lugar.</span>
        </h1>
        <div className="linea" />
        <p>
          Encuentra la pieza correcta. Consulta tus cuentas. Mantén el control
          de tu inventario.
        </p>
      </section>
      <section className="panel login">
        <span className="etiqueta">ESPACIO PRIVADO</span>
        <h2>{general ? "Consulta de precios" : "Ingreso administrativo"}</h2>
        <nav className="portales-acceso" aria-label="Tipo de ingreso">
          <Link
            href="/?acceso=administrativo"
            aria-current={!general ? "page" : undefined}
          >
            Administrativo
          </Link>
          <Link
            href="/?acceso=general"
            aria-current={general ? "page" : undefined}
          >
            General · Empleados
          </Link>
        </nav>
        <p className="muted">
          {general
            ? "Consulta productos y precios de venta con tu usuario autorizado."
            : "Accede a la gestión completa con tu cuenta administrativa."}
        </p>
        {!configurado() ? (
          <div className="aviso">
            Conexión pendiente. Agrega la URL y la clave publicable del Supabase
            nuevo en las variables de Vercel. Consulta README.md del
            repositorio.
          </div>
        ) : (
          <form action={entrar}>
            <input
              type="hidden"
              name="acceso"
              value={general ? "general" : "administrativo"}
            />
            {p.error && (
              <p className="aviso" role="alert">
                {p.error === "sin-perfil"
                  ? "Tu usuario no tiene un perfil activo. Solicita acceso al administrador."
                  : p.error === "bloqueado"
                    ? "El acceso general está bloqueado por administración."
                    : p.error === "portal"
                      ? "Esta cuenta no corresponde al acceso seleccionado."
                      : p.error === "activar-accesos"
                        ? "Falta activar la separación de accesos con SQL 013."
                        : "No se pudo iniciar sesión. Revisa usuario y contraseña."}
              </p>
            )}
            <label>
              Usuario o correo
              <input
                type="text"
                name="identificador"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                name="clave"
                autoComplete="current-password"
                required
                minLength={8}
              />
            </label>
            <button>Entrar al sistema →</button>
          </form>
        )}
        <small>Acceso con conexión · America/Caracas</small>
      </section>
    </main>
  );
}

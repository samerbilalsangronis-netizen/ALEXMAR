import { configurado } from "@/lib/supabase";
import { entrar } from "./actions";
export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  return (
    <main className="acceso">
      <section className="marca-acceso">
        <span className="etiqueta">AUTOPERIQUITOS Y ROTULADOS</span>
        <h1>
          ALEX<span>MAR</span>
        </h1>
        <p>Tu negocio, en orden.</p>
        <div className="linea" />
        <p>Productos, clientes e información clara para cada decisión.</p>
      </section>
      <section className="panel login">
        <span className="etiqueta">ESPACIO PRIVADO</span>
        <h2>Bienvenido de nuevo</h2>
        <p className="muted">Ingresa con tu cuenta autorizada.</p>
        {!configurado() ? (
          <div className="aviso">
            Conexión pendiente. Agrega la URL y la clave publicable del Supabase
            nuevo en las variables de Vercel. Consulta README.md del
            repositorio.
          </div>
        ) : (
          <form action={entrar}>
            {p.error && (
              <p className="aviso" role="alert">
                {p.error === "sin-perfil"
                  ? "Tu usuario no tiene un perfil activo. Solicita acceso al administrador."
                  : "No se pudo iniciar sesión. Revisa correo y contraseña."}
              </p>
            )}
            <label>
              Correo
              <input
                type="email"
                name="correo"
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

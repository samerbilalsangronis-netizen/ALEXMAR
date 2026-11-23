"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usuarioCanonico } from "@/lib/accesos";
export function CrearPersonal({ habilitado }: { habilitado: boolean }) {
  const router = useRouter(),
    form = useRef<HTMLFormElement>(null),
    [ocupado, setOcupado] = useState(false),
    [error, setError] = useState(""),
    [listo, setListo] = useState(""),
    [usuario, setUsuario] = useState("");
  const enviando = useRef(false);
  let normal = "";
  try {
    normal = usuarioCanonico(usuario);
  } catch {}
  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setError("");
    setListo("");
    try {
      const f = new FormData(e.currentTarget);
      const r = await fetch("/api/acceso/crear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: f.get("nombre"),
            usuario: f.get("usuario"),
            clave: f.get("clave"),
            acceso: f.get("acceso"),
          }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo crear el usuario.");
      form.current?.reset();
      setUsuario("");
      setListo("Usuario " + d.usuario + " creado con acceso " + d.acceso + ".");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el usuario.");
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  return (
    <section className="panel">
      <h2>Crear usuario de personal</h2>
      {!habilitado ? (
        <p>
          Para crearlo desde aquí, configura la clave administrativa de Supabase
          solo en el servidor de Vercel. También puedes usar la opción de
          asignar acceso a una identidad creada en Authentication, que aparece
          abajo.
        </p>
      ) : (
        <form ref={form} onSubmit={crear} className="formulario">
          <label>
            Nombre completo
            <input
              name="nombre"
              required
              minLength={2}
              maxLength={200}
              autoComplete="off"
            />
          </label>
          <label>
            Usuario de ingreso
            <input
              name="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              minLength={3}
              maxLength={64}
              autoComplete="off"
            />
          </label>
          {normal && (
            <small>
              Iniciará con: <strong>{normal}</strong>. También puede escribir el
              nombre con espacios.
            </small>
          )}
          <label>
            Contraseña inicial
            <input
              name="clave"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            Tipo de acceso
            <select name="acceso" defaultValue="general">
              <option value="general">
                General · solo productos y precios
              </option>
              <option value="administrativo">
                Administrativo · gestión completa
              </option>
            </select>
          </label>
          <button disabled={ocupado}>
            {ocupado ? "Creando usuario…" : "Crear usuario"}
          </button>
        </form>
      )}
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
      {listo && (
        <p className="exito" role="status">
          {listo}
        </p>
      )}
    </section>
  );
}

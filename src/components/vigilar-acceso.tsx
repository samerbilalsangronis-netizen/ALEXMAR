"use client";
import { useEffect, useState } from "react";
export function VigilarAcceso({
  acceso,
}: {
  acceso: "administrativo" | "general";
}) {
  const [verificando, setVerificando] = useState(false);
  useEffect(() => {
    let vivo = true;
    let enCurso = false;
    let controlador: AbortController | null = null;
    async function comprobar() {
      if (enCurso || document.hidden) return;
      enCurso = true;
      controlador = new AbortController();
      try {
        const r = await fetch("/api/acceso/estado", {
          cache: "no-store",
          signal: controlador.signal,
        });
        if (!vivo) return;
        if (r.status === 401) {
          window.location.replace("/?error=sin-perfil");
          return;
        }
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!d.activo) {
          window.location.replace("/?error=sin-perfil");
          return;
        }
        if (d.bloqueado) {
          window.location.replace("/bloqueado");
          return;
        }
        if (d.acceso && d.acceso !== acceso) {
          window.location.replace(
            d.acceso === "administrativo" ? "/panel" : "/consulta",
          );
          return;
        }
        setVerificando(false);
      } catch {
        if (vivo) setVerificando(true);
      } finally {
        enCurso = false;
      }
    }
    void comprobar();
    const t = setInterval(() => void comprobar(), 10000);
    window.addEventListener("focus", comprobar);
    window.addEventListener("pageshow", comprobar);
    document.addEventListener("visibilitychange", comprobar);
    return () => {
      vivo = false;
      controlador?.abort();
      clearInterval(t);
      window.removeEventListener("focus", comprobar);
      window.removeEventListener("pageshow", comprobar);
      document.removeEventListener("visibilitychange", comprobar);
    };
  }, [acceso]);
  if (!verificando) return null;
  // Si no se puede verificar el permiso, se oculta la consulta hasta recuperar conexión.
  return (
    <div className="acceso-verificando" role="alert">
      <section className="panel">
        <h2>Verificando tu acceso</h2>
        <p>
          Se perdió la conexión. La consulta volverá a mostrarse cuando podamos
          verificar tu permiso.
        </p>
      </section>
    </div>
  );
}

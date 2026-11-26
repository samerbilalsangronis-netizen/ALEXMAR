export const dynamic = "force-dynamic";
import { VigilarAcceso } from "@/components/vigilar-acceso";
import { Tema } from "@/components/tema";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Marca } from "@/components/marca";
import { Navegacion } from "@/components/navegacion";
import { sesion } from "@/lib/supabase";
import { salir } from "@/app/actions";
export default async function Privado({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await sesion();
  return (
    <div className="estructura">
      {perfil.version_accesos === 13 && (
        <VigilarAcceso
          acceso={perfil.rol === "administrador" ? "administrativo" : "general"}
        />
      )}
      <a className="saltar" href="#principal">
        Saltar al contenido
      </a>
      <aside className="barra no-imprimir">
        <Link
          href={perfil.rol === "administrador" ? "/panel" : "/consulta"}
          className="logotipo"
        >
          <Marca />
          <small>GESTIÓN COMERCIAL</small>
        </Link>
        <div className="separador" />
        <span className="etiqueta">TU ESPACIO DE TRABAJO</span>
        <Navegacion rol={perfil.rol} />
        <div className="usuario">
          <div className="avatar">{perfil.nombre.slice(0, 1)}</div>
          <div>
            <strong>{perfil.nombre}</strong>
            <small>
              {perfil.rol === "administrador" ? "Administrativo" : "General"}
            </small>
          </div>
          <form action={salir}>
            <button
              className="icono"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className="contenido">
        <div className="franja no-imprimir">
          <span className="etiqueta">ALEXMAR · GESTIÓN</span>
          <div className="acciones">
            <span className="moneda-global">USD · Caracas</span>
            <Tema />
          </div>
        </div>
        <main id="principal">{children}</main>
      </div>
    </div>
  );
}

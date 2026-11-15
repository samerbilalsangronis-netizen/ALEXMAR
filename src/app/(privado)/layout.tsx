export const dynamic = "force-dynamic";
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
      <aside className="barra no-imprimir">
        <Link href="/panel" className="logotipo">
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
            <small>{perfil.rol}</small>
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
          <span>ESPACIO DE TRABAJO</span>
          <span>USD · America/Caracas</span>
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}

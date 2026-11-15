export const dynamic = "force-dynamic";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  Users,
  StickyNote,
  Upload,
  Settings,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import { sesion } from "@/lib/supabase";
import { salir } from "@/app/actions";
const enlaces = [
  ["/panel", "Resumen", LayoutDashboard, "todos"],
  ["/inventario", "Inventario", Package, "todos"],
  ["/clientes", "Clientes y cuentas", Users, "ventas"],
  ["/notas", "Notas", StickyNote, "admin"],
  ["/migracion", "Importación", Upload, "admin"],
  ["/configuracion", "Usuarios", Settings, "admin"],
] as const;
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
          ALEX<span>MAR</span>
          <small>GESTIÓN COMERCIAL</small>
        </Link>
        <div className="separador" />
        <span className="etiqueta">TU ESPACIO DE TRABAJO</span>
        <nav>
          {enlaces
            .filter(
              (e) =>
                e[3] === "todos" ||
                perfil.rol === "administrador" ||
                (e[3] === "ventas" && perfil.rol === "ventas"),
            )
            .map(([ruta, texto, Icono]) => (
              <Link key={ruta} href={ruta}>
                <Icono size={19} />
                {texto}
                <ArrowUpRight size={13} />
              </Link>
            ))}
        </nav>
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
          <span>
            <i /> Conexión requerida
          </span>
          <span>USD · America/Caracas</span>
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}

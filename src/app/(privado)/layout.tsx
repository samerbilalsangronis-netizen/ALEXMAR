export const dynamic = "force-dynamic";
import { Tema } from "@/components/tema";
import { Search, Plus } from "lucide-react";
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
      <a className="saltar" href="#principal">
        Saltar al contenido
      </a>
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
          <form action="/inventario" className="busqueda-global">
            <Search size={18} aria-hidden="true" />
            <input
              name="q"
              aria-label="Buscar en todo el inventario"
              placeholder="Encuentra una pieza, referencia o vehículo…"
            />
            <button
              className="icono secundario"
              aria-label="Buscar en inventario"
            >
              <Search size={18} />
            </button>
          </form>
          <div className="acciones">
            <span className="moneda-global">USD · Caracas</span>
            <Tema />
            {["administrador", "ventas"].includes(perfil.rol) && (
              <Link className="boton factura-global" href="/facturacion/nueva">
                <Plus size={17} />
                <span>Nueva factura</span>
              </Link>
            )}
          </div>
        </div>
        <main id="principal">{children}</main>
      </div>
    </div>
  );
}

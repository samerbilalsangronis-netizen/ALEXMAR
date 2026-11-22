"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  StickyNote,
  FileText,
  Upload,
  Settings,
  Truck,
  ChartNoAxesCombined,
  ChevronRight,
} from "lucide-react";
const enlaces = [
  ["/panel", "Rendimiento", LayoutDashboard, "todos"],
  ["/facturacion", "Facturación", FileText, "ventas"],
  ["/inventario", "Inventario", Package, "todos"],
  ["/proveedores", "Proveedores", Truck, "inventario"],
  ["/clientes", "Clientes y cuentas", Users, "ventas"],
  ["/reportes", "Reportes", ChartNoAxesCombined, "todos"],
  ["/notas", "Notas", StickyNote, "admin"],
  ["/migracion", "Importar archivos", Upload, "admin"],
  ["/configuracion", "Configuración", Settings, "admin"],
] as const;
export function Navegacion({ rol }: { rol: string }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Navegación principal">
      {enlaces
        .filter(
          (e) =>
            e[3] === "todos" ||
            rol === "administrador" ||
            (e[3] === "ventas" && rol === "ventas") ||
            (e[3] === "inventario" && rol === "inventario"),
        )
        .map(([href, texto, Icono]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              ruta === href || ruta.startsWith(href + "/") ? "page" : undefined
            }
          >
            <Icono size={19} />
            <span>{texto}</span>
            <ChevronRight size={14} />
          </Link>
        ))}
    </nav>
  );
}

import { Analitica } from "@/components/analitica";
import { Plus, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { consultar, sesion } from "@/lib/supabase";
import { Cabecera } from "@/components/comunes";
import { monto, cantidad } from "@/lib/formatos";
export default async function Panel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const { perfil } = await sesion();
  const d = await consultar<Record<string, string>>("resumen");
  return (
    <>
      <Cabecera
        titulo="Cada pieza cuenta."
        subtitulo="Tu operación, tus clientes y las oportunidades de hoy."
      >
        {["administrador", "ventas"].includes(perfil.rol) && (
          <Link className="boton" href="/facturacion/nueva">
            <Plus size={18} /> Crear factura
          </Link>
        )}
      </Cabecera>
      <section className="hero-negocio">
        <div>
          <span className="etiqueta">ALEXMAR · EN MOVIMIENTO</span>
          <h2>
            Más control.
            <br />
            <em>Mejores decisiones.</em>
          </h2>
          <p>
            La pieza correcta, el cliente indicado y tu negocio siempre a la
            vista.
          </p>
          <Link href="/inventario" className="boton">
            Explorar inventario <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="hero-sello" aria-hidden="true">
          <span>A</span>
          <small>REPUESTOS / ACCESORIOS / ROTULADOS</small>
        </div>
      </section>
      <section className="indicadores">
        <article>
          <small>PRODUCTOS VIGENTES</small>
          <strong>{cantidad(d.productos)}</strong>
          <Link href="/inventario">Consultar inventario →</Link>
        </article>
        <article>
          <small>PENDIENTES DE PRECIO</small>
          <strong>{cantidad(d.sin_precio)}</strong>
          <Link href="/inventario?precio=sin">Revisar productos →</Link>
        </article>
        {d.clientes !== undefined && (
          <article>
            <small>CLIENTES VIGENTES</small>
            <strong>{cantidad(d.clientes)}</strong>
            <Link href="/clientes">Ver clientes →</Link>
          </article>
        )}
        {d.deuda_usd !== undefined && (
          <article>
            <small>SALDO NETO DE CUENTAS · USD</small>
            <strong>{monto(d.deuda_usd)}</strong>
            <span className="muted">
              Cargos menos abonos de clientes vigentes
            </span>
          </article>
        )}
      </section>
      <Analitica parametros={p} />
      <div className="titulo-seccion">
        <div>
          <span className="etiqueta">TU DÍA A DÍA</span>
          <h2>Todo a un paso</h2>
        </div>
      </div>
      <div className="accesos-rapidos no-imprimir">
        {perfil.rol === "administrador" && (
          <Link href="/migracion">
            <strong>Importar archivos</strong>
            <span>Revisar y actualizar desde la aplicación anterior →</span>
          </Link>
        )}
        {["administrador", "ventas"].includes(perfil.rol) && (
          <Link href="/facturacion">
            <strong>Facturación</strong>
            <span>Crear factura o consultar ventas →</span>
          </Link>
        )}
        <Link href="/inventario">
          <strong>01 / Inventario</strong>
          <span>Productos, precios y disponibilidad →</span>
        </Link>
        {["administrador", "inventario"].includes(perfil.rol) && (
          <Link href="/proveedores">
            <strong>02 / Proveedores</strong>
            <span>Directorio y contactos comerciales →</span>
          </Link>
        )}
        <Link href="/reportes">
          <strong>03 / Reportes</strong>
          <span>Existencias y métricas del catálogo →</span>
        </Link>
      </div>
    </>
  );
}

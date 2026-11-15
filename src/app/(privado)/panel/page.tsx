import Link from "next/link";
import { consultar, sesion } from "@/lib/supabase";
import { Cabecera } from "@/components/comunes";
import { monto, cantidad } from "@/lib/formatos";
export default async function Panel() {
  const { perfil } = await sesion();
  const d = await consultar<Record<string, string>>("resumen");
  return (
    <>
      <Cabecera
        titulo="Tu negocio, de un vistazo"
        subtitulo="Inventario y cuentas actuales. Elige dónde quieres empezar."
      />
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
      <div className="accesos-rapidos no-imprimir">
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
      <section className="panel bienvenida">
        <span className="etiqueta">ENCUENTRA LA PIEZA CORRECTA</span>
        <h2>Busca por nombre, referencia o vehículo.</h2>
        <p>
          Consulta precio y disponibilidad sin abrir cada producto. Los datos
          incompletos permanecen visibles para revisarlos.
        </p>
        <Link className="boton" href="/inventario">
          Abrir inventario →
        </Link>
      </section>
    </>
  );
}

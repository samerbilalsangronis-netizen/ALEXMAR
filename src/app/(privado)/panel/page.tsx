import Link from "next/link";
import { consultar } from "@/lib/supabase";
import { Cabecera } from "@/components/comunes";
import { monto, cantidad } from "@/lib/formatos";
export default async function Panel() {
  const d = await consultar<Record<string, string>>("resumen");
  return (
    <>
      <Cabecera
        titulo="Todo empieza con información clara"
        subtitulo="Consulta el catálogo y las cuentas de tus clientes."
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

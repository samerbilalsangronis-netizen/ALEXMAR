import Link from "next/link";
export function ActivarFacturacion() {
  return (
    <section className="aviso">
      <h1>Actualiza la facturación</h1>
      <p>
        Aplica una vez el{" "}
        <a href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261122001100_facturacion_clientes.sql">
          SQL 011 completo
        </a>{" "}
        en el Supabase nuevo, después del SQL 006. No repitas la importación.
      </p>
      <Link className="boton secundario" href="/facturacion">
        Volver a facturación
      </Link>
    </section>
  );
}

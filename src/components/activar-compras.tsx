import Link from "next/link";
export function ActivarCompras({ administrador }: { administrador: boolean }) {
  return (
    <section className="panel activacion">
      <div>
        <h2>Activa compras y recepciones</h2>
        <p>
          El administrador debe aplicar una sola vez SQL 010 en el Supabase
          nuevo. No requiere reimportar productos.
        </p>
        {administrador && (
          <a
            className="boton"
            href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261117001000_compras_recepciones.sql"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir SQL 010
          </a>
        )}{" "}
        <Link className="boton secundario" href="/proveedores">
          Volver a proveedores
        </Link>
      </div>
    </section>
  );
}

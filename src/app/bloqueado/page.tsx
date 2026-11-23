import Link from "next/link";
import { Marca } from "@/components/marca";
import { salir } from "@/app/actions";
export default function Bloqueado() {
  return (
    <main className="acceso-bloqueado">
      <section className="panel">
        <Marca />
        <h1>Acceso general bloqueado</h1>
        <p>
          Administración ha pausado temporalmente el acceso de empleados.
          Solicita al administrador que lo habilite.
        </p>
        <div className="acciones">
          <Link className="boton secundario" href="/consulta">
            Comprobar acceso
          </Link>
          <form action={salir}>
            <button>Cambiar de cuenta</button>
          </form>
        </div>
        <Link href="/?acceso=administrativo">Ingreso administrativo →</Link>
      </section>
    </main>
  );
}

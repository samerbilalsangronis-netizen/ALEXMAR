import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { Cabecera, Avisos } from "@/components/comunes";
import { crearClienteCredito } from "@/app/clientes-actions";
export default async function NuevoClienteCredito({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { perfil } = await sesion();
  if (perfil.rol !== "administrador") notFound();
  const p = await searchParams;
  return (
    <>
      <Link href="/clientes">← Clientes y cuentas</Link>
      <Cabecera
        titulo="Agregar cliente a crédito"
        subtitulo="Crea su cuenta para cargar productos y registrar abonos."
      />
      <Avisos p={p} />
      <section className="panel">
        <form action={crearClienteCredito} className="formulario">
          <input type="hidden" name="id" value={randomUUID()} />
          <label>
            Nombre del cliente
            <input name="nombre" required minLength={2} maxLength={200} />
          </label>
          <label>
            Cédula / RIF
            <input name="documento" maxLength={80} />
          </label>
          <label>
            Teléfono
            <input name="telefono" maxLength={80} />
          </label>
          <label>
            Dirección
            <input name="direccion" maxLength={500} />
          </label>
          <button>Crear cuenta y cargar productos</button>
        </form>
      </section>
    </>
  );
}

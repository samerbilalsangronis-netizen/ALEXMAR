import { sesion } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/comunes";
import { Importador } from "@/components/importador";
export default async function Migracion() {
  const { perfil } = await sesion();
  if (perfil.rol !== "administrador") notFound();
  return (
    <>
      <Cabecera
        titulo="Importación inicial"
        subtitulo="Primero verifica. Después confirma."
      />
      <section className="panel">
        <p>
          Adjunta las cuatro exportaciones del Supabase anterior. Se conservan
          los identificadores, el estado eliminado y los datos originales.
          Moneda histórica confirmada: USD.
        </p>
        <p>
          La simulación no escribe en la base. La confirmación solo admite un
          destino vacío y bloquea diferencias sin resolver. Las existencias se
          registran una sola vez como saldo inicial.
        </p>
        <Importador />
      </section>
    </>
  );
}

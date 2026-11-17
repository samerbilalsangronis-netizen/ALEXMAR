import { sesion } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/comunes";
import { Importador } from "@/components/importador";
export default async function Migracion() {
  const { perfil, db } = await sesion();
  if (perfil.rol !== "administrador") notFound();
  const { data, error } = await db.rpc("estado_importacion");
  if (error && !["PGRST202", "42883"].includes(error.code))
    throw new Error(error.message);
  const actualizar = error || Boolean(data?.carga_previa);
  return (
    <>
      <Cabecera
        titulo="Importar archivos"
        subtitulo={
          actualizar
            ? "Actualizar los registros de la aplicación anterior, sin repetir la carga inicial."
            : "Primera carga del historial."
        }
      />
      {error && (
        <section className="aviso">
          <h2>Activa la actualización desde archivos</h2>
          <p>
            Aplica una sola vez el{" "}
            <a
              href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261116000700_actualizacion_origen.sql"
              target="_blank"
              rel="noopener noreferrer"
            >
              SQL 007
            </a>{" "}
            en el Supabase nuevo. Después recarga esta página. No elimines datos
            ni repitas los SQL anteriores.
          </p>
        </section>
      )}
      <section className="panel">
        <h2>
          {actualizar
            ? "Incorporar lo registrado después de la última importación"
            : "Cargar los datos por primera vez"}
        </h2>
        <ol>
          <li>
            Exporta otra vez las cuatro tablas completas del sistema anterior:
            inventario, clientes, detalle_cuentas y notas. Incluye los registros
            eliminados.
          </li>
          <li>
            Selecciona los archivos nuevos y pulsa Analizar y conciliar. Este
            paso no guarda cambios.
          </li>
          <li>
            Revisa los registros nuevos y actualizados. Si hay cambios locales
            incompatibles o archivos incompletos, la carga se bloquea.
          </li>
          <li>
            Confirma solo después de revisar. Repetir un mismo lote no duplica
            movimientos ni existencias.
          </li>
        </ol>
        <p>
          Se conserva la precisión decimal y el saldo según cargos menos abonos
          no eliminados. Las correcciones de movimientos anteriores se registran
          mediante reversiones, sin borrar los originales.
        </p>
        <Importador
          modo={actualizar ? "actualizacion" : "inicial"}
          habilitado={!error}
        />
      </section>
    </>
  );
}

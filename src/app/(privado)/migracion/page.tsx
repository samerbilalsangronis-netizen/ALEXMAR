import { sesion, consultar } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/comunes";
import { Importador } from "@/components/importador";
export default async function Migracion() {
  const { perfil } = await sesion();
  if (perfil.rol !== "administrador") notFound();
  const resumen = await consultar<{ productos: number; clientes: number }>(
    "resumen",
  );
  return (
    <>
      <Cabecera
        titulo="Importación inicial"
        subtitulo="Primero verifica. Después confirma."
      />
      <section className="panel estado-migracion">
        <span className="etiqueta">DATOS EN ESTE PROYECTO</span>
        <h2>
          Productos activos: {resumen.productos} · Clientes activos:{" "}
          {resumen.clientes}
        </h2>
        <p>
          Crear las tablas no importa el historial. Para ver tus datos
          anteriores hay que revisar las exportaciones, conciliar las
          diferencias y confirmar la carga.
        </p>
        <ol>
          <li>
            Exporta inventario, clientes, detalle_cuentas y notas del origen.
          </li>
          <li>
            Adjunta los cuatro CSV abajo y pulsa Analizar y conciliar. Este paso
            no guarda datos.
          </li>
          <li>
            Revisa el saldo calculado con la regla aprobada de la vista: cargos
            menos abonos vigentes. Los campos guardados se preservan y no se
            redondea ningún importe.
          </li>
        </ol>
      </section>
      <section className="panel">
        <p>
          Adjunta las cuatro exportaciones del Supabase anterior. Se conservan
          los identificadores, el estado eliminado y los datos originales.
          Moneda histórica confirmada: USD.
        </p>
        <p>
          La simulación no escribe en la base. La confirmación solo admite un
          destino vacío y verifica los saldos contra el cálculo exacto de la
          simulación. Las existencias se registran una sola vez como saldo
          inicial.
        </p>
        <Importador />
      </section>
    </>
  );
}

import Link from "next/link";
import { sesion } from "@/lib/supabase";
import { monto, type Pagina } from "@/lib/formatos";
import { Paginacion } from "./comunes";
import { CorregirAbonoCliente } from "./corregir-abono-cliente";
import type { AbonoEditable } from "@/lib/abonos";
export async function PanelAbonosCliente({
  id,
  paginaActual,
}: {
  id: string;
  paginaActual: number;
}) {
  const { db } = await sesion();
  const { data, error } = await db.rpc("listar_abonos_cliente", {
    p_id: id,
    p_pagina: paginaActual,
  });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code))
      return (
        <section className="aviso" id="abonos-del-cliente">
          Para editar abonos, aplica una vez el{" "}
          <a href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261126002100_correccion_abonos_clientes.sql">
            SQL 021
          </a>{" "}
          en Supabase después de 020.
        </section>
      );
    throw new Error(error.message);
  }
  const d = data as Pagina<AbonoEditable>;
  return (
    <section className="panel" id="abonos-del-cliente">
      <div className="acciones">
        <h2>Abonos recibidos</h2>
        <Link href={"/clientes/" + id}>Cerrar y ver cuenta</Link>
      </div>
      <p>
        Corrige importe, método o referencia con un motivo. Conservamos el
        registro original y todas sus correcciones. Un abono repartido aparece
        una sola vez.
      </p>
      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Fecha original</th>
              <th>Registro</th>
              <th>Monto original</th>
              <th>Importe vigente</th>
              <th>Método vigente</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {d.filas.map((a) => (
              <tr key={a.tipo + a.id}>
                <td>
                  {new Intl.DateTimeFormat("es-VE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Caracas",
                  }).format(new Date(a.creado))}
                </td>
                <td>
                  {a.tipo === "cuenta"
                    ? "Abono a la cuenta"
                    : a.tipo === "factura"
                      ? "Cobro de factura"
                      : "Abono registrado"}
                  {a.correcciones > 0 && (
                    <small> · {a.correcciones} correcciones</small>
                  )}
                </td>
                <td>{monto(a.original, a.moneda)}</td>
                <td>{monto(a.actual, a.moneda)}</td>
                <td>{a.metodo}</td>
                <td>
                  <CorregirAbonoCliente abono={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!d.total && <p>No hay abonos registrados para este cliente.</p>}
      <Paginacion
        {...d}
        ruta={"/clientes/" + id}
        parametros={{ vista: "abonos" }}
        parametroPagina="abonos_pagina"
      />
    </section>
  );
}

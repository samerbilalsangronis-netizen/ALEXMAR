import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { monto, fecha, type Pagina } from "@/lib/formatos";
import { numeroVenta } from "@/lib/ventas";
export type FilaFactura = {
  id: string;
  numero: number | null;
  tipo: string;
  estado: string;
  cliente: string;
  cliente_id: string;
  fecha: string;
  total: string;
  pagado: string;
  saldo: string;
  condicion: string;
};
export type ListaFacturas = Pagina<FilaFactura> & {
  resumen: {
    facturado: string;
    cobrado: string;
    pendiente: string;
    emitidas: number;
  };
};
export function TablaFacturas({
  d,
  puedeAnular = false,
}: {
  d: ListaFacturas;
  puedeAnular?: boolean;
}) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla-facturacion">
        <thead>
          <tr>
            <th>Factura</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Condición</th>
            <th>Total USD</th>
            <th>Saldo USD</th>
            <th>Estado</th>
            {puedeAnular && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {d.filas.map((v) => (
            <tr key={v.id}>
              <td>
                <Link className="factura-link" href={"/facturacion/" + v.id}>
                  {numeroVenta(v)} →
                </Link>
              </td>
              <td>{fecha(v.fecha)}</td>
              <td>
                <Link href={"/clientes/" + v.cliente_id}>{v.cliente}</Link>
              </td>
              <td>{v.condicion === "contado" ? "Contado" : "Crédito"}</td>
              <td>{monto(v.total)}</td>
              <td>
                <strong>
                  {v.estado === "confirmada" ? monto(v.saldo) : "—"}
                </strong>
              </td>
              <td>
                <span
                  className={
                    "factura-estado " +
                    (v.estado === "confirmada"
                      ? v.saldo && Number(v.saldo) > 0
                        ? "pendiente"
                        : "pagada"
                      : v.estado)
                  }
                >
                  {v.estado === "confirmada"
                    ? Number(v.saldo) > 0
                      ? "Por cobrar"
                      : "Pagada"
                    : v.estado === "borrador"
                      ? "Borrador"
                      : "Anulada"}
                </span>
              </td>
              {puedeAnular && (
                <td>
                  {v.estado !== "anulada" && (
                    <Link
                      className="factura-anular-link"
                      href={"/facturacion/" + v.id + "?anular=1"}
                    >
                      Anular
                    </Link>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!d.total && (
        <div className="vacio">
          <ReceiptText size={32} />
          <h3>No hay facturas para esta consulta</h3>
          <p>Prueba otra búsqueda o crea una nueva factura.</p>
        </div>
      )}
    </div>
  );
}

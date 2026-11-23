export type LineaVenta = {
  id?: string;
  variante_id: string | null;
  descripcion: string;
  cantidad: string;
  precio: string;
  precio_personalizado?: boolean;
  clase_linea?: "producto" | "servicio" | "producto_pendiente";
  importe?: string;
};
export type Venta = {
  id: string;
  numero: number | null;
  cliente_id: string | null;
  tipo: "factura" | "presupuesto";
  estado: "borrador" | "confirmada" | "anulada";
  moneda: "USD";
  subtotal: string;
  descuento: string;
  total: string;
  abono: string;
  pagado: string;
  saldo: string;
  condicion: "contado" | "credito";
  metodo_pago: string | null;
  vence: string | null;
  observaciones: string;
  permite_gratis: boolean;
  descontar_stock?: boolean;
  version: number;
  creado: string;
  emitido: string | null;
  motivo_anulacion: string | null;
  cliente: {
    nombre: string;
    documento: string | null;
    telefono: string | null;
    direccion: string | null;
  };
  lineas: LineaVenta[];
  pagos: { tipo: string; monto: string; metodo: string; creado: string }[];
};
export function numeroVenta(v: { numero: number | null; tipo?: string }) {
  return v.numero === null
    ? v.tipo === "presupuesto"
      ? "Presupuesto"
      : "Borrador"
    : "V-" + String(v.numero).padStart(6, "0");
}

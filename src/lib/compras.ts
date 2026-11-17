import type { Pagina } from "./formatos";
export type LineaRecepcion = {
  variante_id: string | null;
  nombre: string;
  cantidad: string;
  costo_unitario: string;
  nuevo?: { id: string; nombre: string; categoria: string };
};
export type Compra = {
  id: string;
  numero: number;
  proveedor_id: string;
  proveedor_snapshot: { nombre: string; documento: string };
  referencia: string;
  total: string;
  pagado: string;
  saldo: string;
  moneda: string;
  estado: string;
  creado: string;
  observaciones: string;
  motivo_anulacion?: string;
  lineas: {
    id: string;
    orden: number;
    producto_id: string;
    descripcion: string;
    cantidad: string;
    costo_unitario: string;
    importe: string;
    precio_venta: string | null;
  }[];
  pagos: Pagina<{
    id: string;
    monto: string;
    metodo: string;
    referencia: string;
    creado: string;
  }>;
};
export type ProveedorCompras = {
  proveedor: {
    id: string;
    nombre: string;
    documento: string;
    activo: boolean;
    telefono: string;
    monedas: string[];
  };
  resumen: { comprado: string; pagado: string; saldo: string };
  compras: Pagina<{
    id: string;
    numero: number;
    creado: string;
    referencia: string;
    estado: string;
    total: string;
    pagado: string;
    saldo: string;
  }>;
  productos: Pagina<{
    id: string;
    producto_id: string;
    nombre: string;
    cantidad_recibida: string;
    ultimo_costo: string;
    precio_venta: string | null;
    ultima_recepcion: string;
  }>;
};
export function numeroCompra(numero: number) {
  return "C-" + String(numero).padStart(6, "0");
}

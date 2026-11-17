export type CategoriaMargen = {
  nombre: string;
  productos: number;
  costo: string;
  venta: string;
  margen: string;
  porcentaje: string | null;
};
export type AnaliticaDatos = {
  desde: string;
  hasta: string;
  historial_clientes?: {
    id: string;
    nombre: string;
    cargos: string;
    abonos: string;
  }[];
  inventario?: {
    costo: string;
    venta: string;
    margen: string;
    porcentaje: string | null;
    completos: number;
    total: number;
    sin_costo: number;
    sin_precio: number;
    costo_cero: number;
    stock_negativo: number;
    categorias: CategoriaMargen[];
  };
  ventas?: {
    total: string;
    facturas: number;
    ticket: string | null;
    serie: { mes: string; total: string; facturas: number }[];
    clientes: { id: string; nombre: string; total: string; facturas: number }[];
  };
};
export function periodoActual() {
  const hasta = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const inicio = new Date(hasta + "T12:00:00Z");
  inicio.setUTCDate(1);
  inicio.setUTCMonth(inicio.getUTCMonth() - 5);
  return { desde: inicio.toISOString().slice(0, 10), hasta };
}

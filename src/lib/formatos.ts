import Decimal from "decimal.js";
export function monto(v: unknown, moneda = "USD") {
  if (v === null || v === undefined || v === "") return "Pendiente de precio";
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: moneda,
  }).format(Number(v));
}
export function cantidad(v: unknown) {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 4 }).format(
    Number(v ?? 0),
  );
}
export function fecha(v: string) {
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    dateStyle: "medium",
  }).format(new Date(v));
}
export function decimal(v: FormDataEntryValue | null, obligatorio = false) {
  const s = String(v ?? "")
    .trim()
    .replace(",", ".");
  if (!s && !obligatorio) return null;
  if (!/^\d+(\.\d{1,4})?$/.test(s))
    throw new Error(
      "Escribe un número positivo, con máximo cuatro decimales y sin separadores de miles.",
    );
  return new Decimal(s).toFixed();
}
export type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  categoria_origen?: string;
  vehiculos?: string[];
  clasificacion_manual?: boolean;
  compatibilidad: string;
  marca: string;
  referencia: string;
  alias: string;
  precio: string | null;
  fisico: string;
  reservado: string;
  disponible: string;
  minimo: string;
  ubicacion: string;
  activo: boolean;
  costo?: string | null;
};
export type Pagina<T> = {
  filas: T[];
  total: number;
  pagina: number;
  paginas: number;
};
export function pagina(v: unknown) {
  return Math.max(1, Math.min(100000, Math.trunc(Number(v) || 1)));
}

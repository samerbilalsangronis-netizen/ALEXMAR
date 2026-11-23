import DecimalBase from "decimal.js";
import type { LineaVenta } from "./ventas";
const Decimal = DecimalBase.clone({ precision: 128 });
export type FilaRapida = {
  clave: string;
  cantidad: string;
  descripcion: string;
  precio: string;
  variante_id: string | null;
  tipo: "producto" | "servicio";
};
export const normalDecimal = (s: string) => s.trim().replace(",", ".");
export function lineasRapidas(filas: FilaRapida[]): LineaVenta[] {
  const activas = filas
    .map((f, i) => ({ f, i }))
    .filter(
      ({ f }) =>
        f.descripcion.trim() ||
        f.precio.trim() ||
        (f.cantidad.trim() && f.cantidad !== "1"),
    );
  if (activas.length < 1 || activas.length > 200)
    throw new Error("Completa al menos una fila y hasta 200.");
  return activas.map(({ f, i }) => {
    const cantidad = normalDecimal(f.cantidad),
      precio = normalDecimal(f.precio);
    if (!f.descripcion.trim())
      throw new Error(
        `Fila ${i + 1}: falta el nombre del producto o servicio.`,
      );
    if (
      !/^[0-9]{1,8}(\.[0-9]{1,4})?$/.test(cantidad) ||
      !new Decimal(cantidad).gt(0) ||
      new Decimal(cantidad).gte(100000000)
    )
      throw new Error(
        `Fila ${i + 1}: indica una cantidad positiva, con hasta cuatro decimales.`,
      );
    if (
      !/^[0-9]{1,16}(\.[0-9]{1,80})?$/.test(precio) ||
      !new Decimal(precio).gt(0) ||
      new Decimal(precio).gte("10000000000000000")
    )
      throw new Error(`Fila ${i + 1}: indica un precio positivo válido.`);
    return {
      variante_id: f.variante_id,
      descripcion: f.descripcion.trim(),
      cantidad,
      precio,
      precio_personalizado: Boolean(f.variante_id),
      clase_linea: f.variante_id
        ? "producto"
        : f.tipo === "servicio"
          ? "servicio"
          : "producto_pendiente",
    };
  });
}
export function totalRapido(lineas: LineaVenta[]) {
  return lineas
    .reduce(
      (s, l) => s.plus(new Decimal(l.cantidad).times(l.precio)),
      new Decimal(0),
    )
    .toFixed();
}

export function importeVisible(f: FilaRapida): string | null {
  const q = normalDecimal(f.cantidad),
    p = normalDecimal(f.precio);
  if (
    !/^[0-9]{1,8}(\.[0-9]{1,4})?$/.test(q) ||
    !/^[0-9]{1,16}(\.[0-9]{1,80})?$/.test(p)
  )
    return null;
  return new Decimal(q).times(p).toFixed();
}

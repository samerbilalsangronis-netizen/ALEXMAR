import Papa from "papaparse";
import DecimalBase from "decimal.js";
// 16 dígitos enteros + 80 decimales + margen para sumar todo el lote.
const Decimal = DecimalBase.clone({ precision: 128 });
export const tablas = [
  "inventario",
  "clientes",
  "detalle_cuentas",
  "notas",
] as const;
export type Tabla = (typeof tablas)[number];
export type Fila = Record<string, string>;
export type Datos = Record<Tabla, Fila[]>;
const columnas: Record<Tabla, string[]> = {
  inventario: [
    "id",
    "nombre_producto",
    "costo",
    "pvp",
    "stock_actual",
    "stock_minimo",
    "eliminado",
  ],
  clientes: ["id", "nombre_cliente", "total_adeudado", "eliminado"],
  detalle_cuentas: [
    "id",
    "id_cliente",
    "tipo_linea",
    "total_linea",
    "fecha",
    "eliminado",
  ],
  notas: ["id", "titulo", "contenido", "eliminado"],
};
export function leerCSV(texto: string, tabla: Tabla): Fila[] {
  const p = Papa.parse<Fila>(texto, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });
  if (p.errors.length)
    throw new Error(`${tabla}: CSV inválido (${p.errors[0].message}).`);
  for (const c of columnas[tabla])
    if (!p.meta.fields?.includes(c))
      throw new Error(`${tabla}: falta la columna ${c}.`);
  return p.data;
}
export function vacio(v: unknown) {
  return v === null || v === undefined || v === "" || v === "null";
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function numero(v: string, obligatorio = true) {
  if (vacio(v)) {
    if (obligatorio) throw new Error("Falta un importe o cantidad.");
    return null;
  }
  if (!/^[-+]?\d+(\.\d{1,80})?$/.test(v))
    throw new Error("Formato numérico no válido.");
  const n = new Decimal(v);
  if (!n.isFinite() || n.abs().gte("10000000000000000"))
    throw new Error("Importe fuera de rango.");
  return n;
}
export function analizar(datos: Datos) {
  const errores: string[] = [];
  const advertencias: string[] = [];
  const diferencias: {
    id: string;
    nombre: string;
    declarado: string;
    calculado: string;
    diferencia: string;
  }[] = [];
  let precisiones = 0;
  for (const tabla of tablas) {
    const ids = new Set<string>();
    for (const [i, r] of datos[tabla].entries()) {
      if (!uuid.test(r.id))
        errores.push(`${tabla}, fila ${i + 2}: ID inválido.`);
      if (ids.has(r.id))
        errores.push(`${tabla}: identificador repetido ${r.id}.`);
      ids.add(r.id);
      if (!["true", "false"].includes(r.eliminado))
        errores.push(`${tabla}, fila ${i + 2}: estado inválido.`);
    }
  }
  const clientes = new Set(datos.clientes.map((r) => r.id));
  const productos = new Set(datos.inventario.map((r) => r.id));
  const saldos = new Map<string, InstanceType<typeof Decimal>>();
  for (const r of datos.inventario) {
    try {
      if (!r.nombre_producto.trim()) throw new Error("Nombre vacío.");
      for (const c of ["costo", "pvp", "stock_actual", "stock_minimo"]) {
        const n = numero(r[c], c.startsWith("stock"));
        if (n?.lt(0)) throw new Error("Cantidad o precio negativo.");
        if (n && !n.eq(n.toDecimalPlaces(4))) precisiones++;
      }
    } catch (e) {
      errores.push(`Producto ${r.id}: ${(e as Error).message}`);
    }
  }
  for (const r of datos.detalle_cuentas) {
    if (!clientes.has(r.id_cliente))
      errores.push(`Movimiento ${r.id}: cliente inexistente.`);
    if (!vacio(r.id_producto) && !productos.has(r.id_producto))
      errores.push(`Movimiento ${r.id}: producto inexistente.`);
    if (!["CARGO", "ABONO", "TITULO"].includes(r.tipo_linea))
      errores.push(`Movimiento ${r.id}: tipo desconocido.`);
    if (!r.fecha || !Number.isFinite(Date.parse(r.fecha)))
      errores.push(`Movimiento ${r.id}: fecha inválida.`);
    try {
      const n = numero(r.total_linea)!;
      if (n.lt(0)) throw new Error("Importe negativo sin regla definida.");
      if (!n.eq(n.toDecimalPlaces(4))) precisiones++;
      if (r.eliminado === "false")
        saldos.set(
          r.id_cliente,
          (saldos.get(r.id_cliente) || new Decimal(0)).plus(
            n.times(
              r.tipo_linea === "CARGO" ? 1 : r.tipo_linea === "ABONO" ? -1 : 0,
            ),
          ),
        );
    } catch (e) {
      errores.push(`Movimiento ${r.id}: ${(e as Error).message}`);
    }
  }
  for (const r of datos.clientes) {
    try {
      if (!r.nombre_cliente.trim()) throw new Error("Nombre vacío.");
      const declarado = numero(r.total_adeudado)!;
      const calculado = saldos.get(r.id) || new Decimal(0);
      if (r.eliminado === "false" && !declarado.eq(calculado))
        diferencias.push({
          id: r.id,
          nombre: r.nombre_cliente,
          declarado: declarado.toFixed(),
          calculado: calculado.toFixed(),
          diferencia: declarado.minus(calculado).toFixed(),
        });
    } catch (e) {
      errores.push(`Cliente ${r.id}: ${(e as Error).message}`);
    }
  }
  if (precisiones)
    advertencias.push(
      `${precisiones} valores tienen más de cuatro decimales: se conservarán completos, sin redondear, según la regla aprobada.`,
    );
  const resumen = Object.fromEntries(
    tablas.map((t) => [
      t,
      {
        total: datos[t].length,
        vigentes: datos[t].filter((r) => r.eliminado === "false").length,
        eliminados: datos[t].filter((r) => r.eliminado === "true").length,
      },
    ]),
  );
  if (diferencias.length)
    advertencias.push(
      `${diferencias.length} campos de saldo guardado difieren de la vista: se conservan como procedencia. El saldo operativo se calcula con cargos menos abonos no eliminados.`,
    );
  const conciliacion = datos.clientes.map((c) => ({
    id: c.id,
    saldo: (saldos.get(c.id) || new Decimal(0)).toFixed(),
  }));
  return {
    regla: "vista_saldos_clientes_sin_redondeo_v1" as const,
    conciliacion,
    resumen,
    errores,
    advertencias,
    diferencias,
    puedeImportar: errores.length === 0,
  };
}

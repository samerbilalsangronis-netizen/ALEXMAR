import { test } from "node:test";
import assert from "node:assert/strict";
import { analizar, leerCSV, type Datos } from "../src/lib/migracion";
const id = "11111111-1111-4111-8111-111111111111";
function datos(): Datos {
  return {
    inventario: [
      {
        id,
        nombre_producto: "Antena",
        costo: "10",
        pvp: "20",
        stock_actual: "3",
        stock_minimo: "1",
        eliminado: "false",
      },
    ],
    clientes: [
      {
        id,
        nombre_cliente: "Cliente",
        total_adeudado: "7",
        eliminado: "false",
      },
    ],
    detalle_cuentas: [
      {
        id,
        id_cliente: id,
        tipo_linea: "CARGO",
        total_linea: "10",
        fecha: "2026-10-01T12:00:00Z",
        eliminado: "false",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        id_cliente: id,
        tipo_linea: "ABONO",
        total_linea: "3",
        fecha: "2026-10-02T12:00:00Z",
        eliminado: "false",
      },
    ],
    notas: [],
  };
}
test("conciliación exacta con decimales, pagos y eliminados", () => {
  const d = datos();
  assert.equal(analizar(d).puedeImportar, true);
  d.detalle_cuentas[1].eliminado = "true";
  assert.equal(analizar(d).diferencias.length, 1);
  assert.equal(analizar(d).puedeImportar, true);
});
test("bloquea referencias rotas, duplicados y cantidades negativas; informa precisión conservada", () => {
  const d = datos();
  d.inventario[0].stock_actual = "-1";
  d.detalle_cuentas[0].id_cliente = "33333333-3333-4333-8333-333333333333";
  d.detalle_cuentas.push({ ...d.detalle_cuentas[1] });
  d.inventario[0].pvp = "20.00000001";
  const r = analizar(d);
  assert.equal(r.puedeImportar, false);
  assert.ok(r.errores.length >= 3);
  assert.ok(r.advertencias.length);
});
test("CSV valida encabezados y respeta texto entre comillas", () => {
  assert.throws(
    () => leerCSV("id,nombre\n1,x", "inventario"),
    /falta la columna/,
  );
  const r = leerCSV(
    `id,titulo,contenido,eliminado\n${id},Nota,"Texto, con coma",false`,
    "notas",
  );
  assert.equal(r[0].contenido, "Texto, con coma");
});

test("regla aprobada conserva precisión y campo original sin usarlo como saldo", () => {
  const d = datos();
  d.clientes[0].total_adeudado = "0";
  d.detalle_cuentas[0].total_linea = "10.123456789012345678901234567890";
  const r = analizar(d);
  assert.equal(r.puedeImportar, true);
  assert.equal(r.conciliacion[0].saldo, "7.12345678901234567890123456789");
  assert.equal(r.diferencias[0].declarado, "0");
  assert.equal(d.clientes[0].total_adeudado, "0");
  d.detalle_cuentas[1].total_linea = "11";
  assert.equal(
    analizar(d).conciliacion[0].saldo,
    "-0.87654321098765432109876543211",
  );
  d.detalle_cuentas[0].total_linea = "1." + "1".repeat(81);
  assert.equal(analizar(d).puedeImportar, false);
});

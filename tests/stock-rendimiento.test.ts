import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
const admin = "11111111-1111-4111-8111-111111111111",
  cliente = "55555555-5555-4555-8555-555555555555";
test("stock opcional: venta sin existencia, activación, reservas, anulación e historia previa", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter(
        (f) =>
          f.endsWith(".sql") && f < "20261123001300" && !f.includes("001200"),
      )
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','prueba@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true);insert into alexmar.clientes(id,nombre)values('${cliente}','Cliente sintético');set app.usuario='${admin}';set role authenticated;`,
    );
    const rpc = async (n: string, p: unknown) =>
      (
        await db.query<{ r: any }>("select public." + n + "($1) r", [
          JSON.stringify(p),
        ])
      ).rows[0].r;
    const ficha = async (id: string) =>
      (await db.query<{ r: any }>("select public.ficha_venta($1) r", [id]))
        .rows[0].r;
    const producto = await rpc("guardar_producto", {
      nombre: "Filtro de prueba",
      precio: "10",
      costo: "5",
      minimo: "0",
    });
    const variante = (await rpc("buscar_productos", {})).filas[0].variante_id;
    const stock = async () =>
      Number(
        (
          await db.query<{ r: any }>("select public.ficha_producto($1) r", [
            producto,
          ])
        ).rows[0].r.fisico,
      );
    const venta = (n = "1") => ({
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      condicion: "credito",
      abono: "0",
      lineas: [{ variante_id: variante, cantidad: n, precio: "10" }],
    });
    await db.query(
      "select public.ajustar_stock($1,10,'Apertura prueba','prueba-inicial')",
      [producto],
    );
    const antigua = venta("2");
    await rpc("emitir_factura", antigua);
    assert.equal(await stock(), 8);
    await db.exec("reset role");
    await db.exec(
      await readFile(
        "supabase/migrations/20261122001200_control_stock_rendimiento.sql",
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    assert.equal((await ficha(antigua.id)).descontar_stock, true);
    assert.equal(
      (
        await db.query<{ r: any }>(
          "select public.configuracion_facturacion() r",
        )
      ).rows[0].r.descontar_stock,
      false,
    );
    const sinStock = venta("40");
    await rpc("emitir_factura", { ...sinStock, descontar_stock: true });
    await rpc("emitir_factura", { ...sinStock, descontar_stock: true });
    assert.equal(await stock(), 8);
    assert.equal((await ficha(sinStock.id)).descontar_stock, false);
    await db.query("select public.configurar_descuento_stock(true,1)");
    await db.query(
      "select public.anular_venta($1,'Anulación sin stock',false)",
      [sinStock.id],
    );
    assert.equal(
      await stock(),
      8,
      "Anular venta sin descuento no crea existencias",
    );
    await assert.rejects(rpc("emitir_factura", venta("9")), /insuficiente/);
    await db.exec("reset role");
    await db.query(
      "insert into alexmar.reservas(variante_id,cantidad,estado,referencia)values($1,7,'activa','Prueba')",
      [variante],
    );
    await db.exec("set role authenticated");
    await assert.rejects(rpc("emitir_factura", venta("2")), /insuficiente/);
    const controlada = venta();
    await rpc("emitir_factura", controlada);
    assert.equal(await stock(), 7);
    await db.query("select public.configurar_descuento_stock(false,2)");
    await db.query(
      "select public.anular_venta($1,'Anulación con descuento',false)",
      [controlada.id],
    );
    assert.equal(await stock(), 8);
    await db.query(
      "select public.anular_venta($1,'Repetición de anulación',false)",
      [controlada.id],
    );
    assert.equal(await stock(), 8);
    await db.query(
      "select public.anular_venta($1,'Anulación factura antigua',false)",
      [antigua.id],
    );
    assert.equal(
      await stock(),
      10,
      "Factura anterior a 012 devuelve solo lo descontado",
    );
    await assert.rejects(
      db.query("select public.configurar_descuento_stock(true,1)"),
      /cambió/,
    );
    // Con el control apagado también se vende con cero físico y reservas activas.
    await db.query(
      "select public.ajustar_stock($1,0,'Prueba de cero','prueba-cero')",
      [producto],
    );
    const cero = venta("5");
    await rpc("emitir_factura", cero);
    assert.equal(await stock(), 0);
    await db.exec(
      `reset role;update alexmar.perfiles set rol='ventas' where id='${admin}';set role authenticated;`,
    );
    await assert.rejects(
      db.query("select public.configurar_descuento_stock(true,3)"),
      /permiso/,
    );
    await assert.rejects(
      db.query("select public.anular_venta($1,'No autorizado',false)", [
        cero.id,
      ]),
      /permiso/,
    );
    await assert.rejects(
      db.query("select * from alexmar.configuracion_comercial"),
      /permission denied/,
    );
    for (const rol of ["inventario", "lectura"]) {
      await db.exec(
        `reset role;update alexmar.perfiles set rol='${rol}' where id='${admin}';set role authenticated;`,
      );
      await assert.rejects(
        db.query("select public.rendimiento_ventas()"),
        /permiso/,
      );
    }
  } finally {
    await db.close();
  }
});
test("rendimiento: días Caracas, comparación al mismo instante, ceros, precisión y exclusiones", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql") && f < "20261123001300")
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','prueba@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true);insert into alexmar.clientes(id,nombre)values('${cliente}','Cliente sintético');set app.usuario='${admin}';`,
    );
    for (const [total, fecha, estado, tipo] of [
      ["20", "2026-11-16T04:00:00Z", "confirmada", "factura"], // lunes a medianoche Caracas
      [
        "30.1234567890123456789",
        "2026-11-18T17:00:00Z",
        "confirmada",
        "factura",
      ],
      ["10", "2026-11-09T04:00:00Z", "confirmada", "factura"],
      ["15", "2026-11-11T17:00:00Z", "confirmada", "factura"],
      ["900", "2026-11-11T20:00:00Z", "confirmada", "factura"], // después de la hora comparable
      ["500", "2026-11-18T19:00:00Z", "confirmada", "factura"], // después del corte
      ["700", "2026-11-18T10:00:00Z", "anulada", "factura"],
      ["800", "2026-11-18T11:00:00Z", "borrador", "factura"],
      ["900", "2026-11-18T12:00:00Z", "confirmada", "presupuesto"],
      ["5", "2026-11-16T03:59:59Z", "confirmada", "factura"], // domingo anterior
    ])
      await db.query(
        `insert into alexmar.ventas(id,cliente_id,subtotal,total,usuario_id,firma,emitido,estado,tipo)values($1,$2,$3,$3,$4,'sintética',$5,$6,$7)`,
        [randomUUID(), cliente, total, admin, fecha, estado, tipo],
      );
    await db.query(
      `insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto,origen)values($1,'CARGO','2026-11-18T12:00:00Z','Histórico',999999,'supabase_anterior')`,
      [cliente],
    );
    await db.exec("set role authenticated");
    const d = (
      await db.query<{ r: any }>(
        "select public.rendimiento_ventas('2026-11-18T18:00:00Z') r",
      )
    ).rows[0].r;
    assert.equal(d.semana_actual, "50.1234567890123456789");
    assert.equal(d.semana_anterior_comparable, "25");
    assert.equal(d.ventas_hoy, "30.1234567890123456789");
    assert.equal(d.facturas_semana, 2);
    assert.equal(d.dias.length, 14);
    assert.equal(d.semanas.length, 8);
    assert.equal(d.dias.find((x: any) => x.fecha === "2026-11-15").total, "5");
    assert.equal(d.dias.find((x: any) => x.fecha === "2026-11-17").total, "0");
    assert.equal(d.semanas.at(-1).total, d.semana_actual);
    assert.ok(Number(d.variacion_pct) > 100);
    const vacio = (
      await db.query<{ r: any }>(
        "select public.rendimiento_ventas('2025-01-01T18:00:00Z') r",
      )
    ).rows[0].r;
    assert.equal(vacio.variacion_pct, null);
    assert.equal(vacio.semana_actual, "0");
    assert.equal(vacio.dias.length, 14);
    await db.exec(
      `reset role;update alexmar.ventas set estado='anulada' where emitido>='2026-11-16T04:00:00Z';set role authenticated;`,
    );
    const sin = (
      await db.query<{ r: any }>(
        "select public.rendimiento_ventas('2026-11-18T18:00:00Z') r",
      )
    ).rows[0].r;
    assert.equal(sin.semana_actual, "0");
    assert.equal(Number(sin.variacion_pct), -100);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select public.rendimiento_ventas()"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

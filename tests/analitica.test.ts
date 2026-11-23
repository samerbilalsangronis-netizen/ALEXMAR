import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import type { AnaliticaDatos } from "../src/lib/analitica";
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];
test("analítica: márgenes completos sin falsear faltantes, ventas por fecha Caracas, ranking y permisos", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql") && f < "20261123001300")
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    for (const [n, rol] of [
      "administrador",
      "ventas",
      "inventario",
      "lectura",
    ].entries())
      await db.query(`insert into auth.users values($1,$2);`, [
        ids[n],
        rol + "@example.com",
      ]);
    for (const [n, rol] of [
      "administrador",
      "ventas",
      "inventario",
      "lectura",
    ].entries())
      await db.query(`insert into alexmar.perfiles values($1,$2,$2,true)`, [
        ids[n],
        rol,
      ]);
    await db.exec(`set app.usuario='${ids[0]}';`);
    for (const [nombre, costo, precio, stock] of [
      ["Faro Fiesta", 8, 20, 3],
      ["Espejo Hilux", 15, 10, 2],
      ["Producto sin costo", null, 50, 8],
      ["Servicio universal", 0, 0, 1],
      ["Faro NPR", 4, null, 2],
      ["Faro extraño", 2, 4, -2],
    ] as const) {
      const a = (
        await db.query<{ id: string }>(
          "select public.guardar_producto($1) id",
          [JSON.stringify({ nombre, costo, precio, minimo: 0 })],
        )
      ).rows[0].id;
      await db.query(
        `insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia) select id,$2,'Prueba sintética',$3,$4 from alexmar.variantes where producto_id=$1`,
        [a, stock, ids[0], nombre],
      );
    }
    await db.exec(
      `insert into alexmar.clientes(id,nombre) values('55555555-5555-4555-8555-555555555555','Cliente A de prueba'),('66666666-6666-4666-8666-666666666666','Cliente B de prueba');`,
    );
    for (const [total, emitido, estado, tipo, c] of [
      [10, "2026-11-16T04:00:00Z", "confirmada", "factura", 0],
      [30, "2026-11-17T03:59:59Z", "confirmada", "factura", 1],
      [400, "2026-11-17T04:00:00Z", "confirmada", "factura", 0],
      [500, "2026-11-16T03:59:59Z", "confirmada", "factura", 0],
      [200, "2026-11-16T15:00:00Z", "anulada", "factura", 0],
      [100, "2026-11-16T15:00:00Z", "borrador", "factura", 0],
      [300, "2026-11-16T15:00:00Z", "confirmada", "presupuesto", 0],
    ] as const)
      await db.query(
        `insert into alexmar.ventas(id,cliente_id,subtotal,total,estado,tipo,usuario_id,firma,emitido) values(gen_random_uuid(),$1,$2,$2,$3,$4,$5,'sintético',$6)`,
        [
          c
            ? "66666666-6666-4666-8666-666666666666"
            : "55555555-5555-4555-8555-555555555555",
          total,
          estado,
          tipo,
          ids[0],
          emitido,
        ],
      );
    await db.exec(
      `insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto,origen) values('55555555-5555-4555-8555-555555555555','CARGO',now(),'Histórico excluido',99999,'supabase_anterior');`,
    );
    // Una corrección conserva el original y su reversión. El ranking usa solo la última procedencia.
    await db.exec(`insert into alexmar.lotes(id,huella,resumen,usuario_id) values('77777777-7777-4777-8777-777777777777',repeat('a',64),'{}','${ids[0]}');
    insert into alexmar.origenes(tipo,origen_id,nuevo_id,lote_id,datos) select 'detalle_cuentas',id::text,id,'77777777-7777-4777-8777-777777777777','{}' from alexmar.movimientos_cuenta where monto=99999;
    insert into alexmar.movimientos_cuenta(id,cliente_id,tipo,fecha,descripcion,monto,origen) values('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555','CARGO',now(),'Corrección de ejemplo',100,'supabase_anterior');
    insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto,origen,datos_originales) select '55555555-5555-4555-8555-555555555555','ABONO',now(),'Reversión de ejemplo',99999,'actualizacion_origen',jsonb_build_object('reversion_de',nuevo_id) from alexmar.origenes;
    insert into alexmar.revisiones_origen(tipo,origen_id,nuevo_id,lote_id,anterior,nuevo) select tipo,origen_id,'88888888-8888-4888-8888-888888888888',lote_id,'{}','{}' from alexmar.origenes;
    set role authenticated;`);
    const leer = async () =>
      (
        await db.query<{ r: AnaliticaDatos }>(
          `select public.analitica_comercial('2026-11-16','2026-11-16') r`,
        )
      ).rows[0].r;
    const d = await leer();
    assert.equal(d.inventario?.costo, "54");
    assert.equal(d.inventario?.venta, "80");
    assert.equal(d.inventario?.margen, "26");
    assert.equal(Number(d.inventario?.porcentaje), 32.5);
    assert.equal(d.inventario?.completos, 4);
    assert.equal(d.inventario?.sin_costo, 1);
    assert.equal(d.inventario?.sin_precio, 1);
    assert.equal(d.inventario?.costo_cero, 1);
    assert.equal(d.inventario?.stock_negativo, 1);
    assert.ok(d.inventario?.categorias.some((c) => Number(c.margen) < 0));
    assert.equal(d.ventas?.total, "40");
    assert.equal(d.historial_clientes?.[0].cargos, "100");
    assert.equal(d.ventas?.facturas, 2);
    assert.equal(d.ventas?.ticket, "20.0000000000000000");
    assert.equal(d.ventas?.clientes[0].nombre, "Cliente B de prueba");
    assert.equal(d.ventas?.serie[0].total, "40");
    const g = (
      await db.query<{
        r: { marcas_vehiculo: { nombre: string; total: number }[] };
      }>("select public.grupos_inventario() r")
    ).rows[0].r;
    assert.ok(
      g.marcas_vehiculo.some((g) => g.nombre === "Ford" && g.total === 1),
    );
    assert.ok(g.marcas_vehiculo.some((g) => g.nombre === "Isuzu / Chevrolet"));
    assert.equal(
      (
        await db.query<{ r: { total: number } }>(
          `select public.buscar_productos('{"marca_vehiculo":"Ford"}') r`,
        )
      ).rows[0].r.total,
      1,
    );
    assert.equal(
      (
        await db.query<{ r: { total: number } }>(
          `select public.buscar_productos('{"marca_vehiculo":"Ford","modelo":"Hilux"}') r`,
        )
      ).rows[0].r.total,
      0,
    );
    for (const [n, claves] of [
      [1, ["historial_clientes", "ventas"]],
      [2, ["inventario"]],
      [3, []],
    ] as const) {
      await db.exec(`set app.usuario='${ids[n]}'`);
      const r = await leer();
      assert.deepEqual(
        Object.keys(r)
          .filter((k) => !["desde", "hasta"].includes(k))
          .sort(),
        [...claves],
      );
    }
    await db.exec(`set app.usuario='${ids[0]}'`);
    await assert.rejects(
      () =>
        db.query(
          `select public.analitica_comercial('2024-01-01','2026-01-01')`,
        ),
      /período/,
    );
    await assert.rejects(
      () =>
        db.query(
          `select public.analitica_comercial('2026-11-17','2026-11-16')`,
        ),
      /período/,
    );
    const vacio = (
      await db.query<{ r: AnaliticaDatos }>(
        `select public.analitica_comercial('2000-01-01','2000-01-01') r`,
      )
    ).rows[0].r;
    assert.equal(vacio.ventas?.ticket, null);
    assert.deepEqual(vacio.ventas?.clientes, []);
    await db.exec("reset role;set role anon");
    await assert.rejects(() => leer(), /permission denied/);
    await db.exec(
      `reset role;update alexmar.perfiles set activo=false where id='${ids[0]}';set role authenticated`,
    );
    await assert.rejects(() => leer(), /Acceso|permiso|perfil/i);
  } finally {
    await db.close();
  }
});

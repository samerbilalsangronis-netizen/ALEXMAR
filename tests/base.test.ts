import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readFile } from "node:fs/promises";
test("SQL: instalación, permisos, búsqueda, ajustes y 1051 movimientos", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20261115000100_base_catalogo_historial.sql",
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values ('11111111-1111-4111-8111-111111111111','admin@ejemplo.com'),('22222222-2222-4222-8222-222222222222','ventas@ejemplo.com');insert into alexmar.perfiles values('11111111-1111-4111-8111-111111111111','Admin','administrador',true),('22222222-2222-4222-8222-222222222222','Ventas','ventas',true);set app.usuario='11111111-1111-4111-8111-111111111111';set role authenticated;`,
    );
    const result = await db.query<{ id: string }>(
      `select public.guardar_producto('{"nombre":"Anténa negra Toyota Hilux","referencia":"HLX-01","categoria":"ANTENAS","costo":"10","precio":"20","minimo":"2","compatibilidad":"Toyota Hilux"}') id`,
    );
    const id = result.rows[0].id;
    await db.query("select public.ajustar_stock($1,5,$2,$3)", [
      id,
      "Conteo inicial",
      "ajuste-inicial-01",
    ]);
    await db.query("select public.ajustar_stock($1,5,$2,$3)", [
      id,
      "Reintento inicial",
      "ajuste-inicial-01",
    ]);
    const buscar = await db.query<{
      datos: { total: number; filas: { fisico: string; costo?: string }[] };
    }>(`select public.buscar_productos('{"q":"hilux antena negra"}') datos`);
    assert.equal(buscar.rows[0].datos.total, 1);
    assert.equal(buscar.rows[0].datos.filas[0].fisico, "5.0000");
    await db.exec(`set app.usuario='22222222-2222-4222-8222-222222222222'`);
    const venta = await db.query<{
      datos: { filas: Record<string, unknown>[] };
    }>(`select public.buscar_productos('{}') datos`);
    assert.ok(!("costo" in venta.rows[0].datos.filas[0]));
    await assert.rejects(
      db.query(
        `select public.ajustar_stock($1,1,'no permitido','ajuste-rechazado')`,
        [id],
      ),
      /permiso/,
    );
    await assert.rejects(
      db.query("select * from alexmar.variantes"),
      /permission denied/,
    );
    await db.exec(
      `reset role;set app.usuario='11111111-1111-4111-8111-111111111111';insert into alexmar.clientes(id,nombre) values('33333333-3333-4333-8333-333333333333','Cliente prueba');insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto) select '33333333-3333-4333-8333-333333333333','CARGO','2026-01-01'::timestamptz+g*interval '1 hour','Histórico',1 from generate_series(1,1051) g;set role authenticated;`,
    );
    const cuenta = await db.query<{
      datos: { total: number; final: string; filas: unknown[] };
    }>(
      `select public.estado_cliente('33333333-3333-4333-8333-333333333333',null,null,36) datos`,
    );
    assert.equal(cuenta.rows[0].datos.total, 1051);
    assert.equal(cuenta.rows[0].datos.final, "1051.0000");
    assert.equal(cuenta.rows[0].datos.filas.length, 1);
    await db.exec(`set app.usuario=''`);
    await assert.rejects(
      db.query(`select public.buscar_productos('{}')`),
      /permiso/,
    );
  } finally {
    await db.close();
  }
});
test("SQL: importación atómica, bloqueo de diferencias e idempotencia", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20261115000100_base_catalogo_historial.sql",
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values('11111111-1111-4111-8111-111111111111','admin@ejemplo.com');insert into alexmar.perfiles values('11111111-1111-4111-8111-111111111111','Admin','administrador',true);set app.usuario='11111111-1111-4111-8111-111111111111';set role authenticated;`,
    );
    const id = "33333333-3333-4333-8333-333333333333";
    const payload = {
      inventario: [
        {
          id,
          nombre_producto: "Producto migrado",
          categoria_tags: "Prueba",
          compatibilidad_vehiculos: "UNIVERSAL",
          pvp: "15",
          costo: "5",
          stock_actual: "9",
          stock_minimo: "1",
          eliminado: "false",
        },
      ],
      clientes: [
        {
          id,
          nombre_cliente: "Cliente migrado",
          total_adeudado: "20",
          eliminado: "false",
        },
      ],
      detalle_cuentas: [
        {
          id,
          id_cliente: id,
          tipo_linea: "CARGO",
          fecha: "2026-10-01T12:00:00Z",
          descripcion: "Histórico",
          total_linea: "20",
          eliminado: "false",
        },
      ],
      notas: [],
    };
    const huella = "a".repeat(64);
    const malo = structuredClone(payload);
    malo.clientes[0].total_adeudado = "21";
    await assert.rejects(
      db.query("select public.importar_inicial($1,$2)", [
        JSON.stringify(malo),
        huella,
      ]),
      /diferencias/,
    );
    const uno = await db.query<{ r: { inventario: number } }>(
      "select public.importar_inicial($1,$2) r",
      [JSON.stringify(payload), huella],
    );
    assert.equal(uno.rows[0].r.inventario, 1);
    const dos = await db.query<{ r: { repetido: boolean } }>(
      "select public.importar_inicial($1,$2) r",
      [JSON.stringify(payload), huella],
    );
    assert.equal(dos.rows[0].r.repetido, true);
    const stock = await db.query<{ r: { fisico: string } }>(
      "select public.ficha_producto($1) r",
      [id],
    );
    assert.equal(stock.rows[0].r.fisico, "9.0000");
    await assert.rejects(
      db.query("select public.importar_inicial($1,$2)", [
        JSON.stringify(payload),
        "b".repeat(64),
      ]),
      /destino vacío/,
    );
  } finally {
    await db.close();
  }
});

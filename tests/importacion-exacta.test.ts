import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readFile, readdir } from "node:fs/promises";
import { analizar, type Datos } from "../src/lib/migracion";
const admin = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const otro = "33333333-3333-4333-8333-333333333333";
test("importación exacta: regla de vista, procedencia, transacción, permisos e idempotencia", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.com'),('${otro}','ventas@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${otro}','Ventas','ventas',true);set app.usuario='${admin}';set role authenticated;`,
    );
    const datos: Datos = {
      inventario: [
        {
          id,
          nombre_producto: "Muestra sintética",
          pvp: "20.00000000000000001",
          costo: "5",
          stock_actual: "3.123456789012345678901",
          stock_minimo: "1",
          eliminado: "false",
        },
      ],
      clientes: [
        {
          id,
          nombre_cliente: "Prueba",
          total_adeudado: "0",
          eliminado: "false",
        },
        {
          id: otro,
          nombre_cliente: "Inactivo",
          total_adeudado: "0",
          eliminado: "true",
        },
      ],
      detalle_cuentas: [
        {
          id,
          id_cliente: id,
          tipo_linea: "CARGO",
          total_linea: "10.12345678901234567890123456789",
          fecha: "2026-01-01T12:00:00Z",
          eliminado: "false",
        },
        {
          id: otro,
          id_cliente: id,
          tipo_linea: "ABONO",
          total_linea: "11",
          fecha: "2026-01-01T12:00:00Z",
          eliminado: "false",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          id_cliente: id,
          tipo_linea: "CARGO",
          total_linea: "500",
          fecha: "2026-01-01T12:00:00Z",
          eliminado: "true",
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          id_cliente: otro,
          tipo_linea: "TITULO",
          total_linea: "99",
          fecha: "2026-01-01T12:00:00Z",
          eliminado: "false",
        },
      ],
      notas: [
        {
          id,
          titulo: "Prueba",
          contenido: "Texto sintético",
          eliminado: "false",
        },
      ],
    };
    const sim = analizar(datos);
    assert.equal(sim.puedeImportar, true);
    const importar = (d: Datos, c: unknown, h = "a".repeat(64)) =>
      db.query<{ r: { repetido?: boolean } }>(
        "select public.importar_inicial($1,$2,$3) r",
        [JSON.stringify(d), h, JSON.stringify(c)],
      );
    await assert.rejects(
      importar(datos, [
        { id, saldo: "0" },
        { id: otro, saldo: "0" },
      ]),
      /no coincide/,
    );
    await assert.rejects(importar(datos, [sim.conciliacion[0]]), /incompleta/);
    const mal = structuredClone(datos);
    mal.notas[0].eliminado = "false;";
    await assert.rejects(importar(mal, sim.conciliacion), /estado/);
    await db.exec(`set app.usuario='${otro}'`);
    await assert.rejects(importar(datos, sim.conciliacion), /permiso/);
    await db.exec(`set app.usuario='${admin}';reset role;`);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from alexmar.lotes",
        )
      ).rows[0].n,
      0,
    );
    await db.exec("set role authenticated");
    await importar(datos, sim.conciliacion);
    assert.equal(
      (await importar(datos, sim.conciliacion)).rows[0].r.repetido,
      true,
    );
    const mod = structuredClone(datos);
    mod.notas[0].titulo = "Cambiada";
    await assert.rejects(importar(mod, sim.conciliacion), /otros datos/);
    await assert.rejects(
      importar(datos, sim.conciliacion, "b".repeat(64)),
      /destino vacío/,
    );
    const estado = (
      await db.query<{ r: { final: string; filas: unknown[] } }>(
        "select public.estado_cliente($1) r",
        [id],
      )
    ).rows[0].r;
    assert.equal(estado.final, sim.conciliacion[0].saldo);
    assert.equal(estado.filas.length, 2);
    const ficha = (
      await db.query<{ r: { fisico: string; precio: string } }>(
        "select public.ficha_producto($1) r",
        [id],
      )
    ).rows[0].r;
    assert.equal(ficha.fisico, datos.inventario[0].stock_actual);
    assert.equal(ficha.precio, datos.inventario[0].pvp);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from alexmar.origenes",
        )
      ).rows[0].n,
      8,
    );
    const originales = (
      await db.query<{ datos: Record<string, string> }>(
        "select datos from alexmar.origenes where tipo=$1 and origen_id=$2",
        ["clientes", id],
      )
    ).rows[0].datos;
    assert.equal(originales.total_adeudado, "0");
    const importe = (
      await db.query<{ m: string }>(
        "select monto::text m from alexmar.movimientos_cuenta where id=$1",
        [id],
      )
    ).rows[0].m;
    assert.equal(importe, datos.detalle_cuentas[0].total_linea);
    await db.exec("set role anon");
    await assert.rejects(
      importar(datos, sim.conciliacion),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

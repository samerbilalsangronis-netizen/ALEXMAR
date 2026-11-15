import { recuperarReporte } from "../src/lib/reportes";
import type { Pagina, Producto } from "../src/lib/formatos";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readFile, readdir } from "node:fs/promises";
test("proveedores y métricas: permisos, monedas, auditoría y más de mil registros", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  const admin = "11111111-1111-4111-8111-111111111111";
  const inv = "22222222-2222-4222-8222-222222222222";
  const ventas = "33333333-3333-4333-8333-333333333333";
  const lectura = "44444444-4444-4444-8444-444444444444";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.com'),('${inv}','inv@example.com'),('${ventas}','ventas@example.com'),('${lectura}','lectura@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${inv}','Inventario','inventario',true),('${ventas}','Ventas','ventas',true),('${lectura}','Lectura','lectura',true);set app.usuario='${admin}';set role authenticated;`,
    );
    async function guardar(p: Record<string, unknown>) {
      return (
        await db.query<{ id: string }>(
          "select public.guardar_proveedor($1::jsonb) id",
          [JSON.stringify(p)],
        )
      ).rows[0].id;
    }
    const id = await guardar({
      nombre: "Distribución Sintética",
      ciudad: "Mérida",
      marcas: "Prueba",
      monedas: ["USD", "VES"],
    });
    await guardar({
      id,
      nombre: "Distribución Sintética",
      ciudad: "Mérida",
      marcas: "Prueba",
      monedas: ["USD", "VES"],
      activo: false,
    });
    const buscar = async (p: Record<string, unknown>) =>
      (
        await db.query<{
          r: { total: number; paginas: number; filas: { id: string }[] };
        }>("select public.buscar_proveedores($1::jsonb) r", [JSON.stringify(p)])
      ).rows[0].r;
    assert.equal(
      (await buscar({ q: "merida", estado: "inactivos", moneda: "VES" })).total,
      1,
    );
    assert.equal((await buscar({})).total, 0);
    await assert.rejects(guardar({ nombre: "", monedas: ["USD"] }), /nombre/);
    await assert.rejects(
      guardar({ nombre: "Prueba", monedas: ["EUR"] }),
      /monedas/,
    );
    await assert.rejects(guardar({ nombre: "Prueba", monedas: [] }), /monedas/);
    await assert.rejects(
      guardar({ id: "99999999-9999-4999-8999-999999999999", nombre: "Prueba" }),
      /no encontrado/,
    );
    await db.exec(`reset role; insert into alexmar.proveedores(nombre) select 'Proveedor '||lpad(g::text,4,'0') from generate_series(1,1051) g;
   insert into alexmar.productos(id,nombre) values('${id}','Producto de prueba');
   insert into alexmar.variantes(id,producto_id,nombre,precio,minimo) values('${id}','${id}','Principal',null,5);
   insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia) values('${id}',4,'Prueba','${admin}','prueba');
   insert into alexmar.reservas(variante_id,cantidad,estado,referencia) values('${id}',4,'activa','Prueba');
   insert into alexmar.clientes(id,nombre) values('${id}','Cliente sintético');
   insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto) values('${id}','CARGO',now(),'Prueba','USD',10.1234),('${id}','ABONO',now(),'Prueba','USD',2.0001),('${id}','CARGO',now(),'Prueba','VES',50),('${id}','CARGO',now(),'Prueba','COP',100);
   set role authenticated;`);
    const ultimo = await buscar({ pagina: 36 });
    assert.equal(ultimo.total, 1051);
    assert.equal(ultimo.filas.length, 1);
    assert.equal(ultimo.paginas, 36);
    type Metricas = {
      productos_activos: number;
      sin_precio: number;
      agotadas: number;
      bajo_minimo: number;
      proveedores_activos?: number;
      clientes_activos?: number;
      cuentas?: { moneda: string; saldo: string }[];
    };
    const metricas = async () =>
      (await db.query<{ r: Metricas }>("select public.metricas_generales() r"))
        .rows[0].r;
    const m = await metricas();
    assert.equal(m.productos_activos, 1);
    assert.equal(m.sin_precio, 1);
    assert.equal(m.agotadas, 1);
    assert.equal(m.bajo_minimo, 1);
    assert.equal(m.proveedores_activos, 1051);
    assert.equal(m.clientes_activos, 1);
    assert.equal(m.cuentas!.find((c) => c.moneda === "USD")!.saldo, "8.1233");
    assert.equal(m.cuentas!.find((c) => c.moneda === "VES")!.saldo, "50");
    assert.equal(m.cuentas!.find((c) => c.moneda === "COP")!.saldo, "100");
    await db.exec(`set app.usuario='${inv}'`);
    await guardar({ nombre: "Nuevo inventario", monedas: ["COP"] });
    assert.ok(!("cuentas" in (await metricas())));
    for (const user of [ventas, lectura]) {
      await db.exec(`set app.usuario='${user}'`);
      await assert.rejects(guardar({ nombre: "Denegado" }), /permiso/);
      await assert.rejects(buscar({}), /permiso/);
      await assert.rejects(
        db.query("select * from alexmar.proveedores"),
        /permission denied/,
      );
      const d = await metricas();
      assert.ok(!("proveedores_activos" in d));
      assert.equal("cuentas" in d, user === ventas);
    }
    await db.exec(`reset role;`);
    const audit = await db.query<{ n: number }>(
      "select count(*)::int n from alexmar.auditoria where tabla='proveedores' and registro_id=$1",
      [id],
    );
    assert.equal(audit.rows[0].n, 2);
    await db.exec(
      `update alexmar.perfiles set activo=false where id='${admin}';set app.usuario='${admin}';set role authenticated;`,
    );
    await assert.rejects(metricas(), /permiso/);
    await db.exec("set app.usuario=''");
    await assert.rejects(metricas(), /permiso/);
    await db.exec(`reset role; set app.usuario='${lectura}';
      insert into alexmar.productos(nombre) select 'Producto '||g from generate_series(1,1050) g;
      insert into alexmar.variantes(producto_id) select id from alexmar.productos where nombre like 'Producto %' and id<>'${id}';
      set role authenticated;`);
    const todas = await recuperarReporte<Producto>(async (pagina) => {
      const r = await db.query<{ r: Pagina<Producto> }>(
        "select public.buscar_productos($1::jsonb) r",
        [JSON.stringify({ pagina, orden: "nombre" })],
      );
      return r.rows[0].r;
    });
    assert.equal(todas.length, 1051);
    assert.equal(new Set(todas.map((f) => f.id)).size, 1051);
    assert.ok(todas.every((f) => !("costo" in f)));
    await db.exec("set role anon");
    await assert.rejects(metricas(), /permission denied/);
  } finally {
    await db.close();
  }
});

test("exportación rechaza páginas truncadas, duplicadas y cambios de total", async () => {
  await assert.rejects(
    recuperarReporte(async () => ({
      pagina: 1,
      paginas: 1,
      total: 2,
      filas: [{ id: "a" }],
    })),
    /todos los registros/,
  );
  await assert.rejects(
    recuperarReporte(async (pagina) => ({
      pagina,
      paginas: 2,
      total: 2,
      filas: [{ id: "a" }],
    })),
    /cambió/,
  );
  await assert.rejects(
    recuperarReporte(async (pagina) => ({
      pagina,
      paginas: 2,
      total: pagina === 1 ? 2 : 3,
      filas: [{ id: String(pagina) }],
    })),
    /cambiaron/,
  );
});

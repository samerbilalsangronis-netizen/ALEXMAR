import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readFile, readdir } from "node:fs/promises";

test("compatibilidades: CRUD, permisos, auditoría, filtros conjuntos y paginación completa", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`);
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
    }
    const admin = "11111111-1111-4111-8111-111111111111";
    const ventas = "22222222-2222-4222-8222-222222222222";
    const inventario = "44444444-4444-4444-8444-444444444444";
    const lectura = "55555555-5555-4555-8555-555555555555";
    await db.exec(`insert into auth.users values ('${admin}','admin@example.com'),('${ventas}','ventas@example.com'),('${inventario}','inventario@example.com'),('${lectura}','lectura@example.com');
      insert into alexmar.perfiles values ('${admin}','Admin','administrador',true),('${ventas}','Ventas','ventas',true),('${inventario}','Inventario','inventario',true),('${lectura}','Lectura','lectura',true);
      set app.usuario='${admin}'; set role authenticated;`);
    async function producto(nombre: string) {
      return (
        await db.query<{ id: string }>(
          "select public.guardar_producto($1::jsonb) id",
          [JSON.stringify({ nombre, minimo: 0 })],
        )
      ).rows[0].id;
    }
    const id = await producto("Antena");
    const otro = await producto("Otro");
    async function guardar(p: Record<string, unknown>, prod = id) {
      return (
        await db.query<{ id: string }>(
          "select public.guardar_compatibilidad($1,$2::jsonb) id",
          [prod, JSON.stringify(p)],
        )
      ).rows[0].id;
    }
    async function buscar(p: Record<string, unknown>) {
      return (
        await db.query<{ r: { total: number } }>(
          "select public.buscar_productos($1::jsonb) r",
          [JSON.stringify(p)],
        )
      ).rows[0].r.total;
    }
    const hilux = {
      marca: "Toyota",
      modelo: "Hilux",
      anio_desde: 2010,
      anio_hasta: 2015,
    };
    const cid = await guardar(hilux);
    await guardar({
      marca: "Ford",
      modelo: "Ranger",
      anio_desde: 2020,
      anio_hasta: 2025,
    });
    assert.equal(await buscar({ vehiculo: "Toyota Hilux", anio: 2012 }), 1);
    assert.equal(
      await buscar({ vehiculo: "Toyota Hilux", anio: 2022 }),
      0,
      "no combina vehículo de una fila con año de otra",
    );
    assert.equal(await buscar({ q: "antena toyota hilux" }), 1);
    await assert.rejects(guardar({ ...hilux, marca: "Tóyota" }), /ya está/);
    await assert.rejects(guardar({ ...hilux, anio_desde: 2020 }), /rango/);
    await assert.rejects(
      guardar({ marca: "Toyota", modelo: "" }),
      /marca y modelo/,
    );
    await assert.rejects(
      guardar({ universal: true, modelo: "Hilux" }),
      /universal/,
    );
    await assert.rejects(guardar({ ...hilux, id: cid }, otro), /no encontrada/);
    await guardar({ ...hilux, id: cid, anio_hasta: 2018 });
    assert.equal(await buscar({ vehiculo: "Toyota", anio: 2018 }), 1);
    const desconocido = await guardar({ marca: "Nissan", modelo: "Sentra" });
    assert.equal(
      await buscar({ vehiculo: "Nissan", anio: 2000 }),
      0,
      "sin años no afirma un año específico",
    );
    assert.equal(await buscar({ vehiculo: "Nissan" }), 1);
    await db.exec(`set app.usuario='${inventario}'`);
    const universal = await guardar({ universal: true }, otro);
    assert.equal(await buscar({ vehiculo: "Honda", anio: 2000 }), 1);
    await db.query("select public.eliminar_compatibilidad($1,$2)", [
      otro,
      universal,
    ]);
    await db.query("select public.eliminar_compatibilidad($1,$2)", [
      otro,
      universal,
    ]);
    for (const usuario of [ventas, lectura]) {
      await db.exec(`set app.usuario='${usuario}'`);
      const lista = await db.query<{ r: { total: number } }>(
        "select public.listar_compatibilidades($1) r",
        [id],
      );
      assert.equal(lista.rows[0].r.total, 3);
      await assert.rejects(guardar({ universal: true }), /permiso/);
      await assert.rejects(
        db.query("select public.eliminar_compatibilidad($1,$2)", [id, cid]),
        /permiso/,
      );
      await assert.rejects(
        db.query("select * from alexmar.compatibilidades"),
        /permission denied/,
      );
    }
    await db.exec(`set app.usuario='';`);
    await assert.rejects(
      db.query("select public.listar_compatibilidades($1)", [id]),
      /permiso/,
    );
    await db.exec(`set role anon;`);
    await assert.rejects(
      db.query("select public.listar_compatibilidades($1)", [id]),
      /permission denied/,
    );
    await db.exec(`reset role; set app.usuario='${admin}';`);
    const audit = await db.query<{ n: number }>(
      "select count(*)::int n from alexmar.auditoria where tabla='compatibilidades' and operacion='DELETE' and usuario_id=$1",
      [inventario],
    );
    assert.equal(audit.rows[0].n, 1);
    // Más de mil filas, con última página accesible y sin truncamiento.
    await db.query(
      `insert into alexmar.compatibilidades(producto_id,marca,modelo,anio_desde,anio_hasta)
      select $1,'Prueba','Modelo '||g,2000,2001 from generate_series(1,1051) g`,
      [otro],
    );
    await db.exec(`set role authenticated;`);
    const pagina = await db.query<{
      r: { total: number; paginas: number; filas: unknown[] };
    }>("select public.listar_compatibilidades($1,36) r", [otro]);
    assert.equal(pagina.rows[0].r.total, 1051);
    assert.equal(pagina.rows[0].r.paginas, 36);
    assert.equal(pagina.rows[0].r.filas.length, 1);
    await db.query("select public.eliminar_compatibilidad($1,$2)", [
      otro,
      desconocido,
    ]);
    assert.equal(
      await buscar({ vehiculo: "Nissan" }),
      1,
      "no elimina compatibilidad de otro producto",
    );
    await db.exec(
      `reset role; update alexmar.perfiles set activo=false where id='${admin}'; set role authenticated;`,
    );
    await assert.rejects(guardar({ universal: true }), /permiso/);
  } finally {
    await db.close();
  }
});

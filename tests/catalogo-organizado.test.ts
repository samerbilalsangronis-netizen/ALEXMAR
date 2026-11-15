import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
const admin = "11111111-1111-4111-8111-111111111111";
const ventas = "22222222-2222-4222-8222-222222222222";
const inventario = "33333333-3333-4333-8333-333333333333";
const lectura = "44444444-4444-4444-8444-444444444444";
test("catálogo organizado: agrupación completa, Fiesta por nombre, filtros y clasificación auditada", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql") && !f.includes("00500"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.com'),('${ventas}','ventas@example.com'),('${inventario}','inventario@example.com'),('${lectura}','lectura@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${ventas}','Ventas','ventas',true),('${inventario}','Inventario','inventario',true),('${lectura}','Lectura','lectura',true);set app.usuario='${admin}';set role authenticated;`,
    );
    const crear = async (
      nombre: string,
      categoria: string,
      compatibilidad = "UNIVERSAL",
    ) =>
      (
        await db.query<{ id: string }>(
          "select public.guardar_producto($1) id",
          [
            JSON.stringify({
              nombre,
              categoria,
              compatibilidad,
              precio: "10",
              costo: "4",
              minimo: 1,
            }),
          ],
        )
      ).rows[0].id;
    const fiesta = await crear("Faro Fiesta Power", "FORD");
    const hilux = await crear("Espejo Hilux", "TOYOTA");
    await crear("Artículo sin información", "VARIOS");
    // Activar la clasificación DESPUÉS de crear datos, como en el proyecto importado.
    await db.exec("reset role");
    await db.exec(
      await readFile(
        "supabase/migrations/20261115000500_catalogo_organizado.sql",
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    type Filas = {
      filas: {
        id: string;
        categoria: string;
        categoria_origen: string;
        vehiculos: string[];
        costo?: string;
      }[];
      total: number;
      paginas: number;
    };
    const buscar = async (p: Record<string, unknown>) =>
      (
        await db.query<{ r: Filas }>("select public.buscar_productos($1) r", [
          JSON.stringify(p),
        ])
      ).rows[0].r;
    const grupos = async (p: Record<string, unknown> = {}) =>
      (
        await db.query<{
          r: {
            total: number;
            categorias: { nombre: string; total: number }[];
            vehiculos: { nombre: string; total: number }[];
          };
        }>("select public.grupos_inventario($1) r", [JSON.stringify(p)])
      ).rows[0].r;
    let g = await grupos();
    assert.equal(g.total, 3);
    assert.equal(
      g.categorias.find((c) => c.nombre === "Iluminación")?.total,
      1,
    );
    assert.equal(g.vehiculos.find((v) => v.nombre === "Fiesta")?.total, 1);
    let d = await buscar({ modelo: "Fiesta", categoria: "Iluminación" });
    assert.equal(d.total, 1);
    assert.equal(d.filas[0].id, fiesta);
    assert.equal(d.filas[0].categoria_origen, "FORD");
    assert.equal(
      (await buscar({ modelo: "Fiesta", categoria: "Espejos y retrovisores" }))
        .total,
      0,
    );
    assert.equal(
      (await buscar({ modelo: "Fiesta", anio: 2012 })).total,
      0,
      "mención en nombre no verifica el año",
    );
    assert.equal((await buscar({ categoria_origen: "FORD" })).total, 1);
    const guardar = (categoria: string | null, modelos: string[] | null) =>
      db.query("select public.guardar_clasificacion($1,$2,$3)", [
        fiesta,
        categoria,
        modelos,
      ]);
    await guardar("Piezas destacadas", [
      "Fiesta",
      "Fiesta",
      "Modelo personalizado",
    ]);
    d = await buscar({
      categoria: "Piezas destacadas",
      modelo: "Modelo personalizado",
    });
    assert.equal(d.total, 1);
    await db.exec(`set app.usuario='${inventario}'`);
    await guardar("Piezas destacadas", null);
    await db.exec(
      `reset role;insert into alexmar.productos(nombre,categoria,compatibilidad) select 'Faro Fiesta sintético '||g,'FORD','UNIVERSAL' from generate_series(1,1050) g;insert into alexmar.variantes(producto_id) select id from alexmar.productos where nombre like 'Faro Fiesta sintético %';set role authenticated;`,
    );
    g = await grupos({ modelo: "Fiesta" });
    assert.equal(g.total, 1051);
    assert.equal(
      g.categorias.reduce((s, c) => s + c.total, 0),
      1051,
    );
    const ultima = await buscar({ modelo: "Fiesta", pagina: 36 });
    assert.equal(ultima.total, 1051);
    assert.equal(ultima.filas.length, 1);
    const f = await grupos({ modelo: "Fiesta", precio: "con" });
    assert.equal(f.total, 1);
    for (const user of [ventas, lectura]) {
      await db.exec(`set app.usuario='${user}'`);
      assert.equal((await grupos({ modelo: "Fiesta" })).total, 1051);
      assert.ok(
        (await buscar({ modelo: "Fiesta" })).filas.every(
          (a) => !("costo" in a),
        ),
      );
      await assert.rejects(guardar("No autorizado", null), /permiso/);
      await assert.rejects(
        db.query("select * from alexmar.catalogo_organizado"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from alexmar.clasificaciones_catalogo"),
        /permission denied/,
      );
    }
    await db.exec(`set app.usuario='${admin}'`);
    await guardar(null, null);
    assert.equal(
      (
        await buscar({
          modelo: "Fiesta",
          categoria: "Iluminación",
          precio: "con",
        })
      ).total,
      1,
      "vaciar clasificación vuelve a sugerencia",
    );
    await db.exec(`reset role;`);
    const original = (
      await db.query<{ categoria: string }>(
        "select categoria from alexmar.productos where id=$1",
        [fiesta],
      )
    ).rows[0].categoria;
    assert.equal(original, "FORD");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from alexmar.auditoria where tabla='clasificaciones_catalogo' and registro_id=$1",
          [fiesta],
        )
      ).rows[0].n,
      3,
    );
    await db.exec(
      `update alexmar.perfiles set activo=false where id='${admin}';set role authenticated;`,
    );
    await assert.rejects(grupos(), /permiso/);
    await db.exec("set role anon");
    await assert.rejects(grupos(), /permission denied/);
    assert.ok(hilux);
  } finally {
    await db.close();
  }
});

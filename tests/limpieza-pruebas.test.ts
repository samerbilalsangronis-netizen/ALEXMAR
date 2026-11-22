import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
const carpeta = "supabase/utilidades/",
  archivo = "limpiar_pruebas_con_respaldo_v1.sql",
  restaurar = "restaurar_respaldo_pruebas_v1.sql";
const respaldo = "alexmar_respaldo_pruebas_20261122_v1";
const admin = "11111111-1111-4111-8111-111111111111",
  id = "55555555-5555-4555-8555-555555555555";
const inicial = {
  inventario: [
    {
      id,
      nombre_producto: "Faro sintético",
      costo: "4.1234567890123456789",
      pvp: "10.1234567890123456789",
      stock_actual: "10",
      stock_minimo: "1",
      eliminado: "false",
    },
  ],
  clientes: [
    {
      id,
      nombre_cliente: "Cliente sintético",
      total_adeudado: "0",
      eliminado: "false",
    },
  ],
  detalle_cuentas: [
    {
      id,
      id_cliente: id,
      tipo_linea: "CARGO",
      total_linea: "20.1234567890123456789",
      fecha: "2026-11-01T12:00:00Z",
      descripcion: "Historia sintética",
      eliminado: "false",
    },
  ],
  notas: [
    { id, titulo: "Nota sintética", contenido: "Original", eliminado: "false" },
  ],
};
async function instalar(completa: boolean) {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        !f.includes("001200") &&
        (completa || (!f.includes("000700") && !f.includes("001000"))),
    )
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `insert into auth.users values('${admin}','admin@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true);set app.usuario='${admin}';set role authenticated;`,
  );
  await importar(db, inicial, "a");
  return db;
}
async function importar(db: PGlite, d: typeof inicial, huella: string) {
  return (
    await db.query<{ r: any }>("select public.importar_inicial($1,$2,$3) r", [
      JSON.stringify(d),
      huella.repeat(64),
      JSON.stringify([{ id, saldo: d.detalle_cuentas[0].total_linea }]),
    ])
  ).rows[0].r;
}
async function rpc(db: PGlite, n: string, p: unknown) {
  return (
    await db.query<{ r: any }>("select public." + n + "($1) r", [
      JSON.stringify(p),
    ])
  ).rows[0].r;
}
async function ejecutar(db: PGlite, n: string) {
  return db.exec(await readFile(carpeta + n, "utf8"));
}
async function fallo(db: PGlite, n: string, patron: RegExp) {
  await assert.rejects(ejecutar(db, n), patron);
  await db.exec("rollback");
}
async function copiar(db: PGlite, esquema = "alexmar") {
  const tablas = (
    await db.query<{ relname: string }>(
      "select relname from pg_class where relnamespace=$1::regnamespace and relkind='r' order by relname",
      [esquema],
    )
  ).rows;
  const resultado: Record<string, unknown> = {};
  for (const { relname } of tablas)
    resultado[relname] = (
      await db.query(
        `select to_jsonb(t) fila from ${esquema}.${relname} t order by to_jsonb(t)::text`,
      )
    ).rows;
  return resultado;
}
for (const completa of [true, false])
  test(`limpieza de pruebas: ${completa ? "restaura todo, incluso compras y revisiones" : "sin 007/010, permite cargar de cero y bloquea sobrescritura"}`, async () => {
    const db = await instalar(completa);
    try {
      await db.exec("reset role");
      await db.exec(
        `insert into alexmar.consultas(usuario_id,nombre,filtros) values('${admin}','Mi filtro','{}');insert into alexmar.fotos_vehiculo values('Ford','vehiculos/prueba.png','${admin}',now());insert into alexmar.clasificaciones_catalogo values('${id}','Iluminación',array['Fiesta']);insert into alexmar.compatibilidades(producto_id,marca,modelo)values('${id}','Ford','Fiesta');create schema storage;create table storage.objetos_prueba(id text primary key,contenido bytea);insert into storage.objetos_prueba values('foto',decode('CAFE','hex'));create table public.inventario(id int primary key);insert into public.inventario values(42);`,
      );
      const variante = (
        await db.query<{ id: string }>("select id from alexmar.variantes")
      ).rows[0].id;
      await db.exec(`set role authenticated;`);
      const venta = {
        id: randomUUID(),
        version: 0,
        cliente_id: id,
        condicion: "credito",
        abono: "2",
        metodo_pago: "Efectivo",
        lineas: [
          {
            variante_id: variante,
            cantidad: "1.25",
            precio: inicial.inventario[0].pvp,
          },
        ],
      };
      await rpc(db, "emitir_factura", venta);
      await rpc(db, "cobrar_factura", {
        id: venta.id,
        idempotencia: randomUUID(),
        monto: "1.1234567890123456789",
        metodo: "Transferencia",
      });
      if (completa) {
        const proveedor = await rpc(db, "guardar_proveedor", {
          nombre: "Proveedor sintético",
          monedas: ["USD"],
        });
        await rpc(db, "recibir_compra", {
          id: randomUUID(),
          proveedor_id: proveedor,
          moneda: "USD",
          referencia: "PRUEBA",
          lineas: [
            {
              variante_id: variante,
              cantidad: "2",
              costo_unitario: "9.1234567890123456789",
            },
          ],
        });
        await db.exec("reset role");
        await db.exec(
          `insert into alexmar.revisiones_origen(tipo,origen_id,nuevo_id,lote_id,anterior,nuevo)select tipo,origen_id,nuevo_id,lote_id,datos,datos from alexmar.origenes limit 1;set role authenticated;`,
        );
      }
      await db.exec("reset role");
      const antes = await copiar(db),
        externos = await copiar(db, "storage"),
        auth = await copiar(db, "auth");
      const siguiente = (
        await db.query<{ v: number }>(
          "select case when is_called then last_value+1 else last_value end::int v from alexmar.numero_venta",
        )
      ).rows[0].v;
      // Los roles de la web no pueden ejecutar esta operación ni acceder a sus copias.
      await db.exec("set role authenticated");
      await fallo(db, archivo, /SQL Editor/);
      await db.exec("reset role");
      if (completa) {
        await db.exec(
          `create table public.referencia_ajena(id uuid references alexmar.productos(id));`,
        );
        await fallo(db, archivo, /foreign key|referenc|truncate/i);
        assert.equal(
          (
            await db.query<{ r: string | null }>(
              "select to_regnamespace($1)::text r",
              [respaldo],
            )
          ).rows[0].r,
          null,
        );
        assert.deepEqual(
          await copiar(db),
          antes,
          "Fallo de TRUNCATE revierte todo",
        );
        await db.exec("drop table public.referencia_ajena");
        await db.exec("create table alexmar.modulo_no_revisado(id int)");
        await fallo(db, archivo, /fuera del alcance/);
        await db.exec("drop table alexmar.modulo_no_revisado");
      } else {
        await db.exec(
          "create function public.estado_importacion() returns jsonb language sql as $$select '{}'::jsonb$$",
        );
        await fallo(db, archivo, /007 parece incompleto/);
        await db.exec("drop function public.estado_importacion()");
      }
      await ejecutar(db, archivo);
      const manifiesto = (
        await db.query<{ tabla: string; filas: string; vaciada: boolean }>(
          `select * from ${respaldo}.manifiesto`,
        )
      ).rows;
      for (const t of manifiesto) {
        const filas = (
          await db.query<{ n: number }>(
            `select count(*)::int n from alexmar.${t.tabla}`,
          )
        ).rows[0].n;
        if (t.vaciada) assert.equal(filas, 0, t.tabla);
        else if (t.tabla !== "auditoria")
          assert.deepEqual((await copiar(db))[t.tabla], antes[t.tabla]);
      }
      assert.deepEqual(await copiar(db, "storage"), externos);
      assert.deepEqual(await copiar(db, "auth"), auth);
      assert.equal(
        (await db.query<{ id: number }>("select id from public.inventario"))
          .rows[0].id,
        42,
      );
      assert.equal(
        (
          await db.query<{ r: boolean }>(
            `select sql_007 r from ${respaldo}.control`,
          )
        ).rows[0].r,
        completa,
      );
      assert.equal(
        (
          await db.query<{ r: boolean }>(
            "select not is_called and last_value=1 r from alexmar.numero_venta",
          )
        ).rows[0].r,
        true,
      );
      await db.exec("set role authenticated");
      await assert.rejects(
        db.query(`select * from ${respaldo}.clientes`),
        /permission denied/,
      );
      await db.exec("reset role");
      if (completa) {
        await ejecutar(db, restaurar);
        const despues = await copiar(db);
        for (const { tabla } of manifiesto)
          if (tabla !== "auditoria")
            assert.deepEqual(
              despues[tabla],
              antes[tabla],
              tabla + " restaurada exacta",
            );
        assert.equal(
          (
            await db.query<{ v: number }>(
              "select nextval('alexmar.numero_venta')::int v",
            )
          ).rows[0].v,
          siguiente,
        );
        await fallo(db, restaurar, /no está pendiente/);
        await fallo(db, archivo, /ya tiene un respaldo/);
      } else {
        // La pantalla actual usa estado_importacion: instalar 007 una vez si faltaba.
        await db.exec(
          await readFile(
            "supabase/migrations/20261116000700_actualizacion_origen.sql",
            "utf8",
          ),
        );
        await db.exec("set role authenticated");
        assert.equal(
          (
            await db.query<{ r: { carga_previa: boolean } }>(
              "select public.estado_importacion() r",
            )
          ).rows[0].r.carga_previa,
          false,
        );
        const nuevos = structuredClone(inicial);
        nuevos.inventario[0].stock_actual = "17";
        nuevos.detalle_cuentas[0].total_linea = "42.9876543210123456789";
        const r = await importar(db, nuevos, "b");
        assert.notEqual(r.repetido, true);
        assert.equal((await importar(db, nuevos, "b")).repetido, true);
        await db.exec("reset role");
        const nuevosGuardados = await copiar(db);
        assert.equal(
          (
            await db.query<{ stock: string }>(
              "select sum(cantidad)::text stock from alexmar.movimientos_stock",
            )
          ).rows[0].stock,
          "17",
        );
        assert.equal(
          (
            await db.query<{ saldo: string }>(
              "select sum(monto)::text saldo from alexmar.movimientos_cuenta",
            )
          ).rows[0].saldo,
          "42.9876543210123456789",
        );
        await fallo(db, restaurar, /contiene datos nuevos/);
        await fallo(db, archivo, /ya tiene un respaldo/);
        assert.deepEqual(
          await copiar(db),
          nuevosGuardados,
          "Ni repetir limpieza ni restaurar pisa la carga nueva",
        );
      }
    } finally {
      await db.close();
    }
  });

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
const admin = "11111111-1111-4111-8111-111111111111",
  cliente = "22222222-2222-4222-8222-222222222222",
  general = "33333333-3333-4333-8333-333333333333";
async function rpc(db: PGlite, n: string, p: unknown[] = []) {
  return (
    await db.query<{ r: any }>(
      `select public.${n}(${p.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      p,
    )
  ).rows[0].r;
}
const json = (db: PGlite, n: string, p: unknown) =>
  rpc(db, n, [JSON.stringify(p)]);
async function instalar() {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `insert into auth.users values('${admin}','admin@example.com'),('${general}','general@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${general}','General','lectura',true);insert into alexmar.clientes(id,nombre)values('${cliente}','Cliente sintético');set app.usuario='${admin}';set role authenticated;`,
  );
  return db;
}
test("precios: inventario 60, operación 70 × 3 = 210, sin cambiar catálogo; altas idempotentes y borrador conserva autorización", async () => {
  const db = await instalar();
  try {
    const p = {
      id: randomUUID(),
      nombre: "Faro sintético",
      precio: "60",
      categoria: "Iluminación",
      referencia: "DEMO",
    };
    const a = await json(db, "crear_producto_venta", p);
    assert.deepEqual(await json(db, "crear_producto_venta", p), a);
    assert.equal(a.disponible, "0");
    await assert.rejects(
      () => json(db, "crear_producto_venta", { ...p, precio: "61" }),
      /otros datos/,
    );
    const venta = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      condicion: "credito",
      moneda: "USD",
      descuento: "0",
      abono: "0",
      lineas: [{ variante_id: a.variante_id, cantidad: "3", precio: "70" }],
    };
    await assert.rejects(
      () => json(db, "emitir_factura", venta),
      /precio de catálogo/,
    );
    const autorizada = {
      ...venta,
      lineas: [{ ...venta.lineas[0], precio_personalizado: true }],
    };
    await json(db, "emitir_factura", autorizada);
    await json(db, "emitir_factura", autorizada);
    const ficha = await rpc(db, "ficha_venta", [venta.id]);
    assert.equal(ficha.total, "210");
    assert.equal(ficha.lineas[0].precio, "70");
    assert.equal(ficha.lineas[0].precio_personalizado, true);
    const art = await rpc(db, "ficha_producto", [a.id]);
    assert.equal(art.precio, "60");
    assert.equal(art.fisico, "0");
    assert.equal(art.costo, null);
    assert.equal((await rpc(db, "estado_cliente", [cliente])).final, "210");
    const borrador = {
      ...autorizada,
      id: randomUUID(),
      lineas: [
        { ...autorizada.lineas[0], cantidad: "2", precio: "50.123456789" },
      ],
    };
    await json(db, "guardar_borrador_factura", borrador);
    const b = await rpc(db, "ficha_venta", [borrador.id]);
    assert.equal(b.lineas[0].precio_personalizado, true);
    await json(db, "emitir_factura", {
      ...borrador,
      version: b.version,
      lineas: b.lineas,
    });
    assert.equal(
      (await rpc(db, "ficha_venta", [borrador.id])).total,
      "100.246913578",
    );
    assert.equal((await rpc(db, "ficha_producto", [a.id])).precio, "60");
  } finally {
    await db.close();
  }
});
test("precios: altas inválidas, catálogo sin autorización, permisos y control de stock se mantienen", async () => {
  const db = await instalar();
  try {
    for (const precio of ["-1", "", "NaN", "10000000000000000"]) {
      await assert.rejects(() =>
        json(db, "crear_producto_venta", {
          id: randomUUID(),
          nombre: "Producto inválido",
          precio,
        }),
      );
    }
    const a = await json(db, "crear_producto_venta", {
      id: randomUUID(),
      nombre: "Producto de prueba",
      precio: "60",
    });
    const p = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      condicion: "credito",
      abono: "0",
      lineas: [
        {
          variante_id: a.variante_id,
          cantidad: "1",
          precio: "70",
          precio_personalizado: true,
        },
      ],
    };
    await rpc(db, "configurar_descuento_stock", [true, 1]);
    await assert.rejects(() => json(db, "emitir_factura", p), /Existencia/);
    assert.equal((await rpc(db, "estado_cliente", [cliente])).final, "0");
    await db.exec(`set app.usuario='${general}'`);
    await assert.rejects(
      () =>
        json(db, "crear_producto_venta", {
          id: randomUUID(),
          nombre: "Sin permiso",
          precio: "1",
        }),
      /permiso|autorizad/i,
    );
    await assert.rejects(
      () => json(db, "emitir_factura", p),
      /permiso|autorizad/i,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      () =>
        json(db, "crear_producto_venta", {
          id: randomUUID(),
          nombre: "Anónimo",
          precio: "1",
        }),
      /permission/,
    );
  } finally {
    await db.close();
  }
});

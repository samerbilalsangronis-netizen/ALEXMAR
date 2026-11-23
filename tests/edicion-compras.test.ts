import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import type { Compra, ProveedorCompras } from "../src/lib/compras";
const admin = "11111111-1111-4111-8111-111111111111",
  general = "22222222-2222-4222-8222-222222222222";
async function rpc<T = unknown>(db: PGlite, n: string, args: unknown[] = []) {
  return (
    await db.query<{ r: T }>(
      `select public.${n}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      args,
    )
  ).rows[0].r;
}
const json = (db: PGlite, n: string, p: unknown) =>
  rpc(db, n, [JSON.stringify(p)]);
const ficha = (db: PGlite, id: string) => rpc<Compra>(db, "ficha_compra", [id]);
async function instalar() {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
  );
  // La actualización se ensaya también sobre una orden/pago existentes antes de 014.
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && f < "20261123001400")
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `insert into auth.users values('${admin}','admin@example.com'),('${general}','general@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${general}','General','lectura',true);set app.usuario='${admin}';set role authenticated;`,
  );
  const proveedor = await rpc<string>(db, "guardar_proveedor", [
    JSON.stringify({ nombre: "Proveedor sintético", monedas: ["USD"] }),
  ]);
  const producto = randomUUID(),
    id = randomUUID(),
    pago = randomUUID();
  await json(db, "recibir_compra", {
    id,
    proveedor_id: proveedor,
    referencia: "PRUEBA-1",
    lineas: [
      {
        nuevo: { id: producto, nombre: "Faro sintético" },
        cantidad: "5",
        costo_unitario: "100",
      },
    ],
  });
  await json(db, "pagar_compra", {
    id: pago,
    compra_id: id,
    monto: "200",
    metodo: "Transferencia",
  });
  await db.exec("reset role");
  await db.exec(
    await readFile(
      "supabase/migrations/20261123001400_edicion_ordenes_proveedores.sql",
      "utf8",
    ),
  );
  await db.exec("set role authenticated");
  return { db, id, pago, proveedor, producto };
}
function correccion(d: Compra, q = "5", k = "100") {
  return {
    id: d.id,
    version: d.version,
    referencia: d.referencia,
    observaciones: "Dato corregido",
    motivo: "Corrección de prueba",
    lineas: d.lineas.map((l) => ({ id: l.id, cantidad: q, costo_unitario: k })),
  };
}
test("órdenes: editar y anular con abonos conserva precisión, stock por diferencia, costo anterior e historial", async () => {
  const { db, id, pago, proveedor, producto } = await instalar();
  try {
    let d = await ficha(db, id);
    assert.equal(d.version, 1);
    assert.equal(d.pagado, "200");
    const p = correccion(d, "6", "100.1234567");
    await json(db, "editar_compra", p);
    d = await ficha(db, id);
    assert.equal(d.total, "600.7407402");
    assert.equal(d.saldo, "400.7407402");
    assert.equal(d.version, 2);
    let art = await rpc<{
      fisico: string;
      costo: string;
      precio: string | null;
    }>(db, "ficha_producto", [producto]);
    assert.equal(art.fisico, "6");
    assert.equal(art.costo, "100.1234567");
    assert.equal(art.precio, null);
    await assert.rejects(() => json(db, "editar_compra", p), /cambió/);
    assert.equal(
      (await rpc<{ fisico: string }>(db, "ficha_producto", [producto])).fisico,
      "6",
    );
    await json(db, "corregir_pago_compra", {
      compra_id: id,
      id: pago,
      version: d.version,
      accion: "editar",
      monto: "250.123456789",
      metodo: "Pago móvil",
      referencia: "Corregida",
      motivo: "Abono real corregido",
      revisado: true,
    });
    d = await ficha(db, id);
    assert.equal(d.pagado, "250.123456789");
    assert.equal(d.saldo, "350.617283411");
    assert.equal(d.version, 3);
    assert.equal(d.pagos.filas[0].metodo, "Pago móvil");
    await assert.rejects(
      () => json(db, "editar_compra", correccion(d, "1", "100")),
      /por debajo/,
    );
    assert.equal((await ficha(db, id)).total, "600.7407402");
    await json(db, "corregir_pago_compra", {
      compra_id: id,
      id: pago,
      version: d.version,
      accion: "anular",
      motivo: "Abono de prueba sin pago real",
      revisado: true,
    });
    d = await ficha(db, id);
    assert.equal(d.pagado, "0");
    assert.equal(d.pagos.filas[0].anulado, true);
    // El reintento original no resucita un abono anulado ni vuelve a aplicarlo.
    await json(db, "pagar_compra", {
      id: pago,
      compra_id: id,
      monto: "200",
      metodo: "Transferencia",
    });
    assert.equal((await ficha(db, id)).pagado, "0");
    await json(db, "pagar_compra", {
      id: randomUUID(),
      compra_id: id,
      monto: "600.7407402",
      metodo: "Efectivo",
    });
    d = await ficha(db, id);
    assert.equal(d.saldo, "0.0000000");
    await assert.rejects(
      () =>
        rpc(db, "anular_orden_compra", [
          id,
          d.version,
          "Orden de prueba",
          false,
        ]),
      /Confirma/,
    );
    await rpc(db, "anular_orden_compra", [
      id,
      d.version,
      "Orden de prueba sin pago real",
      true,
    ]);
    d = await ficha(db, id);
    assert.equal(d.estado, "anulada");
    assert.equal(d.pagado, "0");
    assert.equal(d.saldo, "0");
    assert.equal(d.pagos.total, 2);
    assert.ok(d.pagos.filas.every((p) => p.anulado));
    art = await rpc(db, "ficha_producto", [producto]);
    assert.equal(art.fisico, "0");
    assert.equal(art.costo, null);
    const cuenta = await rpc<ProveedorCompras>(db, "ficha_proveedor_compras", [
      proveedor,
    ]);
    assert.equal(cuenta.resumen.comprado, "0");
    assert.equal(cuenta.resumen.pagado, "0");
    assert.equal(cuenta.resumen.saldo, "0");
    assert.equal(cuenta.productos.total, 0);
    await db.exec("reset role");
    const audit = await db.query<{ anterior: any; nuevo: any }>(
      "select anterior,nuevo from alexmar.auditoria where tabla='pagos_compra' and operacion='UPDATE' and registro_id=$1",
      [pago],
    );
    assert.equal(audit.rows[0].anterior.monto, 200);
    assert.equal(audit.rows[0].nuevo.monto, 250.123456789);
    assert.equal(audit.rows.at(-1)!.nuevo.anulado, true);
  } finally {
    await db.close();
  }
});
test("órdenes: rechaza datos obsoletos, sobreabonos y permisos; rollback integral si hubo operaciones posteriores", async () => {
  const { db, id, pago, producto } = await instalar();
  try {
    let d = await ficha(db, id);
    const base = {
      compra_id: id,
      id: pago,
      version: d.version,
      accion: "editar",
      monto: "501",
      metodo: "Efectivo",
      motivo: "Corrección sintética",
      revisado: true,
    };
    await assert.rejects(
      () => json(db, "corregir_pago_compra", base),
      /supera/,
    );
    await assert.rejects(
      () =>
        json(db, "corregir_pago_compra", {
          ...base,
          monto: "100",
          revisado: false,
        }),
      /Confirma/,
    );
    for (const [q, k] of [
      ["0", "100"],
      ["-1", "100"],
      ["5.00001", "100"],
      ["5", "-1"],
      ["5", ""],
    ])
      await assert.rejects(() =>
        json(db, "editar_compra", correccion(d, q, k)),
      );
    await assert.rejects(
      () => json(db, "editar_compra", { ...correccion(d), lineas: [] }),
      /líneas/,
    );
    await db.exec(`set app.usuario='${general}'`);
    for (const [n, p] of [
      ["editar_compra", correccion(d)],
      ["corregir_pago_compra", { ...base, monto: "100" }],
    ] as const)
      await assert.rejects(() => json(db, n, p), /permiso|autorizad/i);
    await assert.rejects(
      () =>
        rpc(db, "anular_orden_compra", [id, d.version, "No autorizado", true]),
      /permiso|autorizad/i,
    );
    await db.exec(`set app.usuario='${admin}'`);
    // Nuevos abonos cambian la versión vista por una pestaña antigua.
    await json(db, "pagar_compra", {
      id: randomUUID(),
      compra_id: id,
      monto: "1",
      metodo: "Efectivo",
    });
    await assert.rejects(
      () => json(db, "editar_compra", correccion(d)),
      /cambió/,
    );
    d = await ficha(db, id);
    await db.query(
      "select public.ajustar_stock($1,4,'Salida posterior de prueba','edicion-salida')",
      [producto],
    );
    await assert.rejects(
      () => json(db, "editar_compra", correccion(d, "6", "100")),
      /posteriores/,
    );
    await assert.rejects(
      () =>
        rpc(db, "anular_orden_compra", [
          id,
          d.version,
          "Prueba de rollback",
          true,
        ]),
      /posteriores/,
    );
    let despues = await ficha(db, id);
    assert.equal(despues.estado, "confirmada");
    assert.equal(despues.pagado, "201");
    assert.equal(despues.version, d.version);
    assert.ok(despues.pagos.filas.every((p) => !p.anulado));
    assert.equal(
      (await rpc<{ fisico: string }>(db, "ficha_producto", [producto])).fisico,
      "4",
    );
    // Referencia/observaciones siguen editables sin tocar inventario/costo.
    await json(db, "editar_compra", {
      ...correccion(d),
      referencia: "Referencia corregida",
    });
    despues = await ficha(db, id);
    assert.equal(despues.referencia, "Referencia corregida");
    assert.equal(despues.total, "500");
    await assert.rejects(
      () => rpc(db, "anular_compra", [id, "Intento de saltar versión"]),
      /permission/,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      () => json(db, "editar_compra", correccion(d)),
      /permission/,
    );
  } finally {
    await db.close();
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import type { Compra, ProveedorCompras } from "../src/lib/compras";
const admin = "11111111-1111-4111-8111-111111111111",
  inv = "22222222-2222-4222-8222-222222222222",
  ventas = "33333333-3333-4333-8333-333333333333",
  lectura = "44444444-4444-4444-8444-444444444444",
  cliente = "55555555-5555-4555-8555-555555555555";
async function instalar() {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  for (const [id, rol] of [
    [admin, "administrador"],
    [inv, "inventario"],
    [ventas, "ventas"],
    [lectura, "lectura"],
  ]) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      rol + "@example.com",
    ]);
    await db.query("insert into alexmar.perfiles values($1,$2,$2,true)", [
      id,
      rol,
    ]);
  }
  await db.exec(
    `insert into alexmar.clientes(id,nombre) values('${cliente}','Cliente sintético');set app.usuario='${admin}';set role authenticated;`,
  );
  await db.query("select public.configurar_descuento_stock(true,1)");
  return db;
}
async function rpc<T>(db: PGlite, n: string, p: unknown[] = []) {
  return (
    await db.query<{ r: T }>(
      `select public.${n}(${p.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      p,
    )
  ).rows[0].r;
}
async function prov(db: PGlite, n = "Proveedor de prueba") {
  return rpc<string>(db, "guardar_proveedor", [
    JSON.stringify({ nombre: n, monedas: ["USD"] }),
  ]);
}
async function crear(db: PGlite, n = "Faro de prueba") {
  const id = await rpc<string>(db, "guardar_producto", [
    JSON.stringify({ nombre: n, precio: "150", costo: "60", minimo: "0" }),
  ]);
  const d = await rpc<{ filas: { variante_id: string; id: string }[] }>(
    db,
    "buscar_productos",
    [JSON.stringify({ q: n })],
  );
  return { id, variante: d.filas.find((x) => x.id === id)!.variante_id };
}
const recibir = (db: PGlite, p: unknown) =>
  rpc<string>(db, "recibir_compra", [JSON.stringify(p)]);
const ficha = (db: PGlite, id: string) => rpc<Compra>(db, "ficha_compra", [id]);
const cuenta = (db: PGlite, id: string, p = 1, pp = 1, q = "") =>
  rpc<ProveedorCompras>(db, "ficha_proveedor_compras", [id, p, pp, q]);
test("compras: 5 × 100 = 500, recepción atómica, último costo, venta y cuenta por pagar independientes", async () => {
  const db = await instalar();
  try {
    const proveedor = await prov(db),
      producto = await crear(db);
    await rpc(db, "ajustar_stock", [
      producto.id,
      2,
      "Conteo sintético",
      "stock-compras-prueba",
    ]);
    const p = {
      id: randomUUID(),
      proveedor_id: proveedor,
      moneda: "USD",
      referencia: "FAC-UNO",
      lineas: [
        {
          variante_id: producto.variante,
          cantidad: "5",
          costo_unitario: "100",
        },
      ],
    };
    await recibir(db, p);
    await recibir(db, p);
    let d = await ficha(db, p.id);
    assert.equal(d.total, "500");
    assert.equal(d.saldo, "500");
    assert.equal(d.lineas[0].costo_unitario, "100");
    assert.equal(d.lineas[0].precio_venta, "150");
    let art = await rpc<{ fisico: string; costo: string; precio: string }>(
      db,
      "ficha_producto",
      [producto.id],
    );
    assert.equal(art.fisico, "7");
    assert.equal(art.costo, "100");
    assert.equal(art.precio, "150");
    assert.equal((await cuenta(db, proveedor)).resumen.saldo, "500");
    await assert.rejects(
      () => recibir(db, { ...p, lineas: [{ ...p.lineas[0], cantidad: "6" }] }),
      /otros datos/,
    );
    await assert.rejects(
      () => recibir(db, { ...p, id: randomUUID(), referencia: " fac-uno " }),
      /duplicate key/,
    );
    const nuevoId = randomUUID(),
      pNuevo = {
        id: randomUUID(),
        proveedor_id: proveedor,
        referencia: "STARLINK-PRUEBA",
        lineas: [
          {
            variante_id: null,
            nuevo: {
              id: nuevoId,
              nombre: "Starlink de prueba",
              categoria: "Conectividad",
            },
            cantidad: "5",
            costo_unitario: "100",
          },
        ],
      };
    await recibir(db, pNuevo);
    await recibir(db, pNuevo);
    let star = await rpc<{
      fisico: string;
      costo: string;
      precio: string | null;
    }>(db, "ficha_producto", [nuevoId]);
    assert.equal(star.fisico, "5");
    assert.equal(star.costo, "100");
    assert.equal(star.precio, null);
    assert.equal((await ficha(db, pNuevo.id)).saldo, "500");
    await rpc(db, "asignar_precio_venta", [
      JSON.stringify({ producto_id: nuevoId, precio: "175.1234567" }),
    ]);
    const precioAsignado = await rpc<{
      precio: string;
      costo: string;
      fisico: string;
    }>(db, "ficha_producto", [nuevoId]);
    assert.equal(precioAsignado.precio, "175.1234567");
    assert.equal(precioAsignado.costo, "100");
    assert.equal(precioAsignado.fisico, "5");
    assert.equal((await ficha(db, pNuevo.id)).saldo, "500");

    const antes = (await cuenta(db, proveedor)).resumen.comprado;
    await assert.rejects(
      () =>
        recibir(db, {
          id: randomUUID(),
          proveedor_id: proveedor,
          lineas: [
            {
              variante_id: null,
              nuevo: {
                id: randomUUID(),
                nombre: "No debe crearse",
                categoria: "",
              },
              cantidad: "1",
              costo_unitario: "5",
            },
            { variante_id: randomUUID(), cantidad: "1", costo_unitario: "5" },
          ],
        }),
      /inexistente/,
    );
    assert.equal(
      (
        await rpc<{ total: number }>(db, "buscar_productos", [
          JSON.stringify({ q: "No debe crearse" }),
        ])
      ).total,
      0,
    );
    assert.equal((await cuenta(db, proveedor)).resumen.comprado, antes);
    for (const [cantidad, costo] of [
      ["0", "100"],
      ["-1", "100"],
      ["1", "-1"],
      ["1", ""],
      ["1.00001", "1"],
    ])
      await assert.rejects(() =>
        recibir(db, {
          ...p,
          id: randomUUID(),
          referencia: randomUUID(),
          lineas: [
            { variante_id: producto.variante, cantidad, costo_unitario: costo },
          ],
        }),
      );
    await assert.rejects(
      () =>
        recibir(db, {
          ...p,
          id: randomUUID(),
          referencia: "DOBLE",
          lineas: [p.lineas[0], p.lineas[0]],
        }),
      /Agrupa/,
    );
    const pago = {
      id: randomUUID(),
      compra_id: p.id,
      monto: "200",
      metodo: "Transferencia",
      referencia: "Pago sintético",
    };
    await rpc(db, "pagar_compra", [JSON.stringify(pago)]);
    await rpc(db, "pagar_compra", [JSON.stringify(pago)]);
    assert.equal((await ficha(db, p.id)).saldo, "300");
    assert.equal((await ficha(db, p.id)).pagos.total, 1);
    await assert.rejects(
      () =>
        rpc(db, "pagar_compra", [JSON.stringify({ ...pago, monto: "201" })]),
      /otros datos/,
    );
    await assert.rejects(
      () =>
        rpc(db, "pagar_compra", [
          JSON.stringify({ ...pago, id: randomUUID(), monto: "301" }),
        ]),
      /supera/,
    );
    await rpc(db, "pagar_compra", [
      JSON.stringify({ ...pago, id: randomUUID(), monto: "300" }),
    ]);
    assert.equal((await ficha(db, p.id)).saldo, "0");
    assert.equal(
      (await rpc<{ fisico: string }>(db, "ficha_producto", [producto.id]))
        .fisico,
      "7",
    );
    const segunda = {
      ...p,
      id: randomUUID(),
      referencia: "FAC-DOS",
      lineas: [
        {
          variante_id: producto.variante,
          cantidad: "2",
          costo_unitario: "120",
        },
      ],
    };
    await recibir(db, segunda);
    art = await rpc(db, "ficha_producto", [producto.id]);
    assert.equal(art.costo, "120");
    assert.equal(art.precio, "150");
    assert.equal(art.fisico, "9");
    assert.equal((await ficha(db, p.id)).lineas[0].costo_unitario, "100");
    const venta = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      moneda: "USD",
      lineas: [
        { variante_id: producto.variante, cantidad: "2", precio: "150" },
      ],
      abono: "0",
      descuento: "0",
    };
    await db.exec(`set app.usuario='${ventas}'`);
    await rpc(db, "guardar_venta", [JSON.stringify(venta)]);
    await rpc(db, "emitir_venta", [venta.id, 1]);
    await rpc(db, "emitir_venta", [venta.id, 1]);
    await db.exec(`set app.usuario='${admin}'`);
    assert.equal(
      (await rpc<{ fisico: string }>(db, "ficha_producto", [producto.id]))
        .fisico,
      "7",
    );
    assert.equal((await ficha(db, segunda.id)).saldo, "240");
    const c = await cuenta(db, proveedor);
    assert.equal(c.resumen.saldo, "740");
    assert.equal(
      c.productos.filas.find((a) => a.producto_id === producto.id)
        ?.ultimo_costo,
      "120",
    );
    const proveedor2 = await prov(db, "Proveedor B");
    await recibir(db, {
      id: randomUUID(),
      proveedor_id: proveedor2,
      lineas: [
        {
          variante_id: producto.variante,
          cantidad: "1",
          costo_unitario: "90.123456",
        },
      ],
    });
    assert.equal(
      (await rpc<{ costo: string }>(db, "ficha_producto", [producto.id])).costo,
      "90.123456",
    );
    assert.equal(
      (await cuenta(db, proveedor)).productos.filas.find(
        (a) => a.producto_id === producto.id,
      )?.ultimo_costo,
      "120",
    );
  } finally {
    await db.close();
  }
});
test("compras: anulación con reversión, bloqueo de cambios posteriores/pagos y permisos", async () => {
  const db = await instalar();
  try {
    const proveedor = await prov(db),
      a = await crear(db);
    await rpc(db, "ajustar_stock", [
      a.id,
      3,
      "Conteo sintético",
      "compra-reversa-prueba",
    ]);
    const p = {
      id: randomUUID(),
      proveedor_id: proveedor,
      lineas: [
        { variante_id: a.variante, cantidad: "2", costo_unitario: "75" },
      ],
    };
    await recibir(db, p);
    await rpc(db, "anular_compra", [p.id, "Recepción de prueba incorrecta"]);
    await rpc(db, "anular_compra", [p.id, "Recepción de prueba incorrecta"]);
    let art = await rpc<{ costo: string; fisico: string }>(
      db,
      "ficha_producto",
      [a.id],
    );
    assert.equal(art.costo, "60");
    assert.equal(art.fisico, "3");
    assert.equal((await cuenta(db, proveedor)).resumen.saldo, "0");
    assert.equal((await ficha(db, p.id)).estado, "anulada");
    await recibir(db, p);
    assert.equal(
      (await rpc<{ fisico: string }>(db, "ficha_producto", [a.id])).fisico,
      "3",
    );
    await assert.rejects(
      () =>
        rpc(db, "pagar_compra", [
          JSON.stringify({
            id: randomUUID(),
            compra_id: p.id,
            monto: "1",
            metodo: "Efectivo",
          }),
        ]),
      /disponible/,
    );
    const p2 = { ...p, id: randomUUID() };
    await recibir(db, p2);
    await rpc(db, "ajustar_stock", [
      a.id,
      4,
      "Ajuste de prueba posterior",
      "compra-ajuste-posterior",
    ]);
    await assert.rejects(
      () =>
        rpc(db, "anular_compra", [
          p2.id,
          "Intento de reversión con movimientos",
        ]),
      /posteriores/,
    );
    assert.equal((await ficha(db, p2.id)).saldo, "150");
    const p3 = { ...p, id: randomUUID() };
    await recibir(db, p3);
    await rpc(db, "pagar_compra", [
      JSON.stringify({
        id: randomUUID(),
        compra_id: p3.id,
        monto: "1",
        metodo: "Efectivo",
      }),
    ]);
    await assert.rejects(
      () => rpc(db, "anular_compra", [p3.id, "Reversión con pago de prueba"]),
      /pagos/,
    );
    for (const rol of [ventas, lectura]) {
      await db.exec(`set app.usuario='${rol}'`);
      await assert.rejects(() => cuenta(db, proveedor), /Acceso|permiso/i);
      await assert.rejects(() => ficha(db, p3.id), /Acceso|permiso/i);
      await assert.rejects(
        () => recibir(db, { ...p, id: randomUUID() }),
        /Acceso|permiso/i,
      );
    }
    await db.exec(`set app.usuario='${inv}'`);
    await recibir(db, { ...p, id: randomUUID() });
    await cuenta(db, proveedor);
    await assert.rejects(
      () =>
        rpc(db, "pagar_compra", [
          JSON.stringify({
            id: randomUUID(),
            compra_id: p3.id,
            monto: "1",
            metodo: "Efectivo",
          }),
        ]),
      /permiso|acceso/i,
    );
    await assert.rejects(
      () => rpc(db, "anular_compra", [p3.id, "Intento no autorizado"]),
      /permiso|acceso/i,
    );
    await assert.rejects(
      () => db.query("select * from alexmar.compras"),
      /permission/,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(() => ficha(db, p.id), /permission/);
  } finally {
    await db.close();
  }
});
test("compras: paginación real, totales completos, productos suministrados y decimales exactos", async () => {
  const db = await instalar();
  try {
    const proveedor = await prov(db);
    const l = Array.from({ length: 35 }, (_, i) => ({
      variante_id: null,
      nuevo: {
        id: randomUUID(),
        nombre: "Producto de prueba " + String(i).padStart(2, "0"),
        categoria: "",
      },
      cantidad: "1",
      costo_unitario: "0.1234567",
    }));
    const id = randomUUID();
    await recibir(db, { id, proveedor_id: proveedor, lineas: l });
    const d = await ficha(db, id);
    assert.equal(d.total, "4.3209845");
    const variante = (
      await rpc<{ filas: { variante_id: string }[] }>(db, "buscar_productos", [
        JSON.stringify({ q: "Producto de prueba 00" }),
      ])
    ).filas[0].variante_id;
    for (let n = 0; n < 34; n++)
      await recibir(db, {
        id: randomUUID(),
        proveedor_id: proveedor,
        lineas: [{ variante_id: variante, cantidad: "1", costo_unitario: "1" }],
      });
    const c = await cuenta(db, proveedor);
    assert.equal(c.compras.total, 35);
    assert.equal(c.compras.filas.length, 30);
    assert.equal(c.productos.total, 35);
    assert.equal(c.productos.filas.length, 30);
    assert.equal(c.resumen.comprado, "38.3209845");
    const c2 = await cuenta(db, proveedor, 2, 2);
    assert.equal(c2.compras.filas.length, 5);
    assert.equal(c2.productos.filas.length, 5);
    assert.equal(c2.resumen.comprado, c.resumen.comprado);
    const f = await cuenta(db, proveedor, 1, 1, "prueba 34");
    assert.equal(f.productos.total, 1);
    assert.equal(f.resumen.comprado, c.resumen.comprado);
    const minimo = {
      id: randomUUID(),
      proveedor_id: proveedor,
      lineas: [
        {
          variante_id: variante,
          cantidad: "0.0001",
          costo_unitario: "0." + "0".repeat(79) + "1",
        },
      ],
    };
    await recibir(db, minimo);
    const cm = await ficha(db, minimo.id);
    assert.equal(cm.total, "0." + "0".repeat(83) + "1");
    await rpc(db, "pagar_compra", [
      JSON.stringify({
        id: randomUUID(),
        compra_id: minimo.id,
        monto: cm.total,
        metodo: "Efectivo",
      }),
    ]);
    assert.match((await ficha(db, minimo.id)).saldo, /^0(?:\.0+)?$/);
    for (let n = 0; n < 35; n++)
      await rpc(db, "pagar_compra", [
        JSON.stringify({
          id: randomUUID(),
          compra_id: id,
          monto: "0.01",
          metodo: "Efectivo",
        }),
      ]);
    const detalle = await ficha(db, id);
    assert.equal(detalle.pagos.total, 35);
    assert.equal(detalle.pagos.filas.length, 30);
    assert.equal(detalle.saldo, "3.9709845");
    const ultima = await rpc<Compra>(db, "ficha_compra", [id, 2]);
    assert.equal(ultima.pagos.filas.length, 5);
    assert.equal(ultima.pagado, detalle.pagado);
  } finally {
    await db.close();
  }
});

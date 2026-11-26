import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { numeroFoto, leerTextoFactura } from "../src/lib/lectura-factura";
const admin = "11111111-1111-4111-8111-111111111111",
  general = "33333333-3333-4333-8333-333333333333";
async function rpc(db: PGlite, name: string, args: unknown[] = []) {
  return (
    await db.query<{ r: any }>(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      args,
    )
  ).rows[0].r;
}
const json = (db: PGlite, name: string, p: unknown) =>
  rpc(db, name, [JSON.stringify(p)]);
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
    `insert into auth.users values('${admin}','admin@example.com'),('${general}','general@example.com');insert into alexmar.perfiles values('${admin}','Admin sintético','administrador',true),('${general}','General sintético','lectura',true);set app.usuario='${admin}';set role authenticated;`,
  );
  return db;
}
test("directorios: búsqueda por fragmentos y aproximada, edición, retirada con saldo cero sin perder historia, General denegado", async () => {
  const db = await instalar();
  try {
    const id = await json(db, "guardar_cliente", {
      nombre: "José Pérez",
      documento: "DEMO",
      telefono: "123",
      direccion: "Demo",
    });
    const otro = await json(db, "guardar_cliente", { nombre: "Joser Pérez" });
    assert.equal((await json(db, "buscar_clientes", { q: "JO pe" })).total, 2);
    assert.equal(
      (await json(db, "buscar_clientes", { q: "jose" })).filas[0].id,
      id,
    );
    assert.equal(
      (await json(db, "buscar_clientes", { q: "jose perez" })).filas[0].id,
      id,
    );
    const cercano = await json(db, "buscar_clientes", { q: "jose perezz" });
    assert.ok(cercano.filas.some((x: any) => x.id === id));
    await json(db, "editar_cliente", {
      id,
      nombre: "José Pérez Demo",
      telefono: "456",
      documento: "RIF DEMO",
      direccion: "Dirección demo",
    });
    assert.equal(
      (await json(db, "buscar_clientes", { q: "456" })).filas[0].documento,
      "RIF DEMO",
    );
    await db.exec(
      `reset role;insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto) values('${id}','CARGO',now(),'Prueba','VES',0.00000000000001);set role authenticated;`,
    );
    await assert.rejects(
      () => json(db, "retirar_cliente", { id }),
      /saldo pendiente/,
    );
    await db.exec(
      `reset role;insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto) values('${id}','ABONO',now(),'Prueba','VES',0.00000000000001);set role authenticated;`,
    );
    await json(db, "retirar_cliente", { id });
    assert.equal((await json(db, "buscar_clientes", { q: "456" })).total, 0);
    assert.equal(
      (await rpc(db, "estado_cliente", [id, null, null, 1, "VES"])).total,
      2,
    );
    const prov = await json(db, "guardar_proveedor", {
      nombre: "Proveedor demo",
      monedas: ["USD"],
    });
    await json(db, "retirar_proveedor", { id: prov });
    assert.equal(
      (await json(db, "buscar_proveedores", { q: "Proveedor demo" })).total,
      0,
    );
    await db.exec(`set app.usuario='${general}';`);
    for (const [name, p] of [
      ["editar_cliente", { id, nombre: "Prohibido" }],
      ["retirar_cliente", { id: otro }],
      ["retirar_proveedor", { id: prov }],
      ["mover_existencia", {}],
      ["registrar_producto_pendiente", {}],
    ] as const)
      await assert.rejects(() => json(db, name, p), /permiso/);
    await assert.rejects(() => rpc(db, "kardex", [randomUUID()]), /permiso/);
  } finally {
    await db.close();
  }
});
test("existencias: delta idempotente, reservas, antes/después, venta real y anulación sin doble descuento", async () => {
  const db = await instalar();
  try {
    const product = await json(db, "crear_producto_venta", {
      id: randomUUID(),
      nombre: "Faro demo",
      precio: "7.123456789",
      categoria: "Demo",
    });
    const mov = {
      id: product.id,
      clave: randomUUID(),
      tipo: "entrada",
      cantidad: "5",
      motivo: "Ingreso de cinco unidades",
    };
    await json(db, "mover_existencia", mov);
    await json(db, "mover_existencia", mov);
    await assert.rejects(
      () => json(db, "mover_existencia", { ...mov, cantidad: "6" }),
      /otros datos/,
    );
    await assert.rejects(
      () =>
        json(db, "mover_existencia", {
          ...mov,
          clave: randomUUID(),
          tipo: null,
          cantidad: "100",
        }),
      /entrada o salida/,
    );
    await assert.rejects(
      () =>
        json(db, "mover_existencia", {
          ...mov,
          clave: randomUUID(),
          cantidad: "0.00001",
        }),
      /cuatro decimales/,
    );
    await db.exec(
      `reset role;insert into alexmar.reservas(variante_id,cantidad,estado,referencia) values('${product.variante_id}',2,'activa','Prueba');set role authenticated;`,
    );
    await assert.rejects(
      () =>
        json(db, "mover_existencia", {
          ...mov,
          clave: randomUUID(),
          tipo: "salida",
          cantidad: "4",
        }),
      /suficientes/,
    );
    await json(db, "mover_existencia", {
      ...mov,
      clave: randomUUID(),
      tipo: "salida",
      cantidad: "1",
      motivo: "Retiro por pieza dañada",
    });
    let k = await rpc(db, "kardex", [product.id]);
    assert.equal(k.total, 2);
    assert.equal(k.filas[0].antes, "5");
    assert.equal(k.filas[0].saldo, "4");
    assert.equal(k.filas[0].usuario, "Admin sintético");
    await db.exec(
      `reset role;update alexmar.configuracion_comercial set descontar_stock=true where id=1;set role authenticated;`,
    );
    const venta = {
      id: randomUUID(),
      version: 0,
      cliente_id: null,
      condicion: "contado",
      abono: "7.123456789",
      metodo_pago: "Binance",
      lineas: [
        {
          variante_id: product.variante_id,
          cantidad: "1",
          precio: "7.123456789",
          descripcion: "Faro demo",
          clase_linea: "producto",
          precio_personalizado: true,
        },
      ],
    };
    await json(db, "emitir_factura_rapida", venta);
    await json(db, "emitir_factura_rapida", venta);
    k = await rpc(db, "kardex", [product.id]);
    assert.equal(k.total, 3);
    assert.equal(k.filas[0].saldo, "3");
    assert.equal(k.filas[0].venta_id, venta.id);
    assert.equal(
      (await json(db, "buscar_ventas", { estado: "vigentes" })).resumen
        .facturado,
      "7.123456789",
    );
    const doc = await rpc(db, "ficha_venta", [venta.id]);
    await rpc(db, "anular_factura_revisada", [
      venta.id,
      doc.version,
      "Prueba sin venta real",
      true,
    ]);
    assert.equal((await rpc(db, "kardex", [product.id])).filas[0].saldo, "4");
    assert.equal(
      (await json(db, "buscar_ventas", { estado: "vigentes" })).total,
      0,
    );
  } finally {
    await db.close();
  }
});
test("pendientes: alta con stock real después de venta, costo opcional, reintento y cancelación respetan modo original", async () => {
  const db = await instalar();
  try {
    for (const descuento of [false, true]) {
      await db.exec(
        `reset role;update alexmar.configuracion_comercial set descontar_stock=${descuento} where id=1;set role authenticated;`,
      );
      const venta = {
        id: randomUUID(),
        version: 0,
        cliente_id: null,
        condicion: "contado",
        abono: "30",
        metodo_pago: "Zelle",
        lineas: [
          {
            variante_id: null,
            descripcion: "Pieza demo " + descuento,
            cantidad: "3",
            precio: "10",
            clase_linea: "producto_pendiente",
          },
        ],
      };
      await json(db, "emitir_factura_rapida", venta);
      const doc = await rpc(db, "ficha_venta", [venta.id]),
        linea = doc.lineas[0].id;
      const alta = {
        linea,
        nombre: "Pieza demo " + descuento,
        stock: "5",
        precio: "12",
        costo: "",
        categoria: "Demo",
        referencia: "",
      };
      const id = await json(db, "registrar_producto_pendiente", alta);
      assert.equal(await json(db, "registrar_producto_pendiente", alta), id);
      await assert.rejects(
        () => json(db, "registrar_producto_pendiente", { ...alta, stock: "6" }),
        /otros datos/,
      );
      let k = await rpc(db, "kardex", [id]);
      assert.equal(k.filas[0].saldo, "5");
      assert.equal(k.total, descuento ? 2 : 1);
      assert.equal((await rpc(db, "ficha_producto", [id])).costo, null);
      const nuevoDoc = await rpc(db, "ficha_venta", [venta.id]);
      assert.equal(nuevoDoc.total, "30");
      assert.equal(nuevoDoc.lineas[0].precio, "10");
      await rpc(db, "anular_factura_revisada", [
        venta.id,
        nuevoDoc.version,
        "Prueba sin venta real",
        true,
      ]);
      k = await rpc(db, "kardex", [id]);
      assert.equal(k.filas[0].saldo, descuento ? "8" : "5");
    }
  } finally {
    await db.close();
  }
});
test("foto de proveedor: confirmación atómica, recepción única, acceso privado, deuda y saldo antes de retirar", async () => {
  const db = await instalar();
  try {
    const prov = await json(db, "guardar_proveedor", {
      nombre: "Proveedor foto demo",
      monedas: ["USD"],
    });
    const p = {
      id: randomUUID(),
      proveedor_id: prov,
      moneda: "USD",
      referencia: "DEMO-1",
      lineas: [
        {
          variante_id: null,
          nuevo: {
            id: randomUUID(),
            nombre: "Pieza de foto demo",
            categoria: "Demo",
          },
          cantidad: "5",
          costo_unitario: "100",
        },
      ],
      foto: {
        nombre: "prueba.jpg",
        mime: "image/jpeg",
        base64: Buffer.from([255, 216, 255, 224, 0, 0, 255, 217]).toString(
          "base64",
        ),
      },
    };
    await json(db, "recibir_compra_con_foto", p);
    await json(db, "recibir_compra_con_foto", p);
    const compra = await rpc(db, "ficha_compra", [p.id]);
    assert.equal(compra.total, "500");
    assert.equal(compra.tiene_foto, true);
    assert.equal(
      (await rpc(db, "leer_foto_compra", [p.id])).base64.replace(/\s/g, ""),
      p.foto.base64,
    );
    assert.equal(
      (await rpc(db, "ficha_producto", [p.lineas[0].nuevo.id])).fisico,
      "5",
    );
    assert.equal(
      (await rpc(db, "ficha_producto", [p.lineas[0].nuevo.id])).precio,
      null,
    );
    await assert.rejects(
      () => json(db, "retirar_proveedor", { id: prov }),
      /saldo pendiente/,
    );
    await assert.rejects(
      () =>
        json(db, "recibir_compra_con_foto", {
          ...p,
          foto: {
            ...p.foto,
            base64: Buffer.from([255, 216, 255, 224, 1, 0, 255, 217]).toString(
              "base64",
            ),
          },
        }),
      /otra foto/,
    );
    const invalid = {
      ...p,
      id: randomUUID(),
      referencia: "DEMO-2",
      foto: { ...p.foto, base64: "aW52YWxpZG8=" },
    };
    await assert.rejects(
      () => json(db, "recibir_compra_con_foto", invalid),
      /JPEG inválida/,
    );
    assert.equal(await rpc(db, "ficha_compra", [invalid.id]), null);
    await db.exec(`set app.usuario='${general}';`);
    await assert.rejects(() => rpc(db, "leer_foto_compra", [p.id]), /permiso/);
    await assert.rejects(
      () => db.query("select * from alexmar.fotos_compra"),
      /permission denied/,
    );
    await db.exec(`reset role;`);
    const log = await db.query<{ nuevo: any }>(
      "select nuevo from alexmar.auditoria where tabla='fotos_compra'",
    );
    assert.ok(log.rows.every((r) => !("contenido" in r.nuevo)));
  } finally {
    await db.close();
  }
});
test("lectura de factura: números ambiguos vacíos, decimales exactos, filas y total contrastables", () => {
  assert.equal(numeroFoto("1.000"), null);
  assert.equal(numeroFoto("1.234,56"), "1234.56");
  assert.equal(numeroFoto("1,234.56"), "1234.56");
  assert.equal(numeroFoto("0"), "0");
  assert.equal(numeroFoto("1O0"), null);
  const r = leerTextoFactura(
    "FACTURA DEMO\nCantidad Descripción Unitario Total\n5 FARO DEMO 100,00 500,00\nFILTRO DEMO 2 20.50 41.00\nTOTAL 541,00",
  );
  assert.equal(r.filas.length, 2);
  assert.equal(r.total, "541");
  assert.equal(r.filas[1].costo, "20.5");
  const ambiguo = leerTextoFactura("2 FARO 1.000 2.000");
  assert.equal(ambiguo.filas[0].costo, "");
  assert.ok(ambiguo.filas[0].aviso);
});

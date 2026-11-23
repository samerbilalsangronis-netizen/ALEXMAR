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
test("rápida: contado sin cuenta, 15 productos en una emisión, servicios sin cola, totales y reintentos", async () => {
  const db = await instalar();
  try {
    const filas = Array.from({ length: 15 }, (_, i) => ({
      variante_id: null,
      descripcion: "Producto sintético " + i,
      cantidad: "2",
      precio: "3.123456789",
      clase_linea: i === 14 ? "servicio" : "producto_pendiente",
    }));
    const p = {
      id: randomUUID(),
      version: 0,
      cliente_id: null,
      cliente_contado: { nombre: "Comprador de contado", documento: "DEMO" },
      condicion: "contado",
      descuento: "0",
      abono: "93.703703670",
      metodo_pago: "Zelle",
      lineas: filas,
    };
    await json(db, "emitir_factura_rapida", p);
    await json(db, "emitir_factura_rapida", p);
    let d = await rpc(db, "ficha_venta", [p.id]);
    assert.equal(d.cliente_id, null);
    assert.equal(d.cliente.nombre, "Comprador de contado");
    assert.equal(d.total, "93.703703670");
    assert.equal(d.pagado, "93.703703670");
    assert.equal(d.lineas.length, 15);
    assert.equal((await rpc(db, "listar_productos_sin_cargar")).total, 14);
    const lista = await json(db, "buscar_ventas", {
      q: "Comprador de contado",
    });
    assert.equal(lista.total, 1);
    assert.equal((await json(db, "buscar_ventas", { q: "DEMO" })).total, 1);
    assert.equal(lista.resumen.facturado, d.total);
    assert.equal((await rpc(db, "estado_cliente", [cliente])).final, "0");
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from alexmar.clientes",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from alexmar.movimientos_cuenta",
        )
      ).rows[0].n,
      0,
    );
    await db.exec("set role authenticated");
    await rpc(db, "anular_factura_revisada", [
      p.id,
      d.version,
      "Prueba sin venta real",
      true,
    ]);
    assert.equal((await rpc(db, "listar_productos_sin_cargar")).total, 0);
    assert.equal((await rpc(db, "ficha_venta", [p.id])).estado, "anulada");
    await assert.rejects(
      () =>
        json(db, "emitir_factura_rapida", {
          ...p,
          id: randomUUID(),
          condicion: "credito",
          abono: "0",
        }),
      /crédito requiere/,
    );
  } finally {
    await db.close();
  }
});
test("rápida: crédito, vinculación pendiente y anulación conservan precio y stock real, sin dobles movimientos", async () => {
  const db = await instalar();
  try {
    const a = await json(db, "crear_producto_venta", {
      id: randomUUID(),
      nombre: "Artículo sintético",
      precio: "60",
    });
    await rpc(db, "ajustar_stock", [
      a.id,
      "10",
      "Conteo sintético",
      "rapida-conteo",
    ]);
    await rpc(db, "configurar_descuento_stock", [true, 1]);
    const p = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      condicion: "credito",
      descuento: "0",
      abono: "0",
      lineas: [
        {
          variante_id: a.variante_id,
          cantidad: "2",
          precio: "70",
          precio_personalizado: true,
          clase_linea: "producto",
        },
        {
          variante_id: null,
          descripcion: "Pieza escrita de prueba",
          cantidad: "3",
          precio: "40",
          clase_linea: "producto_pendiente",
        },
        {
          variante_id: null,
          descripcion: "Otra pieza",
          cantidad: "1",
          precio: "10",
          clase_linea: "producto_pendiente",
        },
        {
          variante_id: null,
          descripcion: "Instalación",
          cantidad: "1",
          precio: "5",
          clase_linea: "servicio",
        },
      ],
    };
    await json(db, "emitir_factura_rapida", p);
    assert.equal((await rpc(db, "estado_cliente", [cliente])).final, "275");
    assert.equal((await rpc(db, "ficha_producto", [a.id])).fisico, "8");
    const cola = await rpc(db, "listar_productos_sin_cargar");
    assert.equal(cola.total, 2);
    for (const l of cola.filas) {
      await rpc(db, "vincular_producto_pendiente", [l.linea_id, a.variante_id]);
      await rpc(db, "vincular_producto_pendiente", [l.linea_id, a.variante_id]);
    }
    assert.equal((await rpc(db, "ficha_producto", [a.id])).fisico, "4");
    assert.equal((await rpc(db, "ficha_producto", [a.id])).precio, "60");
    assert.equal((await rpc(db, "estado_cliente", [cliente])).final, "275");
    const d = await rpc(db, "ficha_venta", [p.id]);
    assert.equal(d.lineas[1].precio, "40");
    assert.equal((await rpc(db, "listar_productos_sin_cargar")).total, 0);
    await rpc(db, "anular_factura_revisada", [
      p.id,
      d.version,
      "Anulación de prueba",
      false,
    ]);
    assert.equal((await rpc(db, "ficha_producto", [a.id])).fisico, "10");
    assert.equal((await rpc(db, "estado_cliente", [cliente])).final, "0");
  } finally {
    await db.close();
  }
});
test("rápida: rollback por dato inválido y permisos; factura sin descuento no descuenta después al vincular", async () => {
  const db = await instalar();
  try {
    const p = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      condicion: "credito",
      descuento: "0",
      abono: "0",
      lineas: [
        {
          variante_id: null,
          descripcion: "Producto diferido",
          cantidad: "1",
          precio: "10",
          clase_linea: "producto_pendiente",
        },
      ],
    };
    await assert.rejects(() =>
      json(db, "emitir_factura_rapida", {
        ...p,
        lineas: [p.lineas[0], { ...p.lineas[0], precio: "-1" }],
      }),
    );
    assert.equal((await rpc(db, "listar_productos_sin_cargar")).total, 0);
    await assert.rejects(
      () => json(db, "emitir_factura_rapida", { ...p, descuento: "1" }),
      /no utiliza descuentos/,
    );
    await json(db, "emitir_factura_rapida", p);
    const l = (await rpc(db, "listar_productos_sin_cargar")).filas[0];
    const a = await json(db, "crear_producto_venta", {
      id: randomUUID(),
      nombre: "Producto sin stock",
      precio: "15",
    });
    await rpc(db, "configurar_descuento_stock", [true, 1]);
    await rpc(db, "vincular_producto_pendiente", [l.linea_id, a.variante_id]);
    assert.equal((await rpc(db, "ficha_producto", [a.id])).fisico, "0");
    const faltante = { ...p, id: randomUUID() };
    await json(db, "emitir_factura_rapida", faltante);
    const pendiente = (await rpc(db, "listar_productos_sin_cargar")).filas[0];
    await assert.rejects(
      () =>
        rpc(db, "vincular_producto_pendiente", [
          pendiente.linea_id,
          a.variante_id,
        ]),
      /recepción o conteo/,
    );
    assert.equal((await rpc(db, "listar_productos_sin_cargar")).total, 1);
    assert.equal((await rpc(db, "ficha_producto", [a.id])).fisico, "0");
    await db.exec(`set app.usuario='${general}'`);
    await assert.rejects(
      () => json(db, "emitir_factura_rapida", { ...p, id: randomUUID() }),
      /permiso|autorizad/i,
    );
    await assert.rejects(
      () => rpc(db, "listar_productos_sin_cargar"),
      /permiso|autorizad/i,
    );
    await assert.rejects(
      () => rpc(db, "vincular_producto_pendiente", [l.linea_id, a.variante_id]),
      /permiso|autorizad/i,
    );
  } finally {
    await db.close();
  }
});

import {
  lineasRapidas,
  totalRapido,
  type FilaRapida,
} from "../src/lib/venta-rapida";
test("tabla rápida: ignora filas vacías, conserva número de fila en errores y valida importes exactos", () => {
  const fs: FilaRapida[] = Array.from({ length: 15 }, (_, i) => ({
    clave: String(i),
    descripcion: "",
    cantidad: "1",
    precio: "",
    variante_id: null,
    tipo: "producto",
  }));
  fs[9] = {
    ...fs[9],
    descripcion: "Pieza de prueba",
    cantidad: "3",
    precio: "70",
  };
  assert.equal(totalRapido(lineasRapidas(fs)), "210");
  assert.equal(lineasRapidas(fs)[0].clase_linea, "producto_pendiente");
  fs[9].precio = "";
  assert.throws(() => lineasRapidas(fs), /Fila 10/);
  fs[9].precio = "0.123456789";
  assert.equal(totalRapido(lineasRapidas(fs)), "0.370370367");
  fs[9].cantidad = "1.00001";
  assert.throws(() => lineasRapidas(fs), /Fila 10.*cantidad/);
});

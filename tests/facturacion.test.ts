import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
const admin = "11111111-1111-4111-8111-111111111111",
  ventas = "22222222-2222-4222-8222-222222222222",
  inventario = "33333333-3333-4333-8333-333333333333",
  lectura = "44444444-4444-4444-8444-444444444444",
  cliente = "55555555-5555-4555-8555-555555555555";
test("facturación: borrador, emisión atómica, pago parcial, reintentos, anulación y permisos", async () => {
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
      `insert into auth.users values('${admin}','admin@example.com'),('${ventas}','ventas@example.com'),('${inventario}','inv@example.com'),('${lectura}','lectura@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${ventas}','Ventas','ventas',true),('${inventario}','Inventario','inventario',true),('${lectura}','Lectura','lectura',true);insert into alexmar.clientes(id,nombre) values('${cliente}','Cliente sintético');set app.usuario='${admin}';set role authenticated;`,
    );
    const producto = (
      await db.query<{ id: string }>(
        `select public.guardar_producto('{"nombre":"Pieza de prueba","precio":"12.3456","costo":"5","minimo":"0"}') id`,
      )
    ).rows[0].id;
    const vid = (
      await db.query<{ r: { filas: { variante_id: string }[] } }>(
        "select public.buscar_productos('{}') r",
      )
    ).rows[0];
    const variante = vid.r.filas[0].variante_id;
    await db.query(
      "select public.ajustar_stock($1,5,'Conteo prueba','factura-stock-inicial')",
      [producto],
    );
    await db.exec("reset role");
    await db.query(
      "insert into alexmar.reservas(variante_id,cantidad,estado,referencia) values($1,1,'activa','Prueba')",
      [variante],
    );
    await db.exec("set role authenticated");
    const id = "66666666-6666-4666-8666-666666666666";
    const p = {
      id,
      version: 0,
      cliente_id: cliente,
      moneda: "USD",
      tipo: "presupuesto",
      impuesto_tasa: "0",
      lineas: [
        {
          variante_id: variante,
          descripcion: "Ignorar nombre enviado",
          cantidad: "1.25",
          precio: "12.3456",
        },
        { variante_id: variante, cantidad: "0.75", precio: "12.3456" },
        {
          variante_id: null,
          descripcion: "Instalación sintética",
          cantidad: "2",
          precio: "3.5",
        },
      ],
      descuento: "1.6912",
      abono: "10",
      metodo_pago: "Transferencia",
      observaciones: "Prueba",
      permite_gratis: false,
    };
    const guardar = (p: unknown) =>
      db.query<{ id: string }>("select public.guardar_venta($1) id", [
        JSON.stringify(p),
      ]);
    const ficha = async (id: string) =>
      (
        await db.query<{
          r: {
            estado: string;
            numero: number | null;
            tipo: string;
            version: number;
            subtotal: string;
            total: string;
            cliente: { nombre: string };
            lineas: { descripcion: string }[];
            pagos: unknown[];
          };
        }>("select public.ficha_venta($1) r", [id])
      ).rows[0].r;
    const emitir = (id: string, version: number) =>
      db.query("select public.emitir_venta($1,$2)", [id, version]);
    const stock = async () =>
      (
        await db.query<{ r: { fisico: string } }>(
          "select public.ficha_producto($1) r",
          [producto],
        )
      ).rows[0].r.fisico;
    await guardar(p);
    await guardar(p);
    let doc = await ficha(id);
    assert.equal(doc.version, 1);
    assert.equal(doc.estado, "borrador");
    assert.equal(doc.tipo, "presupuesto");
    assert.equal(doc.subtotal, "31.691200");
    assert.equal(doc.total, "30.000000");
    assert.equal(await stock(), "5");
    assert.equal(doc.pagos.length, 0);
    assert.equal(doc.lineas[0].descripcion, "Pieza de prueba");
    await assert.rejects(
      guardar({ ...p, observaciones: "Cambio sin versión" }),
      /cambió/,
    );
    await guardar({ ...p, version: 1, observaciones: "Revisado" });
    doc = await ficha(id);
    assert.equal(doc.version, 2);
    await assert.rejects(emitir(id, 1), /cambió/);
    assert.equal(await stock(), "5");
    await emitir(id, 2);
    doc = await ficha(id);
    assert.equal(doc.estado, "confirmada");
    assert.equal(doc.tipo, "factura");
    assert.equal(doc.numero, 1);
    assert.equal(doc.pagos.length, 1);
    assert.equal(await stock(), "3.00");
    await emitir(id, 2);
    assert.equal((await ficha(id)).pagos.length, 1);
    assert.equal(await stock(), "3.00");
    await assert.rejects(guardar(p), /emitida/);
    await db.exec("reset role");
    const movimientos = async () =>
      (
        await db.query<{ saldo: string; n: number }>(
          "select coalesce(sum(case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end),0)::text saldo,count(*)::int n from alexmar.movimientos_cuenta where venta_id=$1",
          [id],
        )
      ).rows[0];
    assert.equal((await movimientos()).saldo, "20.000000");
    assert.equal((await movimientos()).n, 2);
    await db.query("update alexmar.clientes set nombre=$1 where id=$2", [
      "Cliente renombrado",
      cliente,
    ]);
    await db.exec("set role authenticated");
    assert.equal((await ficha(id)).cliente.nombre, "Cliente sintético");
    await assert.rejects(
      db.query("select public.anular_venta($1,'Prueba de reversión',false)", [
        id,
      ]),
      /reembolso/,
    );
    assert.equal(await stock(), "3.00");
    await db.query(
      "select public.anular_venta($1,'Prueba de reversión',true)",
      [id],
    );
    await db.query("select public.anular_venta($1,'Reintento',true)", [id]);
    assert.equal(await stock(), "5.00");
    assert.equal((await ficha(id)).estado, "anulada");
    await db.exec("reset role");
    assert.equal((await movimientos()).saldo, "0.000000");
    assert.equal((await movimientos()).n, 4);
    assert.equal(
      (
        await db.query<{ n: number; s: string }>(
          "select count(*)::int n,sum(monto)::text s from alexmar.pagos_venta where venta_id=$1",
          [id],
        )
      ).rows[0].n,
      2,
    );
    await db.exec(`set app.usuario='${ventas}';set role authenticated;`);
    const libre = {
      ...p,
      id: "77777777-7777-4777-8777-777777777777",
      tipo: "factura",
      lineas: [
        {
          variante_id: variante,
          descripcion: "Pieza",
          cantidad: "3",
          precio: "12.3456",
        },
      ],
      descuento: "0",
      abono: "0",
      metodo_pago: "",
    };
    await assert.rejects(
      guardar({ ...libre, impuesto_tasa: "16" }),
      /impuesto/,
    );
    await assert.rejects(guardar({ ...libre, descuento: "1" }), /descuentos/);
    await assert.rejects(
      guardar({ ...libre, lineas: [{ ...libre.lineas[0], precio: "1" }] }),
      /precio/,
    );
    await assert.rejects(
      guardar({ ...libre, permite_gratis: true }),
      /gratuitas/,
    );
    await assert.rejects(
      guardar({ ...libre, abono: "100", metodo_pago: "Efectivo" }),
      /supera/,
    );
    const segunda = { ...libre, id: "88888888-8888-4888-8888-888888888888" };
    await guardar(libre);
    await guardar(segunda);
    await emitir(libre.id, 1);
    assert.equal(await stock(), "2.00");
    await assert.rejects(emitir(segunda.id, 1), /insuficiente/);
    assert.equal((await ficha(segunda.id)).estado, "borrador");
    assert.equal((await ficha(segunda.id)).numero, null);
    assert.equal(await stock(), "2.00");
    await assert.rejects(
      db.query("select public.anular_venta($1,'No autorizado',true)", [
        libre.id,
      ]),
      /permiso/,
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from alexmar.movimientos_cuenta where venta_id=$1",
          [segunda.id],
        )
      ).rows[0].n,
      0,
    );
    await db.query(
      `insert into alexmar.ventas(id,cliente_id,tipo,permite_gratis,firma,usuario_id) select gen_random_uuid(),$1,'presupuesto',true,'fixture',$2 from generate_series(1,1051)`,
      [cliente, admin],
    );
    const n = (
      await db.query<{ n: number }>(
        "select count(*)::int n from alexmar.ventas",
      )
    ).rows[0].n;
    await db.exec("set role authenticated");
    const ult = (
      await db.query<{ r: { total: number; filas: unknown[] } }>(
        "select public.buscar_ventas($1) r",
        [JSON.stringify({ pagina: Math.ceil(n / 30) })],
      )
    ).rows[0].r;
    assert.equal(ult.total, n);
    assert.equal(ult.filas.length, n % 30 || 30);
    for (const user of [inventario, lectura]) {
      await db.exec(`set app.usuario='${user}'`);
      await assert.rejects(ficha(id), /permiso/);
      await assert.rejects(guardar(libre), /permiso/);
      await assert.rejects(emitir(segunda.id, 1), /permiso/);
      await assert.rejects(
        db.query("select * from alexmar.ventas"),
        /permission denied/,
      );
    }
    await db.exec(
      `reset role;update alexmar.perfiles set activo=false where id='${ventas}';set app.usuario='${ventas}';set role authenticated;`,
    );
    await assert.rejects(ficha(id), /permiso/);
    await db.exec("set role anon");
    await assert.rejects(ficha(id), /permission denied/);
  } finally {
    await db.close();
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
const admin = "11111111-1111-4111-8111-111111111111",
  cliente = "55555555-5555-4555-8555-555555555555";
test("facturación rápida sin SQL 007: emisión, saldo, cobros, historia separada y totales globales", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter(
        (f) =>
          f.endsWith(".sql") && !f.includes("000700") && !f.includes("001100"),
      )
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.com');insert into alexmar.perfiles values('${admin}','Administrador','administrador',true);insert into alexmar.clientes(id,nombre)values('${cliente}','Cliente sintético');set app.usuario='${admin}';set role authenticated;`,
    );
    const rpc = async (name: string, p: unknown) =>
      (
        await db.query<{ r: any }>("select public." + name + "($1) r", [
          JSON.stringify(p),
        ])
      ).rows[0].r;
    const ficha = async (id: string) =>
      (await db.query<{ r: any }>("select public.ficha_venta($1) r", [id]))
        .rows[0].r;
    // Actualizar una instalación con documentos: los importes y movimientos no cambian.
    const previo = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      lineas: [
        {
          variante_id: null,
          descripcion: "Servicio previo a 011",
          cantidad: "1",
          precio: "20",
        },
      ],
      abono: "20",
      metodo_pago: "Efectivo",
    };
    await rpc("guardar_venta", previo);
    await db.exec("reset role;set app.usuario='';");
    await db.exec(
      await readFile(
        "supabase/migrations/20261122001100_facturacion_clientes.sql",
        "utf8",
      ),
    );
    await db.exec(`set app.usuario='${admin}';set role authenticated;`);
    const antiguo = await ficha(previo.id);
    assert.equal(Number(antiguo.total), 20);
    assert.equal(Number(antiguo.abono), 20);
    assert.equal(antiguo.condicion, "contado");
    assert.equal(antiguo.estado, "borrador");
    assert.equal(antiguo.pagos.length, 0);
    assert.equal(
      (
        await db.query<{ r: { version: number } }>(
          "select public.configuracion_facturacion() r",
        )
      ).rows[0].r.version,
      11,
    );
    const producto = await rpc("guardar_producto", {
      nombre: "Filtro Toyota sintético",
      precio: "12.5",
      costo: "8",
      minimo: "0",
    });
    const variante = (await rpc("buscar_productos", {})).filas[0].variante_id;
    await db.query(
      "select public.ajustar_stock($1,100,'Prueba de recepción','facturas-prueba-stock')",
      [producto],
    );
    const p = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      condicion: "contado",
      lineas: [{ variante_id: variante, cantidad: "2", precio: "12.5" }],
      abono: "25",
      metodo_pago: "Efectivo",
    };
    await rpc("guardar_borrador_factura", p);
    await rpc("emitir_factura", p);
    await rpc("emitir_factura", p);
    let doc = await ficha(p.id);
    assert.equal(doc.pagos.length, 1);
    assert.equal(Number(doc.saldo), 0);
    assert.equal(doc.condicion, "contado");
    await assert.rejects(
      rpc("emitir_factura", { ...p, abono: "0" }),
      /otro contenido/,
    );
    await assert.rejects(
      rpc("emitir_factura", { ...p, id: randomUUID(), abono: "0" }),
      /contado/,
    );
    await assert.rejects(
      rpc("emitir_factura", {
        ...p,
        id: randomUUID(),
        abono: "20",
        lineas: [{ variante_id: variante, cantidad: "2", precio: "10" }],
      }),
      /catálogo/,
    );
    await assert.rejects(
      rpc("emitir_factura", {
        ...p,
        id: randomUUID(),
        abono: "2500",
        lineas: [{ variante_id: variante, cantidad: "200", precio: "12.5" }],
      }),
      /insuficiente/,
    );
    assert.equal(
      (await rpc("buscar_ventas", {})).total,
      2,
      "Emisiones fallidas no dejan borradores",
    );
    const credito = {
      ...p,
      id: randomUUID(),
      condicion: "credito",
      abono: "5",
    };
    await rpc("emitir_factura", credito);
    doc = await ficha(credito.id);
    assert.equal(Number(doc.saldo), 20);
    const pago = {
      id: credito.id,
      idempotencia: randomUUID(),
      monto: "7.1",
      metodo: "Transferencia",
    };
    await rpc("cobrar_factura", pago);
    await rpc("cobrar_factura", pago);
    doc = await ficha(credito.id);
    assert.equal(Number(doc.pagado), 12.1);
    assert.equal(Number(doc.saldo), 12.9);
    assert.equal(doc.pagos.length, 2);
    await assert.rejects(
      rpc("cobrar_factura", { ...pago, monto: "8" }),
      /otros datos/,
    );
    await assert.rejects(
      rpc("cobrar_factura", {
        ...pago,
        idempotencia: randomUUID(),
        monto: "13",
      }),
      /supera/,
    );
    const stockTrasCobrar = (
      await db.query<{ r: { fisico: string } }>(
        "select public.ficha_producto($1) r",
        [producto],
      )
    ).rows[0].r.fisico;
    assert.equal(Number(stockTrasCobrar), 96);
    const versionAntes = doc.version;
    await rpc("cobrar_factura", {
      ...pago,
      idempotencia: randomUUID(),
      monto: "12.9",
    });
    await assert.rejects(
      db.query(
        "select public.anular_factura_revisada($1,$2,'Devolución prueba',true)",
        [credito.id, versionAntes],
      ),
      /cambió/,
    );
    doc = await ficha(credito.id);
    assert.equal(Number(doc.saldo), 0);
    assert.equal(doc.condicion, "credito");
    await assert.rejects(
      db.query("select public.anular_venta($1,'Devolución prueba',false)", [
        credito.id,
      ]),
      /reembolso/,
    );
    await db.query(
      "select public.anular_factura_revisada($1,$2,'Devolución prueba',true)",
      [credito.id, doc.version],
    );
    assert.equal(Number((await ficha(credito.id)).pagado), 0);
    await db.exec("reset role");
    const viejo = randomUUID();
    await db.query(
      `insert into alexmar.movimientos_cuenta(id,cliente_id,tipo,fecha,descripcion,moneda,monto,origen,datos_originales)values($1,$2,'CARGO','2026-11-01','Faro Toyota original','USD',100,'supabase_anterior','{"cantidad":"5","precio_unitario":"20","costo_unitario":"15"}'::jsonb)`,
      [viejo, cliente],
    );
    await db.query(
      `insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,origen,datos_originales)values($1,'ABONO','2026-11-01','Reversión por corrección','USD',100,'actualizacion_origen',$2)`,
      [cliente, JSON.stringify({ reversion_de: viejo })],
    );
    await db.query(
      `insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,origen)values($1,'CARGO','2026-11-01','Faro Toyota corregido','USD',120,'supabase_anterior'),($1,'ABONO','2026-11-02','Abono anterior','USD',20,'supabase_anterior')`,
      [cliente],
    );
    await db.exec("set role authenticated");
    const hist = (
      await db.query<{ r: any }>(
        "select public.historial_cliente_anterior($1) r",
        [cliente],
      )
    ).rows[0].r;
    assert.equal(hist.total, 4);
    const original = hist.filas.find(
      (l: any) => l.descripcion === "Faro Toyota original",
    );
    assert.equal(original.cantidad, "5");
    assert.equal(original.precio_unitario, "20");
    assert.ok(!JSON.stringify(hist).includes("costo_unitario"));
    assert.equal(Number(hist.final), 100);
    assert.ok(
      hist.filas.some((l: any) => l.descripcion === "Faro Toyota original"),
    );
    assert.ok(!hist.filas.some((l: any) => l.descripcion.includes("Factura")));
    let lista = await rpc("buscar_ventas", { q: "toy filt" });
    assert.equal(lista.total, 2);
    lista = await rpc("buscar_ventas", { cobro: "pagada" });
    assert.equal(lista.total, 1);
    lista = await rpc("buscar_ventas", { cobro: "pendiente" });
    assert.equal(lista.total, 0);
    // Más de una página: sumas del conjunto completo, no del lote visible.
    for (let i = 0; i < 35; i++)
      await rpc("emitir_factura", {
        id: randomUUID(),
        version: 0,
        cliente_id: cliente,
        condicion: "credito",
        lineas: [
          {
            variante_id: null,
            descripcion: "Servicio sintético",
            cantidad: "1",
            precio: "10",
          },
        ],
        abono: "0",
      });
    lista = await rpc("buscar_ventas", { cobro: "pendiente" });
    assert.equal(lista.total, 35);
    assert.equal(lista.filas.length, 30);
    assert.equal(Number(lista.resumen.pendiente), 350);
    assert.equal(
      (await rpc("buscar_ventas", { cobro: "pendiente", pagina: 2 })).filas
        .length,
      5,
    );
    assert.equal((await rpc("buscar_ventas", { q: "V-000001" })).total, 1);
    await db.exec("reset role");
    await db.query(
      "update alexmar.ventas set emitido='2026-11-22T03:59:59Z' where id=$1",
      [p.id],
    );
    await db.exec("set role authenticated");
    assert.equal(
      (
        await rpc("buscar_ventas", {
          desde: "2026-11-21",
          hasta: "2026-11-21",
          q: "V-000001",
        })
      ).total,
      1,
    );
    assert.equal(
      (
        await rpc("buscar_ventas", {
          desde: "2026-11-22",
          hasta: "2026-11-22",
          q: "V-000001",
        })
      ).total,
      0,
    );
    const exact = "0." + "1".repeat(80);
    const exactP = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      condicion: "contado",
      metodo_pago: "Efectivo",
      lineas: [
        {
          variante_id: null,
          descripcion: "Precisión exacta",
          cantidad: "1.2345",
          precio: exact,
        },
      ],
      abono: "0",
    };
    // Producto de 80 × 4 decimales: cobro íntegro sin truncar.
    const { default: D } = await import("decimal.js");
    const Dec = D.clone({ precision: 128 });
    exactP.abono = new Dec(exact).times("1.2345").toFixed();
    await rpc("emitir_factura", exactP);
    assert.equal(Number((await ficha(exactP.id)).saldo), 0);
    await db.exec(
      `reset role;update alexmar.perfiles set rol='lectura' where id='${admin}';set role authenticated;`,
    );
    for (const name of ["buscar_ventas", "emitir_factura", "cobrar_factura"])
      await assert.rejects(rpc(name, p), /permiso|autorizado|Acceso/i);
    await assert.rejects(
      db.query("select public.historial_cliente_anterior($1)", [cliente]),
      /permiso|autorizado|Acceso/i,
    );
  } finally {
    await db.close();
  }
});

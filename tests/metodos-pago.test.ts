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
test("métodos: Zelle/Binance en pago inicial, cobros, cuenta, proveedor y corrección; conserva saldo, reintentos y permisos", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql") && f < "20261123001700")
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.com'),('${general}','general@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${general}','General','lectura',true);insert into alexmar.clientes(id,nombre)values('${cliente}','Cliente sintético');set app.usuario='${admin}';set role authenticated;`,
    );
    const venta = {
      id: randomUUID(),
      version: 0,
      cliente_id: cliente,
      condicion: "contado",
      abono: "10",
      metodo_pago: "Zelle",
      lineas: [
        {
          variante_id: null,
          descripcion: "Servicio sintético",
          cantidad: "1",
          precio: "10",
        },
      ],
    };
    await assert.rejects(() => json(db, "emitir_factura", venta), /método/);
    const migracion = await readFile(
      "supabase/migrations/20261123001700_metodos_pago.sql",
      "utf8",
    );
    await db.exec("reset role");
    await db.exec(migracion);
    await db.exec("set role authenticated");
    for (const metodo of ["Zelle", "Binance", "Efectivo"]) {
      const p = { ...venta, id: randomUUID(), metodo_pago: metodo };
      await json(db, "emitir_factura", p);
      assert.equal((await rpc(db, "ficha_venta", [p.id])).pagado, "10");
    }
    const credito = {
      ...venta,
      id: randomUUID(),
      condicion: "credito",
      abono: "0",
      metodo_pago: "",
      lineas: [
        {
          variante_id: null,
          descripcion: "Crédito sintético",
          cantidad: "1",
          precio: "100",
        },
      ],
    };
    await json(db, "emitir_factura", credito);
    for (const metodo of ["Zelle", "Binance"]) {
      const p = {
        id: credito.id,
        idempotencia: randomUUID(),
        monto: "25",
        metodo,
      };
      await json(db, "cobrar_factura", p);
      await json(db, "cobrar_factura", p);
    }
    await json(db, "abonar_cuenta_cliente", {
      id: randomUUID(),
      cliente_id: cliente,
      saldo_esperado: "50",
      monto: "10",
      metodo: "Binance",
      confirmado: true,
    });
    assert.equal((await rpc(db, "ficha_venta", [credito.id])).saldo, "40");
    assert.equal((await rpc(db, "estado_cliente", [cliente])).final, "40");
    const proveedor = await json(db, "guardar_proveedor", {
        nombre: "Proveedor sintético",
        monedas: ["USD"],
      }),
      compra = randomUUID();
    await json(db, "recibir_compra", {
      id: compra,
      proveedor_id: proveedor,
      lineas: [
        {
          nuevo: { id: randomUUID(), nombre: "Artículo sintético" },
          cantidad: "5",
          costo_unitario: "10",
        },
      ],
    });
    let pago = "";
    for (const metodo of ["Zelle", "Binance"]) {
      pago = randomUUID();
      const p = { id: pago, compra_id: compra, monto: "10", metodo };
      await json(db, "pagar_compra", p);
      await json(db, "pagar_compra", p);
    }
    let c = await rpc(db, "ficha_compra", [compra]);
    assert.equal(c.saldo, "30");
    await json(db, "corregir_pago_compra", {
      id: pago,
      compra_id: compra,
      version: c.version,
      accion: "editar",
      monto: "12",
      metodo: "Zelle",
      motivo: "Corrección sintética",
      revisado: true,
    });
    c = await rpc(db, "ficha_compra", [compra]);
    assert.equal(c.saldo, "28");
    assert.equal(c.pagos.filas.find((x: any) => x.id === pago).metodo, "Zelle");
    await assert.rejects(
      () =>
        json(db, "emitir_factura", {
          ...venta,
          id: randomUUID(),
          metodo_pago: "Inválido",
        }),
      /método/,
    );
    await assert.rejects(
      () =>
        json(db, "cobrar_factura", {
          id: credito.id,
          idempotencia: randomUUID(),
          monto: "1",
          metodo: "Inválido",
        }),
      /método/,
    );
    await assert.rejects(
      () =>
        json(db, "pagar_compra", {
          id: randomUUID(),
          compra_id: compra,
          monto: "1",
          metodo: "Inválido",
        }),
      /método/,
    );
    await db.exec(`set app.usuario='${general}'`);
    await assert.rejects(
      () =>
        json(db, "pagar_compra", {
          id: randomUUID(),
          compra_id: compra,
          monto: "1",
          metodo: "Zelle",
        }),
      /permiso|autorizad/i,
    );
    await assert.rejects(
      () =>
        json(db, "cobrar_factura", {
          id: credito.id,
          idempotencia: randomUUID(),
          monto: "1",
          metodo: "Binance",
        }),
      /permiso|autorizad/i,
    );
    await db.exec(`reset role;set app.usuario='${admin}'`);
    await db.exec(migracion);
    await db.exec("set role authenticated");
    assert.equal((await rpc(db, "estado_cliente", [cliente])).final, "40");
    assert.equal((await rpc(db, "ficha_compra", [compra])).saldo, "28");
  } finally {
    await db.close();
  }
});

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
    `insert into auth.users values('${admin}','admin@example.com'),('${general}','general@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${general}','General','lectura',true);insert into alexmar.clientes(id,nombre)values('${cliente}','Cliente sintético');insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto,origen,datos_originales)values('${cliente}','CARGO','2026-11-01','Faro histórico de prueba',120,'supabase_anterior','{"cantidad":"2","precio_unitario":"60"}'),('${cliente}','ABONO','2026-11-02','Abono histórico',20,'supabase_anterior',null);set app.usuario='${admin}';set role authenticated;`,
  );
  return db;
}
const cuenta = (db: PGlite) => rpc(db, "estado_cliente", [cliente]);
const abono = (saldo: string, monto: string) => ({
  id: randomUUID(),
  cliente_id: cliente,
  saldo_esperado: saldo,
  monto,
  metodo: "Efectivo",
  confirmado: true,
});
async function cargo(db: PGlite, precio = "50.123456789") {
  const id = randomUUID();
  await json(db, "emitir_factura", {
    id,
    version: 0,
    cliente_id: cliente,
    condicion: "credito",
    moneda: "USD",
    descuento: "0",
    abono: "0",
    lineas: [
      {
        variante_id: null,
        descripcion: "Servicio de prueba",
        cantidad: "1",
        precio,
      },
    ],
  });
  return id;
}
test("cuenta continua: abono reparte deuda acumulada y facturas sin duplicar, respeta exactitud y cancelación", async () => {
  const db = await instalar();
  try {
    const v = await cargo(db);
    let d = await cuenta(db);
    assert.equal(d.final, "150.123456789");
    assert.equal(d.filas[0].cantidad, "2");
    assert.ok(
      d.filas.some((x: any) => x.descripcion.includes("Servicio de prueba")),
    );
    const p = abono(d.final, "125");
    await json(db, "abonar_cuenta_cliente", p);
    await json(db, "abonar_cuenta_cliente", p);
    d = await cuenta(db);
    assert.equal(d.final, "25.123456789");
    assert.equal(d.abonos, "145");
    let factura = await rpc(db, "ficha_venta", [v]);
    assert.equal(factura.pagado, "25");
    assert.equal(factura.saldo, "25.123456789");
    await assert.rejects(
      () => json(db, "abonar_cuenta_cliente", { ...p, monto: "124" }),
      /otros datos/,
    );
    await assert.rejects(
      () => json(db, "abonar_cuenta_cliente", abono("150.123456789", "1")),
      /cambió/,
    );
    await assert.rejects(
      () => json(db, "abonar_cuenta_cliente", abono(d.final, "26")),
      /supera/,
    );
    await json(db, "abonar_cuenta_cliente", abono(d.final, d.final));
    assert.match((await cuenta(db)).final, /^0(?:\.0+)?$/);
    factura = await rpc(db, "ficha_venta", [v]);
    assert.equal(factura.pagado, "50.123456789");
    await rpc(db, "anular_factura_revisada", [
      v,
      factura.version,
      "Prueba de devolución",
      true,
    ]);
    assert.match((await cuenta(db)).final, /^0(?:\.0+)?$/);
    // La deuda previa ya quedó saldada; cancelar el comprobante no vuelve a cobrar ni devolverla.
    const minimo = randomUUID();
    await json(db, "emitir_factura", {
      id: minimo,
      version: 0,
      cliente_id: cliente,
      condicion: "credito",
      abono: "0",
      descuento: "0",
      lineas: [
        {
          variante_id: null,
          descripcion: "Precisión de prueba",
          cantidad: "0.0001",
          precio: "0." + "0".repeat(79) + "1",
        },
      ],
    });
    const diminuto = (await cuenta(db)).final;
    assert.equal(diminuto, "0." + "0".repeat(83) + "1");
    await json(db, "abonar_cuenta_cliente", abono(diminuto, diminuto));
    assert.match((await cuenta(db)).final, /^0(?:\.0+)?$/);
    assert.equal((await rpc(db, "ficha_venta", [minimo])).pagado, diminuto);
    await db.exec("reset role");
    const pagos = await db.query<{ monto: string; aplicaciones: any }>(
      "select monto::text,aplicaciones from alexmar.abonos_cuenta order by creado",
    );
    assert.equal(pagos.rows.length, 3);
    assert.equal(pagos.rows[0].monto, "125");
    assert.equal(pagos.rows[0].aplicaciones.length, 2);
  } finally {
    await db.close();
  }
});
test("cuenta continua: paginación y filtros conservan totales; permisos, confirmación y eliminación de notas", async () => {
  const db = await instalar();
  try {
    for (const p of [
      { ...abono("100", "1"), confirmado: false },
      abono("100", "0"),
      abono("100", "-1"),
      { ...abono("100", "1"), moneda: "VES" },
    ])
      await assert.rejects(() => json(db, "abonar_cuenta_cliente", p));
    assert.equal((await cuenta(db)).final, "100");
    const id = await json(db, "guardar_nota", {
      titulo: "Nota de prueba",
      contenido: "Eliminar sin afectar dinero",
    });
    await rpc(db, "eliminar_nota", [id]);
    await rpc(db, "eliminar_nota", [id]);
    assert.equal((await rpc(db, "listar_notas")).total, 0);
    await assert.rejects(
      () =>
        json(db, "guardar_nota", {
          id,
          titulo: "Abierta antes",
          contenido: "No resucitar",
        }),
      /eliminada/,
    );
    for (let n = 0; n < 32; n++) await cargo(db, "1");
    const d = await cuenta(db),
      d2 = await rpc(db, "estado_cliente", [cliente, null, null, 2]);
    assert.equal(d.total, 34);
    assert.equal(d.filas.length, 30);
    assert.equal(d2.filas.length, 4);
    assert.equal(d2.final, d.final);
    const filtrado = await rpc(db, "estado_cliente", [
      cliente,
      "2026-11-03",
      null,
      1,
    ]);
    assert.equal(filtrado.anterior, "100");
    assert.equal(filtrado.cargos, "32");
    assert.equal(filtrado.final, "132");
    // Una incoherencia de libro/comprobante impide aplicar parcialmente dinero.
    await db.exec("reset role");
    await db.query(
      "insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto,venta_id)select $1,'CARGO',now(),'Diferencia sintética',10,id from alexmar.ventas order by id limit 1",
      [cliente],
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      () => json(db, "abonar_cuenta_cliente", abono("142", "142")),
      /conciliación/,
    );
    assert.equal((await cuenta(db)).final, "142");
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from alexmar.abonos_cuenta",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from alexmar.pagos_venta",
        )
      ).rows[0].n,
      0,
    );
    await db.exec("set role authenticated");
    await db.exec(`set app.usuario='${general}'`);
    await assert.rejects(
      () => json(db, "abonar_cuenta_cliente", abono("132", "1")),
      /permiso|autorizad/i,
    );
    await assert.rejects(
      () => rpc(db, "eliminar_nota", [id]),
      /permiso|autorizad/i,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      () => json(db, "abonar_cuenta_cliente", abono("132", "1")),
      /permission/,
    );
  } finally {
    await db.close();
  }
});

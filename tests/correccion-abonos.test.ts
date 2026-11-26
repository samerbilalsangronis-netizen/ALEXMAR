import { test } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
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
    `insert into auth.users values('${admin}','admin@example.com'),('${general}','general@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${general}','General','lectura',true);insert into alexmar.clientes(id,nombre)values('${cliente}','Cliente sintético');insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto,origen,datos_originales)values('${cliente}','CARGO','2026-11-01','Cargo histórico de prueba',120,'supabase_anterior','{}'),('${cliente}','ABONO','2026-11-02','Abono histórico',20,'supabase_anterior',null);set app.usuario='${admin}';set role authenticated;`,
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
async function lista(db: PGlite, pagina = 1) {
  return rpc(db, "listar_abonos_cliente", [cliente, pagina]);
}
async function entrada(db: PGlite, tipo: string, id?: string) {
  return (await lista(db)).filas.find(
    (r: any) => r.tipo === tipo && (!id || r.id === id),
  );
}
function corregir(r: any, monto: string, otros: Record<string, unknown> = {}) {
  return {
    clave: randomUUID(),
    tipo: r.tipo,
    id: r.id,
    cliente_id: cliente,
    revision: r.revision,
    monto,
    metodo: "Zelle",
    referencia: "DEMO",
    motivo: "Importe digitado incorrectamente",
    confirmado: true,
    ...otros,
  };
}
test("corregir histórico conserva original, trazabilidad y totales comerciales netos; protege conciliación del origen", async () => {
  const db = await instalar();
  try {
    const r = await entrada(db, "historico");
    assert.equal(r.original, "20");
    const p = corregir(r, "10.123456789123456789");
    await json(db, "corregir_abono_cliente", p);
    await json(db, "corregir_abono_cliente", p);
    let d = await cuenta(db);
    assert.equal(d.final, "109.876543210876543211");
    assert.equal(d.cargos, "120");
    assert.equal(d.abonos, "10.123456789123456789");
    const resumen = (await rpc(db, "metricas_generales")).cuentas.find(
      (c: any) => c.moneda === "USD",
    );
    assert.equal(resumen.cargos, "120");
    assert.equal(resumen.abonos, d.abonos);
    const actual = await entrada(db, "historico", r.id);
    assert.equal(actual.original, "20");
    assert.equal(actual.actual, "10.123456789123456789");
    assert.equal(actual.correcciones, 1);
    assert.equal(actual.metodo, "Zelle");
    const historial = await rpc(db, "historial_correcciones_abono", [
      "historico",
      r.id,
    ]);
    assert.equal(historial.total, 1);
    assert.equal(historial.filas[0].anterior, "20");
    assert.equal(historial.filas[0].autor, "Admin");
    assert.equal(historial.filas[0].motivo, p.motivo);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ monto: string }>(
          "select monto::text from alexmar.movimientos_cuenta where id=$1",
          [r.id],
        )
      ).rows[0].monto,
      "20",
    );
    await assert.rejects(
      () =>
        db.query(
          `insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto,origen,datos_originales) values($1,'CARGO',now(),'Reversión origen',20,'actualizacion_origen',jsonb_build_object('reversion_de',$2::text))`,
          [cliente, r.id],
        ),
      /correcciones locales/,
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      () => json(db, "corregir_abono_cliente", { ...p, monto: "11" }),
      /otros datos/,
    );
    const anular = corregir(actual, "0");
    await json(db, "corregir_abono_cliente", anular);
    assert.equal(new Decimal((await cuenta(db)).final).toFixed(), "120");
    assert.equal(new Decimal((await cuenta(db)).abonos).toFixed(), "0");
    await json(
      db,
      "corregir_abono_cliente",
      corregir(await entrada(db, "historico", r.id), "15"),
    );
    assert.equal(new Decimal((await cuenta(db)).final).toFixed(), "105");
    assert.equal((await lista(db)).total, 1);
  } finally {
    await db.close();
  }
});
test("abono repartido: corrige todas las aplicaciones, no duplica raíces y respeta facturas anuladas después", async () => {
  const db = await instalar();
  try {
    const v = await cargo(db, "50"),
      v2 = await cargo(db, "70");
    const p = abono((await cuenta(db)).final, "125");
    await json(db, "abonar_cuenta_cliente", p);
    const r = await entrada(db, "cuenta", p.id);
    assert.equal(r.actual, "125");
    assert.equal((await rpc(db, "ficha_venta", [v])).pagado, "25");
    await json(db, "corregir_abono_cliente", corregir(r, "160"));
    assert.equal((await rpc(db, "ficha_venta", [v])).pagado, "50");
    assert.equal((await rpc(db, "ficha_venta", [v2])).pagado, "10");
    assert.equal((await cuenta(db)).final, "60");
    assert.equal((await lista(db)).total, 2); // histórico + abono a cuenta, no aplicaciones duplicadas
    let vigente = await entrada(db, "cuenta", p.id);
    await json(db, "corregir_abono_cliente", corregir(vigente, "110"));
    assert.equal((await cuenta(db)).final, "110");
    assert.equal((await rpc(db, "ficha_venta", [v])).pagado, "10");
    assert.equal((await rpc(db, "ficha_venta", [v2])).pagado, "0");
    const factura = await rpc(db, "ficha_venta", [v]);
    await rpc(db, "anular_factura_revisada", [
      v,
      factura.version,
      "Factura de prueba anulada",
      true,
    ]);
    vigente = await entrada(db, "cuenta", p.id);
    assert.equal(vigente.actual, "100");
    assert.equal((await cuenta(db)).final, "70");
    await json(db, "corregir_abono_cliente", corregir(vigente, "90"));
    assert.equal((await cuenta(db)).final, "80");
    assert.equal((await rpc(db, "ficha_venta", [v])).pagado, "0");
    await db.exec("reset role");
    const original = (
      await db.query<{ monto: string }>(
        "select monto::text from alexmar.abonos_cuenta where id=$1",
        [p.id],
      )
    ).rows[0];
    assert.equal(original.monto, "125");
  } finally {
    await db.close();
  }
});
test("cobro de factura: corrección dirigida, rechazo atómico por sobreabono/contado/revisión obsoleta y cero restaurable", async () => {
  const db = await instalar();
  try {
    const v = await cargo(db, "50"),
      pago = await json(db, "cobrar_factura", {
        id: v,
        idempotencia: randomUUID(),
        monto: "20",
        metodo: "Binance",
      });
    let r = await entrada(db, "factura", pago);
    await json(db, "corregir_abono_cliente", corregir(r, "5"));
    assert.equal((await rpc(db, "ficha_venta", [v])).saldo, "45");
    assert.equal((await cuenta(db)).final, "145");
    await assert.rejects(
      () => json(db, "corregir_abono_cliente", corregir(r, "10")),
      /cambiaron/,
    );
    r = await entrada(db, "factura", pago);
    const before = await cuenta(db);
    await assert.rejects(
      () => json(db, "corregir_abono_cliente", corregir(r, "51")),
      /supera el saldo/,
    );
    assert.equal((await cuenta(db)).final, before.final);
    await json(db, "corregir_abono_cliente", corregir(r, "0"));
    assert.equal((await rpc(db, "ficha_venta", [v])).pagado, "0");
    await json(
      db,
      "corregir_abono_cliente",
      corregir(await entrada(db, "factura", pago), "12.123456789"),
    );
    assert.equal((await rpc(db, "ficha_venta", [v])).pagado, "12.123456789");
    const cash = randomUUID();
    await json(db, "emitir_factura", {
      id: cash,
      version: 0,
      cliente_id: cliente,
      condicion: "contado",
      abono: "10",
      metodo_pago: "Efectivo",
      lineas: [
        {
          variante_id: null,
          descripcion: "Servicio de contado",
          cantidad: "1",
          precio: "10",
        },
      ],
    });
    let c = (await lista(db)).filas.find(
      (r: any) => r.tipo === "factura" && r.original === "10",
    );
    await assert.rejects(
      () => json(db, "corregir_abono_cliente", corregir(c, "9")),
      /contado/,
    );
    assert.equal((await rpc(db, "ficha_venta", [cash])).pagado, "10");
    await json(db, "corregir_abono_cliente", corregir(c, "10"));
    assert.equal((await rpc(db, "ficha_venta", [cash])).pagado, "10");
    await db.exec("reset role");
    const metodos = await db.query<{ metodo: string; monto: string }>(
      "select metodo,sum(monto)::text monto from alexmar.pagos_venta where venta_id=$1 group by metodo",
      [cash],
    );
    assert.equal(
      new Decimal(
        metodos.rows.find((x) => x.metodo === "Efectivo")!.monto,
      ).toFixed(),
      "0",
    );
    assert.equal(
      new Decimal(
        metodos.rows.find((x) => x.metodo === "Zelle")!.monto,
      ).toFixed(),
      "10",
    );
    await db.exec("set role authenticated");
    const f = await rpc(db, "ficha_venta", [v]);
    await rpc(db, "anular_factura_revisada", [
      v,
      f.version,
      "Anular prueba de cobro",
      true,
    ]);
    r = await entrada(db, "factura", pago);
    assert.equal(r.editable, false);
    await assert.rejects(
      () => json(db, "corregir_abono_cliente", corregir(r, "1")),
      /revertidas|anulada/,
    );
  } finally {
    await db.close();
  }
});
test("corrección: permisos, no cambia cliente, precisión y paginación completa de revisiones", async () => {
  const db = await instalar();
  try {
    let r = await entrada(db, "historico");
    await assert.rejects(
      () =>
        json(
          db,
          "corregir_abono_cliente",
          corregir(r, "10", { cliente_id: randomUUID() }),
        ),
      /pertenece/,
    );
    await assert.rejects(
      () => json(db, "corregir_abono_cliente", corregir(r, "-1")),
      /Monto/,
    );
    await assert.rejects(
      () =>
        json(db, "corregir_abono_cliente", corregir(r, "10", { motivo: "x" })),
      /motivo/,
    );
    await assert.rejects(
      () =>
        json(
          db,
          "corregir_abono_cliente",
          corregir(r, "10", { confirmado: false }),
        ),
      /Confirma/,
    );
    for (let i = 0; i < 21; i++) {
      r = await entrada(db, "historico");
      await json(
        db,
        "corregir_abono_cliente",
        corregir(r, String(i % 2 ? 10 : 11), {
          motivo: "Corrección sintética número " + i,
        }),
      );
    }
    const h = await rpc(db, "historial_correcciones_abono", [
        "historico",
        r.id,
        1,
      ]),
      h2 = await rpc(db, "historial_correcciones_abono", [
        "historico",
        r.id,
        2,
      ]);
    assert.equal(h.total, 21);
    assert.equal(h.filas.length, 20);
    assert.equal(h2.filas.length, 1);
    assert.equal(
      new Set([...h.filas, ...h2.filas].map((x: any) => x.id)).size,
      21,
    );
    await db.exec(`set app.usuario='${general}'`);
    await assert.rejects(() => lista(db), /permiso/);
    await assert.rejects(
      () => rpc(db, "historial_correcciones_abono", ["historico", r.id]),
      /permiso/,
    );
    await assert.rejects(
      () => json(db, "corregir_abono_cliente", corregir(r, "1")),
      /permiso/,
    );
    await assert.rejects(
      () => db.query("select * from alexmar.correcciones_abono"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

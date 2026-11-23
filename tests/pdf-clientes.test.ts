import { crearPdfCliente } from "../src/lib/pdf-cliente";
import { PDFDocument } from "pdf-lib";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
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
test("PDF: cuenta completa multipágina, documento real, enlace por token, revocación/caducidad y permisos", async () => {
  const db = await instalar();
  try {
    await db.exec("reset role");
    for (let n = 0; n < 75; n++)
      await db.query(
        "insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,monto)values($1,'CARGO',now()+$2*interval '1 second',$3,1)",
        [cliente, n, "Producto de prueba Ñ " + String(n).padStart(3, "0")],
      );
    const otro = "44444444-4444-4444-8444-444444444444";
    await db.query(
      "insert into alexmar.clientes(id,nombre)values($1,'Otra cuenta de prueba')",
      [otro],
    );
    await db.exec("set role authenticated");
    const cuenta = await rpc(db, "documento_cuenta_pdf", [cliente]);
    assert.equal(cuenta.filas.length, 75);
    assert.equal(cuenta.final, "75");
    const bytes = await crearPdfCliente({
      tipo: "cuenta",
      cuenta,
      generado: cuenta.generado,
    });
    assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() > 1);
    assert.equal(pdf.getTitle(), "ALEXMAR · ESTADO DE CUENTA");
    await writeFile("/tmp/alexmar-cuenta-pdf-prueba.pdf", bytes);
    const token = "ab".repeat(32),
      base64 = Buffer.from(bytes).toString("base64");
    const guardado = await rpc(db, "guardar_pdf_compartido", [
      cliente,
      null,
      token,
      "cuenta-prueba.pdf",
      base64,
    ]);
    assert.ok(guardado.id);
    assert.ok(new Date(guardado.vence).getTime() > Date.now());
    const factura = randomUUID();
    await json(db, "emitir_factura", {
      id: factura,
      version: 0,
      cliente_id: cliente,
      condicion: "credito",
      abono: "0",
      lineas: [
        {
          variante_id: null,
          descripcion: "Instalación de prueba",
          cantidad: "1",
          precio: "12.3456789",
        },
      ],
    });
    const doc = await rpc(db, "ficha_venta", [factura]);
    const vf = await crearPdfCliente({
      tipo: "factura",
      factura: doc,
      generado: cuenta.generado,
    });
    assert.equal((await PDFDocument.load(vf)).getPageCount(), 1);
    await assert.rejects(
      () =>
        rpc(db, "guardar_pdf_compartido", [
          otro,
          factura,
          "cd".repeat(32),
          "ajena.pdf",
          base64,
        ]),
      /este cliente/,
    );
    await db.exec(`set app.usuario='${general}'`);
    await assert.rejects(
      () => rpc(db, "documento_cuenta_pdf", [cliente]),
      /permiso|autorizad/i,
    );
    await assert.rejects(
      () =>
        rpc(db, "guardar_pdf_compartido", [
          cliente,
          null,
          "cd".repeat(32),
          "prueba.pdf",
          base64,
        ]),
      /permiso|autorizad/i,
    );
    await assert.rejects(
      () => rpc(db, "revocar_pdf_compartido", [guardado.id]),
      /permiso|autorizad/i,
    );
    await db.exec("reset role;set role anon");
    const publico = await rpc(db, "leer_pdf_compartido", [token]);
    assert.equal(
      Buffer.from(publico.base64, "base64").compare(Buffer.from(bytes)),
      0,
    );
    assert.equal(await rpc(db, "leer_pdf_compartido", ["xx"]), null);
    assert.equal(await rpc(db, "leer_pdf_compartido", ["ff".repeat(32)]), null);
    await assert.rejects(
      () => db.query("select * from alexmar.pdf_compartidos"),
      /permission/,
    );
    await db.exec(
      `reset role;set app.usuario='${admin}';set role authenticated`,
    );
    await rpc(db, "revocar_pdf_compartido", [guardado.id]);
    assert.equal(await rpc(db, "leer_pdf_compartido", [token]), null);
    const t = "ef".repeat(32);
    await rpc(db, "guardar_pdf_compartido", [
      cliente,
      null,
      t,
      "caducado.pdf",
      base64,
    ]);
    await db.exec("reset role");
    await db.exec(
      "update alexmar.pdf_compartidos set vence=now()-interval '1 second'",
    );
    await db.exec("set role anon");
    assert.equal(await rpc(db, "leer_pdf_compartido", [t]), null);
  } finally {
    await db.close();
  }
});

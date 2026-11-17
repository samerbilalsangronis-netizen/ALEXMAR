import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { tipoImagen } from "../src/lib/fotos";
test("SQL 009 repara gráficos sin 007 y protege fotos privadas por rol", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  const admin = "11111111-1111-4111-8111-111111111111",
    ventas = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql") && !f.includes("00700"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.com'),('${ventas}','ventas@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${ventas}','Ventas','ventas',true);set app.usuario='${admin}';set role authenticated;`,
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ r: string | null }>(
          `select to_regclass('alexmar.procedencia_actual')::text r`,
        )
      ).rows[0].r,
      null,
    );
    await db.exec("set role authenticated");
    const datos = (
      await db.query<{
        r: { inventario: { total: number }; ventas: { total: string } };
      }>(`select public.analitica_comercial('2026-11-17','2026-11-17') r`)
    ).rows[0].r;
    assert.equal(datos.inventario.total, 0);
    assert.equal(datos.ventas.total, "0");
    const archivo = admin + "/33333333-3333-4333-8333-333333333333.jpg";
    await assert.rejects(
      () =>
        db.query("select public.guardar_foto_vehiculo($1,$2)", [
          "Fiesta",
          archivo,
        ]),
      /subir/,
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('alexmar-vehiculos',$1)",
      [archivo],
    );
    await db.query("select public.guardar_foto_vehiculo($1,$2)", [
      "Fiesta",
      archivo,
    ]);
    assert.equal(
      (
        await db.query<{ r: { nombre: string; archivo: string }[] }>(
          "select public.fotos_vehiculos() r",
        )
      ).rows[0].r[0].nombre,
      "Fiesta",
    );
    await assert.rejects(
      () => db.query("select * from alexmar.fotos_vehiculo"),
      /permission/,
    );
    await assert.rejects(
      () =>
        db.query("select public.guardar_foto_vehiculo($1,$2)", [
          "Fiesta",
          "../../malicioso.svg",
        ]),
      /inválido/,
    );
    await db.exec(`set app.usuario='${ventas}'`);
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('alexmar-vehiculos',$1)",
          [ventas + "/33333333-3333-4333-8333-333333333333.jpg"],
        ),
      /policy/,
    );
    await assert.rejects(
      () =>
        db.query("select public.guardar_foto_vehiculo($1,$2)", [
          "Fiesta",
          archivo,
        ]),
      /permiso|acceso/i,
    );
    await db.exec(
      `reset role;update alexmar.perfiles set activo=false where id='${ventas}';set role authenticated`,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      () => db.query("select public.fotos_vehiculos()"),
      /permission/,
    );
  } finally {
    await db.close();
  }
});
test("fotos: reconoce formatos admitidos y rechaza SVG/HTML aunque tengan extensión de imagen", () => {
  assert.equal(
    tipoImagen(new Uint8Array([255, 216, 255, ...Array(9).fill(0)]))?.mime,
    "image/jpeg",
  );
  assert.equal(
    tipoImagen(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...Array(4).fill(0)]),
    )?.mime,
    "image/png",
  );
  assert.equal(
    tipoImagen(new TextEncoder().encode("RIFF1234WEBP1234"))?.mime,
    "image/webp",
  );
  assert.equal(
    tipoImagen(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),
    null,
  );
  assert.equal(tipoImagen(new Uint8Array()), null);
});

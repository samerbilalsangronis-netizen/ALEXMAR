import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guardarContenidoNota,
  leerContenidoNota,
  PREFIJO_NOTA,
} from "../src/lib/notas";
test("notas: texto antiguo literal, formato seguro, stickers y saltos de línea sobreviven guardar/abrir", () => {
  const antiguo = '<script>alert("prueba")</script>\nNota histórica';
  assert.deepEqual(leerContenidoNota(antiguo), [{ texto: antiguo }]);
  const fragmentos = [
    { texto: "Prioridad", color: "#b42318", fondo: "#fff1a8", negrita: true },
    { texto: "\nComprar filtros ⭐", cursiva: true, subrayado: true },
  ];
  assert.deepEqual(
    leerContenidoNota(guardarContenidoNota(fragmentos)),
    fragmentos,
  );
  assert.deepEqual(leerContenidoNota(PREFIJO_NOTA + "{malformado"), [
    { texto: PREFIJO_NOTA + "{malformado" },
  ]);
});
test("notas: rechaza formatos ajenos, tamaños excesivos y notas vacías; descarta atributos ejecutables", () => {
  assert.throws(() => guardarContenidoNota([{ texto: "   \n" }]), /Escribe/);
  assert.throws(
    () =>
      guardarContenidoNota([{ texto: "x", color: "url(javascript:alert(1))" }]),
    /Color/,
  );
  assert.throws(
    () => guardarContenidoNota([{ texto: "x", fondo: "#000000" }]),
    /Color/,
  );
  assert.throws(
    () => guardarContenidoNota([{ texto: "x", negrita: "true" }]),
    /Formato/,
  );
  assert.throws(
    () => guardarContenidoNota([{ texto: "a".repeat(50001) }]),
    /50.000/,
  );
  assert.throws(
    () =>
      guardarContenidoNota(
        Array.from({ length: 3001 }, () => ({ texto: "a" })),
      ),
    /3000/,
  );
  assert.deepEqual(
    leerContenidoNota(
      guardarContenidoNota([
        {
          texto: "Seguro",
          onclick: "alert(1)",
          html: "<img src=x onerror=alert(1)>",
        } as any,
      ]),
    ),
    [{ texto: "Seguro" }],
  );
});

import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
test("notas: RPC existente conserva texto/formato, edición por ID sin duplicar y permisos administrativos", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  const admin = "11111111-1111-4111-8111-111111111111",
    general = "22222222-2222-4222-8222-222222222222",
    id = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.com'),('${general}','general@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${general}','General','lectura',true);set app.usuario='${admin}';set role authenticated;`,
    );
    const plain = {
      id,
      titulo: "Importada de prueba",
      contenido: "Texto anterior\nSegunda línea",
    };
    await db.query("select public.guardar_nota($1)", [JSON.stringify(plain)]);
    const doc = {
      ...plain,
      contenido: guardarContenidoNota([
        {
          texto: "Nota editada ⭐",
          color: "#175cd3",
          fondo: "#fff1a8",
          negrita: true,
        },
      ]),
    };
    await db.query("select public.guardar_nota($1)", [JSON.stringify(doc)]);
    await db.query("select public.guardar_nota($1)", [JSON.stringify(doc)]);
    const d = (await db.query<{ r: any }>("select public.listar_notas() r"))
      .rows[0].r;
    assert.equal(d.total, 1);
    assert.equal(d.filas[0].id, id);
    assert.equal(d.filas[0].contenido, doc.contenido);
    await db.exec(`set app.usuario='${general}'`);
    await assert.rejects(
      () => db.query("select public.listar_notas()"),
      /permiso|autorizad/i,
    );
    await assert.rejects(
      () => db.query("select public.guardar_nota($1)", [JSON.stringify(doc)]),
      /permiso|autorizad/i,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      () => db.query("select public.listar_notas()"),
      /permission/,
    );
  } finally {
    await db.close();
  }
});

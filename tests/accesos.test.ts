import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import {
  correoDeUsuario,
  identificadorAuth,
  usuarioCanonico,
} from "../src/lib/accesos";
const admin = "11111111-1111-4111-8111-111111111111",
  general = "22222222-2222-4222-8222-222222222222",
  inventario = "33333333-3333-4333-8333-333333333333";
const nueva = "44444444-4444-4444-8444-444444444444";
test("identificador de ingreso: usuario normalizado, correo existente y rechazo de identificadores inválidos", () => {
  assert.equal(usuarioCanonico("  Empléado   Demo  "), "empleado.demo");
  assert.equal(
    correoDeUsuario("Empleado Demo"),
    "empleado.demo@accesos.alexmar.invalid",
  );
  assert.equal(identificadorAuth(" ADMIN@EXAMPLE.COM "), "admin@example.com");
  for (const nombre of [
    "x",
    "../admin",
    "a@",
    "a<script>",
    "abc..x",
    "abc.",
    "*".repeat(4),
  ])
    assert.throws(() => identificadorAuth(nombre));
});
async function instalar() {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && f < "20261123001300")
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `insert into auth.users values('${admin}','admin@example.com'),('${general}','empleado@example.com'),('${inventario}','inventario@example.com'),('${nueva}','nuevo@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${general}','Empleado de prueba','ventas',true),('${inventario}','Inventario de prueba','inventario',true);set app.usuario='${admin}';set role authenticated;`,
  );
  const producto = (
    await db.query<{ r: string }>(
      `select public.guardar_producto(' {"nombre":"Filtro Toyota de prueba","precio":"12.1234567890123456789","costo":"3.111111111111","minimo":"2"}') r`,
    )
  ).rows[0].r;
  await db.query(
    "select public.ajustar_stock($1,5,'Prueba de existencia','accesos-stock-prueba')",
    [producto],
  );
  await db.exec(`set app.usuario='${general}';`);
  await db.query("select public.buscar_productos('{}')");
  await db.exec(`set app.usuario='${admin}';`);
  await db.exec("reset role");
  await db.exec(
    await readFile(
      "supabase/migrations/20261123001300_accesos_personal.sql",
      "utf8",
    ),
  );
  await db.exec("set role authenticated");
  return { db, producto };
}
async function usuario(db: PGlite, id: string, sesion = randomUUID()) {
  await db.query(
    "select set_config('app.usuario',$1,false),set_config('request.jwt.claims',$2,false)",
    [id, JSON.stringify({ sub: id, session_id: sesion })],
  );
}
async function perfil(db: PGlite) {
  return (await db.query<{ r: any }>("select public.mi_perfil() r")).rows[0].r;
}
test("accesos: migración a dos roles, consulta segura, administración, bloqueo con JWT existente y registro paginado", async () => {
  const { db, producto } = await instalar();
  try {
    await usuario(db, admin);
    assert.equal((await perfil(db)).version_accesos, 13);
    const roles = (
      await db.query<{ r: any }>("select public.listar_perfiles() r")
    ).rows[0].r;
    assert.equal(roles.filter((x: any) => x.rol === "lectura").length, 2);
    // Administración sigue pudiendo emitir y anular sobre la instalación actual.
    await db.exec("reset role");
    await db.query("insert into alexmar.clientes(id,nombre)values($1,$2)", [
      nueva,
      "Cliente sintético",
    ]);
    await db.exec("set role authenticated");
    const variante = (
      await db.query<{ r: any }>("select public.buscar_productos('{}') r")
    ).rows[0].r.filas[0].variante_id;
    const venta = {
      id: randomUUID(),
      version: 0,
      cliente_id: nueva,
      condicion: "credito",
      abono: "0",
      lineas: [
        {
          variante_id: variante,
          cantidad: "2",
          precio: "12.1234567890123456789",
        },
      ],
    };
    await db.query("select public.emitir_factura($1)", [JSON.stringify(venta)]);
    await db.query(
      "select public.anular_venta($1,'Prueba de anulación administrativa',false)",
      [venta.id],
    );
    await db.query(
      "select public.asignar_perfil($1,'Persona nueva','lectura',true)",
      [nueva],
    );
    await usuario(db, nueva);
    assert.equal(
      (
        await db.query<{ r: any }>(
          "select public.registrar_ingreso('general') r",
        )
      ).rows[0].r.permitido,
      true,
    );
    await usuario(db, admin);
    const sid = randomUUID();
    await usuario(db, general, sid);
    assert.equal((await perfil(db)).rol, "lectura");
    assert.equal((await perfil(db)).bloqueado, false);
    const entrada = (
      await db.query<{ r: any }>("select public.registrar_ingreso('general') r")
    ).rows[0].r;
    assert.equal(entrada.permitido, true);
    const d = (
      await db.query<{ r: any }>(
        'select public.catalogo_general(\'{"q":"toy filt"}\') r',
      )
    ).rows[0].r;
    assert.equal(d.total, 1);
    assert.equal(d.filas[0].precio, "12.1234567890123456789");
    for (const clave of [
      "costo",
      "minimo",
      "fisico",
      "reservado",
      "disponible",
      "usuario_id",
    ])
      assert.ok(!(clave in d.filas[0]), clave);
    assert.equal(
      (
        await db.query<{ r: any }>(
          "select public.registrar_ingreso('administrativo') r",
        )
      ).rows[0].r.permitido,
      false,
    );
    for (const sql of [
      "select public.buscar_productos('{}')",
      "select public.resumen()",
      "select public.metricas_generales()",
      "select public.rendimiento_ventas()",
      "select public.analitica_comercial('2026-11-01','2026-11-23')",
      "select public.buscar_clientes('{}')",
      "select public.buscar_proveedores('{}')",
      "select public.buscar_ventas('{}')",
      "select public.listar_notas()",
      "select public.listar_perfiles()",
      "select public.historial_accesos()",
      "select public.ficha_producto('" + producto + "')",
      "select public.kardex('" + producto + "')",
      "select public.opciones_catalogo()",
      "select public.fotos_vehiculos()",
      "select public.estado_control_acceso()",
      "select public.bloquear_acceso_general(true,1)",
      'select public.guardar_producto(\'{"nombre":"No permitido"}\')',
    ])
      await assert.rejects(db.query(sql), /permiso/i, sql);
    for (const tabla of [
      "perfiles",
      "registro_accesos",
      "control_acceso",
      "variantes",
      "clientes",
    ])
      await assert.rejects(
        db.query("select * from alexmar." + tabla),
        /permission denied/,
      );
    await usuario(db, admin);
    let control = (
      await db.query<{ r: any }>("select public.estado_control_acceso() r")
    ).rows[0].r;
    await db.query("select public.bloquear_acceso_general(true,$1)", [
      control.version,
    ]);
    await usuario(db, general, sid);
    assert.equal((await perfil(db)).bloqueado, true);
    assert.equal(
      (
        await db.query<{ r: any }>(
          "select public.registrar_ingreso('general') r",
        )
      ).rows[0].r.motivo,
      "bloqueado",
    );
    await assert.rejects(
      db.query("select public.catalogo_general('{}')"),
      /bloqueado/,
    );
    assert.equal(
      (
        await db.query<{ r: boolean }>(
          "select public.permiso_fotos_vehiculos(false) r",
        )
      ).rows[0].r,
      false,
    );
    await usuario(db, admin);
    assert.equal((await perfil(db)).bloqueado, false);
    await db.query("select public.resumen()");
    await assert.rejects(
      db.query("select public.bloquear_acceso_general(false,1)"),
      /cambió/,
    );
    await db.query("select public.bloquear_acceso_general(false,2)");
    await assert.rejects(
      db.query("select public.asignar_perfil($1,'Admin','lectura',true)", [
        admin,
      ]),
      /propio/,
    );
    await assert.rejects(
      db.query("select public.asignar_perfil($1,'Empleado','ventas',true)", [
        general,
      ]),
      /Administrativo/,
    );
    // Revocar al empleado interrumpe también su sesión anterior, sin cambiar contraseña/JWT.
    await db.query(
      "select public.asignar_perfil($1,'Empleado de prueba','lectura',false)",
      [general],
    );
    await usuario(db, general, sid);
    assert.equal(await perfil(db), null);
    await assert.rejects(
      db.query("select public.catalogo_general('{}')"),
      /permiso/,
    );
    await usuario(db, admin);
    await db.query(
      "select public.asignar_perfil($1,'Empleado de prueba','lectura',true)",
      [general],
    );
    for (let i = 0; i < 35; i++) {
      await usuario(db, general);
      await db.query("select public.catalogo_general('{}')");
    }
    await usuario(db, general, sid);
    await db.query("select public.registrar_ingreso('general')");
    await db.query("select public.registrar_ingreso('general')");
    await usuario(db, admin);
    const h = (
      await db.query<{ r: any }>("select public.historial_accesos(1,$1) r", [
        general,
      ])
    ).rows[0].r;
    assert.equal(h.filas.length, 30);
    assert.equal(h.total, 38);
    assert.equal(
      (
        await db.query<{ r: any }>("select public.historial_accesos(2,$1) r", [
          general,
        ])
      ).rows[0].r.filas.length,
      8,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select public.catalogo_general('{}')"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

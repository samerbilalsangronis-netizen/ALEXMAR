import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { analizar, type Datos } from "../src/lib/migracion";
const admin = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  nuevo = "33333333-3333-4333-8333-333333333333",
  mov = "44444444-4444-4444-8444-444444444444";
test("actualización de origen: añade, cambia stock por diferencia, conserva historia y detecta conflictos", async () => {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.usuario',true),'')::uuid$$;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql") && f < "20261123001300")
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await db.exec(
      `insert into auth.users values('${admin}','admin@example.com'),('${nuevo}','ventas@example.com');insert into alexmar.perfiles values('${admin}','Admin','administrador',true),('${nuevo}','Ventas','ventas',true);set app.usuario='${admin}';set role authenticated;`,
    );
    const base: Datos = {
      inventario: [
        {
          id,
          nombre_producto: "Faro de muestra",
          costo: "4",
          pvp: "10",
          stock_actual: "10",
          stock_minimo: "1",
          categoria_tags: "FORD",
          compatibilidad_vehiculos: "Fiesta",
          eliminado: "false",
          updated_at: "2026-11-15T12:00:00Z",
        },
      ],
      clientes: [
        {
          id,
          nombre_cliente: "Cliente de muestra",
          telefono: "anterior",
          total_adeudado: "0",
          eliminado: "false",
          updated_at: "2026-11-15T12:00:00Z",
        },
      ],
      detalle_cuentas: [
        {
          id,
          id_cliente: id,
          tipo_linea: "CARGO",
          total_linea: "20.123456789",
          fecha: "2026-11-15T12:00:00Z",
          descripcion: "Original",
          eliminado: "false",
          updated_at: "2026-11-15T12:00:00Z",
        },
      ],
      notas: [
        { id, titulo: "Prueba", contenido: "Anterior", eliminado: "false" },
      ],
    };
    const hash = (d: Datos) =>
      createHash("sha256").update(JSON.stringify(d)).digest("hex");
    await db.query("select public.importar_inicial($1,$2,$3)", [
      JSON.stringify(base),
      hash(base),
      JSON.stringify(analizar(base).conciliacion),
    ]);
    type Plan = {
      revision: string;
      puedeImportar: boolean;
      importado?: boolean;
      repetido?: boolean;
      conflictos: { motivo: string }[];
      cambios: {
        tabla: string;
        id: string;
        campos: {
          campo: string;
          anterior: string | null;
          nuevo: string | null;
        }[];
      }[];
      resumen: Record<
        string,
        { nuevos: number; actualizados: number; sin_cambios: number }
      >;
    };
    const sync = async (
      d: Datos,
      confirmar = false,
      revision: string | null = null,
    ) =>
      (
        await db.query<{ r: Plan }>(
          "select public.sincronizar_origen($1,$2,$3,$4,$5) r",
          [
            JSON.stringify(d),
            hash(d),
            JSON.stringify(analizar(d).conciliacion),
            confirmar,
            revision,
          ],
        )
      ).rows[0].r;
    const stock = async () =>
      (
        await db.query<{ r: { fisico: string; precio: string } }>(
          "select public.ficha_producto($1) r",
          [id],
        )
      ).rows[0].r;
    const actualizado = structuredClone(base);
    actualizado.inventario[0].stock_actual = "7";
    actualizado.inventario[0].updated_at = "2026-11-16T12:00:00Z";
    actualizado.clientes[0].telefono = "actualizado";
    actualizado.clientes[0].updated_at = "2026-11-16T12:00:00Z";
    actualizado.detalle_cuentas.push({
      id: mov,
      id_cliente: id,
      tipo_linea: "ABONO",
      total_linea: "3.0000000001",
      fecha: "2026-11-16T12:00:00Z",
      descripcion: "Abono nuevo",
      eliminado: "false",
    });
    actualizado.notas.push({
      id: nuevo,
      titulo: "Nueva",
      contenido: "Texto nuevo",
      eliminado: "false",
    });
    actualizado.inventario.push({
      id: "55555555-5555-4555-8555-555555555555",
      nombre_producto: "Producto nuevo",
      pvp: "4",
      costo: "1",
      stock_actual: "2",
      stock_minimo: "1",
      eliminado: "false",
    });
    actualizado.clientes.push({
      id: "66666666-6666-4666-8666-666666666666",
      nombre_cliente: "Cliente nuevo",
      total_adeudado: "0",
      eliminado: "false",
    });
    actualizado.detalle_cuentas.push({
      id: "77777777-7777-4777-8777-777777777777",
      id_cliente: "66666666-6666-4666-8666-666666666666",
      tipo_linea: "CARGO",
      total_linea: "21.333333333333333333333",
      fecha: "2026-11-16T12:00:00Z",
      eliminado: "false",
    });
    let plan = await sync(actualizado);
    assert.equal(plan.puedeImportar, true);
    assert.equal(plan.resumen.inventario.actualizados, 1);
    assert.equal(plan.resumen.detalle_cuentas.nuevos, 2);
    assert.equal(plan.resumen.inventario.nuevos, 1);
    assert.equal(plan.resumen.clientes.nuevos, 1);
    assert.equal(
      plan.cambios
        .find((c) => c.id === id && c.tabla === "inventario")!
        .campos.find((c) => c.campo === "fisico")!.nuevo,
      "7",
    );
    assert.equal(plan.resumen.notas.nuevos, 1);
    assert.equal((await stock()).fisico, "10", "analizar no escribe");
    // La clasificación personalizada es independiente de los campos del origen.
    await db.query(
      "select public.guardar_clasificacion($1,'Destacados',null)",
      [id],
    );
    // La clasificación manual es independiente y debe conservarse.
    await sync(actualizado, true, plan.revision);
    assert.equal((await stock()).fisico, "7");
    assert.equal((await sync(actualizado, true, plan.revision)).repetido, true);
    assert.equal((await stock()).fisico, "7");
    const saldo = (
      await db.query<{ r: { final: string } }>(
        "select public.estado_cliente($1) r",
        [id],
      )
    ).rows[0].r.final;
    assert.equal(saldo, "17.1234567889");
    const clasif = (
      await db.query<{ r: { categoria: string } }>(
        "select public.clasificacion_producto($1) r",
        [id],
      )
    ).rows[0].r;
    assert.equal(clasif.categoria, "Destacados");
    // Corrección monetaria: reversión + nueva versión, nunca reescribe el movimiento original.
    const correccion = structuredClone(actualizado);
    correccion.detalle_cuentas[0].total_linea = "18.123456789";
    correccion.detalle_cuentas[0].updated_at = "2026-11-16T13:00:00Z";
    plan = await sync(correccion);
    assert.equal(plan.puedeImportar, true);
    await sync(correccion, true, plan.revision);
    assert.equal(
      (
        await db.query<{ r: { final: string } }>(
          "select public.estado_cliente($1) r",
          [id],
        )
      ).rows[0].r.final,
      "15.1234567889",
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ m: string }>(
          "select monto::text m from alexmar.movimientos_cuenta where id=$1",
          [id],
        )
      ).rows[0].m,
      "20.123456789",
    );
    assert.equal(
      (
        await db.query<{ r: string }>(
          "select datos->>'stock_actual' r from alexmar.origenes where tipo='inventario' and origen_id=$1",
          [id],
        )
      ).rows[0].r,
      "10",
    );
    await db.exec("set role authenticated");
    // Corrección posterior al mismo registro usa la última versión, no la primera.
    const corregido2 = structuredClone(correccion);
    corregido2.detalle_cuentas[0].eliminado = "true";
    corregido2.detalle_cuentas[0].updated_at = "2026-11-16T14:00:00Z";
    plan = await sync(corregido2);
    await sync(corregido2, true, plan.revision);
    assert.equal(
      (
        await db.query<{ r: { final: string } }>(
          "select public.estado_cliente($1) r",
          [id],
        )
      ).rows[0].r.final,
      "-3.0000000001",
    );
    // No admite archivos parciales ni versiones viejas.
    const incompleto = structuredClone(corregido2);
    incompleto.notas = [];
    assert.equal((await sync(incompleto)).puedeImportar, false);
    const viejo = structuredClone(corregido2);
    viejo.inventario[0].updated_at = "2026-11-14T12:00:00Z";
    assert.equal((await sync(viejo)).puedeImportar, false);
    const sinFecha = structuredClone(corregido2);
    delete sinFecha.inventario[0].updated_at;
    assert.equal((await sync(sinFecha)).puedeImportar, false);
    // Una edición local y otra de origen sobre el mismo dato bloquean todo el lote.
    const colision = structuredClone(corregido2);
    colision.inventario[0].stock_actual = "6";
    colision.inventario[0].updated_at = "2026-11-16T15:00:00Z";
    await db.query(
      "select public.ajustar_stock($1,5,'Conteo posterior local','actualizacion-conteo-local')",
      [id],
    );
    plan = await sync(colision);
    assert.equal(plan.puedeImportar, false);
    assert.ok(plan.conflictos.some((c) => c.motivo.includes("fisico")));
    await assert.rejects(sync(colision, true, plan.revision), /conflictos/);
    assert.equal((await stock()).fisico, "5");
    // Un cambio local a otro campo después del análisis exige volver a analizar.
    const telefonos = structuredClone(corregido2);
    telefonos.clientes[0].telefono = "tercero";
    telefonos.clientes[0].updated_at = "2026-11-16T16:00:00Z";
    plan = await sync(telefonos);
    assert.equal(plan.puedeImportar, true);
    await db.exec("reset role");
    await db.query(
      "update alexmar.clientes set direccion='Dirección local' where id=$1",
      [id],
    );
    await db.exec("set role authenticated");
    await assert.rejects(sync(telefonos, true, plan.revision), /cambiaron/);
    plan = await sync(telefonos);
    await sync(telefonos, true, plan.revision);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ d: string }>(
          "select direccion d from alexmar.clientes where id=$1",
          [id],
        )
      ).rows[0].d,
      "Dirección local",
    );
    await db.exec("set role authenticated");
    await db.exec("reset role");
    await db.exec(
      "insert into alexmar.reservas(variante_id,cantidad,estado,referencia) select id,2,'activa','Reserva local de prueba' from alexmar.variantes where producto_id='55555555-5555-4555-8555-555555555555'",
    );
    await db.exec("set role authenticated");
    const reservado = structuredClone(telefonos);
    reservado.inventario[1].stock_actual = "1";
    const bloqueoReserva = await sync(reservado);
    assert.equal(bloqueoReserva.puedeImportar, false);
    assert.ok(
      bloqueoReserva.conflictos.some((c) => c.motivo.includes("reservadas")),
    );
    await db.exec(`set app.usuario='${nuevo}'`);
    await assert.rejects(sync(telefonos), /permiso/);
    await db.exec("set role anon");
    await assert.rejects(sync(telefonos), /permission denied/);
  } finally {
    await db.close();
  }
});

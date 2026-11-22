-- UTILIDAD MANUAL v1 · 2026-11-22. NO es una migración ni se ejecuta al publicar.
-- SOLO en el Supabase NUEVO de ALEXMAR, desde SQL Editor con el rol postgres.
-- Autorizado para descartar la importación y las operaciones de PRUEBA.
-- Vacía catálogo (también clasificación/compatibilidades por producto), clientes,
-- cuentas, notas, facturas, proveedores, compras, pagos, reservas y lotes de carga.
-- Conserva usuarios de Auth, perfiles, filtros guardados, fotos/Storage y auditoría.
-- Primero crea una copia privada de TODAS las tablas alexmar en la misma base.
-- Esa copia no sustituye un respaldo externo del proyecto. No exportarla a GitHub.
-- Cerrar las demás pestañas de la app durante limpieza y nueva importación.
-- Ejecutar TODO el archivo una sola vez. Si algo falla, se revierte la transacción.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $limpieza$
declare
 respaldo constant text := 'alexmar_respaldo_pruebas_20261122_v1';
 -- Orden de padres a hijos, compartido con la utilidad de restauración.
 vaciar constant text[] := array[
  'clientes','productos','variantes','proveedores','ventas','compras',
  'lineas_venta','lineas_compra','pagos_venta','pagos_compra',
  'compatibilidades','clasificaciones_catalogo','movimientos_stock','reservas',
  'movimientos_cuenta','notas','lotes','origenes','revisiones_origen'
 ];
 conservar constant text[] := array['perfiles','consultas','fotos_vehiculo','auditoria'];
 lista text; lista_vaciar text; tabla text; fila record; n bigint; copiados bigint;
 estado_007 integer;
begin
 if current_user in ('anon','authenticated','service_role') then
  raise exception 'Ejecuta esta utilidad solo desde SQL Editor como postgres.';
 end if;
 if to_regprocedure('public.configuracion_facturacion()') is null
 or to_regclass('alexmar.perfiles') is null then
  raise exception 'Este no es el destino esperado con SQL 011. No se borró nada.';
 end if;
 if exists(select 1 from pg_namespace where nspname=respaldo) then
  raise exception 'La limpieza v1 ya tiene un respaldo. No se repite: podría eliminar una importación nueva.';
 end if;
 if exists(select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace
  where s.nspname='alexmar' and c.relkind in ('r','p') and not(c.relname=any(vaciar||conservar))) then
  raise exception 'Hay tablas de ALEXMAR fuera del alcance revisado. No se borró nada.';
 end if;
 estado_007 := (to_regclass('alexmar.revisiones_origen') is not null)::int
  +(to_regclass('alexmar.procedencia_actual') is not null)::int
  +(to_regprocedure('public.estado_importacion()') is not null)::int
  +(to_regprocedure('public.sincronizar_origen(jsonb,text,jsonb,boolean,text)') is not null)::int;
 if estado_007 not in (0,4) then
  raise exception 'SQL 007 parece incompleto. Revisar instalación antes de limpiar. No se borró nada.';
 end if;
 -- La carga inicial y la actualización comparten este bloqueo.
 perform pg_advisory_xact_lock(7061511);
 select string_agg(format('alexmar.%I',c.relname),',' order by c.relname)
 into lista from pg_class c join pg_namespace s on s.oid=c.relnamespace
 where s.nspname='alexmar' and c.relkind in ('r','p');
 execute 'lock table '||lista||' in access exclusive mode';
 if not exists(select 1 from alexmar.perfiles where activo and rol='administrador') then
  raise exception 'No hay administrador activo que pueda reimportar. No se borró nada.';
 end if;
 execute format('create schema %I',respaldo);
 execute format('revoke all on schema %I from public,anon,authenticated',respaldo);
 execute format('create table %I.manifiesto(tabla text primary key,filas bigint not null,vaciada boolean not null,columnas jsonb not null)',respaldo);
 execute format('create table %I.secuencias(nombre text primary key,ultimo bigint not null,llamada boolean not null,incremento bigint not null,reiniciar boolean not null)',respaldo);
 execute format('create table %I.control(id integer primary key check(id=1),creado timestamptz not null,estado text not null,sql_007 boolean not null,restaurado timestamptz)',respaldo);
 execute format('insert into %I.control values(1,clock_timestamp(),''preparando'',$1,null)',respaldo) using estado_007=4;
 for fila in select c.oid,c.relname from pg_class c join pg_namespace s on s.oid=c.relnamespace
  where s.nspname='alexmar' and c.relkind in ('r','p') order by c.relname loop
  execute format('create table %I.%I as table alexmar.%I',respaldo,fila.relname,fila.relname);
  execute format('select count(*) from alexmar.%I',fila.relname) into n;
  execute format('select count(*) from %I.%I',respaldo,fila.relname) into copiados;
  if n<>copiados then raise exception 'El respaldo de % no coincide. No se borró nada.',fila.relname;end if;
  execute format('insert into %I.manifiesto values($1,$2,$3,$4)',respaldo)
   using fila.relname,n,fila.relname=any(vaciar),
   (select jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attgenerated,attidentity) order by attnum)
    from pg_attribute where attrelid=fila.oid and attnum>0 and not attisdropped);
 end loop;
 for fila in select c.oid,c.relname,q.seqincrement,
  (c.relname in ('numero_venta','numero_compra') or exists(
   select 1 from pg_depend d join pg_class t on t.oid=d.refobjid
   where d.objid=c.oid and d.classid='pg_class'::regclass and d.refclassid='pg_class'::regclass
    and d.deptype in ('a','i') and t.relnamespace='alexmar'::regnamespace and t.relname=any(vaciar))) reiniciar
  from pg_class c join pg_sequence q on q.seqrelid=c.oid where c.relnamespace='alexmar'::regnamespace loop
  execute format('insert into %I.secuencias select $1,last_value,is_called,$2,$3 from alexmar.%I',respaldo,fila.relname)
   using fila.relname,fila.seqincrement,fila.reiniciar;
 end loop;
 -- Ninguna copia es accesible mediante los roles de la web.
 for fila in select c.relname from pg_class c where c.relnamespace=respaldo::regnamespace and c.relkind='r' loop
  execute format('alter table %I.%I enable row level security',respaldo,fila.relname);
 end loop;
 execute format('revoke all on all tables in schema %I from public,anon,authenticated',respaldo);
 execute format('revoke all on all sequences in schema %I from public,anon,authenticated',respaldo);
 select string_agg(format('alexmar.%I',t),',' order by orden) into lista_vaciar
 from unnest(vaciar) with ordinality v(t,orden) where to_regclass(format('alexmar.%I',t)) is not null;
 -- Sin CASCADE: una referencia ajena impide la limpieza y revierte también la copia.
 execute 'truncate table '||lista_vaciar||' restart identity restrict';
 for fila in execute format('select nombre from %I.secuencias where reiniciar order by nombre',respaldo) loop
  execute format('alter sequence alexmar.%I restart with 1',fila.nombre);
 end loop;
 foreach tabla in array vaciar loop
  if to_regclass(format('alexmar.%I',tabla)) is not null then
   execute format('select count(*) from alexmar.%I',tabla) into n;
   if n<>0 then raise exception 'La tabla % no quedó vacía. Se revierte toda la limpieza.',tabla;end if;
  end if;
 end loop;
 -- Audita el reinicio sin eliminar el historial anterior.
 insert into alexmar.auditoria(usuario_id,tabla,operacion,registro_id,nuevo)
 values(auth.uid(),'reinicio_pruebas','LIMPIEZA',respaldo,jsonb_build_object('respaldo',respaldo,'tablas',vaciar,'sql_007',estado_007=4));
 execute format('update %I.control set estado=''limpiado'' where id=1',respaldo);
end
$limpieza$;

-- Solo conteos: no publica nombres, costos ni saldos comerciales.
select 'LIMPIEZA COMPLETADA' as resultado,
 'alexmar_respaldo_pruebas_20261122_v1' as respaldo_privado,
 (select sql_007 from alexmar_respaldo_pruebas_20261122_v1.control where id=1) as sql_007_instalado,
 (select count(*) from alexmar.productos) as productos,
 (select count(*) from alexmar.clientes) as clientes,
 (select count(*) from alexmar.ventas) as facturas,
 (select count(*) from alexmar.lotes) as lotes_importados,
 (select count(*) from alexmar.perfiles where activo and rol='administrador') as administradores_activos;
commit;

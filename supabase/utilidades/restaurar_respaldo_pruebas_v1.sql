-- RECUPERACIÓN MANUAL v1. NO ejecutar si la limpieza salió bien y vas a reimportar.
-- SOLO en el mismo Supabase NUEVO. Recupera los datos comerciales anteriores a la limpieza.
-- Exige que el destino siga vacío: nunca pisa una nueva importación ni operaciones nuevas.
-- Conserva usuarios, perfiles, filtros, fotos y auditoría actuales. No borra el respaldo.
-- Ejecutar TODO el archivo en SQL Editor como postgres. Transacción única.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
do $restauracion$
declare
 respaldo constant text := 'alexmar_respaldo_pruebas_20261122_v1';
 vaciar constant text[] := array[
  'clientes','productos','variantes','proveedores','ventas','compras',
  'lineas_venta','lineas_compra','pagos_venta','pagos_compra',
  'compatibilidades','clasificaciones_catalogo','movimientos_stock','reservas',
  'movimientos_cuenta','notas','lotes','origenes','revisiones_origen'
 ];
 conservar constant text[] := array['perfiles','consultas','fotos_vehiculo','auditoria'];
 lista text;tabla text;columnas text;firma jsonb;esperado jsonb;fila record;
 n bigint;respaldo_n bigint;coincide boolean;estado text;siguiente bigint;
begin
 if current_user in ('anon','authenticated','service_role') then
  raise exception 'Ejecuta esta utilidad solo desde SQL Editor como postgres.';
 end if;
 if to_regclass(respaldo||'.control') is null then raise exception 'No existe el respaldo de limpieza v1.';end if;
 perform pg_advisory_xact_lock(7061511);
 if exists(select 1 from pg_class c where c.relnamespace='alexmar'::regnamespace
  and c.relkind in ('r','p') and not(c.relname=any(vaciar||conservar))) then
  raise exception 'Hay tablas fuera del alcance revisado. No se restauró nada.';
 end if;
 select string_agg(format('alexmar.%I',relname),',' order by relname) into lista
 from pg_class where relnamespace='alexmar'::regnamespace and relkind in ('r','p');
 execute 'lock table '||lista||' in access exclusive mode';
 execute format('lock table %I.control in exclusive mode',respaldo);
 execute format('select estado from %I.control where id=1',respaldo) into estado;
 if estado is distinct from 'limpiado' then raise exception 'El respaldo no está pendiente de restauración.';end if;
 foreach tabla in array vaciar loop
  if to_regclass(format('alexmar.%I',tabla)) is not null then
   execute format('select count(*) from alexmar.%I',tabla) into n;
   if n<>0 then raise exception 'El destino contiene datos nuevos en %. No se sobrescribe: restauración cancelada.',tabla;end if;
  end if;
 end loop;
 foreach tabla in array vaciar loop
  execute format('select columnas,filas from %I.manifiesto where tabla=$1 and vaciada',respaldo) into esperado,respaldo_n using tabla;
  if esperado is null then continue;end if;
  if to_regclass(format('alexmar.%I',tabla)) is null then raise exception 'Falta la tabla %. No se restauró nada.',tabla;end if;
  select jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attgenerated,attidentity)order by attnum),
   string_agg(format('%I',attname),',' order by attnum)filter(where attgenerated='') into firma,columnas
  from pg_attribute where attrelid=to_regclass(format('alexmar.%I',tabla)) and attnum>0 and not attisdropped;
  if firma is distinct from esperado then raise exception 'La estructura de % cambió. No se restauró nada.',tabla;end if;
  execute format('insert into alexmar.%I(%s) overriding system value select %s from %I.%I',tabla,columnas,columnas,respaldo,tabla);
  execute format('select count(*) from alexmar.%I',tabla) into n;
  if n<>respaldo_n then raise exception 'Conteo de restauración distinto en %. Se revierte.',tabla;end if;
  execute format('select not exists((table alexmar.%I except table %I.%I) union all (table %I.%I except table alexmar.%I))',tabla,respaldo,tabla,respaldo,tabla,tabla) into coincide;
  if not coincide then raise exception 'Los valores restaurados de % no coinciden. Se revierte.',tabla;end if;
 end loop;
 for fila in execute format('select * from %I.secuencias where reiniciar order by nombre',respaldo) loop
  siguiente:=case when fila.llamada then fila.ultimo+fila.incremento else fila.ultimo end;
  -- ALTER RESTART es transaccional; no se usa setval, que sobreviviría a un rollback.
  execute format('alter sequence alexmar.%I restart with %s',fila.nombre,siguiente);
 end loop;
 insert into alexmar.auditoria(usuario_id,tabla,operacion,registro_id,nuevo)
 values(auth.uid(),'reinicio_pruebas','RESTAURACION',respaldo,jsonb_build_object('respaldo',respaldo));
 execute format('update %I.control set estado=''restaurado'',restaurado=clock_timestamp() where id=1',respaldo);
end
$restauracion$;
select 'RESPALDO RESTAURADO' as resultado;
commit;

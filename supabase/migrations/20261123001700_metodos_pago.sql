begin;
-- Amplía exclusivamente la lista de métodos. Conserva las funciones instaladas,
-- sus validaciones financieras, permisos, firmas e idempotencia.
do $$
declare firma text;funcion regprocedure;definicion text;
 anterior text:='(''Efectivo'',''Transferencia'',''Pago móvil'',''Tarjeta'',''Otro'')';
 nueva text:='(''Efectivo'',''Transferencia'',''Pago móvil'',''Tarjeta'',''Zelle'',''Binance'',''Otro'')';
begin
 if not exists(select 1 from information_schema.columns where table_schema='alexmar' and table_name='lineas_venta' and column_name='precio_personalizado') then
  raise exception 'Aplica primero el SQL 016 y después el SQL 017.';
 end if;
 foreach firma in array array[
  'public.guardar_venta(jsonb)',
  'public.cobrar_factura(jsonb)',
  'public.abonar_cuenta_cliente(jsonb)',
  'public.pagar_compra(jsonb)',
  'public.corregir_pago_compra(jsonb)'
 ] loop
  funcion:=to_regprocedure(firma);
  if funcion is null then raise exception 'Falta %. Aplica primero los SQL pendientes hasta 016.',firma;end if;
  definicion:=pg_get_functiondef(funcion);
  if strpos(definicion,anterior)>0 then
   execute replace(definicion,anterior,nueva);
  elsif strpos(definicion,nueva)=0 then
   raise exception 'La validación de métodos de % cambió. Revisa la instalación antes de actualizar.',firma;
  end if;
 end loop;
end $$;
alter table alexmar.pagos_compra drop constraint if exists pagos_compra_metodo_check;
alter table alexmar.pagos_compra add constraint pagos_compra_metodo_check
 check(metodo in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Zelle','Binance','Otro'));
commit;

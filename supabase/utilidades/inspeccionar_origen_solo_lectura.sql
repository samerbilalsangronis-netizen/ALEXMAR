-- Ejecutar SOLO consultas de lectura en el Supabase anterior.
-- Exportar cada resultado completo sin límite de filas. No publica datos en GitHub.
select schemaname,viewname,definition
from pg_views
where schemaname='public' and viewname in ('vista_saldos_clientes','vista_saldos_proveedores','inventario_publico');

select c.relname as tabla,t.tgname as disparador,pg_get_triggerdef(t.oid) as definicion,
 p.proname as funcion,pg_get_functiondef(p.oid) as codigo
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
join pg_proc p on p.oid=t.tgfoid
where n.nspname='public' and c.relname in ('clientes','detalle_cuentas','inventario')
  and not t.tgisinternal;

select 'inventario' tabla,count(*) total,count(*) filter(where not eliminado) vigentes from public.inventario
union all select 'clientes',count(*),count(*) filter(where not eliminado) from public.clientes
union all select 'detalle_cuentas',count(*),count(*) filter(where not eliminado) from public.detalle_cuentas
union all select 'notas',count(*),count(*) filter(where not eliminado) from public.notas;

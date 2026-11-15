-- Ejecutar SOLO en el Supabase ANTERIOR. Una única consulta de lectura.
-- Devuelve UNA FILA con tres columnas: vistas, disparadores y conteos.
-- Exporta el resultado como CSV y compártelo de forma privada; no lo subas a GitHub.
with vistas as (
  select schemaname, viewname, definition
  from pg_views
  where schemaname = 'public'
    and viewname in ('vista_saldos_clientes', 'vista_saldos_proveedores', 'inventario_publico')
), disparadores as (
  select c.relname as tabla, t.tgname as disparador,
    pg_get_triggerdef(t.oid) as definicion,
    nfunc.nspname as esquema_funcion, p.proname as funcion,
    pg_get_functiondef(p.oid) as codigo
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace nfunc on nfunc.oid = p.pronamespace
  where n.nspname = 'public'
    and c.relname in ('clientes', 'detalle_cuentas', 'inventario', 'proveedores', 'movimientos_proveedor')
    and not t.tgisinternal
), conteos as (
  select 'inventario' as tabla, count(*) as total,
    count(*) filter (where not eliminado) as vigentes from public.inventario
  union all select 'clientes', count(*), count(*) filter (where not eliminado) from public.clientes
  union all select 'detalle_cuentas', count(*), count(*) filter (where not eliminado) from public.detalle_cuentas
  union all select 'notas', count(*), count(*) filter (where not eliminado) from public.notas
  union all select 'proveedores', count(*), count(*) filter (where not eliminado) from public.proveedores
  union all select 'movimientos_proveedor', count(*), count(*) filter (where not eliminado) from public.movimientos_proveedor
)
select
  coalesce((select jsonb_agg(to_jsonb(v) order by viewname) from vistas v), '[]'::jsonb) as vistas,
  coalesce((select jsonb_agg(to_jsonb(d) order by tabla, disparador) from disparadores d), '[]'::jsonb) as disparadores,
  (select jsonb_agg(to_jsonb(c) order by tabla) from conteos c) as conteos;

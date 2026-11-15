-- Solo lectura. Ejecutar en el Supabase NUEVO para comprobar si se cargó el historial.
select 'productos' as tabla, count(*) as total, count(*) filter (where activo) as activos from alexmar.productos
union all select 'clientes', count(*), count(*) filter (where activo) from alexmar.clientes
union all select 'movimientos_cuenta', count(*), count(*) filter (where activo) from alexmar.movimientos_cuenta
union all select 'notas', count(*), count(*) filter (where activo) from alexmar.notas;

select count(*) as lotes_importados, max(creado) as ultima_importacion from alexmar.lotes;

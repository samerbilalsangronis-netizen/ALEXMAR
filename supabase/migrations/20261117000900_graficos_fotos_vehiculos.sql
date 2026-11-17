begin;
-- Repara la analítica incluso si se aplicó 008 sin instalar la actualización de origen 007.
-- No altera importaciones, existencias ni movimientos financieros.
create index if not exists cuenta_reversion_origen on alexmar.movimientos_cuenta((datos_originales->>'reversion_de')) where activo and origen='actualizacion_origen';
create or replace function public.analitica_comercial(p_desde date,p_hasta date) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare rol text; resultado jsonb; inicio timestamptz; fin timestamptz;
begin
 rol:=alexmar.exigir();
 if p_desde is null or p_hasta is null or p_hasta<p_desde or p_hasta-p_desde>366 then
 raise exception 'Selecciona un período de hasta 367 días.';end if;
 inicio:=p_desde::timestamp at time zone 'America/Caracas';
 fin:=(p_hasta+1)::timestamp at time zone 'America/Caracas';
 resultado:=jsonb_build_object('desde',p_desde,'hasta',p_hasta);
 if rol in ('administrador','inventario') then
 with filas as materialized(select * from alexmar.catalogo_organizado where activo),
 pares as(select *,greatest(fisico,0) unidades from filas where costo is not null and precio is not null),
 grupos as(select categoria_grupo nombre,count(*) productos,sum(unidades*costo) costo,sum(unidades*precio) venta,sum(unidades*(precio-costo)) margen from pares group by categoria_grupo)
 select resultado||jsonb_build_object('inventario',jsonb_build_object(
 'costo',(select coalesce(sum(unidades*costo),0)::text from pares),
 'venta',(select coalesce(sum(unidades*precio),0)::text from pares),
 'margen',(select coalesce(sum(unidades*(precio-costo)),0)::text from pares),
 'porcentaje',(select (100*sum(unidades*(precio-costo))/nullif(sum(unidades*precio),0))::text from pares),
 'completos',(select count(*) from pares),'total',(select count(*) from filas),
 'sin_costo',(select count(*) from filas where costo is null),
 'sin_precio',(select count(*) from filas where precio is null),
 'costo_cero',(select count(*) from pares where costo=0),
 'stock_negativo',(select count(*) from filas where fisico<0),
 'categorias',coalesce((select jsonb_agg(jsonb_build_object('nombre',nombre,'productos',productos,'costo',costo::text,'venta',venta::text,'margen',margen::text,'porcentaje',(100*margen/nullif(venta,0))::text) order by margen desc,nombre) from grupos),'[]'::jsonb))) into resultado;
 end if;
 if rol in ('administrador','ventas') then
 with facturas as materialized(select * from alexmar.ventas where estado='confirmada' and tipo='factura' and emitido>=inicio and emitido<fin),
 meses as(select generate_series(date_trunc('month',p_desde::timestamp),date_trunc('month',p_hasta::timestamp),interval '1 month') mes),
 serie as(select to_char(mes,'YYYY-MM') mes,coalesce(sum(v.total),0) total,count(v.id) facturas from meses left join facturas v on date_trunc('month',v.emitido at time zone 'America/Caracas')=mes group by mes),
 mejores as(select c.id,c.nombre,count(*) facturas,sum(v.total) total from facturas v join alexmar.clientes c on c.id=v.cliente_id group by c.id,c.nombre order by total desc,c.id limit 8)
 select resultado||jsonb_build_object('ventas',jsonb_build_object(
 'total',(select coalesce(sum(total),0)::text from facturas),'facturas',(select count(*) from facturas),
 'ticket',(select avg(total)::text from facturas),
 'serie',coalesce((select jsonb_agg(jsonb_build_object('mes',mes,'total',total::text,'facturas',facturas) order by mes) from serie),'[]'::jsonb),
 'clientes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'total',total::text,'facturas',facturas) order by total desc,id) from mejores),'[]'::jsonb))) into resultado;
 -- Ranking separado: cargos históricos son actividad de cuenta, no ventas verificadas.
 with actividad as (
 select c.id,c.nombre,sum(m.monto) filter(where m.tipo='CARGO') cargos,
 coalesce(sum(m.monto) filter(where m.tipo='ABONO'),0) abonos
 from alexmar.clientes c join alexmar.movimientos_cuenta m on m.cliente_id=c.id
 where c.activo and m.activo and m.origen='supabase_anterior' and m.moneda='USD'
 and not exists(select 1 from alexmar.movimientos_cuenta rev where rev.activo and rev.origen='actualizacion_origen' and rev.datos_originales->>'reversion_de'=m.id::text)
 group by c.id,c.nombre having coalesce(sum(m.monto) filter(where m.tipo='CARGO'),0)>0
 order by cargos desc,c.id limit 8)
 select resultado||jsonb_build_object('historial_clientes',coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'cargos',cargos::text,'abonos',abonos::text) order by cargos desc,id),'[]'::jsonb)) into resultado from actividad;
 end if;
 return resultado;
end $$;
revoke all on function public.analitica_comercial(date,date) from public,anon;
grant execute on function public.analitica_comercial(date,date) to authenticated;

create table alexmar.fotos_vehiculo(
 nombre text primary key check(length(trim(nombre)) between 1 and 100),
 archivo text not null check(length(archivo)<250),
 usuario_id uuid not null references auth.users(id),
 actualizado timestamptz not null default now()
);
alter table alexmar.fotos_vehiculo enable row level security;
revoke all on alexmar.fotos_vehiculo from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.fotos_vehiculo for each row execute function alexmar.auditar();
create function public.permiso_fotos_vehiculos(p_editar boolean default false) returns boolean
language sql stable security definer set search_path=pg_catalog,alexmar as $$
 select exists(select 1 from alexmar.perfiles where id=auth.uid() and activo and (not p_editar or rol='administrador'));
$$;
create function public.fotos_vehiculos() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin perform alexmar.exigir();return coalesce((select jsonb_agg(jsonb_build_object('nombre',nombre,'archivo',archivo) order by nombre) from alexmar.fotos_vehiculo),'[]'::jsonb);end $$;
create function public.guardar_foto_vehiculo(p_nombre text,p_archivo text) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador']);
 if p_archivo !~ ('^'||auth.uid()::text||'/[a-f0-9-]{36}[.](jpg|png|webp)$') then raise exception 'Archivo de foto inválido.';end if;
 if not exists(select 1 from storage.objects where bucket_id='alexmar-vehiculos' and name=p_archivo) then raise exception 'Primero debes subir la foto.';end if;
 insert into alexmar.fotos_vehiculo(nombre,archivo,usuario_id) values(trim(p_nombre),p_archivo,auth.uid())
 on conflict(nombre) do update set archivo=excluded.archivo,usuario_id=excluded.usuario_id,actualizado=now();
end $$;
revoke all on function public.permiso_fotos_vehiculos(boolean),public.fotos_vehiculos(),public.guardar_foto_vehiculo(text,text) from public,anon;
grant execute on function public.permiso_fotos_vehiculos(boolean),public.fotos_vehiculos(),public.guardar_foto_vehiculo(text,text) to authenticated;
-- Supabase trae Storage instalado; el entorno de pruebas SQL sin Storage solo valida los metadatos y la analítica.
do $$begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('alexmar-vehiculos','alexmar-vehiculos',false,3000000,array['image/jpeg','image/png','image/webp']);
  execute 'create policy alexmar_fotos_lectura on storage.objects for select to authenticated using (bucket_id=''alexmar-vehiculos'' and public.permiso_fotos_vehiculos(false))';
  execute 'create policy alexmar_fotos_alta on storage.objects for insert to authenticated with check (bucket_id=''alexmar-vehiculos'' and split_part(name,''/'',1)=auth.uid()::text and public.permiso_fotos_vehiculos(true))';
  execute 'create policy alexmar_fotos_borrado on storage.objects for delete to authenticated using (bucket_id=''alexmar-vehiculos'' and public.permiso_fotos_vehiculos(true))';
 end if;
end $$;
commit;

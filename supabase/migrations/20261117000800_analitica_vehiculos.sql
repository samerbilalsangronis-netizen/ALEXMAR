begin;
-- Solo lectura: organiza menciones del catálogo; no certifica compatibilidad.
create function alexmar.marcas_vehiculo(modelos text[],texto text) returns text[]
language sql immutable set search_path=pg_catalog,alexmar as $$
with etiquetas as (
 select case
 when alexmar.normalizar(m) ~ '^(fiesta|super duty|triton|ranger|f-150|bronco|ford ka|ford \(sin modelo\))$' then 'Ford'
 when alexmar.normalizar(m) ~ '^(hilux|fortuner|corolla|runner|toyota \(sin modelo\))$' then 'Toyota'
 when alexmar.normalizar(m) ~ '^(aveo|corsa|silverado|cheyenne|chevrolet \(sin modelo\))$' then 'Chevrolet'
 when alexmar.normalizar(m) ~ '^(npr|fvr|d-max)$' then 'Isuzu / Chevrolet'
 when alexmar.normalizar(m)='l200' then 'Mitsubishi'
 when alexmar.normalizar(m)='samurai' then 'Suzuki'
 when alexmar.normalizar(m) ~ '^(bt-50|mazda \(sin modelo\))$' then 'Mazda'
 when m='Universal declarado' then 'Universal'
 else null end marca from unnest(modelos) m
 union all
 select marca from (values ('Ford'),('Toyota'),('Chevrolet'),('Hyundai'),('Fiat'),('Mazda'),('Iveco'),('Isuzu'),('Mitsubishi'),('Suzuki'),('Volkswagen'),('Nissan'),('Renault'),('Kia')) x(marca)
 where alexmar.normalizar(texto) ~ ('\m'||alexmar.normalizar(marca)||'\M')
), distintas as(select distinct marca from etiquetas where marca is not null)
select coalesce(array_agg(marca order by marca),array['Por identificar']) from distintas;
$$;
revoke all on function alexmar.marcas_vehiculo(text[],text) from public,anon,authenticated;
create or replace function alexmar.filtrar_catalogo(p jsonb) returns setof alexmar.catalogo_organizado
language sql stable as $$
 select a.* from alexmar.catalogo_organizado a where
 (coalesce(p->>'estado','activos')='todos' or a.activo=(coalesce(p->>'estado','activos')='activos'))
 and (coalesce(p->>'categoria','')='' or alexmar.normalizar(a.categoria_grupo)=alexmar.normalizar(p->>'categoria') or a.categoria=p->>'categoria')
 and (coalesce(p->>'categoria_origen','')='' or a.categoria=p->>'categoria_origen')
 and (coalesce(p->>'modelo','')='' or exists(select 1 from unnest(a.vehiculos) m where alexmar.normalizar(m)=alexmar.normalizar(p->>'modelo')))
 and (coalesce(p->>'marca_vehiculo','')='' or p->>'marca_vehiculo'=any(alexmar.marcas_vehiculo(a.vehiculos,a.nombre||' '||a.compatibilidad||' '||a.categoria)))
 and (coalesce(p->>'marca','')='' or a.marca=p->>'marca')
 and (coalesce(p->>'precio','')='' or (p->>'precio'='sin' and a.precio is null) or (p->>'precio'='con' and a.precio is not null))
 and (coalesce(p->>'ubicacion','')='' or strpos(alexmar.normalizar(a.ubicacion),alexmar.normalizar(p->>'ubicacion'))>0)
 and (coalesce(p->>'q','')='' or not exists(select 1 from unnest(string_to_array(alexmar.normalizar(p->>'q'),' ')) palabra where strpos(a.texto,palabra)=0) or extensions.word_similarity(alexmar.normalizar(p->>'q'),a.texto)>0.45)
 and (
   (coalesce(p->>'anio','')='' and (coalesce(p->>'vehiculo','')='' or strpos(alexmar.normalizar(a.compatibilidad),alexmar.normalizar(p->>'vehiculo'))>0))
   or exists(select 1 from alexmar.compatibilidades c where c.producto_id=a.id and (c.universal or (
     (coalesce(p->>'vehiculo','')='' or strpos(alexmar.normalizar(c.marca||' '||c.modelo),alexmar.normalizar(p->>'vehiculo'))>0)
     and (coalesce(p->>'anio','')='' or (
       (c.anio_desde is not null or c.anio_hasta is not null)
       and (c.anio_desde is null or c.anio_desde<=(p->>'anio')::int)
       and (c.anio_hasta is null or c.anio_hasta>=(p->>'anio')::int)
       and (coalesce(p->>'modelo','')='' or strpos(alexmar.normalizar(c.marca||' '||c.modelo),alexmar.normalizar(p->>'modelo'))>0)
     ))
   )))
 )
 and (coalesce(p->>'precio_min','')='' or a.precio>=(p->>'precio_min')::numeric)
 and (coalesce(p->>'precio_max','')='' or a.precio<=(p->>'precio_max')::numeric)
 and (coalesce(p->>'stock','')='' or (p->>'stock'='disponible' and a.disponible>0) or (p->>'stock'='agotado' and a.disponible<=0) or (p->>'stock'='bajo' and a.disponible<a.minimo));
$$;

create or replace function public.grupos_inventario(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir();
 return (with filas as materialized(select * from alexmar.filtrar_catalogo(p))
 select jsonb_build_object('total',(select count(*) from filas),
 'categorias',coalesce((select jsonb_agg(to_jsonb(g) order by nombre) from (select min(categoria_grupo) nombre,count(*) total from filas group by alexmar.normalizar(categoria_grupo)) g),'[]'::jsonb),
 'vehiculos',coalesce((select jsonb_agg(to_jsonb(g) order by nombre) from (select min(m) nombre,count(*) total from filas cross join lateral unnest(vehiculos) m group by alexmar.normalizar(m)) g),'[]'::jsonb),
 'marcas_vehiculo',coalesce((select jsonb_agg(to_jsonb(g) order by nombre) from (select m nombre,count(*) total from filas cross join lateral unnest(alexmar.marcas_vehiculo(vehiculos,nombre||' '||compatibilidad||' '||categoria)) m group by m) g),'[]'::jsonb)));
end $$;

create function public.analitica_comercial(p_desde date,p_hasta date) returns jsonb
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
 join alexmar.procedencia_actual o on o.tipo='detalle_cuentas' and o.nuevo_id=m.id
 where c.activo and m.activo and m.origen='supabase_anterior' and m.moneda='USD'
 group by c.id,c.nombre having coalesce(sum(m.monto) filter(where m.tipo='CARGO'),0)>0
 order by cargos desc,c.id limit 8)
 select resultado||jsonb_build_object('historial_clientes',coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'cargos',cargos::text,'abonos',abonos::text) order by cargos desc,id),'[]'::jsonb)) into resultado from actividad;
 end if;
 return resultado;
end $$;
revoke all on function public.analitica_comercial(date,date) from public,anon;
grant execute on function public.analitica_comercial(date,date) to authenticated;
commit;

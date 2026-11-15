begin;
create index compatibilidad_producto on alexmar.compatibilidades(producto_id,id);

create function public.listar_compatibilidades(p_producto uuid, p_pagina integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare pag integer:=greatest(1,coalesce(p_pagina,1)); total bigint;
begin
 perform alexmar.exigir();
 select count(*) into total from alexmar.compatibilidades where producto_id=p_producto;
 return jsonb_build_object('total',total,'pagina',pag,'paginas',greatest(1,ceil(total/30.0)),
 'filas',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from (
 select id,marca,modelo,anio_desde,anio_hasta,universal from alexmar.compatibilidades
 where producto_id=p_producto order by id limit 30 offset (pag::bigint-1)*30) c),'[]'::jsonb));
end $$;

create function public.guardar_compatibilidad(p_producto uuid,p jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 v_universal boolean:=coalesce((p->>'universal')::boolean,false);
 v_marca text:=trim(coalesce(p->>'marca','')); v_modelo text:=trim(coalesce(p->>'modelo',''));
 v_desde integer:=nullif(p->>'anio_desde','')::integer; v_hasta integer:=nullif(p->>'anio_hasta','')::integer;
begin
 perform alexmar.exigir(array['administrador','inventario']);
 -- Serializa escrituras y reintentos sobre un mismo producto.
 perform 1 from alexmar.productos where id=p_producto for update;
 if not found then raise exception 'Producto no encontrado.'; end if;
 if v_universal then
   if v_marca<>'' or v_modelo<>'' or v_desde is not null or v_hasta is not null then
     raise exception 'La compatibilidad universal no lleva marca, modelo ni años.';
   end if;
 elsif v_marca='' or v_modelo='' then raise exception 'Indica marca y modelo verificados.';
 end if;
 if (v_desde is not null and v_desde not between 1886 and 2200) or
    (v_hasta is not null and v_hasta not between 1886 and 2200) or
    (v_desde is not null and v_hasta is not null and v_desde>v_hasta) then
   raise exception 'Revisa el rango de años (1886 a 2200).';
 end if;
 if length(v_marca)>100 or length(v_modelo)>150 then raise exception 'Marca o modelo demasiado largo.'; end if;
 if nullif(p->>'id','') is not null and not exists(
   select 1 from alexmar.compatibilidades c where c.id=ident and c.producto_id=p_producto
 ) then raise exception 'Compatibilidad no encontrada en este producto.'; end if;
 if exists(select 1 from alexmar.compatibilidades c where c.producto_id=p_producto and c.id<>ident
   and c.universal=v_universal and alexmar.normalizar(c.marca)=alexmar.normalizar(v_marca)
   and alexmar.normalizar(c.modelo)=alexmar.normalizar(v_modelo)
   and c.anio_desde is not distinct from v_desde and c.anio_hasta is not distinct from v_hasta) then
   raise exception 'Esta compatibilidad ya está registrada.';
 end if;
 insert into alexmar.compatibilidades(id,producto_id,marca,modelo,anio_desde,anio_hasta,universal)
 values(ident,p_producto,v_marca,v_modelo,v_desde,v_hasta,v_universal)
 on conflict(id) do update set marca=excluded.marca,modelo=excluded.modelo,
 anio_desde=excluded.anio_desde,anio_hasta=excluded.anio_hasta,universal=excluded.universal;
 return ident;
end $$;

create function public.eliminar_compatibilidad(p_producto uuid,p_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','inventario']);
 perform 1 from alexmar.productos where id=p_producto for update;
 delete from alexmar.compatibilidades where id=p_id and producto_id=p_producto;
 -- Repetir la eliminación es seguro. El trigger existente conserva la auditoría.
end $$;
revoke all on function public.listar_compatibilidades(uuid,integer),public.guardar_compatibilidad(uuid,jsonb),public.eliminar_compatibilidad(uuid,uuid) from public,anon;
grant execute on function public.listar_compatibilidades(uuid,integer),public.guardar_compatibilidad(uuid,jsonb),public.eliminar_compatibilidad(uuid,uuid) to authenticated;

create or replace function public.buscar_productos(p jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar,extensions as $$
declare r text;resultado jsonb;pag integer:=greatest(1,least(coalesce((p->>'pagina')::int,1),100000));q text:=alexmar.normalizar(p->>'q');begin
r:=alexmar.exigir();
with base as (
 select a.*,v.id variante_id,v.precio,v.costo,v.minimo,
 coalesce((select sum(cantidad) from alexmar.movimientos_stock where variante_id=v.id),0) fisico,
 coalesce((select sum(cantidad) from alexmar.reservas where variante_id=v.id and estado='activa'),0) reservado,
 alexmar.normalizar(a.nombre||' '||coalesce(a.descripcion,'')||' '||a.categoria||' '||a.compatibilidad||' '||a.marca||' '||a.referencia||' '||a.alias||' '||coalesce((select string_agg(c.marca||' '||c.modelo||' '||coalesce(c.anio_desde::text,''),' ') from alexmar.compatibilidades c where c.producto_id=a.id),'')) texto
 from alexmar.productos a join alexmar.variantes v on v.producto_id=a.id and v.nombre='Principal'
), filtrados as (
 select *,fisico-reservado disponible,case when q=alexmar.normalizar(referencia) and q<>'' then 0 when q=alexmar.normalizar(nombre) then 1 when not exists(select 1 from unnest(string_to_array(q,' ')) palabra where strpos(texto,palabra)=0) then 2 else 3 end rango
 from base where
 (coalesce(p->>'estado','activos')='todos' or activo=(coalesce(p->>'estado','activos')='activos'))
 and (coalesce(p->>'categoria','')='' or categoria=p->>'categoria')
 and (coalesce(p->>'marca','')='' or marca=p->>'marca')
 and (coalesce(p->>'precio','')='' or (p->>'precio'='sin' and precio is null) or (p->>'precio'='con' and precio is not null))
 and (coalesce(p->>'ubicacion','')='' or strpos(alexmar.normalizar(ubicacion),alexmar.normalizar(p->>'ubicacion'))>0)
 and (q='' or not exists(select 1 from unnest(string_to_array(q,' ')) palabra where strpos(texto,palabra)=0) or extensions.word_similarity(q,texto)>0.45)
 -- Vehículo y año deben coincidir en la misma compatibilidad verificada.
 and (
   (coalesce(p->>'anio','')='' and (coalesce(p->>'vehiculo','')=''
     or strpos(alexmar.normalizar(compatibilidad),alexmar.normalizar(p->>'vehiculo'))>0))
   or exists(select 1 from alexmar.compatibilidades c where c.producto_id=base.id
     and (c.universal or (
       (coalesce(p->>'vehiculo','')='' or strpos(alexmar.normalizar(c.marca||' '||c.modelo),alexmar.normalizar(p->>'vehiculo'))>0)
       and (coalesce(p->>'anio','')='' or (
         (c.anio_desde is not null or c.anio_hasta is not null)
         and (c.anio_desde is null or c.anio_desde<=(p->>'anio')::int)
         and (c.anio_hasta is null or c.anio_hasta>=(p->>'anio')::int)
       ))
     ))
   )
 )
 and (coalesce(p->>'precio_min','')='' or precio>=(p->>'precio_min')::numeric)
 and (coalesce(p->>'precio_max','')='' or precio<=(p->>'precio_max')::numeric)
), seleccion as (
 select * from filtrados where (coalesce(p->>'stock','')='' or (p->>'stock'='disponible' and disponible>0) or (p->>'stock'='agotado' and disponible<=0) or (p->>'stock'='bajo' and disponible<minimo))
), ordenados as (
 select *,row_number() over(order by
 case when coalesce(p->>'orden','relevancia')='relevancia' then rango end,
 case when p->>'orden'='precio' then precio end nulls last,
 case when p->>'orden'='existencia' then disponible end desc,
 case when coalesce(p->>'orden','relevancia')='relevancia' then extensions.word_similarity(q,texto) end desc,
 nombre,id) posicion from seleccion
), pagina as (select * from ordenados where posicion between (pag-1)*30+1 and pag*30)
select jsonb_build_object('filas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'variante_id',variante_id,'nombre',nombre,'descripcion',descripcion,'categoria',categoria,'compatibilidad',compatibilidad,'marca',marca,'referencia',referencia,'alias',alias,'ubicacion',ubicacion,'activo',activo,'precio',precio::text,'minimo',minimo::text,'fisico',fisico::text,'reservado',reservado::text,'disponible',disponible::text,'aproximado',rango=3)||case when r in ('administrador','inventario') then jsonb_build_object('costo',costo::text) else '{}'::jsonb end order by posicion) from pagina),'[]'::jsonb),'total',(select count(*) from seleccion),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from seleccion)/30.0))) into resultado;return resultado;end $$;

commit;

begin;
create table alexmar.proveedores (
 id uuid primary key default gen_random_uuid(),
 nombre text not null check(length(trim(nombre)) between 1 and 200),
 documento text not null default '', contacto text not null default '',
 telefono text not null default '', correo text not null default '',
 direccion text not null default '', ciudad text not null default '',
 categorias text not null default '', marcas text not null default '',
 condiciones text not null default '', monedas text[] not null default array['USD']::text[]
   check(cardinality(monedas)>0 and monedas <@ array['USD','VES','COP']::text[]),
 notas text not null default '', activo boolean not null default true,
 creado timestamptz not null default now()
);
alter table alexmar.proveedores enable row level security;
revoke all on alexmar.proveedores from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.proveedores
 for each row execute function alexmar.auditar();
create index proveedor_nombre on alexmar.proveedores(nombre,id);

create function public.guardar_proveedor(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid()); divisas text[];
begin
 perform alexmar.exigir(array['administrador','inventario']);
 if nullif(p->>'id','') is not null and not exists(select 1 from alexmar.proveedores where id=ident)
 then raise exception 'Proveedor no encontrado.'; end if;
 if trim(coalesce(p->>'nombre',''))='' then raise exception 'Indica el nombre del proveedor.'; end if;
 select array_agg(distinct value) into divisas from jsonb_array_elements_text(coalesce(p->'monedas','["USD"]'::jsonb));
 if divisas is null or not(divisas <@ array['USD','VES','COP']::text[]) then raise exception 'Selecciona monedas válidas.'; end if;
 insert into alexmar.proveedores(id,nombre,documento,contacto,telefono,correo,direccion,ciudad,categorias,marcas,condiciones,monedas,notas,activo)
 values(ident,trim(p->>'nombre'),coalesce(p->>'documento',''),coalesce(p->>'contacto',''),coalesce(p->>'telefono',''),coalesce(p->>'correo',''),coalesce(p->>'direccion',''),coalesce(p->>'ciudad',''),coalesce(p->>'categorias',''),coalesce(p->>'marcas',''),coalesce(p->>'condiciones',''),divisas,coalesce(p->>'notas',''),coalesce((p->>'activo')::boolean,true))
 on conflict(id) do update set nombre=excluded.nombre,documento=excluded.documento,contacto=excluded.contacto,telefono=excluded.telefono,correo=excluded.correo,direccion=excluded.direccion,ciudad=excluded.ciudad,categorias=excluded.categorias,marcas=excluded.marcas,condiciones=excluded.condiciones,monedas=excluded.monedas,notas=excluded.notas,activo=excluded.activo;
 return ident;
end $$;

create function public.buscar_proveedores(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare pag integer:=greatest(1,coalesce((p->>'pagina')::integer,1)); r jsonb;
begin
 perform alexmar.exigir(array['administrador','inventario']);
 with filtrados as (
 select * from alexmar.proveedores a where
 (coalesce(p->>'estado','activos')='todos' or activo=(coalesce(p->>'estado','activos')='activos'))
 and (coalesce(p->>'q','')='' or strpos(alexmar.normalizar(a.nombre||' '||a.documento||' '||a.contacto||' '||a.telefono||' '||a.ciudad||' '||a.categorias||' '||a.marcas),alexmar.normalizar(p->>'q'))>0)
 and (coalesce(p->>'moneda','')='' or p->>'moneda'=any(monedas))
 ), hoja as (select * from filtrados order by nombre,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(hoja) order by nombre,id) from hoja),'[]'::jsonb),
 'total',(select count(*) from filtrados),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from filtrados)/30.0))) into r;
 return r;
end $$;

create function public.metricas_generales() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare rol text; r jsonb;
begin
 rol:=alexmar.exigir();
 with existencias as (
 select v.id,v.precio,v.minimo,
 coalesce((select sum(cantidad) from alexmar.movimientos_stock where variante_id=v.id),0)
 -coalesce((select sum(cantidad) from alexmar.reservas where variante_id=v.id and estado='activa'),0) disponible
 from alexmar.variantes v join alexmar.productos a on a.id=v.producto_id where a.activo
 ) select jsonb_build_object(
 'productos_activos',(select count(*) from alexmar.productos where activo),
 'sin_precio',count(*) filter(where precio is null),
 'agotadas',count(*) filter(where disponible<=0),
 'bajo_minimo',count(*) filter(where disponible<minimo)) into r from existencias;
 if rol in ('administrador','inventario') then
 r:=r||jsonb_build_object('proveedores_activos',(select count(*) from alexmar.proveedores where activo));
 end if;
 if rol in ('administrador','ventas') then
 r:=r||jsonb_build_object('clientes_activos',(select count(*) from alexmar.clientes where activo),
 'cuentas',(select jsonb_agg(jsonb_build_object('moneda',d.moneda,'cargos',d.cargos::text,'abonos',d.abonos::text,'saldo',(d.cargos-d.abonos)::text) order by d.moneda) from (
 select monedas.moneda,
 coalesce(sum(m.monto) filter(where m.tipo='CARGO'),0) cargos,
 coalesce(sum(m.monto) filter(where m.tipo='ABONO'),0) abonos
 from unnest(array['USD','VES','COP']) monedas(moneda)
 left join (select m.* from alexmar.movimientos_cuenta m join alexmar.clientes c on c.id=m.cliente_id where m.activo and c.activo) m on m.moneda=monedas.moneda
 group by monedas.moneda) d));
 end if;
 return r;
end $$;
revoke all on function public.guardar_proveedor(jsonb),public.buscar_proveedores(jsonb),public.metricas_generales() from public,anon;
grant execute on function public.guardar_proveedor(jsonb),public.buscar_proveedores(jsonb),public.metricas_generales() to authenticated;
commit;

begin;
-- Regla aprobada: vista del origen, sin usar total_adeudado para crear deuda.
-- numeric sin escala fija conserva los decimales; no se transforma ningún CSV.
alter table alexmar.variantes alter column precio type numeric, alter column costo type numeric, alter column minimo type numeric;
alter table alexmar.movimientos_stock alter column cantidad type numeric;
alter table alexmar.reservas alter column cantidad type numeric;
alter table alexmar.movimientos_cuenta alter column monto type numeric;

create function alexmar.numero_migracion(t text, obligatorio boolean default true, negativo boolean default false)
returns numeric language plpgsql immutable set search_path=pg_catalog as $$
declare n numeric;
begin
 if t is null or t in ('','null') then
   if obligatorio then raise exception 'Falta un importe o cantidad.'; end if;
   return null;
 end if;
 if t !~ '^[+-]?[0-9]+([.][0-9]{1,80})?$' then raise exception 'Formato numérico no válido (máximo 80 decimales).'; end if;
 n:=t::numeric;
 if abs(n)>=10000000000000000 or (not negativo and n<0) then raise exception 'Importe fuera de rango o negativo.'; end if;
 return n;
end $$;
revoke all on function alexmar.numero_migracion(text,boolean,boolean) from public,anon,authenticated;

-- La firma nueva exige los saldos exactos de la simulación; la anterior se retira.
drop function public.importar_inicial(jsonb,text);
create function public.importar_inicial(p jsonb,p_huella text,p_conciliacion jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare lote uuid; r jsonb; v uuid; res jsonb; tabla text; campo text;
 firma text:=encode(sha256(convert_to(jsonb_build_object('datos',p,'conciliacion',p_conciliacion)::text,'UTF8')),'hex');
begin
 perform alexmar.exigir(array['administrador']);
 perform pg_advisory_xact_lock(7061511);
 if p_huella is null or p_huella !~ '^[0-9a-f]{64}$' then raise exception 'Huella inválida.'; end if;
 select resumen into res from alexmar.lotes where huella=p_huella;
 if found then
   if res->>'firma_datos' is distinct from firma then raise exception 'La huella ya corresponde a otros datos. Repite la simulación.'; end if;
   return res||jsonb_build_object('repetido',true);
 end if;
 if exists(select 1 from alexmar.productos) or exists(select 1 from alexmar.clientes)
    or exists(select 1 from alexmar.notas) or exists(select 1 from alexmar.movimientos_cuenta)
    or exists(select 1 from alexmar.lotes) then
   raise exception 'La importación inicial requiere un destino vacío. No se sobrescribe información existente.';
 end if;
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>12000000 then raise exception 'Carga inválida o demasiado grande.'; end if;
 foreach tabla in array array['inventario','clientes','detalle_cuentas','notas'] loop
   if jsonb_typeof(p->tabla) is distinct from 'array' then raise exception 'Falta la tabla %.',tabla; end if;
   if exists(select 1 from jsonb_array_elements(p->tabla) x where
     jsonb_typeof(x) is distinct from 'object' or
     coalesce(x->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or
     coalesce(x->>'eliminado','') not in ('true','false')) then raise exception 'ID o estado inválido en %.',tabla; end if;
   if (select count(*) from jsonb_array_elements(p->tabla))<>(select count(distinct (x->>'id')::uuid) from jsonb_array_elements(p->tabla) x) then raise exception 'IDs repetidos en %.',tabla; end if;
 end loop;
 for r in select value from jsonb_array_elements(p->'inventario') loop
   if trim(coalesce(r->>'nombre_producto',''))='' then raise exception 'Producto sin nombre.'; end if;
   foreach campo in array array['costo','pvp','stock_actual','stock_minimo'] loop
     perform alexmar.numero_migracion(r->>campo,campo in ('stock_actual','stock_minimo'));
   end loop;
 end loop;
 for r in select value from jsonb_array_elements(p->'clientes') loop
   if trim(coalesce(r->>'nombre_cliente',''))='' then raise exception 'Cliente sin nombre.'; end if;
   perform alexmar.numero_migracion(r->>'total_adeudado',true,true);
 end loop;
 for r in select value from jsonb_array_elements(p->'detalle_cuentas') loop
   if coalesce(r->>'tipo_linea','') not in ('CARGO','ABONO','TITULO') then raise exception 'Tipo de movimiento inválido.'; end if;
   if not exists(select 1 from jsonb_array_elements(p->'clientes') c where (c->>'id')::uuid=(r->>'id_cliente')::uuid) then raise exception 'Cliente inexistente en movimiento.'; end if;
   if coalesce(r->>'id_producto','') not in ('','null') and not exists(select 1 from jsonb_array_elements(p->'inventario') a where (a->>'id')::uuid=(r->>'id_producto')::uuid) then raise exception 'Producto inexistente en movimiento.'; end if;
   if nullif(r->>'fecha','') is null or not isfinite((r->>'fecha')::timestamptz) then raise exception 'Fecha inválida.'; end if;
   perform alexmar.numero_migracion(r->>'total_linea');
 end loop;
 if jsonb_typeof(p_conciliacion) is distinct from 'array' then raise exception 'Falta la conciliación de la simulación.'; end if;
 if jsonb_array_length(p_conciliacion)<>jsonb_array_length(p->'clientes') or
    (select count(distinct (c->>'id')::uuid) from jsonb_array_elements(p_conciliacion) c)<>jsonb_array_length(p->'clientes') then raise exception 'Conciliación incompleta o repetida.'; end if;
 for r in select value from jsonb_array_elements(p_conciliacion) loop
   if not exists(select 1 from jsonb_array_elements(p->'clientes') c where (c->>'id')::uuid=(r->>'id')::uuid) then raise exception 'Cliente desconocido en conciliación.'; end if;
   if alexmar.numero_migracion(r->>'saldo',true,true) is distinct from (
     select coalesce(sum(case m->>'tipo_linea' when 'CARGO' then (m->>'total_linea')::numeric when 'ABONO' then -(m->>'total_linea')::numeric else 0 end),0)
     from jsonb_array_elements(p->'detalle_cuentas') m where (m->>'id_cliente')::uuid=(r->>'id')::uuid and m->>'eliminado'='false'
   ) then raise exception 'La conciliación no coincide con los movimientos exactos. No se importó nada.'; end if;
 end loop;
 res:=jsonb_build_object('inventario',jsonb_array_length(p->'inventario'),'clientes',jsonb_array_length(p->'clientes'),'detalle_cuentas',jsonb_array_length(p->'detalle_cuentas'),'notas',jsonb_array_length(p->'notas'),'moneda','USD','regla','vista_saldos_clientes_sin_redondeo_v1','firma_datos',firma);
 insert into alexmar.lotes(huella,resumen,usuario_id) values(p_huella,res,auth.uid()) returning id into lote;
for r in select value from jsonb_array_elements(p->'inventario') loop
 insert into alexmar.productos(id,nombre,descripcion,categoria,compatibilidad,activo,origen) values((r->>'id')::uuid,r->>'nombre_producto',r->>'descripcion',coalesce(r->>'categoria_tags',''),coalesce(r->>'compatibilidad_vehiculos',''),not (r->>'eliminado')::boolean,'supabase_anterior');
 insert into alexmar.variantes(producto_id,precio,costo,minimo) values((r->>'id')::uuid,nullif(nullif(r->>'pvp',''),'null')::numeric,nullif(nullif(r->>'costo',''),'null')::numeric,(r->>'stock_minimo')::numeric) returning id into v;
 insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia) values(v,(r->>'stock_actual')::numeric,'Existencia inicial migrada; historial anterior no descuenta stock',auth.uid(),'migracion:'||(r->>'id'));
 insert into alexmar.origenes values('inventario',r->>'id',(r->>'id')::uuid,lote,r);
end loop;
for r in select value from jsonb_array_elements(p->'clientes') loop
 insert into alexmar.clientes(id,nombre,documento,telefono,direccion,activo,origen) values((r->>'id')::uuid,r->>'nombre_cliente',r->>'cedula',r->>'telefono',r->>'direccion',not (r->>'eliminado')::boolean,'supabase_anterior');
 insert into alexmar.origenes values('clientes',r->>'id',(r->>'id')::uuid,lote,r);
end loop;
for r in select value from jsonb_array_elements(p->'detalle_cuentas') loop
 insert into alexmar.movimientos_cuenta(id,cliente_id,tipo,fecha,descripcion,moneda,monto,activo,origen,datos_originales) values((r->>'id')::uuid,(r->>'id_cliente')::uuid,r->>'tipo_linea',(r->>'fecha')::timestamptz,coalesce(r->>'descripcion',''),'USD',(r->>'total_linea')::numeric,not (r->>'eliminado')::boolean,'supabase_anterior',r);
 insert into alexmar.origenes values('detalle_cuentas',r->>'id',(r->>'id')::uuid,lote,r);
end loop;
for r in select value from jsonb_array_elements(p->'notas') loop
 insert into alexmar.notas(id,titulo,contenido,activo,origen) values((r->>'id')::uuid,coalesce(r->>'titulo',''),coalesce(r->>'contenido',''),not (r->>'eliminado')::boolean,'supabase_anterior');
 insert into alexmar.origenes values('notas',r->>'id',(r->>'id')::uuid,lote,r);
end loop;

-- Verificación posterior a la inserción, dentro de la misma transacción.
if exists(select 1 from jsonb_array_elements(p_conciliacion) c where
 (c->>'saldo')::numeric is distinct from (
   select coalesce(sum(case m.tipo when 'CARGO' then m.monto when 'ABONO' then -m.monto else 0 end),0)
   from alexmar.movimientos_cuenta m where m.cliente_id=(c->>'id')::uuid and m.activo
 )) then raise exception 'La carga no conserva los saldos simulados. Transacción cancelada.'; end if;
if (select count(*) from alexmar.origenes where lote_id=lote)<>
 jsonb_array_length(p->'inventario')+jsonb_array_length(p->'clientes')+jsonb_array_length(p->'detalle_cuentas')+jsonb_array_length(p->'notas') then
 raise exception 'La carga no conserva todos los registros. Transacción cancelada.'; end if;
return res||jsonb_build_object('lote',lote);
end $$;
revoke all on function public.importar_inicial(jsonb,text,jsonb) from public,anon;
grant execute on function public.importar_inicial(jsonb,text,jsonb) to authenticated;
commit;

begin;
-- Mantiene intacta la procedencia inicial y registra cada versión posterior.
create table alexmar.revisiones_origen(
 id bigint generated always as identity primary key,
 tipo text not null,origen_id text not null,nuevo_id uuid not null,
 lote_id uuid not null references alexmar.lotes,
 anterior jsonb not null,nuevo jsonb not null,creado timestamptz not null default now()
);
create index revision_origen_ultima on alexmar.revisiones_origen(tipo,origen_id,id desc);
alter table alexmar.revisiones_origen enable row level security;
revoke all on alexmar.revisiones_origen from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.revisiones_origen for each row execute function alexmar.auditar();
create view alexmar.procedencia_actual as
 select o.tipo,o.origen_id,coalesce(r.nuevo_id,o.nuevo_id) nuevo_id,coalesce(r.nuevo,o.datos) datos
 from alexmar.origenes o left join lateral(
 select nuevo_id,nuevo from alexmar.revisiones_origen where tipo=o.tipo and origen_id=o.origen_id order by id desc limit 1
 ) r on true;
revoke all on alexmar.procedencia_actual from public,anon,authenticated;

create function alexmar.validar_actualizacion(p jsonb,p_conciliacion jsonb) returns void
language plpgsql set search_path=pg_catalog,alexmar as $$
declare tabla text;r jsonb;campo text;
begin
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
end $$;

create function alexmar.campos_origen(t text,d jsonb) returns jsonb
language plpgsql stable set search_path=pg_catalog,alexmar as $$
begin
 case t
 when 'inventario' then return jsonb_build_object('nombre',d->>'nombre_producto','descripcion',coalesce(d->>'descripcion',''),'categoria',coalesce(d->>'categoria_tags',''),'compatibilidad',coalesce(d->>'compatibilidad_vehiculos',''),'activo',not(d->>'eliminado')::boolean,'precio',alexmar.numero_migracion(d->>'pvp',false),'costo',alexmar.numero_migracion(d->>'costo',false),'minimo',alexmar.numero_migracion(d->>'stock_minimo'),'fisico',alexmar.numero_migracion(d->>'stock_actual'));
 when 'clientes' then return jsonb_build_object('nombre',d->>'nombre_cliente','documento',coalesce(d->>'cedula',''),'telefono',coalesce(d->>'telefono',''),'direccion',coalesce(d->>'direccion',''),'activo',not(d->>'eliminado')::boolean);
 when 'detalle_cuentas' then return jsonb_build_object('cliente_id',(d->>'id_cliente')::uuid,'tipo',d->>'tipo_linea','moneda','USD','fecha',(d->>'fecha')::timestamptz,'descripcion',coalesce(d->>'descripcion',''),'monto',alexmar.numero_migracion(d->>'total_linea'),'activo',not(d->>'eliminado')::boolean);
 when 'notas' then return jsonb_build_object('titulo',coalesce(d->>'titulo',''),'contenido',coalesce(d->>'contenido',''),'activo',not(d->>'eliminado')::boolean);
 else raise exception 'Tabla de origen inválida.';end case;
end $$;
create function alexmar.estado_origen(t text,ident uuid) returns jsonb
language plpgsql stable set search_path=pg_catalog,alexmar as $$
begin
 case t
 when 'inventario' then return(select jsonb_build_object('nombre',a.nombre,'descripcion',coalesce(a.descripcion,''),'categoria',a.categoria,'compatibilidad',a.compatibilidad,'activo',a.activo,'precio',v.precio,'costo',v.costo,'minimo',v.minimo,'fisico',coalesce((select sum(cantidad) from alexmar.movimientos_stock where variante_id=v.id),0),'reservado',coalesce((select sum(cantidad) from alexmar.reservas where variante_id=v.id and estado='activa'),0)) from alexmar.productos a join alexmar.variantes v on v.producto_id=a.id and v.nombre='Principal' where a.id=ident);
 when 'clientes' then return(select jsonb_build_object('nombre',nombre,'documento',coalesce(documento,''),'telefono',coalesce(telefono,''),'direccion',coalesce(direccion,''),'activo',activo) from alexmar.clientes where id=ident);
 when 'detalle_cuentas' then return(select jsonb_build_object('cliente_id',cliente_id,'tipo',tipo,'moneda',moneda,'fecha',fecha,'descripcion',descripcion,'monto',monto,'activo',activo)||case when venta_id is null then '{}'::jsonb else jsonb_build_object('venta_id',venta_id) end from alexmar.movimientos_cuenta where id=ident);
 when 'notas' then return(select jsonb_build_object('titulo',titulo,'contenido',contenido,'activo',activo) from alexmar.notas where id=ident);
 else raise exception 'Tabla de origen inválida.';end case;
end $$;

create function alexmar.aplicar_origen(t text,ident uuid,d jsonb,obj jsonb,lote uuid,es_nuevo boolean) returns uuid
language plpgsql set search_path=pg_catalog,alexmar as $$
declare v uuid;delta numeric;actual alexmar.movimientos_cuenta;nuevo_id uuid:=ident;
begin
 case t
 when 'inventario' then
  if es_nuevo then
   insert into alexmar.productos(id,nombre,descripcion,categoria,compatibilidad,activo,origen) values(ident,obj->>'nombre',obj->>'descripcion',obj->>'categoria',obj->>'compatibilidad',(obj->>'activo')::boolean,'supabase_anterior');
   insert into alexmar.variantes(producto_id,precio,costo,minimo) values(ident,(obj->>'precio')::numeric,(obj->>'costo')::numeric,(obj->>'minimo')::numeric) returning id into v;
  else
   update alexmar.productos set nombre=obj->>'nombre',descripcion=obj->>'descripcion',categoria=obj->>'categoria',compatibilidad=obj->>'compatibilidad',activo=(obj->>'activo')::boolean where id=ident;
   update alexmar.variantes set precio=(obj->>'precio')::numeric,costo=(obj->>'costo')::numeric,minimo=(obj->>'minimo')::numeric where producto_id=ident and nombre='Principal' returning id into v;
  end if;
  select (obj->>'fisico')::numeric-coalesce(sum(cantidad),0) into delta from alexmar.movimientos_stock where variante_id=v;
  if delta<>0 then insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia) values(v,delta,'Actualización desde la aplicación anterior',auth.uid(),'sincronizacion:'||lote||':'||v);end if;
 when 'clientes' then
  if es_nuevo then insert into alexmar.clientes(id,nombre,documento,telefono,direccion,activo,origen) values(ident,obj->>'nombre',obj->>'documento',obj->>'telefono',obj->>'direccion',(obj->>'activo')::boolean,'supabase_anterior');
  else update alexmar.clientes set nombre=obj->>'nombre',documento=obj->>'documento',telefono=obj->>'telefono',direccion=obj->>'direccion',activo=(obj->>'activo')::boolean where id=ident;end if;
 when 'notas' then
  if es_nuevo then insert into alexmar.notas(id,titulo,contenido,activo,origen) values(ident,obj->>'titulo',obj->>'contenido',(obj->>'activo')::boolean,'supabase_anterior');
  else update alexmar.notas set titulo=obj->>'titulo',contenido=obj->>'contenido',activo=(obj->>'activo')::boolean where id=ident;end if;
 when 'detalle_cuentas' then
  if not es_nuevo then
   select * into actual from alexmar.movimientos_cuenta where id=ident;
   if actual.activo and actual.tipo in ('CARGO','ABONO') then
    insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,origen,datos_originales)
    values(actual.cliente_id,case actual.tipo when 'CARGO' then 'ABONO' else 'CARGO' end,actual.fecha,'Reversión por corrección del historial anterior','USD',actual.monto,'actualizacion_origen',jsonb_build_object('reversion_de',ident,'lote',lote));
   end if;
   nuevo_id:=gen_random_uuid();
  end if;
  insert into alexmar.movimientos_cuenta(id,cliente_id,tipo,fecha,descripcion,moneda,monto,activo,origen,datos_originales)
  values(nuevo_id,(obj->>'cliente_id')::uuid,obj->>'tipo',(obj->>'fecha')::timestamptz,obj->>'descripcion','USD',(obj->>'monto')::numeric,(obj->>'activo')::boolean,'supabase_anterior',d);
 else raise exception 'Tabla de origen inválida.';end case;
 return nuevo_id;
end $$;

create function public.estado_importacion() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin perform alexmar.exigir(array['administrador']);return jsonb_build_object('carga_previa',exists(select 1 from alexmar.origenes),'lotes',(select count(*) from alexmar.lotes));end $$;

create function public.sincronizar_origen(p jsonb,p_huella text,p_conciliacion jsonb,p_confirmar boolean default false,p_revision text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare t text;r jsonb;base jsonb;antes jsonb;despues jsonb;actual jsonb;objetivo jsonb;k text;
 ident uuid;destino uuid;aplicado uuid;previa record;hay_base boolean;ids jsonb;
 vista_previa jsonb:='[]';detalle_campos jsonb;conflictos jsonb:='[]';estado_firma text:='';lista jsonb:='[]';resumen jsonb:='{}';nuevos integer;actualizados integer;iguales integer;
 campos text[];fallos text[];revision text;lote uuid;res jsonb;
 huella_lote text:=encode(sha256(convert_to('actualizacion:v1:'||coalesce(p_huella,''),'UTF8')),'hex');
 firma text:=encode(sha256(convert_to(jsonb_build_object('datos',p,'conciliacion',p_conciliacion)::text,'UTF8')),'hex');
begin
 perform alexmar.exigir(array['administrador']);perform pg_advisory_xact_lock(7061511);
 if p_huella is null or p_huella !~ '^[0-9a-f]{64}$' then raise exception 'Huella inválida.';end if;
 select o.resumen into res from alexmar.lotes o where huella=huella_lote;
 if found then
  if res->>'firma_datos' is distinct from firma then raise exception 'La huella corresponde a otros archivos.';end if;
  return res||jsonb_build_object('importado',true,'repetido',true);
 end if;
 if not exists(select 1 from alexmar.origenes) then raise exception 'No existe una carga inicial para actualizar.';end if;
 perform alexmar.validar_actualizacion(p,p_conciliacion);
 if p_confirmar then
  -- Bloqueos compatibles con facturación y edición normal; el estado se vuelve a revisar.
  perform id from alexmar.clientes order by id for no key update;
  perform id from alexmar.productos order by id for no key update;
  perform id from alexmar.variantes order by id for update;
  perform id from alexmar.notas order by id for no key update;
  perform id from alexmar.movimientos_cuenta where origen in ('supabase_anterior','actualizacion_origen') order by id for no key update;
 end if;
 foreach t in array array['inventario','clientes','detalle_cuentas','notas'] loop
  nuevos:=0;actualizados:=0;iguales:=0;
  select coalesce(jsonb_object_agg(x->>'id',true),'{}') into ids from jsonb_array_elements(p->t) x;
  if exists(select 1 from alexmar.origenes o where o.tipo=t and not(ids ? o.origen_id)) then
   conflictos:=conflictos||jsonb_build_object('tabla',t,'id','','motivo','Faltan registros que ya se habían importado. Exporta la tabla completa, incluidos los eliminados.');
  end if;
  for r in select value from jsonb_array_elements(p->t) order by value->>'id' loop
   ident:=(r->>'id')::uuid;fallos:=array[]::text[];campos:=array[]::text[];
   select * into previa from alexmar.procedencia_actual o where o.tipo=t and o.origen_id=r->>'id';hay_base:=found;
   destino:=case when hay_base then previa.nuevo_id else ident end;
   actual:=alexmar.estado_origen(t,destino);despues:=alexmar.campos_origen(t,r);objetivo:=coalesce(actual,despues);
   if not hay_base then
    nuevos:=nuevos+1;
    if actual is not null then fallos:=array_append(fallos,'El ID ya pertenece a un registro local sin procedencia de este archivo.');end if;
   else
    base:=previa.datos;antes:=alexmar.campos_origen(t,base);
    if actual is null then fallos:=array_append(fallos,'El registro importado ya no existe en el destino.');end if;
    if nullif(nullif(base->>'updated_at',''),'null') is not null then
     if nullif(nullif(r->>'updated_at',''),'null') is null then fallos:=array_append(fallos,'Falta updated_at para comprobar la versión. Exporta todas las columnas originales.');
     elsif (r->>'updated_at')::timestamptz<(base->>'updated_at')::timestamptz then fallos:=array_append(fallos,'El archivo contiene una versión anterior a la última actualización.');end if;
    end if;
    for k in select jsonb_object_keys(despues) loop
     if antes->k is distinct from despues->k then
      campos:=array_append(campos,k);objetivo:=jsonb_set(objetivo,array[k],despues->k);
      if actual is not null and actual->k is distinct from antes->k and actual->k is distinct from despues->k then fallos:=array_append(fallos,'Cambió también en la web nueva: '||k);end if;
     end if;
    end loop;
    if t='detalle_cuentas' and actual is distinct from antes and actual is distinct from despues then fallos:=array_append(fallos,'El movimiento fue modificado localmente y requiere conciliación.');end if;
    if cardinality(campos)>0 then actualizados:=actualizados+1;else iguales:=iguales+1;end if;
   end if;
   if t='inventario' and actual is not null and (objetivo->>'fisico')::numeric<coalesce((actual->>'reservado')::numeric,0) then fallos:=array_append(fallos,'El stock propuesto no cubre las existencias reservadas en la web.');end if;
   if not hay_base or cardinality(campos)>0 then
    select coalesce(jsonb_agg(jsonb_build_object('campo',c,'anterior',actual->>c,'nuevo',objetivo->>c) order by c),'[]') into detalle_campos
    from jsonb_object_keys(objetivo) c where not hay_base or c=any(campos);
    vista_previa:=vista_previa||jsonb_build_object('tabla',t,'id',r->>'id','nombre',coalesce(objetivo->>'nombre',objetivo->>'titulo',objetivo->>'descripcion',r->>'id'),'accion',case when hay_base then 'Actualizar' else 'Añadir' end,'campos',detalle_campos);
   end if;
   if cardinality(fallos)>0 then conflictos:=conflictos||jsonb_build_object('tabla',t,'id',r->>'id','motivo',array_to_string(fallos,' · '));end if;
   estado_firma:=encode(sha256(convert_to(estado_firma||jsonb_build_object('tabla',t,'id',r->>'id','destino',destino,'base',case when hay_base then base else null end,'actual',actual)::text,'UTF8')),'hex');
   if not hay_base or r is distinct from base then
    lista:=lista||jsonb_build_object('tabla',t,'id',r->>'id','destino',destino,'es_nuevo',not hay_base,'raw',r,'anterior',case when hay_base then base else null end,'objetivo',objetivo,'aplicar',not hay_base or objetivo is distinct from actual);
   end if;
  end loop;
  resumen:=resumen||jsonb_build_object(t,jsonb_build_object('nuevos',nuevos,'actualizados',actualizados,'sin_cambios',iguales));
 end loop;
 revision:=encode(sha256(convert_to(estado_firma||firma,'UTF8')),'hex');
 res:=jsonb_build_object('resumen',resumen,'cambios',vista_previa,'conflictos',conflictos,'revision',revision,'puedeImportar',jsonb_array_length(conflictos)=0,'firma_datos',firma,'modo','actualizacion');
 if not p_confirmar then return res;end if;
 if jsonb_array_length(conflictos)>0 then raise exception 'Hay conflictos o archivos incompletos. Repite el análisis y revisa el informe.';end if;
 if p_revision is distinct from revision then raise exception 'Los datos de la web cambiaron desde el análisis. Vuelve a analizar antes de confirmar.';end if;
 insert into alexmar.lotes(huella,resumen,usuario_id) values(huella_lote,res,auth.uid()) returning id into lote;
 for r in select value from jsonb_array_elements(lista) loop
  aplicado:=(r->>'destino')::uuid;
  if (r->>'aplicar')::boolean then aplicado:=alexmar.aplicar_origen(r->>'tabla',aplicado,r->'raw',r->'objetivo',lote,(r->>'es_nuevo')::boolean);end if;
  if (r->>'es_nuevo')::boolean then
   insert into alexmar.origenes(tipo,origen_id,nuevo_id,lote_id,datos) values(r->>'tabla',r->>'id',aplicado,lote,r->'raw');
  else
   insert into alexmar.revisiones_origen(tipo,origen_id,nuevo_id,lote_id,anterior,nuevo) values(r->>'tabla',r->>'id',aplicado,lote,r->'anterior',r->'raw');
  end if;
 end loop;
 -- Conciliación de la parte migrada, sin mezclar facturas o cobros locales.
 for r in select value from jsonb_array_elements(p_conciliacion) loop
  if (r->>'saldo')::numeric is distinct from(
   select coalesce(sum(case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end),0) from alexmar.movimientos_cuenta
   where cliente_id=(r->>'id')::uuid and activo and moneda='USD' and origen in ('supabase_anterior','actualizacion_origen')
  ) then raise exception 'La actualización no concilia los saldos del origen. No se guardó ningún cambio.';end if;
 end loop;
 return res||jsonb_build_object('importado',true,'lote',lote);
end $$;
revoke all on function alexmar.validar_actualizacion(jsonb,jsonb),alexmar.campos_origen(text,jsonb),alexmar.estado_origen(text,uuid),alexmar.aplicar_origen(text,uuid,jsonb,jsonb,uuid,boolean) from public,anon,authenticated;
revoke all on function public.estado_importacion(),public.sincronizar_origen(jsonb,text,jsonb,boolean,text) from public,anon;
grant execute on function public.estado_importacion(),public.sincronizar_origen(jsonb,text,jsonb,boolean,text) to authenticated;
commit;

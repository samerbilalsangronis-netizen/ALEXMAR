-- 021 · Corregir abonos sin sobrescribir importes originales.
begin;
do $$begin if to_regclass('alexmar.altas_pendientes') is null then raise exception 'Aplica primero SQL 020.';end if;end $$;
create table alexmar.correcciones_abono(
 id uuid primary key,tipo text not null check(tipo in ('cuenta','factura','historico')),origen_id uuid not null,
 cliente_id uuid not null references alexmar.clientes,moneda text not null,
 monto_anterior numeric not null,monto_nuevo numeric not null check(monto_nuevo>=0 and monto_nuevo<10000000000000000),
 metodo_anterior text not null,metodo text not null,referencia_anterior text not null,referencia text not null,
 motivo text not null check(length(trim(motivo)) between 5 and 1000),
 aplicaciones jsonb not null,revision_anterior text not null,firma text not null,
 usuario_id uuid not null references auth.users,creado timestamptz not null default clock_timestamp(),
 orden bigint generated always as identity unique
);
create index correccion_abono_origen on alexmar.correcciones_abono(tipo,origen_id,orden desc);
alter table alexmar.correcciones_abono enable row level security;
revoke all on alexmar.correcciones_abono from public,anon,authenticated;
create trigger auditar after insert on alexmar.correcciones_abono for each row execute function alexmar.auditar();
-- Una aplicación a factura anulada ya fue revertida por anular_venta.
-- Nunca se vuelve a quitar del saldo ni se resta de pagos una segunda vez.
create function alexmar.estado_abono(t text,ident uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare cliente uuid;original numeric;divisa text;metodo text;referencia text;creado timestamptz;autor uuid;
 apps jsonb;vigentes jsonb;r jsonb;ultima alexmar.correcciones_abono;importe numeric;saldo numeric;edita boolean:=true;motivo text:='';
begin
 if t='cuenta' then
  select cliente_id,monto,moneda,a.metodo,a.referencia,a.creado,usuario_id,aplicaciones into cliente,original,divisa,metodo,referencia,creado,autor,apps from alexmar.abonos_cuenta a where id=ident;
 elsif t='factura' then
  select v.cliente_id,p.monto,'USD',p.metodo,'',p.creado,p.usuario_id,jsonb_build_array(jsonb_build_object('venta_id',v.id,'monto',p.monto::text))
  into cliente,original,divisa,metodo,referencia,creado,autor,apps from alexmar.pagos_venta p join alexmar.ventas v on v.id=p.venta_id where p.id=ident and p.tipo='cobro' and p.monto>0
  and not exists(select 1 from alexmar.abonos_cuenta a cross join lateral jsonb_array_elements(a.aplicaciones) x where x->>'pago_id'=p.id::text)
  and not exists(select 1 from alexmar.correcciones_abono c where exists(select 1 from jsonb_array_elements(c.aplicaciones) x where x->>'pago_id'=p.id::text));
 elsif t='historico' then
  select m.cliente_id,m.monto,m.moneda,'Otro','',m.fecha,null::uuid,jsonb_build_array(jsonb_build_object('movimiento_id',m.id,'monto',m.monto::text))
  into cliente,original,divisa,metodo,referencia,creado,autor,apps from alexmar.movimientos_cuenta m where m.id=ident and m.tipo='ABONO' and m.activo and m.venta_id is null and (m.origen is null or m.origen='supabase_anterior')
  and not exists(select 1 from alexmar.movimientos_cuenta x where x.activo and x.origen='actualizacion_origen' and x.datos_originales->>'reversion_de'=m.id::text);
 else return null;end if;
 if cliente is null then return null;end if;
 select * into ultima from alexmar.correcciones_abono c where c.tipo=t and c.origen_id=ident order by orden desc limit 1;
 if found then apps:=ultima.aplicaciones;metodo:=ultima.metodo;referencia:=ultima.referencia;end if;
 select coalesce(jsonb_agg(x||case when v.id is not null then jsonb_build_object('version',v.version) else '{}'::jsonb end order by coalesce(x->>'venta_id','')), '[]') into vigentes
 from jsonb_array_elements(apps) x left join alexmar.ventas v on v.id=nullif(x->>'venta_id','')::uuid
 where nullif(x->>'venta_id','') is null or v.estado='confirmada';
 select coalesce(sum((x->>'monto')::numeric),0) into importe from jsonb_array_elements(vigentes) x;
 select coalesce(sum(case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end),0) into saldo from alexmar.movimientos_cuenta where cliente_id=cliente and moneda=divisa and activo;
 if not exists(select 1 from alexmar.clientes where id=cliente and activo) then edita:=false;motivo:='El cliente está retirado del directorio.';
 elsif importe=0 and exists(select 1 from jsonb_array_elements(apps) x where nullif(x->>'venta_id','') is not null) and not(ultima.id is not null and ultima.monto_nuevo=0) then edita:=false;motivo:='Sus aplicaciones ya fueron revertidas al anular la factura.';
 elsif t='factura' and not exists(select 1 from alexmar.ventas v join alexmar.pagos_venta p on p.venta_id=v.id where p.id=ident and v.estado='confirmada') then edita:=false;motivo:='La factura está anulada.';end if;
 r:=jsonb_build_object('tipo',t,'id',ident,'cliente_id',cliente,'moneda',divisa,'original',original::text,'actual',importe::text,'metodo',metodo,'referencia',referencia,'creado',creado,
 'autor',coalesce((select nombre from alexmar.perfiles where id=autor),'Registro histórico'),'aplicaciones',vigentes,'saldo',saldo::text,'editable',edita,'impedimento',motivo,
 'correcciones',(select count(*) from alexmar.correcciones_abono where tipo=t and origen_id=ident),'ultima',ultima.id);
 return r||jsonb_build_object('revision',encode(sha256(convert_to(r::text,'UTF8')),'hex'));
end $$;
revoke all on function alexmar.estado_abono(text,uuid) from public,anon,authenticated;
create function public.listar_abonos_cliente(p_id uuid,p_pagina integer default 1) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare n integer:=greatest(1,coalesce(p_pagina,1));begin
 perform alexmar.exigir(array['administrador']);
 return(with raices as(
 select 'cuenta' tipo,id,creado from alexmar.abonos_cuenta where cliente_id=p_id
 union all select 'factura',p.id,p.creado from alexmar.pagos_venta p join alexmar.ventas v on v.id=p.venta_id where v.cliente_id=p_id and p.tipo='cobro' and p.monto>0
 and not exists(select 1 from alexmar.abonos_cuenta a cross join lateral jsonb_array_elements(a.aplicaciones) x where x->>'pago_id'=p.id::text)
 and not exists(select 1 from alexmar.correcciones_abono c cross join lateral jsonb_array_elements(c.aplicaciones) x where x->>'pago_id'=p.id::text)
 union all select 'historico',m.id,m.fecha from alexmar.movimientos_cuenta m where cliente_id=p_id and activo and tipo='ABONO' and venta_id is null and (origen is null or origen='supabase_anterior')
 and not exists(select 1 from alexmar.movimientos_cuenta x where x.activo and x.origen='actualizacion_origen' and x.datos_originales->>'reversion_de'=m.id::text)
 ), pg as(select * from raices order by creado desc,id limit 30 offset (n::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(alexmar.estado_abono(tipo,id) order by creado desc,id) from pg),'[]'),'total',(select count(*) from raices),'pagina',n,'paginas',greatest(1,ceil((select count(*) from raices)/30.0))));
end $$;
create function public.historial_correcciones_abono(p_tipo text,p_id uuid,p_pagina integer default 1) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare n integer:=greatest(1,coalesce(p_pagina,1));begin
 perform alexmar.exigir(array['administrador']);
 return(with t as(select c.id,c.monto_anterior::text anterior,c.monto_nuevo::text nuevo,c.metodo_anterior,c.metodo,c.referencia_anterior,c.referencia,c.motivo,c.creado,c.orden,p.nombre autor from alexmar.correcciones_abono c join alexmar.perfiles p on p.id=c.usuario_id where c.tipo=p_tipo and c.origen_id=p_id),pg as(select * from t order by orden desc limit 20 offset (n::bigint-1)*20)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(pg) order by orden desc) from pg),'[]'),'total',(select count(*) from t),'pagina',n,'paginas',greatest(1,ceil((select count(*) from t)/20.0))));
end $$;
create function public.corregir_abono_cliente(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare clave uuid:=(p->>'clave')::uuid;ident uuid:=(p->>'id')::uuid;t text:=p->>'tipo';r jsonb;antes numeric;nuevo numeric;saldo numeric;resultado numeric;cliente uuid;divisa text;
 firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');previa text;a jsonb;v uuid;mov uuid;pago uuid;parte numeric;pendiente numeric;historia numeric;apps jsonb:='[]';doc record;
begin
 perform alexmar.exigir(array['administrador']);
 if clave is null or ident is null or coalesce(t,'') not in ('cuenta','factura','historico') or octet_length(p::text)>10000 then raise exception 'Identifica el abono y su corrección.';end if;
 perform pg_advisory_xact_lock(7061511);perform pg_advisory_xact_lock(hashtextextended(clave::text,831));
 select c.firma into previa from alexmar.correcciones_abono c where c.id=clave;
 if found then if previa<>firma then raise exception 'Esta corrección ya se registró con otros datos.';end if;return clave;end if;
 r:=alexmar.estado_abono(t,ident);
 if r is null then raise exception 'Abono no encontrado o no corregible.';end if;
 cliente:=(r->>'cliente_id')::uuid;divisa:=r->>'moneda';
 if (p->>'cliente_id')::uuid is distinct from cliente then raise exception 'El abono no pertenece a ese cliente.';end if;
 perform id from alexmar.clientes where id=cliente for update;
 perform id from alexmar.ventas where cliente_id=cliente and estado='confirmada' order by id for update;
 r:=alexmar.estado_abono(t,ident);
 if not (r->>'editable')::boolean then raise exception '%',r->>'impedimento';end if;
 if p->>'revision' is distinct from r->>'revision' then raise exception 'El abono o la cuenta cambiaron. Recarga la página y vuelve a revisar los importes.';end if;
 if length(trim(coalesce(p->>'motivo',''))) not between 5 and 1000 then raise exception 'Escribe un motivo de 5 a 1000 caracteres.';end if;
 if coalesce(p->>'monto','') !~ '^[0-9]{1,16}(\.[0-9]{1,84})?$' then raise exception 'Monto de cero en adelante con hasta 84 decimales.';end if;
 nuevo:=(p->>'monto')::numeric;antes:=(r->>'actual')::numeric;saldo:=(r->>'saldo')::numeric;
 if nuevo>=10000000000000000 then raise exception 'Monto fuera de rango.';end if;
 if coalesce(p->>'metodo','') not in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Zelle','Binance','Otro') or length(coalesce(p->>'referencia',''))>200 then raise exception 'Revisa método y referencia del pago.';end if;
 if (p->>'confirmado') is distinct from 'true' then raise exception 'Confirma los datos correctos del abono.';end if;
 if nuevo=antes and p->>'metodo'=r->>'metodo' and coalesce(p->>'referencia','')=r->>'referencia' then raise exception 'No hay cambios que guardar.';end if;
 if nuevo>saldo+antes then raise exception 'El abono corregido supera la deuda disponible. No se guardó ningún cambio.';end if;
 -- Compensar solo aplicaciones vigentes; sus filas originales nunca se reescriben.
 for a in select value from jsonb_array_elements(r->'aplicaciones') loop
  v:=nullif(a->>'venta_id','')::uuid;parte:=(a->>'monto')::numeric;
  if parte<=0 then continue;end if;
  if v is not null then
   insert into alexmar.pagos_venta(venta_id,tipo,monto,metodo,usuario_id,creado) values(v,'reversion',-parte,r->>'metodo',auth.uid(),clock_timestamp());
   update alexmar.ventas set version=version+1 where id=v;
  end if;
  insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id,origen,datos_originales)
  values(cliente,'CARGO',clock_timestamp(),'Reversión de abono por corrección · '||trim(p->>'motivo'),divisa,parte,v,'correccion_abono',jsonb_build_object('correccion_id',clave,'origen_id',ident,'tipo',t,'paso','reversion'));
 end loop;
 pendiente:=nuevo;
 if t='factura' then
  v:=((r->'aplicaciones')->0->>'venta_id')::uuid;
  -- Un abono corregido a cero tiene aplicaciones vacías; recuperar su factura original.
  if v is null then select venta_id into v from alexmar.pagos_venta where id=ident;end if;
  if nuevo>0 then
   pago:=public.cobrar_factura(jsonb_build_object('id',v,'idempotencia',gen_random_uuid(),'monto',nuevo::text,'metodo',p->>'metodo'));
   apps:=jsonb_build_array(jsonb_build_object('venta_id',v,'pago_id',pago,'monto',nuevo::text));
  end if;
  pendiente:=0;
 else
  select greatest(coalesce(sum(case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end),0),0) into historia from alexmar.movimientos_cuenta where cliente_id=cliente and activo and moneda=divisa and venta_id is null;
  parte:=least(pendiente,historia);
  if parte>0 then
   insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,origen,datos_originales)
   values(cliente,'ABONO',clock_timestamp(),'Abono corregido · '||(p->>'metodo')||case when coalesce(p->>'referencia','')<>'' then ' · '||(p->>'referencia') else '' end,divisa,parte,'correccion_abono',jsonb_build_object('correccion_id',clave,'origen_id',ident,'tipo',t,'paso','nuevo')) returning id into mov;
   apps:=apps||jsonb_build_array(jsonb_build_object('movimiento_id',mov,'monto',parte::text));pendiente:=pendiente-parte;
  end if;
  if divisa='USD' then
   for doc in select v.id,v.total-coalesce((select sum(monto) from alexmar.pagos_venta where venta_id=v.id),0) saldo from alexmar.ventas v where v.cliente_id=cliente and v.estado='confirmada' order by v.emitido,v.id loop
    exit when pendiente=0;parte:=least(pendiente,greatest(doc.saldo,0));
    if parte>0 then
     pago:=public.cobrar_factura(jsonb_build_object('id',doc.id,'idempotencia',gen_random_uuid(),'monto',parte::text,'metodo',p->>'metodo'));
     apps:=apps||jsonb_build_array(jsonb_build_object('venta_id',doc.id,'pago_id',pago,'monto',parte::text));pendiente:=pendiente-parte;
    end if;
   end loop;
  end if;
 end if;
 if pendiente<>0 then raise exception 'No se pudo aplicar todo el importe. No se guardó ningún cambio; revisa la cuenta.';end if;
 if exists(select 1 from alexmar.ventas v where v.cliente_id=cliente and v.estado='confirmada' and v.condicion='contado' and v.total<>(select coalesce(sum(monto),0) from alexmar.pagos_venta where venta_id=v.id)) then raise exception 'Una venta de contado debe conservar su cobro completo. No se guardó la corrección.';end if;
 select coalesce(sum(case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end),0) into resultado from alexmar.movimientos_cuenta where cliente_id=cliente and activo and moneda=divisa;
 if resultado<>saldo+antes-nuevo then raise exception 'La corrección no concilia. No se guardó ningún cambio.';end if;
 insert into alexmar.correcciones_abono(id,tipo,origen_id,cliente_id,moneda,monto_anterior,monto_nuevo,metodo_anterior,metodo,referencia_anterior,referencia,motivo,aplicaciones,revision_anterior,firma,usuario_id)
 values(clave,t,ident,cliente,divisa,antes,nuevo,r->>'metodo',p->>'metodo',r->>'referencia',coalesce(p->>'referencia',''),trim(p->>'motivo'),apps,r->>'revision',firma,auth.uid());
 return clave;
end $$;
-- Evitar que una actualización posterior del origen altere la base de un abono
-- corregido localmente sin conciliación explícita.
create function alexmar.proteger_abono_corregido_origen() returns trigger language plpgsql security definer set search_path=pg_catalog,alexmar as $$begin
 if exists(select 1 from alexmar.correcciones_abono where tipo='historico' and origen_id::text=new.datos_originales->>'reversion_de') then
  raise exception 'Este abono tiene correcciones locales. Concilia su cambio en el origen antes de actualizar los archivos. No se guardó la importación.';
 end if;return new;
end $$;
revoke all on function alexmar.proteger_abono_corregido_origen() from public,anon,authenticated;
create trigger proteger_abono_corregido before insert on alexmar.movimientos_cuenta for each row when(new.origen='actualizacion_origen') execute function alexmar.proteger_abono_corregido_origen();
-- Totales comerciales de la cuenta: una reversión de abono resta del abonado,
-- no aumenta el importe de productos/cargos originales. El saldo conserva todos los asientos.
do $$declare f text;begin
 f:=pg_get_functiondef('public.estado_cliente(uuid,date,date,integer,text)'::regprocedure);
 if strpos(f,'monto::text importe,datos_originales')=0 or strpos(f,'''CARGO''),0)::text,''abonos''')=0 then raise exception 'Versión inesperada de estado_cliente.';end if;
 f:=replace(f,'monto::text importe,datos_originales','monto::text importe,coalesce(origen=''correccion_abono'',false) ajuste_abono,datos_originales');
 f:=replace(f,$old$sum(firmado) from filtrados where tipo='CARGO'$old$,$new$sum(firmado) from filtrados where tipo='CARGO' and not ajuste_abono$new$);
 f:=replace(f,$old$-sum(firmado) from filtrados where tipo='ABONO'$old$,$new$-sum(firmado) from filtrados where tipo='ABONO' or ajuste_abono$new$);
 execute f;
end $$;
revoke all on function public.listar_abonos_cliente(uuid,integer),public.historial_correcciones_abono(text,uuid,integer),public.corregir_abono_cliente(jsonb) from public,anon;
grant execute on function public.listar_abonos_cliente(uuid,integer),public.historial_correcciones_abono(text,uuid,integer),public.corregir_abono_cliente(jsonb) to authenticated;

-- Mantener también el resumen global de cuentas en importes netos corregidos.
do $$declare f text;begin
 f:=pg_get_functiondef('public.metricas_generales()'::regprocedure);
 if strpos(f,$old$coalesce(sum(m.monto) filter(where m.tipo='CARGO'),0)$old$)=0 then raise exception 'Versión inesperada de metricas_generales.';end if;
 f:=replace(f,$old$coalesce(sum(m.monto) filter(where m.tipo='CARGO'),0)$old$,$new$coalesce(sum(m.monto) filter(where m.tipo='CARGO' and coalesce(m.origen,'')<>'correccion_abono'),0)$new$);
 f:=replace(f,$old$coalesce(sum(m.monto) filter(where m.tipo='ABONO'),0)$old$,$new$coalesce(sum(case when m.tipo='ABONO' then m.monto when m.tipo='CARGO' and m.origen='correccion_abono' then -m.monto else 0 end),0)$new$);
 execute f;
end $$;
commit;

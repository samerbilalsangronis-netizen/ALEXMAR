begin;
-- Cuenta continua de clientes. No reimporta ni transforma movimientos históricos en facturas.
create table alexmar.abonos_cuenta(
 id uuid primary key,cliente_id uuid not null references alexmar.clientes(id),
 monto numeric not null check(monto>0 and monto<10000000000000000),
 moneda text not null check(moneda='USD'),metodo text not null,
 referencia text not null default '',firma text not null,
 aplicaciones jsonb not null default '[]',usuario_id uuid not null references auth.users(id),
 creado timestamptz not null default clock_timestamp()
);
alter table alexmar.abonos_cuenta enable row level security;
revoke all on alexmar.abonos_cuenta from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.abonos_cuenta
for each row execute function alexmar.auditar();

create function public.abonar_cuenta_cliente(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;cliente uuid:=(p->>'cliente_id')::uuid;
 anterior alexmar.abonos_cuenta;firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
 importe numeric;saldo numeric;nuevo_saldo numeric;pendiente numeric;historia numeric;parte numeric;doc record;
 pago uuid;movimiento uuid;aplicaciones jsonb:='[]';
begin
 perform alexmar.exigir(array['administrador']);
 if ident is null or cliente is null then raise exception 'Falta identificar cliente y abono.';end if;
 if octet_length(p::text)>10000 then raise exception 'El abono supera el tamaño permitido.';end if;
 -- Mismo cerrojo que sincronizar_origen; no conciliar a la vez que cambia la deuda importada.
 perform pg_advisory_xact_lock(7061511);
 perform pg_advisory_xact_lock(hashtextextended(ident::text,825));
 select * into anterior from alexmar.abonos_cuenta where id=ident;
 if found then
  if anterior.firma<>firma then raise exception 'Este abono ya se registró con otros datos.';end if;
  return ident;
 end if;
 perform id from alexmar.clientes where id=cliente and activo for update;
 if not found then raise exception 'Cliente inexistente o inactivo.';end if;
 if coalesce(p->>'moneda','USD')<>'USD' then raise exception 'Los nuevos abonos de cuenta se registran en USD.';end if;
 if coalesce(p->>'monto','') !~ '^[0-9]{1,16}(\.[0-9]{1,84})?$' then raise exception 'Indica un abono positivo con hasta 84 decimales.';end if;
 importe:=(p->>'monto')::numeric;
 if importe<=0 or importe>=10000000000000000 then raise exception 'Importe fuera de rango.';end if;
 if coalesce(p->>'metodo','') not in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Otro') then raise exception 'Selecciona el método del abono.';end if;
 if length(coalesce(p->>'referencia',''))>200 then raise exception 'La referencia admite hasta 200 caracteres.';end if;
 -- Bloquear los documentos antes de leer pagos: los cobros/anulaciones existentes usan estos mismos bloqueos.
 perform id from alexmar.ventas where cliente_id=cliente and estado='confirmada' order by id for update;
 select coalesce(sum(case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end),0) into saldo
 from alexmar.movimientos_cuenta where cliente_id=cliente and activo and moneda='USD';
 if coalesce(p->>'saldo_esperado','') !~ '^-?[0-9]{1,32}(\.[0-9]{1,84})?$' then raise exception 'Recarga la cuenta para revisar su saldo.';end if;
 if saldo<>(p->>'saldo_esperado')::numeric then raise exception 'La cuenta cambió. Recarga y revisa el saldo antes de registrar el abono.';end if;
 if importe>saldo then raise exception 'El abono supera el saldo pendiente de la cuenta.';end if;
 if (p->>'confirmado') is distinct from 'true' then raise exception 'Confirma que recibiste este abono del cliente.';end if;
 pendiente:=importe;
 -- Primero se cancela el saldo acumulado sin factura; después, comprobantes pendientes por antigüedad.
 select greatest(coalesce(sum(case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end),0),0) into historia
 from alexmar.movimientos_cuenta where cliente_id=cliente and activo and moneda='USD' and venta_id is null;
 parte:=least(pendiente,historia);
 if parte>0 then
  insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,origen,datos_originales)
  values(cliente,'ABONO',clock_timestamp(),'Abono de cuenta · '||(p->>'metodo')||case when coalesce(p->>'referencia','')<>'' then ' · '||(p->>'referencia') else '' end,'USD',parte,'abono_cuenta',jsonb_build_object('abono_cuenta_id',ident,'referencia',coalesce(p->>'referencia','')))
  returning id into movimiento;
  aplicaciones:=aplicaciones||jsonb_build_array(jsonb_build_object('movimiento_id',movimiento,'monto',parte::text));
  pendiente:=pendiente-parte;
 end if;
 for doc in select v.id,v.total-coalesce((select sum(monto) from alexmar.pagos_venta where venta_id=v.id),0) saldo
 from alexmar.ventas v where v.cliente_id=cliente and v.estado='confirmada' order by v.emitido,v.id loop
  exit when pendiente=0;
  parte:=least(pendiente,greatest(doc.saldo,0));
  if parte>0 then
   pago:=public.cobrar_factura(jsonb_build_object('id',doc.id,'idempotencia',gen_random_uuid(),'monto',parte::text,'metodo',p->>'metodo'));
   aplicaciones:=aplicaciones||jsonb_build_array(jsonb_build_object('venta_id',doc.id,'pago_id',pago,'monto',parte::text));
   pendiente:=pendiente-parte;
  end if;
 end loop;
 if pendiente<>0 then raise exception 'La cuenta requiere conciliación: no se pudo aplicar todo el abono. No se guardó ningún cambio.';end if;
 select coalesce(sum(case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end),0) into nuevo_saldo
 from alexmar.movimientos_cuenta where cliente_id=cliente and activo and moneda='USD';
 if nuevo_saldo<>saldo-importe then raise exception 'La cuenta cambió durante el abono. No se guardó ningún cambio; recarga y revisa el saldo.';end if;
 insert into alexmar.abonos_cuenta(id,cliente_id,monto,moneda,metodo,referencia,firma,aplicaciones,usuario_id)
 values(ident,cliente,importe,'USD',p->>'metodo',coalesce(p->>'referencia',''),firma,aplicaciones,auth.uid());
 return ident;
end $$;

create function public.eliminar_nota(p_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador']);
 update alexmar.notas set activo=false where id=p_id;
 if not found then raise exception 'Nota no encontrada.';end if;
end $$;
create or replace function public.estado_cliente(p_id uuid,p_desde date default null,p_hasta date default null,p_pagina integer default 1,p_moneda text default 'USD') returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$declare r jsonb;n integer:=greatest(1,p_pagina);begin perform alexmar.exigir(array['administrador','ventas']);if p_desde>p_hasta then raise exception 'El inicio debe ser anterior al final.';end if;
with t as(select id,fecha,case when venta_id is not null and tipo='CARGO' and descripcion like 'Factura %' then descripcion||coalesce((select ' · '||string_agg(l.descripcion||' ('||l.cantidad::text||' × '||l.precio::text||' USD)', '; ' order by l.orden) from alexmar.lineas_venta l where l.venta_id=m.venta_id),'') else descripcion end descripcion,tipo,monto::text importe,datos_originales->>'cantidad' cantidad,datos_originales->>'precio_unitario' precio_unitario,case when tipo='CARGO' then monto when tipo='ABONO' then -monto else 0 end firmado from alexmar.movimientos_cuenta m where cliente_id=p_id and activo and moneda=p_moneda),acumulados as(select *,sum(firmado) over(order by fecha,id)::text saldo from t),filtrados as(select * from acumulados where (p_desde is null or (fecha at time zone 'America/Caracas')::date>=p_desde) and (p_hasta is null or (fecha at time zone 'America/Caracas')::date<=p_hasta)),pg as(select * from filtrados order by fecha,id limit 30 offset (n-1)*30)
select jsonb_build_object('cliente',(select to_jsonb(c) from alexmar.clientes c where id=p_id),'moneda',p_moneda,'anterior',coalesce((select sum(firmado) from t where p_desde is not null and (fecha at time zone 'America/Caracas')::date<p_desde),0)::text,'final',coalesce((select sum(firmado) from t where p_hasta is null or (fecha at time zone 'America/Caracas')::date<=p_hasta),0)::text,'cargos',coalesce((select sum(firmado) from filtrados where tipo='CARGO'),0)::text,'abonos',coalesce((select -sum(firmado) from filtrados where tipo='ABONO'),0)::text,'filas',coalesce((select jsonb_agg(to_jsonb(pg)) from pg),'[]'),'total',(select count(*) from filtrados),'pagina',n,'paginas',greatest(1,ceil((select count(*) from filtrados)/30.0))) into r;return r;end $$;

create or replace function public.guardar_nota(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare i uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());vigente boolean;
begin
 perform alexmar.exigir(array['administrador']);
 select activo into vigente from alexmar.notas where id=i for update;
 if found and not vigente then raise exception 'Esta nota fue eliminada. Vuelve al listado para crear otra.';end if;
 insert into alexmar.notas(id,titulo,contenido) values(i,coalesce(p->>'titulo',''),coalesce(p->>'contenido',''))
 on conflict(id) do update set titulo=excluded.titulo,contenido=excluded.contenido;
 return i;
end $$;
revoke all on function public.abonar_cuenta_cliente(jsonb),public.eliminar_nota(uuid) from public,anon;
grant execute on function public.abonar_cuenta_cliente(jsonb),public.eliminar_nota(uuid) to authenticated;
commit;

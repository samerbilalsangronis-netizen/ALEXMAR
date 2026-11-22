begin;
-- Aplicar una vez después de SQL 011. No limpia ni reimporta datos.
-- Las facturas existentes conservan su comportamiento histórico de inventario.
alter table alexmar.ventas add column descontar_stock boolean not null default true;
create index ventas_rendimiento on alexmar.ventas(emitido) where estado='confirmada' and tipo='factura' and moneda='USD';
create table alexmar.configuracion_comercial(
 id integer primary key check(id=1),descontar_stock boolean not null default false,
 version integer not null default 1,actualizado timestamptz not null default now(),usuario_id uuid references auth.users(id)
);
insert into alexmar.configuracion_comercial(id,descontar_stock)values(1,false);
alter table alexmar.configuracion_comercial enable row level security;
revoke all on alexmar.configuracion_comercial from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.configuracion_comercial for each row execute function alexmar.auditar();

create or replace function public.configuracion_facturacion() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','ventas']);
 return(select jsonb_build_object('version',11,'moneda','USD','descontar_stock',descontar_stock,'version_stock',version) from alexmar.configuracion_comercial where id=1);
end $$;
create function public.configurar_descuento_stock(p_activo boolean,p_version integer) returns void language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare actual alexmar.configuracion_comercial;
begin
 perform alexmar.exigir(array['administrador']);
 if p_activo is null then raise exception 'Indica si se descuenta inventario.';end if;
 select * into strict actual from alexmar.configuracion_comercial where id=1 for update;
 if actual.descontar_stock=p_activo then return;end if;
 if actual.version is distinct from p_version then raise exception 'La configuración cambió. Recarga antes de guardar.';end if;
 update alexmar.configuracion_comercial set descontar_stock=p_activo,version=version+1,actualizado=now(),usuario_id=auth.uid() where id=1;
end $$;
revoke all on function public.configurar_descuento_stock(boolean,integer) from public,anon;
grant execute on function public.configurar_descuento_stock(boolean,integer) to authenticated;

create or replace function public.emitir_venta(p_id uuid,p_version integer) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.ventas;l record;fisico numeric;reservado numeric;num bigint;etiqueta text;control boolean;
begin
 perform alexmar.exigir(array['administrador','ventas']);
 select * into doc from alexmar.ventas where id=p_id for update;
 if not found then raise exception 'Venta no encontrada.';end if;
 if doc.estado='confirmada' then return p_id;end if;
 if doc.estado<>'borrador' then raise exception 'La venta está anulada.';end if;
 if doc.version is distinct from p_version then raise exception 'El borrador cambió. Revisa de nuevo los totales antes de emitir.';end if;
 if doc.condicion='contado' and doc.abono<>doc.total then raise exception 'Al contado debes registrar el cobro completo.';end if;
 if not exists(select 1 from alexmar.clientes where id=doc.cliente_id and activo) then raise exception 'El cliente ya no está activo.';end if;
 select descontar_stock into strict control from alexmar.configuracion_comercial where id=1 for share;
 -- Con control activo se valida el disponible; apagado no modifica existencias.
 perform v.id from alexmar.variantes v where v.id in(select variante_id from alexmar.lineas_venta where venta_id=p_id) order by v.id for update;
 for l in select variante_id,sum(cantidad) cantidad from alexmar.lineas_venta where venta_id=p_id and variante_id is not null group by variante_id order by variante_id loop
  if not exists(select 1 from alexmar.variantes v join alexmar.productos a on a.id=v.producto_id where v.id=l.variante_id and a.activo) then raise exception 'Un producto ya no está activo.';end if;
  if control then
  select coalesce(sum(cantidad),0) into fisico from alexmar.movimientos_stock where variante_id=l.variante_id;
  select coalesce(sum(cantidad),0) into reservado from alexmar.reservas where variante_id=l.variante_id and estado='activa';
  if fisico-reservado<l.cantidad then raise exception 'Existencia disponible insuficiente. Revisa productos y cantidades.';end if;
  end if;
 end loop;
 num:=nextval('alexmar.numero_venta');etiqueta:='V-'||lpad(num::text,greatest(6,length(num::text)),'0');
 update alexmar.ventas set descontar_stock=control,numero=num,tipo='factura',estado='confirmada',emitido=now(),version=version+1,
 cliente_snapshot=(select jsonb_build_object('nombre',nombre,'documento',documento,'telefono',telefono,'direccion',direccion) from alexmar.clientes where id=doc.cliente_id) where id=p_id;
 if control then
 insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia)
 select variante_id,-sum(cantidad),'Venta '||etiqueta,auth.uid(),'venta:'||p_id||':'||variante_id
 from alexmar.lineas_venta where venta_id=p_id and variante_id is not null group by variante_id;
 end if;
 insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
 values(doc.cliente_id,'CARGO',now(),'Factura '||etiqueta,'USD',doc.total,p_id);
 if doc.abono>0 then
  insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
  values(doc.cliente_id,'ABONO',now(),'Pago inicial factura '||etiqueta||' · '||doc.metodo_pago,'USD',doc.abono,p_id);
  insert into alexmar.pagos_venta(venta_id,tipo,monto,metodo,usuario_id) values(p_id,'cobro',doc.abono,doc.metodo_pago,auth.uid());
 end if;
 return p_id;
end $$;



create or replace function public.emitir_factura(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;doc alexmar.ventas;firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
begin
 perform alexmar.exigir(array['administrador','ventas']);
 if ident is null then raise exception 'Falta el identificador.';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,817));
 select * into doc from alexmar.ventas where id=ident for update;
 if found and doc.estado='confirmada' then
  if doc.firma=firma then return ident;end if;
  raise exception 'Esta factura ya fue emitida con otro contenido. Abre el documento.';
 end if;
 perform id from alexmar.configuracion_comercial where id=1 for share;
 if coalesce(p->>'condicion','') not in ('contado','credito') then raise exception 'Selecciona contado o crédito.';end if;
 perform v.id from alexmar.variantes v where v.id in(select nullif(l->>'variante_id','')::uuid from jsonb_array_elements(p->'lineas')l) order by v.id for update;
 if exists(select 1 from jsonb_array_elements(p->'lineas') l join alexmar.variantes v on v.id=nullif(l->>'variante_id','')::uuid
 where v.precio is null or v.precio is distinct from (l->>'precio')::numeric) then
 raise exception 'El precio de catálogo falta o cambió. Vuelve a seleccionar el producto antes de emitir.';end if;
 perform public.guardar_venta(p);
 select * into doc from alexmar.ventas where id=ident;
 if p->>'condicion'='contado' and doc.abono<>doc.total then raise exception 'Al contado debes registrar el cobro completo.';end if;
 return public.emitir_venta(ident,doc.version);
end $$;


create or replace function public.anular_venta(p_id uuid,p_motivo text,p_reembolso boolean default false) returns void language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.ventas;etiqueta text;pagado numeric;
begin
 perform alexmar.exigir(array['administrador']);
 select * into doc from alexmar.ventas where id=p_id for update;
 if not found then raise exception 'Venta no encontrada.';end if;
 if doc.estado='anulada' then return;end if;
 if length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Indica un motivo de al menos cinco caracteres.';end if;
 if doc.estado='confirmada' then
  select coalesce(sum(monto),0) into pagado from alexmar.pagos_venta where venta_id=p_id;
  if pagado>0 and not coalesce(p_reembolso,false) then raise exception 'Confirma que has revertido el cobro o entregado el reembolso.';end if;
  etiqueta:='V-'||lpad(doc.numero::text,greatest(6,length(doc.numero::text)),'0');
  -- Revertir exclusivamente la salida realmente registrada al emitir, nunca la configuración actual.
  if doc.descontar_stock then
   perform v.id from alexmar.variantes v where v.id in(
    select m.variante_id from alexmar.movimientos_stock m where m.idempotencia='venta:'||p_id||':'||m.variante_id
   ) order by v.id for update;
   insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia)
   select m.variante_id,-m.cantidad,'Anulación '||etiqueta||': '||p_motivo,auth.uid(),'anulacion:'||p_id||':'||m.variante_id
   from alexmar.movimientos_stock m where m.idempotencia='venta:'||p_id||':'||m.variante_id and m.cantidad<0;
  end if;
  insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
  values(doc.cliente_id,'ABONO',now(),'Anulación factura '||etiqueta||': '||p_motivo,'USD',doc.total,p_id);
  if pagado>0 then
   insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
   values(doc.cliente_id,'CARGO',now(),'Reversión cobros '||etiqueta,'USD',pagado,p_id);
   insert into alexmar.pagos_venta(venta_id,tipo,monto,metodo,usuario_id) values(p_id,'reversion',-pagado,'Otro',auth.uid());
  end if;
 end if;
 update alexmar.ventas set estado='anulada',motivo_anulacion=p_motivo,anulado=now(),version=version+1 where id=p_id;
end $$;
-- Solo facturas nuevas confirmadas: nunca suma cargos del sistema anterior.
create function public.rendimiento_ventas(p_ahora timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare hoy date;lunes date;inicio timestamptz;previo timestamptz;fin_previo timestamptz;
 actual numeric;anterior numeric;cantidad bigint;resultado jsonb;
begin
 perform alexmar.exigir(array['administrador','ventas']);
 if p_ahora is null or not isfinite(p_ahora) then raise exception 'Fecha de consulta inválida.';end if;
 hoy:=(p_ahora at time zone 'America/Caracas')::date;
 lunes:=date_trunc('week',hoy::timestamp)::date;
 inicio:=lunes::timestamp at time zone 'America/Caracas';
 previo:=(lunes-7)::timestamp at time zone 'America/Caracas';
 fin_previo:=p_ahora-interval '7 days';
 select coalesce(sum(total)filter(where emitido>=inicio),0),
 coalesce(sum(total)filter(where emitido>=previo and emitido<=fin_previo),0),
 count(*)filter(where emitido>=inicio)
 into actual,anterior,cantidad
 from alexmar.ventas where estado='confirmada' and tipo='factura' and moneda='USD' and emitido>=previo and emitido<=p_ahora;
 resultado:=jsonb_build_object('ahora',p_ahora,'hoy',hoy,'lunes',lunes,'moneda','USD',
 'semana_actual',actual::text,'semana_anterior_comparable',anterior::text,'diferencia',(actual-anterior)::text,
 'variacion_pct',case when anterior>0 then (100*(actual-anterior)/anterior)::text else null end,
 'facturas_semana',cantidad,
 'ventas_hoy',(select coalesce(sum(total),0)::text from alexmar.ventas where estado='confirmada' and tipo='factura' and moneda='USD' and emitido>=(hoy::timestamp at time zone 'America/Caracas') and emitido<=p_ahora));
 with dias as(select hoy-i fecha from generate_series(0,13)i),
 totales as(select (emitido at time zone 'America/Caracas')::date fecha,sum(total) total,count(*) facturas
 from alexmar.ventas where estado='confirmada' and tipo='factura' and moneda='USD'
 and emitido>=((hoy-13)::timestamp at time zone 'America/Caracas') and emitido<=p_ahora group by 1)
 select resultado||jsonb_build_object('dias',jsonb_agg(jsonb_build_object('fecha',d.fecha,'total',coalesce(t.total,0)::text,'facturas',coalesce(t.facturas,0))order by d.fecha))
 into resultado from dias d left join totales t using(fecha);
 with semanas as(select lunes-7*i fecha from generate_series(0,7)i),
 totales as(select date_trunc('week',emitido at time zone 'America/Caracas')::date fecha,sum(total) total,count(*) facturas
 from alexmar.ventas where estado='confirmada' and tipo='factura' and moneda='USD'
 and emitido>=((lunes-49)::timestamp at time zone 'America/Caracas') and emitido<=p_ahora group by 1)
 select resultado||jsonb_build_object('semanas',jsonb_agg(jsonb_build_object('fecha',s.fecha,'total',coalesce(t.total,0)::text,'facturas',coalesce(t.facturas,0))order by s.fecha))
 into resultado from semanas s left join totales t using(fecha);
 return resultado;
end $$;
revoke all on function public.rendimiento_ventas(timestamptz) from public,anon;
grant execute on function public.rendimiento_ventas(timestamptz) to authenticated;
commit;

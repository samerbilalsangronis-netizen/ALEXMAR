begin;
-- Se conserva la firma de las RPC existentes y no se recarga ningún dato.
alter table alexmar.pagos_venta add column idempotencia uuid unique;
alter table alexmar.pagos_venta add column firma text;


alter table alexmar.ventas add column condicion text not null default 'credito' check(condicion in ('contado','credito'));
update alexmar.ventas set condicion='contado' where abono=total;
-- Total de cantidad (4 decimales) × precio (80): hasta 84 decimales, sin redondear.
create function alexmar.numero_cobro(t text) returns numeric language plpgsql immutable set search_path=pg_catalog as $$
begin
 if coalesce(t,'') !~ '^[0-9]{1,16}(\.[0-9]{1,84})?$' or t::numeric>=10000000000000000 then raise exception 'Monto no negativo, menor a 10^16, con hasta 84 decimales.';end if;
 return t::numeric;
end $$;
revoke all on function alexmar.numero_cobro(text) from public,anon,authenticated;

create or replace function public.guardar_venta(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare rol text;ident uuid:=(p->>'id')::uuid;doc alexmar.ventas;linea jsonb;variante alexmar.variantes;
 cliente uuid:=(p->>'cliente_id')::uuid;cantidad numeric;precio numeric;sub numeric:=0;rebaja numeric;abonado numeric;
 gratis boolean:=coalesce((p->>'permite_gratis')::boolean,false);n integer:=0;
 firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
begin
 rol:=alexmar.exigir(array['administrador','ventas']);
 if ident is null then raise exception 'Falta el identificador de la venta.';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,817));
 select * into doc from alexmar.ventas where id=ident for update;
 if found then
  if doc.estado<>'borrador' then raise exception 'La venta ya fue emitida o anulada.';end if;
  if doc.firma=firma then return ident;end if;
  if coalesce((p->>'version')::integer,0)<>doc.version then raise exception 'El borrador cambió. Vuelve a abrirlo antes de editar.';end if;
 elsif coalesce((p->>'version')::integer,0)<>0 then raise exception 'Borrador no encontrado.';end if;
 if not exists(select 1 from alexmar.clientes where id=cliente and activo) then raise exception 'Selecciona un cliente activo.';end if;
 if coalesce(p->>'moneda','USD')<>'USD' then raise exception 'Esta fase factura en USD, sin conversión automática.';end if;
 if coalesce((p->>'impuesto_tasa')::numeric,0)<>0 then raise exception 'El impuesto configurado para esta entrega es 0.';end if;
 if coalesce(p->>'tipo','factura') not in ('factura','presupuesto') then raise exception 'Tipo de documento inválido.';end if;
 if gratis and rol<>'administrador' then raise exception 'Solo el administrador puede autorizar entregas gratuitas.';end if;
 if jsonb_typeof(p->'lineas') is distinct from 'array' then raise exception 'Añade productos o servicios.';end if;
 if jsonb_array_length(p->'lineas') not between 1 and 200 then raise exception 'La venta admite entre 1 y 200 líneas.';end if;
 rebaja:=alexmar.numero_migracion(coalesce(p->>'descuento','0'));
 abonado:=alexmar.numero_cobro(coalesce(p->>'abono','0'));
 if coalesce(p->>'condicion','credito') not in ('contado','credito') then raise exception 'Condición inválida.';end if;
 if rol<>'administrador' and rebaja<>0 then raise exception 'Solo el administrador puede autorizar descuentos.';end if;
 if abonado>0 and coalesce(p->>'metodo_pago','') not in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Otro') then raise exception 'Selecciona el método del pago inicial.';end if;
 if length(coalesce(p->>'observaciones',''))>4000 then raise exception 'Observaciones demasiado largas.';end if;
 -- Revisión íntegra antes de sustituir un borrador; ningún cambio parcial sobrevive a un error.
 for linea in select value from jsonb_array_elements(p->'lineas') loop
  cantidad:=alexmar.numero_migracion(linea->>'cantidad');precio:=alexmar.numero_migracion(linea->>'precio');
  if cantidad<=0 or cantidad>=100000000 or cantidad<>round(cantidad,4) then raise exception 'Cantidad positiva, menor a 100 millones y hasta cuatro decimales.';end if;
  if nullif(linea->>'variante_id','') is not null then
   select v.* into variante from alexmar.variantes v join alexmar.productos a on a.id=v.producto_id where v.id=(linea->>'variante_id')::uuid and a.activo;
   if not found then raise exception 'Producto inexistente o inactivo.';end if;
   if rol<>'administrador' and (variante.precio is null or precio<>variante.precio) then raise exception 'El precio del producto falta o cambió. Actualiza la selección o solicita revisión al administrador.';end if;
  elsif trim(coalesce(linea->>'descripcion',''))='' then raise exception 'Describe el servicio.';end if;
  if precio=0 and not gratis then raise exception 'Las líneas gratuitas requieren autorización explícita del administrador.';end if;
  sub:=sub+cantidad*precio;
 end loop;
 if rebaja>sub then raise exception 'El descuento supera el subtotal.';end if;
 if abonado>sub-rebaja then raise exception 'El pago inicial supera el total. Los anticipos adicionales requieren otro flujo.';end if;
 if sub-rebaja=0 and not gratis then raise exception 'Un total gratuito requiere autorización del administrador.';end if;
 insert into alexmar.ventas(id,cliente_id,condicion,tipo,subtotal,descuento,total,abono,metodo_pago,vence,observaciones,permite_gratis,version,firma,usuario_id)
 values(ident,cliente,coalesce(p->>'condicion',case when abonado=sub-rebaja then 'contado' else 'credito' end),coalesce(p->>'tipo','factura'),sub,rebaja,sub-rebaja,abonado,nullif(p->>'metodo_pago',''),nullif(p->>'vence','')::date,coalesce(p->>'observaciones',''),gratis,1,firma,auth.uid())
 on conflict(id) do update set cliente_id=excluded.cliente_id,condicion=excluded.condicion,tipo=excluded.tipo,subtotal=excluded.subtotal,descuento=excluded.descuento,total=excluded.total,abono=excluded.abono,metodo_pago=excluded.metodo_pago,vence=excluded.vence,observaciones=excluded.observaciones,permite_gratis=excluded.permite_gratis,version=alexmar.ventas.version+1,firma=excluded.firma;
 delete from alexmar.lineas_venta where venta_id=ident;
 for linea in select value from jsonb_array_elements(p->'lineas') loop
  n:=n+1;
  insert into alexmar.lineas_venta(venta_id,orden,variante_id,descripcion,cantidad,precio)
  values(ident,n,nullif(linea->>'variante_id','')::uuid,
   case when nullif(linea->>'variante_id','') is not null then (select a.nombre||case when v.nombre<>'Principal' then ' · '||v.nombre else '' end from alexmar.variantes v join alexmar.productos a on a.id=v.producto_id where v.id=(linea->>'variante_id')::uuid) else trim(linea->>'descripcion') end,
   (linea->>'cantidad')::numeric,(linea->>'precio')::numeric);
 end loop;
 return ident;
end $$;


create or replace function public.emitir_venta(p_id uuid,p_version integer) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.ventas;l record;fisico numeric;reservado numeric;num bigint;etiqueta text;
begin
 perform alexmar.exigir(array['administrador','ventas']);
 select * into doc from alexmar.ventas where id=p_id for update;
 if not found then raise exception 'Venta no encontrada.';end if;
 if doc.estado='confirmada' then return p_id;end if;
 if doc.estado<>'borrador' then raise exception 'La venta está anulada.';end if;
 if doc.version is distinct from p_version then raise exception 'El borrador cambió. Revisa de nuevo los totales antes de emitir.';end if;
 if doc.condicion='contado' and doc.abono<>doc.total then raise exception 'Al contado debes registrar el cobro completo.';end if;
 if not exists(select 1 from alexmar.clientes where id=doc.cliente_id and activo) then raise exception 'El cliente ya no está activo.';end if;
 -- Mismo orden de bloqueo que otras ventas y ajustes; no se autoriza stock negativo.
 perform v.id from alexmar.variantes v where v.id in(select variante_id from alexmar.lineas_venta where venta_id=p_id) order by v.id for update;
 for l in select variante_id,sum(cantidad) cantidad from alexmar.lineas_venta where venta_id=p_id and variante_id is not null group by variante_id order by variante_id loop
  if not exists(select 1 from alexmar.variantes v join alexmar.productos a on a.id=v.producto_id where v.id=l.variante_id and a.activo) then raise exception 'Un producto ya no está activo.';end if;
  select coalesce(sum(cantidad),0) into fisico from alexmar.movimientos_stock where variante_id=l.variante_id;
  select coalesce(sum(cantidad),0) into reservado from alexmar.reservas where variante_id=l.variante_id and estado='activa';
  if fisico-reservado<l.cantidad then raise exception 'Existencia disponible insuficiente. Revisa productos y cantidades.';end if;
 end loop;
 num:=nextval('alexmar.numero_venta');etiqueta:='V-'||lpad(num::text,greatest(6,length(num::text)),'0');
 update alexmar.ventas set numero=num,tipo='factura',estado='confirmada',emitido=now(),version=version+1,
 cliente_snapshot=(select jsonb_build_object('nombre',nombre,'documento',documento,'telefono',telefono,'direccion',direccion) from alexmar.clientes where id=doc.cliente_id) where id=p_id;
 insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia)
 select variante_id,-sum(cantidad),'Venta '||etiqueta,auth.uid(),'venta:'||p_id||':'||variante_id
 from alexmar.lineas_venta where venta_id=p_id and variante_id is not null group by variante_id;
 insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
 values(doc.cliente_id,'CARGO',now(),'Factura '||etiqueta,'USD',doc.total,p_id);
 if doc.abono>0 then
  insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
  values(doc.cliente_id,'ABONO',now(),'Pago inicial factura '||etiqueta||' · '||doc.metodo_pago,'USD',doc.abono,p_id);
  insert into alexmar.pagos_venta(venta_id,tipo,monto,metodo,usuario_id) values(p_id,'cobro',doc.abono,doc.metodo_pago,auth.uid());
 end if;
 return p_id;
end $$;


create function public.emitir_factura(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
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

create function public.cobrar_factura(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;clave uuid:=(p->>'idempotencia')::uuid;doc alexmar.ventas;anterior alexmar.pagos_venta;
 importe numeric;pagado numeric;firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
begin
 perform alexmar.exigir(array['administrador','ventas']);
 if ident is null or clave is null then raise exception 'Falta identificar factura y cobro.';end if;
 -- Serializa reintentos de una misma clave incluso si apuntan a documentos distintos.
 perform pg_advisory_xact_lock(hashtextextended(clave::text,821));
 select * into anterior from alexmar.pagos_venta where idempotencia=clave;
 if found then
  if anterior.firma=firma then return anterior.id;end if;
  raise exception 'La clave del cobro ya se usó con otros datos.';
 end if;
 select * into doc from alexmar.ventas where id=ident for update;
 if not found or doc.estado<>'confirmada' then raise exception 'Solo puedes cobrar una factura emitida y vigente.';end if;
 if coalesce(p->>'monto','') !~ '^[0-9]{1,16}(\.[0-9]{1,84})?$' then raise exception 'Monto positivo con hasta 84 decimales.';end if;
 importe:=(p->>'monto')::numeric;
 if importe<=0 or importe>=10000000000000000 then raise exception 'Monto fuera de rango.';end if;
 if coalesce(p->>'metodo','') not in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Otro') then raise exception 'Selecciona el método de pago.';end if;
 select coalesce(sum(monto),0) into pagado from alexmar.pagos_venta where venta_id=ident;
 if importe>doc.total-pagado then raise exception 'El cobro supera el saldo pendiente. Actualiza la factura.';end if;
 insert into alexmar.pagos_venta(venta_id,tipo,monto,metodo,usuario_id,idempotencia,firma)
 values(ident,'cobro',importe,p->>'metodo',auth.uid(),clave,firma) returning id into clave;
 insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
 values(doc.cliente_id,'ABONO',now(),'Cobro factura V-'||lpad(doc.numero::text,greatest(6,length(doc.numero::text)),'0')||' · '||(p->>'metodo'),'USD',importe,ident);
 update alexmar.ventas set version=version+1 where id=ident;
 return clave;
end $$;

-- La anulación revierte todos los cobros, no únicamente el pago inicial.
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
  perform v.id from alexmar.variantes v where v.id in(select variante_id from alexmar.lineas_venta where venta_id=p_id) order by v.id for update;
  insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia)
  select variante_id,sum(cantidad),'Anulación '||etiqueta||': '||p_motivo,auth.uid(),'anulacion:'||p_id||':'||variante_id
  from alexmar.lineas_venta where venta_id=p_id and variante_id is not null group by variante_id;
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
create function public.anular_factura_revisada(p_id uuid,p_version integer,p_motivo text,p_reembolso boolean default false) returns void language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.ventas;
begin
 perform alexmar.exigir(array['administrador']);
 select * into doc from alexmar.ventas where id=p_id for update;
 if not found then raise exception 'Venta no encontrada.';end if;
 if doc.estado='anulada' then return;end if;
 if doc.version is distinct from p_version then raise exception 'La factura cambió. Revisa otra vez los cobros y el reembolso antes de anular.';end if;
 perform public.anular_venta(p_id,p_motivo,p_reembolso);
end $$;

create or replace function public.ficha_venta(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','ventas']);
 return(select (to_jsonb(v)-'firma')||jsonb_build_object('subtotal',v.subtotal::text,'descuento',v.descuento::text,'total',v.total::text,'abono',v.abono::text,
 'condicion',v.condicion,
 'pagado',c.pagado::text,'saldo',case when v.estado='confirmada' then (v.total-c.pagado)::text else '0' end,
 'cliente',coalesce(v.cliente_snapshot,(select jsonb_build_object('nombre',nombre,'documento',documento,'telefono',telefono,'direccion',direccion) from alexmar.clientes where id=v.cliente_id)),
 'lineas',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'variante_id',l.variante_id,'descripcion',l.descripcion,'cantidad',l.cantidad::text,'precio',l.precio::text,'importe',l.importe::text) order by l.orden) from alexmar.lineas_venta l where l.venta_id=v.id),'[]'::jsonb),
 'pagos',coalesce((select jsonb_agg(jsonb_build_object('tipo',tipo,'monto',monto::text,'metodo',metodo,'creado',creado) order by creado,id) from alexmar.pagos_venta where venta_id=v.id),'[]'::jsonb))
 from alexmar.ventas v cross join lateral(select coalesce(sum(monto),0) pagado from alexmar.pagos_venta where venta_id=v.id)c where v.id=p_id);
end $$;

create or replace function public.buscar_ventas(p jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare pag integer:=greatest(1,coalesce((p->>'pagina')::int,1));r jsonb;
 desde date:=nullif(p->>'desde','')::date;hasta date:=nullif(p->>'hasta','')::date;
 consulta text:=alexmar.normalizar(regexp_replace(coalesce(p->>'q',''),'^V-0*','','i'));
begin
 perform alexmar.exigir(array['administrador','ventas']);
 if desde>hasta then raise exception 'La fecha inicial supera la final.';end if;
 with base as(
 select v.*,coalesce(v.cliente_snapshot->>'nombre',c.nombre) cliente,
 coalesce(v.emitido,v.creado) fecha,cobros.pagado,
 case when v.estado='confirmada' then v.total-cobros.pagado else 0 end saldo
 from alexmar.ventas v join alexmar.clientes c on c.id=v.cliente_id
 cross join lateral(select coalesce(sum(monto),0) pagado from alexmar.pagos_venta where venta_id=v.id)cobros
 where (nullif(p->>'cliente_id','') is null or v.cliente_id=(p->>'cliente_id')::uuid)
 and (desde is null or coalesce(v.emitido,v.creado)>=(desde::timestamp at time zone 'America/Caracas'))
 and (hasta is null or coalesce(v.emitido,v.creado)<((hasta+1)::timestamp at time zone 'America/Caracas'))
 and (case when trim(coalesce(p->>'q','')) ~* '^(V-)?[0-9]+$' then v.numero::text=coalesce(nullif(ltrim(regexp_replace(trim(p->>'q'),'^V-','','i'),'0'),''),'0') else not exists(select 1 from regexp_split_to_table(trim(consulta),'\s+') palabra where palabra<>'' and strpos(alexmar.normalizar(
 coalesce(v.numero::text,'')||' '||coalesce(v.cliente_snapshot->>'nombre',c.nombre)||' '||coalesce(c.documento,'')||' '||coalesce(c.telefono,'')||' '||
 coalesce((select string_agg(descripcion,' ') from alexmar.lineas_venta where venta_id=v.id),'')),palabra)=0) end)
 ), filas as(select * from base where
 (coalesce(p->>'estado','')='' or estado=p->>'estado')
 and (coalesce(p->>'cobro','')='' or (estado='confirmada' and ((p->>'cobro'='pendiente' and saldo>0) or (p->>'cobro'='pagada' and saldo=0))))
 ), hoja as(select * from filas order by fecha desc,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('total',(select count(*) from filas),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from filas)/30.0)),
 'resumen',(select jsonb_build_object('facturado',coalesce(sum(total) filter(where estado='confirmada'),0)::text,
 'cobrado',coalesce(sum(pagado) filter(where estado='confirmada'),0)::text,'pendiente',coalesce(sum(saldo) filter(where estado='confirmada'),0)::text,
 'emitidas',count(*) filter(where estado='confirmada')) from filas),
 'filas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'numero',numero,'tipo',tipo,'estado',estado,'cliente',cliente,'cliente_id',cliente_id,'creado',creado,'fecha',fecha,'total',total::text,'abono',abono::text,'pagado',pagado::text,'saldo',saldo::text,'condicion',condicion) order by fecha desc,id) from hoja),'[]'::jsonb)) into r;return r;
end $$;

-- El historial anterior incluye correcciones auditadas, sin mezclar facturas nuevas.
create function public.historial_cliente_anterior(p_id uuid,p_desde date default null,p_hasta date default null,p_pagina integer default 1,p_moneda text default 'USD') returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare r jsonb;pag integer:=greatest(1,coalesce(p_pagina,1));
begin
 perform alexmar.exigir(array['administrador','ventas']);
 if p_moneda not in ('USD','VES','COP') then raise exception 'Moneda inválida.';end if;
 if p_desde>p_hasta then raise exception 'La fecha inicial supera la final.';end if;
 with todos as(select m.*,case tipo when 'CARGO' then monto when 'ABONO' then -monto else 0 end neto
 from alexmar.movimientos_cuenta m where cliente_id=p_id and activo and moneda=p_moneda and venta_id is null
 and origen in ('supabase_anterior','actualizacion_origen')),
 prev as(select coalesce(sum(neto),0) importe from todos where p_desde is not null and fecha<(p_desde::timestamp at time zone 'America/Caracas')),
 periodo as(select *, (select importe from prev)+sum(neto)over(order by fecha,id) saldo from todos
 where (p_desde is null or fecha>=(p_desde::timestamp at time zone 'America/Caracas')) and (p_hasta is null or fecha<((p_hasta+1)::timestamp at time zone 'America/Caracas'))),
 hoja as(select * from periodo order by fecha,id limit 50 offset (pag::bigint-1)*50)
 select jsonb_build_object('cliente',(select to_jsonb(c) from alexmar.clientes c where id=p_id),'moneda',p_moneda,
 'anterior',(select importe::text from prev),'cargos',(select coalesce(sum(monto)filter(where tipo='CARGO'),0)::text from periodo),
 'abonos',(select coalesce(sum(monto)filter(where tipo='ABONO'),0)::text from periodo),
 'final',((select importe from prev)+(select coalesce(sum(neto),0) from periodo))::text,
 'total',(select count(*) from periodo),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from periodo)/50.0)),
 'filas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'fecha',fecha,'descripcion',descripcion,'tipo',tipo,'importe',monto::text,'saldo',saldo::text,'cantidad',datos_originales->>'cantidad','precio_unitario',datos_originales->>'precio_unitario')order by fecha,id) from hoja),'[]'::jsonb)) into r;return r;
end $$;

create function public.configuracion_facturacion() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','ventas']);
 return jsonb_build_object('version',11,'moneda','USD');
end $$;
create function public.guardar_borrador_factura(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','ventas']);
 return public.guardar_venta(p);
end $$;
revoke all on function public.configuracion_facturacion(),public.guardar_borrador_factura(jsonb) from public,anon;
grant execute on function public.configuracion_facturacion(),public.guardar_borrador_factura(jsonb) to authenticated;

revoke all on function public.emitir_factura(jsonb),public.cobrar_factura(jsonb),public.anular_factura_revisada(uuid,integer,text,boolean),public.historial_cliente_anterior(uuid,date,date,integer,text) from public,anon;
grant execute on function public.emitir_factura(jsonb),public.cobrar_factura(jsonb),public.anular_factura_revisada(uuid,integer,text,boolean),public.historial_cliente_anterior(uuid,date,date,integer,text) to authenticated;
commit;

begin;
do $$begin
 if to_regprocedure('public.abonar_cuenta_cliente(jsonb)') is null or not exists(select 1 from information_schema.columns where table_schema='alexmar' and table_name='lineas_venta' and column_name='precio_personalizado') then raise exception 'Aplica primero los SQL pendientes hasta 017.';end if;
 if strpos(pg_get_functiondef('public.cobrar_factura(jsonb)'::regprocedure),'''Binance''')=0 then raise exception 'Aplica primero SQL 017 (métodos de pago).';end if;
end $$;
alter table alexmar.ventas alter column cliente_id drop not null;
alter table alexmar.ventas add constraint cuenta_credito_requerida check(cliente_id is not null or condicion='contado');
alter table alexmar.lineas_venta add column clase_linea text not null default 'servicio' check(clase_linea in ('producto','servicio','producto_pendiente'));
update alexmar.lineas_venta set clase_linea='producto' where variante_id is not null;
create table alexmar.productos_sin_cargar(
 linea_id uuid primary key references alexmar.lineas_venta(id),venta_id uuid not null references alexmar.ventas(id),
 estado text not null default 'pendiente' check(estado in ('pendiente','resuelto','anulado')),
 variante_id uuid references alexmar.variantes(id),creado timestamptz not null default clock_timestamp(),
 resuelto timestamptz,usuario_id uuid references auth.users(id)
);
alter table alexmar.productos_sin_cargar enable row level security;
revoke all on alexmar.productos_sin_cargar from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.productos_sin_cargar for each row execute function alexmar.auditar();
create index pendientes_estado_fecha on alexmar.productos_sin_cargar(estado,creado,linea_id);
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
 if cliente is null then
  if p->>'condicion' is distinct from 'contado' then raise exception 'El crédito requiere una cuenta de cliente.';end if;
  if length(coalesce(p->'cliente_contado'->>'nombre',''))>200 or length(coalesce(p->'cliente_contado'->>'documento',''))>80 or length(coalesce(p->'cliente_contado'->>'telefono',''))>80 or length(coalesce(p->'cliente_contado'->>'direccion',''))>500 then raise exception 'Revisa la longitud de los datos del comprobante.';end if;
 elsif not exists(select 1 from alexmar.clientes where id=cliente and activo) then raise exception 'Selecciona un cliente activo.';end if;
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
 if abonado>0 and coalesce(p->>'metodo_pago','') not in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Zelle','Binance','Otro') then raise exception 'Selecciona el método del pago inicial.';end if;
 if length(coalesce(p->>'observaciones',''))>4000 then raise exception 'Observaciones demasiado largas.';end if;
 -- Revisión íntegra antes de sustituir un borrador; ningún cambio parcial sobrevive a un error.
 for linea in select value from jsonb_array_elements(p->'lineas') loop
  if coalesce((linea->>'precio_personalizado')::boolean,false) and rol<>'administrador' then raise exception 'Solo el administrador puede autorizar un precio para esta operación.';end if;
  if coalesce(linea->>'clase_linea','servicio') not in ('producto','servicio','producto_pendiente') then raise exception 'Tipo de línea inválido.';end if;
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
  insert into alexmar.lineas_venta(venta_id,orden,variante_id,descripcion,cantidad,precio,precio_personalizado,clase_linea)
  values(ident,n,nullif(linea->>'variante_id','')::uuid,
   case when nullif(linea->>'variante_id','') is not null then (select a.nombre||case when v.nombre<>'Principal' then ' · '||v.nombre else '' end from alexmar.variantes v join alexmar.productos a on a.id=v.producto_id where v.id=(linea->>'variante_id')::uuid) else trim(linea->>'descripcion') end,
   (linea->>'cantidad')::numeric,(linea->>'precio')::numeric,coalesce((linea->>'precio_personalizado')::boolean,false),case when nullif(linea->>'variante_id','') is not null then 'producto' else case when linea->>'clase_linea'='producto' then 'producto_pendiente' else coalesce(linea->>'clase_linea','servicio') end end);
 end loop;
 update alexmar.ventas set cliente_snapshot=case when cliente is null then jsonb_build_object('nombre',coalesce(nullif(trim(p->'cliente_contado'->>'nombre'),''),'Consumidor final'),'documento',coalesce(p->'cliente_contado'->>'documento',''),'telefono',coalesce(p->'cliente_contado'->>'telefono',''),'direccion',coalesce(p->'cliente_contado'->>'direccion','')) else null end where id=ident;
 return ident;
end $$;

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
 if doc.cliente_id is not null and not exists(select 1 from alexmar.clientes where id=doc.cliente_id and activo) then raise exception 'El cliente ya no está activo.';end if;
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
 cliente_snapshot=coalesce((select jsonb_build_object('nombre',nombre,'documento',documento,'telefono',telefono,'direccion',direccion) from alexmar.clientes where id=doc.cliente_id),doc.cliente_snapshot) where id=p_id;
 if control then
 insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia)
 select variante_id,-sum(cantidad),'Venta '||etiqueta,auth.uid(),'venta:'||p_id||':'||variante_id
 from alexmar.lineas_venta where venta_id=p_id and variante_id is not null group by variante_id;
 end if;
 if doc.cliente_id is not null then
 insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
 values(doc.cliente_id,'CARGO',now(),'Factura '||etiqueta,'USD',doc.total,p_id);
 end if;
 if doc.abono>0 then
  if doc.cliente_id is not null then
  insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
  values(doc.cliente_id,'ABONO',now(),'Pago inicial factura '||etiqueta||' · '||doc.metodo_pago,'USD',doc.abono,p_id);
  end if;
  insert into alexmar.pagos_venta(venta_id,tipo,monto,metodo,usuario_id) values(p_id,'cobro',doc.abono,doc.metodo_pago,auth.uid());
 end if;
 return p_id;
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
    select m.variante_id from alexmar.movimientos_stock m where (m.idempotencia='venta:'||p_id||':'||m.variante_id or m.idempotencia in (select 'pendiente-stock:'||linea_id from alexmar.productos_sin_cargar where venta_id=p_id and estado='resuelto'))
   ) order by v.id for update;
   insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia)
   select m.variante_id,-sum(m.cantidad),'Anulación '||etiqueta||': '||p_motivo,auth.uid(),'anulacion:'||p_id||':'||m.variante_id
   from alexmar.movimientos_stock m where (m.idempotencia='venta:'||p_id||':'||m.variante_id or m.idempotencia in (select 'pendiente-stock:'||linea_id from alexmar.productos_sin_cargar where venta_id=p_id and estado='resuelto')) and m.cantidad<0 group by m.variante_id;
  end if;
  if doc.cliente_id is not null then
  insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
  values(doc.cliente_id,'ABONO',now(),'Anulación factura '||etiqueta||': '||p_motivo,'USD',doc.total,p_id);
  end if;
  if pagado>0 then
   if doc.cliente_id is not null then
   insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
   values(doc.cliente_id,'CARGO',now(),'Reversión cobros '||etiqueta,'USD',pagado,p_id);
   end if;
   insert into alexmar.pagos_venta(venta_id,tipo,monto,metodo,usuario_id) values(p_id,'reversion',-pagado,'Otro',auth.uid());
  end if;
 end if;
 update alexmar.ventas set estado='anulada',motivo_anulacion=p_motivo,anulado=now(),version=version+1 where id=p_id;
end $$;

create or replace function public.ficha_venta(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','ventas']);
 return(select (to_jsonb(v)-'firma')||jsonb_build_object('subtotal',v.subtotal::text,'descuento',v.descuento::text,'total',v.total::text,'abono',v.abono::text,
 'condicion',v.condicion,
 'pagado',c.pagado::text,'saldo',case when v.estado='confirmada' then (v.total-c.pagado)::text else '0' end,
 'cliente',coalesce(v.cliente_snapshot,(select jsonb_build_object('nombre',nombre,'documento',documento,'telefono',telefono,'direccion',direccion) from alexmar.clientes where id=v.cliente_id)),
 'lineas',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'variante_id',l.variante_id,'descripcion',l.descripcion,'cantidad',l.cantidad::text,'precio',l.precio::text,'precio_personalizado',l.precio_personalizado,'clase_linea',l.clase_linea,'importe',l.importe::text) order by l.orden) from alexmar.lineas_venta l where l.venta_id=v.id),'[]'::jsonb),
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
 from alexmar.ventas v left join alexmar.clientes c on c.id=v.cliente_id
 cross join lateral(select coalesce(sum(monto),0) pagado from alexmar.pagos_venta where venta_id=v.id)cobros
 where (nullif(p->>'cliente_id','') is null or v.cliente_id=(p->>'cliente_id')::uuid)
 and (desde is null or coalesce(v.emitido,v.creado)>=(desde::timestamp at time zone 'America/Caracas'))
 and (hasta is null or coalesce(v.emitido,v.creado)<((hasta+1)::timestamp at time zone 'America/Caracas'))
 and (case when trim(coalesce(p->>'q','')) ~* '^(V-)?[0-9]+$' then v.numero::text=coalesce(nullif(ltrim(regexp_replace(trim(p->>'q'),'^V-','','i'),'0'),''),'0') else not exists(select 1 from regexp_split_to_table(trim(consulta),'\s+') palabra where palabra<>'' and strpos(alexmar.normalizar(
 coalesce(v.numero::text,'')||' '||coalesce(v.cliente_snapshot->>'nombre',c.nombre)||' '||coalesce(v.cliente_snapshot->>'documento',c.documento,'')||' '||coalesce(v.cliente_snapshot->>'telefono',c.telefono,'')||' '||
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

create or replace function public.configuracion_facturacion() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','ventas']);
 return(select jsonb_build_object('version_rapida',18,'version',11,'moneda','USD','descontar_stock',descontar_stock,'version_stock',version) from alexmar.configuracion_comercial where id=1);
end $$;
create function alexmar.encolar_productos_venta() returns trigger
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 if new.estado='confirmada' and old.estado='borrador' then
  insert into alexmar.productos_sin_cargar(linea_id,venta_id)
  select id,new.id from alexmar.lineas_venta where venta_id=new.id and clase_linea='producto_pendiente' and variante_id is null on conflict do nothing;
 elsif new.estado='anulada' then
  update alexmar.productos_sin_cargar set estado='anulado' where venta_id=new.id and estado='pendiente';
 end if;
 return new;
end $$;
revoke all on function alexmar.encolar_productos_venta() from public,anon,authenticated;
create trigger encolar_productos after update of estado on alexmar.ventas for each row execute function alexmar.encolar_productos_venta();

create function public.listar_productos_sin_cargar(p_pagina integer default 1) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare pag integer:=greatest(1,coalesce(p_pagina,1));r jsonb;
begin
 perform alexmar.exigir(array['administrador']);
 with todos as(select q.linea_id,q.venta_id,q.creado,v.numero,v.cliente_snapshot->>'nombre' cliente,l.descripcion,l.cantidad::text cantidad,l.precio::text precio,l.importe::text importe
 from alexmar.productos_sin_cargar q join alexmar.ventas v on v.id=q.venta_id join alexmar.lineas_venta l on l.id=q.linea_id where q.estado='pendiente' and v.estado='confirmada'),
 hoja as(select * from todos order by creado,linea_id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(h) order by creado,linea_id) from hoja h),'[]'),'total',(select count(*) from todos),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from todos)/30.0))) into r;return r;
end $$;

create function public.vincular_producto_pendiente(p_linea uuid,p_variante uuid) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.ventas;q alexmar.productos_sin_cargar;l alexmar.lineas_venta;fisico numeric;reservado numeric;
begin
 perform alexmar.exigir(array['administrador']);
 select v.* into doc from alexmar.ventas v join alexmar.productos_sin_cargar pq on pq.venta_id=v.id where pq.linea_id=p_linea for update of v;
 if not found or doc.estado<>'confirmada' then raise exception 'El comprobante ya no está vigente.';end if;
 select * into strict q from alexmar.productos_sin_cargar where linea_id=p_linea for update;
 if q.estado='resuelto' then
  if q.variante_id is distinct from p_variante then raise exception 'La línea ya fue vinculada a otro producto.';end if;
  return;
 end if;
 if q.estado<>'pendiente' then raise exception 'Esta línea ya no está pendiente.';end if;
 perform v.id from alexmar.variantes v join alexmar.productos a on a.id=v.producto_id where v.id=p_variante and a.activo for update of v;
 if not found then raise exception 'Selecciona un producto activo del inventario.';end if;
 select * into strict l from alexmar.lineas_venta where id=p_linea;
 if doc.descontar_stock then
  select coalesce(sum(cantidad),0) into fisico from alexmar.movimientos_stock where variante_id=p_variante;
  select coalesce(sum(cantidad),0) into reservado from alexmar.reservas where variante_id=p_variante and estado='activa';
  if fisico-reservado<l.cantidad then raise exception 'Registra la recepción o conteo de estas unidades antes de vincular. La factura descontaba stock.';end if;
  insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia)
  values(p_variante,-l.cantidad,'Producto pendiente de factura V-'||doc.numero,auth.uid(),'pendiente-stock:'||p_linea);
 end if;
 update alexmar.lineas_venta set variante_id=p_variante,clase_linea='producto' where id=p_linea;
 update alexmar.productos_sin_cargar set estado='resuelto',variante_id=p_variante,resuelto=clock_timestamp(),usuario_id=auth.uid() where linea_id=p_linea;
 update alexmar.ventas set version=version+1 where id=doc.id;
end $$;

create function public.emitir_factura_rapida(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador']);
 if coalesce((p->>'descuento')::numeric,0)<>0 or coalesce((p->>'permite_gratis')::boolean,false) or coalesce(p->>'observaciones','')<>'' then raise exception 'La carga rápida no utiliza descuentos, autorizaciones gratuitas ni observaciones.';end if;
 return public.emitir_factura(p);
end $$;
revoke all on function public.listar_productos_sin_cargar(integer),public.vincular_producto_pendiente(uuid,uuid),public.emitir_factura_rapida(jsonb) from public,anon;
grant execute on function public.listar_productos_sin_cargar(integer),public.vincular_producto_pendiente(uuid,uuid),public.emitir_factura_rapida(jsonb) to authenticated;
commit;

begin;
create sequence alexmar.numero_venta;
create table alexmar.ventas(
 id uuid primary key,numero bigint unique,cliente_id uuid not null references alexmar.clientes,
 tipo text not null default 'factura' check(tipo in ('factura','presupuesto')),
 estado text not null default 'borrador' check(estado in ('borrador','confirmada','anulada')),
 moneda text not null default 'USD' check(moneda='USD'),
 subtotal numeric not null default 0 check(subtotal>=0),descuento numeric not null default 0 check(descuento>=0),
 impuesto_tasa numeric not null default 0 check(impuesto_tasa=0),total numeric not null default 0 check(total>=0),
 abono numeric not null default 0 check(abono>=0),metodo_pago text,vence date,observaciones text not null default '',
 permite_gratis boolean not null default false,cliente_snapshot jsonb,
 version integer not null default 1,firma text not null,
 usuario_id uuid not null references auth.users,creado timestamptz not null default now(),emitido timestamptz,
 motivo_anulacion text,anulado timestamptz,
 check(descuento<=subtotal and abono<=total)
);
create table alexmar.lineas_venta(
 id uuid primary key default gen_random_uuid(),venta_id uuid not null references alexmar.ventas,
 orden integer not null,variante_id uuid references alexmar.variantes,descripcion text not null,
 cantidad numeric not null check(cantidad>0),precio numeric not null check(precio>=0),
 importe numeric generated always as(cantidad*precio) stored,unique(venta_id,orden)
);
create table alexmar.pagos_venta(
 id uuid primary key default gen_random_uuid(),venta_id uuid not null references alexmar.ventas,
 tipo text not null check(tipo in ('cobro','reversion')),monto numeric not null,
 metodo text not null,usuario_id uuid not null references auth.users,creado timestamptz not null default now(),
 check((tipo='cobro' and monto>0) or (tipo='reversion' and monto<0))
);
alter table alexmar.movimientos_cuenta add column venta_id uuid references alexmar.ventas;
create index ventas_fecha on alexmar.ventas(creado desc,id);
create index ventas_cliente on alexmar.ventas(cliente_id);
create index lineas_venta_documento on alexmar.lineas_venta(venta_id,orden);
create index pagos_venta_documento on alexmar.pagos_venta(venta_id);
do $$declare t text;begin foreach t in array array['ventas','lineas_venta','pagos_venta'] loop
 execute format('alter table alexmar.%I enable row level security',t);
 execute format('create trigger auditar after insert or update or delete on alexmar.%I for each row execute function alexmar.auditar()',t);
end loop;end $$;
revoke all on alexmar.ventas,alexmar.lineas_venta,alexmar.pagos_venta,alexmar.numero_venta from public,anon,authenticated;

create function public.guardar_venta(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
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
 abonado:=alexmar.numero_migracion(coalesce(p->>'abono','0'));
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
 insert into alexmar.ventas(id,cliente_id,tipo,subtotal,descuento,total,abono,metodo_pago,vence,observaciones,permite_gratis,version,firma,usuario_id)
 values(ident,cliente,coalesce(p->>'tipo','factura'),sub,rebaja,sub-rebaja,abonado,nullif(p->>'metodo_pago',''),nullif(p->>'vence','')::date,coalesce(p->>'observaciones',''),gratis,1,firma,auth.uid())
 on conflict(id) do update set cliente_id=excluded.cliente_id,tipo=excluded.tipo,subtotal=excluded.subtotal,descuento=excluded.descuento,total=excluded.total,abono=excluded.abono,metodo_pago=excluded.metodo_pago,vence=excluded.vence,observaciones=excluded.observaciones,permite_gratis=excluded.permite_gratis,version=alexmar.ventas.version+1,firma=excluded.firma;
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

create function public.emitir_venta(p_id uuid,p_version integer) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.ventas;l record;fisico numeric;reservado numeric;num bigint;etiqueta text;
begin
 perform alexmar.exigir(array['administrador','ventas']);
 select * into doc from alexmar.ventas where id=p_id for update;
 if not found then raise exception 'Venta no encontrada.';end if;
 if doc.estado='confirmada' then return p_id;end if;
 if doc.estado<>'borrador' then raise exception 'La venta está anulada.';end if;
 if doc.version is distinct from p_version then raise exception 'El borrador cambió. Revisa de nuevo los totales antes de emitir.';end if;
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

create function public.anular_venta(p_id uuid,p_motivo text,p_reembolso boolean default false) returns void language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.ventas;etiqueta text;
begin
 perform alexmar.exigir(array['administrador']);
 select * into doc from alexmar.ventas where id=p_id for update;
 if not found then raise exception 'Venta no encontrada.';end if;
 if doc.estado='anulada' then return;end if;
 if length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Indica un motivo de al menos cinco caracteres.';end if;
 if doc.estado='confirmada' then
  if doc.abono>0 and not coalesce(p_reembolso,false) then raise exception 'Confirma que has revertido el cobro o entregado el reembolso del pago inicial.';end if;
  etiqueta:='V-'||lpad(doc.numero::text,greatest(6,length(doc.numero::text)),'0');
  perform v.id from alexmar.variantes v where v.id in(select variante_id from alexmar.lineas_venta where venta_id=p_id) order by v.id for update;
  insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia)
  select variante_id,sum(cantidad),'Anulación '||etiqueta||': '||p_motivo,auth.uid(),'anulacion:'||p_id||':'||variante_id
  from alexmar.lineas_venta where venta_id=p_id and variante_id is not null group by variante_id;
  insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
  values(doc.cliente_id,'ABONO',now(),'Anulación factura '||etiqueta||': '||p_motivo,'USD',doc.total,p_id);
  if doc.abono>0 then
   insert into alexmar.movimientos_cuenta(cliente_id,tipo,fecha,descripcion,moneda,monto,venta_id)
   values(doc.cliente_id,'CARGO',now(),'Reversión pago inicial '||etiqueta,'USD',doc.abono,p_id);
   insert into alexmar.pagos_venta(venta_id,tipo,monto,metodo,usuario_id) values(p_id,'reversion',-doc.abono,doc.metodo_pago,auth.uid());
  end if;
 end if;
 update alexmar.ventas set estado='anulada',motivo_anulacion=p_motivo,anulado=now(),version=version+1 where id=p_id;
end $$;

create function public.ficha_venta(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','ventas']);
 return(select (to_jsonb(v)-'firma')||jsonb_build_object('subtotal',v.subtotal::text,'descuento',v.descuento::text,'total',v.total::text,'abono',v.abono::text,
 'cliente',coalesce(v.cliente_snapshot,(select jsonb_build_object('nombre',nombre,'documento',documento,'telefono',telefono,'direccion',direccion) from alexmar.clientes where id=v.cliente_id)),
 'lineas',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'variante_id',l.variante_id,'descripcion',l.descripcion,'cantidad',l.cantidad::text,'precio',l.precio::text,'importe',l.importe::text) order by l.orden) from alexmar.lineas_venta l where l.venta_id=v.id),'[]'::jsonb),
 'pagos',coalesce((select jsonb_agg(jsonb_build_object('tipo',tipo,'monto',monto::text,'metodo',metodo,'creado',creado) order by creado,id) from alexmar.pagos_venta where venta_id=v.id),'[]'::jsonb))
 from alexmar.ventas v where v.id=p_id);
end $$;
create function public.buscar_ventas(p jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare pag integer:=greatest(1,coalesce((p->>'pagina')::int,1));r jsonb;
begin
 perform alexmar.exigir(array['administrador','ventas']);
 with filas as(
 select v.*,coalesce(v.cliente_snapshot->>'nombre',c.nombre) cliente from alexmar.ventas v join alexmar.clientes c on c.id=v.cliente_id
 where (coalesce(p->>'estado','')='' or v.estado=p->>'estado')
 and (coalesce(p->>'q','')='' or strpos(alexmar.normalizar(coalesce(v.numero::text,'')||' '||coalesce(v.cliente_snapshot->>'nombre',c.nombre)),alexmar.normalizar(regexp_replace(p->>'q','^V-0*','','i')))>0)
 ), hoja as(select * from filas order by creado desc,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('total',(select count(*) from filas),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from filas)/30.0)),
 'filas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'numero',numero,'tipo',tipo,'estado',estado,'cliente',cliente,'creado',creado,'total',total::text,'abono',abono::text) order by creado desc,id) from hoja),'[]'::jsonb)) into r;return r;
end $$;
revoke all on function public.guardar_venta(jsonb),public.emitir_venta(uuid,integer),public.anular_venta(uuid,text,boolean),public.ficha_venta(uuid),public.buscar_ventas(jsonb) from public,anon;
grant execute on function public.guardar_venta(jsonb),public.emitir_venta(uuid,integer),public.anular_venta(uuid,text,boolean),public.ficha_venta(uuid),public.buscar_ventas(jsonb) to authenticated;
commit;

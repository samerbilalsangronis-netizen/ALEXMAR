begin;
-- Correcciones de órdenes y abonos sin borrar su trazabilidad. Aplicar después de SQL 013.
alter table alexmar.compras add column version integer not null default 1;
alter table alexmar.compras add column motivo_correccion text;
alter table alexmar.pagos_compra add column anulado boolean not null default false;
alter table alexmar.pagos_compra add column motivo_correccion text;

create function alexmar.version_pago_compra() returns trigger
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 update alexmar.compras set version=version+1 where id=new.compra_id;
 return new;
end $$;
revoke all on function alexmar.version_pago_compra() from public,anon,authenticated;
create trigger version_pago after insert or update on alexmar.pagos_compra
for each row execute function alexmar.version_pago_compra();

create function public.editar_compra(p jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.compras;l record;x jsonb;q numeric;k numeric;total_nuevo numeric:=0;pagado numeric;
 fisico numeric;reservado numeric;cambio boolean;
begin
 perform alexmar.exigir(array['administrador']);
 if octet_length(p::text)>200000 then raise exception 'La orden supera el tamaño permitido.';end if;
 select * into doc from alexmar.compras where id=(p->>'id')::uuid for update;
 if not found or doc.estado<>'confirmada' then raise exception 'Orden no disponible para editar.';end if;
 if doc.version is distinct from (p->>'version')::integer then raise exception 'La orden cambió. Recarga y revisa los datos antes de guardar.';end if;
 if length(trim(coalesce(p->>'motivo',''))) not between 5 and 2000 then raise exception 'Escribe un motivo de 5 a 2000 caracteres.';end if;
 if length(coalesce(p->>'referencia',''))>100 or length(coalesce(p->>'observaciones',''))>4000 then raise exception 'Referencia u observaciones demasiado largas.';end if;
 if jsonb_typeof(p->'lineas') is distinct from 'array' then raise exception 'Faltan las líneas de la orden.';end if;
 if jsonb_array_length(p->'lineas')<>(select count(*) from alexmar.lineas_compra where compra_id=doc.id)
 or exists(select 1 from jsonb_array_elements(p->'lineas') a where not exists(select 1 from alexmar.lineas_compra lc where lc.compra_id=doc.id and lc.id=(a->>'id')::uuid))
 or (select count(distinct a->>'id') from jsonb_array_elements(p->'lineas') a)<>jsonb_array_length(p->'lineas') then raise exception 'Las líneas cambiaron. Recarga la orden completa.';end if;
 perform id from alexmar.variantes where id in(select variante_id from alexmar.lineas_compra where compra_id=doc.id) order by id for update;
 -- Validar todo antes de escribir. No reescribir la recepción original ni inventar disponibilidad.
 for l in select lc.*,v.costo from alexmar.lineas_compra lc join alexmar.variantes v on v.id=lc.variante_id where lc.compra_id=doc.id order by lc.variante_id loop
  select a into x from jsonb_array_elements(p->'lineas') a where a->>'id'=l.id::text;
  q:=alexmar.numero_migracion(x->>'cantidad');k:=alexmar.numero_migracion(x->>'costo_unitario');
  if q<=0 or q>=100000000 or q<>round(q,4) then raise exception 'Cantidad positiva, menor a 100 millones y hasta cuatro decimales.';end if;
  cambio:=q<>l.cantidad or k<>l.costo_unitario;
  if cambio then
   if l.costo is distinct from l.costo_unitario or (select count(*) from alexmar.movimientos_stock where variante_id=l.variante_id)<>l.movimientos_al_recibir then raise exception 'El producto tiene operaciones o cambios de costo posteriores. Solo puedes editar referencia y observaciones; la mercancía requiere devolución y conciliación.';end if;
   select coalesce(sum(cantidad),0) into fisico from alexmar.movimientos_stock where variante_id=l.variante_id;
   select coalesce(sum(cantidad),0) into reservado from alexmar.reservas where variante_id=l.variante_id and estado='activa';
   if q<l.cantidad and fisico-reservado<l.cantidad-q then raise exception 'No hay existencias libres suficientes para reducir esta cantidad.';end if;
  end if;
  total_nuevo:=total_nuevo+q*k;
 end loop;
 if total_nuevo>=10000000000000000 then raise exception 'Total fuera del rango admitido.';end if;
 select coalesce(sum(monto),0) into pagado from alexmar.pagos_compra where compra_id=doc.id and not anulado;
 if total_nuevo<pagado then raise exception 'El total no puede quedar por debajo de los abonos vigentes. Corrige o anula primero los abonos incorrectos.';end if;
 for l in select * from alexmar.lineas_compra where compra_id=doc.id order by variante_id loop
  select a into x from jsonb_array_elements(p->'lineas') a where a->>'id'=l.id::text;
  q:=(x->>'cantidad')::numeric;k:=(x->>'costo_unitario')::numeric;
  if q<>l.cantidad or k<>l.costo_unitario then
   if q<>l.cantidad then
    insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia,compra_id)
    values(l.variante_id,q-l.cantidad,'Corrección de orden C-'||doc.numero||': '||trim(p->>'motivo'),auth.uid(),'corregir-compra:'||doc.id||':'||doc.version||':'||l.variante_id,doc.id);
   end if;
   update alexmar.lineas_compra set cantidad=q,costo_unitario=k,movimientos_al_recibir=(select count(*) from alexmar.movimientos_stock where variante_id=l.variante_id) where id=l.id;
   update alexmar.variantes set costo=k where id=l.variante_id;
  end if;
 end loop;
 update alexmar.compras set total=total_nuevo,referencia=trim(coalesce(p->>'referencia','')),observaciones=coalesce(p->>'observaciones',''),motivo_correccion=trim(p->>'motivo'),version=version+1 where id=doc.id;
end $$;

create function public.corregir_pago_compra(p jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.compras;pg alexmar.pagos_compra;monto_nuevo numeric;otros numeric;quitar boolean;
begin
 perform alexmar.exigir(array['administrador']);
 select * into doc from alexmar.compras where id=(p->>'compra_id')::uuid for update;
 if not found or doc.estado<>'confirmada' then raise exception 'Orden no disponible para corregir abonos.';end if;
 if doc.version is distinct from (p->>'version')::integer then raise exception 'La orden cambió. Recarga y revisa los datos antes de guardar.';end if;
 if coalesce(p->>'accion','') not in ('editar','anular') then raise exception 'Selecciona editar o anular el abono.';end if;
 if length(trim(coalesce(p->>'motivo',''))) not between 5 and 2000 then raise exception 'Escribe un motivo de 5 a 2000 caracteres.';end if;
 if (p->>'revisado') is distinct from 'true' then raise exception 'Confirma que revisaste el importe real y cualquier reintegro necesario.';end if;
 select * into pg from alexmar.pagos_compra where id=(p->>'id')::uuid and compra_id=doc.id for update;
 if not found or pg.anulado then raise exception 'Abono no disponible para corregir.';end if;
 quitar:=p->>'accion'='anular';
 if quitar then
  update alexmar.pagos_compra set anulado=true,motivo_correccion=trim(p->>'motivo') where id=pg.id;
 else
  if coalesce(p->>'monto','') !~ '^[+]?[0-9]+([.][0-9]{1,84})?$' then raise exception 'Escribe un abono decimal válido, con hasta 84 decimales.';end if;
  monto_nuevo:=(p->>'monto')::numeric;
  if monto_nuevo<=0 or monto_nuevo>=10000000000000000 then raise exception 'Indica un abono positivo dentro del rango admitido.';end if;
  if coalesce(p->>'metodo','') not in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Otro') then raise exception 'Selecciona el método del pago realizado.';end if;
  if length(coalesce(p->>'referencia',''))>200 then raise exception 'La referencia admite hasta 200 caracteres.';end if;
  select coalesce(sum(monto),0) into otros from alexmar.pagos_compra where compra_id=doc.id and id<>pg.id and not anulado;
  if monto_nuevo+otros>doc.total then raise exception 'El abono supera el saldo de esta orden.';end if;
  update alexmar.pagos_compra set monto=monto_nuevo,metodo=p->>'metodo',referencia=coalesce(p->>'referencia',''),motivo_correccion=trim(p->>'motivo') where id=pg.id;
 end if;
end $$;
create or replace function public.pagar_compra(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;compra uuid:=(p->>'compra_id')::uuid;doc alexmar.compras;anterior alexmar.pagos_compra;monto numeric;pagado numeric;
 firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
begin
 perform alexmar.exigir(array['administrador']);
 if ident is null or compra is null then raise exception 'Falta identificar el pago.';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,820));
 select * into anterior from alexmar.pagos_compra where id=ident;
 if found then if anterior.firma<>firma then raise exception 'Este pago ya existe con otros datos.';end if;return ident;end if;
 select * into doc from alexmar.compras where id=compra for update;
 if not found or doc.estado<>'confirmada' then raise exception 'Compra no disponible para pago.';end if;
 -- El importe derivado puede tener 80 decimales de costo + 4 de cantidad. Nunca redondear para saldar.
 if coalesce(p->>'monto','') !~ '^[+]?[0-9]+([.][0-9]{1,84})?$' then raise exception 'Escribe un pago decimal válido, con hasta 84 decimales.';end if;
 monto:=(p->>'monto')::numeric;
 if monto<=0 or monto>=10000000000000000 then raise exception 'Indica un pago positivo dentro del rango admitido.';end if;
 if coalesce(p->>'metodo','') not in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Otro') then raise exception 'Selecciona el método del pago realizado.';end if;
 select coalesce(sum(pc.monto),0) into pagado from alexmar.pagos_compra pc where pc.compra_id=compra and not pc.anulado;
 if monto>doc.total-pagado then raise exception 'El pago supera el saldo pendiente de esta compra.';end if;
 insert into alexmar.pagos_compra(id,compra_id,monto,metodo,referencia,usuario_id,firma) values(ident,compra,monto,p->>'metodo',coalesce(p->>'referencia',''),auth.uid(),firma);
 return ident;
end $$;

create or replace function public.anular_compra(p_id uuid,p_motivo text) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.compras;l record;fisico numeric;reservado numeric;
begin
 perform alexmar.exigir(array['administrador']);
 select * into doc from alexmar.compras where id=p_id for update;
 if not found then raise exception 'Compra no encontrada.';end if;
 if doc.estado='anulada' then return;end if;
 if length(trim(coalesce(p_motivo,''))) not between 5 and 2000 then raise exception 'Escribe un motivo de 5 a 2000 caracteres.';end if;
 if exists(select 1 from alexmar.pagos_compra where compra_id=p_id and not anulado) then raise exception 'La compra tiene pagos. Requiere devolución y conciliación, no anulación simple.';end if;
 perform id from alexmar.variantes where id in(select variante_id from alexmar.lineas_compra where compra_id=p_id) order by id for update;
 for l in select lc.*,v.costo from alexmar.lineas_compra lc join alexmar.variantes v on v.id=lc.variante_id where lc.compra_id=p_id order by lc.variante_id loop
  if l.costo is distinct from l.costo_unitario or (select count(*) from alexmar.movimientos_stock where variante_id=l.variante_id)<>l.movimientos_al_recibir then raise exception 'El producto tiene operaciones o cambios de costo posteriores. Requiere devolución y conciliación.';end if;
  select coalesce(sum(cantidad),0) into fisico from alexmar.movimientos_stock where variante_id=l.variante_id;
  select coalesce(sum(cantidad),0) into reservado from alexmar.reservas where variante_id=l.variante_id and estado='activa';
  if fisico-reservado<l.cantidad then raise exception 'No hay existencias libres suficientes para revertir esta recepción.';end if;
 end loop;
 for l in select * from alexmar.lineas_compra where compra_id=p_id order by variante_id loop
  insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia,compra_id) values(l.variante_id,-l.cantidad,'Anulación de recepción C-'||doc.numero,auth.uid(),'anular-recepcion:'||p_id||':'||l.variante_id,p_id);
  update alexmar.variantes set costo=l.costo_anterior where id=l.variante_id;
 end loop;
 update alexmar.compras set estado='anulada',anulado=clock_timestamp(),motivo_anulacion=trim(p_motivo),version=version+1 where id=p_id;
end $$;

create or replace function public.ficha_compra(p_id uuid,p_pagos_pagina integer default 1) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare pagos jsonb;pag integer:=greatest(1,coalesce(p_pagos_pagina,1));
begin
 perform alexmar.exigir(array['administrador','inventario']);
 with todos as(select * from alexmar.pagos_compra where compra_id=p_id),
 hoja as(select * from todos order by creado,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(h)-'firma'||jsonb_build_object('monto',h.monto::text) order by creado,id) from hoja h),'[]'::jsonb),
 'total',(select count(*) from todos),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from todos)/30.0))) into pagos;
 return(select to_jsonb(c)-'firma'||jsonb_build_object('total',c.total::text,
 'pagado',(select coalesce(sum(monto),0)::text from alexmar.pagos_compra where compra_id=c.id and not anulado),
 'saldo',case when c.estado='anulada' then '0' else (c.total-(select coalesce(sum(monto),0) from alexmar.pagos_compra where compra_id=c.id and not anulado))::text end,
 'lineas',(select jsonb_agg(jsonb_build_object('id',l.id,'orden',l.orden,'variante_id',l.variante_id,'producto_id',v.producto_id,'descripcion',l.descripcion,'cantidad',l.cantidad::text,'costo_unitario',l.costo_unitario::text,'importe',l.importe::text,'precio_venta',v.precio::text) order by l.orden) from alexmar.lineas_compra l join alexmar.variantes v on v.id=l.variante_id where l.compra_id=c.id),
 'pagos',pagos) from alexmar.compras c where c.id=p_id);
end $$;

create or replace function public.ficha_proveedor_compras(p_id uuid,p_pagina integer default 1,p_productos_pagina integer default 1,p_q text default '') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare prov jsonb;docs jsonb;productos jsonb;resumen jsonb;pag integer:=greatest(1,coalesce(p_pagina,1));ppag integer:=greatest(1,coalesce(p_productos_pagina,1));
begin
 perform alexmar.exigir(array['administrador','inventario']);
 select to_jsonb(p) into prov from alexmar.proveedores p where id=p_id;
 if prov is null then return null;end if;
 select jsonb_build_object('comprado',coalesce(sum(total) filter(where estado='confirmada'),0)::text,
 'pagado',(select coalesce(sum(pc.monto),0)::text from alexmar.pagos_compra pc join alexmar.compras c on c.id=pc.compra_id where c.proveedor_id=p_id and not pc.anulado),
 'saldo',(coalesce(sum(total) filter(where estado='confirmada'),0)-(select coalesce(sum(pc.monto),0) from alexmar.pagos_compra pc join alexmar.compras c on c.id=pc.compra_id where c.proveedor_id=p_id and not pc.anulado))::text) into resumen from alexmar.compras where proveedor_id=p_id;
 with todas as (select c.id,c.numero,c.creado,c.referencia,c.estado,c.total::text total,
 (select coalesce(sum(monto),0)::text from alexmar.pagos_compra where compra_id=c.id and not anulado) pagado,
 case when c.estado='anulada' then '0' else (c.total-(select coalesce(sum(monto),0) from alexmar.pagos_compra where compra_id=c.id and not anulado))::text end saldo
 from alexmar.compras c where c.proveedor_id=p_id),hoja as(select * from todas order by creado desc,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(h) order by creado desc,id) from hoja h),'[]'::jsonb),'total',(select count(*) from todas),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from todas)/30.0))) into docs;
 with suministros as (
 select l.variante_id id,v.producto_id,a.nombre,sum(l.cantidad)::text cantidad_recibida,
 (array_agg(l.costo_unitario order by c.creado desc,c.id desc,l.orden desc))[1]::text ultimo_costo,
 max(c.creado) ultima_recepcion,v.precio::text precio_venta
 from alexmar.lineas_compra l join alexmar.compras c on c.id=l.compra_id join alexmar.variantes v on v.id=l.variante_id join alexmar.productos a on a.id=v.producto_id
 where c.proveedor_id=p_id and c.estado='confirmada' and (coalesce(p_q,'')='' or strpos(alexmar.normalizar(a.nombre||' '||a.referencia),alexmar.normalizar(p_q))>0)
 group by l.variante_id,v.producto_id,a.nombre,v.precio
 ),hoja as(select * from suministros order by nombre,id limit 30 offset (ppag::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(h) order by nombre,id) from hoja h),'[]'::jsonb),'total',(select count(*) from suministros),'pagina',ppag,'paginas',greatest(1,ceil((select count(*) from suministros)/30.0))) into productos;
 return jsonb_build_object('proveedor',prov,'resumen',resumen,'compras',docs,'productos',productos);
end $$;
-- Elimina los efectos de la orden, conservando comprobante/abonos anulados y auditoría.
create function public.anular_orden_compra(p_id uuid,p_version integer,p_motivo text,p_revisado boolean) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.compras;
begin
 perform alexmar.exigir(array['administrador']);
 select * into doc from alexmar.compras where id=p_id for update;
 if not found then raise exception 'Orden no encontrada.';end if;
 if doc.version is distinct from p_version then raise exception 'La orden cambió. Recarga y revisa los datos antes de anular.';end if;
 if doc.estado='anulada' then return;end if;
 if p_revisado is distinct from true then raise exception 'Confirma la reversión de la mercancía y cualquier reintegro necesario de los abonos.';end if;
 if length(trim(coalesce(p_motivo,''))) not between 5 and 2000 then raise exception 'Escribe un motivo de 5 a 2000 caracteres.';end if;
 update alexmar.pagos_compra set anulado=true,motivo_correccion=trim(p_motivo) where compra_id=p_id and not anulado;
 -- Si stock/costos no permiten revertir, toda la transacción (incluidos abonos) se revierte.
 perform public.anular_compra(p_id,p_motivo);
end $$;
revoke all on function public.anular_compra(uuid,text) from authenticated;
revoke all on function public.editar_compra(jsonb),public.corregir_pago_compra(jsonb),public.anular_orden_compra(uuid,integer,text,boolean) from public,anon;
grant execute on function public.editar_compra(jsonb),public.corregir_pago_compra(jsonb),public.anular_orden_compra(uuid,integer,text,boolean) to authenticated;
commit;

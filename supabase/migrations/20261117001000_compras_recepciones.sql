begin;
create sequence alexmar.numero_compra;
create table alexmar.compras(
 id uuid primary key,numero bigint not null unique default nextval('alexmar.numero_compra'),
 proveedor_id uuid not null references alexmar.proveedores(id),
 proveedor_snapshot jsonb not null,referencia text not null default '' check(length(referencia)<=100),
 referencia_normalizada text generated always as(nullif(alexmar.normalizar(referencia),'')) stored,
 moneda text not null default 'USD' check(moneda='USD'),total numeric not null check(total>=0 and total<10000000000000000),
 estado text not null default 'confirmada' check(estado in ('confirmada','anulada')),
 observaciones text not null default '' check(length(observaciones)<=4000),
 usuario_id uuid not null references auth.users(id),creado timestamptz not null default clock_timestamp(),
 firma text not null,anulado timestamptz,motivo_anulacion text
);
create unique index compra_referencia_proveedor on alexmar.compras(proveedor_id,referencia_normalizada) where referencia_normalizada is not null and estado='confirmada';
create index compra_proveedor_fecha on alexmar.compras(proveedor_id,creado desc,id);
create table alexmar.lineas_compra(
 id uuid primary key default gen_random_uuid(),compra_id uuid not null references alexmar.compras(id),
 orden integer not null,variante_id uuid not null references alexmar.variantes(id),descripcion text not null,
 cantidad numeric not null check(cantidad>0 and cantidad<100000000 and cantidad=round(cantidad,4)),
 costo_unitario numeric not null check(costo_unitario>=0),costo_anterior numeric,
 importe numeric generated always as(cantidad*costo_unitario) stored,
 movimientos_al_recibir bigint not null default 0,
 unique(compra_id,variante_id),unique(compra_id,orden)
);
create index compra_producto on alexmar.lineas_compra(variante_id,compra_id);
create table alexmar.pagos_compra(
 id uuid primary key,compra_id uuid not null references alexmar.compras(id),
 monto numeric not null check(monto>0 and monto<10000000000000000),
 metodo text not null check(metodo in ('Efectivo','Transferencia','Pago móvil','Tarjeta','Otro')),
 referencia text not null default '' check(length(referencia)<=200),
 usuario_id uuid not null references auth.users(id),creado timestamptz not null default clock_timestamp(),firma text not null
);
create index pago_compra_documento on alexmar.pagos_compra(compra_id);
alter table alexmar.movimientos_stock add column compra_id uuid references alexmar.compras(id);
do $$declare t text;begin foreach t in array array['compras','lineas_compra','pagos_compra'] loop
 execute format('alter table alexmar.%I enable row level security',t);
 execute format('create trigger auditar after insert or update or delete on alexmar.%I for each row execute function alexmar.auditar()',t);
end loop;end $$;
revoke all on alexmar.compras,alexmar.lineas_compra,alexmar.pagos_compra,alexmar.numero_compra from public,anon,authenticated;

create function public.recibir_compra(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;prov uuid:=(p->>'proveedor_id')::uuid;proveedor alexmar.proveedores;
 existente alexmar.compras;l jsonb;v alexmar.variantes;producto uuid;variante uuid;cantidad numeric;costo_recibido numeric;sub numeric:=0;n integer:=0;
 firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
begin
 perform alexmar.exigir(array['administrador','inventario']);
 if ident is null or prov is null then raise exception 'Falta identificar proveedor y recepción.';end if;
 if octet_length(p::text)>200000 then raise exception 'La recepción supera el tamaño permitido.';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,819));
 select * into existente from alexmar.compras where id=ident for update;
 if found then
  if existente.firma<>firma then raise exception 'Esta recepción ya se registró con otros datos. Abre su comprobante.';end if;
  return ident;
 end if;
 select * into proveedor from alexmar.proveedores where id=prov for update;
 if not found or not proveedor.activo then raise exception 'Selecciona un proveedor activo.';end if;
 if not ('USD'=any(proveedor.monedas)) or coalesce(p->>'moneda','USD')<>'USD' then raise exception 'Esta recepción requiere un proveedor que trabaje en USD.';end if;
 if jsonb_typeof(p->'lineas') is distinct from 'array' then raise exception 'Añade los productos recibidos.';end if;
 if jsonb_array_length(p->'lineas') not between 1 and 200 then raise exception 'La recepción admite de 1 a 200 líneas.';end if;
 if length(coalesce(p->>'referencia',''))>100 or length(coalesce(p->>'observaciones',''))>4000 then raise exception 'Referencia u observaciones demasiado largas.';end if;
 if exists(select 1 from jsonb_array_elements(p->'lineas') x where nullif(x->>'variante_id','') is not null group by x->>'variante_id' having count(*)>1) then raise exception 'Agrupa las unidades de un mismo producto en una sola línea.';end if;
 -- Igual orden de bloqueo que facturación y ajustes: evita perder existencias por concurrencia.
 perform id from alexmar.variantes where id in(select (x->>'variante_id')::uuid from jsonb_array_elements(p->'lineas') x where nullif(x->>'variante_id','') is not null) order by id for update;
 for l in select value from jsonb_array_elements(p->'lineas') loop
  cantidad:=alexmar.numero_migracion(l->>'cantidad');costo_recibido:=alexmar.numero_migracion(l->>'costo_unitario');
  if cantidad<=0 or cantidad>=100000000 or cantidad<>round(cantidad,4) then raise exception 'Cantidad positiva, menor a 100 millones y hasta cuatro decimales.';end if;
  if nullif(l->>'variante_id','') is not null then
   if l->'nuevo' is not null and l->'nuevo'<>'null'::jsonb then raise exception 'Elige un producto existente o uno nuevo, no ambos.';end if;
   if not exists(select 1 from alexmar.variantes vv join alexmar.productos a on a.id=vv.producto_id where vv.id=(l->>'variante_id')::uuid and vv.nombre='Principal' and a.activo) then raise exception 'Producto inexistente o inactivo.';end if;
  else
   if jsonb_typeof(l->'nuevo') is distinct from 'object' or nullif(l->'nuevo'->>'id','') is null or length(trim(coalesce(l->'nuevo'->>'nombre',''))) not between 1 and 200 or length(coalesce(l->'nuevo'->>'categoria',''))>100 then raise exception 'Indica nombre e identificador del producto nuevo.';end if;
   if exists(select 1 from alexmar.productos where id=(l->'nuevo'->>'id')::uuid) then raise exception 'El producto nuevo ya existe. Selecciónalo en el buscador.';end if;
  end if;
  sub:=sub+cantidad*costo_recibido;
 end loop;
 if sub>=10000000000000000 then raise exception 'Total fuera del rango admitido.';end if;
 insert into alexmar.compras(id,proveedor_id,proveedor_snapshot,referencia,total,observaciones,usuario_id,firma)
 values(ident,prov,jsonb_build_object('nombre',proveedor.nombre,'documento',proveedor.documento),trim(coalesce(p->>'referencia','')),sub,coalesce(p->>'observaciones',''),auth.uid(),firma);
 for l in select value from jsonb_array_elements(p->'lineas') loop
  n:=n+1;cantidad:=(l->>'cantidad')::numeric;costo_recibido:=(l->>'costo_unitario')::numeric;
  if nullif(l->>'variante_id','') is not null then
   variante:=(l->>'variante_id')::uuid;
  else
   producto:=(l->'nuevo'->>'id')::uuid;
   insert into alexmar.productos(id,nombre,categoria) values(producto,trim(l->'nuevo'->>'nombre'),trim(coalesce(l->'nuevo'->>'categoria','')));
   -- Precio de venta permanece NULL, no se convierte en cero ni se deduce del costo.
   insert into alexmar.variantes(producto_id,nombre,precio,costo,minimo) values(producto,'Principal',null,null,0) returning id into variante;
   if trim(coalesce(l->'nuevo'->>'categoria',''))<>'' then
    insert into alexmar.clasificaciones_catalogo(id,categoria) values(producto,trim(l->'nuevo'->>'categoria'));
   end if;
  end if;
  select * into strict v from alexmar.variantes where id=variante;
  insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia,compra_id)
   values(variante,cantidad,'Recepción de proveedor C-'||(select numero::text from alexmar.compras where id=ident),auth.uid(),'recepcion:'||ident||':'||variante,ident);
  insert into alexmar.lineas_compra(compra_id,orden,variante_id,descripcion,cantidad,costo_unitario,costo_anterior,movimientos_al_recibir)
   select ident,n,variante,a.nombre,cantidad,costo_recibido,v.costo,(select count(*) from alexmar.movimientos_stock where variante_id=variante) from alexmar.productos a where a.id=v.producto_id;
  -- Decisión del propietario: último costo recibido, sin cambiar el precio de venta existente.
  update alexmar.variantes set costo=costo_recibido where id=variante;
 end loop;
 return ident;
end $$;

create function public.asignar_precio_venta(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare producto uuid:=(p->>'producto_id')::uuid;precio_venta numeric;
begin
 perform alexmar.exigir(array['administrador','inventario']);
 precio_venta:=alexmar.numero_migracion(p->>'precio');
 update alexmar.variantes v set precio=precio_venta from alexmar.productos a where v.producto_id=a.id and a.id=producto and a.activo and v.nombre='Principal';
 if not found then raise exception 'Producto inexistente o inactivo.';end if;
 return producto;
end $$;

create function public.pagar_compra(p jsonb) returns uuid
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
 select coalesce(sum(pc.monto),0) into pagado from alexmar.pagos_compra pc where pc.compra_id=compra;
 if monto>doc.total-pagado then raise exception 'El pago supera el saldo pendiente de esta compra.';end if;
 insert into alexmar.pagos_compra(id,compra_id,monto,metodo,referencia,usuario_id,firma) values(ident,compra,monto,p->>'metodo',coalesce(p->>'referencia',''),auth.uid(),firma);
 return ident;
end $$;

create function public.anular_compra(p_id uuid,p_motivo text) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare doc alexmar.compras;l record;fisico numeric;reservado numeric;
begin
 perform alexmar.exigir(array['administrador']);
 select * into doc from alexmar.compras where id=p_id for update;
 if not found then raise exception 'Compra no encontrada.';end if;
 if doc.estado='anulada' then return;end if;
 if length(trim(coalesce(p_motivo,''))) not between 5 and 2000 then raise exception 'Escribe un motivo de 5 a 2000 caracteres.';end if;
 if exists(select 1 from alexmar.pagos_compra where compra_id=p_id) then raise exception 'La compra tiene pagos. Requiere devolución y conciliación, no anulación simple.';end if;
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
 update alexmar.compras set estado='anulada',anulado=clock_timestamp(),motivo_anulacion=trim(p_motivo) where id=p_id;
end $$;

create function public.ficha_compra(p_id uuid,p_pagos_pagina integer default 1) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare pagos jsonb;pag integer:=greatest(1,coalesce(p_pagos_pagina,1));
begin
 perform alexmar.exigir(array['administrador','inventario']);
 with todos as(select * from alexmar.pagos_compra where compra_id=p_id),
 hoja as(select * from todos order by creado,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(h)-'firma'||jsonb_build_object('monto',h.monto::text) order by creado,id) from hoja h),'[]'::jsonb),
 'total',(select count(*) from todos),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from todos)/30.0))) into pagos;
 return(select to_jsonb(c)-'firma'||jsonb_build_object('total',c.total::text,
 'pagado',(select coalesce(sum(monto),0)::text from alexmar.pagos_compra where compra_id=c.id),
 'saldo',case when c.estado='anulada' then '0' else (c.total-(select coalesce(sum(monto),0) from alexmar.pagos_compra where compra_id=c.id))::text end,
 'lineas',(select jsonb_agg(jsonb_build_object('id',l.id,'orden',l.orden,'variante_id',l.variante_id,'producto_id',v.producto_id,'descripcion',l.descripcion,'cantidad',l.cantidad::text,'costo_unitario',l.costo_unitario::text,'importe',l.importe::text,'precio_venta',v.precio::text) order by l.orden) from alexmar.lineas_compra l join alexmar.variantes v on v.id=l.variante_id where l.compra_id=c.id),
 'pagos',pagos) from alexmar.compras c where c.id=p_id);
end $$;

create function public.ficha_proveedor_compras(p_id uuid,p_pagina integer default 1,p_productos_pagina integer default 1,p_q text default '') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare prov jsonb;docs jsonb;productos jsonb;resumen jsonb;pag integer:=greatest(1,coalesce(p_pagina,1));ppag integer:=greatest(1,coalesce(p_productos_pagina,1));
begin
 perform alexmar.exigir(array['administrador','inventario']);
 select to_jsonb(p) into prov from alexmar.proveedores p where id=p_id;
 if prov is null then return null;end if;
 select jsonb_build_object('comprado',coalesce(sum(total) filter(where estado='confirmada'),0)::text,
 'pagado',(select coalesce(sum(pc.monto),0)::text from alexmar.pagos_compra pc join alexmar.compras c on c.id=pc.compra_id where c.proveedor_id=p_id),
 'saldo',(coalesce(sum(total) filter(where estado='confirmada'),0)-(select coalesce(sum(pc.monto),0) from alexmar.pagos_compra pc join alexmar.compras c on c.id=pc.compra_id where c.proveedor_id=p_id))::text) into resumen from alexmar.compras where proveedor_id=p_id;
 with todas as (select c.id,c.numero,c.creado,c.referencia,c.estado,c.total::text total,
 (select coalesce(sum(monto),0)::text from alexmar.pagos_compra where compra_id=c.id) pagado,
 case when c.estado='anulada' then '0' else (c.total-(select coalesce(sum(monto),0) from alexmar.pagos_compra where compra_id=c.id))::text end saldo
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
revoke all on function public.recibir_compra(jsonb),public.asignar_precio_venta(jsonb),public.pagar_compra(jsonb),public.anular_compra(uuid,text),public.ficha_compra(uuid,integer),public.ficha_proveedor_compras(uuid,integer,integer,text) from public,anon;
grant execute on function public.recibir_compra(jsonb),public.asignar_precio_venta(jsonb),public.pagar_compra(jsonb),public.anular_compra(uuid,text),public.ficha_compra(uuid,integer),public.ficha_proveedor_compras(uuid,integer,integer,text) to authenticated;
commit;

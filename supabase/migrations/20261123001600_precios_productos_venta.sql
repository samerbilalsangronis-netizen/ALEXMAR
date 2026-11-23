begin;
-- Precio autorizado para la operación; conserva el precio de venta del catálogo.
alter table alexmar.lineas_venta add column precio_personalizado boolean not null default false;
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
  if coalesce((linea->>'precio_personalizado')::boolean,false) and rol<>'administrador' then raise exception 'Solo el administrador puede autorizar un precio para esta operación.';end if;
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
  insert into alexmar.lineas_venta(venta_id,orden,variante_id,descripcion,cantidad,precio,precio_personalizado)
  values(ident,n,nullif(linea->>'variante_id','')::uuid,
   case when nullif(linea->>'variante_id','') is not null then (select a.nombre||case when v.nombre<>'Principal' then ' · '||v.nombre else '' end from alexmar.variantes v join alexmar.productos a on a.id=v.producto_id where v.id=(linea->>'variante_id')::uuid) else trim(linea->>'descripcion') end,
   (linea->>'cantidad')::numeric,(linea->>'precio')::numeric,coalesce((linea->>'precio_personalizado')::boolean,false));
 end loop;
 return ident;
end $$;

create or replace function public.emitir_factura(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;doc alexmar.ventas;rol text;firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
begin
 rol:=alexmar.exigir(array['administrador','ventas']);
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
 where (v.precio is null or v.precio is distinct from (l->>'precio')::numeric)
 and not (rol='administrador' and coalesce((l->>'precio_personalizado')::boolean,false))) then
 raise exception 'El precio de catálogo falta o cambió. Vuelve a seleccionar el producto antes de emitir.';end if;
 perform public.guardar_venta(p);
 select * into doc from alexmar.ventas where id=ident;
 if p->>'condicion'='contado' and doc.abono<>doc.total then raise exception 'Al contado debes registrar el cobro completo.';end if;
 return public.emitir_venta(ident,doc.version);
end $$;

create or replace function public.ficha_venta(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador','ventas']);
 return(select (to_jsonb(v)-'firma')||jsonb_build_object('subtotal',v.subtotal::text,'descuento',v.descuento::text,'total',v.total::text,'abono',v.abono::text,
 'condicion',v.condicion,
 'pagado',c.pagado::text,'saldo',case when v.estado='confirmada' then (v.total-c.pagado)::text else '0' end,
 'cliente',coalesce(v.cliente_snapshot,(select jsonb_build_object('nombre',nombre,'documento',documento,'telefono',telefono,'direccion',direccion) from alexmar.clientes where id=v.cliente_id)),
 'lineas',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'variante_id',l.variante_id,'descripcion',l.descripcion,'cantidad',l.cantidad::text,'precio',l.precio::text,'precio_personalizado',l.precio_personalizado,'importe',l.importe::text) order by l.orden) from alexmar.lineas_venta l where l.venta_id=v.id),'[]'::jsonb),
 'pagos',coalesce((select jsonb_agg(jsonb_build_object('tipo',tipo,'monto',monto::text,'metodo',metodo,'creado',creado) order by creado,id) from alexmar.pagos_venta where venta_id=v.id),'[]'::jsonb))
 from alexmar.ventas v cross join lateral(select coalesce(sum(monto),0) pagado from alexmar.pagos_venta where venta_id=v.id)c where v.id=p_id);
end $$;
create table alexmar.altas_producto_venta(
 id uuid primary key references alexmar.productos(id),firma text not null,resultado jsonb not null,
 usuario_id uuid not null references auth.users(id),creado timestamptz not null default clock_timestamp()
);
alter table alexmar.altas_producto_venta enable row level security;
revoke all on alexmar.altas_producto_venta from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.altas_producto_venta for each row execute function alexmar.auditar();
create function public.crear_producto_venta(p jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;precio numeric;anterior alexmar.altas_producto_venta;variante uuid;resultado jsonb;
 firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
begin
 perform alexmar.exigir(array['administrador']);
 if ident is null or octet_length(p::text)>10000 then raise exception 'Producto inválido o demasiado grande.';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,826));
 select * into anterior from alexmar.altas_producto_venta where id=ident;
 if found then
  if anterior.firma<>firma then raise exception 'El producto ya fue registrado con otros datos.';end if;
  return anterior.resultado;
 end if;
 if length(trim(coalesce(p->>'nombre',''))) not between 2 and 200 then raise exception 'Nombre de 2 a 200 caracteres.';end if;
 if length(coalesce(p->>'referencia',''))>100 or length(coalesce(p->>'categoria',''))>100 then raise exception 'Referencia y categoría admiten hasta 100 caracteres.';end if;
 precio:=alexmar.numero_migracion(p->>'precio');
 if exists(select 1 from alexmar.productos where id=ident) then raise exception 'Ese identificador ya existe. Busca el producto en inventario.';end if;
 insert into alexmar.productos(id,nombre,referencia,categoria) values(ident,trim(p->>'nombre'),trim(coalesce(p->>'referencia','')),trim(coalesce(p->>'categoria','')));
 insert into alexmar.variantes(producto_id,nombre,precio,costo,minimo) values(ident,'Principal',precio,null,0) returning id into variante;
 resultado:=jsonb_build_object('id',ident,'variante_id',variante,'nombre',trim(p->>'nombre'),'precio',precio::text,'disponible','0');
 insert into alexmar.altas_producto_venta(id,firma,resultado,usuario_id) values(ident,firma,resultado,auth.uid());
 return resultado;
end $$;
revoke all on function public.crear_producto_venta(jsonb) from public,anon;
grant execute on function public.crear_producto_venta(jsonb) to authenticated;
commit;

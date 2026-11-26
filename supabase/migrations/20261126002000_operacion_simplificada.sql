-- 020 · Ventas, directorios, movimientos e incorporación directa al inventario.
-- No borra operaciones ni vuelve a importar datos.
begin;
do $$begin if to_regclass('alexmar.pdf_compartidos') is null then raise exception 'Aplica primero SQL 019.';end if;end $$;

create function alexmar.rango_busqueda(texto text, consulta text) returns integer
language sql immutable set search_path=pg_catalog,alexmar,extensions as $$
 select case when alexmar.normalizar(consulta)='' then 2
 when alexmar.normalizar(texto)=alexmar.normalizar(consulta) then 0
 when starts_with(alexmar.normalizar(texto),alexmar.normalizar(consulta)||' ') then 0
 when starts_with(alexmar.normalizar(texto),alexmar.normalizar(consulta)) then 1
 when not exists(select 1 from regexp_split_to_table(alexmar.normalizar(consulta),'\s+') w where strpos(alexmar.normalizar(texto),w)=0) then 2
 when not exists(select 1 from regexp_split_to_table(alexmar.normalizar(consulta),'\s+') w where strpos(alexmar.normalizar(texto),w)=0 and (length(w)<3 or extensions.word_similarity(w,alexmar.normalizar(texto))<0.55)) then 3
 else 9 end
$$;
revoke all on function alexmar.rango_busqueda(text,text) from public,anon,authenticated;
create or replace function public.buscar_clientes(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare n integer:=greatest(1,coalesce((p->>'pagina')::int,1));begin
 perform alexmar.exigir(array['administrador']);
 return(with base as(select c.*,alexmar.rango_busqueda(c.nombre||' '||coalesce(c.documento,'')||' '||coalesce(c.telefono,''),p->>'q') rango,
 coalesce((select sum(case when tipo='CARGO' then monto when tipo='ABONO' then -monto else 0 end) from alexmar.movimientos_cuenta where cliente_id=c.id and activo and moneda='USD'),0)::text saldo from alexmar.clientes c where c.activo),
 t as(select *,rango=3 aproximado from base where rango<9),pg as(select * from t order by rango,nombre,id limit 30 offset (n::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(pg) order by rango,nombre,id) from pg),'[]'),'total',(select count(*) from t),'pagina',n,'paginas',greatest(1,ceil((select count(*) from t)/30.0))));
end $$;
create or replace function public.buscar_proveedores(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare n integer:=greatest(1,coalesce((p->>'pagina')::int,1));begin
 perform alexmar.exigir(array['administrador']);
 return(with base as(select a.*,alexmar.rango_busqueda(a.nombre||' '||a.documento||' '||a.contacto||' '||a.telefono||' '||a.ciudad||' '||a.categorias||' '||a.marcas,p->>'q') rango from alexmar.proveedores a where
 (coalesce(p->>'estado','activos')='todos' or activo=(coalesce(p->>'estado','activos')='activos')) and (coalesce(p->>'moneda','')='' or p->>'moneda'=any(monedas))),
 t as(select *,rango=3 aproximado from base where rango<9),pg as(select * from t order by rango,nombre,id limit 30 offset (n::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(pg) order by rango,nombre,id) from pg),'[]'),'total',(select count(*) from t),'pagina',n,'paginas',greatest(1,ceil((select count(*) from t)/30.0))));
end $$;

create function public.editar_cliente(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;begin
 perform alexmar.exigir(array['administrador']);
 perform id from alexmar.clientes where id=ident for update;
 if not found then raise exception 'Cliente no encontrado.';end if;
 if length(trim(coalesce(p->>'nombre',''))) not between 2 and 200 or length(coalesce(p->>'documento',''))>100 or length(coalesce(p->>'telefono',''))>100 or length(coalesce(p->>'direccion',''))>1000 then raise exception 'Revisa nombre y longitud de los datos de contacto.';end if;
 update alexmar.clientes set nombre=trim(p->>'nombre'),documento=trim(coalesce(p->>'documento','')),telefono=trim(coalesce(p->>'telefono','')),direccion=trim(coalesce(p->>'direccion','')) where id=ident;
 return ident;
end $$;
create function public.retirar_cliente(p jsonb) returns void language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;begin
 perform alexmar.exigir(array['administrador']);perform pg_advisory_xact_lock(7061511);
 perform id from alexmar.clientes where id=ident for update;
 if not found then raise exception 'Cliente no encontrado.';end if;
 if exists(select 1 from alexmar.movimientos_cuenta where cliente_id=ident and activo group by moneda having sum(case when tipo='CARGO' then monto when tipo='ABONO' then -monto else 0 end)<>0) then raise exception 'El cliente tiene saldo pendiente. Su cuenta debe quedar en cero en todas las monedas.';end if;
 update alexmar.clientes set activo=false where id=ident;
end $$;
-- Serializar emisión con retirada: nunca emitir a una cuenta retirada desde otra pestaña.
create function alexmar.verificar_cliente_venta() returns trigger language plpgsql security definer set search_path=pg_catalog,alexmar as $$begin
 if new.estado='confirmada' and old.estado is distinct from new.estado and new.cliente_id is not null then
  perform id from alexmar.clientes where id=new.cliente_id and activo for share;
  if not found then raise exception 'El cliente ya no está activo.';end if;
 end if;return new;
end $$;
create trigger verificar_cliente before update of estado on alexmar.ventas for each row execute function alexmar.verificar_cliente_venta();
revoke all on function alexmar.verificar_cliente_venta() from public,anon,authenticated;
create function public.retirar_proveedor(p jsonb) returns void language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'id')::uuid;saldo numeric;begin
 perform alexmar.exigir(array['administrador']);
 perform id from alexmar.proveedores where id=ident for update;
 if not found then raise exception 'Proveedor no encontrado.';end if;
 select coalesce(sum(c.total-coalesce((select sum(monto) from alexmar.pagos_compra where compra_id=c.id and not anulado),0)),0) into saldo from alexmar.compras c where proveedor_id=ident and estado='confirmada';
 if saldo<>0 then raise exception 'El proveedor tiene saldo pendiente. Resuelve su cuenta antes de eliminarlo.';end if;
 update alexmar.proveedores set activo=false where id=ident;
end $$;

create table alexmar.operaciones_inventario(id uuid primary key,firma text not null,producto_id uuid not null references alexmar.productos,usuario_id uuid not null references auth.users,creado timestamptz not null default clock_timestamp());
alter table alexmar.operaciones_inventario enable row level security;
revoke all on alexmar.operaciones_inventario from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.operaciones_inventario for each row execute function alexmar.auditar();
create function public.mover_existencia(p jsonb) returns void language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'clave')::uuid;producto uuid:=(p->>'id')::uuid;v uuid;n numeric;fisico numeric;reservado numeric;firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');anterior text;begin
 perform alexmar.exigir(array['administrador']);
 if ident is null or producto is null or coalesce(p->>'tipo','') not in ('entrada','salida') or length(trim(coalesce(p->>'motivo',''))) not between 5 and 1000 then raise exception 'Indica entrada o salida y un motivo de 5 a 1000 caracteres.';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,830));
 select o.firma into anterior from alexmar.operaciones_inventario o where o.id=ident;
 if found then if anterior<>firma then raise exception 'Este movimiento ya se registró con otros datos.';end if;return;end if;
 n:=alexmar.numero_migracion(p->>'cantidad');
 if n is null or n<=0 or n>=100000000 or n<>round(n,4) then raise exception 'Cantidad positiva con hasta cuatro decimales.';end if;
 select b.id into v from alexmar.variantes b join alexmar.productos a on a.id=b.producto_id where a.id=producto and a.activo and b.nombre='Principal' for update of b;
 if not found then raise exception 'Producto no encontrado o inactivo.';end if;
 select coalesce(sum(cantidad),0) into fisico from alexmar.movimientos_stock where variante_id=v;
 select coalesce(sum(cantidad),0) into reservado from alexmar.reservas where variante_id=v and estado='activa';
 if p->>'tipo'='salida' and fisico-reservado<n then raise exception 'No hay suficientes unidades libres para retirar esa cantidad.';end if;
 insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia,creado) values(v,case when p->>'tipo'='entrada' then n else -n end,case when p->>'tipo'='entrada' then 'Entrada manual: ' else 'Retiro manual: ' end||trim(p->>'motivo'),auth.uid(),'movimiento:'||ident,clock_timestamp());
 insert into alexmar.operaciones_inventario(id,firma,producto_id,usuario_id) values(ident,firma,producto,auth.uid());
end $$;
-- Orden real de inserción de movimientos. Las marcas de hora de una transacción
-- antigua pueden coincidir; se conserva su desempate histórico al instalar.
create sequence alexmar.orden_movimiento_stock;
alter table alexmar.movimientos_stock add column orden_registro bigint;
with ordenados as(select id,row_number() over(order by creado,id) n from alexmar.movimientos_stock)
 update alexmar.movimientos_stock m set orden_registro=o.n from ordenados o where o.id=m.id;
select setval('alexmar.orden_movimiento_stock',greatest(1,(select coalesce(max(orden_registro),0) from alexmar.movimientos_stock)),exists(select 1 from alexmar.movimientos_stock));
alter table alexmar.movimientos_stock alter column orden_registro set not null;
alter table alexmar.movimientos_stock alter column orden_registro set default nextval('alexmar.orden_movimiento_stock');
create unique index movimiento_stock_orden_unico on alexmar.movimientos_stock(orden_registro);
revoke all on alexmar.orden_movimiento_stock from public,anon,authenticated;
create or replace function public.kardex(p_id uuid,p_pagina integer default 1) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare n integer:=greatest(1,p_pagina);begin perform alexmar.exigir(array['administrador']);
 return(with base as(select m.id,m.cantidad,m.motivo,m.creado,m.orden_registro,m.compra_id,coalesce(p.nombre,'Importación / sistema') usuario,
 sum(m.cantidad) over(order by m.orden_registro rows unbounded preceding) saldo,
 case when m.idempotencia like 'venta:%' then split_part(m.idempotencia,':',2)::uuid
 when m.idempotencia like 'pendiente-stock:%' then (select venta_id from alexmar.productos_sin_cargar where linea_id=split_part(m.idempotencia,':',2)::uuid) end venta_id
 from alexmar.movimientos_stock m join alexmar.variantes v on v.id=m.variante_id left join alexmar.perfiles p on p.id=m.usuario_id where v.producto_id=p_id),
 t as(select id,cantidad::text,motivo,creado,orden_registro,compra_id,venta_id,usuario,(saldo-cantidad)::text antes,saldo::text from base),pg as(select * from t order by orden_registro desc limit 30 offset (n::bigint-1)*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(pg) order by orden_registro desc) from pg),'[]'),'total',(select count(*) from t),'pagina',n,'paginas',greatest(1,ceil((select count(*) from t)/30.0))));end $$;

create table alexmar.altas_pendientes(id uuid primary key references alexmar.lineas_venta,firma text not null,producto_id uuid not null references alexmar.productos,usuario_id uuid not null references auth.users,creado timestamptz not null default clock_timestamp());
alter table alexmar.altas_pendientes enable row level security;
revoke all on alexmar.altas_pendientes from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.altas_pendientes for each row execute function alexmar.auditar();
create function public.registrar_producto_pendiente(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid:=(p->>'linea')::uuid;doc alexmar.ventas;linea alexmar.lineas_venta;anterior alexmar.altas_pendientes;stock numeric;costo numeric;producto jsonb;firma text:=encode(sha256(convert_to(p::text,'UTF8')),'hex');begin
 perform alexmar.exigir(array['administrador']);
 select v.* into doc from alexmar.ventas v join alexmar.productos_sin_cargar q on q.venta_id=v.id where q.linea_id=ident for update of v;
 if not found or doc.estado<>'confirmada' then raise exception 'La venta ya no está vigente.';end if;
 select * into anterior from alexmar.altas_pendientes where id=ident;
 if found then if anterior.firma<>firma then raise exception 'La línea ya se completó con otros datos.';end if;return anterior.producto_id;end if;
 perform linea_id from alexmar.productos_sin_cargar where linea_id=ident and estado='pendiente' for update;
 if not found then raise exception 'La línea ya no está pendiente.';end if;
 if exists(select 1 from alexmar.productos where activo and (alexmar.normalizar(nombre)=alexmar.normalizar(p->>'nombre') or (nullif(trim(p->>'referencia'),'') is not null and alexmar.normalizar(referencia)=alexmar.normalizar(p->>'referencia')))) then raise exception 'Ya existe un producto con ese nombre o referencia. Usa Vincular producto existente.';end if;
 stock:=alexmar.numero_migracion(p->>'stock');costo:=alexmar.numero_migracion(nullif(p->>'costo',''),false);
 if stock is null or stock<0 or stock>=100000000 or stock<>round(stock,4) then raise exception 'Indica el stock físico actual, de cero en adelante, con hasta cuatro decimales.';end if;
 select * into strict linea from alexmar.lineas_venta where id=ident;
 producto:=public.crear_producto_venta(jsonb_build_object('id',ident,'nombre',p->>'nombre','precio',p->>'precio','categoria',coalesce(p->>'categoria',''),'referencia',coalesce(p->>'referencia','')));
 update alexmar.variantes v set costo=alexmar.numero_migracion(nullif(p->>'costo',''),false) where v.id=(producto->>'variante_id')::uuid;
 insert into alexmar.movimientos_stock(variante_id,cantidad,motivo,usuario_id,idempotencia,creado)
 values((producto->>'variante_id')::uuid,stock+case when doc.descontar_stock then linea.cantidad else 0 end,'Conteo inicial de producto pendiente; saldo físico actual más salida original si corresponde',auth.uid(),'alta-pendiente:'||ident,clock_timestamp());
 perform public.vincular_producto_pendiente(ident,(producto->>'variante_id')::uuid);
 insert into alexmar.altas_pendientes(id,firma,producto_id,usuario_id) values(ident,firma,ident,auth.uid());
 return ident;
end $$;
-- Eliminar en UI utiliza anulación auditada; vista normal excluye anuladas.
do $$declare f text;begin
 f:=pg_get_functiondef('public.buscar_ventas(jsonb)'::regprocedure);
 if strpos(f,'(coalesce(p->>''estado'','''')='''' or estado=p->>''estado'')')=0 then raise exception 'Versión inesperada de buscar_ventas.';end if;
 f:=replace(f,'(coalesce(p->>''estado'','''')='''' or estado=p->>''estado'')','(coalesce(p->>''estado'','''')='''' or estado=p->>''estado'' or (p->>''estado''=''vigentes'' and estado<>''anulada''))');execute f;
end $$;
revoke all on function public.editar_cliente(jsonb),public.retirar_cliente(jsonb),public.retirar_proveedor(jsonb),public.mover_existencia(jsonb),public.registrar_producto_pendiente(jsonb) from public,anon;
grant execute on function public.editar_cliente(jsonb),public.retirar_cliente(jsonb),public.retirar_proveedor(jsonb),public.mover_existencia(jsonb),public.registrar_producto_pendiente(jsonb) to authenticated;

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
 and (case when trim(coalesce(p->>'q','')) ~* '^(V-)?[0-9]+$' then v.numero::text=coalesce(nullif(ltrim(regexp_replace(trim(p->>'q'),'^V-','','i'),'0'),''),'0') else alexmar.rango_busqueda(
 coalesce(v.numero::text,'')||' '||coalesce(v.cliente_snapshot->>'nombre',c.nombre,'')||' '||coalesce(v.cliente_snapshot->>'documento',c.documento,'')||' '||coalesce(v.cliente_snapshot->>'telefono',c.telefono,'')||' '||
 coalesce((select string_agg(descripcion,' ') from alexmar.lineas_venta where venta_id=v.id),''),consulta)<9 end)
 ), filas as(select * from base where
 (coalesce(p->>'estado','')='' or estado=p->>'estado' or (p->>'estado'='vigentes' and estado<>'anulada'))
 and (coalesce(p->>'cobro','')='' or (estado='confirmada' and ((p->>'cobro'='pendiente' and saldo>0) or (p->>'cobro'='pagada' and saldo=0))))
 ), hoja as(select * from filas order by alexmar.rango_busqueda(coalesce(cliente,''),consulta),fecha desc,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('version_operacion',20,'total',(select count(*) from filas),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from filas)/30.0)),
 'resumen',(select jsonb_build_object('facturado',coalesce(sum(total) filter(where estado='confirmada'),0)::text,
 'cobrado',coalesce(sum(pagado) filter(where estado='confirmada'),0)::text,'pendiente',coalesce(sum(saldo) filter(where estado='confirmada'),0)::text,
 'emitidas',count(*) filter(where estado='confirmada')) from filas),
 'filas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'numero',numero,'tipo',tipo,'estado',estado,'cliente',cliente,'cliente_id',cliente_id,'creado',creado,'fecha',fecha,'total',total::text,'abono',abono::text,'pagado',pagado::text,'saldo',saldo::text,'condicion',condicion) order by alexmar.rango_busqueda(coalesce(cliente,''),consulta),fecha desc,id) from hoja),'[]'::jsonb)) into r;return r;
end $$;

create or replace function public.catalogo_general(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare pag integer:=greatest(1,coalesce((p->>'pagina')::integer,1));r jsonb;entrada jsonb;rol text;
begin
 rol:=alexmar.exigir(array['administrador','lectura']);
 -- También se registra el acceso si se consulta directamente la RPC con un JWT válido.
 entrada:=public.registrar_ingreso(case when rol='administrador' then 'administrativo' else 'general' end);
 if not coalesce((entrada->>'permitido')::boolean,false) then raise exception 'Acceso no autorizado.' using errcode='42501';end if;
 with filas as(
 select a.id,v.id variante_id,a.nombre,coalesce(a.descripcion,'') descripcion,a.categoria,a.marca,a.referencia,a.compatibilidad,v.nombre variante,v.precio
 from alexmar.productos a join alexmar.variantes v on v.producto_id=a.id where a.activo
 and alexmar.rango_busqueda(a.nombre||' '||coalesce(a.descripcion,'')||' '||a.categoria||' '||a.marca||' '||a.referencia||' '||a.compatibilidad||' '||a.alias,left(p->>'q',200))<9
 ), hoja as(select * from filas order by alexmar.rango_busqueda(nombre,p->>'q'),nombre,variante,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('total',(select count(*) from filas),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from filas)/30.0)),
 'filas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'variante_id',variante_id,'nombre',nombre,'descripcion',descripcion,'categoria',categoria,'marca',marca,'referencia',referencia,'compatibilidad',compatibilidad,'variante',variante,'precio',precio::text)order by alexmar.rango_busqueda(nombre,p->>'q'),nombre,variante,id) from hoja),'[]')) into r;return r;
end $$;
-- Foto de la factura privada. Se guarda junto con la compra, sin service role.
create table alexmar.fotos_compra(id uuid primary key references alexmar.compras(id),nombre text not null,mime text not null check(mime='image/jpeg'),contenido bytea not null check(octet_length(contenido) between 4 and 2097152),huella text not null,usuario_id uuid not null references auth.users,creado timestamptz not null default clock_timestamp());
alter table alexmar.fotos_compra enable row level security;
revoke all on alexmar.fotos_compra from public,anon,authenticated;
create function alexmar.auditar_foto_compra() returns trigger language plpgsql security definer set search_path=pg_catalog,alexmar as $$begin
 insert into alexmar.auditoria(usuario_id,tabla,operacion,registro_id,nuevo) values(auth.uid(),'fotos_compra',tg_op,new.id::text,to_jsonb(new)-'contenido');return new;
end $$;
revoke all on function alexmar.auditar_foto_compra() from public,anon,authenticated;
create trigger auditar after insert on alexmar.fotos_compra for each row execute function alexmar.auditar_foto_compra();
create function public.recibir_compra_con_foto(p jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare ident uuid;cuerpo bytea;huella text;foto jsonb:=p->'foto';anterior alexmar.fotos_compra;begin
 perform alexmar.exigir(array['administrador']);
 if octet_length(p::text)>3200000 or foto->>'mime' is distinct from 'image/jpeg' or length(coalesce(foto->>'nombre','')) not between 1 and 200 then raise exception 'Foto inválida. Usa una imagen JPEG de hasta 2 MB.';end if;
 cuerpo:=decode(foto->>'base64','base64');
 if cuerpo is null or octet_length(cuerpo) not between 4 and 2097152 or substring(cuerpo from 1 for 3)<>decode('ffd8ff','hex') then raise exception 'Foto JPEG inválida o demasiado grande.';end if;
 huella:=encode(sha256(cuerpo),'hex');
 ident:=public.recibir_compra(p-'foto');
 select * into anterior from alexmar.fotos_compra where id=ident;
 if found then
  if anterior.huella<>huella then raise exception 'Esta compra ya tiene otra foto. No se repite la recepción.';end if;
 else
  insert into alexmar.fotos_compra(id,nombre,mime,contenido,huella,usuario_id) values(ident,foto->>'nombre','image/jpeg',cuerpo,huella,auth.uid());
 end if;
 return ident;
end $$;
create function public.leer_foto_compra(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$begin
 perform alexmar.exigir(array['administrador']);
 return(select jsonb_build_object('nombre',nombre,'mime',mime,'base64',encode(contenido,'base64')) from alexmar.fotos_compra where id=p_id);
end $$;
do $$declare f text;begin
 f:=pg_get_functiondef('public.ficha_compra(uuid,integer)'::regprocedure);
 if strpos(f,'''total'',c.total::text')=0 then raise exception 'Versión inesperada de ficha_compra.';end if;
 execute replace(f,'''total'',c.total::text','''total'',c.total::text,''tiene_foto'',exists(select 1 from alexmar.fotos_compra where id=c.id)');
end $$;
revoke all on function public.recibir_compra_con_foto(jsonb),public.leer_foto_compra(uuid) from public,anon;
grant execute on function public.recibir_compra_con_foto(jsonb),public.leer_foto_compra(uuid) to authenticated;

do $$declare f text;begin
 f:=pg_get_functiondef('public.ficha_producto(uuid)'::regprocedure);
 if strpos(f,'''id'',a.id')=0 then raise exception 'Versión inesperada de ficha_producto.';end if;
 execute replace(f,'''id'',a.id','''id'',a.id,''variante_id'',v.id');
end $$;

do $$declare f text;begin
 f:=pg_get_functiondef('public.ficha_proveedor_compras(uuid,integer,integer,text)'::regprocedure);
 if strpos(f,'strpos(alexmar.normalizar(a.nombre||'' ''||a.referencia),alexmar.normalizar(p_q))>0')=0 then raise exception 'Versión inesperada de ficha_proveedor_compras.';end if;
 execute replace(f,'strpos(alexmar.normalizar(a.nombre||'' ''||a.referencia),alexmar.normalizar(p_q))>0','alexmar.rango_busqueda(a.nombre||'' ''||a.referencia,p_q)<9');
end $$;
commit;

begin;
-- Capa de organización: conserva etiquetas originales, stock, precios y procedencia.
create table alexmar.clasificaciones_catalogo(
 id uuid primary key references alexmar.productos(id),
 categoria text check(categoria is null or length(trim(categoria)) between 1 and 100),
 vehiculos text[] check(vehiculos is null or cardinality(vehiculos)<=20)
);
alter table alexmar.clasificaciones_catalogo enable row level security;
revoke all on alexmar.clasificaciones_catalogo from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.clasificaciones_catalogo
 for each row execute function alexmar.auditar();

create function alexmar.sugerir_categoria(nombre text,origen text) returns text
language sql immutable set search_path=pg_catalog,alexmar as $$
select case
 when t ~ '\m(espejo|espejos|retrovisor|retrovisores)\M' then 'Espejos y retrovisores'
 when t ~ '\m(faro|faros|stop|stops|cocuyo|cocuyos|cruce|cruces|bombillo|bombillos|exploradora|exploradoras|neblina|luces|luz|semaforo|mica|micas|exp)\M' then 'Iluminación'
 when t ~ '\m(alarma|alarmas|centralizado|candado|traba)\M' then 'Seguridad y alarmas'
 when t ~ '\m(radio|reproductor|corneta|cornetas|amplificador|sonido|parlante|parlantes|multimedia)\M' then 'Audio y multimedia'
 when t ~ '\m(bateria|baterias|alternador|arranque|bobina|bujia|relay|rele|conector|conectores|fusible|fusibles|terminal|switch|interruptor|cable|cables|electrica|electrico)\M' then 'Electricidad y baterías'
 when t ~ '\m(limpiaparabrisas|wiper|silicon|lustradora|champu|pulimento)\M' or t like '%limpia caucho%' then 'Limpieza y cuidado'
 when t ~ '\m(piso|pisos|bandeja|bandejas|forro|forros|alfombra|alfombras|cobertor|covertor|volante|pomo|tapiceria|lona|lonas)\M' then 'Interiores y protección'
 when t ~ '\m(rin|rines|tuerca|tuercas|copa|copas|valvula|capuchon|capuchones)\M' then 'Ruedas y accesorios'
 when t ~ '\m(parrilla|parachoque|guardafango|babero|emblema|manilla|manillas|bisagra|platina|moldura|aleta|bocel)\M' or t like '%porta placa%' then 'Carrocería y exteriores'
 when t ~ '\m(gato|herramienta|herramientas|alicate|compresor)\M' then 'Herramientas'
 else 'Por clasificar' end
from (select alexmar.normalizar(coalesce(nombre,'')||' '||coalesce(origen,'')) t) n;
$$;

create function alexmar.sugerir_vehiculos(texto text) returns text[]
language sql immutable set search_path=pg_catalog,alexmar as $$
with entrada as(select alexmar.normalizar(texto) t), modelos as(
 select nombre from entrada cross join (values
 ('Fiesta','\mfiesta\M'),('Hilux','\mhilux\M'),('Fortuner','\mfortuner\M'),
 ('Corolla','\mcorolla\M'),('Super Duty','\msuper\s*duty\M|\ms[.]\s*duty\M'),
 ('Tritón','\mtriton\M'),('Cargo','\mcargo\M'),('Ranger','\mranger\M'),
 ('Aveo','\maveo\M'),('D-Max','\md[ -]?max\M'),('NPR','\mnpr\M'),('FVR','\mfvr\M'),
 ('F-150','\mf[ -]?150\M'),('Bronco','\mbronco\M'),('Ford Ka','\mford ka\M'),
 ('Runner','\m(4[ -]?)?runner\M'),('Samurai','\msamurai\M'),('L200','\ml[ -]?200\M'),
 ('BT-50','\mbt[ -]?50\M'),('Corsa','\mcorsa\M'),('Silverado','\msilverado\M'),
 ('Cheyenne','\mcheyenne\M'),('Caribe','\mcaribe\M'),('1721','\m1721\M'),('815','\m815\M')
 ) reglas(nombre,patron) where t ~ patron
), marcas as(
 select nombre||' (sin modelo)' nombre from entrada cross join (values
 ('Ford','\mford\M'),('Chevrolet','\mchevrolet\M'),('Toyota','\mtoyota\M'),
 ('Hyundai','\mhyundai\M'),('Fiat','\mfiat\M'),('Mazda','\mmazda\M'),('Iveco','\miveco\M')
 ) reglas(nombre,patron) where t ~ patron
)
select case when exists(select 1 from modelos) then array(select nombre from modelos order by nombre)
 when exists(select 1 from marcas) then array(select nombre from marcas order by nombre)
 when (select t ~ '\muniversal\M' from entrada) then array['Universal declarado']
 else array['Por identificar'] end;
$$;
revoke all on function alexmar.sugerir_categoria(text,text),alexmar.sugerir_vehiculos(text) from public,anon,authenticated;

-- Se calculan al insertar/editar el producto, no en cada página del catálogo.
alter table alexmar.productos
 add column categoria_sugerida text generated always as (alexmar.sugerir_categoria(nombre,categoria)) stored,
 add column vehiculos_sugeridos text[] generated always as (alexmar.sugerir_vehiculos(nombre||' '||categoria||' '||compatibilidad)) stored;

create view alexmar.catalogo_organizado as
with base as (
 select a.*,v.id variante_id,v.precio,v.costo,v.minimo,
 coalesce(c.categoria,a.categoria_sugerida) categoria_grupo,
 coalesce(c.vehiculos,a.vehiculos_sugeridos) vehiculos,
 (c.categoria is not null) clasificacion_manual,
 coalesce((select sum(cantidad) from alexmar.movimientos_stock where variante_id=v.id),0) fisico,
 coalesce((select sum(cantidad) from alexmar.reservas where variante_id=v.id and estado='activa'),0) reservado,
 alexmar.normalizar(a.nombre||' '||coalesce(a.descripcion,'')||' '||a.categoria||' '||a.compatibilidad||' '||a.marca||' '||a.referencia||' '||a.alias||' '||coalesce(c.categoria,a.categoria_sugerida)||' '||coalesce(array_to_string(c.vehiculos,' '),'')||' '||coalesce((select string_agg(x.marca||' '||x.modelo||' '||coalesce(x.anio_desde::text,''),' ') from alexmar.compatibilidades x where x.producto_id=a.id),'')) texto
 from alexmar.productos a join alexmar.variantes v on v.producto_id=a.id and v.nombre='Principal'
 left join alexmar.clasificaciones_catalogo c on c.id=a.id
) select base.*,fisico-reservado disponible from base;
revoke all on alexmar.catalogo_organizado from public,anon,authenticated;

create function alexmar.filtrar_catalogo(p jsonb) returns setof alexmar.catalogo_organizado
language sql stable as $$
 select a.* from alexmar.catalogo_organizado a where
 (coalesce(p->>'estado','activos')='todos' or a.activo=(coalesce(p->>'estado','activos')='activos'))
 and (coalesce(p->>'categoria','')='' or alexmar.normalizar(a.categoria_grupo)=alexmar.normalizar(p->>'categoria') or a.categoria=p->>'categoria')
 and (coalesce(p->>'categoria_origen','')='' or a.categoria=p->>'categoria_origen')
 and (coalesce(p->>'modelo','')='' or exists(select 1 from unnest(a.vehiculos) m where alexmar.normalizar(m)=alexmar.normalizar(p->>'modelo')))
 and (coalesce(p->>'marca','')='' or a.marca=p->>'marca')
 and (coalesce(p->>'precio','')='' or (p->>'precio'='sin' and a.precio is null) or (p->>'precio'='con' and a.precio is not null))
 and (coalesce(p->>'ubicacion','')='' or strpos(alexmar.normalizar(a.ubicacion),alexmar.normalizar(p->>'ubicacion'))>0)
 and (coalesce(p->>'q','')='' or not exists(select 1 from unnest(string_to_array(alexmar.normalizar(p->>'q'),' ')) palabra where strpos(a.texto,palabra)=0) or extensions.word_similarity(alexmar.normalizar(p->>'q'),a.texto)>0.45)
 and (
   (coalesce(p->>'anio','')='' and (coalesce(p->>'vehiculo','')='' or strpos(alexmar.normalizar(a.compatibilidad),alexmar.normalizar(p->>'vehiculo'))>0))
   or exists(select 1 from alexmar.compatibilidades c where c.producto_id=a.id and (c.universal or (
     (coalesce(p->>'vehiculo','')='' or strpos(alexmar.normalizar(c.marca||' '||c.modelo),alexmar.normalizar(p->>'vehiculo'))>0)
     and (coalesce(p->>'anio','')='' or (
       (c.anio_desde is not null or c.anio_hasta is not null)
       and (c.anio_desde is null or c.anio_desde<=(p->>'anio')::int)
       and (c.anio_hasta is null or c.anio_hasta>=(p->>'anio')::int)
       and (coalesce(p->>'modelo','')='' or strpos(alexmar.normalizar(c.marca||' '||c.modelo),alexmar.normalizar(p->>'modelo'))>0)
     ))
   )))
 )
 and (coalesce(p->>'precio_min','')='' or a.precio>=(p->>'precio_min')::numeric)
 and (coalesce(p->>'precio_max','')='' or a.precio<=(p->>'precio_max')::numeric)
 and (coalesce(p->>'stock','')='' or (p->>'stock'='disponible' and a.disponible>0) or (p->>'stock'='agotado' and a.disponible<=0) or (p->>'stock'='bajo' and a.disponible<a.minimo));
$$;
revoke all on function alexmar.filtrar_catalogo(jsonb) from public,anon,authenticated;

create or replace function public.buscar_productos(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar,extensions as $$
declare r text; resultado jsonb; pag integer:=greatest(1,least(coalesce((p->>'pagina')::int,1),100000));q text:=alexmar.normalizar(p->>'q');
begin
 r:=alexmar.exigir();
 with seleccion as not materialized (
 select a.*,case when q=alexmar.normalizar(referencia) and q<>'' then 0 when q=alexmar.normalizar(nombre) then 1 when not exists(select 1 from unnest(string_to_array(q,' ')) palabra where strpos(texto,palabra)=0) then 2 else 3 end rango
 from alexmar.filtrar_catalogo(p) a
 ), ordenados as (
 select *,row_number() over(order by
 case when coalesce(p->>'orden','relevancia')='relevancia' then rango end,
 case when p->>'orden'='precio' then precio end nulls last,
 case when p->>'orden'='existencia' then disponible end desc,
 case when coalesce(p->>'orden','relevancia')='relevancia' then extensions.word_similarity(q,texto) end desc,
 nombre,id) posicion from seleccion
 ), pagina as(select * from ordenados where posicion between (pag-1)*30+1 and pag*30)
 select jsonb_build_object('filas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'variante_id',variante_id,'nombre',nombre,'descripcion',descripcion,'categoria',categoria_grupo,'categoria_origen',categoria,'vehiculos',vehiculos,'clasificacion_manual',clasificacion_manual,'compatibilidad',compatibilidad,'marca',marca,'referencia',referencia,'alias',alias,'ubicacion',ubicacion,'activo',activo,'precio',precio::text,'minimo',minimo::text,'fisico',fisico::text,'reservado',reservado::text,'disponible',disponible::text,'aproximado',rango=3)||case when r in ('administrador','inventario') then jsonb_build_object('costo',costo::text) else '{}'::jsonb end order by posicion) from pagina),'[]'::jsonb),'total',(select count(*) from seleccion),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from seleccion)/30.0))) into resultado;
 return resultado;
end $$;

create function public.grupos_inventario(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir();
 return (with filas as materialized(select * from alexmar.filtrar_catalogo(p))
 select jsonb_build_object('total',(select count(*) from filas),
 'categorias',coalesce((select jsonb_agg(to_jsonb(g) order by nombre) from (select min(categoria_grupo) nombre,count(*) total from filas group by alexmar.normalizar(categoria_grupo)) g),'[]'::jsonb),
 'vehiculos',coalesce((select jsonb_agg(to_jsonb(g) order by nombre) from (select min(m) nombre,count(*) total from filas cross join lateral unnest(vehiculos) m group by alexmar.normalizar(m)) g),'[]'::jsonb)));
end $$;

create or replace function public.opciones_catalogo() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir();
 return jsonb_build_object(
 'categorias',(select coalesce(jsonb_agg(c order by c),'[]'::jsonb) from(select min(categoria_grupo) c from alexmar.catalogo_organizado group by alexmar.normalizar(categoria_grupo)) s),
 'categorias_origen',(select coalesce(jsonb_agg(c order by c),'[]'::jsonb) from(select distinct categoria c from alexmar.productos where categoria<>'') s),
 'vehiculos',(select coalesce(jsonb_agg(m order by m),'[]'::jsonb) from(select min(v) m from alexmar.catalogo_organizado cross join lateral unnest(vehiculos) v group by alexmar.normalizar(v)) s),
 'marcas',(select coalesce(jsonb_agg(marca order by marca),'[]'::jsonb) from(select distinct marca from alexmar.productos where marca<>'') s),
 'consultas',(select coalesce(jsonb_agg(jsonb_build_object('nombre',nombre,'filtros',filtros) order by nombre),'[]'::jsonb) from alexmar.consultas where usuario_id=auth.uid()));
end $$;

create function public.clasificacion_producto(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin perform alexmar.exigir();return (
 select jsonb_build_object('categoria',a.categoria_grupo,'vehiculos',a.vehiculos,'categoria_manual',c.categoria,'vehiculos_manuales',c.vehiculos)
 from alexmar.catalogo_organizado a left join alexmar.clasificaciones_catalogo c on c.id=a.id where a.id=p_id);
end $$;
create function public.guardar_clasificacion(p_id uuid,p_categoria text,p_vehiculos text[]) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare modelos text[];
begin
 perform alexmar.exigir(array['administrador','inventario']);
 if not exists(select 1 from alexmar.productos where id=p_id) then raise exception 'Producto no encontrado.';end if;
 if length(trim(p_categoria))>100 then raise exception 'Categoría demasiado larga.';end if;
 if p_vehiculos is not null then
   select array_agg(m order by m) into modelos from (select min(trim(v)) m from unnest(p_vehiculos) v where trim(v)<>'' group by alexmar.normalizar(trim(v))) s;
   if modelos is null or cardinality(modelos)>20 or exists(select 1 from unnest(modelos) v where length(v)>100) then raise exception 'Indica entre 1 y 20 grupos de vehículo, de hasta 100 caracteres.';end if;
 end if;
 insert into alexmar.clasificaciones_catalogo(id,categoria,vehiculos) values(p_id,nullif(trim(p_categoria),''),modelos)
 on conflict(id) do update set categoria=excluded.categoria,vehiculos=excluded.vehiculos;
end $$;
revoke all on function public.grupos_inventario(jsonb),public.clasificacion_producto(uuid),public.guardar_clasificacion(uuid,text,text[]) from public,anon;
grant execute on function public.grupos_inventario(jsonb),public.clasificacion_producto(uuid),public.guardar_clasificacion(uuid,text,text[]) to authenticated;
commit;

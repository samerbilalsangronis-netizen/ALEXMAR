begin;
-- Dos accesos: administrador completo y lectura (consulta general de precios).
-- No elimina datos comerciales, identidades ni contraseñas de Auth.
create table alexmar.control_acceso(
 id integer primary key check(id=1),generales_bloqueados boolean not null default false,
 version integer not null default 1,actualizado timestamptz not null default now(),usuario_id uuid references auth.users
);
insert into alexmar.control_acceso(id)values(1);
create table alexmar.registro_accesos(
 id uuid primary key default gen_random_uuid(),usuario_id uuid references auth.users on delete set null,
 sesion_id uuid not null,nombre text not null,acceso text not null check(acceso in ('administrativo','general')),
 portal text not null check(portal in ('administrativo','general')),
 resultado text not null check(resultado in ('permitido','bloqueado','portal_incorrecto','inactivo')),
 creado timestamptz not null default clock_timestamp(),unique(usuario_id,sesion_id,resultado)
);
create index registro_accesos_fecha on alexmar.registro_accesos(creado desc,id);
create index registro_accesos_usuario on alexmar.registro_accesos(usuario_id,creado desc);
alter table alexmar.control_acceso enable row level security;
alter table alexmar.registro_accesos enable row level security;
revoke all on alexmar.control_acceso,alexmar.registro_accesos from public,anon,authenticated;
create trigger auditar after insert or update or delete on alexmar.control_acceso for each row execute function alexmar.auditar();
-- Los permisos anteriores de ventas/inventario pasan a general, nunca a administrador.
update alexmar.perfiles set rol='lectura' where rol in ('ventas','inventario');
alter table alexmar.perfiles drop constraint perfiles_rol_check;
alter table alexmar.perfiles add constraint perfiles_rol_check check(rol in ('administrador','lectura'));

-- Las RPC heredadas que llamaban sin roles quedan reservadas a administración.
-- Consulta general utiliza su RPC explícita, sin costos, saldos, stock ni métricas.
create or replace function alexmar.exigir(roles text[] default array['administrador']) returns text
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare r text;
begin
 select rol into r from alexmar.perfiles where id=auth.uid() and activo;
 if r='lectura' and roles is distinct from array['administrador','lectura'] then raise exception 'No tienes permiso para esta operación.' using errcode='42501';end if;
 if r is null or not(r=any(roles)) then raise exception 'No tienes permiso para esta operación.' using errcode='42501';end if;
 if r<>'administrador' and (select generales_bloqueados from alexmar.control_acceso where id=1) then
  raise exception 'El acceso general está bloqueado por administración.' using errcode='42501';
 end if;
 return r;
end $$;
create or replace function public.mi_perfil() returns jsonb
language sql stable security definer set search_path=pg_catalog,alexmar as $$
 select jsonb_build_object('id',p.id,'nombre',p.nombre,'rol',p.rol,
 'acceso',case when p.rol='administrador' then 'administrativo' else 'general' end,
 'bloqueado',p.rol<>'administrador' and c.generales_bloqueados,'version_accesos',13)
 from alexmar.perfiles p cross join alexmar.control_acceso c where p.id=auth.uid() and p.activo and c.id=1
$$;

create function public.registrar_ingreso(p_portal text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare persona alexmar.perfiles;v_acceso text;v_resultado text;bloqueo boolean;sid uuid;claims jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='42501';end if;
 if p_portal is null or p_portal not in ('administrativo','general') then raise exception 'Selecciona el tipo de acceso.';end if;
 select * into persona from alexmar.perfiles where id=auth.uid();
 if not found then return jsonb_build_object('permitido',false,'motivo','sin-perfil');end if;
 v_acceso:=case when persona.rol='administrador' then 'administrativo' else 'general' end;
 select generales_bloqueados into strict bloqueo from alexmar.control_acceso where id=1;
 v_resultado:=case when not persona.activo then 'inactivo'
  when v_acceso='general' and bloqueo then 'bloqueado'
  when v_acceso<>p_portal then 'portal_incorrecto' else 'permitido' end;
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}');
 -- Supabase Auth emite session_id. El respaldo para tokens antiguos no admite IDs del navegador.
 sid:=coalesce(nullif(claims->>'session_id','')::uuid,auth.uid());
 insert into alexmar.registro_accesos(usuario_id,sesion_id,nombre,acceso,portal,resultado)
 values(persona.id,sid,persona.nombre,v_acceso,p_portal,v_resultado) on conflict(usuario_id,sesion_id,resultado) do nothing;
 return jsonb_build_object('permitido',v_resultado='permitido','motivo',v_resultado,'acceso',v_acceso,'rol',persona.rol);
end $$;

create function public.estado_control_acceso() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador']);
 return(select jsonb_build_object('generales_bloqueados',generales_bloqueados,'version',version,'actualizado',actualizado) from alexmar.control_acceso where id=1);
end $$;
create function public.bloquear_acceso_general(p_bloquear boolean,p_version integer) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare actual alexmar.control_acceso;
begin
 perform pg_advisory_xact_lock(7061513);
 perform alexmar.exigir(array['administrador']);
 if p_bloquear is null then raise exception 'Indica el estado del bloqueo.';end if;
 select * into strict actual from alexmar.control_acceso where id=1 for update;
 if actual.generales_bloqueados=p_bloquear then return;end if;
 if actual.version is distinct from p_version then raise exception 'El bloqueo cambió. Recarga antes de guardar.';end if;
 update alexmar.control_acceso set generales_bloqueados=p_bloquear,version=version+1,actualizado=now(),usuario_id=auth.uid() where id=1;
end $$;

create or replace function public.asignar_perfil(p_id uuid,p_nombre text,p_rol text,p_activo boolean) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 perform pg_advisory_xact_lock(7061513);
 perform alexmar.exigir(array['administrador']);
 if p_rol is null or p_rol not in ('administrador','lectura') or p_activo is null then raise exception 'Selecciona Administrativo o General y su estado.';end if;
 if length(trim(coalesce(p_nombre,''))) not between 2 and 200 then raise exception 'Escribe un nombre entre 2 y 200 caracteres.';end if;
 if p_id=auth.uid() and (p_rol<>'administrador' or not p_activo) then raise exception 'No puedes quitar tu propio acceso de administrador.';end if;
 if not exists(select 1 from auth.users where id=p_id) then raise exception 'Primero crea la identidad en Authentication.';end if;
 insert into alexmar.perfiles(id,nombre,rol,activo)values(p_id,trim(p_nombre),p_rol,p_activo)
 on conflict(id) do update set nombre=excluded.nombre,rol=excluded.rol,activo=excluded.activo;
end $$;
create or replace function public.listar_perfiles() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador']);
 return(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
 'acceso',case when p.rol='administrador' then 'administrativo' else 'general' end,
 'usuario',(select case when email like '%@accesos.alexmar.invalid' then split_part(email,'@',1) else email end from auth.users where id=p.id),
 'ultimo_ingreso',(select max(creado) from alexmar.registro_accesos where usuario_id=p.id and resultado='permitido')) order by p.nombre,p.id),'[]') from alexmar.perfiles p);
end $$;
create function public.historial_accesos(p_pagina integer default 1,p_usuario uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare pag integer:=greatest(1,coalesce(p_pagina,1));r jsonb;
begin
 perform alexmar.exigir(array['administrador']);
 with filas as(select id,nombre,acceso,portal,resultado,creado from alexmar.registro_accesos where p_usuario is null or usuario_id=p_usuario),
 hoja as(select * from filas order by creado desc,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('total',(select count(*) from filas),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from filas)/30.0)),
 'filas',coalesce((select jsonb_agg(to_jsonb(h)order by creado desc,id) from hoja h),'[]')) into r;return r;
end $$;

create function public.catalogo_general(p jsonb default '{}') returns jsonb
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
 and not exists(select 1 from regexp_split_to_table(alexmar.normalizar(left(coalesce(p->>'q',''),200)),'\s+') palabra
 where palabra<>'' and strpos(alexmar.normalizar(a.nombre||' '||coalesce(a.descripcion,'')||' '||a.categoria||' '||a.marca||' '||a.referencia||' '||a.compatibilidad||' '||a.alias),palabra)=0)
 ), hoja as(select * from filas order by nombre,variante,id limit 30 offset (pag::bigint-1)*30)
 select jsonb_build_object('total',(select count(*) from filas),'pagina',pag,'paginas',greatest(1,ceil((select count(*) from filas)/30.0)),
 'filas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'variante_id',variante_id,'nombre',nombre,'descripcion',descripcion,'categoria',categoria,'marca',marca,'referencia',referencia,'compatibilidad',compatibilidad,'variante',variante,'precio',precio::text)order by nombre,variante,id) from hoja),'[]')) into r;return r;
end $$;

-- Storage tampoco conserva autorización para generales mediante un JWT anterior.
create or replace function public.permiso_fotos_vehiculos(p_editar boolean default false) returns boolean
language sql stable security definer set search_path=pg_catalog,alexmar as $$
 select exists(select 1 from alexmar.perfiles where id=auth.uid() and activo and rol='administrador')
$$;
revoke all on function public.registrar_ingreso(text),public.estado_control_acceso(),public.bloquear_acceso_general(boolean,integer),public.historial_accesos(integer,uuid),public.catalogo_general(jsonb) from public,anon;
grant execute on function public.registrar_ingreso(text),public.estado_control_acceso(),public.bloquear_acceso_general(boolean,integer),public.historial_accesos(integer,uuid),public.catalogo_general(jsonb) to authenticated;
commit;

begin;
create table alexmar.pdf_compartidos(
 id uuid primary key default gen_random_uuid(),cliente_id uuid not null references alexmar.clientes(id),
 factura_id uuid references alexmar.ventas(id),token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),
 nombre text not null,contenido bytea not null check(octet_length(contenido) between 5 and 4194304),
 creado timestamptz not null default clock_timestamp(),vence timestamptz not null default clock_timestamp()+interval '7 days',
 revocado timestamptz,usuario_id uuid not null references auth.users(id)
);
alter table alexmar.pdf_compartidos enable row level security;
revoke all on alexmar.pdf_compartidos from public,anon,authenticated;
-- No copiar el archivo binario a la auditoría general.
create function alexmar.auditar_pdf_compartido() returns trigger language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 insert into alexmar.auditoria(usuario_id,tabla,operacion,registro_id,anterior,nuevo)
 values(auth.uid(),tg_table_name,tg_op,new.id::text,case when tg_op='UPDATE' then to_jsonb(old)-'contenido'-'token_hash' end,to_jsonb(new)-'contenido'-'token_hash');
 return new;
end $$;
revoke all on function alexmar.auditar_pdf_compartido() from public,anon,authenticated;
create trigger auditar after insert or update on alexmar.pdf_compartidos for each row execute function alexmar.auditar_pdf_compartido();

create function public.documento_cuenta_pdf(p_cliente uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
declare r jsonb;hoja jsonb;filas jsonb:='[]';pag integer:=1;
begin
 perform alexmar.exigir(array['administrador']);
 loop
  hoja:=public.estado_cliente(p_cliente,null,null,pag,'USD');
  if hoja->'cliente'='null'::jsonb then raise exception 'Cliente no encontrado.';end if;
  if pag=1 then r:=hoja;end if;
  filas:=filas||(hoja->'filas');
  exit when pag>=(hoja->>'paginas')::integer;
  pag:=pag+1;
 end loop;
 if jsonb_array_length(filas)<>(r->>'total')::integer then raise exception 'No se pudo recuperar la cuenta completa.';end if;
 return (r-'filas')||jsonb_build_object('filas',filas,'generado',clock_timestamp());
end $$;

create function public.guardar_pdf_compartido(p_cliente uuid,p_factura uuid,p_token text,p_nombre text,p_base64 text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
declare cuerpo bytea;r jsonb;
begin
 perform alexmar.exigir(array['administrador']);
 if p_token is null or p_token!~'^[0-9a-f]{64}$' then raise exception 'Enlace inválido.';end if;
 if not exists(select 1 from alexmar.clientes where id=p_cliente) then raise exception 'Cliente no encontrado.';end if;
 if p_factura is not null and not exists(select 1 from alexmar.ventas where id=p_factura and cliente_id=p_cliente and estado='confirmada') then raise exception 'Factura no disponible para este cliente.';end if;
 if coalesce(p_nombre,'')!~'^[A-Za-z0-9_-]{1,100}\.pdf$' then raise exception 'Nombre de PDF inválido.';end if;
 if p_base64 is null or length(p_base64)>5592408 then raise exception 'El PDF supera los 4 MB permitidos.';end if;
 cuerpo:=decode(p_base64,'base64');
 if octet_length(cuerpo)<5 or octet_length(cuerpo)>4194304 or substring(cuerpo from 1 for 5)<>convert_to('%PDF-','UTF8') then raise exception 'Archivo PDF inválido.';end if;
 insert into alexmar.pdf_compartidos(cliente_id,factura_id,token_hash,nombre,contenido,usuario_id)
 values(p_cliente,p_factura,encode(sha256(convert_to(p_token,'UTF8')),'hex'),p_nombre,cuerpo,auth.uid())
 returning jsonb_build_object('id',id,'vence',vence) into r;
 return r;
end $$;

create function public.leer_pdf_compartido(p_token text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,alexmar as $$
begin
 if p_token is null or p_token!~'^[0-9a-f]{64}$' then return null;end if;
 return(select jsonb_build_object('nombre',nombre,'base64',encode(contenido,'base64')) from alexmar.pdf_compartidos
 where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revocado is null and vence>statement_timestamp());
end $$;
create function public.revocar_pdf_compartido(p_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,alexmar as $$
begin
 perform alexmar.exigir(array['administrador']);
 update alexmar.pdf_compartidos set revocado=coalesce(revocado,clock_timestamp()) where id=p_id;
 if not found then raise exception 'Enlace no encontrado.';end if;
end $$;
revoke all on function public.documento_cuenta_pdf(uuid),public.guardar_pdf_compartido(uuid,uuid,text,text,text),public.revocar_pdf_compartido(uuid),public.leer_pdf_compartido(text) from public,anon;
grant execute on function public.documento_cuenta_pdf(uuid),public.guardar_pdf_compartido(uuid,uuid,text,text,text),public.revocar_pdf_compartido(uuid) to authenticated;
grant execute on function public.leer_pdf_compartido(text) to anon,authenticated;
commit;

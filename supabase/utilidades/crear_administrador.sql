-- 1. En Authentication → Users → Add user crea tu usuario (correo confirmado).
-- 2. Sustituye SOLO el correo de ejemplo y ejecuta en el SQL Editor del proyecto NUEVO.
-- No publica contraseñas ni crea usuarios en el proyecto anterior.
do $$
declare usuario uuid;
begin
 select id into usuario from auth.users where lower(email)=lower('CAMBIA-ESTO@ejemplo.com');
 if usuario is null then raise exception 'Primero crea el usuario en Authentication y sustituye el correo.';end if;
 if exists(select 1 from alexmar.perfiles where rol='administrador' and activo) then raise exception 'Ya hay un administrador. Usa Configuración para dar otros accesos.';end if;
 insert into alexmar.perfiles(id,nombre,rol) values(usuario,'Administrador','administrador');
end $$;

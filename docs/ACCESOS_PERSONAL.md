# Acceso administrativo, consulta de precios y bloqueo · 2026-11-23

La separación anterior se había confirmado como idea y no estaba implementada. Esta entrega incorpora dos tipos de acceso, registro de entradas y bloqueo general, además del icono de instalación de escritorio. No cambia las cuentas comerciales, existencias ni facturas importadas.

## Activar en el proyecto nuevo

1. Ejecutar completo una sola vez [SQL 013](../supabase/migrations/20261123001300_accesos_personal.sql) en Supabase NUEVO → SQL Editor, después de las migraciones instaladas hasta 012. No limpiar, reimportar ni repetir SQL anteriores.
2. Comprobar el despliegue de `main` como Ready en Vercel y recargar. La cuenta administrativa existente sigue entrando con su correo y contraseña, seleccionando **Administrativo**.
3. La migración conserva a los administradores y convierte los perfiles anteriores de ventas/inventario a **General** (`lectura` internamente). No eleva a nadie a administrador, no cambia contraseñas ni elimina identidades de Auth. Antes de aplicar, tener identificado el correo de la cuenta administrativa existente.
4. Abrir **Configuración → Acceso del personal**. Allí se clasifican personas, se habilitan/deshabilitan y se consultan entradas con fecha/hora de Venezuela. No puedes quitar tu propio acceso administrativo desde la web.

La publicación del código no ejecuta SQL ni crea usuarios en Supabase. Este entorno de desarrollo no tiene URL/clave administrativa configuradas ni acceso directo a la base remota; las comprobaciones se hacen con datos locales de prueba.

## Dos entradas, permisos reales

En la pantalla de ingreso se elige Administrativo o General. Ambos verifican contraseña en Supabase Auth; después se comprueba el perfil activo en la base. El tipo elegido en la pantalla no concede un rol. Una cuenta general no obtiene acceso administrativo al cambiar esa opción, una URL, el JSON enviado o la navegación del navegador.

- **Administrativo:** todos los módulos disponibles, costos, cuentas, métricas, facturación, compras y administración de accesos.
- **General:** `/consulta`, con búsqueda paginada de productos activos y precio de venta. Devuelve únicamente identificadores del producto/variante, nombre, descripción, categoría, marca, referencia, compatibilidad y precio. No devuelve costos, existencias, kardex, saldos, clientes, ventas, métricas ni datos de otros usuarios. Las rutas y RPC heredadas de gestión no quedan disponibles para este perfil.

La protección se aplica en proxy/servidor y mediante `alexmar.exigir` y funciones explícitas en Postgres, manteniendo el esquema privado y RLS. Los tokens de sesión anteriores no conservan sus permisos antiguos: se consulta el perfil y el bloqueo actuales de la base.

## Registrar personal desde el panel

La creación de identidades usa exclusivamente la API administrativa oficial de Supabase Auth, sin escribir contraseñas en tablas propias ni modificar directamente `auth.users`.

Para habilitar **Crear usuario** en Configuración:

1. En el mismo Supabase NUEVO, obtener una clave administrativa `service_role` del proyecto.
2. En Vercel → proyecto ALEXMAR → Settings → Environment Variables, agregar **`SUPABASE_SERVICE_ROLE_KEY`**, solo para el servidor del entorno correspondiente, y redesplegar.
3. No usar el prefijo `NEXT_PUBLIC_`, no poner la clave en el navegador ni en GitHub y no compartirla en el chat.
4. En Configuración → Crear usuario de personal, introducir nombre, usuario, contraseña inicial y General o Administrativo. General está seleccionado inicialmente.

El usuario se normaliza a minúsculas, sin tildes y con puntos en lugar de espacios: por ejemplo, **Persona Ejemplo** puede entrar como `persona.ejemplo` o escribiendo su nombre con espacios. Auth utiliza internamente `persona.ejemplo@accesos.alexmar.invalid`, sin mandar correos a esa dirección. Es un identificador técnico, no un buzón. Las cuentas administrativas existentes con correo real siguen usando ese correo.

La ruta de creación verifica origen, sesión y rol administrativo antes de usar la clave de servicio. La asignación del perfil se ejecuta con el JWT del administrador para que Postgres vuelva a verificar su permiso. Si la asignación falla se intenta eliminar únicamente la identidad que esa petición acaba de crear; no se reasignan identidades existentes por coincidencia de usuario. Un fallo de recuperación se informa sin afirmar que la cuenta quedó lista. Las contraseñas nunca se devuelven en la respuesta ni se registran en auditoría, archivos o código. Las cuentas con identificador interno se recuperan/cambian desde administración de Auth, no mediante correo a `.invalid`.

### Alternativa sin clave administrativa en Vercel

No es necesaria la clave de servicio para consultar precios, entrar, cambiar perfiles o usar el bloqueo. Si no se habilita creación desde el panel:

1. Supabase NUEVO → Authentication → Users → Add user.
2. Para un usuario por nombre, usar el correo interno normalizado, por ejemplo `persona.ejemplo@accesos.alexmar.invalid`; introducir la contraseña y marcar el correo como confirmado. No activar el registro público.
3. Copiar su UUID. En ALEXMAR → Configuración → **Asignar acceso a una identidad existente**, pegar el UUID, nombre y seleccionar General o Administrativo y Activo.
4. Entrar desde el portal correspondiente. Crear una identidad en Auth sin asignar perfil no da acceso a la aplicación.

No se ha creado desde desarrollo la cuenta específica solicitada por el propietario; su nombre/contraseña no se incorporan al repositorio ni a migraciones. Debe registrarse mediante el panel conectado o el procedimiento anterior.

## Bloqueo general

**Bloquear acceso general** conserva abiertas las funciones administrativas y deniega nuevas consultas de generales en la base desde que se confirma el cambio. No desactiva ni borra personas. **Permitir acceso general** revierte el bloqueo.

Las vistas abiertas comprueban su permiso cada diez segundos y al recuperar foco/visibilidad. Si están bloqueadas, pasan a la pantalla de bloqueo; si se desactiva a la persona, vuelven al ingreso. Cambiar el perfil también actualiza la ruta de acceso. Si no se puede verificar el permiso por conexión, una cubierta oculta la consulta hasta recuperar la verificación. No se promete borrar información que un usuario autorizado ya hubiera visto o descargado antes de bloquear.

La base protege también las RPC directas y el acceso privado a fotos. No se confía en ocultar el menú o en esperar que expire el JWT. El cambio de bloqueo verifica versión para no pisar cambios simultáneos. El último acceso propio de administrador no puede degradarse ni desactivarse por esta interfaz. Los cambios quedan en auditoría.

## Registro de entradas

Se registran sesiones autenticadas con persona, acceso real, entrada seleccionada, resultado y fecha/hora. Incluye accesos permitidos e intentos autenticados bloqueados, inactivos o de portal incorrecto. Un resultado se registra una vez por sesión, no en cada actualización de la pantalla. La sesión se identifica por `session_id` del JWT de Supabase, nunca por un ID arbitrario enviado por el navegador. Tokens antiguos sin ese campo utilizan un identificador estable del usuario como compatibilidad, por lo que su deduplicación es más amplia.

La consulta directa del catálogo con JWT válido también registra su entrada. El panel ofrece paginación real de 30 entradas y filtro por persona; solo administración puede consultarlo. No almacena contraseñas, tokens ni claves. Los fallos de contraseña anteriores a la autenticación pertenecen a los registros de Auth; no se atribuyen aquí a una persona ni se registran identidades adivinadas. El registro describe entradas a la aplicación, no cada consulta SQL ni todas las operaciones externas de Auth.

## Logo en el acceso de escritorio

Se agrega manifiesto de instalación y PNG reales de 192/512 píxeles, icono Apple de 180 y variante maskable, renderizando el logo existente sin teléfono. No se usa una inicial generada como icono. Manifiesto e iconos funcionan antes de iniciar sesión; no incluyen información del usuario.

Después del despliegue, si el acceso antiguo sigue mostrando la A: quitar ese acceso directo o instalación anterior y volver a instalar/crear el acceso desde Chrome/Edge con la web actualizada. Eso no elimina usuarios ni datos de Supabase. En iPhone, volver a **Añadir a pantalla de inicio**. La opción exacta del menú depende del navegador. No se instala caché de cuentas ni se agrega un modo sin conexión: la app sigue necesitando conexión.

## Verificación

Se verifican con Postgres local los dos roles, migración de permisos previos, aislamiento de campos del catálogo, denegación de cuentas/costos/métricas/administración, bloqueo con el mismo JWT, desactivación, protección propia de administrador, entradas deduplicadas y paginación. Se conserva una prueba de facturación/anulación administrativa sobre el esquema completo actual. Las pruebas de dominios anteriores mantienen su versión hasta 012 para conservar las verificaciones históricas de los cuatro roles, reemplazados aquí por dos.

El recorrido de navegador utiliza sesión/Auth/DB simulados: portales y usuario normalizado, navegación general, URLs privadas, bloqueo de ventana abierta, administración mientras el bloqueo está activo, creación y recuperación de identidad fallida, desactivación individual, registro de entradas, temas/móvil e iconos públicos PNG de tamaño correcto. No se usan credenciales reales en fixtures y no se crean cuentas ni se prueban escrituras sobre producción.

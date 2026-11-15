# ALEXMAR · Gestión comercial

Aplicación privada en español para Autoperiquitos y Rotulados Alexmar. **Entrega por fases: base, catálogo, proveedores, reportes actuales y migración histórica.** No es aún el sistema completo ni debe sustituir al actual hasta completar las siguientes fases y conciliar los datos.

## Qué funciona

- Inicio de sesión Supabase, cuatro roles, usuarios activos/inactivos. No existe registro público de usuarios desde la aplicación.
- Catálogo consultado en servidor, búsqueda sin tildes, palabras en cualquier orden y aproximaciones identificadas; referencia exacta priorizada.
- Filtros de categoría, marca, vehículo, año verificado, precio, ubicación, existencia y estado; orden y paginación de 30 registros. Estado en URL y consultas guardadas por usuario.
- Compatibilidades verificadas por marca/modelo y rango de años, con edición y eliminación auditada para administrador/inventario y consulta para todos los roles. Universal explícito; no se deducen años del texto histórico.
- Ficha editable; precios opcionales; costo excluido de respuestas para ventas y lectura. Ajustes de stock con motivo, responsable, bloqueo concurrente e idempotencia; kardex paginado.
- Clientes, saldo histórico por moneda, filtros por fecha, saldo anterior y final calculados sobre todo el historial. CSV completo y versión HTML completa para imprimir/guardar PDF.
- Directorio de proveedores con contactos, condiciones, monedas, filtros y auditoría (administrador/inventario).
- Reportes de inventario: métricas globales, detalle filtrable, CSV e impresión/PDF completos; cuentas históricas resumidas por moneda según rol. Ver [alcance y SQL nuevo](docs/PROVEEDORES_REPORTES.md).
- Notas privadas del administrador.
- Importación inicial de cuatro CSV: simulación, duplicados, vínculos, precisión y conciliación por cliente. Bloqueada ante errores, saldos que no coinciden con la simulación o un destino con datos. Transacción e identificación de lote; repetir el mismo lote no duplica.

## Instalación desde el navegador

**[Todos los SQL: archivos y orden de ejecución](supabase/README.md)**

### 1. Supabase NUEVO

1. Crea un proyecto independiente. No utilices la URL ni las claves de Tierra Santa o del Alexmar anterior.
2. En **SQL Editor → New query**, pega completo el archivo [`supabase/migrations/20261115000100_base_catalogo_historial.sql`](supabase/migrations/20261115000100_base_catalogo_historial.sql) y ejecuta **Run** una sola vez.
3. En otra consulta, ejecuta completa [`supabase/migrations/20261115000200_compatibilidades.sql`](supabase/migrations/20261115000200_compatibilidades.sql), después de la base. Si ya instalaste la base, aplica solamente esta nueva migración. Ver [pasos y verificación](docs/COMPATIBILIDADES.md).
4. Ejecuta una sola vez [`supabase/migrations/20261115000300_proveedores_reportes.sql`](supabase/migrations/20261115000300_proveedores_reportes.sql) para proveedores y reportes. Si ya aplicaste las migraciones anteriores, no las repitas.
5. Ejecuta una sola vez [`supabase/migrations/20261115000400_migracion_exacta.sql`](supabase/migrations/20261115000400_migracion_exacta.sql). Conserva los importes sin redondear y exige conciliación exacta. No repitas las migraciones ya aplicadas.
6. En **Authentication → Users → Add user**, crea tu usuario administrador con correo confirmado y contraseña segura. Desactiva las inscripciones públicas en Authentication si no las necesitas.
7. Abre [`supabase/utilidades/crear_administrador.sql`](supabase/utilidades/crear_administrador.sql), sustituye el correo de ejemplo y ejecútalo en SQL Editor.
8. No expongas el esquema `alexmar` en la API. Se mantiene privado; la API pública contiene solo funciones con verificación de usuario/rol. RLS está habilitado en todas las tablas, sin acceso directo para anon/authenticated.

### 2. Vercel en otra cuenta

El repositorio permanece en `samerbilalsangronis-netizen/ALEXMAR`. **Un correo diferente de Vercel es compatible; el acceso a GitHub requiere autorización.**

1. Entra a la otra cuenta de Vercel. Selecciona el espacio de destino correcto.
2. En **Add New → Project**, conecta la integración GitHub autorizada e importa `ALEXMAR`. Limita el acceso de la integración al repositorio necesario.
3. Si el repositorio no aparece o Vercel exige que la cuenta GitHub conectada sea propietaria, no desconectes una integración existente a ciegas: revisa permisos/propiedad y configura acceso en el equipo de destino. Un repositorio personal no siempre puede importarse con la identidad GitHub de otra persona. Esto debe comprobarse con la cuenta de destino; no se ha realizado el enlace en esta entrega.
4. Framework: **Next.js**. Root Directory: raíz. Node.js: **22.x o superior**. Rama de producción: `main`.
5. Agrega en Environment Variables, desde el Supabase NUEVO:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (también se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` por compatibilidad).
6. Pulsa Deploy. No hace falta clave de servicio para esta entrega.
7. Configura la URL definitiva en **Supabase → Authentication → URL Configuration → Site URL**.
8. Inicia sesión y comprueba los permisos con un usuario de cada rol antes de ingresar información real.

La identidad del autor de los commits también puede afectar los despliegues según la configuración y plan de Vercel. Verifica un despliegue automático después de conectar el repositorio; no se garantiza solo por tener el mismo correo o un correo distinto.

## Importación de datos anteriores

En **Importación**, carga `inventario_rows.csv`, `clientes_rows.csv`, `detalle_cuentas_rows.csv` y `notas_rows.csv` en sus campos respectivos. Ejecuta primero **Analizar y conciliar**. La simulación no escribe en la base.

**Regla comprobada y aprobada:** el saldo se calcula igual que `vista_saldos_clientes` del origen: cargos menos abonos no eliminados; TITULO no cambia el saldo. El campo `total_adeudado` exportado estaba en cero en los clientes vigentes; se conserva como dato original, sin usarlo para crear ajustes ni borrar deuda. Las diferencias de procedencia se muestran en la simulación y no se ocultan.

Los siete importes con más de cuatro decimales se conservan completos. La migración nueva usa `numeric` sin escala fija, con validación sin redondeo. La simulación calcula con precisión decimal suficiente y la DB verifica los saldos antes y después de insertar. Se rechazan valores fuera del rango admitido (magnitud menor a 10^16, hasta 80 decimales), nunca se recortan.

La prueba local aislada con los cuatro CSV conservó registros originales, importes, existencias y saldos sin duplicación al repetir. **No se ha ejecutado una carga en el Supabase remoto.** Sigue [los pasos de esta entrega](docs/PUBLICACION.md): aplica solo el SQL pendiente, simula, revisa y confirma en el proyecto nuevo vacío. El origen no se modifica. Para un corte definitivo operativo siguen pendientes respaldo restaurable, fecha de corte y aceptación de las fases faltantes.

Los productos mantienen su stock como movimiento de apertura. El historial anterior NO vuelve a descontarlo. No se enlazan productos por similitud de nombre. Los eliminados permanecen inactivos; sus datos originales se conservan. Fotos/URLs históricas están conservadas en los datos de origen, pero la copia de archivos de Storage y la visualización de fotografías están pendientes.

No subas los CSV ni credenciales al repositorio público. La interfaz recibe los archivos mediante una petición autenticada; la simulación los procesa en memoria. Tamaño admitido por la aplicación: 12 MB; Vercel puede imponer un límite de petición inferior. Los archivos mayores requieren carga privada por lotes en una fase posterior.

## Reglas y límites de esta entrega

- Moneda histórica USD, confirmada por el propietario. Cantidades y dinero en Postgres `numeric`; las simulaciones usan `decimal.js`.
- Zona horaria America/Caracas. Las fechas de filtros incluyen los días completos locales.
- Dentro de cada filtro hay una selección; entre filtros se aplica AND. Las palabras de búsqueda se combinan con AND; si no coinciden todas, se permiten aproximaciones separadas visualmente.
- Compatibilidad histórica como texto declarado pendiente de normalización. La tabla estructurada de compatibilidades existe, pero el editor de compatibilidades verificadas está disponible en la ficha. Variantes y unidades avanzadas siguen pendientes. No se infieren años a partir del texto libre.
- Solo principal por producto en esta interfaz. No se agregan variantes incompatibles en un único total.
- Reportes actuales: métricas de catálogo, inventario filtrado completo y cuentas históricas por moneda según rol, CSV y PDF mediante impresión. Excel nativo y reportes operativos de módulos pendientes todavía no están disponibles.
- No se pueden registrar ventas nuevas, compras, abonos, devoluciones, trabajos, nómina o gastos en esta entrega. No hay botones de esos módulos que simulen guardar operaciones.
- Requiere conexión. No es offline.

## Próximas fases

1. Completar catálogo: variantes, unidades, especificaciones adicionales de compatibilidad, proveedores, fotos, sugerencias con teclado y filtros restantes.
2. Compras/recepciones y cuentas por pagar; clientes/ventas/pagos con aplicaciones, presupuestos, devoluciones y anulaciones transaccionales.
3. Trabajos y reservas; nómina por pagos; gastos.
4. Reportes completos, Excel nativo, costo promedio ponderado por variante con costo histórico por venta (propuesta pendiente de confirmar antes de implementarla).
5. Migración conciliada, pruebas de concurrencia, respaldo/restauración y aceptación final.

## Para desarrollo (el propietario no necesita terminal)

Node 22+: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`. Desarrollo: `npm run dev`.
Las pruebas SQL ejecutan Postgres embebido con PGlite y extensiones `unaccent`/`pg_trgm`. No necesitan credenciales y no escriben sobre ninguna base real. PGlite no sustituye la prueba final sobre el Supabase nuevo.

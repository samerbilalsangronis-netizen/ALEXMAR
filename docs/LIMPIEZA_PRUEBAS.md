# Vaciar las pruebas y cargar archivos recientes · 2026-11-22

El propietario confirmó SQL 011 instalado y pidió probar facturación y después **borrar los datos comerciales de prueba para importar de cero**. Esta autorización sustituye, para este reinicio, la recomendación anterior de actualizar por diferencias. El sistema anterior sigue siendo la fuente de trabajo. No se elimina nada en él.

## Ejecutar desde el navegador

1. Exporta desde la aplicación anterior los cuatro CSV **completos y recientes**: inventario, clientes, detalle de cuentas y notas, incluidos registros eliminados. Consérvalos en privado. Mantén también un respaldo externo del proyecto nuevo si está disponible.
2. Cierra las otras pestañas de ALEXMAR y evita nuevas operaciones mientras se limpia y carga. Entra al **Supabase NUEVO conectado a alexmar.vercel.app → SQL Editor → New query**, con rol `postgres`.
3. Copia TODO [limpiar_pruebas_con_respaldo_v1.sql](../supabase/utilidades/limpiar_pruebas_con_respaldo_v1.sql), desde el comentario inicial hasta `commit;`, y ejecuta Run una sola vez. No traduzcas el código, no ejecutes fragmentos y no lo pegues en el proyecto anterior.
4. El resultado debe decir **LIMPIEZA COMPLETADA**, productos/clientes/facturas/lotes en **0** y al menos un administrador activo. La copia privada queda identificada como `alexmar_respaldo_pruebas_20261122_v1`.
5. Mira `sql_007_instalado`: si es **true**, no repitas SQL 007. Si es **false**, ejecuta completo [SQL 007](../supabase/migrations/20261116000700_actualizacion_origen.sql) una vez en el mismo Supabase nuevo. Aunque la carga inicial no usa la sincronización por diferencias, **la pantalla actual requiere `estado_importacion`, incluida en 007**, para reconocer un destino vacío. Esta es una precisión a la indicación anterior de que 007 no hacía falta para la carga inicial.
6. Recarga ALEXMAR → **Importar archivos**. Debe mostrar **Primera carga del historial**. Selecciona los cuatro CSV recientes, pulsa **Analizar y conciliar**, revisa los conteos/saldos y confirma. No continúes si todavía indica actualizar una carga anterior: comparte el resultado de la limpieza.

No hay que volver a ejecutar SQL 001–006 ni SQL 011, reinstalar Supabase o recrear usuarios. La limpieza es una utilidad manual, **no una migración de despliegue**. Publicar este archivo no ejecuta el borrado.

## Alcance exacto

Se vacían productos/variantes, compatibilidades y clasificaciones manuales ligadas a productos, clientes y movimientos de cuenta, notas, stock y reservas, facturas/líneas/cobros, proveedores/compras/líneas/pagos, lotes y procedencia de importación y sus revisiones si están instaladas. Los cuatro CSV no reconstruyen compras, facturas de prueba, proveedores ni ediciones manuales del catálogo nuevo. Se reinicia la numeración de facturas y compras desde 1 porque se descartan documentos de prueba, no operaciones oficiales.

Se conservan **Auth y contraseñas, perfiles/roles, consultas y filtros guardados, fotos de vehículos y todos los objetos de Storage**, estructura, funciones, permisos y políticas. Logo, tema y diseño de la web no cambian. La auditoría anterior se conserva y se agrega un evento de limpieza. Perfiles, filtros y fotos también quedan copiados, pero no se sobrescriben al restaurar datos comerciales.

Antes de vaciar, la utilidad copia **todas las tablas del esquema alexmar**, incluida la auditoría, sin convertir los decimales a texto/JSON ni redondear. Copia conteos, estructura de columnas y estado de secuencias. Las copias tienen RLS y no conceden acceso a `anon` ni `authenticated`, y nunca deben exponerse como esquema de API. El script devuelve solo conteos y estado de instalación, sin nombres ni importes de clientes. El respaldo ocupa espacio y contiene información privada; no exportarlo a GitHub.

Esta copia está **dentro del mismo proyecto**: permite recuperar el reinicio, pero no protege frente a la pérdida/borrado del proyecto completo. No es un respaldo externo de Auth/Storage; esos datos se conservan en su ubicación actual.

## Protecciones

La utilidad exige la estructura de ALEXMAR con SQL 011 y un administrador activo; rechaza roles de la web, tablas desconocidas o una instalación parcial de 007. Serializa con el importador y bloquea las tablas durante la copia/limpieza. Usa `TRUNCATE RESTRICT` sobre una lista explícita; una referencia desde otra tabla hace fallar todo en lugar de borrarla por cascada. Tiene espera de bloqueos de cinco segundos: si falla por actividad concurrente, no se borra nada y conviene cerrar las otras pestañas antes de reintentar.

Copia y limpieza se confirman juntas. Si hay error, no se guarda un estado a medias. Si la copia con ese nombre ya existe, la utilidad **se niega a repetirse**, incluso si ya reimportaste: no borra la nueva carga. No cambies el nombre ni borres la copia para saltarte esa protección.

## Recuperar antes de la nueva importación

Solo si necesitas regresar al estado anterior y **todavía no has cargado datos nuevos**, usa [restaurar_respaldo_pruebas_v1.sql](../supabase/utilidades/restaurar_respaldo_pruebas_v1.sql) completo en el mismo proyecto. No es el siguiente paso normal después de limpiar: restaura los datos de prueba que acabas de descartar.

Comprueba que todas las tablas comerciales sigan vacías, compara las columnas y restaura padres antes que hijos, incluyendo identidades y valores generados. Verifica conteos y valores exactos contra la copia; recupera el próximo número de factura/compra mediante reinicio transaccional de secuencias. Mantiene la auditoría y registra la recuperación. No sobrescribe una nueva importación u otras operaciones y no elimina la copia.

Si ya hay datos nuevos, cambió la estructura o falta una dependencia, aborta sin sustituirlos. No existe un botón ni RPC de borrado en la web. Si se necesita una recuperación posterior al comienzo de la operación real, requiere revisión independiente del estado actual y un respaldo externo.

## Verificación realizada

Pruebas locales con Postgres PGlite y datos inventados: base completa con 007/010/011, y base sin 007/010. Importación previa, factura con cobros, compra, revisiones con identidad, catálogo y metadatos; limpieza vacía todas las tablas objetivo, conserva Auth/Storage/configuración y mantiene copia privada. Restauración devuelve filas/decimales exactos y numeración. Fallos por FK externa y tablas desconocidas revierten todo. También se comprueban rol denegado, instalación parcial de 007, repetición bloqueada y reimportación reciente sin duplicar stock/deuda, con 007 instalado después del reinicio. La recuperación se bloquea tras la carga nueva.

No hay conexión administrativa remota desde el entorno de desarrollo. Aquí se prepara y prueba el SQL; **la limpieza del Supabase nuevo solo ocurre cuando el propietario lo ejecuta en SQL Editor**.

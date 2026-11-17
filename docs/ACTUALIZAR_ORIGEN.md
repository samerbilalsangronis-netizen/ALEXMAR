# Actualizar desde la aplicación anterior

La opción **Importar archivos** vuelve al menú y al resumen solo para administrador. Permanecerá visible hasta que el propietario avise que terminó y solicite retirarla. La carga inicial ya realizada no se repite.

## Activar y usar

1. En el **Supabase NUEVO → SQL Editor → New query**, ejecuta completo [20261116000700_actualizacion_origen.sql](../supabase/migrations/20261116000700_actualizacion_origen.sql) una sola vez, después de las migraciones ya instaladas. No elimina tablas ni reinicia datos.
2. Espera que Vercel muestre el último commit de main como **Ready** y recarga la web.
3. En la aplicación anterior exporta de nuevo las cuatro tablas **completas**, incluidos eliminados: inventario, clientes, detalle_cuentas y notas. No exportes solo las filas de hoy ni una página limitada.
4. Abre **Importar archivos**, selecciona los CSV nuevos y pulsa **Analizar y conciliar**. En una base con carga previa se elige automáticamente actualización.
5. Revisa los conteos de nuevos, actualizados y sin cambios, y abre el detalle Antes en la web / Después. Los conflictos bloquean la confirmación.
6. Marca la aceptación y pulsa **Confirmar actualización**. La operación es transaccional. Repetir el mismo lote no duplica registros, stock ni dinero.

## Qué conserva y cómo resuelve cambios

- Se comparan IDs, última versión del origen y valores actuales de la web. No se enlazan clientes o productos por parecido de nombre.
- Un campo local distinto se conserva si ese campo no cambió en el origen. Si el mismo campo cambió en ambos sitios a valores distintos, el lote se bloquea para conciliar.
- El stock se registra mediante un movimiento por la diferencia, no como otra apertura. No se permite dejar las existencias por debajo de las reservas activas. La historia de cargos/abonos no vuelve a descontar productos.
- Las correcciones de movimientos de cuenta se hacen con reversión de su efecto y una nueva versión; los originales permanecen. Se conserva la fecha efectiva del origen y la auditoría registra cuándo se aplicó la actualización.
- Las correcciones se concilian contra cargos menos abonos vigentes del origen en USD, sin redondear. Las facturas, pagos y operaciones locales independientes no se sobrescriben ni se incluyen como parte del saldo migrado.
- Se conservan la procedencia inicial y todas las versiones posteriores, además de la clasificación personalizada del catálogo.
- Si faltan IDs importados antes, se rechaza el archivo como incompleto. No se interpretan omisiones como borrados. Versiones anteriores al último updated_at conocido también se bloquean, así como omitir esa columna cuando la versión previa ya la tenía.
- Si la web cambia desde la simulación, debes volver a analizar para revisar el estado actual antes de confirmar.

El propietario indicó que las operaciones nuevas de este corte se registraron **solo en la aplicación anterior**. Las comprobaciones siguen activas si aparecen modificaciones locales.

Esta funcionalidad no toma datos automáticamente del sistema anterior: requiere sus CSV actualizados y confirmación del administrador. No se aplicó SQL ni se cargaron registros nuevos en la base real desde el entorno de desarrollo.

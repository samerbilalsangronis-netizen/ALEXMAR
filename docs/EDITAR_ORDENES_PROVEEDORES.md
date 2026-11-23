# Editar órdenes y abonos de proveedores · SQL 014

## Activación desde el navegador

1. En el **Supabase nuevo de ALEXMAR**, abre **SQL Editor → New query**.
2. Copia completo [SQL 014](../supabase/migrations/20261123001400_edicion_ordenes_proveedores.sql) y pulsa **Run** una sola vez, después de SQL 013. No se ejecuta en Vercel ni en la aplicación anterior.
3. Comprueba que Vercel tenga listo el despliegue nuevo y recarga ALEXMAR.
4. Abre **Proveedores → proveedor → recepción C-…**.

No requiere limpiar datos ni importar archivos. Las órdenes y abonos existentes reciben versión inicial y siguen vigentes.

## Uso

- **Editar orden**: cambia cantidades, costos unitarios, referencia y observaciones. El total es cantidad × costo por línea; no se introduce un total independiente. Se conservan los productos/proveedor de esa orden. Para otros productos registra otra recepción.
- El inventario se modifica por la diferencia de unidades; el costo actual se actualiza al costo corregido. Se conserva el costo previo a la recepción para una posible anulación. No cambia el precio de venta.
- Si un producto ya tiene movimientos o un costo posterior, se bloquea la corrección de su cantidad/costo. Referencia y observaciones pueden corregirse sin tocar mercancía. Las devoluciones/conciliación de operaciones posteriores siguen pendientes.
- **Registrar pago al proveedor** añade otro abono a la misma orden, como antes.
- En **Pagos registrados → Editar o anular abono**, corrige importe, método o referencia, o anula el registro incorrecto. Se recalcula la deuda, sin tocar inventario. Los abonos anulados aparecen en el historial y no cuentan como pagados; se puede registrar después el abono correcto.
- El total corregido no puede quedar por debajo de los abonos vigentes; corrige primero los abonos incorrectos. Ningún abono puede superar el saldo disponible.
- **Anular orden / eliminar registro de prueba** anula también los abonos vigentes, revierte las unidades recibidas y restaura el costo anterior. Requiere mercancía libre, sin movimientos ni cambios de costo posteriores, motivo y aceptación explícita. Si falla la reversión de stock, los abonos y la orden conservan íntegramente su estado anterior.
- Corregir/anular no transfiere dinero. La confirmación requiere revisar lo realmente pagado y cualquier reintegro, o indicar que era una prueba sin pago real.
- La anulación conserva comprobante, abonos y auditoría; no borra físicamente documentos financieros ni el proveedor. Para retirar el proveedor del directorio activo, desmarca **Proveedor activo** en sus datos.

Solo Administrativo puede corregir/anular. General no puede consultar estas órdenes ni llamar las funciones financieras. Cada cambio comprueba la versión bajo bloqueo: si hubo otro abono o una edición desde otra pestaña, exige recargar y revisar. Las correcciones no se aplican dos veces; los movimientos tienen clave por orden/versión/producto. Los reintentos de recepción/pago originales conservan su idempotencia y no resucitan abonos anulados. La auditoría guarda valores anteriores/nuevos, motivo, fecha y responsable. Dinero exacto, hasta 80 decimales de costo y 84 de abono, sin redondear lo guardado.

## Verificación local

`tests/edicion-compras.test.ts` instala todas las migraciones, creando una orden y un abono antes de aplicar 014. Verifica edición, stock por diferencia, costo, exactitud, idempotencia, versiones, sobreabonos, autorización, auditoría, anulación integral y rollback ante operaciones posteriores. `tests/compras.browser.mjs` usa componentes/acciones reales con DB simulada para recepción, edición, conservación de campos ante errores, corrección/anulación de abonos, anulación de orden y pantallas de 1440/390 px. No se escriben operaciones en producción.

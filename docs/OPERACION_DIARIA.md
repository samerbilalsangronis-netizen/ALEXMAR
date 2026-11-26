# Operación diaria: Ventas, Clientes, Proveedores e Inventario

## Activación

En el **Supabase nuevo de ALEXMAR → SQL Editor → New query**, ejecutar completo y una sola vez [SQL 020](../supabase/migrations/20261126002000_operacion_simplificada.sql), después de 019. Si falta alguna migración anterior, aplicar solo las pendientes en el [orden de SQL](../supabase/README.md). Después abrir el despliegue listo de Vercel y recargar. Publicar código no ejecuta SQL.

No limpiar, no reimportar archivos ni repetir las migraciones ya instaladas para activar esta entrega. No modifica el sistema anterior. La conciliación pendiente del corte de datos es independiente.

## Ventas y clientes

- **Ventas → Registrar venta**: contado, 15 filas ampliables, precio editable, productos y servicios, cobro/método. El comprador es opcional y no crea una cuenta permanente. Siempre guarda la venta y cuenta una sola vez en rendimiento. «Generar factura al registrar la venta» abre su documento; sin marcar vuelve al listado. El documento también está disponible después desde la venta guardada.
- **Clientes → Nuevo cliente**: crea una cuenta a crédito. Dentro quedan **Generar factura**, **Cargar productos** y **Registrar abono**. Los abonos reducen deuda; no suman ventas otra vez. La cuenta integra cargos y abonos migrados y locales sin fabricar facturas antiguas.
- **Editar datos** actualiza nombre, cédula/RIF, teléfono y dirección. Las facturas emitidas conservan su copia de los datos al emitir.
- **Historial de facturas del cliente** sustituye a Comprobantes. Los filtros siguen cerrados inicialmente. **Más opciones** contiene CSV completo y la impresión del historial completo; el PDF para WhatsApp permanece en Generar factura.
- **Eliminar cliente/proveedor** pide confirmación y retira del directorio conservando operaciones. Solo se permite con saldo exacto cero (cliente: todas las monedas; proveedor: compras vigentes menos pagos no anulados). No cambia el acceso de usuarios de personal.
- **Eliminar factura** usa la anulación auditada existente: motivo, versión vigente y reconocimiento del reembolso cuando hubo cobros. Revierte su cuenta y únicamente el stock que realmente salió; no borra el historial. Ventas muestra Activas inicialmente y conserva la pestaña Anuladas. Revocar un enlace PDF no anula una venta ni elimina archivos que ya se descargaron.

Las búsquedas de directorios, inventario, precios, ventas y productos del proveedor se actualizan mientras escribes. Admiten fragmentos y tildes; las coincidencias aproximadas se señalan cuando la consulta las devuelve. Los editores de venta/compra conservan sus sugerencias interactivas. La cabecera global deja de ofrecer Nueva factura en todas las secciones; el tema se cambia con el icono de sol/luna.

## Proveedores y foto de factura

1. Registrar proveedor con nombre de empresa, marca o vendedor. Contacto y otros datos son opcionales. El directorio ordinario muestra proveedores vigentes y no requiere seleccionar activo/inactivo.
2. Abrir su cuenta → **Cargar factura de compra**. El resumen muestra comprado, pagado y pendiente.
3. Opcionalmente **Digitalizar factura**: tomar/seleccionar JPG, PNG o WebP (hasta 15 MB). El reconocimiento ocurre en el navegador con Tesseract/Spanish y recursos locales; no envía la foto a un servicio de IA. Se prepara una copia JPEG de hasta 2200 px/2 MB para guardarla. La foto de entrada no se conserva a resolución original.
4. El lector propone filas de tablas con cantidad, descripción, costo unitario e importe (también descripción/cantidad/costo/importe). No es un lector universal de todos los diseños: algunas fotos necesitarán corregir el texto o introducir líneas manualmente. Los números ambiguos, por ejemplo `1.000`, quedan vacíos para revisión. Se muestran las líneas no incorporadas y diferencias entre el total leído y la suma de la tabla.
5. **Cargar filas y foto para revisar** contrasta nombres con el catálogo; la coincidencia exacta única se selecciona, otras se revisan en «Registro en inventario». Se puede elegir existente o crear nuevo y corregir nombre/cantidad/costo. Comparar con la foto y añadir manualmente los conceptos faltantes. No se añaden impuestos ni gastos automáticamente: se registra el total revisado de la tabla.
6. Revisar y confirmar expresamente. Una sola transacción guarda compra, stock, último costo, deuda y foto. Reintentar con el mismo ID no duplica. Los productos nuevos quedan sin precio de venta; los existentes conservan su precio. Los pagos reducen saldo del proveedor, no el inventario.
7. En la compra, **Ver foto de factura** abre la copia privada. Solo administrador autenticado y autorizado puede leerla; no hay bucket público ni service role. Foto limitada a 2 MB; auditoría registra metadatos/huella sin duplicar el binario en el log.

En móvil, «Tomar foto» depende del selector/cámara que permita el dispositivo. Retirar la foto antes de confirmar conserva las líneas para revisión manual.

## Inventario

- Buscador visible y filtros automáticos, sin botones redundantes Buscar y filtrar/Aplicar. Nuevo producto sigue disponible; se conservan tarjetas de marcas y filtros plegables.
- En **Productos sin cargar → Completar producto en inventario**, completar nombre, **stock físico actual**, precio y opcionalmente costo/referencia/categoría. No usar aquí la cantidad vendida como stock. La incorporación y el vínculo se hacen juntos, sin modificar la venta ni cargar deuda de nuevo.
- Si ya existe nombre o referencia, se bloquea el duplicado exacto y se ofrece **Vincular producto existente**. Ese vínculo conserva las reglas de stock de la venta original.
- Cuando una venta pendiente sí descontaba stock, el alta registra conteo de apertura más la salida original para que el saldo final sea el stock físico actual indicado. Al anular se restituye solo esa salida. Si la venta no descontaba, no hay salida retroactiva.
- En una ficha, **Agregar unidades** / **Retirar unidades** son movimientos por cantidad, con motivo obligatorio, responsable y fecha/hora Caracas. Retirar no permite consumir reservas ni dejar saldo libre negativo. El ajuste por conteo absoluto sigue en opciones plegadas. **Stock mínimo** sigue siendo un umbral, no modifica la existencia.
- **Historial de existencias** muestra antes, movimiento, después, responsable y enlace a la venta cuando corresponde. SQL 020 añade orden de registro al libro; los registros previos conservan su desempate por fecha/ID y no cambian de cantidad.
- **Registrar venta** desde inventario abre una venta con ese producto ya seleccionado. El motor de ventas registra el ingreso y descuenta una vez solo cuando el control de stock está activado. Un retiro manual por daño/conteo no cuenta como venta.

## Verificación de desarrollo

Datos sintéticos y sesiones simuladas; sin escrituras en la base real. Pruebas SQL cubren autorización, saldos exactos en varias monedas, retirada, existencias/reservas/idempotencia, relación venta/stock/anulación, pendiente con ambos modos de inventario y compra/foto privada atómica. Navegador usa componentes y endpoints reales, incluida lectura OCR real con worker/WASM/modelo locales sobre una imagen sintética, revisión y foto guardada, búsquedas sin Enter, edición/retirada, movimientos, contado sin imprimir, crédito y PDF compartido. No se certifican todos los diseños de factura de proveedores ni se ha aplicado el SQL remoto desde desarrollo.

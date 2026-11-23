# Precio unitario editable y alta de productos · SQL 016

## Activar

En el **Supabase nuevo → SQL Editor → New query**, copia completo [SQL 016](../supabase/migrations/20261123001600_precios_productos_venta.sql) y pulsa **Run una sola vez**, después de las actualizaciones anteriores. No repitas los SQL ya aplicados. Cuando Vercel esté Listo, recarga la web. No requiere limpiar ni reimportar datos.

## Precio para esta operación

Al cargar productos desde una cuenta o al facturar, la búsqueda continúa usando el inventario. Para Administrativo, **Precio unitario USD** ahora es editable también en productos. El precio del inventario se usa como valor inicial; cantidad × precio editado determina el importe de la línea y el total de la cuenta/comprobante.

Ejemplo: precio del inventario 60, precio de esta operación 70, cantidad 3 → cargo 210. El precio de inventario permanece 60. La línea guarda el precio cobrado y la marca de autorización administrativa; el borrador conserva esa marca al reabrirlo. Para cambiar permanentemente el precio del catálogo, se sigue editando la ficha del producto.

Si vuelves a elegir el mismo producto, aumenta la cantidad y conserva el precio personalizado. Los productos sin precio de catálogo pueden seleccionarse por Administrativo para escribir un precio explícito de operación; no se sustituyen por cero. Siguen vigentes la validación decimal, la autorización de entregas gratuitas, la revisión previa, la idempotencia y el control de stock opcional. Un precio de catálogo cambiado sin autorización explícita sigue bloqueando la emisión para que se revise la selección.

## Producto que todavía no existe

**¿No está? Crear producto en inventario** abre el alta sin salir de la operación ni borrar las líneas seleccionadas. Indica nombre, precio de venta, referencia/categoría opcionales y pulsa **Guardar en inventario y añadir**. El producto queda en el catálogo y se añade a la operación. El alta es independiente de confirmar el cargo: cancelar después la venta no borra el producto recién creado.

Empieza sin existencias y con costo pendiente (NULL), sin inventar cantidades ni costos. Si el control de stock está activado, registra recepción o conteo antes de venderlo. El alta no emite una factura ni genera deuda por sí misma. Los reintentos con misma clave/contenido devuelven el producto creado sin duplicarlo; una clave con datos distintos se rechaza y no sobrescribe artículos existentes.

Solo Administrativo puede autorizar precios y crear artículos desde este formulario, con comprobación en interfaz/API/SQL. General mantiene su consulta de precios. La nueva tabla de altas es privada, tiene RLS y auditoría. No se exponen costos en su respuesta. Las migraciones anteriores se conservan intactas.

## Verificación local

`tests/precio-venta.test.ts` verifica 60 → 70 × 3 = 210 sin cambiar catálogo/stock, idempotencia del alta/emisión, precio autorizado en borrador reabierto, decimales, permisos, datos inválidos y rechazo por stock insuficiente cuando el control está activo.

`tests/facturacion.browser.mjs` usa componentes/API reales y backend simulado: edita precio/cantidad, vuelve a seleccionar sin perder precio, crea producto sin perder líneas ni emitir accidentalmente y confirma el cargo con los importes editados. Conserva la regresión completa de facturación/cuentas, impresión y 1440/390. No se escriben productos ni ventas reales desde desarrollo.

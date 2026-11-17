# Facturación: primera fase operativa

## Activar desde el navegador

1. En el **Supabase NUEVO → SQL Editor → New query**, copia completo [20261115000600_facturacion.sql](../supabase/migrations/20261115000600_facturacion.sql) y ejecuta **Run** una sola vez, después de las migraciones anteriores ya instaladas.
2. No repitas la importación: esta actualización agrega documentos y funciones, sin modificar los saldos históricos ni las existencias al instalarse.
3. En Vercel comprueba el despliegue del último commit de main como **Ready**, recarga y abre **Facturación**. Si el SQL falta, la página indica cómo activar el módulo.

No se ejecutó esta migración en el Supabase remoto desde el entorno de desarrollo. La validación técnica se hizo con PGlite y datos sintéticos. Verifica la configuración y el flujo en una base independiente antes de utilizarlo para operaciones reales.

## Crear y emitir

Disponible para **administrador y ventas**. La primera fase usa **USD**, como el catálogo, e **impuesto 0**, indicado por el propietario. No hay conversiones automáticas.

1. Pulsa **Nueva factura** y selecciona un cliente existente mediante búsqueda paginada.
2. Busca productos por nombre/referencia/vehículo y selecciona los resultados del inventario. Añade servicios por descripción, cantidad y precio cuando corresponda.
3. Indica cantidades, pago inicial y método de pago. Pago inicial 0 significa crédito; total completo, contado; un importe intermedio, pago parcial. El pago no puede superar el total.
4. Guarda como borrador de factura o presupuesto. Ambos conservan líneas y condiciones, sin descontar existencias ni registrar cobros/deuda.
5. Revisa el borrador y su total exacto, cliente, precios y pago inicial. Puedes editarlo antes de emitir.
6. Marca la confirmación y pulsa **Emitir factura**. La DB asigna un número V-000001, V-000002, etc., descuenta solo productos y registra el cargo y el pago inicial juntos. Los servicios no generan movimientos de inventario.
7. Abre **Imprimir / PDF** para el documento completo con el logo y los datos del cliente. Es un documento comercial; no se afirma integración fiscal.

Los importes y totales se calculan en Postgres numeric; no se redondea el valor guardado. El formato monetario visible usa dos decimales y el documento muestra también el total exacto. Las cantidades admiten hasta cuatro decimales. Los datos del cliente y los conceptos se conservan como snapshot al emitir.

Ventas usa el precio del catálogo para productos; el administrador puede autorizar otro precio, descuentos o líneas gratuitas. Los precios pendientes deben completarse; cero no equivale a un precio pendiente. Una línea gratuita requiere autorización explícita del administrador.

Los reintentos de guardar o emitir no duplican documentos, cargos, pagos ni stock. El borrador tiene versión para impedir confirmar totales modificados desde otra sesión. Se bloquean variantes en orden estable y se revisa disponible físico menos reservas activas antes de emitir.

## Anular

Solo el administrador puede anular, con motivo. Se conservan documento y movimientos originales. En una factura emitida se agregan reversiones de stock y cuenta; no se borra historia. Si hubo pago inicial, el operador debe confirmar que efectivamente revirtió el cobro o entregó el reembolso; se registra su reversión. Repetir la anulación no duplica efectos.

La anulación completa no sustituye una devolución parcial. Un presupuesto o borrador anulado no genera movimientos financieros ni de stock.

## Alcance pendiente

Pagos posteriores a la emisión y aplicación de anticipos a facturas, devoluciones parciales/notas de crédito, compras/recepciones, otras monedas/tasas e impuestos, integración fiscal y márgenes/costos históricos requieren fases posteriores. Esta entrega no define un método de costeo ni inventa rentabilidad. La búsqueda de productos usa las variantes actualmente expuestas por el catálogo (principal); no consolida variantes incompatibles.

## Navegación

Importación se retiró del menú y del resumen porque el propietario confirmó la carga. Se mantienen los datos, lotes y controles de seguridad del importador; no se repite la carga.

En Inventario, **Minimizar** permite plegar tanto Categorías y vehículos como Filtros personalizados. El buscador sigue visible y la preferencia se recuerda en el navegador. Los filtros activos permanecen aplicados; puedes quitarlos con sus etiquetas o Limpiar todos.

## Actualización posterior del menú

Por petición posterior del propietario, Importar archivos vuelve temporalmente al menú y al resumen del administrador para incorporar lo registrado en la aplicación anterior. Ver ACTUALIZAR_ORIGEN.md. No se oculta automáticamente al terminar: el propietario avisará cuándo retirarlo.

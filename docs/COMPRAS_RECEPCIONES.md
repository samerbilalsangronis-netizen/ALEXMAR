# Compras, recepciones y cuenta del proveedor

## Activar una vez

En el Supabase NUEVO aplica completo [SQL 010](../supabase/migrations/20261117001000_compras_recepciones.sql) en SQL Editor → New query → Run, después de las migraciones anteriores del proyecto. No repitas los SQL ya aplicados ni la importación. La publicación del código no ejecuta esta migración.

La actualización crea compras recibidas, líneas y pagos privados, con RLS, auditoría, consultas y funciones transaccionales. Usa las tablas de productos y movimientos de stock existentes: facturación consulta esa misma existencia. No se escribe en la aplicación anterior ni se realizan pagos bancarios desde el sistema.

## Ejemplo: cinco Starlink a USD 100

1. Abre Proveedores. Si todavía no existe, registra el proveedor y luego abre Productos, recepciones y cuenta.
2. Pulsa Recibir mercancía. Busca Starlink en el catálogo y selecciónalo. Si no existe, usa Crear producto nuevo; se creará solo al confirmar, dentro de la misma transacción.
3. Indica cantidad 5 y costo unitario final 100. El total a deber se calcula en USD 500. Puedes colocar la factura o referencia del proveedor para detectar duplicados.
4. Revisa el resumen, confirma que recibiste la mercancía y pulsa Confirmar recepción y deuda. Revisar aún no cambia nada; confirmar registra la compra, suma las cinco unidades y genera la cuenta por pagar a la vez.
5. Si el producto es nuevo, el precio de venta queda sin asignar, nunca en cero. En el comprobante aparece Pendiente de precio de venta con un campo para asignarlo directamente, sin reenviar el costo ni las existencias; también puedes abrir su ficha. Si ya existía, conserva su precio de venta actual.
6. Cuando se emite una factura al cliente, se descuentan las unidades del inventario mediante el flujo transaccional de ventas existente. Guardar un borrador no descuenta. Vender no disminuye la deuda del proveedor: esa deuda baja al registrar pagos al proveedor.

## Costo confirmado por el propietario

Se utiliza **último costo recibido**, no promedio ponderado. Si había dos unidades a otro costo y llegan cinco a 100, habrá siete unidades y el costo de catálogo pasa a 100. No se recalcula el precio de venta. Cada recepción conserva su propio costo unitario e importe exacto para consultar el historial, aunque después cambie el catálogo.

Los nuevos productos pueden incluir una categoría manual. No se enlazan productos por parecido del nombre: se elige un registro exacto o se crea uno nuevo explícitamente. Las entradas se agrupan en una línea por variante; las cantidades acumuladas de cada proveedor no equivalen al stock actual ni a lotes separados de venta.

## Pagos y consulta

Dentro de cada proveedor se muestran productos suministrados, unidades recibidas acumuladas, último costo de ese proveedor, precio de venta actual y recepciones. El costo actual del catálogo puede proceder de otro proveedor si hubo una compra posterior.

El saldo global suma compras confirmadas y resta pagos registrados. No incluye anuladas. Las métricas son de todo el historial de ese proveedor, aunque se cambie de página o se busque un producto. Recepciones, productos y pagos tienen paginación real de 30 registros, con totales calculados sobre todas las filas.

En un comprobante, el administrador puede registrar pagos parciales o completar el saldo. Debe seleccionar método, indicar referencia opcional y confirmar que el pago ya se realizó. No se permite pagar más que el saldo ni registrar anticipos en este flujo. El formulario no transfiere dinero de una cuenta bancaria ni registra nuevamente el pago como gasto operativo.

El comprobante se puede imprimir o guardar como PDF desde el navegador. Incluye todas sus líneas (máximo 200) y señala qué página de pagos se muestra; los indicadores incluyen todos los pagos. El estado completo por fechas, exportación de cuenta a CSV/Excel y PDF de todo el historial siguen pendientes.

## Correcciones y protección contra duplicados

- Cada recepción y pago usa un UUID estable durante el intento. Repetir el mismo envío no duplica stock ni dinero; intentar usar el mismo ID con otros datos se rechaza. Ante una respuesta de red incierta, el editor conserva sus datos y permite abrir el comprobante para verificar si se registró.
- Una referencia no vacía se normaliza y no puede repetirse para el mismo proveedor en compras confirmadas. Referencias vacías no permiten reconocer dos formularios independientes como una misma entrega; revisar antes de confirmar.
- Las compras confirmadas no se editan ni borran. El administrador puede anular una recepción incorrecta si no tiene pagos, no hubo movimientos posteriores ni cambios de costo, y todas las unidades siguen libres. Se revierte el stock, se restaura el costo anterior y se retira su saldo, conservando el comprobante y la auditoría. Un producto creado en esa recepción permanece registrado, con stock revertido; no se borra.
- Si hubo ventas, ajustes, nuevas recepciones, cambios de costo, reservas incompatibles o pagos, la anulación simple se bloquea. Las devoluciones al proveedor, notas de crédito y reembolsos requieren una fase posterior; no se simula que estén disponibles.

## Permisos y límites de esta fase

Administrador e inventario/compras pueden consultar costos y cuenta del proveedor, y registrar mercancía recibida. Solo administrador registra pagos y anula. Ventas y lectura no pueden consultar ni escribir compras. Se verifica sesión y rol tanto en servidor como en PostgreSQL; no se habilita acceso directo al esquema privado.

Esta fase registra compra y recepción física juntas, a crédito, en USD. No hay pedidos pendientes de recibir, recepciones parciales contra una orden, monedas adicionales/conversiones, descuentos, fletes/impuestos separados, anticipos o devoluciones. Ingresa el costo unitario final; no se añade IVA automáticamente. No se requieren saldos históricos de proveedores para empezar porque el propietario confirmó que ese módulo del origen estaba vacío.

Costos y dinero usan PostgreSQL numeric y el editor calcula con decimal.js, sin redondear al registrar. Cantidades positivas menores a 100 millones, con hasta cuatro decimales; costos hasta 80 decimales y total menor a 10^16. Los pagos admiten hasta 84 decimales para saldar exactamente importes derivados de costo × cantidad. La presentación monetaria es de dos decimales y el comprobante muestra también el total exacto. El costo histórico por venta y la utilidad realizada siguen pendientes; los gráficos existentes son de margen potencial del inventario actual.

Pruebas locales usan datos sintéticos, PostgreSQL embebido y navegador con sesión/DB simuladas. No se registraron compras, pagos ni ventas reales, ni se aplicó SQL al Supabase remoto desde el entorno de desarrollo.

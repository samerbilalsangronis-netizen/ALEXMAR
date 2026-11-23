# Facturación rápida, contado y cuentas · SQL 018

## Activación

En el **Supabase nuevo → SQL Editor → New query**, copia completo [SQL 018](../supabase/migrations/20261123001800_facturacion_rapida.sql) y pulsa **Run una sola vez**, después de SQL 017. No repitas SQL ya aplicados. No limpia cuentas, clientes ni facturas, ni requiere reimportar. Cuando Vercel esté Listo, recarga.

El propietario confirmó: **Nueva factura es contado; Agregar cliente a crédito crea una cuenta permanente. Todas las facturas de contado deben quedar registradas.**

## Contado

**Facturación → Nueva factura** abre la tabla rápida y el método de cobro. Se cobra el total. Nombre, cédula/RIF y teléfono son opcionales y se conservan exclusivamente como datos del comprobante; no crean una cuenta en Clientes. Sin nombre se imprime Consumidor final. La factura queda numerada, consultable, buscable e imprimible en Facturación, con su pago y trazabilidad. Se incluye en ventas y rendimiento, sin fabricar un cliente genérico ni deuda.

La base permite `cliente_id=NULL` solo en contado. Se conserva la FK para las cuentas existentes. Los cobros quedan en pagos de la factura; una factura sin cuenta no crea movimientos de cuenta de cliente. Su anulación conserva el documento y exige revisar el reembolso de lo cobrado. El listado utiliza LEFT JOIN para incluir también contado sin cuenta; la búsqueda usa los datos del comprobante cuando corresponda. El ranking de clientes sigue correspondiendo a cuentas identificadas, sin inventar clientes para ventas anónimas.

## Crédito

**Agregar cliente a crédito**, junto a Nueva factura, crea una cuenta y abre su carga de productos. Los clientes existentes usan **Clientes y cuentas → cliente → Cargar productos** o Registrar abono. No se vuelve a buscar el nombre ni se escoge contado/crédito al cargar dentro de una cuenta.

Cada cargo suma su total a la cuenta y conserva el comprobante. Se puede registrar un abono inicial o dejar cero para cobrar después. La cuenta continua y sus abonos de SQL 015 se conservan.

## Tabla de 15 filas

Cada fila tiene cantidad, nombre de producto/servicio, precio unitario y total calculado. Empieza con **15 filas** y **Agregar 5 filas** permite llegar a 20 o más, hasta 200. Las filas vacías no se guardan; las incompletas se bloquean con su número real de fila. Dinero decimal exacto, hasta 80 decimales de precio y cuatro de cantidad; importes exactos completos en la revisión/documento. No se acepta precio cero en la carga rápida.

Puedes escribir varios productos seguidos sin referencia/categoría ni formularios de alta individuales. Si el artículo existe, elígelo entre las sugerencias para vincularlo y completar su precio; el precio sigue editable para esa operación. No se enlaza automáticamente por similitud de nombre. Una descripción escrita sin elegir catálogo queda marcada como **Pendiente de inventario**. El botón Producto en la fila cambia a **Servicio / instalación**; los servicios no van a la cola de inventario.

- ↑ y ↓: misma columna en la fila anterior/siguiente.
- ← y →: campo anterior/siguiente al llegar al inicio/final del texto.
- Enter: siguiente campo.
- Alt + ↑/↓ y Enter: recorrer y elegir sugerencias del inventario.
- Escape: cerrar sugerencias.

Revisar muestra el total; confirmar emite todas las líneas en una única transacción. Si falla, no se crea un cargo parcial y el texto continúa en la tabla. Hay aviso al cerrar/recargar con filas sin guardar. No hay autosave ni caché de datos privados.

Se retiró el bloque **Observaciones, descuento y autorizaciones**. La carga rápida no usa descuentos, notas ni autorizaciones gratuitas. Los datos y descuentos de comprobantes/borradores antiguos no se borran; los borradores previos conservan su editor para revisarlos con sus importes originales, sin mostrar ese bloque de opciones.

## Inventario → Productos sin cargar

Al emitir, cada fila de producto sin vínculo se registra una vez en esta cola, con su descripción, cantidad, precio y comprobante. Los servicios no se encolan. Cancelar la factura retira sus pendientes de la lista. La cola no vuelve a cobrar al cliente ni representa entradas de stock.

En **Completar producto en inventario**, elige un SKU existente o crea uno con sus datos. El alta de catálogo es explícita e independiente; luego pulsa **Vincular y completar**. Se conservan nombre, cantidad y precio cobrados en la factura, aunque el catálogo tenga otro precio. Crear un producto no inventa costo ni existencias.

Si la factura se emitió con descuento de stock apagado, vincular no descuenta retroactivamente aunque el interruptor esté ahora encendido. Si se emitió con descuento activado, las líneas ya vinculadas se descuentan al emitir; las pendientes se descuentan una sola vez al vincularlas, previa disponibilidad libre. Si faltan unidades, debes registrar su recepción/conteo antes; el vínculo queda pendiente. Al anular se revierten únicamente las salidas realmente registradas, agrupadas por variante, incluidas las vinculaciones posteriores. Se conserva auditoría.

## Permisos y verificación

Solo Administrativo puede emitir carga rápida, crear cuentas y gestionar pendientes. General mantiene solo consulta de precios. Nuevas tablas privadas, RLS y RPC con autorización. Una emisión repetida con el mismo ID/contenido no duplica facturas, deuda, pago ni pendientes; los vínculos son idempotentes. La resolución bloquea primero factura y luego variante/pendiente, y no cambia deuda ni precio cobrado.

Pruebas locales: 15/20 filas, tabla vacía/incompleta y números de fila, contado sin crear clientes, factura registrada/buscable/PDF, cuenta a crédito/abonos, servicios fuera de cola, vínculos y stock/anulación, rollback, exactitud y permisos. Navegador con componentes/API reales y backend simulado a 1440/390, flechas/Enter y ambos temas. No se aplicó SQL ni se emitieron operaciones reales desde desarrollo. La conciliación del corte del sistema anterior sigue siendo independiente y no se ejecuta con esta entrega.

# Facturación y cuentas de clientes · 22 de noviembre de 2026

El propietario confirma que sigue operando **solo en la aplicación anterior**. La importación actual fue una prueba y está desactualizada. Esta entrega no actualiza esos datos ni realiza el corte definitivo.

## Activar desde el navegador

1. Abre el **Supabase NUEVO → SQL Editor → New query**.
2. Si ya tienes las migraciones anteriores de facturación, ejecuta completo, una sola vez, [SQL 011](../supabase/migrations/20261122001100_facturacion_clientes.sql). Requiere la base hasta SQL 006; no depende de SQL 007 ni modifica migraciones aplicadas. Para compras y fotos siguen aplicándose sus migraciones correspondientes.
3. No repitas la importación inicial. Instalar 011 no cambia stock, deuda histórica ni números de facturas existentes; clasifica documentos existentes según su pago inicial y agrega las nuevas funciones/campos.
4. En Vercel comprueba el último despliegue de `main` como **Ready**, recarga y abre **Facturación**. El listado y el editor avisan si falta 011; guardar borrador usa una RPC exclusiva de esta migración para impedir escrituras con una instalación anterior.

El entorno de desarrollo no tiene credenciales de producción. No se ha aplicado SQL remoto ni emitido ventas o cobros reales. La publicación del código no instala la migración.

## Listado de facturas

Búsqueda por número, cliente, documento/teléfono o palabras del producto; las palabras pueden aparecer en diferente orden. Un número completo, como V-000001, busca esa factura exacta. Filtros Todas, Por cobrar, Pagadas, Anuladas y Borradores, con fechas en America/Caracas. Paginación real de 30 documentos; totales de todo el conjunto filtrado, sin limitarse a la página visible.

Facturado suma totales de documentos confirmados; Cobrado suma sus pagos netos; Por cobrar suma total menos pagos. Borradores/anuladas no suman. El crédito importado se consulta en Clientes y no se inventan facturas para representarlo. USD es la moneda de referencia de esta fase, impuesto 0; no se convierten bolívares ni pesos.

## Nueva factura

1. Busca al cliente por nombre o primeras letras, documento o teléfono. Las sugerencias admiten flechas, Enter y Escape. **Cliente nuevo** registra y selecciona sin perder las líneas de la factura.
2. Busca piezas por nombre o palabras: por ejemplo, `filt toy`. La búsqueda consulta todo el catálogo con paginación, conserva resultados durante la consulta y tiene caché pequeña por consulta en memoria de esa pantalla. No descarga el catálogo completo ni almacena cuentas en localStorage. Las primeras sugerencias se precargan en servidor, sin enviar costos al navegador.
3. Selecciona producto: coloca automáticamente el precio de venta del catálogo. Seleccionar nuevamente la misma variante incrementa cantidad. Precios pendientes se muestran y no pueden seleccionarse; asignarlos en Inventario. No se exige código.
4. **Contado** está seleccionado inicialmente: el cobro se actualiza al cambiar productos/cantidades/descuento. Elige el método realmente recibido. **Crédito** permite abono inicial 0 o parcial y vencimiento opcional. El saldo es total menos abono.
5. Puedes agregar servicios por descripción, cantidad y precio. El administrador puede aplicar descuento y autorizar líneas gratuitas; el formulario rápido conserva el precio de catálogo de las piezas.
6. **Guardar borrador** conserva el documento sin afectar stock ni deuda. **Revisar y emitir** muestra cliente, líneas, cantidades, precios, total, cobro y saldo antes de confirmar. La emisión directa guarda y emite en una transacción; una emisión fallida no deja un borrador parcial.
7. Al emitir se asigna V-000001, se comprueba existencia física menos reservas, se descuentan productos y se registran cargo y cobro inicial. Servicios no mueven stock. Los reintentos con mismo contenido no duplican efectos; otro contenido con el mismo identificador se rechaza. No se permite sustituir por otro precio de catálogo al confirmar.

Valores finales en Postgres `numeric`, cálculos de revisión con Decimal de 128 dígitos. Hasta cuatro decimales en cantidad y 80 en precio; cobros admiten 84 para cancelar exactamente el producto de ambos, siempre bajo 10^16. No se redondea lo guardado; la presentación monetaria usa dos decimales y muestra también el total exacto. Cliente/conceptos quedan como snapshot al emitir.

## Documento y cobros

Vista previa e impresión comparten el mismo documento: logo sin teléfono, nombre ALEXMAR, ubicación confirmada **Tovar, Mérida, Venezuela**, número, fecha, moneda, condición, cliente, líneas, total, cobrado y saldo actual. No se inventan RIF, calle, firma ni sello. **Imprimir / PDF** abre la versión completa; el navegador permite guardar PDF. Es un documento comercial, sin integración fiscal.

En una factura con saldo: **Registrar cobro → Revisar cobro → Confirmar cobro recibido**. Solo registrar dinero efectivamente recibido. La función transaccional bloquea el documento, impide sobrepagos, guarda pago y abono a la cuenta del cliente y protege reintentos con clave y firma. No vuelve a descontar stock ni modifica cuentas de proveedor. Al completarse el pago, la factura queda Pagada y conserva su condición original de crédito.

Solo administrador anula, con motivo y confirmación de reembolso/reversión de todos los cobros. La versión revisada debe seguir vigente. Se conservan originales y se agregan reversiones de stock, cargo y pagos; repetir no duplica. No hay transferencias o reembolsos bancarios automáticos. La RPC antigua se conserva por compatibilidad, actualizada para revertir todos los cobros.

## Cliente: pasado y facturas nuevas

Cada cliente muestra su cuenta total por moneda, saldo del sistema anterior y resto de operaciones. Las tarjetas son de toda la cuenta; los filtros inferiores afectan el detalle y sus totales de periodo.

- **Facturas nuevas:** documentos y saldos propios de esta web, en USD, paginados y filtrables por cobro/fecha.
- **Historial del sistema anterior:** descripciones originales de los productos, cantidades y precios unitarios originales cuando existen, cargos, abonos, títulos y correcciones auditadas. Incluye originales y reversiones para conservar la trazabilidad. Solo movimientos activos de procedencia `supabase_anterior`/`actualizacion_origen`, sin `venta_id`. No expone costos ni presupone vínculos por nombres similares.
- **Cuenta completa:** todos los movimientos activos, incluidas facturas y cobros nuevos. Se conservan exportación CSV e impresión/PDF completos. La exportación del historial anterior respeta esa procedencia y recorre todas sus páginas; no mezcla facturas nuevas.

USD, VES y COP permanecen separados en el historial. No se suman monedas entre sí. El saldo importado no se vuelve a cargar al crear la primera factura; queda como parte de la cuenta anterior. El cobro nuevo se aplica a la factura seleccionada; no liquida automáticamente deudas anteriores.

## Antes del cambio definitivo

Mantener **Importar archivos** hasta aviso del propietario. Cuando decida el corte, tomar los cuatro CSV completos y recientes del sistema anterior, respaldar, usar la actualización por diferencias (SQL 007), revisar conflictos y conciliar cantidades/saldos por cliente. No repetir aperturas ni reemplazar la base. El código no inicia esa actualización automáticamente.

Pendientes de fases posteriores: aplicación de pagos a deuda histórica, anticipos, devoluciones parciales/notas de crédito, otras monedas/tasas, integración fiscal y costo histórico por venta. No se considera terminado todo el sistema ni se afirma un corte de operación.

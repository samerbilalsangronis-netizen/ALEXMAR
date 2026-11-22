# Decisiones

## Confirmadas por el propietario

- Repositorio ALEXMAR independiente, Supabase NUEVO, despliegue en otra cuenta de Vercel conservando el GitHub actual. El usuario configura variables.
- No modificar Tierra Santa ni el proyecto Alexmar existente.
- Los valores históricos de precios, cargos y abonos son USD.
- Solo hay datos disponibles de inventario, clientes, detalle_cuentas y notas; otros módulos empiezan vacíos.

## Implementadas en la entrega 1

- Next.js 16.4.6, React 19.3.1 (versiones comprobadas en npm); SSR Supabase 0.12.7. Paquetes exactos registrados en package-lock.
- Esquema privado alexmar, RLS y acceso únicamente mediante funciones que verifican rol; costo excluido por SQL de las respuestas a ventas/lectura.
- Roles: administrador (todo lo disponible), inventario (catálogo/costos/ajustes), ventas (catálogo sin costo y cuentas), lectura (catálogo sin costos ni cuentas).
- Eliminados preservados inactivos. IDs originales conservados. No enlazar mercancía con movimientos históricos sin relación explícita.
- Importación inicial atómica, solo destino vacío, mismo lote idempotente. No altera el origen.
- Regla de migración aprobada tras comprobar la vista del origen: saldo = CARGO no eliminado − ABONO no eliminado; TITULO no altera saldo. El campo total_adeudado se conserva como procedencia y no genera ajustes ni deuda adicional.
- Preservar los importes completos sin redondear. Migración nueva a numeric sin escala fija; controles de entrada hasta 80 decimales y magnitud menor a 10^16, sin truncar los valores admitidos.

## Propuestas pendientes antes de operar

- Conservación de costo histórico por venta. El costo de catálogo se confirma como último costo recibido en la decisión de compras del 17 de noviembre, sustituyendo la propuesta de promedio ponderado.
- Consumo de materiales de trabajos al confirmar entrega, con evento único compartido con factura.
- El redondeo de futuras operaciones comerciales requiere su propia regla; la migración histórica no redondea.
- Conciliación histórica: regla de la vista verificada localmente y aprobada. Antes de cargar en el proyecto nuevo deben aplicarse las migraciones y revisarse la simulación y sus conteos.
- Corte, respaldo restaurable, reversión y traslado privado de archivos Storage.

## Publicación autorizada

- El propietario autorizó proceder con las dos decisiones de migración y publicar el código. No se publican CSV, datos de clientes ni informes privados. La carga remota sigue el flujo de simulación y confirmación del administrador; publicar código no ejecuta SQL ni importa datos.

## Organización del inventario

- El propietario solicita categorías y filtros personalizados después de confirmar la importación. Se conservan etiquetas originales y se separa la organización por pieza de las menciones de vehículo.
- Las sugerencias textuales no confirman compatibilidad ni años; cada producto admite una corrección auditada que prevalece sobre la sugerencia. Datos ambiguos permanecen Por clasificar/Por identificar, sin ocultarse ni cambiar cantidades o importes.

## Facturación y navegación

- El propietario solicitó facturación, retirar Importación del tablero y poder minimizar categorías/filtros. Confirmó impuesto 0.
- Primera fase de facturación en USD, la moneda del catálogo, sin conversiones automáticas. Borrador/presupuesto no mueve stock ni cuentas; emitir registra cargo, salida de productos y pago inicial en una transacción.
- Descuentos, precios de producto modificados y líneas gratuitas requieren administrador. Ventas puede facturar al precio de catálogo y registrar servicios con precio explícito. Solo administrador anula; para pagos iniciales debe confirmar la reversión o reembolso realizado.
- Importes guardados sin redondeo; el formato visible tiene dos decimales y se muestra también el total exacto. No se define costeo, margen ni integración fiscal en esta fase.

## Actualizaciones posteriores a la carga inicial

- El propietario solicitó volver a mostrar Importar archivos porque se registraron operaciones posteriores en el sistema anterior. Confirmó que solo se trabajó en la aplicación anterior para este corte.
- Mantener la opción visible hasta que el propietario avise que terminó y pida retirarla; no ocultarla automáticamente.
- Actualizar por IDs y comparar la última procedencia con el estado local. Preservar ediciones locales compatibles, bloquear conflictos y archivos incompletos, registrar stock por diferencia y correcciones financieras mediante reversiones sin borrar originales. No sustituir la base ni volver a aplicar aperturas.

## Rediseño y métricas solicitado el 17 de noviembre de 2026

- Tema claro/oscuro seleccionable; rediseño de todas las superficies compartidas, formularios, búsqueda y facturación sin cambiar reglas financieras.
- Navegación visual por marca de vehículo, modelo y piezas. NPR se presenta como familia Isuzu / Chevrolet; no se inventan años ni se certifica ajuste. Ilustraciones propias orientativas.
- Margen potencial del inventario según costos y precios actuales, con cobertura de datos explícita. No se toma como utilidad realizada. Ranking por facturas nuevas separado de cargos históricos migrados. Se respetan los roles de costos y de cuentas.

## Filtros y fotografías de vehículos

- El propietario pide filtros más visuales, poder colocar fotos originales, corregir gráficos y sustituir la A por logo animado; retirar teléfono del logo y centrarlo en acceso.
- Fotos aportadas por administrador en Storage privado. No se descargan fotos sin procedencia ni se representan dibujos como fotos auténticas. Se conserva el control de acceso y la separación entre referencia visual y compatibilidad verificada.
- SQL 009 corrige la dependencia ausente de 008 y no obliga a repetir importaciones. SQL 007 sigue siendo necesario para actualizar el origen desde CSV.

## Referencias visuales generadas por IA

- El propietario autoriza generar las imágenes aquí como alternativa a Higgsfield, que no está disponible en el chat. Veinte referencias uniformes con etiqueta explícita; no se presentan como fotos originales.
- Fotos subidas tienen prioridad. Imágenes estáticas genéricas no modifican la base ni certifican compatibilidades. Los grupos ambiguos quedan pendientes.

## Compras recibidas y cuenta del proveedor · 2026-11-17

- El propietario confirma que queda pendiente el precio de venta y elige último costo recibido, no promedio ponderado. Ejemplo: cinco unidades a 100 suman cinco unidades y 500 de cuenta por pagar.
- Registrar compra y recibir juntos mediante confirmación transaccional. Producto nuevo se crea dentro de esa transacción con venta NULL; producto existente conserva su precio de venta. No se vuelve a abrir el stock del inventario completo.
- Administrador/inventario consultan cuentas y reciben; solo administrador registra pagos y anulaciones protegidas. Facturación existente descuenta del mismo stock. La venta no cancela deuda al proveedor.
- Retirar las etiquetas de IA en fotos, galería y textos de interfaz a solicitud expresa; conservar la procedencia de los recursos en la documentación.

## Facturación y estado operativo confirmado · 2026-11-22

- El propietario continúa exclusivamente en la aplicación anterior; los datos importados son una prueba desactualizada. No considerar corte realizado ni recargar archivos sin revisión. Mantener Importar archivos.
- Referencia visual: capturas de Tierra Santa facilitadas por el propietario, sin modificar ese sistema. Listado de facturas/saldos, búsqueda por primeras letras, precio de venta automático, contado inicialmente y crédito con abono opcional. USD de referencia, impuesto 0; sin conversiones.
- Clientes conservan el historial anterior y las descripciones originales de sus productos separado de las facturas nuevas. No transformar movimientos antiguos en facturas ni cargar dos veces la deuda.
- Documento con logo ALEXMAR sin teléfono y ubicación confirmada Tovar, Mérida, Venezuela; calle/RIF no confirmados no se inventan.
- SQL 011 incorpora cobros posteriores por factura, idempotencia y anulación con reversión de todos los cobros y comprobación de versión. La emisión rápida respeta el precio actual del catálogo. No define costeo ni integración fiscal.

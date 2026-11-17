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
- Costeo promedio ponderado por variante y conservación de costo por venta.
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

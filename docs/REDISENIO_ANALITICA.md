# Diseño y analítica · 17 de noviembre de 2026

La interfaz comparte un sistema de colores, tamaños de controles y superficies en acceso, resumen, inventario, clientes, proveedores, reportes, notas, importación, usuarios y facturación. El botón de sol/luna permite alternar claro/oscuro. Se recuerda por navegador; la primera visita sigue la preferencia del equipo. El logo original se conserva.

## Buscar y facturar

La barra superior busca en todo el inventario por nombre, referencia o vehículo. En inventario el buscador aparece antes de las agrupaciones; permanecen los filtros combinados, consultas guardadas, paginación y Minimizar/Mostrar. La marca del repuesto es independiente de la marca del vehículo.

La facturación separa selección de cliente y piezas del documento, con pasos visibles, búsqueda mientras se escribe, servicios, cantidades, precios autorizados y accesos A crédito/Contado. Contado completa el importe del pago inicial; debe elegirse el método. El monto sigue editable para pagos parciales. Guardar lleva al borrador; emitir conserva el flujo transaccional existente. No se cambian impuesto 0, moneda USD ni permisos comerciales.

## Activar marcas y gráficos

Después de las migraciones anteriores aplica una sola vez, completa, [SQL 008](../supabase/migrations/20261117000800_analitica_vehiculos.sql) en SQL Editor del Supabase nuevo. No repitas importación ni SQL aplicados. Esta actualización agrega consultas de lectura y agrupación; no modifica cantidades, importes ni movimientos.

- Inventario abre por marcas de vehículo y permite pasar a modelos y piezas. Los grupos proceden de las menciones existentes y clasificaciones manuales. Ford incluye Fiesta; NPR/FVR/D-Max quedan en Isuzu / Chevrolet para no atribuir una marca exclusiva a una familia comercializada por ambas. Universales y Por identificar permanecen visibles. No se certifica compatibilidad ni año por texto. Las imágenes son ilustraciones vectoriales propias, orientativas; no son fotos de un modelo/año concreto.
- Resumen y Reportes muestran análisis global del catálogo activo, independiente de sus filtros de detalle. Solo variantes Principal, igual que el catálogo actual.
- Costo, valor de venta y margen potencial usan exactamente el mismo conjunto: productos con ambos valores conocidos, multiplicados por existencia física positiva. La existencia reservada sigue perteneciendo al inventario. Un dato faltante no vale cero; costo explícito cero sí cuenta. Existencias negativas no restan valor y se informan por separado.
- Margen potencial = suma de `(precio − costo) × unidades`. Porcentaje sobre venta = margen / valor de venta × 100. No es recargo sobre costo ni utilidad realizada; no incluye gastos, descuentos o costos históricos de venta. Sin base de venta, el porcentaje queda sin determinar. Los valores se calculan en PostgreSQL `numeric`; solo su formato y dibujo se aproximan para presentación. Los márgenes negativos se conservan y muestran con signo.
- La comparación por categoría permite elegir margen, costo o venta; incluye tabla de importes y porcentajes. El anillo muestra cobertura de costo y precio en los productos activos, no el porcentaje de utilidad.
- Ventas mensuales, facturas, ticket promedio y mejores clientes proceden de facturas confirmadas de esta web, por fecha de emisión. Excluyen anuladas, borradores, presupuestos y cuentas importadas. El rango por defecto incluye el mes actual y los cinco anteriores, hasta hoy; seleccionable hasta 367 días. Los límites incluyen días completos America/Caracas; los meses extremos pueden estar incompletos. El ticket es ventas / cantidad de facturas; sin facturas se muestra Sin ventas.
- La sección desplegable Actividad del sistema anterior clasifica clientes vigentes por cargos activos de la última procedencia migrada (evita volver a contar originales corregidos y sus reversiones) en USD de todo el historial; no usa el rango de ventas. Muestra abonos separados. Se identifica como actividad de cuenta, sin presentarla como ventas verificadas.

## Permisos y disponibilidad

La RPC comprueba perfil activo y rol. Administrador ve ambos análisis; inventario ve costos y margen, sin información financiera de clientes; ventas ve ventas/clientes, sin costos; lectura no recibe ninguno. No se expone el esquema privado ni se amplían permisos directos.

Sin SQL 008 los gráficos muestran activación pendiente, no cifras en cero. El catálogo sigue con categorías/modelos de SQL 005. El administrador ve el enlace de activación. Errores de consulta se muestran; no se sustituyen por datos ficticios.

Pruebas locales con PostgreSQL embebido y navegador usan datos sintéticos. No se aplicó esta migración al Supabase remoto desde el entorno de desarrollo. Los datos de las capturas son de demostración para verificar la interfaz, no cifras del negocio.

# HANDOFF · ALEXMAR

## Corrección de abonos de clientes · 2026-11-26

Solicitado corregir un abono mal cargado conservando original. Desde cliente → Editar abonos, lista paginada de abonos de cuenta, cobros iniciales/posteriores y abonos históricos vigentes. Diálogo monto/método/referencia/motivo, revisar/confirmar, original exacto/actor/fecha y revisiones paginadas. Monto cero permite corregir un registro completamente equivocado; no reasignar titular. Campos permanecen al fallar. Administrativo en página/API/DB; General denegado.

SQL 021 NUEVO: correcciones_abono privada/RLS/auditoría, originales monetarios sin sobrescribir. Compensa solo aplicaciones todavía vigentes, luego aplica importe correcto: cuenta/histórico a deuda sin factura y FIFO, cobro a su factura. Reversiones atribuidas al método previo. Versión/revisión de cuenta+facturas, locks compartidos con origen y operaciones, idempotencia, saldo verificado y rollback íntegro. No duplicar reversiones de facturas anuladas; contado conserva cobro completo. Estado cliente/metricas_generales muestran abonos netos, no cargos comerciales artificiales; ventas/stock sin cambios. Corregir histórico no altera procedencia: trigger bloquea una reversión posterior del origen de un abono corregido para exigir conciliación. Exportaciones/PDF nuevos leen saldo actual; PDFs previos siguen como copias históricas.

Verificación: 51 pruebas de lógica/SQL, tipos/build y recorrido de navegador con componentes/endpoints reales y DB simulada (editar, error sin perder campos, original conservado, saldo, motivos, historial y 1440/390). Casos SQL: precisión, reparto, anulaciones posteriores, cobro dirigido/contado, cero/restauración, método, stale/idempotencia, permisos, paginación y bloqueo del origen. No se escribió ni corrigió dinero real. Ver docs/CORREGIR_ABONOS.md.

El propietario mostró captura de SQL 020 terminado sin error visible con setval=919; resultado esperado, sin comprobación directa remota. Para esta entrega solo aplicar 021 una vez después de 020 y recargar despliegue Listo. No repetir 020 ni reimportar. Código se publica bajo autorización vigente; un push no prueba Vercel Ready. La conciliación pendiente del corte no se da por resuelta y el sistema anterior sigue sin modificaciones.

## Operación diaria simplificada · 2026-11-26

El propietario autorizó implementar el bloque de pendientes recopilado. Ventas y Clientes separados; contado se registra aunque no se abra/imprima factura, conserva documento y cuenta una vez en métricas. Cuenta a crédito mantiene productos/abonos/PDF. Editar datos no reescribe snapshots. Comprobantes pasa a Historial de facturas del cliente; CSV e impresión secundaria en Más opciones y filtros cerrados. Tema icono y sin CTA global Nueva factura. Búsquedas GET con debounce/cursor conservado, fragmentos/tildes y rango aproximado en DB; inventario conserva agrupaciones/filtros plegables sin botones redundantes.

SQL 020 NUEVO después de 019: edición/retirada administrativa con saldos cero y archivos financieros preservados; trigger serializa emisión con retirada de cliente. Eliminar factura usa anulación auditada existente. Movimientos entrada/retiro por delta con reserva/lock/UUID+firma, actor/motivo, antes/después y enlace a venta en kardex. Secuencia de registro en stock con backfill por fecha/ID: no cambia cantidades, preserva desempate histórico. Alta de pendiente con stock físico actual y precio/costo revisados, idempotente y atómica con vínculo; si venta original descontaba, apertura incluye salida ya vendida y luego la descuenta una vez; si no, no descuenta retroactivamente. Duplicado exacto nombre/referencia se rechaza y vínculo existente queda en opción avanzada. Registrar venta desde inventario preselecciona SKU y usa motor común, sin doble ingreso/descuento.

Proveedores: nombre principal, otros datos plegados, sin selector activo/inactivo habitual; retirada con saldo cero. Cargar factura de compra con foto opcional y OCR real Tesseract.js 6.0.1/core 6.1.2/español, worker/WASM/modelo locales (public/ocr con licencias). Reconoce dos disposiciones de tabla; no prometer todos los diseños. Números ambiguos vacíos, líneas omitidas visibles, contraste de total, opciones de catálogo y revisión humana antes de confirmar. Se prepara copia JPEG de hasta 2200px/2MB, no se conserva original a resolución completa. Compra+stock+deuda+foto privada en misma transacción, reintento sin duplicar; acceso foto solo admin actual, RLS/esquema privado, auditoría sin binario. Sin servicios externos ni nuevas claves. Búsqueda manual de compra muestra sugerencias al escribir, evitando lista completa inicial.

Verificación local: 47 pruebas de lógica/SQL aprobadas; tipos/build correctos. Navegadores con sesiones/DB simuladas y componentes/endpoints reales: carga rápida/contado/crédito/PDF/WhatsApp, búsqueda sin Enter y foco conservado, editar/retirar cliente, pendiente directo, movimiento de existencias y venta desde ficha; compras con OCR REAL sobre imagen sintética y foto privada, revisión/pagos/edición/anulación; inventario 1440/390, grupos/filtros/regreso y búsqueda externa al form; accesos/proxy/bloqueo/General e iconos. No operar en base real para probar. Detalles de activación en docs/OPERACION_DIARIA.md. Ventas detecta falta de 020 y conserva listado anterior para no ocultar ventas mientras se aplica.

Publicación de código autorizada por el contexto vigente; push no confirma Vercel Ready. El propietario debe aplicar 020 una sola vez en SQL Editor de Supabase nuevo, después de las migraciones pendientes hasta 019, y recargar despliegue listo. No se ejecutaron SQL, importaciones, limpieza, ventas ni cambios en personas reales desde desarrollo. No se modifica el sistema anterior ni se confirma la conciliación pendiente del corte.

## PDF desde cliente para WhatsApp · 2026-11-23

Solicitado botón Generar factura en cada cliente para enviar PDF. Implementado diálogo con elección de cuenta completa (se titula Estado de cuenta) o factura emitida de ese cliente, con lista paginada; no inventar facturas para cargos históricos ni emitir cargos al exportar. PDF binario real con logo, ubicación, contacto, movimientos/lineas, totales y exactitud; fuentes Open Sans licenciadas embebidas, pdf-lib/fontkit. Snapshot completo de la cuenta en una RPC estable, sin recorte por filtros o página visible. No comparte costos.

SQL 019: tabla privada de PDFs con RLS, token aleatorio 256 bits solo hash SHA256, acceso 7 días/revocación y auditoría de metadatos sin binario/tokenhash en log general. Crear/revocar requiere admin actual; factura individual debe corresponder al cliente y estar emitida. Lector anónimo por token devuelve solo el PDF, sin acceso a cuentas vivas. Ruta /compartir/pdf/ pasa por proxy sin sesión intencionalmente para destinatarios; no abre otras rutas/API. No cache/no referrer/no index. Límite 4 MB sin truncar, sin service role ni bucket público.

Botón WhatsApp prepara mensaje con enlace; el usuario elige chat/envía. Web Share adjunta archivo cuando el dispositivo lo soporta; resto conserva descarga y enlace. No prometer que wa.me puede adjuntar binarios: WhatsApp desktop tiene esa limitación. Desactivar afecta acceso al enlace, no archivos ya recibidos. Copia refleja fecha de generación; preparar otro PDF para saldo actualizado. No se enviaron mensajes reales ni se generaron archivos con datos comerciales reales.

Verificación local: 42 pruebas, tipos/build correctos, PDF multipágina con última fila/saldo comprobados por pdftotext y vista revisada; navegador con API/generador reales y DB simulada verifica enlace, archivo compartido simulado, revocación y factura ajena. Trazado de Vercel incluye logo/fuentes. Activación remota pendiente: SQL 019 una vez y despliegue Listo. No limpiar/importar ni modificar claves Vercel. Ver docs/PDF_WHATSAPP.md. La conciliación del corte anterior continúa pendiente e independiente.

## Carga rápida de 15 filas y contado sin cuenta · 2026-11-23

El propietario confirmó: Nueva factura es contado, sin crear cuenta de cliente, pero todas las facturas permanecen registradas. Agregar cliente a crédito crea cuenta permanente; clientes existentes cargan productos/abonos en su ficha. Tabla de 15 filas, ampliable de cinco en cinco hasta 200, cantidad/nombre/precio editable/importe y total exacto, flechas/Enter; selección de sugerencias con Alt+flechas/Enter. Filas vacías ignoradas e incompletas bloqueadas con número real. Se elimina bloque de Observaciones/descuento/autorizaciones; no borrar datos previos. Borradores existentes conservan editor/valores originales sin ese bloque.

SQL 018 nuevo: ventas.cliente_id nullable solo contado, snapshot de comprador en factura sin crear clientes ni ledger de cuenta para contado. Pago y factura permanecen; buscar_ventas usa LEFT JOIN/snapshot para incluirlas/buscarlas. Métricas de ventas las incluyen, ranking de cuentas no inventa clientes. Emisión usa las reglas previas de precios, métodos, idempotencia y stock; nueva RPC rápida deniega descuentos/gratuidad/observaciones. Cuenta a crédito continúa con ID de cliente y ledger completos.

Productos escritos sin seleccionar catálogo se encolan al emitir; servicios no. Inventario → Productos sin cargar permite completar/vincular SKU existente o crear y luego vincular sin volver a cargar deuda ni cambiar precios/descripciones cobrados. Alta de catálogo independiente explícita. Si venta descontaba stock, vincular requiere y descuenta unidades libres una vez; si no, no descuenta retroactivamente. Anular agrupa y revierte salidas realmente registradas (incluidas vinculaciones) y retira pendientes no resueltos. Tablas privadas/RLS, RPC administrativas y auditoría. IDs de formularios de alta de catálogo ahora son únicos para tarjetas múltiples.

Verificación local: 41 pruebas, tipos/build correctos y navegador actualizado con backend simulado prueban 15/20 filas, flechas, registro/PDF contado sin cuenta, crédito/abono, pendientes y vínculo, permisos y 1440/390. Activación: SQL 018 una vez después de 017 y Vercel Listo; no limpiar ni reimportar. No se escribieron facturas, clientes ni stock reales desde desarrollo. El corte del sistema anterior continúa pendiente de su conciliación, sin cambios. Ver docs/FACTURACION_RAPIDA.md.

## Zelle y Binance · 2026-11-23

El propietario pide agregar ambos métodos. Lista compartida en src/lib/pagos.ts para pago inicial, cobro de factura, abono de cuenta, pago de proveedor y corrección de abono de proveedor. SQL 017 nuevo amplía exclusivamente las listas de métodos de las cinco RPC y el CHECK de pagos_compra. Usa pg_get_functiondef y reemplazo de literal exacto, con guardas de predecesor 016/formato esperado, para conservar intactas las versiones instaladas de lógica financiera, permisos, precio personalizado y stock. Repetir 017 no reejecuta pagos ni cambios de saldo.

Verificación local: 37 pruebas, tipos y build correctos; recorridos de facturación/cuentas y compras con métodos nuevos aprobados a 1440/390, backend simulado. Activación manual tras 016; no limpiar ni reimportar. No se registró dinero ni se aplicó SQL en Supabase remoto. Se conserva la forma de registrar pagos ya realizados, sin conexión a cuentas bancarias, Zelle o Binance.

## Precio editable y crear producto desde cuenta/venta · 2026-11-23

El propietario solicita precio unitario editable para productos del inventario y añadir al catálogo los que falten. Administrativo puede editar el precio en la línea: cantidad × precio editado, sin modificar precio/costo del catálogo. Al repetir selección, aumenta cantidad conservando el precio autorizado. SQL 016 nuevo permite emitir con precio_personalizado explícito solo para administrador; sin esa marca sigue comprobando precio actual del inventario. Marca persistida en líneas y ficha/borrador; firma e idempotencia de emisión se conservan. Stock opcional y autorizaciones de gratuidad no cambian.

Crear producto en inventario dentro del editor conserva cliente/líneas/precios. Alta RPC administrativa, idempotente y auditada, devuelve solo campos de selección. Sin stock ni costo inventados; el alta queda guardada aunque luego no se confirme la venta, como indica el botón. Formulario asociado fuera del formulario de venta mediante portal, para evitar formularios anidados o una emisión accidental. General no crea ni autoriza precios. Ver docs/PRECIOS_PRODUCTOS_VENTA.md.

Verificación local: 36 pruebas, tipos/build correctos y navegador de facturación/cuenta con backend simulado confirma precio editable, cantidad, repetición sin perder precio, alta sin perder líneas ni emitir, cargo con importe editado y 1440/390. Activación: SQL 016 una vez y Vercel Listo; no repetir SQL anteriores ni limpiar/reimportar. No se escribieron productos/precios/ventas en Supabase remoto. El corte pendiente del sistema anterior no se modifica.

## Cuenta continua y eliminar notas · 2026-11-23

El propietario solicita una única cuenta por cliente, filtros minimizados y productos/abonos desde el cliente sin buscarlo ni escoger contado/crédito. La ficha abre estado_cliente completo, indicadores globales de saldo/cargos/abonos, filtros cerrados por defecto y comprobantes secundarios plegados. Se mantienen procedencias y libros contables, sin fabricar facturas históricas. SQL 015 amplía estado_cliente con cantidad/precio original y descripciones de líneas de cargos de factura. Exportación completa y paginación real conservadas.

Cargar productos reutiliza editor/transacción de facturación con cliente fijo, crédito y retorno a la cuenta; conserva reglas de precio, stock opcional, revisión e idempotencia. Registrar abono usa nueva RPC administrativa: saldo esperado, aplicación primero a deuda sin factura y luego comprobantes por antigüedad, pagos de factura mediante cobrar_factura sin duplicar ABONO global, registro privado de aplicaciones y exactitud decimal. Cerrojo compartido con sincronización del origen, cliente/documentos bloqueados, verificación de reducción exacta y transacción completa. No se permiten anticipos/sobreabonos. No se confirma el corte pendiente ni se modifican archivos del sistema anterior.

Verificación: 34 pruebas, tipos y build correctos; recorridos de navegador de facturación/cuenta y notas aprobados, con backend simulado y 1440/390. Notas añade Eliminar nota con diálogo, confirmar/cancelar, activo=false y auditoría. Guardar desde pestaña anterior rechaza una nota eliminada. SQL 015 nuevo, una vez; no repetir 014 ni limpiar/reimportar. No se aplicó SQL ni se operaron cuentas/notas reales desde desarrollo. La comprobación remota de instalación de 014 sigue pendiente del resultado del propietario.

## Hoja de notas, colores y stickers · 2026-11-23

El propietario no encontraba la creación porque estaba debajo de todo el listado. Nueva nota visible en cabecera abre hoja propia (`/notas?nueva=1`); cada tarjeta permite Abrir y editar conservando página/ID. Título y contenido con color, resaltado, negrita/cursiva/subrayado, deshacer/rehacer y ocho stickers incluidos, insertados en cursor. Hoja clara legible en ambos temas, herramientas adaptables y errores que conservan contenido. Cambios solo se guardan al pulsar Guardar; no hay caché privada ni autosave. Advertencia al cerrar/recargar y al volver desde la hoja.

Sin SQL nuevo. Formato de fragmentos JSON dentro de contenido usando guardar_nota/listar_notas existentes. Texto importado se conserva literal hasta editarlo; no interpretar HTML. Render React con paleta permitida, pegado de solo texto, límites 50.000 caracteres/3000 fragmentos y título 200. Página/acción exigen administrador y DB mantiene exigir administrador. General no accede. IDs estables permiten reintentar/editar sin duplicar.

Verificación: 32 pruebas, tipos y build correctos; navegador real con backend simulado confirma formato persistido, edición sin duplicados, error sin pérdida, pegado seguro, permisos y 1440/390 en ambos temas. Ver docs/NOTAS.md. No se escribieron notas remotas, no se limpió ni reimportó. La consulta sobre instalación completa de SQL 014 sigue pendiente del resultado remoto; esta entrega de Notas no depende de 014. El corte de abonos del sistema anterior también sigue pendiente, sin cambios.

## Edición de órdenes y abonos de proveedor · 2026-11-23

El propietario creó proveedor/abono de prueba y solicita editar órdenes para corregir importes y abonos o eliminarlas. SQL 014 nuevo incorpora edición de cantidades/costos, referencia/observaciones, corrección/anulación de pagos y anulación integral de orden con abonos. No borrar documentos financieros: quedan anulados y auditados. Reintegros reales se resuelven fuera de la aplicación y se reconocen explícitamente; la prueba sin desembolso también está contemplada. Desactivar proveedor sigue disponible; no borra saldo ni comprobantes.

Solo administrador en servidor/DB. Versiones con incremento por abono y edición, bloqueo de orden/variantes, dinero exacto, stock por diferencia y restauración del costo previo al anular. No alterar cantidades/costos de mercancía con operaciones posteriores; referencia/observaciones siguen editables. Total nunca inferior a pagos vigentes. SQL 014 reemplaza consultas de pago/saldo para excluir abonos anulados, conserva paginación/historial y revoca llamada pública a la anulación antigua sin versión. Nuevas funciones transaccionales: fallo de stock revierte también anulaciones de abonos. La UI conserva campos ante errores con envío manual a acciones React, evitando el reinicio automático de formularios.

Verificación local: 29 pruebas, tipos y build correctos; navegador con acciones reales/DB simulada verifica edición, errores sin perder campos, abonos, anulación y 1440/390 px. Activación remota pendiente: propietario aplica SQL 014 una vez tras 013, en Supabase nuevo y recarga el despliegue listo. No se modificó Supabase remoto, ni se anuló su prueba, ni se limpió/reimportó nada desde desarrollo. Sigue pendiente la aclaración de abonos del corte del sistema anterior. Ver docs/EDITAR_ORDENES_PROVEEDORES.md.

## Separación de accesos y escritorio · 2026-11-23

El propietario reclamó que la separación confirmada como idea no estaba implementada. Ahora se implementa con SQL 013 nuevo: administrador completo y lectura como General, exclusivamente catálogo de precios. Los perfiles previos ventas/inventario pasan a lectura; no elevarlos a administrador ni mantener puertas de gestión heredadas para generales. SQL privado/RLS, roles consultados en DB en cada operación y proxy/servidor para rutas/API. General usa /consulta; no devuelve costos, stock, cuentas, métricas ni usuarios. Dos entradas visibles con contraseña Supabase Auth; elegir el portal no cambia el rol.

Configuración gestiona clasificación/activación de personas, bloqueo general con versión y entradas paginadas por persona. Bloqueo deniega las consultas aun con JWT anterior; vistas comprueban cada diez segundos y al recuperar foco, redirigen si cambia permiso/inactivo o cubren la pantalla si falta conexión. Administrativos siguen operando. Registro por session_id real del JWT y resultado, sin contraseña/token. La cuenta propia de administrador no se degrada ni desactiva desde la interfaz.

El propietario solicitó una cuenta general específica y aportó una contraseña en el chat. **No copiar esos datos a código, SQL, fixtures, documentación pública ni commits. No afirmar que la cuenta esté creada:** aquí no existen URL/credenciales administrativas de Supabase. El entorno de trabajo volvió a estar disponible; el estado anterior no indicó causa y no demuestra caída de la web.

Crear usuario desde Configuración usa la API administrativa de Auth solo si SUPABASE*SERVICE_ROLE_KEY está en Vercel (nunca NEXT_PUBLIC* ni compartida en chat). La ruta exige administrador/SQL 013 y asigna perfil con JWT del administrador; revierte únicamente la identidad recién creada si no puede asignarla. Sin clave de servicio, crear identidad manual en Authentication y asignar UUID/perfil en el panel. Login por usuario normalizado usa un correo interno @accesos.alexmar.invalid; correo administrativo existente sigue válido. Detalles en docs/ACCESOS_PERSONAL.md.

Manifiesto de instalación e iconos PNG 192/512/180 renderizan el logo existente, accesibles sin sesión. No hay caché de datos ni modo offline. Los accesos de escritorio antiguos pueden requerir quitarse y crearse de nuevo para renovar el icono.

Pendiente remoto: aplicar SQL 013 una vez después de 012, comprobar Vercel Ready, configurar creación de identidades o usar Authentication y registrar la cuenta solicitada. No se aplicó SQL ni se crearon usuarios reales desde desarrollo. No limpiar ni reimportar para esta entrega. La conciliación del corte del 23 sigue pendiente de aclarar los abonos esperados: la revisión privada de archivos nuevos detectó cargos/títulos y no abonos adicionales; no confirmar esa actualización sin verificar el caso indicado por el propietario.

## Importación terminada; stock opcional y rendimiento · 2026-11-22

**Estado actual confirmado por el propietario:** limpieza ejecutada con resultado de ceros y administrador conservado; SQL 007 faltaba entonces. Después adjuntó exportaciones recientes, se validaron de forma privada/local y ahora confirma **ya está importado**. No repetir la limpieza ni la importación. La anterior referencia a datos de prueba desactualizados es histórica. No se consultó ni escribió Supabase remoto desde desarrollo.

Solicitud nueva: anulación visible, vender mientras hace el inventario, interruptor para descontar después, logo en pestaña y sustitución del hero del resumen por tendencias semanales/diarias. SQL 012 nuevo deja descuento apagado. Configuración → Inventario al facturar permite activarlo solo al administrador. Cada factura conserva el modo de emisión; apagar permite vender sin existencias y sin movimientos de salida. Activar comprueba físico menos reservas y descuenta. No hay descuento retroactivo de las ventas emitidas mientras estuvo apagado. Compras siguen sumando stock. Anular solo devuelve salidas realmente registradas; no fabrica stock para facturas sin descuento. Facturas anteriores preservan su comportamiento. Ver docs/STOCK_Y_RENDIMIENTO.md.

Anular en listado/ficha, con diálogo, motivo, versión y reconocimiento del reembolso de cobros; rol administrador. Cuenta/cobros quedan auditados. El logo existente es el favicon con URL nueva; no se generan nuevas imágenes. Panel y menú Rendimiento reemplazan el hero; tarjetas de hoy, semana y variación al mismo día/hora de semana previa, 14 días y 8 semanas, selección/tabla accesible, claro/oscuro y móvil. Solo facturas confirmadas de la web en USD; no confundir deuda importada con ventas. Se conservan analítica y accesos anteriores.

El propietario debe aplicar SQL 012 completo una vez después de 011 y comprobar Vercel Ready. No se ejecutó SQL remoto ni se probó facturando sobre su base. La utilidad de limpieza v1 queda como recuperación histórica de la entrega anterior, limitada al esquema hasta 011: no ejecutarla después de 012 ni adaptarla para saltar sus guardas. Mantener Importar archivos hasta instrucción expresa de retirarlo.

## Reinicio autorizado de los datos de prueba · 2026-11-22

El propietario confirma SQL 011 instalado y solicita expresamente **HAGAMOS LA LIMPIEZA**, después de acordar descartar la importación/operaciones de prueba y cargar de cero los cuatro CSV recientes. Para este reinicio sustituye la recomendación anterior de actualizar por diferencias. El origen sigue siendo la aplicación de trabajo; no tocarlo. No afirmar que el borrado remoto ocurrió: no hay conector ni credenciales administrativos de Supabase en este entorno.

Se entregan utilidades manuales versionadas en supabase/utilidades: limpiar_pruebas_con_respaldo_v1.sql y restaurar_respaldo_pruebas_v1.sql. No son migraciones ni RPC; publicar no las ejecuta. La primera respalda todas las tablas alexmar dentro del esquema privado alexmar_respaldo_pruebas_20261122_v1 y vacía la lista explícita de datos comerciales (también lotes/procedencia, compras, proveedores y clasificaciones por producto), conserva Auth/perfiles/consultas/fotos/Storage/auditoría y reinicia numeración de prueba. Copia y limpieza en transacción, bloqueo de importador/tablas, sin CASCADE, guardas de alcance y de ejecución única. La segunda restaura solo con el destino aún vacío, verifica filas/decimales/columnas y recupera numeración sin pisar nuevas cargas. Copia protegida por RLS/revocación; nunca publicar datos del respaldo. No reemplaza un backup externo del proyecto.

**Corrección importante sobre 007:** la pantalla actual de Importar archivos exige estado_importacion incluso para una carga inicial; el resultado del reinicio indica sql_007_instalado. Si falta, ejecutar 007 completo una sola vez antes de abrir el importador. La utilidad de limpieza funciona con o sin 007/010 y rechaza 007 parcial. No repetir 001–006 ni 011. Tras limpiar y comprobar ceros, importar los cuatro CSV recientes como Primera carga del historial, analizar, conciliar y confirmar. Conservar el respaldo privado. Ver docs/LIMPIEZA_PRUEBAS.md.

Pruebas específicas locales: dos recorridos Postgres con datos sintéticos, restauración exacta de facturas/cobros/compras/revisiones/columnas generadas, preservación de configuración/Auth/Storage y bloqueo de copias para roles web. Fallos por FK ajena/tablas nuevas/007 parcial revierten; repetir limpieza o restaurar después de reimportar no borra la carga nueva. Nueva carga permite stock y deuda exactos sin duplicar. Ver docs/PRUEBAS.md para resultado general.

## Facturación y situación real confirmada · 2026-11-22

**Estado vigente:** el propietario sigue operando exclusivamente en la aplicación anterior. La importación realizada fue una prueba y está desactualizada. No considerar el corte realizado ni activar una carga automáticamente. Mantener Importar archivos hasta aviso. Los apartados históricos inferiores que daban por terminada la carga describen entregas previas, no un corte definitivo.

Referencia: capturas de Tierra Santa suministradas por el propietario; no se modifica ese sistema. Nueva facturación con lista de documentos, filtros por estado/cobro/fechas, búsqueda por número/cliente/producto y totales globales paginados. Editor compacto con sugerencias iniciales precargadas sin costos, búsqueda de todo el catálogo por palabras, teclado, caché pequeña por consulta y cliente nuevo sin perder líneas. Precio de venta automático, contado inicialmente (cobro sigue el total), crédito/abono, borrador y revisión antes de emisión directa atómica. USD/impuesto 0.

SQL 011 nuevo: mantiene las RPC existentes, agrega emisión directa con idempotencia, pagos posteriores por factura y anulación con reversión de todos los cobros/versión revisada; los cobros no mueven stock. Cantidad 4 × precio 80 permite cobros exactos de hasta 84 decimales. Historial anterior independiente de SQL 007, con descripciones, cantidad/precio original, correcciones y exportación completa sin costos. Clientes presentan histórico, facturas nuevas y cuenta completa, sin fabricar facturas ni duplicar deuda.

Vista previa e impresión comparten documento con logo sin teléfono y ubicación confirmada Tovar, Mérida, Venezuela. No inventar calle ni RIF. Permisos administrador/ventas en servidor/API/DB y esquema privado intactos. Documentación vigente: docs/FACTURACION.md. El propietario aplica SQL 011 completo una vez en Supabase NUEVO; no repetir anteriores ni reimportar para instalarlo. No se ha aplicado SQL ni emitido ventas/cobros sobre producción desde este entorno; tampoco se ha verificado un despliegue remoto Ready.

Pruebas locales: 21 pruebas SQL/lógica aprobadas, tipos y compilación correctos. SQL real PGlite sin 007 comprueba reintentos, falta de stock, precio cambiado, contado/crédito, cobros, sobrepago, anulación, fecha Caracas, precisión 84 y 35 facturas en dos páginas; historial original/correcciones separado. Navegador con backend simulado: selección por teclado, cliente nuevo, precio automático, borrador, emisión directa revisada, cobro, historia separada, HTML escapado, claro/oscuro y 1440/390. Regresión de inventario/fotos/gráficos y nuevo editor aprobada. Ver docs/PRUEBAS.md.

Pendientes: aplicar 011 remoto y comprobar Vercel Ready; terminar ajustes antes del corte; exportación reciente de cuatro CSV y actualización por diferencias con 007, respaldo y conciliación antes de operar. Cobros a deuda anterior, anticipos, devoluciones parciales, otras monedas, fiscal y costo histórico por venta siguen pendientes. No declarar terminado todo el sistema.

## Compras y recepciones de proveedores · 2026-11-17

El propietario pide registrar lo que trae un proveedor, sumar existencias y generar la deuda automáticamente. Confirma que queda pendiente el precio de venta, y elige último costo recibido (no promedio ponderado). SQL 010 nuevo agrega compras/líneas/pagos privados, RLS/auditoría, idempotencia y bloqueo de variantes en orden compatible con ventas. Compra y recepción se confirman juntas: 5×100 → +5 unidades y USD 500 de deuda. Nuevo producto dentro de la misma transacción, con precio de venta NULL; existente conserva su precio. Se guarda el costo histórico de recepción y se actualiza el costo de catálogo.

Proveedores → ficha con cuenta/productos/recepciones → Recibir mercancía → revisar → confirmar. Comprobante con tarea visible de poner precio de venta, pagos parciales/completos (administrador), impresión y anulación protegida. Administrador/inventario reciben y consultan; ventas/lectura no acceden. La facturación existente descuenta el stock común; no se reduce la deuda del proveedor al vender. Paginación real de compras, productos y pagos; sumas globales independientes de la página. No hay transferencias bancarias automáticas, anticipos, devoluciones ni pedidos pendientes de recibir en esta fase. Ver docs/COMPRAS_RECEPCIONES.md.

Verificación local: 20 pruebas aprobadas, tipos y compilación, incluido recorrido 5×100, factura con descuento de stock, pagos parciales, reintentos, permisos, anulación, decimales exactos y paginación. Navegador con DB simulada prueba selección/creación, revisión/confirmación, precio de venta directo y 1440/390. Ver docs/PRUEBAS.md.

El propietario aplica SQL 010 completo una vez en el Supabase nuevo, sin reimportar. No se aplicó SQL ni se hicieron compras/pagos/ventas sobre datos reales desde este entorno. Mantener Importar archivos hasta aviso, como antes.

Se retiraron los rótulos Referencia IA de las fotos y de la galería, y la mención de IA en los textos de interfaz; no se presentan como fotos auténticas del negocio. La procedencia de generación permanece documentada. Prioridad de fotos propias y reglas de compatibilidad intactas.

## Imágenes generadas por vehículo · 2026-11-17

El propietario pidió Higgsfield y eligió expresamente generar aquí cuando se comprobó que no hay conector ni acceso al sitio. Se crearon 20 referencias de vehículos (PNG 1536×1024, cada una menor de 3 MB), en public/vehiculos. Apariencia uniforme de estudio, vehículos plateados/cabinas claras. La foto propia subida tiene prioridad; el recurso generado es alternativa y se identifica como Referencia IA, con modelo de ejemplo si la tarjeta es una marca. No se escriben fotos a Supabase ni se modifican datos, clasificaciones o compatibilidades. No necesita SQL adicional.

Pruebas: 17 pruebas, tipos y compilación aprobados. Navegador comprueba prioridad de foto propia, carga de las 20 imágenes y enlaces de descarga. Revisión visual de toda la galería.

Galería privada /inventario/imagenes con descarga individual. Cargo, 1721, 815 y Caribe pendientes de identificar. No inferir fabricante ni años con esos nombres. Los estilos representados son ejemplos, no generaciones confirmadas del inventario. La selección usa la exportación local histórica, no una consulta de la base actual. Detalles y archivos en docs/IMAGENES_GENERADAS.md.

## Ajuste visual y reparación de gráficos · 2026-11-17

El propietario rechazó los desplegables principales y solicitó fotos originales, logo animado sin teléfono y acceso centrado. Filtros principales convertidos a tarjetas/radios con iconos y aplicación de un clic; filtros técnicos siguen en Más filtros. Se conserva búsqueda, paginación, filtros guardados y plegado. Las tarjetas de marca/modelo permiten al administrador añadir/cambiar una foto original. Sin foto se indica pendiente: no se simula una fotografía con SVG. Fotos en bucket privado, URL firmada, validación de origen/sesión/rol/formato/tamaño y RLS. Ninguna foto original de vehículo fue suministrada todavía.

Se reprodujo el error de la captura: SQL 008 depende de `procedencia_actual` (007), ausente en la base del propietario. SQL 009 nuevo reemplaza la RPC sin esa dependencia, conservando métricas separadas y excluyendo originales revertidos. Agrega además metadatos/bucket/permisos de fotos. No editar ni repetir 008; el propietario aplica 009 completo una vez. No se ejecutó SQL remoto desde este entorno. Ver docs/FOTOS_Y_FILTROS.md.

Validación de esta actualización: 17 pruebas SQL/lógica aprobadas, tipos y compilación aprobados, incluido el estado sin 007 y las políticas de Storage; navegador con sesión/Storage simulados verifica selección visual, subida/API/refresco, acceso, logo y movimiento reducido a 1440/390.

Logo editado con imagegen para retirar solo la línea telefónica y mantener transparencia, nombre, mascota y localidad; archivo nuevo para evitar caché de la imagen anterior. Acceso centrado, tablero con logo real y entrada animada breve, estática con movimiento reducido; impresión comparte logo sin teléfono. Se conserva Importar archivos hasta aviso.

## Herramienta de diseño instalada · 2026-11-17

Por solicitud del propietario se instaló UI UX Pro Max para Codex en `.agents/skills/ui-ux-pro-max/`, usando el paquete oficial `ui-ux-pro-max-cli@2.15.0` del proyecto https://github.com/nextlevelbuilder/ui-ux-pro-max-skill. El instalador incluye también las habilidades auxiliares `design-system` y `slides`. Instalación local al repositorio; no modifica dependencias de la aplicación ni publica la web. Se verificó la búsqueda local con Python 3.12 mediante `search.py 'table keyboard navigation' --domain ux -n 1`, con resultado correcto. Consultar su SKILL.md para próximos trabajos de interfaz, respetando las reglas de ALEXMAR.

## Rediseño visual y analítica · 2026-11-17

Se aplica UI UX Pro Max con adaptación a la marca existente: sistema de tokens claro/oscuro, preferencia por navegador, búsqueda global, formularios/tablas adaptables y editor de factura en dos columnas con pasos y atajos de pago. Inventario abre por marca de vehículo (si SQL 008 está disponible), luego modelos y piezas con ilustraciones SVG propias. Marca del repuesto permanece independiente. Se conservan búsqueda, paginación, filtros guardados y plegado.

SQL 008 es nuevo: amplía la agrupación y añade `analitica_comercial`, solo lectura, con costo/margen para administrador/inventario y ventas/clientes para administrador/ventas. Margen potencial sobre existencia física positiva y pares completos costo/precio; no utilidad realizada. Ventas nuevas excluyen historia importada, anulaciones y presupuestos; actividad histórica aparece separada y etiquetada. Ver docs/REDISENIO_ANALITICA.md para fórmulas, fechas, límites y activación. No se modifican migraciones anteriores, datos reales ni reglas financieras. Mantener Importar archivos hasta aviso del propietario.

Pruebas locales: 15 pruebas SQL/lógica aprobadas, tipos y compilación aprobados. Navegador con datos sintéticos: temas persistentes y gráficos, navegación marca/modelo/pieza, filtros y plegado, y facturación revisada antes de emitir; 1440/390 sin desbordamiento. Ver docs/PRUEBAS.md.

La migración remota 008 queda a cargo del administrador en SQL Editor. La publicación del código no aplica SQL ni realiza una importación. No confundir las capturas sintéticas con métricas verificadas de la base del negocio.

## Estado vigente para esta publicación

El propietario pidió restablecer Importar archivos temporalmente para incorporar operaciones posteriores registradas solo en la aplicación anterior. La carga inicial ya se completó y no se debe repetir. Se incorpora actualización por diferencias con SQL 007, revisión e idempotencia. Mantener visible hasta que el propietario avise que terminó y solicite retirarlo; ver docs/ACTUALIZAR_ORIGEN.md.

Última actualización: 2026-11-17 (America/Caracas).
Destino: continuación del proyecto en Codex.
Repositorio: https://github.com/samerbilalsangronis-netizen/ALEXMAR
Rama de trabajo: `main`. El propietario prefiere cambios probados directamente en esta rama.
Commit de implementación de la entrega 1: `5c140917a861f9d819f38b4fae5ecf514f2ef5fa`.

## 1. Por dónde quedamos

Se creó y publicó la primera entrega sobre un repositorio inicialmente vacío. Es una base funcional por fases; **el sistema completo todavía no está terminado**.

El propietario continuará en Codex y pidió actualizar este HANDOFF. Su objetivo sigue siendo construir el sistema definido en `docs/ALCANCE.md`, no detenerse en la primera entrega.

En esta sesión no se conectó un Supabase nuevo, no se aplicó SQL a una base real, no se importaron datos reales y no se realizó despliegue en Vercel. El propietario podría hacerlo después: verificar su estado actual antes de asumir que sigue pendiente.

**Actualización importante sobre saldos:** los 108 clientes vigentes del CSV tienen `total_adeudado = 0`. Las 104 discrepancias detectadas surgen al comparar ese campo en cero con el cálculo de cargos menos abonos. **No está demostrado que existan 104 cuentas incorrectas.** Ver §5: este hallazgo matiza las referencias anteriores a discrepancias en README.md y DECISIONES.md.

## 2. Instrucciones y decisiones confirmadas

- Trabajar solo en ALEXMAR. No modificar Tierra Santa, la aplicación anterior de Alexmar ni sus bases.
- Supabase NUEVO e independiente. El propietario colocará las variables de entorno.
- Desplegar en otra cuenta de Vercel, con otro correo, manteniendo el repositorio en el GitHub actual. No copiar ni transferir el repositorio sin necesidad o nueva instrucción.
- La integración y permisos de GitHub en el Vercel de destino todavía deben comprobarse. No desconectar integraciones existentes a ciegas ni asegurar que el enlace ya funciona.
- Todo el dinero histórico recibido está en USD, confirmado expresamente por el propietario.
- Solo hay datos disponibles en inventario, clientes, detalle_cuentas y notas. El propietario indicó que lo demás está vacío.
- Español, interfaz sencilla para PC y teléfono. El propietario trabaja desde navegador: no pedirle terminal, Docker ni instalaciones.
- Nunca publicar CSV comerciales, datos de clientes, exportaciones o credenciales en el repositorio público.
- Migraciones nuevas y versionadas: no reescribir las que ya se hayan aplicado.
- Leer AGENTS.md, README.md, DECISIONES.md y docs/ALCANCE.md antes de continuar.

## 3. Qué está implementado

- Next.js 16.4.6, React 19.3.1, TypeScript estricto, Supabase SSR 0.12.7. Versiones de instalación registradas en package-lock.json.
- Login y cierre de sesión, renovación de sesión mediante proxy, navegación privada.
- Roles administrador, ventas, inventario y lectura; perfiles activos/inactivos.
- Esquema privado `alexmar`, RLS habilitado y sin acceso directo a tablas desde anon/authenticated. RPC públicas verifican usuario y rol. Costos excluidos por SQL para ventas y lectura.
- Catálogo paginado en servidor, búsqueda sin tildes y en cualquier orden, aproximaciones señaladas, referencia exacta priorizada.
- Filtros de categoría, marca, vehículo, año estructurado, precio, ubicación, existencias y estado. Orden, filtros en URL y consultas guardadas por usuario.
- Ficha editable, precio opcional, ajustes con motivo/responsable, bloqueo concurrente e idempotencia; kardex paginado.
- Clientes y estados de cuenta históricos por moneda, fechas America/Caracas, saldo anterior y final sobre todos los movimientos del filtro.
- Exportación CSV de todo el estado de cuenta y HTML completo para imprimir/guardar PDF.
- Notas privadas del administrador, asignación de perfiles.
- Importación inicial de cuatro CSV con simulación, validación, conciliación, transacción, datos originales e idempotencia. Solo admite destino vacío. Actualmente bloquea diferencias de saldo y pérdidas de precisión.

No hay aún ventas nuevas, compras, pagos nuevos, presupuestos, devoluciones, trabajos, nómina, gastos ni reportes avanzados. No presentar estos módulos como implementados.

## 4. Archivos y rutas para continuar

| Área                              | Archivos                                                                |
| --------------------------------- | ----------------------------------------------------------------------- |
| Alcance completo                  | `docs/ALCANCE.md`                                                       |
| Instalación y límites             | `README.md`                                                             |
| Reglas                            | `AGENTS.md`, `DECISIONES.md`                                            |
| Base nueva                        | `supabase/migrations/20261115000100_base_catalogo_historial.sql`        |
| Primer administrador              | `supabase/utilidades/crear_administrador.sql`                           |
| Inspección de origen sin escribir | `supabase/utilidades/inspeccionar_origen_solo_lectura.sql`              |
| Sesión y consultas                | `src/lib/supabase.ts`, `src/proxy.ts`                                   |
| Escrituras de formularios         | `src/app/actions.ts`                                                    |
| Analizador de migración           | `src/lib/migracion.ts`                                                  |
| API de migración                  | `src/app/api/migracion/route.ts`                                        |
| Pantalla de simulación            | `src/components/importador.tsx`, `src/app/(privado)/migracion/page.tsx` |
| Exportación histórica             | `src/app/api/exportar/route.ts`                                         |
| Pruebas y resultados              | `tests/base.test.ts`, `tests/migracion.test.ts`, `docs/PRUEBAS.md`      |

Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (alternativa admitida: `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Esta entrega no requiere clave de servicio.

## 5. Migración: hallazgos y corrección de interpretación

### Archivos recibidos, privados y fuera de git

| Archivo                  | Total | Vigentes | Eliminados |
| ------------------------ | ----: | -------: | ---------: |
| inventario_rows.csv      |   910 |      848 |         62 |
| clientes_rows.csv        |   163 |      108 |         55 |
| detalle_cuentas_rows.csv | 3.637 |    2.737 |        900 |
| notas_rows.csv           |    77 |       12 |         65 |

También se recibió `Supabase Snippet Untitled query (1).csv`: estructura de 132 columnas entre 14 tablas/vistas. El primer CSV de estructura tenía solo 100 filas y estaba truncado; usar el segundo.

Los adjuntos no están incluidos en este repositorio. Si no llegan al nuevo entorno de Codex, pedir al propietario que adjunte las exportaciones; no fingir que están disponibles ni buscarlas en el repositorio público.

### Inventario e historial

- No se encontraron IDs duplicados ni movimientos con cliente inexistente.
- Ningún movimiento de detalle_cuentas tiene id_producto vinculado. Conservar el texto histórico sin enlazar productos por parecido de nombre.
- Productos vigentes: 937 unidades físicas; 211 productos con stock; 110 sin precio y uno con precio cero; 476 sin costo.
- Hay ocho nombres de producto repetidos. No fusionarlos automáticamente.
- Los eliminados conservan 44 unidades de stock; preservarlos inactivos para revisión, no activarlos automáticamente.
- La existencia migrada es un movimiento de apertura. El historial anterior NO debe volver a descontar stock.
- Fotos/URLs originales se conservan en los datos de procedencia; la copia de Storage y visualización de fotos aún no está implementada.
- Las compatibilidades son texto libre del origen. No inferir vehículos, generaciones ni años; falta normalización y editor estructurado.

### Qué significan realmente las 104 diferencias

Revisión posterior a la entrega:

1. Los **108 clientes vigentes tienen total_adeudado en cero**.
2. En 104 de ellos, cargos vigentes menos abonos vigentes da un valor distinto de cero.
3. Por eso la comparación automática señala 104 diferencias. No demuestra por sí sola que el historial o la deuda mostrada en el sistema anterior sean incorrectos.
4. Hipótesis: el campo total_adeudado puede estar sin uso/desactualizado y el sistema anterior podría calcular la deuda mediante vista o movimientos. **Esto aún no está confirmado.**
5. Se explicó al propietario que se puede dejar de usar ese campo como criterio de conciliación si se comprueba la regla real. No se propuso eliminar cargos, abonos o deudas.
6. Última pregunta pendiente: si el sistema anterior muestra deuda en esos clientes pese a que ese campo exportado está en cero. El propietario no respondió esa pregunta: indicó que seguirá en Codex.

Regla propuesta: saldo = suma de CARGO no eliminados − suma de ABONO no eliminados; TITULO no altera saldo. Confirmar que coincide con el sistema anterior (definición de vista_saldos_clientes y/o dos o tres cuentas conocidas) antes de cambiar la validación.

**El código actual sigue bloqueando esta comparación.** La petición de actualizar el HANDOFF no autoriza a afirmar que se resolvió ni que se aprobó el cálculo. Si se confirma que total_adeudado no se usa, conservarlo como dato original y sustituir únicamente su papel de validación por una conciliación fiable. Cambiar tanto `analizar` en TypeScript como `public.importar_inicial` mediante una migración nueva; añadir pruebas y actualizar la documentación.

### Precisión: problema independiente

Hay números exportados con más de cuatro decimales, algunos con apariencia de residuos de coma flotante. El importador también los bloquea para no alterar importes silenciosamente. Preservar el texto original. La propuesta de cuatro decimales operativos requiere definir el tratamiento y verificar su impacto; no se ha aprobado ni aplicado un redondeo general.

### Secuencia de migración pendiente

- Verificar conteos de origen y definiciones mediante consultas de lectura (utilidad SQL ya preparada).
- Aclarar la regla de saldos y la precisión.
- Ajustar validación y RPC con pruebas; no editar el CSV para forzar coincidencias.
- Simular e importar primero en base de prueba, comprobar IDs, registros, stock y cuentas.
- Definir respaldo restaurable, reversión, fecha de corte y operaciones nuevas del origen.
- Presentar conciliación y procedimiento antes del paso final a producción.
- No ejecutar escrituras de prueba en la base anterior ni publicar información comercial.

## 6. Pruebas realizadas y límites

Sobre el commit de implementación:

- `npm run typecheck`: correcto.
- `npm run build`: correcto, incluso sin variables del Supabase nuevo.
- `npm test`: cinco pruebas aprobadas.
- PGlite con extensiones reales unaccent/pg_trgm: instalación SQL, búsqueda, permisos, costo oculto a ventas, ajuste idempotente y acceso directo bloqueado.
- Estado de cuenta con 1.051 movimientos: última página accesible y totales sobre el historial completo.
- Importación sintética: bloqueo de discrepancias, carga correcta, repetición sin duplicados y rechazo de segunda carga distinta sobre destino con datos.
- CSV: encabezados, comas entrecomilladas, referencias rotas, duplicados, negativos y precisión.
- Ninguna prueba escribió en una base real.

**No se realizó verificación visual completa.** Chromium no pudo arrancar por restricciones del entorno (socket no permitido). Pendiente revisar PC/teléfono, flujo autenticado, Supabase/PostgREST real y Vercel. PGlite no sustituye la prueba final del proyecto nuevo.

Esta actualización del HANDOFF modifica documentación únicamente; no cambia código, SQL, reglas ni datos.

## 7. Trabajo siguiente

Continuar sin rehacer lo implementado:

1. Comprobar situación del Supabase/Vercel nuevo y leer alcance/documentación.
2. Completar catálogo: variantes, unidades, compatibilidades estructuradas, proveedores, fotos, sugerencias con teclado y filtros restantes.
3. Compras/recepciones/cuentas por pagar; ventas de productos y servicios, presupuestos, pagos y aplicaciones, devoluciones/anulaciones transaccionales.
4. Trabajos/reservas; nómina por pagos y adelantos; gastos.
5. Reportes y Excel nativo, pruebas de concurrencia y restauración.
6. Resolver migración en paralelo a lo anterior; el campo en cero no debe bloquear el desarrollo independiente.

Propuestas no confirmadas: costo promedio ponderado por variante con costo histórico de venta; consumo de materiales al entregar trabajo mediante evento único compartido con factura; precisión operativa de cuatro decimales.

Documentar avances y mantener este HANDOFF actualizado. No declarar listo para operar hasta completar las funciones y criterios de aceptación del prompt maestro.

## Continuaciones en este entorno (registro cronológico; ver última actualización)

## Continuación: compatibilidades verificadas (2026-11-15)

- Ficha de inventario: consulta paginada, alta, edición y eliminación confirmada de marca/modelo, rango de años o universal. Administrador/inventario editan; ventas/lectura consultan. Las acciones comprueban rol y las RPC repiten la autorización. Se conserva la búsqueda de retorno y ambas paginaciones.
- Nueva migración `20261115000200_compatibilidades.sql`; no se modificó la base. Aprovecha RLS y auditoría existentes; valida rangos, duplicados normalizados y pertenencia al producto.
- Corregido filtro combinado de vehículo/año: ambos deben corresponder a la misma compatibilidad. Una compatibilidad sin ningún año conocido no confirma años concretos; el texto histórico sigue separado.
- Ver `docs/COMPATIBILIDADES.md` para aplicación desde SQL Editor. No aplicada a Supabase remoto ni publicada en GitHub desde esta continuación.
- Pruebas: 6 correctas, tipos y build correctos. Nueva cobertura de permisos, usuario inactivo, anon, CRUD, auditoría y última página de 1.051 compatibilidades. Sin revisión visual autenticada ni prueba de Supabase real.
- Siguiente bloque del catálogo: variantes con precio y existencia independientes, unidades y proveedores; después compras/ventas. Siguen pendientes las decisiones de costeo y conciliación histórica de DECISIONES.md.

## Continuación: identidad, proveedores y reportes (2026-11-15)

- El propietario confirmó despliegue en alexmar.vercel.app y creación del administrador. Compartió un CSV con presencia del índice y las tres RPC de compatibilidades; no constituye validación funcional remota completa.
- Logo recibido, preparado como PNG transparente en public/logo-alexmar.png e integrado en acceso y navegación. Interfaz naranja/grafito, navegación con ruta activa y mejoras de legibilidad/móvil. Los cambios anteriores se conservaron.
- Directorio real de proveedores (roles administrador/inventario), filtros, edición, desactivación y auditoría. Nueva migración 20261115000300_proveedores_reportes.sql; no se ejecutó remotamente.
- Reportes: métricas del catálogo activo; cuentas históricas separadas por moneda y rol; inventario paginado y CSV/HTML completos. No hay aún compras/cuentas por pagar ni métricas de ventas, utilidad, nómina o gastos. Ver docs/PROVEEDORES_REPORTES.md.
- No están los cuatro CSV comerciales en la instancia actual. No se cargó historia ni se resolvieron las 104 discrepancias o la regla decimal. Se preparó verificar_carga_nueva.sql (solo lectura) y se aclaró el flujo de importación en la app.
- Validación: 8 pruebas correctas, tipos y compilación. Navegador Chromium: acceso y logo en 1440 y 390 px, sin desbordamiento horizontal. Pantallas autenticadas/Supabase real pendientes. El proxy bloqueó el acceso a alexmar.vercel.app con CONNECT 403; no se observó la web publicada.
- Código y archivos locales sin push ni publicación. No modificar el borrador del entorno ni publicar por instrucción vigente del propietario. Para desplegar este código hará falta una instrucción explícita posterior.

## Revisión de CSV recibidos (2026-11-15)

- Ya se recibieron nuevamente los cuatro CSV comerciales. Se analizaron localmente sin escrituras en Supabase; informe y diferencias en privado/revision-historica/ (ignorado por Git). Los originales permanecen en attachments, fuera del checkout.
- Conteos: 910 productos/848 vigentes; 163 clientes/108 vigentes; 3.637 movimientos/2.737 vigentes; 77 notas/12 vigentes. Sin errores de formato ni referencias rotas detectados por el analizador actual.
- Confirmadas 104 discrepancias de saldo, que persisten calculando con precisión completa. Exactamente 7 valores de detalle_cuentas.total_linea exceden cuatro decimales. No se aprobó redondeo ni se cambió ninguna cifra.
- El propietario informa 0 lotes y fecha null. No se observó directamente su Supabase; este dato indica ausencia de lotes registrados, no prueba por sí solo que las tablas estén vacías.
- El CSV adicional contiene un inventario de 132 columnas del origen, no las definiciones de vistas/triggers. Confirma tablas proveedores y movimientos_proveedor; sus exportaciones aún no se recibieron.
- Preparado diagnostico_origen_unico.sql para ejecutar solo en el origen: una fila con vistas, triggers/funciones y seis conteos. Verificado en PGlite con esquema sintético dentro de una transacción de solo lectura. Falta el resultado real para explicar saldos y confirmar exportaciones completas.
- No se importaron datos, no se modificó lógica ni migraciones anteriores y no se publicó nada.

## Diagnóstico completo del origen recibido (2026-11-15)

- Recibido CSV con vistas, triggers y conteos. Los cuatro conteos de origen coinciden exactamente con los archivos recibidos (totales y vigentes); proveedores y movimientos_proveedor tienen cero filas, según resultado aportado por el propietario.
- vista_saldos_clientes calcula cargos menos abonos de movimientos no eliminados y no utiliza clientes.total_adeudado. Los triggers devueltos solo actualizan updated_at; no mantienen el campo de saldo.
- Se reprodujo localmente la definición recibida de la vista en PGlite, cargando los CSV sin redondeo en numeric. Los 108 saldos de clientes vigentes coinciden con el cálculo decimal independiente; 104 difieren del campo total_adeudado por más de 0.0001. Esto confirma la regla de la vista; no demuestra qué campo muestra cada pantalla del sistema anterior ni por qué se desactualizó/difiere el otro campo.
- Contraste detallado privado en privado/revision-historica/contraste-vista.csv, ignorado por Git. No publicar los CSV ni los informes con clientes.
- Pendientes dos decisiones del propietario, solicitadas en el chat: usar saldo de la vista conservando campo original, y preservar todos los decimales de los siete importes. No dar por aprobadas hasta respuesta explícita. Si se elige preservar precisión, adaptar mediante migración NUEVA, importador y pruebas; la base actual numeric(20,4) no permite importar esos valores sin pérdida.
- No se ejecutó importación remota ni se publicaron cambios.

## Publicación autorizada y prueba de carga exacta

- Se integró origin/main (incluida la aclaración sobre total_adeudado en cero), preservando documentación remota y continuaciones locales.
- Regla de vista y preservación de precisión aprobadas por "procede y publica". Nueva migración 004, sin editar migraciones anteriores. Firma nueva de importar_inicial exige la conciliación exacta; retira la función anterior para evitar cargas con reglas diferentes.
- El analizador conserva diferencias de procedencia como información y sigue bloqueando errores. El servidor vuelve a analizar y la DB valida todas las filas y concilia saldos antes y después de insertar. Numeric sin escala fija y aritmética decimal exacta dentro del rango validado.
- Prueba privada completa en PGlite: 4.787 originales, 163 saldos, 3.637 importes y stock de 910 productos verificados; sin duplicación al repetir. No publicar los informes ni los datos. Diez pruebas, tipos y build correctos.
- No hay variables Supabase configuradas en esta máquina (solo .env.example); no se efectuaron carga ni SQL remotos. El propietario debe aplicar solo las migraciones pendientes y usar Importación → Analizar y conciliar → Confirmar desde su sesión autenticada.
- Se autoriza publicar este código en main. La publicación del entorno cloud es independiente y no se solicitó cambiar su borrador. Verificar Vercel separadamente; un push no prueba un despliegue exitoso.

## Corrección del bucle de importación

- El propietario reportó que Confirmar exigía seleccionar de nuevo los CSV, y volver a seleccionarlos invalidaba la simulación.
- Reproducido en Chromium: form action de React reinicia los file inputs tras resolver la simulación. La prueba del componente detectó cero archivos donde debía quedar uno por campo.
- Corregido con envío manual onSubmit/preventDefault y captura explícita del botón pulsado; se conservan los archivos entre analizar y confirmar. Durante la petición se bloquea la selección de archivos, y al cambiarlos se invalida la simulación y la aceptación. Errores HTTP no JSON muestran estado sin perder los CSV.
- Prueba de navegador en tests/importador.browser.mjs: confirma que llegan los cuatro archivos y la huella a ambas peticiones, exige aceptación y vuelve a simular al cambiar un archivo. API simulada, sin acceso a datos reales ni escrituras remotas.
- Diez pruebas SQL/analizador, comprobación de tipos y build correctos. No requiere nuevas migraciones. Se publica la corrección en main bajo la autorización vigente.

## Inventario organizado después de la importación

- Importación remota completada según confirmación del propietario. No se repitió ninguna carga remota.
- Nueva migración 005: conserva categorías/compatibilidad originales y agrega sugerencias almacenadas derivadas del texto, con clasificación manual independiente y auditada. Reemplaza consultas mediante RPC autorizadas, sin exponer esquema privado ni costos a roles no permitidos.
- Inventario empieza con grupos por pieza/vehículo, conteos de todo el resultado, filtros combinables y consultas personales existentes. Los grupos no son una simple agrupación de la página visible. Fiesta se detecta también en nombres y etiquetas; no se certifica compatibilidad ni año desde texto libre. Los casos ambiguos quedan disponibles para revisión.
- Cada ficha permite personalizar categoría y grupos (administrador/inventario). Conservar campos vacíos vuelve a sugerencia. El regreso conserva página/filtros; los selectores se actualizan al navegar mediante links.
- Sugerencias calculadas al escribir el producto y filtro SQL integrable por el planificador; corregida lentitud al recorrer reportes completos. Si falta 005, se conserva la consulta anterior con aviso de activación; otros errores no se convierten en ceros.
- Validación: 11 pruebas correctas. Nueva prueba instala 005 después de crear datos y verifica más de mil productos, permisos, auditoría y clasificación personalizada. Los CSV se ensayaron en PGlite: grupos completos, sin alterar stock, importes, saldos ni procedencia. Informes privados fuera de Git.
- tests/catalogo.browser.mjs: agrupación, filtro Fiesta reflejado en formulario, regreso a ficha, falta de 005 y pantallas de 1440/390 px con datos/sesión simulados. Tipos/build correctos. SQL 005 no aplicado remotamente desde este entorno; propietario debe ejecutarlo una sola vez. No requiere migrar los datos de nuevo.

## Facturación, retiro de Importación y paneles plegables

- Incorporado menú Facturación para administrador/ventas y acceso desde Resumen. Importación retirada de ambos lugares; se mantienen datos y funciones históricas protegidas.
- Categorías/vehículos y filtros personalizados tienen Minimizar/Mostrar, preferencia local y atributos accesibles. Buscador visible y filtros activos conservados al minimizar.
- Nueva migración 006: ventas, líneas, pago inicial y FK de cuenta; RLS/esquema privado, RPC con autorización. Borradores/presupuestos editables sin efecto financiero. Emisión numerada, snapshot cliente/conceptos, stock disponible (reservas descontadas), cargo y abono inicial atómicos. Idempotencia, versión del borrador y bloqueos de variantes en orden estable.
- USD como catálogo, impuesto 0 confirmado. Totales exactos sin redondeo; costos y márgenes no implementados. Ventas no modifica precios de catálogo ni concede descuentos/gratuidad; administrador autoriza. Anulación completa auditada con reversiones y confirmación humana de reembolso si hubo cobro. No hay pagos posteriores ni devoluciones parciales aún.
- Búsqueda de clientes/productos paginada por API autenticada; presupuestos y facturas imprimibles/PDF completos con logo, estados y escape HTML. El código muestra activación pendiente si falta 006.
- Pruebas SQL: borrador sin movimientos, precio/stock/reservas, productos duplicados y servicios, crédito/pago parcial, reintentos sin duplicación, edición/versiones, rechazo de sobreventa sin efectos parciales, anulación/reembolso, snapshots, permisos y más de mil documentos.
- Navegador: flujo real de componentes/API/acciones con backend y sesión simulados; crear borrador, revisar antes de emitir, impresión con HTML escapado, menú sin Importación y pantallas 1440/390 px. Plegado/persistencia probado en catálogo. No se emitieron facturas ni se aplicó SQL en la base real desde este entorno.
- Pendiente para activar en remoto: SQL 006 una sola vez y despliegue Ready del commit nuevo. No reimportar datos. Se documenta esta como primera fase de facturación, no como finalización del sistema completo.

## Restauración temporal de Importar archivos y actualización de origen

- Solicitado por el propietario; confirmó operaciones nuevas solo en el sistema anterior. Restaurado acceso de administrador en menú y resumen. No autoocultar después de confirmar; esperar su aviso para retirarlo.
- El importador inicial no admite destinos con datos. Nueva migración 007 sin modificar SQL anteriores: revisiones de procedencia, estado de carga y RPC de actualización transaccional, exclusivamente administrador.
- Comparación por IDs y campos normalizados entre última versión del origen y valor actual. Conserva campos locales no modificados en origen; bloquea cambios incompatibles, IDs colisionados, archivos incompletos y versiones anteriores. El estado simulado se verifica otra vez bajo bloqueos antes de confirmar.
- Stock por diferencia con movimiento trazable; los movimientos de cuenta anteriores nunca se reescriben: reversión más versión nueva cuando corresponde. Los saldos de la parte migrada se concilian exactamente con los archivos y las operaciones locales independientes se preservan. Procedencia inicial intacta y revisiones posteriores privadas/auditadas.
- El formulario reutiliza los cuatro CSV completos (no solo los del día), conserva archivos entre analizar/confirmar, muestra nuevos/actualizados/sin cambios y detalle de valores Antes/Después. Confirmar requiere revisión y aceptación; lotes repetidos no se aplican otra vez. Si falta SQL 007, muestra cómo activarlo.
- Pruebas: actualización de las cuatro tablas, precisión, reintentos, stock por delta, correcciones/eliminación lógica con reversiones, conservación de clasificación, datos originales y campos locales; archivos incompletos/viejos y revisiones obsoletas bloqueados; permisos. El navegador prueba modo actualización y conservación de archivos con API simulada.
- No se aplicó SQL 007 ni se importaron los registros de hoy en el Supabase remoto desde este entorno. El propietario debe aplicar el SQL nuevo, exportar los CSV completos actuales, analizar y confirmar desde su sesión.

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

## Limpieza de pruebas autorizada · 2026-11-22

- El propietario confirma SQL 011 aplicado y solicita vaciar datos comerciales de prueba para una nueva carga inicial reciente. En este caso sustituye la actualización por diferencias; no borrar el sistema anterior.
- Conservar usuarios/roles, filtros, fotos/Storage, estructura, diseño y auditoría. Descartar catálogo/manuales ligados a producto, clientes, movimientos, notas, documentos, proveedores/compras/pagos y procedencia, con copia privada previa. Numeración de prueba reiniciada.
- Utilidad manual con respaldo y limpieza atómicos, sin CASCADE y con guarda de una sola ejecución; recuperación posible solo mientras el destino siga vacío. No instalar borrado como migración automática ni ofrecer RPC de borrado en la web.
- La pantalla actual de carga requiere estado_importacion de SQL 007 también para una base vacía. Si el resultado indica que falta 007, el propietario lo aplica una vez antes de cargar. Mantener Importar archivos. No se ejecutó borrado remoto desde desarrollo.

## Inventario opcional y rendimiento · 2026-11-22

- El propietario confirma la nueva importación completada. No repetir limpieza ni carga. Mantener el importador hasta aviso explícito.
- Solicita vender sin existencias durante el conteo, dejando el descuento de inventario apagado por ahora y un ajuste para activarlo después. Opción global administrada en Configuración, aplicada al emitir y guardada en cada factura. Con control apagado no se registra salida; activarlo no descuenta retroactivamente.
- La anulación conserva cargo/cobros/historial y devuelve solo las existencias realmente descontadas por esa factura. Acceso visible en lista/ficha; administrador, motivo y reembolso reconocido cuando corresponda.
- Logo existente sin teléfono como icono de pestaña. Sustituir hero promocional por Rendimiento: ventas de hoy, semana, comparación al mismo día/hora previos, 14 días y 8 semanas. USD, horario Caracas; solo facturas confirmadas nuevas, excluyendo historia importada, borradores y anuladas. No confundir importe facturado con cobros o ganancia.
- SQL 012 nuevo y manual, sin limpieza/reimportación. Se preservan las decisiones y datos importados anteriores.

## Personal y acceso de escritorio · 2026-11-23

- El propietario pide implementar la separación ya confirmada: Administrativo con todos los datos, General exclusivamente productos/precios, panel por persona y registro de entradas, bloqueo general manteniendo administradores. Los accesos anteriores ventas/inventario se reducen a General, sin elevar a nadie.
- Verificar el rol activo y bloqueo en la DB y servidor, también con JWT previo y peticiones directas. Consulta general en ruta/RPC propia con lista explícita de campos sin costos, stock, cuentas ni métricas. Sesiones abiertas comprueban permiso y se retiran al bloquear/desactivar/cambiar acceso.
- Identidades por Supabase Auth, con usuario normalizado o correo. Creación administrativa opcional usando clave de servicio solo en servidor, o manual en Authentication y asignación de perfil. No habilitar registro público, guardar claves en tablas propias ni publicar la contraseña aportada. La cuenta solicitada queda pendiente de registro remoto, no creada desde desarrollo.
- Manifiesto e iconos de instalación con logo real. Puede requerir renovar el acceso directo anterior. No se promete modo sin conexión ni se cachean datos privados.
- SQL 013 nuevo, sin limpieza ni reimportación. Mantener la cuenta administrativa existente y su protección contra quitarse el acceso propio.

## Correcciones de proveedores · 2026-11-23

- El propietario pide editar la orden, corregir abonos/importes y retirar pruebas. Cantidad/costo determinan el total; stock por diferencia y cuenta por pagar recalculada, con versión y auditoría.
- Anular conserva documentos y abonos anulados y retira sus efectos, con revisión del pago real o prueba y cualquier reintegro. Si hay operaciones posteriores sobre la mercancía, se requiere devolución/conciliación; no se reescriben ventas ni existencias consumidas. No se incorpora borrado físico de comprobantes.
- SQL 014 nuevo, manual tras 013; sin limpiar ni reimportar.

## Notas enriquecidas · 2026-11-23

- El propietario solicita Nueva nota visible, hoja para escribir, color de letra, resaltado y stickers. Se añade edición de notas existentes, preservando el texto anterior hasta guardar.
- Guardado explícito en la base existente, sin nuevo SQL ni caché privada. Texto/estilos permitidos en formato propio, render seguro sin HTML ejecutable. Acceso administrativo exclusivamente.

## Cuenta continua y eliminación de notas · 2026-11-23

- El propietario pide cuenta unificada, sin separación visual entre sistemas, filtros cerrados y productos/abonos cargados en el cliente. Se conserva la procedencia técnica y los comprobantes sin duplicar deuda. Los productos desde cuenta se registran a crédito con cliente fijo; facturación general conserva contado/crédito.
- Abonos de cuenta: primero saldo sin factura, después comprobantes por antigüedad, todos reflejados en la misma cuenta. Saldo esperado, exactitud, idempotencia y aplicación transaccional. No anticipos/sobreabonos. SQL 015 manual, sin limpiar ni reimportar.
- Eliminar notas las retira del listado, con confirmación y auditoría, sin afectar datos financieros.

## Precio unitario por operación · 2026-11-23

- El propietario pide elegir inventario y editar precio unitario (subida/bajada o precio acordado) con multiplicación por cantidad. Precio autorizado solo para la operación; no cambia el catálogo. Administrativo autoriza, línea y auditoría conservan el precio efectivamente cobrado.
- Añadir producto faltante desde cuenta/factura lo crea en inventario y selecciona sin perder líneas, con stock cero y costo pendiente. Alta explícita independiente del cargo, idempotente y sin emitir ventas accidentalmente. SQL 016 nuevo, sin limpiar ni reimportar.

## Métodos de pago · 2026-11-23

- Agregar Zelle y Binance a todos los selectores/validaciones de pago, conservando Efectivo, Transferencia, Pago móvil, Tarjeta y Otro. No se cambian saldos ni reglas de cobro; son métodos de registro, sin integraciones ni transferencias automáticas. SQL 017 después de 016.

## Carga por filas y contado sin cuenta · 2026-11-23

- El propietario confirma Nueva factura para contado sin cuenta permanente; todas las facturas permanecen registradas y consultables. Agregar cliente a crédito crea cuenta, y las cuentas existentes siguen con sus cargos/abonos. No crear un cliente ficticio para contado.
- Cargar 15 filas ampliables, cantidad/nombre/precio/total, con navegación por flechas y Enter. Productos sin elegir catálogo se completan después en Inventario → Productos sin cargar; servicios separados, sin alta de producto obligatoria por cada línea antes de emitir.
- Quitar Observaciones/descuento/autorizaciones de la interfaz, sin borrar datos antiguos. Conservar validaciones, dinero exacto, permisos, auditoría e idempotencia. Stock se descuenta solo según modo de la factura, una vez identificado y con unidades disponibles; anulación revierte solo movimientos reales. SQL 018 manual, sin limpiar ni reimportar.

## PDF del cliente para WhatsApp · 2026-11-23

- Añadir Generar factura a la ficha, con cuenta completa como Estado de cuenta o una factura emitida del cliente. Exportar no crea deuda ni otra factura. PDF real, logo, fecha, totales y documento completo.
- Enlace de archivo temporal 7 días, token de alta entropía/hash y revocación; destinatario no necesita acceso a la app. Administradores generan/revocan, público solo lee ese archivo con token. Envío WhatsApp lo confirma el usuario; Web Share cuando puede adjuntar, enlace/descarga siempre disponibles. SQL 019 nuevo, sin importar datos.


## Operación simplificada · 2026-11-26

- El propietario autorizó implementar el bloque de pendientes recopilado. Ventas registra contado aunque no se imprima factura; cada venta se conserva y cuenta una vez. Clientes es la cuenta a crédito, con acciones y PDF desde su ficha.
- Eliminar personas significa retirarlas del directorio solo con saldo cero, conservando cuentas/documentos. Eliminar factura significa anulación y reversión auditadas, no borrado físico. Editar contacto no reescribe snapshots de facturas emitidas.
- Búsquedas interactivas, acciones contextuales, tema con icono y opciones secundarias plegadas. Proveedores con nombre principal/datos opcionales, sin selector de actividad habitual.
- Foto de factura con OCR local en navegador, comparación con catálogo y revisión humana obligatoria. Diseños no reconocidos se completan manualmente; no inventar importes. Copia privada JPEG limitada y confirmación atómica con compra/stock/deuda. No requiere nuevas claves ni un servicio externo.
- Alta de pendientes usa stock físico actual después de ventas; el modo original decide la salida registrada. Movimientos por entrada/retiro son cantidades, independientes del mínimo y del conteo absoluto. Registrar venta desde inventario usa el mismo motor de ventas y su interruptor de descuento.
- SQL 020 nuevo; no se aplican de nuevo importaciones/limpiezas ni se modifica el sistema anterior. La conciliación pendiente del corte no queda aprobada por esta entrega.

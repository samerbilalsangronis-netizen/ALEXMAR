# PROMPT MAESTRO — Sistema de gestión para tienda de autoperiquitos y rotulados

Actúa como responsable de desarrollo de una aplicación web de gestión comercial para una tienda de autoperiquitos, accesorios automotrices, instalaciones y rotulados. Debes diseñar, construir, probar y documentar un sistema funcional, sencillo de usar en computadora y teléfono, con datos persistentes y operaciones reales. No entregues solamente pantallas de demostración.

## 1. Objetivo y referencia

Utiliza como referencia funcional el sistema Tierra Santa:
https://github.com/samerbilalsangronis-netizen/TIERRA-SANTA-

Antes de reutilizar cualquier parte, lee AGENTS.md, HANDOFF.md y DECISIONES.md y revisa el código actual. Conserva los patrones útiles de clientes, proveedores, cuentas por cobrar y pagar, nómina, reportes, permisos y auditoría. Adapta sus reglas al nuevo negocio.

Desarrolla el nuevo sistema en un repositorio y proyecto de base de datos independientes. No modifiques Tierra Santa ni sus datos. Si no tienes acceso al repositorio de referencia, indícalo y trabaja con los requisitos de este documento sin afirmar que revisaste su código.

El negocio vende productos como iluminación, rines, antenas, sonido, forros, accesorios y piezas automotrices; también cobra instalaciones, mano de obra, diseño y rotulados. Las categorías son editables: estos ejemplos no deben limitar el catálogo. El nombre comercial, logo, direcciones y teléfonos se confirmarán y serán configurables; no inventes datos del negocio.

La prioridad es encontrar con facilidad el producto correcto, conocer su precio y disponibilidad, llevar las deudas de clientes y proveedores y migrar fielmente la información del sistema que ya funciona.

## 2. Plataforma y forma de trabajo

- Aplicación privada en español, con interfaz clara, pocos pasos y navegación adaptable a PC y teléfono.
- GitHub para código, Vercel para despliegue y Supabase para Postgres, autenticación y archivos. Verifica las versiones compatibles al implementar; no copies versiones antiguas por costumbre.
- El propietario trabaja desde el navegador. No le exijas terminal, Docker ni instalaciones locales. Realiza las pruebas técnicas en tu entorno.
- Las migraciones SQL deben ser nuevas, versionadas y aplicables desde Supabase SQL Editor. No reescribas migraciones ya aplicadas.
- Dinero con precisión decimal; no bases los cálculos financieros en sumas de coma flotante. Calcula los totales definitivos en el servidor o la base de datos.
- Fechas y cierres con zona America/Caracas. Monedas configurables, contemplando USD, bolívares y pesos colombianos. Cada operación conserva su moneda y, cuando corresponda, su tasa histórica.
- El alcance inicial requiere conexión. No presentes un acceso directo como modo offline ni prometas sincronización sin haberla implementado y probado.

## 3. Inventario: máxima prioridad de búsqueda

El inventario debe ser el módulo de consulta más potente. El usuario debe encontrar un producto aunque no conozca su código ni escriba exactamente su nombre.

### Información del producto

Permite nombre comercial, descripción, categoría y subcategoría, marca, modelo/referencia del fabricante, SKU interno opcional, código de barras opcional, códigos alternativos, alias y palabras de búsqueda, proveedores, unidad de compra y venta, ubicación, fotografías opcionales, costo, precios de venta y stock mínimo. No obligues a completar datos que no aplican.

Registra compatibilidad con vehículos: marca, modelo, generación o rango de años y especificaciones relevantes. Un producto puede servir para varios vehículos; debe existir también la condición «universal». No guardes todas las compatibilidades como un único texto difícil de filtrar.

Maneja variantes cuando corresponda: color, medida, diámetro, voltaje, potencia, lado, tipo de conector o presentación. Cada variante que se vende por separado debe tener existencias y precio identificables. Evita sumar como si fueran equivalentes variantes incompatibles.

### Buscador principal

- Buscar por nombre completo o parcial, varias palabras, descripción, alias, marca, referencia, códigos alternativos y compatibilidad vehicular.
- Ignorar mayúsculas, tildes y espacios repetidos. Tolerar errores pequeños de escritura con resultados aproximados claramente ordenados.
- Priorizar coincidencia exacta de referencia o nombre, después coincidencia por palabras y finalmente similares. No mezclar referencias parecidas como si fueran el mismo producto.
- Buscar en cualquier orden: «antena Hilux negra» debe poder localizar «Antena negra compatible con Toyota Hilux» si esos atributos están registrados.
- Mostrar sugerencias mientras se escribe, permitir Enter para consultar y teclado para recorrer resultados.
- No buscar solo entre los productos ya cargados en el navegador: consultar todo el catálogo autorizado.
- Al no encontrar coincidencias, sugerir revisar filtros o términos; nunca inventar compatibilidad.

### Filtros avanzados combinables

Categoría y subcategoría; marca del producto; proveedor; vehículo, modelo y año; universal o específico; referencia; variantes; ubicación; activo/inactivo; con o sin precio; disponible, agotado o bajo mínimo; rangos de existencia, costo y precio de venta; fecha de última compra y productos sin movimiento en un periodo.

Los filtros deben combinarse, mostrar cuántos resultados quedan y permitir quitar uno o limpiarlos todos. Conserva búsqueda, filtros y orden al entrar a una ficha y volver. Permite guardar consultas frecuentes por usuario.

Ofrece orden por relevancia, nombre, precio, existencia y última entrada. Documenta cómo combina selecciones dentro de un filtro y entre filtros.

### Lo que debe verse en los resultados

Sin abrir cada ficha, mostrar nombre, imagen si existe, referencia, marca, variante, compatibilidad resumida, precio de venta con moneda, cantidad física, cantidad reservada y cantidad disponible, unidad, ubicación y estado de stock. Si faltan precios, mostrar «Pendiente de precio» y conservar el producto visible.

El costo y margen solo se muestran a roles autorizados. Si se presenta un equivalente en otra moneda, identificar la tasa y fecha usadas. La cantidad disponible se calcula como existencia física menos reservas activas; reservar no es vender ni descontar físicamente dos veces.

La ficha debe mostrar detalle, proveedores, costos autorizados, precios, compatibilidades, entradas, ventas, devoluciones, reservas y kardex. Registrar ajustes con motivo y responsable. No permitir editar directamente una cifra de stock sin un movimiento trazable.

## 4. Proveedores y compras: filtros avanzados

Registrar proveedores de mercancía, materiales y servicios, con nombre o razón social, documento, contactos, teléfonos, ubicación, marcas/categorías que suministran, condiciones y monedas de pago, notas y estado.

El buscador debe localizar por nombre, documento, teléfono, contacto, ciudad, marca suministrada, referencia o producto comprado. Permitir filtros combinados por categoría, marca, producto, moneda, saldo pendiente, saldo vencido, antigüedad de deuda, fecha de última compra, con/sin movimientos y activo/inactivo.

Las búsquedas por mercancía deben considerar las relaciones de catálogo y el historial de compras, explicando cuál criterio se usa. No depender únicamente de un campo libre de observaciones.

Dentro del proveedor, filtrar compras por fecha, número de documento, producto, referencia, categoría, moneda y estado de pago. Permitir ver el último costo y comparar el historial de costo de un mismo producto entre proveedores, siempre en la misma moneda o con conversión identificada.

Registrar compras con líneas de productos, cantidades, costos, descuentos y cargos aplicables, vencimiento y comprobante opcional. Diferenciar factura de compra de recepción física: una compra pendiente de recibir no aumenta stock. Para la operación simple, ofrecer «Registrar compra y recibir» en un solo paso.

La recepción de mercancía aumenta inventario y la compra genera la cuenta por pagar, sin duplicar movimientos. Registrar pagos completos o parciales, anticipos, devoluciones a proveedor y notas de crédito con trazabilidad. Mostrar estados de cuenta imprimibles/PDF y Excel, con saldo anterior, compras, pagos, créditos y saldo final por moneda.

## 5. Facturación sencilla por nombre de producto

La tienda no necesita una pantalla centrada en códigos ni un flujo de caja de alto volumen. El flujo principal será: elegir cliente, buscar el producto por nombre, seleccionar su variante, indicar cantidad, revisar precio y guardar o emitir.

- Reutiliza el buscador del inventario, con filtros accesibles y resultados que muestren precio y disponibilidad.
- El código es opcional como apoyo; nunca obligatorio para facturar.
- Permite líneas de productos y de servicios: instalación, mano de obra, diseño, rotulado u otros conceptos configurables.
- Los productos descontarán existencias al confirmar la venta; los servicios no deben generar stock ficticio.
- Admite contado/crédito, pagos parciales, descuentos autorizados, impuestos configurables, observaciones y vencimiento.
- Ofrece presupuesto y borrador sin afectar deuda ni stock. Convertirlos a venta conserva el vínculo y evita duplicados.
- No permitir confirmar una línea sin precio por accidente: exigir precio válido o autorización explícita para una entrega gratuita.
- Usa numeración consistente, PDF e impresión con identidad del negocio. No afirmar validez fiscal ni integración con equipo fiscal sin definirla.
- Editar o anular conserva historial y motivo; devuelve o ajusta stock y pagos de forma coherente. Diferencia anulación de una devolución real y de una nota de crédito.
- Evita duplicar ventas por doble clic, recarga o reintento de una petición.

## 6. Clientes y estados de cuenta precisos

Registrar cliente, documento, teléfonos y dirección; vehículo opcional cuando resulte útil para un trabajo. Buscar por nombre, documento, teléfono, número de factura o vehículo registrado.

Mostrar facturas, presupuestos, pagos, anticipos, notas de crédito y deuda por moneda. Permitir pago completo, abono y pago de varias facturas con un recibo. Aplicar dinero a las facturas elegidas y, si se usa reparto automático, mostrar la propuesta antes de confirmar. El excedente queda registrado para futuras operaciones sin desaparecer.

Los estados de cuenta deben incluir identificación del cliente, periodo, saldo anterior, fecha y número de cada documento, descripción breve, cargos, abonos, créditos, saldo acumulado y saldo final. Separar monedas y distinguir fecha de emisión, vencimiento y pago. Incluir documentos históricos migrados aunque no tengan líneas de productos.

El saldo anterior incluye todos los movimientos previos al filtro; el saldo final no se calcula únicamente con la página visible. Permitir imprimir/guardar PDF y exportar Excel con los mismos criterios y totales. Añadir antigüedad de saldos y recibos con detalle de las facturas abonadas.

## 7. Instalaciones y rotulados

Incluye un flujo sencillo de trabajos, separado de la venta de mercancía: cliente, vehículo opcional, descripción, fecha de entrega acordada, responsable, presupuesto, anticipo y estados pendiente, en proceso, terminado, entregado o cancelado.

Vincula presupuesto, orden de trabajo y factura. Los anticipos deben registrarse una sola vez y aplicarse al cobro final. Permite mano de obra y materiales identificados. Si se reservan productos, libéralos al cancelar o consumirlos al entregar, evitando doble descuento.

Permite cantidades decimales y unidades configurables para materiales de rotulado, por ejemplo metro o metro cuadrado. No conviertas rollos a metros sin registrar sus equivalencias. Define antes de implementar en qué momento se consumen los materiales para que la orden y la factura no resten dos veces lo mismo.

Mantén este módulo simple: no añadas maquinaria, planificación industrial ni cálculos automáticos de rendimiento que no hayan sido solicitados.

## 8. Nómina

Incluir empleados fijos y por destajo, tarifa diaria, calendario mensual, asistencia, media jornada, faltas, tareas realizadas y pagos adicionales. Manejar jornadas y precios históricos: cambiar una tarifa no modifica lo ganado antes.

Trabajar por pagos y adelantos, como la versión actual de Tierra Santa. El saldo se obtiene de todo lo ganado menos todos los pagos y adelantos. Un pago parcial deja la diferencia acumulada; el adelanto no redefine la última fecha de pago. Permitir pagar varios empleados a la vez con montos individuales.

Mostrar historial completo, panel por empleado, último pago, tareas, días trabajados, ganado y reporte desde el último pago o fechas libres, con saldo anterior y firmas. Nómina visible únicamente para los roles autorizados; no exponer montos en reportes generales a otros usuarios. No imponer periodos obligatorios de cierre.

## 9. Gastos y control de dinero

Registrar gastos operativos por categoría, concepto, fecha, monto, moneda, método, responsable y comprobante opcional. Las compras de mercancía se registran en Compras; su pago no debe contabilizarse otra vez como gasto operativo independiente.

Distinguir venta de cobro, compra de pago y nómina devengada de nómina pagada. No presentar ventas menos compras como utilidad real.

## 10. Dashboard y reportes completos

Dashboard con periodos y comparación: ventas, cobros, cuentas por cobrar/pagar, compras, gastos, productos con mayor venta, stock bajo y trabajos pendientes. Separar montos por moneda; identificar toda conversión.

Reportes filtrables, imprimibles/PDF y Excel:

1. Ventas por producto, categoría, marca, cliente y periodo.
2. Detalle y libro de facturas, descuentos, anulaciones, devoluciones y créditos.
3. Cobros por fecha, método y moneda; cuentas por cobrar y antigüedad.
4. Compras por proveedor y producto; historial y comparación de costos; cuentas por pagar y vencimientos.
5. Inventario actual, disponible/reservado, agotados, mínimos, sin precio, sin movimiento, kardex y valoración por costo.
6. Servicios, instalaciones y rotulados por estado, responsable y periodo; anticipos y saldos pendientes.
7. Gastos por categoría, concepto y responsable.
8. Nómina por empleado, fijo/destajo, tareas, ganado, pagos, adelantos y deuda, con permisos propios.
9. Movimientos de dinero por método y moneda, diferenciando entradas/salidas y movimientos internos.
10. Margen bruto por producto y venta cuando exista costo histórico verificable. No confundirlo con utilidad neta.

Define el método de costo antes de programar márgenes y valoración. Conserva el costo aplicado a cada venta; una compra posterior no debe cambiar la rentabilidad histórica. Si un registro migrado no trae costo, marcar «Costo no disponible» y no inventar margen.

Todos los reportes deben indicar filtros, periodo, moneda y fecha de generación. El Excel debe incluir todo el resultado autorizado, no solo la página visible. Un error de consulta debe mostrarse como error, nunca transformarse silenciosamente en cero.

## 11. Historiales completos desde el principio

Implementa paginación real en servidor para productos, movimientos, compras, ventas, pagos, proveedores, clientes, nómina y auditoría. Ningún límite técnico puede ocultar registros sin indicarlo o sin permitir continuar.

Los totales y saldos se calculan con todos los registros del filtro, independientemente de la página. Usa orden estable con desempate por ID, índices apropiados y consultas eficientes. Para exportaciones grandes, procesa por lotes sin truncar. Respeta el máximo por respuesta de Supabase y comprueba que se recuperan todas las páginas.

No resuelvas este requisito elevando un límite de 1.000 a 10.000. Prueba con más registros que cualquier límite de consulta y verifica que los registros más antiguos siguen accesibles.

## 12. Migración del sistema que ya está funcionando

La migración es parte obligatoria del proyecto. No supongas qué programa se utiliza ni su formato. Primero pide el nombre del sistema y una exportación de muestra; puede ser Excel, CSV, base de datos o reportes. Examina sus columnas y relaciones antes de diseñar el importador definitivo. Mientras llegan los archivos, puedes avanzar en lo que no dependa de ellos.

Prepara un plan que cubra productos, variantes, unidades, referencias, compatibilidades, existencias, costos, precios, proveedores, clientes, compras, ventas, pagos, créditos y nómina cuando esos datos estén disponibles.

- Conserva los identificadores del sistema anterior y una tabla de equivalencias.
- No fusiones productos solo porque sus nombres se parecen. Señala duplicados candidatos y diferencias para revisión.
- Normaliza formatos de fechas, monedas, cantidades y separadores decimales sin alterar importes.
- Implementa simulación previa: registros válidos, rechazados, duplicados, advertencias y totales por moneda.
- Cada lote debe ser identificable, repetible sin duplicación y recuperable ante fallo.
- Preserva los números originales de documentos históricos y la procedencia de cada registro.
- Si se migra stock a una fecha de corte, importa el historial anterior sin volver a descontarlo sobre ese stock. Lo mismo aplica a saldos iniciales y pagos históricos: no contabilizarlos dos veces.
- Si solo existen saldos resumidos, registra saldos iniciales identificados; no inventes compras, facturas o pagos para explicar la diferencia.
- Reconcilia antes/después: cantidad de registros, existencias por producto y variante, deuda por cliente/proveedor y moneda, pagos, créditos y saldos de nómina.
- Entrega un informe de diferencias y filas pendientes; la migración no se declara correcta solo porque los archivos se importaron.
- Prueba primero en una base independiente. Haz respaldo y plan de reversión. Presenta la conciliación y el procedimiento concreto antes de solicitar autorización para el paso final a producción.
- Define fecha de corte y cómo incorporar lo registrado en el sistema anterior durante la preparación, evitando perder operaciones.
- No subas datos comerciales reales, exportaciones o credenciales al repositorio público.

## 13. Seguridad, trazabilidad y respaldo

Roles iniciales: administrador, ventas, inventario/compras y solo lectura; permisos ajustables. Define por separado quién puede consultar costo, margen, deuda de proveedores, reportes financieros y nómina. «Solo lectura» no significa acceso a toda la información confidencial.

Aplica permisos tanto en servidor como en políticas RLS de Supabase. La clave de servicio solo vive en servidor. Registra usuario, fecha, motivo y cambios en operaciones sensibles. No borres documentos financieros confirmados para corregirlos: utiliza los movimientos de reversión correspondientes.

Las operaciones relacionadas deben ser transaccionales: recepción y stock; factura y deuda; pago y aplicaciones; orden y reservas. Protege contra reintentos y ventas simultáneas. El control de stock no debe perder el vínculo con facturas antiguas al cambiar su configuración.

El respaldo debe incluir todas las tablas de negocio, gastos, nómina y metadatos, con una estrategia separada para archivos adjuntos. Diferencia exportación Excel de respaldo restaurable. Documenta y prueba una restauración.

## 14. Pruebas y criterios de aceptación

Antes de declarar terminado, demuestra al menos:

- Encontrar productos por nombre incompleto, alias, marca, referencia y compatibilidad; combinar filtros y conservarlos al volver de una ficha.
- Ver precio, variante y disponibilidad correcta en PC y teléfono sin abrir cada producto.
- Localizar proveedores por producto comprado y obtener estados de cuenta completos por moneda.
- Recibir una compra una sola vez; vender productos y servicios sin descontar existencias incorrectas.
- Emitir, abonar, devolver, editar y anular, conciliando deuda, dinero y stock.
- Aplicar anticipos de trabajos al cobro final sin duplicarlos.
- Calcular nómina fija/destajo y pagos parciales correctamente.
- Acceder a registros más antiguos que los límites por consulta; comprobar que totales y exportaciones incluyen todas las páginas.
- Bloquear operaciones y consultas no autorizadas incluso fuera de los botones de la interfaz.
- Migrar un lote de muestra, repetirlo sin duplicados y obtener conciliación sin diferencias no explicadas.
- Compilar, validar tipos, revisar código y probar cálculos y flujos críticos. No ejecutar pruebas que escriban datos sobre la base real.

## 15. Forma de entrega

Empieza entregando el mapa de módulos, modelo de datos, flujo de inventario y pagos, propuesta de búsqueda/filtros y plan de migración. Pregunta únicamente por decisiones que afecten datos, dinero o reglas reales y que no puedan resolverse con la información disponible.

Después implementa por fases: base y permisos; catálogo/búsqueda; proveedores/compras; clientes/ventas; trabajos; nómina/gastos; reportes; migración y validación final. Prepara la importación desde el inicio para no obligar a reconstruir el modelo al recibir los archivos.

Mantén documentación de funcionamiento, decisiones, migraciones, pruebas y pendientes. En cada entrega explica en español sencillo qué funciona, dónde se ve, qué se probó y qué falta. Si hace falta aplicar SQL, entrega el archivo exacto y los pasos para hacerlo desde el navegador.

El resultado debe estar listo para operar con datos reales, con búsquedas potentes y cuentas verificables; no basta con una interfaz visualmente terminada.

# Cuenta continua del cliente · SQL 015

La carga actual usa la [tabla rápida de 15 filas, contado y productos pendientes](FACTURACION_RAPIDA.md) con SQL 018. Las reglas y comprobantes de las entregas anteriores se conservan.

## Activar

En el **Supabase nuevo**, abre **SQL Editor → New query**, copia completo [SQL 015](../supabase/migrations/20261123001500_cuenta_clientes_notas.sql) y ejecuta **Run una sola vez**. No repitas SQL 014 ni los SQL anteriores. Requiere la base, facturación/cobros y los accesos administrativos ya instalados; esta entrega no depende de cambios de proveedores. No se ejecuta en Vercel, no limpia datos ni exige importar otra vez.

Cuando Vercel tenga listo el despliegue nuevo, recarga ALEXMAR.

## Cliente y cuenta

**Clientes y cuentas → cliente** abre directamente **Historial completo**, sin pestañas que separen procedencias. Cuenta total, total cargado y total abonado se calculan sobre toda la cuenta en la moneda elegida, con sus correcciones y anulaciones. El historial sigue paginado en grupos de 30, con saldo acumulado y exportación completa; la paginación no limita los totales. Se conservan los movimientos originales y no se crean facturas para cargos importados.

**Filtros del historial** empieza cerrado, con Mostrar y Minimizar. Permite fechas/moneda y quitar filtros. Los saldos de cabecera son globales; el resumen de fechas muestra saldo anterior, cargos/abonos del periodo y cierre. USD es la referencia de las operaciones nuevas; los saldos históricos en otras monedas continúan separados, sin conversiones.

**Cargar productos** abre dentro de la cuenta el formulario con ese cliente fijo y crédito, sin buscar de nuevo ni escoger contado/crédito. Selecciona productos por nombre/iniciales; el precio de venta se completa, revisa y confirma el cargo. Vuelve a la cuenta actualizada. Se conserva el comprobante de venta, control de stock opcional e idempotencia de facturación existentes. **Comprobantes del cliente** queda como consulta secundaria plegada; no se borra la trazabilidad de las operaciones ni se enlazan productos históricos por semejanza.

El historial muestra las descripciones y cantidades/precios originales disponibles. Los nuevos cargos muestran también las líneas de su comprobante. Las descripciones del origen no se renombran o reescriben para ocultar su procedencia; la navegación ya no las separa por sistema.

## Abonar desde la cuenta

**Registrar abono** abre el formulario del cliente actual. Escribe el importe en USD, método, revisa y confirma que recibiste ese dinero. No ejecuta transferencias bancarias. No admite sobreabonos ni anticipos sobre una cuenta sin saldo.

El abono se aplica primero al saldo acumulado que no tiene factura y después a los comprobantes pendientes, por antigüedad. Las partes aplicadas a comprobantes actualizan sus pagos y saldos mediante `cobrar_factura`; la parte acumulada registra un movimiento ABONO. No se inserta además otro ABONO por el importe completo. El registro privado de abono conserva el total y todas sus aplicaciones, con responsable, fecha e idempotencia. Cancelar un comprobante sigue revirtiendo sus propios cobros y exige la revisión del reintegro; no revierte pagos aplicados a otros saldos.

Se comprueba el saldo visto por el usuario, se bloquean cliente/documentos y se serializa con las actualizaciones del origen. Todo es transaccional y decimal exacto, hasta 84 decimales de abono: un error revierte todas las aplicaciones. Un reintento con misma clave/contenido no duplica; con datos diferentes se rechaza. Se verifica que la cuenta baje exactamente el importe recibido. La conciliación del corte del sistema anterior sigue siendo una operación independiente; esta mejora no confirma ni ejecuta aquella carga pendiente.

## Eliminar notas

Cada tarjeta de Notas ofrece **Eliminar nota**. Confirma la nota concreta o pulsa Cancelar. Se retira del listado mediante `activo=false`, conserva auditoría y no toca movimientos financieros. Una nota eliminada no se puede resucitar guardando desde una pestaña abierta antes de eliminarla. El editor de colores y stickers no cambia.

Solo Administrativo puede ver/operar cuentas y eliminar notas; verificación en servidor, API/acciones y funciones SQL. Tablas privadas con RLS, sin acceso directo para General/anon.

## Verificación

`tests/cuenta-continua.test.ts` instala todas las migraciones y prueba pagos entre saldo acumulado/comprobantes, exactitud, reintentos, sobreabonos, saldo obsoleto, cancelación sin doble reversión, paginación/filtros, permisos y eliminación de notas. Los recorridos de navegador de facturación y notas usan componentes/acciones/API reales con backend simulado: historial inicial, filtros plegados, cargo a crédito con cliente fijo y retorno a cuenta, abono, confirmación/cancelación de eliminación de nota y 1440/390. Ningún cambio de datos en producción desde desarrollo.

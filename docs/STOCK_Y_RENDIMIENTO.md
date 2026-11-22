# Inventario opcional y rendimiento de ventas · 2026-11-22

El propietario confirma terminada la importación reciente. Pide anular facturas de forma visible, vender mientras organiza el conteo físico, poder activar después el descuento de inventario, usar el logo en la pestaña y reemplazar el bloque promocional del resumen por ventas semanales y diarias. **No limpiar ni reimportar de nuevo** para esta entrega.

## Activación

1. En Supabase NUEVO → SQL Editor, ejecutar completo una sola vez [SQL 012](../supabase/migrations/20261122001200_control_stock_rendimiento.sql), después de SQL 011 ya instalado.
2. La migración deja **Descontar inventario al facturar desactivado**. No modifica existencias importadas, saldos, facturas ni cobros existentes. Agrega a las facturas anteriores una marca que conserva su comportamiento histórico de inventario.
3. Comprobar el despliegue de `main` como Ready en Vercel y recargar. El logo usa una URL de icono nueva para evitar reutilizar el icono previo de la pestaña.
4. En **Configuración → Inventario al facturar**, el administrador podrá activar **Descontar inventario al facturar** cuando termine el conteo. El formulario informa el estado guardado y verifica versión para no sustituir una configuración modificada desde otra sesión.

Publicar código no ejecuta SQL. No se ejecutó la migración en Supabase remoto desde desarrollo. La importación reciente es una confirmación del propietario, no una comprobación directa de la base desde este entorno.

## Vender durante el conteo

Con el control **apagado**, se permite facturar productos activos con precio de venta incluso si la existencia disponible es cero o insuficiente. La factura registra sus líneas, cargo y cobros normalmente, **sin crear salidas de inventario**. La existencia importada permanece como referencia pendiente de conteo; no se convierte en stock negativo para permitir la venta.

Con el control **encendido**, se exige existencia física menos reservas activas suficiente y se descuenta al emitir. El estado se obtiene en servidor/DB, con bloqueos transaccionales, y se guarda en cada factura. El navegador no puede forzar una excepción por factura ni cambiar el ajuste global sin permiso de administrador. El borrador no mueve inventario y la regla vigente se toma al emitir.

Activar el control no aplica salidas retroactivas a ventas emitidas mientras estuvo apagado. El conteo físico debe considerar las ventas y recepciones realizadas durante ese período. Las compras continúan sumando mercancía y generando deuda al proveedor; el interruptor controla solamente las salidas por facturación.

El editor muestra si se descontará inventario y un acceso a Configuración para el administrador. La ficha conserva el estado usado al emitir. Hasta instalar 012 se mantiene la regla anterior de existencia obligatoria y Configuración muestra el enlace de activación, sin fingir que el control ya está desactivado.

## Anulación visible

Solo administrador: en el listado **Facturación → Anular**, o en la ficha **Anular factura**. Se abre un diálogo con motivo obligatorio, confirmación y reconocimiento del reembolso/reversión de todos los cobros registrados, si los hay. La anulación comprueba la versión revisada y conserva documento, líneas y trazabilidad.

Se revierten el cargo y los cobros. Solo se devuelve la salida efectivamente registrada por esa factura, identificada por la idempotencia de venta; una factura que no descontó stock no crea una entrada al anular. El estado actual del interruptor no altera esa regla: se puede anular una factura vieja con descuento aunque ahora esté apagado, o una factura sin descuento después de activarlo. Repetir emisión o anulación no duplica efectos. No se ejecutan reembolsos bancarios automáticamente y las devoluciones parciales siguen pendientes de su módulo.

Ventas puede emitir y cobrar, pero no anular ni cambiar esta configuración. Roles inventario/lectura tampoco acceden a ventas o importes del nuevo gráfico. Se mantienen esquema privado, RLS y RPC con rol verificado.

## Rendimiento semanal y diario

La navegación pasa de Resumen a **Rendimiento**; se retira el bloque Más control / Mejores decisiones y se muestra:

- Ventas de hoy en USD, hasta el instante consultado en horario America/Caracas.
- Importe y cantidad de facturas de lunes a ahora.
- Diferencia y porcentaje frente a **lunes al mismo día y hora de la semana anterior**. No se compara una semana incompleta contra siete días completos. Si la base anterior es cero, no se calcula porcentaje ni se inventa crecimiento del 100 %: se indica Sin base comparable.
- Gráfico diario de los últimos **14 días**, incluidos días válidamente consultados sin ventas.
- Gráfico de las últimas **8 semanas**, de lunes a domingo; la actual está en curso. Las semanas anteriores del gráfico incluyen sus totales completos. Por eso su barra anterior puede ser mayor que el importe del período comparable de la tarjeta.

Los importes son **facturación confirmada**, al contado o crédito, no cobros de caja ni ganancia. Excluyen borradores, presupuestos, anuladas y movimientos del historial anterior. Los abonos no vuelven a sumar ventas. Al anular, la factura deja de sumar en su fecha original; no se crea una venta negativa en el día de anulación. Sin facturas nuevas, los gráficos mostrarán cero aunque haya deuda importada. Se conservan las métricas de márgenes/clientes existentes, identificadas aparte.

Agregación en SQL `numeric` sin sumar dinero con flotantes; los números se convierten solo para altura de barras y presentación. La comparación conserva importes exactos y no divide entre cero. Los gráficos admiten selección con ratón, toque o foco de teclado y ofrecen tabla equivalente. Consultas fallidas muestran un error/activación, nunca ceros simulados. Índice de ventas emitidas y rangos acotados para no descargar facturas al navegador.

## Verificación y compatibilidad

Pruebas locales de DB con datos sintéticos: stock cero/apagado, control activado y reservas, reintentos, cambio de modo entre emisión/anulación, facturas anteriores a 012, permisos y cambios concurrentes de versión. Fechas en Caracas, límite de medianoche, comparación al mismo instante, ceros, exclusión de historia/presupuestos/borradores/anuladas y precisión decimal. Navegador con backend simulado revisa menú de anulación, diálogo/reembolso, cambio y persistencia del interruptor, icono de pestaña, gráficos diarios/semanales, teclado y temas a 1440/390.

La utilidad de limpieza v1 anterior se probó para el esquema hasta SQL 011 y rechaza módulos desconocidos. Después de instalar 012, rechazaría la tabla nueva de configuración; **no ejecutar ni adaptar esa utilidad para saltarse la protección**. Los datos actuales ya están importados y esta entrega no incluye ningún borrado.

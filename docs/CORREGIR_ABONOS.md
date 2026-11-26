# Corregir abonos de clientes

## Activación

Después del SQL 020 ya aplicado, abre **Supabase nuevo de ALEXMAR → SQL Editor → New query**, copia completo el [SQL 021](../supabase/migrations/20261126002100_correccion_abonos_clientes.sql) y ejecuta una sola vez. Después comprueba Vercel Listo y recarga la web. No requiere importar archivos ni repetir 020. Publicar el código no ejecuta el SQL.

## Uso

1. **Clientes → abrir cliente → Editar abonos**.
2. Identificar por fecha/hora, monto original y monto vigente. Un abono aplicado a varias facturas aparece una sola vez.
3. **Editar abono**: introducir monto correcto, método y referencia; escribir un motivo (5–1000 caracteres).
4. **Revisar corrección** muestra antes/después. **Confirmar corrección** guarda todo junto y recalcula saldo/aplicaciones.
5. Para un registro completamente equivocado, monto correcto **0**. Si se cargó en el cliente incorrecto, corregir a cero en ese cliente y registrar el abono verdadero en el cliente correcto; no se cambia el titular de un registro existente.
6. El diálogo conserva **importe original**, fecha y responsable; **Historial de correcciones** muestra cada antes/después, método/referencia, motivo, hora y administrativo. Las revisiones tienen paginación; los errores conservan los campos escritos.

Solo administrativos. Incluye abonos a cuenta, cobros/pagos iniciales de facturas de clientes y abonos históricos vigentes. Los abonos de proveedor conservan su editor de órdenes existente, independiente de esta función. Los importes y monedas originales no se sobrescriben. Fecha original y titular no son campos editables de esta corrección.

## Qué se conserva y cómo se ajusta

- Nunca reemplaza el importe del movimiento, abono de cuenta o pago original. Guarda una corrección privada, con usuario, motivo, revisión y aplicaciones. Registra compensaciones y aplicaciones nuevas en la misma transacción.
- Abono de cuenta/histórico USD: libera sus aplicaciones vigentes y vuelve a aplicar el importe correcto primero al saldo sin factura y después a facturas por antigüedad. Cobro de factura: se corrige en esa misma factura. Otros abonos históricos conservan su moneda y se aplican a esa cuenta sin conversión.
- El monto puede bajar, subir (hasta deuda disponible) o quedar en cero. No crea anticipos, ventas ni movimientos de stock. Una venta de contado debe conservar su cobro total; se puede corregir su método, pero no dejarla parcialmente pagada.
- Las aplicaciones de una factura que después fue anulada ya están revertidas: no se revierten de nuevo al corregir. La lista puede mostrar un importe vigente menor al original por esa razón. Una factura anulada se consulta pero no se vuelve a cobrar desde este editor.
- Cuota/cobro inicial y snapshots de factura conservan los datos al emitir; pagado y saldo se calculan con todos los pagos y compensaciones. Las compensaciones por método se atribuyen al método anterior; el importe nuevo al método correcto.
- Cuenta y resumen global presentan cargos comerciales y abonos netos corregidos; la compensación no se cuenta como compra/venta nueva. El historial completo conserva los asientos de corrección con su motivo. Exportaciones y PDFs nuevos toman el saldo actualizado. PDFs ya descargados o compartidos son copias del momento en que se generaron; genera otro para el saldo corregido.
- Si otra operación cambió cuenta/facturas, la revisión se rechaza y pide recargar antes de corregir. Repetir una confirmación con la misma clave no repite dinero. Si falla una validación, se revierte todo.
- Un cliente retirado no se puede corregir hasta resolver su situación de acceso a la cuenta. La función no crea cuentas de personal ni cambia permisos.
- Los datos migrados siguen intactos. Si una importación posterior intenta cambiar un abono que ya tiene corrección local, bloquea esa actualización para conciliarla; no reemplaza silenciosamente la base de la corrección.

Esta pantalla registra la corrección contable del dato ingresado, no envía ni devuelve dinero por bancos, Zelle o Binance.

## Verificación

Pruebas con datos sintéticos y sin escrituras en Supabase real: conservación literal del monto original; precisión; cambios a cero y restauración; reparto entre historia/facturas; cancelación posterior sin doble reversión; cobro dirigido, método y reversión al método correcto; sobreabono/contado/revisión obsoleta con rollback; autorización; auditoría y paginación de revisiones; protección del origen. Navegador con componentes/endpoints reales y DB simulada: abrir desde cliente, error sin pérdida de campos, revisar antes de confirmar, saldo actualizado, original intacto, historial y 1440/390 px.

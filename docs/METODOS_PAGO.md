# Zelle y Binance · SQL 017

En **Supabase nuevo → SQL Editor → New query**, copia completo [SQL 017](../supabase/migrations/20261123001700_metodos_pago.sql) y pulsa **Run** después de SQL 016. No repitas migraciones anteriores ni reimportes datos. Cuando Vercel esté Listo, recarga ALEXMAR.

La lista compartida incluye **Efectivo, Transferencia, Pago móvil, Tarjeta, Zelle, Binance y Otro**. Aparece en pago inicial al facturar/cargar productos, cobro posterior de factura, abono desde cuenta del cliente, pago de compra al proveedor y corrección de ese pago.

Se registran pagos realizados: no se conectan cuentas de Zelle/Binance ni se envía dinero. Se conservan importes, moneda USD, límites de saldo, idempotencia, confirmaciones y permisos existentes.

SQL 017 conserva el código de las funciones instaladas y cambia exclusivamente el literal de métodos; si falta 016 o el formato no coincide, aborta la transacción con un mensaje. Actualiza también el CHECK de pagos de compra. Puede repetirse sin duplicar pagos ni cambiar saldos. Las migraciones anteriores no se editan.

Prueba local en `tests/metodos-pago.test.ts`: ambos métodos aceptados en todos los tipos de registro/corrección, rechazo de métodos inválidos, reintentos sin duplicados, saldo y permisos conservados, y reaplicación sin modificar datos. Los recorridos de navegador de facturación/cuenta y compras seleccionan los métodos nuevos usando componentes/API reales con backend simulado. Sin operaciones en producción.

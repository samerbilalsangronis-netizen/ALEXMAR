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
- No importar cuentas con diferencias ni valores que pierdan precisión sin regla aprobada. No asumir que total_adeudado es el saldo definitivo.

## Propuestas pendientes antes de operar
- Costeo promedio ponderado por variante y conservación de costo por venta.
- Consumo de materiales de trabajos al confirmar entrega, con evento único compartido con factura.
- Cuatro decimales operativos, original íntegro conservado. Requiere definir redondeo a moneda y precisión según operación.
- Conciliación: resolver 104 diferencias consultando definición original de las vistas, funciones y triggers.
- Corte, respaldo restaurable, reversión y traslado privado de archivos Storage.

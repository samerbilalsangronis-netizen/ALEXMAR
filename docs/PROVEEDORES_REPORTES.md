> Actualización: compras recibidas, stock y cuentas por pagar ya están disponibles mediante SQL 010. Ver [compras y recepciones](COMPRAS_RECEPCIONES.md); este documento conserva el alcance original del directorio/reportes.

# Proveedores, métricas y reportes

## Disponible en esta fase

- **Proveedores:** directorio editable por administrador e inventario; nombre, documento, contacto, teléfono, correo, ciudad, dirección, categorías, marcas, condiciones, monedas y notas. Búsqueda, filtro de estado/moneda y paginación de 30. Desactivar conserva el registro y su auditoría.
- **Reportes:** métricas de todo el catálogo activo: productos, variantes sin precio, agotadas y bajo mínimo. El disponible descuenta reservas activas. No se suman unidades de variantes distintas como si fueran equivalentes.
- Administrador e inventario ven conteo de proveedores. Administrador y ventas ven clientes activos y cargos/abonos/saldo neto separados por USD, VES y COP. Lectura no recibe esos campos confidenciales.
- Detalle de inventario filtrable, CSV completo y vista completa para imprimir/guardar PDF. Ambas exportaciones recorren todas las páginas; una recuperación incompleta devuelve error. El costo se incluye únicamente para administrador e inventario, según la respuesta autorizada de la DB.
- Los indicadores generales se distinguen del detalle filtrado. Las exportaciones indican filtros, moneda y fecha local de generación.

No hay todavía recepciones, historial de compras por proveedor, deuda de proveedores, ventas nuevas, márgenes, valoración contable, nómina, trabajos ni gastos. No se muestran cifras inventadas para esos módulos. El CSV se puede abrir en una hoja de cálculo; no es un archivo Excel nativo.

## SQL desde el navegador

En el Supabase NUEVO, después de las migraciones base y compatibilidades ya instaladas:

1. Abre [20261115000300_proveedores_reportes.sql](../supabase/migrations/20261115000300_proveedores_reportes.sql).
2. Copia todo el contenido en **SQL Editor → New query → Run**, una sola vez. No repitas las dos migraciones anteriores.
3. Usa el código de esta entrega. El código de esta entrega se publica en main; comprueba en Vercel que el despliegue corresponde al último commit. Consulta docs/PUBLICACION.md.
4. Prueba con datos sintéticos en el proyecto de prueba, con cada rol, antes de operar.

No hacen falta claves de servicio. El esquema privado continúa cerrado y las funciones comprueban usuario activo y rol.

## Datos históricos

Instalar SQL crea la estructura, no carga los CSV. Para comprobar el estado real del proyecto nuevo usa [verificar_carga_nueva.sql](../supabase/utilidades/verificar_carga_nueva.sql), que solo lee conteos y fechas de lotes. No permite concluir que una importación está conciliada solo porque hay registros.

Los cuatro CSV se recibieron de forma privada y se probaron localmente sin pérdida de registros ni importes. La regla de la vista ya está comprobada y aprobada: cargos menos abonos no eliminados. `total_adeudado` se conserva como procedencia. La migración 004 mantiene todos los decimales y verifica los saldos contra la simulación. No se ha realizado una carga remota.

Para investigar esas discrepancias, ejecuta [inspeccionar_origen_solo_lectura.sql](../supabase/utilidades/inspeccionar_origen_solo_lectura.sql) en el origen y comparte sus resultados de forma privada. Conserva los CSV fuera del repositorio público. El directorio de proveedores empieza vacío: no se recibieron exportaciones de proveedores ni compras.

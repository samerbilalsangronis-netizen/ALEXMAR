# SQL de ALEXMAR

## Proyecto Supabase NUEVO

Abre cada archivo y copia su contenido completo en **SQL Editor → New query → Run**, en este orden:

| Orden    | Archivo                                                                                               | Para qué sirve                                                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | [Base, catálogo e historial](migrations/20261115000100_base_catalogo_historial.sql)                   | Crea tablas, permisos, funciones y auditoría. Ejecutar una sola vez en el proyecto nuevo vacío.                                                                                                                             |
| 2        | [Compatibilidades verificadas](migrations/20261115000200_compatibilidades.sql)                        | Agrega gestión de compatibilidades y corrige el filtro conjunto de vehículo/año. Ejecutar una sola vez después de la base.                                                                                                  |
| 3        | [Proveedores y reportes](migrations/20261115000300_proveedores_reportes.sql)                          | Directorio, permisos y métricas. Ejecutar una sola vez después de compatibilidades.                                                                                                                                         |
| 4        | [Migración exacta](migrations/20261115000400_migracion_exacta.sql)                                    | Importes sin redondeo y conciliación contra la regla aprobada de la vista. Ejecutar una sola vez después de proveedores y reportes.                                                                                         |
| 5        | [Catálogo organizado](migrations/20261115000500_catalogo_organizado.sql)                              | Grupos por tipo de pieza y vehículo mencionado; personalización auditada. Aplica sobre los productos existentes, sin reimportar.                                                                                            |
| 6        | [Facturación](migrations/20261115000600_facturacion.sql)                                              | Borradores, emisión, stock/cuentas/pago inicial transaccionales y anulación. Agrega funciones sobre los datos ya importados.                                                                                                |
| 7        | [Actualización desde el origen](migrations/20261116000700_actualizacion_origen.sql)                   | Incorpora nuevos registros y cambios después de la carga inicial, con revisión, conflictos, reversiones e idempotencia.                                                                                                     |
| 8        | [Analítica y marcas de vehículo](migrations/20261117000800_analitica_vehiculos.sql)                   | Márgenes potenciales, ventas mensuales, clientes destacados y agrupación visual por marca/modelo, con permisos por rol. No reimporta datos.                                                                                 |
| 9        | [Reparación de gráficos y fotos de vehículos](migrations/20261117000900_graficos_fotos_vehiculos.sql) | Corrige analítica si falta la vista de SQL 007 y habilita fotos privadas por marca/modelo. Aplicar una sola vez tras 008.                                                                                                   |
| 10       | [Compras y recepciones](migrations/20261117001000_compras_recepciones.sql)                            | Suma mercancía y deuda al proveedor, último costo, pagos y comprobantes auditados. Aplicar una sola vez, sin reimportar.                                                                                                    |
| 11       | [Facturación y clientes](migrations/20261122001100_facturacion_clientes.sql)                          | Listado con saldos/totales globales, emisión directa atómica, cobros posteriores y separación del historial anterior. Aplicar una vez tras 006; no reimporta ni depende de 007.                                             |
| 12       | [Stock opcional y rendimiento](migrations/20261122001200_control_stock_rendimiento.sql)               | Permite vender durante el conteo con descuento apagado, conserva el modo por factura y añade tendencias diarias/semanales. Aplicar una vez tras 011, sin limpiar ni reimportar.                                             |
| 13       | [Accesos de personal](migrations/20261123001300_accesos_personal.sql)                                 | Administrativo completo y General solo precios, registro de sesiones y bloqueo general. Los roles previos de ventas/inventario pasan a General; administradores y datos comerciales se conservan. Aplicar una vez tras 012. |
| 14       | [Editar órdenes y abonos](migrations/20261123001400_edicion_ordenes_proveedores.sql)                  | Correcciones auditadas, stock por diferencia y anulación integral de orden/abonos. Aplicar una vez tras 013, sin limpiar ni reimportar.                                                                                     |
| 15       | [Cuenta continua y eliminar notas](migrations/20261123001500_cuenta_clientes_notas.sql)               | Abonos de cuenta aplicados a deuda acumulada y comprobantes sin duplicar, productos en historial y eliminación auditada de notas. Ejecutar una vez, sin limpiar ni reimportar.                                              |
| 16       | [Precios y productos desde venta](migrations/20261123001600_precios_productos_venta.sql)              | Precio unitario autorizado por operación, sin cambiar el catálogo; alta idempotente de producto desde cuenta/factura. Ejecutar una vez sin limpiar ni reimportar.                                                           |
| 17       | [Zelle y Binance](migrations/20261123001700_metodos_pago.sql)                                         | Agrega ambos métodos a pagos iniciales, cobros, abonos de cuenta y proveedores/correcciones. Aplicar tras 016 sin limpiar ni reimportar.                                                                                    |
| 18       | [Facturación rápida](migrations/20261123001800_facturacion_rapida.sql)                                | Contado sin cuenta con factura registrada, clasificación de líneas y cola de productos sin cargar, con stock/vinculación/anulación trazables. Aplicar una vez tras 017, sin limpiar ni reimportar.                          |
| Utilidad | [Crear administrador](utilidades/crear_administrador.sql)                                             | Asigna el primer administrador a un usuario ya creado en Authentication. Antes de ejecutar, sustituye `CAMBIA-ESTO@ejemplo.com` por su correo.                                                                              |

Si ya aplicaste la base, no la repitas: continúa con las migraciones pendientes. No ejecutes fragmentos de las migraciones ni las apliques al sistema anterior. Estos archivos no se han aplicado a un Supabase remoto desde esta sesión.

Para el paso 8, crea primero el usuario desde **Authentication → Users → Add user**, con correo confirmado. Si ya existe un administrador activo, utiliza Configuración para dar otros accesos.

## Proyecto Supabase ANTERIOR: solo lectura

[Inspeccionar el origen](utilidades/inspeccionar_origen_solo_lectura.sql): consulta definiciones de vistas, triggers, funciones y conteos para investigar las diferencias históricas. Este archivo se ejecuta únicamente en el origen; no instala el sistema nuevo. Guarda los resultados de forma privada, fuera del repositorio público.

Consulta también los [pasos de compatibilidades](../docs/COMPATIBILIDADES.md) y la [instalación general](../README.md).

## Comprobar la carga en el Supabase NUEVO

[Verificar carga histórica](utilidades/verificar_carga_nueva.sql): solo consulta conteos de registros y lotes importados. No modifica datos.

## Diagnóstico del origen en un único resultado

[Diagnóstico único del origen](utilidades/diagnostico_origen_unico.sql): una consulta de solo lectura en el Supabase ANTERIOR. Exporta una fila con las definiciones de vistas, triggers y conteos de seis tablas; evita perder resultados al exportar varias consultas separadas. Comparte el CSV de forma privada.

## Reiniciar los datos de prueba antes de importar de cero

**Solo por autorización del propietario, en el Supabase NUEVO. No son migraciones de despliegue.**

- [Limpiar pruebas con respaldo privado · v1](utilidades/limpiar_pruebas_con_respaldo_v1.sql): copia las tablas y vacía los datos comerciales de prueba en una transacción. Conserva acceso, fotos, filtros y auditoría. No permite repetir el borrado sobre una nueva carga.
- [Restaurar la copia de pruebas · v1](utilidades/restaurar_respaldo_pruebas_v1.sql): recuperación opcional, solo si el destino sigue vacío. No ejecutar como continuación normal de la limpieza.

Ver [alcance, respaldo y pasos de nueva importación](../docs/LIMPIEZA_PRUEBAS.md). El resultado indica si SQL 007 está instalado; si falta, instalarlo una vez antes de usar la pantalla actual de Importar archivos. No se ha ejecutado la limpieza en Supabase desde el entorno de desarrollo.

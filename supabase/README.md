# SQL de ALEXMAR

## Proyecto Supabase NUEVO

Abre cada archivo y copia su contenido completo en **SQL Editor → New query → Run**, en este orden:

| Orden | Archivo | Para qué sirve |
| --- | --- | --- |
| 1 | [Base, catálogo e historial](migrations/20261115000100_base_catalogo_historial.sql) | Crea tablas, permisos, funciones y auditoría. Ejecutar una sola vez en el proyecto nuevo vacío. |
| 2 | [Compatibilidades verificadas](migrations/20261115000200_compatibilidades.sql) | Agrega gestión de compatibilidades y corrige el filtro conjunto de vehículo/año. Ejecutar una sola vez después de la base. |
| 3 | [Proveedores y reportes](migrations/20261115000300_proveedores_reportes.sql) | Directorio, permisos y métricas. Ejecutar una sola vez después de compatibilidades. |
| 4 | [Migración exacta](migrations/20261115000400_migracion_exacta.sql) | Importes sin redondeo y conciliación contra la regla aprobada de la vista. Ejecutar una sola vez después de proveedores y reportes. |
| 5 | [Crear administrador](utilidades/crear_administrador.sql) | Asigna el primer administrador a un usuario ya creado en Authentication. Antes de ejecutar, sustituye `CAMBIA-ESTO@ejemplo.com` por su correo. |

Si ya aplicaste la base, no la repitas: continúa con las migraciones pendientes. No ejecutes fragmentos de las migraciones ni las apliques al sistema anterior. Estos archivos no se han aplicado a un Supabase remoto desde esta sesión.

Para el paso 5, crea primero el usuario desde **Authentication → Users → Add user**, con correo confirmado. Si ya existe un administrador activo, utiliza Configuración para dar otros accesos.

## Proyecto Supabase ANTERIOR: solo lectura

[Inspeccionar el origen](utilidades/inspeccionar_origen_solo_lectura.sql): consulta definiciones de vistas, triggers, funciones y conteos para investigar las diferencias históricas. Este archivo se ejecuta únicamente en el origen; no instala el sistema nuevo. Guarda los resultados de forma privada, fuera del repositorio público.

Consulta también los [pasos de compatibilidades](../docs/COMPATIBILIDADES.md) y la [instalación general](../README.md).

## Comprobar la carga en el Supabase NUEVO

[Verificar carga histórica](utilidades/verificar_carga_nueva.sql): solo consulta conteos de registros y lotes importados. No modifica datos.

## Diagnóstico del origen en un único resultado

[Diagnóstico único del origen](utilidades/diagnostico_origen_unico.sql): una consulta de solo lectura en el Supabase ANTERIOR. Exporta una fila con las definiciones de vistas, triggers y conteos de seis tablas; evita perder resultados al exportar varias consultas separadas. Comparte el CSV de forma privada.

# Activar esta entrega desde el navegador

El código incluye logo transparente, diseño adaptable, compatibilidades verificadas, directorio de proveedores, métricas/reportes e importación exacta. No incorpora CSV comerciales ni credenciales. GitHub y el despliegue Vercel no ejecutan migraciones ni importan datos.

## 1. Preparar el Supabase nuevo

En **SQL Editor → New query → Run**, ejecuta solo los archivos pendientes, completos y en orden:

1. [002: compatibilidades](../supabase/migrations/20261115000200_compatibilidades.sql). Si ya existe y fue aplicada, no repetir.
2. [003: proveedores y reportes](../supabase/migrations/20261115000300_proveedores_reportes.sql). Si ya se aplicó, no repetir.
3. [004: migración exacta](../supabase/migrations/20261115000400_migracion_exacta.sql). Nueva en esta publicación; ejecutar una sola vez.

La base 001 y el administrador que ya creaste se conservan. No ejecutes estos archivos en el Supabase anterior. No elimines tablas para resolver un error: comparte su mensaje.

## 2. Comprobar Vercel

En el proyecto conectado a ALEXMAR, abre **Deployments** y comprueba que el despliegue de `main` corresponde al último commit y figura **Ready**. Si no se generó automáticamente, revisa **Settings → Git** y la integración autorizada; no desconectes otras integraciones a ciegas.

Confirma que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o ANON_KEY) pertenecen al Supabase NUEVO. No hace falta service_role. Si cambias variables, vuelve a desplegar. Comprueba el logo, inicio de sesión, proveedores y reportes con los roles correspondientes.

## 3. Cargar los CSV

Desde una sesión de administrador en **Importación**:

1. Adjunta inventario_rows.csv, clientes_rows.csv, detalle_cuentas_rows.csv y notas_rows.csv.
2. Pulsa **Analizar y conciliar**. No escribe en DB.
3. Revisa conteos, errores y diferencias de procedencia. El saldo elegido usa cargos menos abonos no eliminados, igual que la vista comprobada del origen; TITULO no cambia el saldo. El campo total_adeudado se conserva como original. No se redondea ningún importe.
4. Solo si la simulación es válida y el proyecto nuevo está vacío, marca la confirmación y pulsa **Confirmar importación**. Es una única transacción; cualquier error revierte la carga. Repetir el mismo lote no duplica filas.
5. Ejecuta [verificar_carga_nueva.sql](../supabase/utilidades/verificar_carga_nueva.sql) en el proyecto nuevo y comprueba registros, lote y fecha. Revisa cuentas conocidas, existencias y permisos desde la app.

No registres productos/clientes de prueba en el destino antes de la importación inicial: requiere tablas de negocio vacías. Proveedores puede estar vacío: el origen no tenía proveedores ni movimientos.

La prueba completa se ejecutó en PGlite local aislado. La carga en Supabase real y su aceptación siguen pendientes. Esta fase todavía no sustituye el sistema operativo completo: faltan ventas nuevas, compras, pagos, trabajos, nómina y gastos, entre otros pendientes de README.

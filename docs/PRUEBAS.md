# Pruebas de la entrega 1

Ejecutadas el 2026-11-15, sin acceso a bases reales.

## Resultado
- `npm run typecheck`: correcto.
- `npm run build`: correcto; 14 rutas y proxy. Funciona la compilación sin variables del proyecto y el acceso muestra conexión pendiente.
- `npm test`: cinco pruebas correctas.

## Cobertura técnica
1. Instalación completa en PostgreSQL embebido PGlite con extensiones reales unaccent y pg_trgm.
2. Búsqueda sin tildes y palabras en distinto orden; existencia inicial de cinco unidades.
3. Reintento de ajuste con la misma clave sin doble movimiento.
4. Rol ventas sin campo costo; escritura de stock y consulta directa de tablas bloqueadas. Usuario sin sesión bloqueado.
5. Estado de cuenta con 1.051 movimientos: última página accesible y saldo final calculado con todo el historial.
6. Importación rechazada ante diferencias de saldo; carga correcta de muestra sintética; repetición sin duplicados; stock de apertura conservado y rechazo de una segunda carga distinta sobre destino con datos.
7. Validación de CSV, encabezados, comas entrecomilladas, referencias rotas, IDs repetidos, negativos y precisión decimal.

## Pendiente de verificar
- Instalación final en Supabase real, Auth, permisos de todas las rutas y acceso con usuarios nuevos.
- Navegación visual completa en PC y teléfono. El Chromium local no pudo arrancar por restricciones del entorno (`socket() failed: Operation not permitted`); no se afirma una revisión visual realizada.
- Despliegue Vercel y despliegue automático desde GitHub de la cuenta de destino.
- Conciliación y carga de datos reales: NO realizadas. 104 diferencias y precisión superior a cuatro decimales bloquean la carga.
- Concurrencia de ventas/recepciones y restauración de respaldo corresponden a los módulos pendientes; no hay pruebas ficticias que los declaren correctos.

Las pruebas de PGlite validan SQL real pero no reproducen todas las particularidades del entorno Supabase/PostgREST. Es obligatoria una prueba en el proyecto nuevo antes de operar.

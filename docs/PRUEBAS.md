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

## Continuación: compatibilidades verificadas
- `npm test`: 6 pruebas aprobadas (ninguna omitida), incluyendo la migración nueva después de la base en PGlite.
- `npm run typecheck` y `npm run build`: correctos.
- Alta, edición, eliminación repetida sin doble auditoría, pertenencia al producto y duplicados ignorando tildes.
- Rechazo de rangos invertidos y universales contradictorios; años desconocidos no implican coincidencia de año.
- Filtro conjunto: Toyota 2010–2015 y Ford 2020–2025 no debe producir una coincidencia Toyota 2022.
- Roles administrador/inventario autorizados; ventas/lectura pueden consultar y no escribir; anon, sin sesión y usuario inactivo bloqueados. Tabla privada inaccesible directamente.
- 1.051 compatibilidades: 36 páginas, última fila accesible.
- Pendiente: navegación autenticada y prueba en Supabase independiente. No se verificó conexión remota ni datos reales.

## Identidad, proveedores y reportes
- 8 pruebas aprobadas: migraciones completas, CRUD de proveedores, filtrado sin tildes/estado/moneda, errores de validación, auditoría, usuario inactivo y permisos por rol.
- 1.051 proveedores: última página accesible. Inventario completo de 1.051 productos recuperado mediante el mismo colector que usan los reportes; lectura sin campos de costo.
- Métricas con reservas, mínimos y cuentas decimales exactas; USD/VES/COP separadas. Sin cuentas confidenciales para inventario/lectura; sin proveedores para ventas/lectura.
- Exportación rechaza truncamiento, duplicación de páginas y cambios de total. Sigue siendo posible que cambios simultáneos que no alteren IDs/conteos cambien valores entre páginas: no es un cierre contable transaccional.
- Tipos y compilación correctos. Chromium local: inicio HTTP 200 y logo cargado, escritorio 1440×1000 y móvil 390×844 sin desbordamiento horizontal; PNG con canal alfa.
- Sin revisión autenticada de formularios/exportaciones contra Supabase remoto, ni importación de datos reales. La web publicada quedó bloqueada por la red local (CONNECT 403).

## Publicación de la migración exacta
- `npm test`: 10 pruebas aprobadas, ninguna omitida. Las pruebas de la base original se mantienen para verificar su comportamiento histórico; las nuevas pruebas ejecutan las cuatro migraciones.
- `npm run typecheck` y `npm run build`: correctos.
- Migración 004: numeric sin escala fija, saldos según la vista aprobada, preservación del campo original, conciliación exacta antes/después, rechazos transaccionales, permisos e idempotencia con detección de reutilización de huella para otro contenido.
- Prueba privada de carga completa en PGlite aislado con los cuatro CSV recibidos: registros originales preservados, todos los importes de movimientos iguales a los originales, stock por producto igual al CSV y todos los saldos de clientes iguales a la simulación. Reintento sin duplicados. Los datos e informes detallados se mantienen fuera de Git.
- No se ejecutaron escrituras en Supabase remoto. No se afirma un despliegue Vercel exitoso solo por publicar en GitHub.

## Regresión del formulario de importación
- `node tests/importador.browser.mjs`: Chromium sobre fixture aislado del componente con datos sintéticos y API simulada; nunca conecta a Supabase. Requiere Chromium en /usr/bin/chromium o indicar CHROMIUM_PATH.
- Antes del cambio falla la comprobación de archivos retenidos (esperado uno, recibido cero). Después: analizar y confirmar envían los cuatro CSV y la huella, Confirmar exige aceptación, cambiar un archivo invalida la simulación y un error HTTP 502 mantiene archivos y muestra un aviso legible.
- `npm test`: diez pruebas correctas; `npm run typecheck` y `npm run build`: correctos. No se modificaron SQL ni reglas de dinero.

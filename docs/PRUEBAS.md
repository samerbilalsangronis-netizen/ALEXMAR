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

## Catálogo organizado tras importar
- `npm test`: 11 pruebas correctas. 005 se prueba sobre productos existentes, además de inserciones posteriores. Clasificación por nombre aunque la etiqueta original sea una marca, filtros combinados, año no inferido, personalización/restablecimiento, originales conservados, auditoría y permisos por rol.
- Grupos sobre 1.051 productos y última página accesible; las métricas y exportación completa siguen recuperando todos los registros. Las sugerencias se almacenan para evitar recalcular reglas en cada página.
- `node tests/catalogo.browser.mjs`: escritorio 1440 y móvil 390 sin desbordamiento; cambiar a vehículo, elegir Fiesta, reflejar el filtro en el selector y conservarlo en el enlace de retorno. Se probó también el catálogo con RPC 005 ausente. Fixture sintético y sesión simulada, sin escrituras remotas.
- La prueba de navegador detectó que los selectores no actualizaban defaultValue al navegar con enlaces; solucionado remontando el formulario cuando cambian los filtros en URL.
- Prueba privada: aplicar 005 después de cargar los CSV en PGlite aislado conserva originales, stock y saldos; los grupos de categoría cubren todo el catálogo vigente.
- No se ha ejecutado SQL 005 en el Supabase remoto desde este entorno.

## Facturación inicial y simplificación del tablero
- Nueva prueba SQL con todas las migraciones: presupuestos/borradores sin stock/cuenta/pagos, cliente/conceptos congelados al emitir, descuentos/gratuidad autorizados, precios de catálogo para ventas, impuesto 0, total decimal exacto, pago parcial, stock menos reservas, variantes repetidas agregadas, reintento sin duplicados y versión optimista del borrador.
- Anulación con reembolso obligatorio si hubo pago; stock y cuenta neutralizados mediante reversiones, sin borrar originales. Dos ventas compiten por stock insuficiente: la segunda se rechaza sin cargo, número ni salida parcial. PGlite valida estos casos secuenciales; falta prueba de sesiones concurrentes en Supabase independiente.
- Listado con más de mil documentos y controles por rol/usuario activo. Funciones y tablas privadas inaccesibles a roles no autorizados.
- Origen de POST: validación estricta de protocolo y Host, sin confiar en X-Forwarded-Host; admite desarrollo con 127.0.0.1 normalizado por Next. Rechaza orígenes ajenos, protocolo/puerto distinto, ruta en Origin o ausencia de cabecera.
- `node tests/facturacion.browser.mjs`: código real de componentes, API y acciones con backend/sesión sintéticos. Menú sin Importación, búsqueda, producto+servicio, pago inicial, guardado/revisión de borrador antes de emisión, impresión con escape HTML y 1440/390 px sin desbordamiento ni errores JavaScript. Sin operaciones reales.
- `node tests/catalogo.browser.mjs`: además comprueba minimizar/mostrar categorías y filtros, persistencia al recargar y buscador visible.
- No se afirma validez fiscal ni prueba de cobros reales, ni se aplicó SQL 006 remotamente.
- Resultado de la entrega: `npm test` ejecutó 13 pruebas correctas, sin omisiones. Facturación y catálogo pasaron sus recorridos de navegador con backend simulado; tipos y compilación correctos.

## Actualización posterior del origen
- 14 pruebas correctas, sin omisiones, incluidas las regresiones de inventario, facturación y carga inicial.
- Nueva prueba SQL de actualización: primera carga y luego altas de productos/clientes/movimientos/notas; stock ajustado por diferencia, precisión completa, reintento sin duplicación, versiones y reversiones financieras sin alterar el original.
- Preservación de clasificación personalizada y campos locales no afectados, bloqueo de conflictos sobre el mismo dato, archivos incompletos/antiguos y estado local cambiado desde la simulación. Roles no autorizados bloqueados.
- `node tests/importador.browser.mjs`: primera carga y actualización, cuatro archivos conservados, revisión enviada al confirmar, conflictos sin botón de confirmación y errores HTTP legibles. API simulada, sin escrituras remotas.
- Importar archivos queda restaurado temporalmente para administrador; no se oculta automáticamente. No se aplicó SQL ni se cargaron los CSV nuevos en la base real desde este entorno.

## Rediseño visual y analítica · 2026-11-17

- `npm test`: 15 pruebas aprobadas, sin omitidas. Nueva prueba SQL instala todas las migraciones, verifica conjuntos completos de costo/precio, ceros explícitos, datos faltantes, stock negativo, margen negativo, porcentaje ponderado, clasificación de Ford/NPR, filtros conjuntos y roles activos/inactivos. Las ventas se delimitan a días de Caracas, excluyen presupuestos/anuladas/borradores e historial. Verifica ranking, ticket sin ventas y rango inválido; lectura no recibe datos financieros y ventas no recibe costos.
- `npm run typecheck` y `npm run build`: aprobados.
- `node tests/redisenio.browser.mjs`: pantallas reales con sesión y datos sintéticos; temas claro/oscuro persistentes, selector del gráfico, historial separado, recorrido marca → modelo → pieza, conservación de marca al buscar y atajos contado/crédito. Resumen, inventario, reportes y nueva factura a 1440 y 390 px sin desbordamiento; se comprueban errores de hidratación. Capturas locales en test-results, excluidas de git.
- `node tests/catalogo.browser.mjs`: filtros, plegado persistente, grupos, retorno a ficha, 1440/390 y disponibilidad del catálogo con SQL pendiente.
- `node tests/facturacion.browser.mjs`: recorrido de cliente, piezas y servicios, guardar/revisar antes de emitir, impresión con escape HTML y 1440/390 sin errores ni desbordamiento; API y DB simuladas.
- Revisión visual de capturas en ambos temas. No hay credenciales del Supabase remoto en el entorno: no se aplicó SQL 008 ni se verificaron cifras reales del negocio. PostgreSQL embebido y simulación de navegador no sustituyen la aceptación con la sesión real del propietario después de activar el SQL nuevo.

## Filtros visuales, fotos y fallo de gráficos · 2026-11-17

- `npm test`: 17 pruebas aprobadas. SQL 009 probado expresamente con SQL 008 instalado y SQL 007 ausente: gráficos disponibles sin `procedencia_actual`. La prueba completa conserva margen, fechas Caracas, roles y exclusión de movimientos originales revertidos.
- Fotos: simulación local de las tablas Storage y RLS, bucket privado, lectura de usuarios activos, subida solo de administrador bajo su carpeta, ausencia de acceso directo al esquema, restricción de metadatos a archivos existentes y rechazo de rutas inválidas. Prueba de firma de JPG/PNG/WebP y rechazo de SVG/HTML. No se subieron fotos a Storage remoto.
- `node tests/redisenio.browser.mjs`: filtros principales sin desplegables, opción Disponible aplicada con un clic y conservada en URL; subida mediante el endpoint real con Storage/sesión simulados, refresco y foto visible; claro/oscuro, panel, inventario y reportes a 1440/390. Logo sin teléfono en acceso y tablero; con movimiento reducido no se anima. Captura del acceso centrado revisada visualmente. Datos y foto de prueba sintéticos.
- `node tests/catalogo.browser.mjs`: categorías/modelos, regreso a ficha, filtros y plegado persistentes; sin desbordamiento 1440/390; catálogo sigue disponible si falta clasificación.
- `npm run typecheck` y `npm run build`: aprobados. El recorrido de facturación anterior también pasó con el logo nuevo. El endpoint de fotos rechazó origen ajeno (403), rol ventas (403) y contenido SVG presentado como PNG (400), sin guardar metadatos.
- La corrección de los gráficos y las fotos en producción requieren aplicar SQL 009 una vez. Publicar el código no ejecuta esa consulta en Supabase ni confirma una carga real.

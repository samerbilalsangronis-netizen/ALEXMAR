# HANDOFF · ALEXMAR

## Ajuste visual y reparación de gráficos · 2026-11-17

El propietario rechazó los desplegables principales y solicitó fotos originales, logo animado sin teléfono y acceso centrado. Filtros principales convertidos a tarjetas/radios con iconos y aplicación de un clic; filtros técnicos siguen en Más filtros. Se conserva búsqueda, paginación, filtros guardados y plegado. Las tarjetas de marca/modelo permiten al administrador añadir/cambiar una foto original. Sin foto se indica pendiente: no se simula una fotografía con SVG. Fotos en bucket privado, URL firmada, validación de origen/sesión/rol/formato/tamaño y RLS. Ninguna foto original de vehículo fue suministrada todavía.

Se reprodujo el error de la captura: SQL 008 depende de `procedencia_actual` (007), ausente en la base del propietario. SQL 009 nuevo reemplaza la RPC sin esa dependencia, conservando métricas separadas y excluyendo originales revertidos. Agrega además metadatos/bucket/permisos de fotos. No editar ni repetir 008; el propietario aplica 009 completo una vez. No se ejecutó SQL remoto desde este entorno. Ver docs/FOTOS_Y_FILTROS.md.

Validación de esta actualización: 17 pruebas SQL/lógica aprobadas, tipos y compilación aprobados, incluido el estado sin 007 y las políticas de Storage; navegador con sesión/Storage simulados verifica selección visual, subida/API/refresco, acceso, logo y movimiento reducido a 1440/390.

Logo editado con imagegen para retirar solo la línea telefónica y mantener transparencia, nombre, mascota y localidad; archivo nuevo para evitar caché de la imagen anterior. Acceso centrado, tablero con logo real y entrada animada breve, estática con movimiento reducido; impresión comparte logo sin teléfono. Se conserva Importar archivos hasta aviso.

## Herramienta de diseño instalada · 2026-11-17

Por solicitud del propietario se instaló UI UX Pro Max para Codex en `.agents/skills/ui-ux-pro-max/`, usando el paquete oficial `ui-ux-pro-max-cli@2.15.0` del proyecto https://github.com/nextlevelbuilder/ui-ux-pro-max-skill. El instalador incluye también las habilidades auxiliares `design-system` y `slides`. Instalación local al repositorio; no modifica dependencias de la aplicación ni publica la web. Se verificó la búsqueda local con Python 3.12 mediante `search.py 'table keyboard navigation' --domain ux -n 1`, con resultado correcto. Consultar su SKILL.md para próximos trabajos de interfaz, respetando las reglas de ALEXMAR.

## Rediseño visual y analítica · 2026-11-17

Se aplica UI UX Pro Max con adaptación a la marca existente: sistema de tokens claro/oscuro, preferencia por navegador, búsqueda global, formularios/tablas adaptables y editor de factura en dos columnas con pasos y atajos de pago. Inventario abre por marca de vehículo (si SQL 008 está disponible), luego modelos y piezas con ilustraciones SVG propias. Marca del repuesto permanece independiente. Se conservan búsqueda, paginación, filtros guardados y plegado.

SQL 008 es nuevo: amplía la agrupación y añade `analitica_comercial`, solo lectura, con costo/margen para administrador/inventario y ventas/clientes para administrador/ventas. Margen potencial sobre existencia física positiva y pares completos costo/precio; no utilidad realizada. Ventas nuevas excluyen historia importada, anulaciones y presupuestos; actividad histórica aparece separada y etiquetada. Ver docs/REDISENIO_ANALITICA.md para fórmulas, fechas, límites y activación. No se modifican migraciones anteriores, datos reales ni reglas financieras. Mantener Importar archivos hasta aviso del propietario.

Pruebas locales: 15 pruebas SQL/lógica aprobadas, tipos y compilación aprobados. Navegador con datos sintéticos: temas persistentes y gráficos, navegación marca/modelo/pieza, filtros y plegado, y facturación revisada antes de emitir; 1440/390 sin desbordamiento. Ver docs/PRUEBAS.md.

La migración remota 008 queda a cargo del administrador en SQL Editor. La publicación del código no aplica SQL ni realiza una importación. No confundir las capturas sintéticas con métricas verificadas de la base del negocio.

## Estado vigente para esta publicación

El propietario pidió restablecer Importar archivos temporalmente para incorporar operaciones posteriores registradas solo en la aplicación anterior. La carga inicial ya se completó y no se debe repetir. Se incorpora actualización por diferencias con SQL 007, revisión e idempotencia. Mantener visible hasta que el propietario avise que terminó y solicite retirarlo; ver docs/ACTUALIZAR_ORIGEN.md.


Última actualización: 2026-11-17 (America/Caracas).
Destino: continuación del proyecto en Codex.
Repositorio: https://github.com/samerbilalsangronis-netizen/ALEXMAR
Rama de trabajo: `main`. El propietario prefiere cambios probados directamente en esta rama.
Commit de implementación de la entrega 1: `5c140917a861f9d819f38b4fae5ecf514f2ef5fa`.

## 1. Por dónde quedamos

Se creó y publicó la primera entrega sobre un repositorio inicialmente vacío. Es una base funcional por fases; **el sistema completo todavía no está terminado**.

El propietario continuará en Codex y pidió actualizar este HANDOFF. Su objetivo sigue siendo construir el sistema definido en `docs/ALCANCE.md`, no detenerse en la primera entrega.

En esta sesión no se conectó un Supabase nuevo, no se aplicó SQL a una base real, no se importaron datos reales y no se realizó despliegue en Vercel. El propietario podría hacerlo después: verificar su estado actual antes de asumir que sigue pendiente.

**Actualización importante sobre saldos:** los 108 clientes vigentes del CSV tienen `total_adeudado = 0`. Las 104 discrepancias detectadas surgen al comparar ese campo en cero con el cálculo de cargos menos abonos. **No está demostrado que existan 104 cuentas incorrectas.** Ver §5: este hallazgo matiza las referencias anteriores a discrepancias en README.md y DECISIONES.md.

## 2. Instrucciones y decisiones confirmadas

- Trabajar solo en ALEXMAR. No modificar Tierra Santa, la aplicación anterior de Alexmar ni sus bases.
- Supabase NUEVO e independiente. El propietario colocará las variables de entorno.
- Desplegar en otra cuenta de Vercel, con otro correo, manteniendo el repositorio en el GitHub actual. No copiar ni transferir el repositorio sin necesidad o nueva instrucción.
- La integración y permisos de GitHub en el Vercel de destino todavía deben comprobarse. No desconectar integraciones existentes a ciegas ni asegurar que el enlace ya funciona.
- Todo el dinero histórico recibido está en USD, confirmado expresamente por el propietario.
- Solo hay datos disponibles en inventario, clientes, detalle_cuentas y notas. El propietario indicó que lo demás está vacío.
- Español, interfaz sencilla para PC y teléfono. El propietario trabaja desde navegador: no pedirle terminal, Docker ni instalaciones.
- Nunca publicar CSV comerciales, datos de clientes, exportaciones o credenciales en el repositorio público.
- Migraciones nuevas y versionadas: no reescribir las que ya se hayan aplicado.
- Leer AGENTS.md, README.md, DECISIONES.md y docs/ALCANCE.md antes de continuar.

## 3. Qué está implementado

- Next.js 16.4.6, React 19.3.1, TypeScript estricto, Supabase SSR 0.12.7. Versiones de instalación registradas en package-lock.json.
- Login y cierre de sesión, renovación de sesión mediante proxy, navegación privada.
- Roles administrador, ventas, inventario y lectura; perfiles activos/inactivos.
- Esquema privado `alexmar`, RLS habilitado y sin acceso directo a tablas desde anon/authenticated. RPC públicas verifican usuario y rol. Costos excluidos por SQL para ventas y lectura.
- Catálogo paginado en servidor, búsqueda sin tildes y en cualquier orden, aproximaciones señaladas, referencia exacta priorizada.
- Filtros de categoría, marca, vehículo, año estructurado, precio, ubicación, existencias y estado. Orden, filtros en URL y consultas guardadas por usuario.
- Ficha editable, precio opcional, ajustes con motivo/responsable, bloqueo concurrente e idempotencia; kardex paginado.
- Clientes y estados de cuenta históricos por moneda, fechas America/Caracas, saldo anterior y final sobre todos los movimientos del filtro.
- Exportación CSV de todo el estado de cuenta y HTML completo para imprimir/guardar PDF.
- Notas privadas del administrador, asignación de perfiles.
- Importación inicial de cuatro CSV con simulación, validación, conciliación, transacción, datos originales e idempotencia. Solo admite destino vacío. Actualmente bloquea diferencias de saldo y pérdidas de precisión.

No hay aún ventas nuevas, compras, pagos nuevos, presupuestos, devoluciones, trabajos, nómina, gastos ni reportes avanzados. No presentar estos módulos como implementados.

## 4. Archivos y rutas para continuar

| Área | Archivos |
|---|---|
| Alcance completo | `docs/ALCANCE.md` |
| Instalación y límites | `README.md` |
| Reglas | `AGENTS.md`, `DECISIONES.md` |
| Base nueva | `supabase/migrations/20261115000100_base_catalogo_historial.sql` |
| Primer administrador | `supabase/utilidades/crear_administrador.sql` |
| Inspección de origen sin escribir | `supabase/utilidades/inspeccionar_origen_solo_lectura.sql` |
| Sesión y consultas | `src/lib/supabase.ts`, `src/proxy.ts` |
| Escrituras de formularios | `src/app/actions.ts` |
| Analizador de migración | `src/lib/migracion.ts` |
| API de migración | `src/app/api/migracion/route.ts` |
| Pantalla de simulación | `src/components/importador.tsx`, `src/app/(privado)/migracion/page.tsx` |
| Exportación histórica | `src/app/api/exportar/route.ts` |
| Pruebas y resultados | `tests/base.test.ts`, `tests/migracion.test.ts`, `docs/PRUEBAS.md` |

Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (alternativa admitida: `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Esta entrega no requiere clave de servicio.

## 5. Migración: hallazgos y corrección de interpretación

### Archivos recibidos, privados y fuera de git

| Archivo | Total | Vigentes | Eliminados |
|---|---:|---:|---:|
| inventario_rows.csv | 910 | 848 | 62 |
| clientes_rows.csv | 163 | 108 | 55 |
| detalle_cuentas_rows.csv | 3.637 | 2.737 | 900 |
| notas_rows.csv | 77 | 12 | 65 |

También se recibió `Supabase Snippet Untitled query (1).csv`: estructura de 132 columnas entre 14 tablas/vistas. El primer CSV de estructura tenía solo 100 filas y estaba truncado; usar el segundo.

Los adjuntos no están incluidos en este repositorio. Si no llegan al nuevo entorno de Codex, pedir al propietario que adjunte las exportaciones; no fingir que están disponibles ni buscarlas en el repositorio público.

### Inventario e historial

- No se encontraron IDs duplicados ni movimientos con cliente inexistente.
- Ningún movimiento de detalle_cuentas tiene id_producto vinculado. Conservar el texto histórico sin enlazar productos por parecido de nombre.
- Productos vigentes: 937 unidades físicas; 211 productos con stock; 110 sin precio y uno con precio cero; 476 sin costo.
- Hay ocho nombres de producto repetidos. No fusionarlos automáticamente.
- Los eliminados conservan 44 unidades de stock; preservarlos inactivos para revisión, no activarlos automáticamente.
- La existencia migrada es un movimiento de apertura. El historial anterior NO debe volver a descontar stock.
- Fotos/URLs originales se conservan en los datos de procedencia; la copia de Storage y visualización de fotos aún no está implementada.
- Las compatibilidades son texto libre del origen. No inferir vehículos, generaciones ni años; falta normalización y editor estructurado.

### Qué significan realmente las 104 diferencias

Revisión posterior a la entrega:
1. Los **108 clientes vigentes tienen total_adeudado en cero**.
2. En 104 de ellos, cargos vigentes menos abonos vigentes da un valor distinto de cero.
3. Por eso la comparación automática señala 104 diferencias. No demuestra por sí sola que el historial o la deuda mostrada en el sistema anterior sean incorrectos.
4. Hipótesis: el campo total_adeudado puede estar sin uso/desactualizado y el sistema anterior podría calcular la deuda mediante vista o movimientos. **Esto aún no está confirmado.**
5. Se explicó al propietario que se puede dejar de usar ese campo como criterio de conciliación si se comprueba la regla real. No se propuso eliminar cargos, abonos o deudas.
6. Última pregunta pendiente: si el sistema anterior muestra deuda en esos clientes pese a que ese campo exportado está en cero. El propietario no respondió esa pregunta: indicó que seguirá en Codex.

Regla propuesta: saldo = suma de CARGO no eliminados − suma de ABONO no eliminados; TITULO no altera saldo. Confirmar que coincide con el sistema anterior (definición de vista_saldos_clientes y/o dos o tres cuentas conocidas) antes de cambiar la validación.

**El código actual sigue bloqueando esta comparación.** La petición de actualizar el HANDOFF no autoriza a afirmar que se resolvió ni que se aprobó el cálculo. Si se confirma que total_adeudado no se usa, conservarlo como dato original y sustituir únicamente su papel de validación por una conciliación fiable. Cambiar tanto `analizar` en TypeScript como `public.importar_inicial` mediante una migración nueva; añadir pruebas y actualizar la documentación.

### Precisión: problema independiente

Hay números exportados con más de cuatro decimales, algunos con apariencia de residuos de coma flotante. El importador también los bloquea para no alterar importes silenciosamente. Preservar el texto original. La propuesta de cuatro decimales operativos requiere definir el tratamiento y verificar su impacto; no se ha aprobado ni aplicado un redondeo general.

### Secuencia de migración pendiente

- Verificar conteos de origen y definiciones mediante consultas de lectura (utilidad SQL ya preparada).
- Aclarar la regla de saldos y la precisión.
- Ajustar validación y RPC con pruebas; no editar el CSV para forzar coincidencias.
- Simular e importar primero en base de prueba, comprobar IDs, registros, stock y cuentas.
- Definir respaldo restaurable, reversión, fecha de corte y operaciones nuevas del origen.
- Presentar conciliación y procedimiento antes del paso final a producción.
- No ejecutar escrituras de prueba en la base anterior ni publicar información comercial.

## 6. Pruebas realizadas y límites

Sobre el commit de implementación:
- `npm run typecheck`: correcto.
- `npm run build`: correcto, incluso sin variables del Supabase nuevo.
- `npm test`: cinco pruebas aprobadas.
- PGlite con extensiones reales unaccent/pg_trgm: instalación SQL, búsqueda, permisos, costo oculto a ventas, ajuste idempotente y acceso directo bloqueado.
- Estado de cuenta con 1.051 movimientos: última página accesible y totales sobre el historial completo.
- Importación sintética: bloqueo de discrepancias, carga correcta, repetición sin duplicados y rechazo de segunda carga distinta sobre destino con datos.
- CSV: encabezados, comas entrecomilladas, referencias rotas, duplicados, negativos y precisión.
- Ninguna prueba escribió en una base real.

**No se realizó verificación visual completa.** Chromium no pudo arrancar por restricciones del entorno (socket no permitido). Pendiente revisar PC/teléfono, flujo autenticado, Supabase/PostgREST real y Vercel. PGlite no sustituye la prueba final del proyecto nuevo.

Esta actualización del HANDOFF modifica documentación únicamente; no cambia código, SQL, reglas ni datos.

## 7. Trabajo siguiente

Continuar sin rehacer lo implementado:
1. Comprobar situación del Supabase/Vercel nuevo y leer alcance/documentación.
2. Completar catálogo: variantes, unidades, compatibilidades estructuradas, proveedores, fotos, sugerencias con teclado y filtros restantes.
3. Compras/recepciones/cuentas por pagar; ventas de productos y servicios, presupuestos, pagos y aplicaciones, devoluciones/anulaciones transaccionales.
4. Trabajos/reservas; nómina por pagos y adelantos; gastos.
5. Reportes y Excel nativo, pruebas de concurrencia y restauración.
6. Resolver migración en paralelo a lo anterior; el campo en cero no debe bloquear el desarrollo independiente.

Propuestas no confirmadas: costo promedio ponderado por variante con costo histórico de venta; consumo de materiales al entregar trabajo mediante evento único compartido con factura; precisión operativa de cuatro decimales.

Documentar avances y mantener este HANDOFF actualizado. No declarar listo para operar hasta completar las funciones y criterios de aceptación del prompt maestro.


## Continuaciones en este entorno (registro cronológico; ver última actualización)

## Continuación: compatibilidades verificadas (2026-11-15)
- Ficha de inventario: consulta paginada, alta, edición y eliminación confirmada de marca/modelo, rango de años o universal. Administrador/inventario editan; ventas/lectura consultan. Las acciones comprueban rol y las RPC repiten la autorización. Se conserva la búsqueda de retorno y ambas paginaciones.
- Nueva migración `20261115000200_compatibilidades.sql`; no se modificó la base. Aprovecha RLS y auditoría existentes; valida rangos, duplicados normalizados y pertenencia al producto.
- Corregido filtro combinado de vehículo/año: ambos deben corresponder a la misma compatibilidad. Una compatibilidad sin ningún año conocido no confirma años concretos; el texto histórico sigue separado.
- Ver `docs/COMPATIBILIDADES.md` para aplicación desde SQL Editor. No aplicada a Supabase remoto ni publicada en GitHub desde esta continuación.
- Pruebas: 6 correctas, tipos y build correctos. Nueva cobertura de permisos, usuario inactivo, anon, CRUD, auditoría y última página de 1.051 compatibilidades. Sin revisión visual autenticada ni prueba de Supabase real.
- Siguiente bloque del catálogo: variantes con precio y existencia independientes, unidades y proveedores; después compras/ventas. Siguen pendientes las decisiones de costeo y conciliación histórica de DECISIONES.md.

## Continuación: identidad, proveedores y reportes (2026-11-15)
- El propietario confirmó despliegue en alexmar.vercel.app y creación del administrador. Compartió un CSV con presencia del índice y las tres RPC de compatibilidades; no constituye validación funcional remota completa.
- Logo recibido, preparado como PNG transparente en public/logo-alexmar.png e integrado en acceso y navegación. Interfaz naranja/grafito, navegación con ruta activa y mejoras de legibilidad/móvil. Los cambios anteriores se conservaron.
- Directorio real de proveedores (roles administrador/inventario), filtros, edición, desactivación y auditoría. Nueva migración 20261115000300_proveedores_reportes.sql; no se ejecutó remotamente.
- Reportes: métricas del catálogo activo; cuentas históricas separadas por moneda y rol; inventario paginado y CSV/HTML completos. No hay aún compras/cuentas por pagar ni métricas de ventas, utilidad, nómina o gastos. Ver docs/PROVEEDORES_REPORTES.md.
- No están los cuatro CSV comerciales en la instancia actual. No se cargó historia ni se resolvieron las 104 discrepancias o la regla decimal. Se preparó verificar_carga_nueva.sql (solo lectura) y se aclaró el flujo de importación en la app.
- Validación: 8 pruebas correctas, tipos y compilación. Navegador Chromium: acceso y logo en 1440 y 390 px, sin desbordamiento horizontal. Pantallas autenticadas/Supabase real pendientes. El proxy bloqueó el acceso a alexmar.vercel.app con CONNECT 403; no se observó la web publicada.
- Código y archivos locales sin push ni publicación. No modificar el borrador del entorno ni publicar por instrucción vigente del propietario. Para desplegar este código hará falta una instrucción explícita posterior.

## Revisión de CSV recibidos (2026-11-15)
- Ya se recibieron nuevamente los cuatro CSV comerciales. Se analizaron localmente sin escrituras en Supabase; informe y diferencias en privado/revision-historica/ (ignorado por Git). Los originales permanecen en attachments, fuera del checkout.
- Conteos: 910 productos/848 vigentes; 163 clientes/108 vigentes; 3.637 movimientos/2.737 vigentes; 77 notas/12 vigentes. Sin errores de formato ni referencias rotas detectados por el analizador actual.
- Confirmadas 104 discrepancias de saldo, que persisten calculando con precisión completa. Exactamente 7 valores de detalle_cuentas.total_linea exceden cuatro decimales. No se aprobó redondeo ni se cambió ninguna cifra.
- El propietario informa 0 lotes y fecha null. No se observó directamente su Supabase; este dato indica ausencia de lotes registrados, no prueba por sí solo que las tablas estén vacías.
- El CSV adicional contiene un inventario de 132 columnas del origen, no las definiciones de vistas/triggers. Confirma tablas proveedores y movimientos_proveedor; sus exportaciones aún no se recibieron.
- Preparado diagnostico_origen_unico.sql para ejecutar solo en el origen: una fila con vistas, triggers/funciones y seis conteos. Verificado en PGlite con esquema sintético dentro de una transacción de solo lectura. Falta el resultado real para explicar saldos y confirmar exportaciones completas.
- No se importaron datos, no se modificó lógica ni migraciones anteriores y no se publicó nada.

## Diagnóstico completo del origen recibido (2026-11-15)
- Recibido CSV con vistas, triggers y conteos. Los cuatro conteos de origen coinciden exactamente con los archivos recibidos (totales y vigentes); proveedores y movimientos_proveedor tienen cero filas, según resultado aportado por el propietario.
- vista_saldos_clientes calcula cargos menos abonos de movimientos no eliminados y no utiliza clientes.total_adeudado. Los triggers devueltos solo actualizan updated_at; no mantienen el campo de saldo.
- Se reprodujo localmente la definición recibida de la vista en PGlite, cargando los CSV sin redondeo en numeric. Los 108 saldos de clientes vigentes coinciden con el cálculo decimal independiente; 104 difieren del campo total_adeudado por más de 0.0001. Esto confirma la regla de la vista; no demuestra qué campo muestra cada pantalla del sistema anterior ni por qué se desactualizó/difiere el otro campo.
- Contraste detallado privado en privado/revision-historica/contraste-vista.csv, ignorado por Git. No publicar los CSV ni los informes con clientes.
- Pendientes dos decisiones del propietario, solicitadas en el chat: usar saldo de la vista conservando campo original, y preservar todos los decimales de los siete importes. No dar por aprobadas hasta respuesta explícita. Si se elige preservar precisión, adaptar mediante migración NUEVA, importador y pruebas; la base actual numeric(20,4) no permite importar esos valores sin pérdida.
- No se ejecutó importación remota ni se publicaron cambios.

## Publicación autorizada y prueba de carga exacta
- Se integró origin/main (incluida la aclaración sobre total_adeudado en cero), preservando documentación remota y continuaciones locales.
- Regla de vista y preservación de precisión aprobadas por "procede y publica". Nueva migración 004, sin editar migraciones anteriores. Firma nueva de importar_inicial exige la conciliación exacta; retira la función anterior para evitar cargas con reglas diferentes.
- El analizador conserva diferencias de procedencia como información y sigue bloqueando errores. El servidor vuelve a analizar y la DB valida todas las filas y concilia saldos antes y después de insertar. Numeric sin escala fija y aritmética decimal exacta dentro del rango validado.
- Prueba privada completa en PGlite: 4.787 originales, 163 saldos, 3.637 importes y stock de 910 productos verificados; sin duplicación al repetir. No publicar los informes ni los datos. Diez pruebas, tipos y build correctos.
- No hay variables Supabase configuradas en esta máquina (solo .env.example); no se efectuaron carga ni SQL remotos. El propietario debe aplicar solo las migraciones pendientes y usar Importación → Analizar y conciliar → Confirmar desde su sesión autenticada.
- Se autoriza publicar este código en main. La publicación del entorno cloud es independiente y no se solicitó cambiar su borrador. Verificar Vercel separadamente; un push no prueba un despliegue exitoso.

## Corrección del bucle de importación
- El propietario reportó que Confirmar exigía seleccionar de nuevo los CSV, y volver a seleccionarlos invalidaba la simulación.
- Reproducido en Chromium: form action de React reinicia los file inputs tras resolver la simulación. La prueba del componente detectó cero archivos donde debía quedar uno por campo.
- Corregido con envío manual onSubmit/preventDefault y captura explícita del botón pulsado; se conservan los archivos entre analizar y confirmar. Durante la petición se bloquea la selección de archivos, y al cambiarlos se invalida la simulación y la aceptación. Errores HTTP no JSON muestran estado sin perder los CSV.
- Prueba de navegador en tests/importador.browser.mjs: confirma que llegan los cuatro archivos y la huella a ambas peticiones, exige aceptación y vuelve a simular al cambiar un archivo. API simulada, sin acceso a datos reales ni escrituras remotas.
- Diez pruebas SQL/analizador, comprobación de tipos y build correctos. No requiere nuevas migraciones. Se publica la corrección en main bajo la autorización vigente.

## Inventario organizado después de la importación
- Importación remota completada según confirmación del propietario. No se repitió ninguna carga remota.
- Nueva migración 005: conserva categorías/compatibilidad originales y agrega sugerencias almacenadas derivadas del texto, con clasificación manual independiente y auditada. Reemplaza consultas mediante RPC autorizadas, sin exponer esquema privado ni costos a roles no permitidos.
- Inventario empieza con grupos por pieza/vehículo, conteos de todo el resultado, filtros combinables y consultas personales existentes. Los grupos no son una simple agrupación de la página visible. Fiesta se detecta también en nombres y etiquetas; no se certifica compatibilidad ni año desde texto libre. Los casos ambiguos quedan disponibles para revisión.
- Cada ficha permite personalizar categoría y grupos (administrador/inventario). Conservar campos vacíos vuelve a sugerencia. El regreso conserva página/filtros; los selectores se actualizan al navegar mediante links.
- Sugerencias calculadas al escribir el producto y filtro SQL integrable por el planificador; corregida lentitud al recorrer reportes completos. Si falta 005, se conserva la consulta anterior con aviso de activación; otros errores no se convierten en ceros.
- Validación: 11 pruebas correctas. Nueva prueba instala 005 después de crear datos y verifica más de mil productos, permisos, auditoría y clasificación personalizada. Los CSV se ensayaron en PGlite: grupos completos, sin alterar stock, importes, saldos ni procedencia. Informes privados fuera de Git.
- tests/catalogo.browser.mjs: agrupación, filtro Fiesta reflejado en formulario, regreso a ficha, falta de 005 y pantallas de 1440/390 px con datos/sesión simulados. Tipos/build correctos. SQL 005 no aplicado remotamente desde este entorno; propietario debe ejecutarlo una sola vez. No requiere migrar los datos de nuevo.

## Facturación, retiro de Importación y paneles plegables
- Incorporado menú Facturación para administrador/ventas y acceso desde Resumen. Importación retirada de ambos lugares; se mantienen datos y funciones históricas protegidas.
- Categorías/vehículos y filtros personalizados tienen Minimizar/Mostrar, preferencia local y atributos accesibles. Buscador visible y filtros activos conservados al minimizar.
- Nueva migración 006: ventas, líneas, pago inicial y FK de cuenta; RLS/esquema privado, RPC con autorización. Borradores/presupuestos editables sin efecto financiero. Emisión numerada, snapshot cliente/conceptos, stock disponible (reservas descontadas), cargo y abono inicial atómicos. Idempotencia, versión del borrador y bloqueos de variantes en orden estable.
- USD como catálogo, impuesto 0 confirmado. Totales exactos sin redondeo; costos y márgenes no implementados. Ventas no modifica precios de catálogo ni concede descuentos/gratuidad; administrador autoriza. Anulación completa auditada con reversiones y confirmación humana de reembolso si hubo cobro. No hay pagos posteriores ni devoluciones parciales aún.
- Búsqueda de clientes/productos paginada por API autenticada; presupuestos y facturas imprimibles/PDF completos con logo, estados y escape HTML. El código muestra activación pendiente si falta 006.
- Pruebas SQL: borrador sin movimientos, precio/stock/reservas, productos duplicados y servicios, crédito/pago parcial, reintentos sin duplicación, edición/versiones, rechazo de sobreventa sin efectos parciales, anulación/reembolso, snapshots, permisos y más de mil documentos.
- Navegador: flujo real de componentes/API/acciones con backend y sesión simulados; crear borrador, revisar antes de emitir, impresión con HTML escapado, menú sin Importación y pantallas 1440/390 px. Plegado/persistencia probado en catálogo. No se emitieron facturas ni se aplicó SQL en la base real desde este entorno.
- Pendiente para activar en remoto: SQL 006 una sola vez y despliegue Ready del commit nuevo. No reimportar datos. Se documenta esta como primera fase de facturación, no como finalización del sistema completo.

## Restauración temporal de Importar archivos y actualización de origen
- Solicitado por el propietario; confirmó operaciones nuevas solo en el sistema anterior. Restaurado acceso de administrador en menú y resumen. No autoocultar después de confirmar; esperar su aviso para retirarlo.
- El importador inicial no admite destinos con datos. Nueva migración 007 sin modificar SQL anteriores: revisiones de procedencia, estado de carga y RPC de actualización transaccional, exclusivamente administrador.
- Comparación por IDs y campos normalizados entre última versión del origen y valor actual. Conserva campos locales no modificados en origen; bloquea cambios incompatibles, IDs colisionados, archivos incompletos y versiones anteriores. El estado simulado se verifica otra vez bajo bloqueos antes de confirmar.
- Stock por diferencia con movimiento trazable; los movimientos de cuenta anteriores nunca se reescriben: reversión más versión nueva cuando corresponde. Los saldos de la parte migrada se concilian exactamente con los archivos y las operaciones locales independientes se preservan. Procedencia inicial intacta y revisiones posteriores privadas/auditadas.
- El formulario reutiliza los cuatro CSV completos (no solo los del día), conserva archivos entre analizar/confirmar, muestra nuevos/actualizados/sin cambios y detalle de valores Antes/Después. Confirmar requiere revisión y aceptación; lotes repetidos no se aplican otra vez. Si falta SQL 007, muestra cómo activarlo.
- Pruebas: actualización de las cuatro tablas, precisión, reintentos, stock por delta, correcciones/eliminación lógica con reversiones, conservación de clasificación, datos originales y campos locales; archivos incompletos/viejos y revisiones obsoletas bloqueados; permisos. El navegador prueba modo actualización y conservación de archivos con API simulada.
- No se aplicó SQL 007 ni se importaron los registros de hoy en el Supabase remoto desde este entorno. El propietario debe aplicar el SQL nuevo, exportar los CSV completos actuales, analizar y confirmar desde su sesión.

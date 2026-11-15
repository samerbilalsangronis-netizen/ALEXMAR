# HANDOFF · ALEXMAR

Última actualización: 2026-11-15 (America/Caracas).
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

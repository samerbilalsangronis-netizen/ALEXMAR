# Compatibilidades verificadas

En Inventario → ficha del producto → **Compatibilidades verificadas**, los roles administrador e inventario pueden añadir o editar marca/modelo y años opcionales. Para eliminar deben marcar la confirmación. Ventas y lectura pueden consultar. Cada cambio queda en la auditoría privada.

Para universal, marca la casilla y deja vacíos los demás campos. No marques universal si únicamente desconoces el vehículo: conserva el texto declarado y verifica primero. Sin años registrados, el registro sirve para buscar el vehículo, pero no confirma ningún año específico. Con un único extremo del rango, este es abierto por el extremo no indicado. Los años permitidos son 1886–2200; no se extraen del texto histórico.

El filtro de vehículo y año exige coincidencia en la misma compatibilidad. El texto declarado continúa disponible para búsquedas sin año; no se transforma automáticamente en una compatibilidad verificada. Las listas tienen páginas de 30 sin ocultar registros posteriores.

## Aplicar desde el navegador

1. Abre el **Supabase nuevo de prueba**, nunca el proyecto anterior ni producción.
2. Si aún no tiene esquema, aplica primero `supabase/migrations/20261115000100_base_catalogo_historial.sql` según README. No repitas esa migración si ya existe.
3. Abre [la migración nueva](../supabase/migrations/20261115000200_compatibilidades.sql), copia todo su contenido en **SQL Editor → New query** y pulsa **Run** una sola vez. Incluye BEGIN/COMMIT; no ejecutes fragmentos.
4. Usa la versión de la aplicación que acompaña esta migración y las variables del Supabase nuevo.
5. Con administrador/inventario: añade Toyota Hilux 2010–2015 y Ford Ranger 2020–2025 a un producto sintético. Busca Toyota Hilux en 2012: debe aparecer. Busca Toyota Hilux en 2022: debe quedar excluido si no tiene otra compatibilidad aplicable ni universal. Edita y elimina los registros de prueba.
6. Con ventas/lectura comprueba la consulta y la ausencia de formularios de edición. Las RPC bloquean escrituras incluso al invocarlas fuera de la interfaz.

Este archivo y la migración están preparados localmente; el enlace de GitHub de esta migración estará disponible después de publicar el commit. La conexión y la revisión visual autenticada siguen pendientes; las pruebas SQL se ejecutaron únicamente en PGlite con datos sintéticos.

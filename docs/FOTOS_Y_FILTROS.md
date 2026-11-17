# Filtros visuales, fotos y reparación de gráficos

## Activar la actualización

En el Supabase NUEVO abre SQL Editor → New query, pega completo [SQL 009](../supabase/migrations/20261117000900_graficos_fotos_vehiculos.sql) y pulsa Run una sola vez. Está pensado para el estado con SQL 008 ya aplicado. No vuelvas a importar ni repitas los SQL anteriores.

El error `relation alexmar.procedencia_actual does not exist` ocurre si la analítica 008 se ejecuta sin la vista de actualización de importaciones 007. SQL 009 reemplaza la consulta de analítica para que funcione en ambos estados. Usa los movimientos vigentes del origen y excluye los originales que tienen una reversión activa identificada, evitando contabilizar nuevamente correcciones. No modifica movimientos, stock ni importes. Tampoco sustituye el SQL 007 para futuras actualizaciones desde CSV: ese módulo conserva su migración específica.

La misma actualización agrega metadatos privados de fotos, funciones con control de rol y el bucket privado `alexmar-vehiculos`. Supabase trae Storage instalado; en pruebas SQL sin Storage se omite únicamente la instalación del bucket. La prueba específica usa tablas Storage simuladas con RLS para ejecutar y comprobar las políticas.

## Elegir piezas visualmente

- Categorías con iconos y tarjetas; disponibilidad, precio y orden mediante opciones visibles. Al pulsar se aplica el formulario completo con los términos y filtros actuales, reiniciando la página de resultados.
- Marca y modelo se eligen en las tarjetas de vehículos. El buscador, las consultas guardadas y Minimizar/Mostrar se conservan. Los campos técnicos continúan en Más filtros.
- Las fotografías son referencias para reconocer el vehículo. No certifican año, generación ni compatibilidad de una pieza.

## Subir fotografías originales desde la web

1. Entra como administrador y abre Inventario → Por marca o Por vehículo.
2. En la tarjeta correspondiente pulsa Añadir foto y selecciona una imagen JPG, PNG o WebP de hasta 3 MB. Se sube al seleccionarla.
3. La foto aparecerá en esa marca o modelo para los usuarios activos. Cambiar foto permite sustituirla. Se comparte por nombre de grupo; no cambia fichas de productos ni existencias.

Se usan fotos aportadas por el administrador; esta entrega no incluye fotos originales de los vehículos del negocio, porque todavía no se han recibido. No se presentan dibujos como fotografías reales. Las tarjetas pendientes lo indican.

Las imágenes están en Storage privado y se sirven con URL firmada de una hora. Si se dejó la página abierta mucho tiempo y la imagen caducó, recarga. El servidor verifica sesión, administrador, origen de la petición, tamaño, MIME y firma de archivo. No se aceptan SVG ni HTML. La base verifica rol activo y que el archivo exista en el bucket bajo la carpeta del usuario que sube. Las políticas permiten lectura a perfiles activos y escritura únicamente a administradores. No se necesita clave de servicio.

Si falla guardar los metadatos, se intenta retirar la nueva carga. Las versiones sustituidas se conservan en el bucket para evitar eliminar fotografías usadas por otra sesión o actualización concurrente; no hay todavía una herramienta de limpieza de versiones antiguas.

## Identidad

Logo sin número telefónico y con fondo transparente. Acceso centrado en PC y móvil. El tablero utiliza el logo real con una animación breve de entrada en lugar de la letra A. Con movimiento reducido se muestra estático. Las facturas impresas usan el mismo logo sin teléfono. La versión original con teléfono no se sirve en la nueva publicación.

# Notas con hoja de escritura

En **Notas**, pulsa **Nueva nota**. Se abre una hoja con título y contenido. Escribe, selecciona las letras y utiliza **Color de letra** o **Resaltar**. También puedes aplicar negrita, cursiva y subrayado, o deshacer/rehacer mientras trabajas en la hoja.

**Agregar sticker** abre ocho opciones: estrella, importante, listo, atención, corazón, vehículo, herramientas e idea. Se insertan en la posición del cursor y permanecen en la nota. Son stickers de la colección incluida; no se incorpora carga de archivos personalizados.

Pulsa **Guardar nota** para conservarla. **Abrir y editar** vuelve a cargar sus colores y contenido. Las notas importadas se muestran como texto sin cambios; reciben formato solo cuando el administrador las edita y guarda. La vuelta al listado conserva la página desde la que se editó.

La hoja es clara y legible en ambos temas. En escritorio y móvil, el botón de creación está en la cabecera y las herramientas tienen etiquetas y controles accesibles. Hay aviso de cambios sin guardar y confirmación al volver desde la hoja; al cerrar/recargar la pestaña, el navegador puede mostrar su aviso. No hay guardado automático ni almacenamiento de notas privadas en el navegador. El texto permanece en la hoja ante errores de guardado.

## Publicación y datos

Esta mejora **no necesita SQL adicional, limpieza ni importación**. Utiliza las funciones existentes `guardar_nota` y `listar_notas` y la columna `contenido`. El contenido enriquecido lleva un identificador de formato y fragmentos JSON con texto/estilos permitidos; se muestran con React como texto, sin insertar HTML. Se permiten hasta 50.000 caracteres y 3000 fragmentos, y títulos de 200 caracteres. Al pegar, se admite texto sin ejecutar HTML, imágenes ni enlaces externos.

Acceso exclusivo Administrativo, comprobado en página, acción de servidor y funciones existentes de la base. General continúa sin acceso. Se mantienen IDs al editar y al reintentar guardar; no se duplican notas con un mismo ID. El historial de la base continúa auditando las modificaciones. No se modifica el sistema anterior.

## Pruebas

`tests/notas.test.ts`: compatibilidad con texto antiguo, formato/precisión del texto, límites y estilos permitidos; guardado y edición reales con las RPC existentes sobre Postgres local, sin duplicados y con permisos de administrador/General/anon.

`tests/notas.browser.mjs`: página y acción reales, sesión/DB simuladas. Nueva hoja, selección y color/resaltado/negrita, sticker, error sin pérdida de contenido, guardado/reapertura, edición sin duplicar, pegado seguro, acceso General denegado y pantallas de 1440/390 en claro/oscuro. Ninguna escritura en producción.

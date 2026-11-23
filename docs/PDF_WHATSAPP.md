# PDF del cliente para WhatsApp · SQL 019

## Activar

En el **Supabase nuevo → SQL Editor → New query**, copia completo [SQL 019](../supabase/migrations/20261123001900_pdf_clientes_compartidos.sql) y pulsa **Run una sola vez** después de las actualizaciones anteriores. Cuando Vercel marque Listo, recarga la web. No requiere importar archivos ni cambiar claves de Vercel.

## Uso

1. Abre **Clientes y cuentas → cliente → Generar factura**.
2. Elige **Cuenta completa · Productos, abonos y saldo** o **Una factura registrada**. La cuenta completa se identifica como **Estado de cuenta**, sin fabricar una factura para movimientos antiguos. La factura individual conserva su número original y solo se ofrecen documentos emitidos del cliente, con paginación.
3. Pulsa **Generar PDF**. Se crea un archivo PDF real con logo ALEXMAR, ubicación, cliente, fecha, movimientos/productos y totales. Se incluyen todas las páginas y se muestran importes exactos cuando requieren más de dos decimales.
4. Usa **Ver PDF**, **Descargar PDF** o **Enviar por WhatsApp**. WhatsApp se abre con un mensaje y el enlace al PDF preparados; eliges destinatario y confirmas el envío.
5. Si el navegador/dispositivo permite compartir archivos, aparece **Compartir archivo PDF** para abrir el selector del sistema y elegir WhatsApp u otra aplicación. En equipos que no admiten adjuntar desde el navegador, el enlace abre directamente el PDF y también puedes descargarlo para adjuntarlo manualmente.

El destinatario puede abrir el enlace sin iniciar sesión en ALEXMAR. Cada enlace permite leer solo ese PDF, dura **7 días** y puede desactivarse con **Desactivar enlace** mientras se muestra en el diálogo. Los archivos ya descargados o enviados como adjuntos no se eliminan al desactivar un enlace. El PDF es una copia de la fecha de generación; no cambia con los abonos posteriores. Para enviar datos recientes, prepara otro PDF. Los enlaces anteriores conservan su vigencia hasta caducar o revocarse.

## Datos y permisos

Generar el documento no emite otra venta ni modifica deuda, stock, pagos o numeración. El estado de cuenta se obtiene en una sola operación de lectura con snapshot estable, recuperando todas las páginas, en USD. Los filtros de la pantalla no recortan esa cuenta completa. Una factura individual debe estar emitida y pertenecer al cliente de la ficha.

Solo Administrativo puede generar, listar facturas y revocar enlaces. La tabla privada `pdf_compartidos` tiene RLS, sin acceso directo desde General/anon. Se conserva el PDF en esa tabla, sin requerir service role ni un bucket público. La auditoría registra metadatos/actor, sin duplicar el archivo binario ni el hash en el log general. El token aleatorio de 256 bits se guarda únicamente como SHA-256; no existe listado público ni búsqueda por ID de cliente. El lector público devuelve solo PDF/nombre al presentar el token correcto, vigente y no revocado. No permite consultar la cuenta viva, editar datos ni generar documentos.

La descarga usa `application/pdf`, respuestas privadas sin caché, sin indexación y sin referrer. La generación tiene límite de 4 MB para mantener compatibilidad con el servidor de publicación; no se truncan páginas para reducir el archivo. Si una cuenta supera ese límite, continúa disponible la exportación completa habitual.

PDF generado con pdf-lib/fontkit y Open Sans regular/negrita incluidas con su licencia Apache 2.0; fuentes/logo se incluyen en el paquete del servidor. No se procesa HTML de los clientes como código.

## Verificación

- Prueba local sobre todo el esquema: cuenta de 75 movimientos (más que una página de DB), PDF multipágina válido, factura individual, misma copia de bytes para lector anónimo, token inválido, revocación/caducidad, rechazo de factura ajena, permisos de General y RLS.
- Lectura del PDF de prueba con `pdftotext`: último movimiento y saldo completo; vista renderizada revisada.
- Navegador con páginas/API/generador PDF reales y DB simulada: botón en la ficha, PDF válido, mensaje WhatsApp con enlace, Web Share de archivo simulado, desactivación con 404 y factura de otro cliente denegada. No se enviaron mensajes ni documentos reales por WhatsApp ni se escribió en Supabase remoto.

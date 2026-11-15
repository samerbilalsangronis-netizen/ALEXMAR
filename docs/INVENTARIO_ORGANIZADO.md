# Inventario organizado y filtros personales

El inventario abre con grupos y conteos calculados sobre todo el resultado autorizado, antes de paginar. Puedes cambiar entre **Por categoría** y **Por vehículo**, entrar a un grupo y combinarlo con búsqueda, estado, precio, existencias y los demás filtros.

## Clasificación

- Las categorías de pieza se sugieren por términos del nombre y las etiquetas: iluminación, espejos/retrovisores, electricidad/baterías, carrocería/exteriores, audio, interiores/protección, ruedas/accesorios, seguridad, limpieza y herramientas.
- **Por clasificar** conserva los productos cuyo texto no permite asignar una categoría clara. No se ocultan ni se fuerzan a una categoría arbitraria.
- Los grupos de vehículo se basan en menciones explícitas del nombre, categoría original y compatibilidad declarada. Las variantes mencionadas de Fiesta se reúnen en Fiesta, por ejemplo. No se deducen años ni se certifica compatibilidad.
- Una pieza puede aparecer en varios grupos de vehículo. Sus conteos pueden solaparse; no sumarlos como inventario adicional. Cada producto tiene una sola categoría de pieza.
- **Universal declarado**, marcas sin modelo y **Por identificar** distinguen el texto disponible de una compatibilidad técnica comprobada. El filtro de año continúa exigiendo compatibilidades verificadas.
- Las etiquetas originales se conservan y siguen disponibles en **Más filtros → Etiqueta original**. Stock, precios, movimientos y datos de procedencia no se alteran.

## Personalizar

Administrador e inventario pueden abrir una ficha → **Organización del catálogo → Personalizar categoría y grupos de vehículo**, escribir una categoría propia y grupos separados por coma. Las categorías nuevas aparecen automáticamente como filtros y grupos. Dejar los campos vacíos restablece la sugerencia automática. Las correcciones se auditan y prevalecen sobre la sugerencia. Ventas y lectura pueden consultar, sin editar.

Para guardar una combinación, aplica los filtros y abre **Guardar esta consulta**. Dale un nombre, por ejemplo «Mi Fiesta disponible». Queda guardada para tu usuario. El regreso desde una ficha conserva filtros, agrupación y página; al abrir un grupo se actualizan los valores visibles del formulario.

## Activar después de una importación existente

1. En el Supabase NUEVO, **SQL Editor → New query**.
2. Copia completo [20261115000500_catalogo_organizado.sql](../supabase/migrations/20261115000500_catalogo_organizado.sql) y ejecuta **Run** una sola vez, después de las migraciones 001–004 ya instaladas.
3. Comprueba el despliegue del último commit de `main` como **Ready** en Vercel y recarga Inventario.
4. Verifica grupos, busca un vehículo y abre una ficha para probar una clasificación manual.

**No repitas la importación ni las migraciones anteriores.** La migración genera la organización a partir de los productos existentes y la mantiene cuando se editan. Hasta aplicar 005, la web conserva el catálogo anterior y muestra que falta activar la organización; errores diferentes de una función ausente se muestran como errores.

## Validación

Pruebas SQL: migración sobre productos preexistentes, grupos sobre más de mil productos, filtros combinados, metadatos originales conservados, roles y auditoría. Navegador en 1440/390 px: grupos, selección Fiesta, retorno con filtros y disponibilidad del catálogo sin 005, con datos sintéticos y sesión/API simuladas. Se verificó también la migración después de cargar los CSV originales en PGlite local aislado; no se ejecutó SQL sobre la base remota desde este entorno.

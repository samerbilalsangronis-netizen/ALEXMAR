# Estado de ALEXMAR

Fecha: 2026-11-15. Entrega 1. El repositorio estaba vacío. No hay despliegue ni Supabase nuevo conectado desde esta sesión.

## Implementado
Acceso SSR, perfiles, navegación privada, catálogo/búsqueda/filtros con paginación, fichas y edición, ajustes y kardex, clientes y estados históricos por moneda, exportación CSV completa/HTML imprimible, notas, usuarios e importador con simulación y bloqueo por conciliación.

## Migración de esquema
`supabase/migrations/20261115000100_base_catalogo_historial.sql`: base privada, RLS, RPC con roles, auditoría y carga inicial. No aplicada a un Supabase real. SQL inicial envuelto en BEGIN/COMMIT. Bootstrap separado en `supabase/utilidades/crear_administrador.sql`.

## Datos recibidos (no incluidos en git)
910 productos, 163 clientes, 3.637 movimientos, 77 notas. Todos USD. 104 discrepancias de saldo entre clientes vigentes; precisión adicional en algunos importes. No se ha ejecutado una importación ni se han modificado originales.

## Qué impide operar
Faltan módulos de nuevas operaciones (ventas, compras, trabajos, pagos, nómina, gastos) y reportes avanzados. Importación bloqueada hasta explicar discrepancias y acordar precisión. No presentar esta entrega como reemplazo completo listo para producción.

## Próximo paso independiente
Completar catálogo y módulos de compras/ventas siguiendo el prompt maestro. En paralelo pedir definiciones de vista_saldos_clientes, triggers y funciones que gestionan detalle_cuentas/clientes, y conteos de origen. No pedir claves del proyecto anterior. El propietario debe crear el Supabase nuevo y conectar el Vercel de destino.

## Verificación
Ver docs/PRUEBAS.md. Pruebas técnicas aisladas; no se ha probado contra Supabase/Vercel reales.

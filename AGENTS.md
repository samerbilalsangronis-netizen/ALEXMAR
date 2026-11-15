# ALEXMAR · instrucciones de trabajo

Lee README.md, HANDOFF.md y DECISIONES.md antes de modificar.
- Solo trabajar en este repositorio. Tierra Santa y la base anterior son referencias de lectura; no escribir allí.
- Español, interfaz simple y adaptable. El propietario trabaja desde navegador.
- Nunca publicar datos comerciales, archivos CSV, credenciales ni información de clientes.
- SQL nuevo y versionado. No editar migraciones aplicadas. Entregar enlaces de GitHub y pasos del SQL Editor.
- Dinero decimal y funciones transaccionales. No ocultar errores como ceros ni elevar límites para simular paginación.
- Verificar usuario y permisos en servidor y DB. No habilitar acceso directo al esquema privado ni permitir que el cliente consulte costos sin permiso.
- No declarar terminado el sistema completo: esta base es una entrega por fases. Actualizar HANDOFF y pendientes con pruebas reales.
- Antes de push: npm test, npm run typecheck y npm run build. No probar escribiendo en producción.

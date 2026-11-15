import type { Pagina } from "./formatos";
export async function recuperarReporte<T extends { id: string }>(
  leerPagina: (pagina: number) => Promise<Pagina<T>>,
) {
  const filas: T[] = [];
  const ids = new Set<string>();
  let total: number | undefined;
  for (let pagina = 1; ; pagina++) {
    const d = await leerPagina(pagina);
    total ??= d.total;
    if (d.total !== total || (d.filas.length === 0 && filas.length < total))
      throw new Error(
        "Los datos cambiaron durante la descarga. Repite el reporte.",
      );
    for (const fila of d.filas) {
      if (ids.has(fila.id))
        throw new Error(
          "El catálogo cambió durante la descarga. Repite el reporte.",
        );
      ids.add(fila.id);
      filas.push(fila);
    }
    if (pagina >= d.paginas) break;
  }
  if (filas.length !== total)
    throw new Error("No se recuperaron todos los registros.");
  return filas;
}

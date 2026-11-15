export type GrupoInventario = { nombre: string; total: number };
export type GruposInventario = {
  total: number;
  categorias: GrupoInventario[];
  vehiculos: GrupoInventario[];
};
export type OpcionesCatalogo = {
  categorias: string[];
  categorias_origen: string[];
  vehiculos: string[];
  marcas: string[];
  consultas: { nombre: string; filtros: string }[];
};
export type ClasificacionProducto = {
  categoria: string;
  vehiculos: string[];
  categoria_manual: string | null;
  vehiculos_manuales: string[] | null;
};

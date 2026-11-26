export type AbonoEditable = {
  tipo: "cuenta" | "factura" | "historico";
  id: string;
  cliente_id: string;
  moneda: string;
  original: string;
  actual: string;
  metodo: string;
  referencia: string;
  creado: string;
  autor: string;
  revision: string;
  editable: boolean;
  impedimento: string;
  correcciones: number;
};
export type CorreccionAbono = {
  id: string;
  anterior: string;
  nuevo: string;
  metodo_anterior: string;
  metodo: string;
  referencia_anterior: string;
  referencia: string;
  motivo: string;
  creado: string;
  autor: string;
};

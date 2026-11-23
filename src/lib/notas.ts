// Formato propio: datos y estilos permitidos, nunca HTML ejecutable.
export const PREFIJO_NOTA = "ALEXMAR_NOTA_V1\n";
export const COLORES_NOTA = [
  ["Tinta", "#172b3a"],
  ["Rojo", "#b42318"],
  ["Naranja", "#a63c06"],
  ["Azul", "#175cd3"],
  ["Verde", "#067647"],
  ["Morado", "#6938a0"],
] as const;
export const RESALTADOS_NOTA = [
  ["Sin resaltado", "transparent"],
  ["Amarillo", "#fff1a8"],
  ["Rosa", "#ffd6e7"],
  ["Verde", "#c8f3d5"],
  ["Azul", "#d1e9ff"],
] as const;
export const STICKERS_NOTA = [
  ["Estrella", "⭐"],
  ["Importante", "📌"],
  ["Listo", "✅"],
  ["Atención", "⚠️"],
  ["Corazón", "❤️"],
  ["Vehículo", "🚗"],
  ["Herramientas", "🛠️"],
  ["Idea", "💡"],
] as const;
export type FragmentoNota = {
  texto: string;
  color?: string;
  fondo?: string;
  negrita?: boolean;
  cursiva?: boolean;
  subrayado?: boolean;
};
export function validarFragmentos(valor: unknown): FragmentoNota[] {
  if (!Array.isArray(valor) || valor.length > 3000)
    throw new Error("La nota admite hasta 3000 fragmentos de formato.");
  let longitud = 0;
  const fragmentos = valor.map((f: unknown) => {
    if (
      !f ||
      typeof f !== "object" ||
      !("texto" in f) ||
      typeof f.texto !== "string"
    )
      throw new Error("Contenido de nota inválido.");
    const dato = f as Record<string, unknown>;
    const limpio: FragmentoNota = { texto: f.texto };
    longitud += f.texto.length;
    if (longitud > 50000)
      throw new Error("La nota admite hasta 50.000 caracteres.");
    for (const campo of ["color", "fondo"] as const) {
      const permitidos = campo === "color" ? COLORES_NOTA : RESALTADOS_NOTA;
      if (dato[campo] !== undefined) {
        if (!permitidos.some(([, c]) => c === dato[campo]))
          throw new Error("Color de nota no permitido.");
        limpio[campo] = dato[campo] as string;
      }
    }
    for (const campo of ["negrita", "cursiva", "subrayado"] as const) {
      if (dato[campo] !== undefined && typeof dato[campo] !== "boolean")
        throw new Error("Formato de nota inválido.");
      if (dato[campo] === true) limpio[campo] = true;
    }
    return limpio;
  });
  return fragmentos;
}
export function guardarContenidoNota(fragmentos: unknown) {
  const limpios = validarFragmentos(fragmentos);
  if (!limpios.some((f) => f.texto.trim()))
    throw new Error("Escribe algo o añade un sticker antes de guardar.");
  return PREFIJO_NOTA + JSON.stringify({ version: 1, fragmentos: limpios });
}
export function leerContenidoNota(contenido: string): FragmentoNota[] {
  if (contenido.startsWith(PREFIJO_NOTA) && contenido.length <= 300000) {
    try {
      const doc = JSON.parse(contenido.slice(PREFIJO_NOTA.length));
      if (doc.version === 1) return validarFragmentos(doc.fragmentos);
    } catch {
      /* Las notas antiguas o dañadas se muestran literalmente como texto. */
    }
  }
  return [{ texto: contenido }];
}

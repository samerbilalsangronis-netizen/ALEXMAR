export type Acceso = "administrativo" | "general";
export function tipoAcceso(rol: string): Acceso {
  return rol === "administrador" ? "administrativo" : "general";
}
export function usuarioCanonico(valor: string) {
  const s = valor
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
  if (
    !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(s) ||
    s.endsWith(".") ||
    s.includes("..")
  )
    throw new Error(
      "Usa un usuario de 3 a 64 letras, números, puntos, guiones o espacios.",
    );
  return s;
}
export function correoDeUsuario(usuario: string) {
  return usuarioCanonico(usuario) + "@accesos.alexmar.invalid";
}
export function identificadorAuth(valor: string) {
  const s = valor.trim();
  if (s.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
      throw new Error("Identificador inválido.");
    return s.toLowerCase();
  }
  return correoDeUsuario(s);
}

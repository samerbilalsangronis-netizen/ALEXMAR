import {
  COLORES_NOTA,
  RESALTADOS_NOTA,
  validarFragmentos,
  type FragmentoNota,
} from "./notas";
function colorSeguro(
  valor: string,
  lista: readonly (readonly [string, string])[],
) {
  let c = valor.toLowerCase();
  const rgb = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb)
    c =
      "#" +
      rgb
        .slice(1)
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("");
  return lista.some(([, v]) => v === c) ? c : undefined;
}
// Se extraen exclusivamente texto y estilos conocidos; enlaces, imágenes y atributos se descartan.
export function extraerHoja(raiz: HTMLElement): FragmentoNota[] {
  const salida: FragmentoNota[] = [];
  function agregar(texto: string, formato: Omit<FragmentoNota, "texto">) {
    if (!texto) return;
    const anterior = salida.at(-1);
    if (
      anterior &&
      (["color", "fondo", "negrita", "cursiva", "subrayado"] as const).every(
        (campo) => anterior[campo] === formato[campo],
      )
    )
      anterior.texto += texto;
    else salida.push({ ...formato, texto });
  }
  function recorrer(nodo: Node, heredado: Omit<FragmentoNota, "texto">) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      agregar(nodo.textContent || "", heredado);
      return;
    }
    if (!(nodo instanceof HTMLElement)) return;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG"].includes(nodo.tagName))
      return;
    if (nodo.tagName === "BR") {
      agregar("\n", heredado);
      return;
    }
    const estilo = { ...heredado };
    const color = colorSeguro(
      nodo.style.color || nodo.getAttribute("color") || "",
      COLORES_NOTA,
    );
    const fondo = colorSeguro(nodo.style.backgroundColor, RESALTADOS_NOTA);
    if (color) estilo.color = color;
    if (fondo) estilo.fondo = fondo;
    if (
      ["B", "STRONG"].includes(nodo.tagName) ||
      ["bold", "700"].includes(nodo.style.fontWeight)
    )
      estilo.negrita = true;
    if (["I", "EM"].includes(nodo.tagName) || nodo.style.fontStyle === "italic")
      estilo.cursiva = true;
    if (nodo.tagName === "U" || nodo.style.textDecoration.includes("underline"))
      estilo.subrayado = true;
    if (["normal", "400"].includes(nodo.style.fontWeight))
      delete estilo.negrita;
    if (nodo.style.fontStyle === "normal") delete estilo.cursiva;
    if (nodo.style.textDecoration === "none") delete estilo.subrayado;
    const bloque =
      ["DIV", "P", "LI", "H1", "H2", "H3", "BLOCKQUOTE"].includes(
        nodo.tagName,
      ) && nodo !== raiz;
    if (bloque && salida.length && !salida.at(-1)!.texto.endsWith("\n"))
      agregar("\n", heredado);
    for (const hijo of nodo.childNodes) recorrer(hijo, estilo);
    if (bloque && nodo.nextSibling && !salida.at(-1)?.texto.endsWith("\n"))
      agregar("\n", heredado);
  }
  recorrer(raiz, {});
  return validarFragmentos(salida);
}

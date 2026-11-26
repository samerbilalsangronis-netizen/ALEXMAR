import DecimalBase from "decimal.js";
const Decimal = DecimalBase.clone({ precision: 128 });
export type RenglonLeido = {
  nombre: string;
  cantidad: string;
  costo: string;
  total: string;
  aviso?: string;
};
/** No inventa importes cuando la puntuación es ambigua. */
export function numeroFoto(raw: string): string | null {
  let s = raw.replace(/(?:USD|US\$|\$|Bs\.?)/gi, "").trim();
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (s.includes(",") && s.includes(".")) {
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    const [entero, fraccion, ...resto] = s.split(decimal);
    if (
      resto.length ||
      !/^\d{1,3}([.,]\d{3})+$/.test(entero) ||
      !/^\d+$/.test(fraccion)
    )
      return null;
    s = entero.split(miles).join("") + "." + fraccion;
  } else {
    if ((s.match(/[.,]/g) || []).length > 1) return null;
    if (/[.,]\d{3}$/.test(s)) return null; // 1.000 puede significar uno o mil.
    s = s.replace(",", ".");
  }
  try {
    const n = new Decimal(s);
    return n.isFinite() && n.gte(0) && n.lt("10000000000000000")
      ? n.toFixed()
      : null;
  } catch {
    return null;
  }
}
export function leerTextoFactura(texto: string) {
  const filas: RenglonLeido[] = [],
    omitidas: string[] = [];
  let total: string | null = null;
  for (const original of texto.split(/\r?\n/)) {
    const l = original
      .trim()
      .replace(/\s+/g, " ")
      .replace(/(?:US\$|USD|\$)/gi, "")
      .trim();
    if (!l) continue;
    if (/^total(?:\s+(?:general|factura|a pagar))?\s*[:=]?\s*\d/i.test(l)) {
      total = numeroFoto(
        l.replace(/^total(?:\s+(?:general|factura|a pagar))?\s*[:=]?\s*/i, ""),
      );
      continue;
    }
    if (
      /^(?:sub\s*total|iva\b|impuesto|rif\b|factura\b|fecha\b|cant(?:idad)?\b|descripci[oó]n\b|producto\b.*precio)/i.test(
        l,
      )
    )
      continue;
    // Cantidad · descripción · unitario · importe, o descripción · cantidad · unitario · importe.
    const a = l.match(/^(\d[\d.,]*)\s+(.+?)\s+(\d[\d.,]*)\s+(\d[\d.,]*)$/);
    const b = !a
      ? l.match(/^(.+?)\s+(\d[\d.,]*)\s+(\d[\d.,]*)\s+(\d[\d.,]*)$/)
      : null;
    if (!a && !b) {
      omitidas.push(original);
      continue;
    }
    const qty = numeroFoto(a ? a[1] : b![2]),
      nombre = (a ? a[2] : b![1]).trim(),
      cost = numeroFoto((a || b)![3]),
      importe = numeroFoto((a || b)![4]);
    if (!/[a-záéíóúñ]/i.test(nombre)) {
      omitidas.push(original);
      continue;
    }
    let aviso = "";
    if (!qty || new Decimal(qty).lte(0) || !cost || !importe)
      aviso = "Hay números ambiguos o ilegibles. Complétalos con la foto.";
    else if (!new Decimal(qty).times(cost).eq(importe))
      aviso = "Cantidad × costo no coincide con el importe leído.";
    filas.push({
      nombre,
      cantidad: qty || "",
      costo: cost || "",
      total: importe || "",
      ...(aviso ? { aviso } : {}),
    });
  }
  return { filas, omitidas, total };
}
export type FotoFactura = {
  nombre: string;
  mime: "image/jpeg";
  base64: string;
};

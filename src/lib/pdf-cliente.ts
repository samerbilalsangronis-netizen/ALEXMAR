import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Decimal from "decimal.js";
import { fecha, monto } from "./formatos";
import type { Venta } from "./ventas";
import type { Estado } from "@/app/(privado)/clientes/[id]/page";
function dinero(s: string | undefined) {
  if (s === undefined) return "—";
  const n = new Decimal(s);
  return monto(s) + (n.eq(n.toDecimalPlaces(2)) ? "" : " [" + s + "]");
}
export type DatosPdfCliente =
  | { tipo: "cuenta"; cuenta: Estado; generado: string }
  | { tipo: "factura"; factura: Venta; generado: string };
function partir(texto: string, fuente: PDFFont, tamano: number, ancho: number) {
  const lineas: string[] = [];
  for (const parrafo of texto.replace(/\r/g, "").split("\n")) {
    let linea = "";
    for (const palabra of parrafo.split(/\s+/)) {
      if (
        fuente.widthOfTextAtSize(
          (linea ? linea + " " : "") + palabra,
          tamano,
        ) <= ancho
      ) {
        linea += (linea ? " " : "") + palabra;
        continue;
      }
      if (linea) {
        lineas.push(linea);
        linea = "";
      }
      for (const c of palabra) {
        if (fuente.widthOfTextAtSize(linea + c, tamano) > ancho && linea) {
          lineas.push(linea);
          linea = "";
        }
        linea += c;
      }
    }
    lineas.push(linea);
  }
  return lineas;
}
export async function crearPdfCliente(
  datos: DatosPdfCliente,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, negrita, imagen] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/OpenSans-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/OpenSans-Bold.ttf")),
    readFile(join(process.cwd(), "public/logo-alexmar-sin-telefono.png")),
  ]);
  const font = await pdf.embedFont(regular, { subset: true }),
    bold = await pdf.embedFont(negrita, { subset: true }),
    logo = await pdf.embedPng(imagen);
  const titulo =
    datos.tipo === "cuenta"
      ? "ESTADO DE CUENTA"
      : "FACTURA V-" + String(datos.factura.numero).padStart(6, "0");
  const cliente =
    datos.tipo === "cuenta" ? datos.cuenta.cliente! : datos.factura.cliente;
  pdf.setTitle("ALEXMAR · " + titulo);
  pdf.setAuthor("ALEXMAR");
  pdf.setSubject(
    datos.tipo === "cuenta"
      ? "Cuenta completa del cliente"
      : "Factura del cliente",
  );
  let page = pdf.addPage([595.28, 841.89]),
    y = 800;
  let cabeceraContinuacion: (() => void) | null = null;
  function texto(t: string, x = 40, size = 10, f = font) {
    page.drawText(t, { x, y, size, font: f, color: rgb(0.1, 0.15, 0.19) });
  }
  function nueva() {
    page = pdf.addPage([595.28, 841.89]);
    y = 795;
    texto("ALEXMAR · " + titulo, 40, 11, bold);
    y -= 25;
    cabeceraContinuacion?.();
  }
  function bloque(t: string, size = 10, f = font) {
    for (const l of partir(t, f, size, 510)) {
      if (y < 55) nueva();
      texto(l, 40, size, f);
      y -= size + 5;
    }
  }
  page.drawImage(logo, { x: 40, y: 722, width: 75, height: 68 });
  texto("Autoperiquitos y Rotulados ALEXMAR", 130, 13, bold);
  y -= 22;
  texto("Tovar · Mérida · Venezuela", 130, 10);
  y -= 23;
  texto(titulo, 130, 12, bold);
  y = 700;
  bloque("Cliente: " + cliente.nombre, 12, bold);
  bloque(
    "Cédula / RIF: " +
      (cliente.documento || "—") +
      "   Teléfono: " +
      (cliente.telefono || "—"),
  );
  if (cliente.direccion) bloque("Dirección: " + cliente.direccion);
  bloque(
    "Generado: " +
      new Intl.DateTimeFormat("es-VE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Caracas",
      }).format(new Date(datos.generado)) +
      " · USD",
  );
  if (datos.tipo === "factura") {
    bloque(
      "Fecha: " +
        fecha(datos.factura.emitido || datos.factura.creado) +
        " · " +
        (datos.factura.condicion === "credito" ? "Crédito" : "Contado"),
    );
  }
  y -= 10;
  const columnas =
    datos.tipo === "cuenta" ? [40, 100, 342, 413, 482] : [40, 315, 386, 480];
  const anchos =
    datos.tipo === "cuenta" ? [56, 235, 65, 65, 70] : [267, 62, 84, 70];
  function fila(celdas: string[], cabecera = false) {
    const f = cabecera ? bold : font,
      size = cabecera ? 8 : 9;
    const envueltas = celdas.map((c, i) => partir(c, f, size, anchos[i] - 7));
    const n = Math.max(...envueltas.map((l) => l.length));
    for (let j = 0; j < n; j++) {
      if (y < 62) {
        nueva();
      }
      for (let i = 0; i < celdas.length; i++) {
        if (envueltas[i][j]) texto(envueltas[i][j], columnas[i], size, f);
      }
      y -= 14;
    }
    page.drawLine({
      start: { x: 40, y: y + 3 },
      end: { x: 555, y: y + 3 },
      thickness: 0.4,
      color: rgb(0.82, 0.84, 0.87),
    });
    y -= 9;
  }
  if (datos.tipo === "cuenta") {
    cabeceraContinuacion = () =>
      fila(["Fecha", "Producto / movimiento", "Cargo", "Abono", "Saldo"], true);
    cabeceraContinuacion();
    for (const m of datos.cuenta.filas) {
      const descripcion =
        m.descripcion +
        (m.cantidad && m.cantidad !== "null"
          ? " · Cantidad: " + m.cantidad
          : "") +
        (m.precio_unitario && m.precio_unitario !== "null"
          ? " · Precio: " + m.precio_unitario
          : "");
      fila([
        fecha(m.fecha),
        descripcion,
        m.tipo === "CARGO" ? dinero(m.importe) : "—",
        m.tipo === "ABONO" ? dinero(m.importe) : "—",
        dinero(m.saldo),
      ]);
    }
    cabeceraContinuacion = null;
    bloque("Total cargado: " + dinero(datos.cuenta.cargos));
    bloque("Total abonado: " + dinero(datos.cuenta.abonos));
    bloque("SALDO PENDIENTE: " + dinero(datos.cuenta.final), 13, bold);
    bloque("Saldo exacto USD: " + datos.cuenta.final, 8);
  } else {
    cabeceraContinuacion = () =>
      fila(["Descripción", "Cantidad", "Precio USD", "Total USD"], true);
    cabeceraContinuacion();
    for (const l of datos.factura.lineas)
      fila([l.descripcion, l.cantidad, dinero(l.precio), dinero(l.importe)]);
    cabeceraContinuacion = null;
    bloque("Subtotal: " + dinero(datos.factura.subtotal));
    if (new Decimal(datos.factura.descuento).gt(0))
      bloque("Descuento: " + dinero(datos.factura.descuento));
    bloque("Impuesto: 0 %");
    bloque("TOTAL FACTURA: " + dinero(datos.factura.total), 13, bold);
    bloque(
      "Abonado: " +
        dinero(datos.factura.pagado) +
        " · Pendiente: " +
        dinero(datos.factura.saldo),
    );
    bloque("Total exacto USD: " + datos.factura.total, 8);
    if (datos.factura.metodo_pago)
      bloque("Método del pago inicial: " + datos.factura.metodo_pago, 9);
    if (datos.factura.observaciones) bloque(datos.factura.observaciones, 9);
  }
  y -= 12;
  bloque(
    datos.tipo === "cuenta"
      ? "Este estado de cuenta reúne los movimientos registrados hasta la fecha de generación."
      : "Gracias por tu compra.",
    9,
  );
  const paginas = pdf.getPages();
  paginas.forEach((p, i) =>
    p.drawText(`ALEXMAR · ${i + 1} / ${paginas.length}`, {
      x: 40,
      y: 25,
      size: 8,
      font,
      color: rgb(0.4, 0.44, 0.48),
    }),
  );
  return pdf.save();
}

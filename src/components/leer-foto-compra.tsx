"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import {
  leerTextoFactura,
  type FotoFactura,
  type RenglonLeido,
} from "@/lib/lectura-factura";
export function LeerFotoCompra({
  cargar,
  disabled,
}: {
  cargar: (
    filas: RenglonLeido[],
    foto: FotoFactura,
    total: string | null,
    omitidas: string[],
  ) => Promise<void>;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [estado, setEstado] = useState(""),
    [texto, setTexto] = useState(""),
    [error, setError] = useState(""),
    [foto, setFoto] = useState<FotoFactura | null>(null);
  const worker = useRef<Awaited<
    ReturnType<(typeof import("tesseract.js"))["createWorker"]>
  > | null>(null);
  useEffect(
    () => () => {
      void worker.current?.terminate();
    },
    [],
  );
  async function leer(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setTexto("");
    setFoto(null);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 15000000
      )
        throw new Error("Selecciona una foto JPG, PNG o WebP de hasta 15 MB.");
      setEstado("Preparando foto…");
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      if (bitmap.width * bitmap.height > 50000000) {
        bitmap.close();
        throw new Error(
          "La imagen es demasiado grande. Usa una foto de menor resolución.",
        );
      }
      const ratio = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let data = canvas.toDataURL("image/jpeg", 0.86);
      if (data.length > 2750000) data = canvas.toDataURL("image/jpeg", 0.65);
      if (data.length > 2750000)
        throw new Error(
          "La foto sigue siendo demasiado grande. Recorta el documento e inténtalo de nuevo.",
        );
      const preparada: FotoFactura = {
        nombre: file.name.slice(0, 190) + ".jpg",
        mime: "image/jpeg",
        base64: data.split(",")[1],
      };
      const { createWorker } = await import("tesseract.js");
      worker.current = await createWorker("spa", 1, {
        workerPath: new URL("/ocr/worker.min.js", location.origin).href,
        corePath: new URL("/ocr/tesseract-core-lstm.wasm.js", location.origin)
          .href,
        langPath: new URL("/ocr", location.origin).href,
        cacheMethod: "none",
        logger: (m) =>
          setEstado(
            m.status === "recognizing text"
              ? "Leyendo documento: " + Math.round(m.progress * 100) + " %"
              : "Cargando lector…",
          ),
      });
      const { data: result } = await worker.current.recognize(data);
      setTexto(result.text);
      setFoto(preparada);
      setEstado("Lectura lista. Revisa el texto y carga las filas.");
      if (!result.text.trim())
        throw new Error("No se pudo leer texto. Usa otra foto con buena luz.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la foto.");
    } finally {
      await worker.current?.terminate();
      worker.current = null;
      setBusy(false);
    }
  }
  const leido = leerTextoFactura(texto);
  return (
    <section className="panel foto-compra no-imprimir">
      <div className="acciones">
        <Camera size={22} />
        <h2>Digitalizar factura</h2>
      </div>
      <p className="muted">
        Toma o selecciona una foto nítida. Revisa la tabla antes de confirmar la
        compra.
      </p>
      <label>
        Foto de factura
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={busy || disabled}
          onChange={(e) => void leer(e.target.files?.[0])}
        />
      </label>
      {estado && <p role="status">{estado}</p>}
      {error && (
        <p role="alert" className="aviso">
          {error}
        </p>
      )}
      {foto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="foto-factura-previa"
            src={"data:image/jpeg;base64," + foto.base64}
            alt="Factura que se va a digitalizar"
          />
          <details>
            <summary>Revisar texto leído</summary>
            <label>
              Texto de la factura
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={10}
              />
            </label>
          </details>
          <p>
            {leido.filas.length} líneas detectadas.{" "}
            {leido.total
              ? "Se contrastará el total leído con la tabla."
              : "No se identificó un total: compruébalo en la foto."}
          </p>
          {leido.omitidas.length > 0 && (
            <details>
              <summary>
                {leido.omitidas.length} líneas sin incorporar: revisar
              </summary>
              <pre className="texto-ocr">{leido.omitidas.join("\n")}</pre>
            </details>
          )}
          {leido.filas.some((f) => f.aviso) && (
            <p className="aviso">
              Hay importes para revisar. Las cifras ambiguas quedan vacías.
            </p>
          )}
          <button
            type="button"
            disabled={busy || disabled || !leido.filas.length}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setEstado("Contrastando productos con el inventario…");
                await cargar(leido.filas, foto, leido.total, leido.omitidas);
                setFoto(null);
                setTexto("");
                setEstado(
                  "Foto incorporada. Revisa productos y totales en la tabla.",
                );
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "No se pudieron cargar las filas.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <ScanLine size={17} />
            Cargar filas y foto para revisar
          </button>
        </>
      )}
    </section>
  );
}

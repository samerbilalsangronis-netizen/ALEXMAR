"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, MessageCircle, Share2 } from "lucide-react";
import { monto } from "@/lib/formatos";
type Enlace = {
  id: string;
  ruta: string;
  vence: string;
  nombre: string;
  tipo: string;
};
export function PdfCliente({ id, nombre }: { id: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false),
    [tipo, setTipo] = useState("cuenta"),
    [factura, setFactura] = useState(""),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [enlace, setEnlace] = useState<Enlace | null>(null),
    [archivo, setArchivo] = useState<File | null>(null),
    [pagina, setPagina] = useState(1),
    [paginas, setPaginas] = useState(1),
    [facturas, setFacturas] = useState<
      { id: string; numero: number; total: string }[]
    >([]);
  const dialogo = useRef<HTMLDialogElement>(null),
    op = useRef(false);
  useEffect(() => {
    if (abierto) dialogo.current?.showModal();
    else dialogo.current?.close();
  }, [abierto]);
  async function peticion(p: Record<string, unknown>) {
    const r = await fetch(`/api/clientes/${id}/documento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "No se pudo generar el documento.");
    return d;
  }
  useEffect(() => {
    if (!abierto || tipo !== "factura") return;
    let activo = true;
    setOcupado(true);
    setError("");
    peticion({ listar: true, pagina })
      .then((d) => {
        if (activo) {
          setFacturas(d.filas);
          setPaginas(d.paginas);
          setFactura("");
        }
      })
      .catch((e) => {
        if (activo) setError(e.message);
      })
      .finally(() => {
        if (activo) setOcupado(false);
      });
    return () => {
      activo = false;
    };
  }, [abierto, tipo, pagina, id]);
  async function generar() {
    if (op.current) return;
    op.current = true;
    setOcupado(true);
    setError("");
    setArchivo(null);
    try {
      const d = await peticion({
        factura: tipo === "factura" ? factura : null,
      });
      setEnlace(d);
      try {
        const r = await fetch(d.ruta, { cache: "no-store" });
        if (
          r.ok &&
          r.headers.get("Content-Type")?.includes("application/pdf")
        ) {
          const f = new File([await r.blob()], d.nombre, {
            type: "application/pdf",
          });
          if (navigator.canShare?.({ files: [f] })) setArchivo(f);
        }
      } catch {
        /* El enlace y la descarga siguen disponibles. */
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo generar el documento.",
      );
    } finally {
      op.current = false;
      setOcupado(false);
    }
  }
  async function revocar() {
    if (!enlace) return;
    setOcupado(true);
    setError("");
    try {
      await peticion({ revocar: enlace.id });
      setEnlace(null);
      setArchivo(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo desactivar el enlace.",
      );
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="boton secundario"
        onClick={() => setAbierto(true)}
      >
        <FileText size={17} aria-hidden="true" /> Generar factura
      </button>
      <dialog
        className="factura-dialogo"
        ref={dialogo}
        aria-label="Generar PDF del cliente"
        onCancel={() => setAbierto(false)}
      >
        <h2>Generar documento PDF</h2>
        <p>{nombre}</p>
        {!enlace ? (
          <>
            <label>
              Documento
              <select
                aria-label="Documento PDF"
                disabled={ocupado}
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="cuenta">
                  Cuenta completa · Productos, abonos y saldo
                </option>
                <option value="factura">Una factura registrada</option>
              </select>
            </label>
            {tipo === "cuenta" ? (
              <p className="muted">
                Genera un estado de cuenta completo, con logo ALEXMAR y todos
                los movimientos en USD.
              </p>
            ) : (
              <>
                <label>
                  Factura
                  <select
                    aria-label="Factura para PDF"
                    disabled={ocupado}
                    value={factura}
                    onChange={(e) => setFactura(e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    {facturas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {"V-" +
                          String(f.numero).padStart(6, "0") +
                          " · " +
                          monto(f.total)}
                      </option>
                    ))}
                  </select>
                </label>
                {!ocupado && !facturas.length && (
                  <p>
                    Este cliente no tiene facturas emitidas. Puedes generar su
                    cuenta completa.
                  </p>
                )}
                <div className="acciones">
                  <button
                    type="button"
                    className="secundario"
                    disabled={pagina <= 1 || ocupado}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    Anteriores
                  </button>
                  <span>
                    Página {pagina} de {paginas}
                  </span>
                  <button
                    type="button"
                    className="secundario"
                    disabled={pagina >= paginas || ocupado}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Siguientes
                  </button>
                </div>
              </>
            )}
            <p className="muted">
              Se creará un enlace que permite ver este PDF durante 7 días.
              Puedes desactivarlo después.
            </p>
            <button
              type="button"
              disabled={ocupado || (tipo === "factura" && !factura)}
              onClick={generar}
            >
              {ocupado ? "Generando PDF…" : "Generar PDF"}
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Este PDF conserva los datos del momento en que se generó.
            </p>
            <button
              type="button"
              className="secundario"
              disabled={ocupado}
              onClick={() => {
                setEnlace(null);
                setArchivo(null);
              }}
            >
              Preparar otro PDF actualizado
            </button>
            <p className="exito">
              PDF generado. Enlace válido hasta{" "}
              {new Intl.DateTimeFormat("es-VE", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/Caracas",
              }).format(new Date(enlace.vence))}
              .
            </p>
            <div className="acciones">
              <a
                className="boton secundario"
                href={enlace.ruta}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver PDF
              </a>
              <a
                className="boton secundario"
                href={enlace.ruta}
                download={enlace.nombre}
              >
                Descargar PDF
              </a>
              <a
                className="boton"
                href={
                  "https://wa.me/?text=" +
                  encodeURIComponent(
                    "Hola, compartimos tu " +
                      (enlace.tipo === "cuenta"
                        ? "estado de cuenta"
                        : "factura") +
                      " de ALEXMAR en PDF: " +
                      (typeof window !== "undefined"
                        ? window.location.origin
                        : "") +
                      enlace.ruta,
                  )
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={17} aria-hidden="true" /> Enviar por
                WhatsApp
              </a>
              {archivo && (
                <button
                  type="button"
                  className="secundario"
                  onClick={async () => {
                    try {
                      await navigator.share({
                        files: [archivo],
                        title: "ALEXMAR · Documento PDF",
                      });
                    } catch (e) {
                      if (!(e instanceof Error && e.name === "AbortError"))
                        setError(
                          "Utiliza Descargar PDF o Enviar por WhatsApp.",
                        );
                    }
                  }}
                >
                  <Share2 size={17} /> Compartir archivo PDF
                </button>
              )}
            </div>
            <button
              className="secundario peligro"
              type="button"
              disabled={ocupado}
              onClick={revocar}
            >
              Desactivar enlace
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="aviso">
            {error}
          </p>
        )}
        <p>
          <button
            type="button"
            className="secundario"
            onClick={() => setAbierto(false)}
          >
            Cerrar
          </button>
        </p>
      </dialog>
    </>
  );
}

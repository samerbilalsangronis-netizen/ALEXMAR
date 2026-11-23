"use client";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  Save,
  Undo2,
  Redo2,
} from "lucide-react";
import { guardarHojaNota } from "@/app/notas-actions";
import {
  COLORES_NOTA,
  RESALTADOS_NOTA,
  STICKERS_NOTA,
  leerContenidoNota,
} from "@/lib/notas";
import { extraerHoja } from "@/lib/notas-editor";
import { FragmentosNota } from "./contenido-nota";
export function EditorNota({
  id,
  titulo = "",
  contenido = "",
  regreso = "/notas",
}: {
  id: string;
  titulo?: string;
  contenido?: string;
  regreso?: string;
}) {
  const hoja = useRef<HTMLDivElement>(null),
    seleccion = useRef<Range | null>(null),
    alerta = useRef<HTMLParagraphElement>(null);
  const identificador = useRef(id).current;
  const inicial = useMemo(() => leerContenidoNota(contenido), [contenido]);
  const [estado, accion, pendiente] = useActionState(guardarHojaNota, {});
  const [errorLocal, setErrorLocal] = useState(""),
    [sucio, setSucio] = useState(false);
  const router = useRouter();
  const error = errorLocal || estado.error;
  useEffect(() => {
    if (error) alerta.current?.focus();
  }, [error]);
  useEffect(() => {
    if (estado.id) {
      setSucio(false);
      router.push(regreso + (regreso.includes("?") ? "&" : "?") + "guardado=1");
      router.refresh();
    }
  }, [estado, router, regreso]);
  useEffect(() => {
    if (!sucio) return;
    function salir(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", salir);
    return () => window.removeEventListener("beforeunload", salir);
  }, [sucio]);
  function recordarSeleccion() {
    const s = window.getSelection();
    if (
      s?.rangeCount &&
      hoja.current?.contains(s.getRangeAt(0).commonAncestorContainer)
    )
      seleccion.current = s.getRangeAt(0).cloneRange();
  }
  function aplicar(comando: string, valor?: string) {
    hoja.current?.focus({ preventScroll: true });
    const s = window.getSelection();
    if (seleccion.current && s) {
      s.removeAllRanges();
      s.addRange(seleccion.current);
    }
    document.execCommand(comando, false, valor);
    recordarSeleccion();
    setSucio(true);
  }
  return (
    <section className="cuaderno-nota">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrorLocal("");
          try {
            const f = new FormData(e.currentTarget);
            f.set("fragmentos", JSON.stringify(extraerHoja(hoja.current!)));
            startTransition(() => accion(f));
          } catch (e) {
            setErrorLocal(
              e instanceof Error ? e.message : "No se pudo leer la hoja.",
            );
          }
        }}
      >
        <input type="hidden" name="id" value={identificador} />
        <div className="nota-cabecera">
          <Link
            href={regreso}
            className="boton secundario"
            onClick={(e) => {
              if (
                sucio &&
                !window.confirm(
                  "Tienes cambios sin guardar. ¿Salir de la nota?",
                )
              )
                e.preventDefault();
            }}
          >
            <ArrowLeft size={17} aria-hidden="true" /> Volver a notas
          </Link>
          <span className="muted" role="status">
            {pendiente
              ? "Guardando…"
              : sucio
                ? "Cambios sin guardar"
                : "Nota privada"}
          </span>
          <button disabled={pendiente}>
            <Save size={17} aria-hidden="true" />{" "}
            {pendiente ? "Guardando…" : "Guardar nota"}
          </button>
        </div>
        <fieldset disabled={pendiente} className="nota-controles">
          <div
            className="nota-barra"
            role="group"
            aria-label="Formato de la nota"
          >
            <button
              type="button"
              className="secundario"
              aria-label="Negrita"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar("bold")}
            >
              <Bold size={18} />
            </button>
            <button
              type="button"
              className="secundario"
              aria-label="Cursiva"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar("italic")}
            >
              <Italic size={18} />
            </button>
            <button
              type="button"
              className="secundario"
              aria-label="Subrayado"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar("underline")}
            >
              <Underline size={18} />
            </button>
            <label>
              Color de letra
              <select
                aria-label="Color de letra"
                value=""
                onChange={(e) => aplicar("foreColor", e.target.value)}
              >
                <option value="" disabled>
                  Elegir color
                </option>
                {COLORES_NOTA.map(([n, c]) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Resaltar
              <select
                aria-label="Resaltar texto"
                value=""
                onChange={(e) => aplicar("hiliteColor", e.target.value)}
              >
                <option value="" disabled>
                  Elegir resaltado
                </option>
                {RESALTADOS_NOTA.map(([n, c]) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secundario"
              aria-label="Deshacer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar("undo")}
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              className="secundario"
              aria-label="Rehacer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar("redo")}
            >
              <Redo2 size={18} />
            </button>
          </div>
          <details className="nota-stickers">
            <summary>Agregar sticker</summary>
            <div className="acciones">
              {STICKERS_NOTA.map(([n, s]) => (
                <button
                  type="button"
                  className="secundario"
                  aria-label={"Sticker " + n}
                  key={n}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => aplicar("insertText", s + " ")}
                >
                  <span aria-hidden="true">{s}</span> {n}
                </button>
              ))}
            </div>
          </details>
          <p className="muted nota-ayuda" id="ayuda-nota">
            Selecciona las letras que quieras cambiar y elige un color o
            resaltado. Los stickers se insertan donde esté el cursor. Usa
            Guardar nota para conservar los cambios.
          </p>
          <div className="nota-papel">
            <label className="sr-only" htmlFor="titulo-nota">
              Título de la nota
            </label>
            <input
              id="titulo-nota"
              name="titulo"
              className="nota-titulo"
              defaultValue={titulo}
              maxLength={200}
              placeholder="Sin título"
              onChange={() => setSucio(true)}
            />
            <div
              ref={hoja}
              className="nota-hoja"
              role="textbox"
              aria-label="Contenido de la nota"
              aria-describedby="ayuda-nota"
              aria-multiline="true"
              contentEditable={!pendiente}
              suppressContentEditableWarning
              onInput={() => setSucio(true)}
              onMouseUp={recordarSeleccion}
              onKeyUp={recordarSeleccion}
              onBlur={recordarSeleccion}
              onPaste={(e) => {
                e.preventDefault();
                aplicar("insertText", e.clipboardData.getData("text/plain"));
              }}
              onDrop={(e) => e.preventDefault()}
            >
              <FragmentosNota fragmentos={inicial} />
            </div>
          </div>
        </fieldset>
        {error && (
          <p ref={alerta} role="alert" tabIndex={-1} className="aviso">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

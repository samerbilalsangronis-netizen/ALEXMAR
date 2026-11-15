"use client";
import { useState } from "react";
import type { analizar } from "@/lib/migracion";
import { tablas } from "@/lib/migracion";
type Informe = ReturnType<typeof analizar> & {
  huella: string;
  error?: string;
  importado?: boolean;
};
export function Importador() {
  const [informe, setInforme] = useState<Informe | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [acepta, setAcepta] = useState(false);
  async function enviar(form: FormData) {
    setOcupado(true);
    setError("");
    const confirmar = form.get("accion") === "confirmar";
    if (!confirmar) setAcepta(false);
    try {
      if (confirmar) {
        form.set("huella", informe?.huella || "");
      }
      const r = await fetch("/api/migracion", { method: "POST", body: form });
      if (!r.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          `El servidor no pudo procesar la importación (HTTP ${r.status}). Tus archivos siguen seleccionados; vuelve a intentarlo.`,
        );
      }
      const d = await r.json();
      if (!r.ok || d.error)
        throw new Error(
          d.error || `No se pudo procesar la importación (HTTP ${r.status}).`,
        );
      setInforme(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Una action de React reinicia los file inputs al resolver la promesa.
          // El envío manual conserva los mismos CSV entre simulación y confirmación.
          const form = new FormData(e.currentTarget);
          const boton = (e.nativeEvent as SubmitEvent).submitter;
          form.set(
            "accion",
            boton instanceof HTMLButtonElement && boton.value === "confirmar"
              ? "confirmar"
              : "simular",
          );
          void enviar(form);
        }}
        onChange={(e) => {
          if (
            e.target instanceof HTMLInputElement &&
            e.target.type === "file"
          ) {
            setInforme(null);
            setAcepta(false);
            setError("");
          }
        }}
      >
        <div className="formulario">
          {tablas.map((t) => (
            <label key={t} className="archivo">
              {t}.csv
              <input
                type="file"
                name={t}
                accept=".csv,text/csv"
                disabled={ocupado}
                required
              />
            </label>
          ))}
        </div>
        <div className="acciones">
          <button name="accion" value="simular" disabled={ocupado}>
            {ocupado ? "Procesando…" : "1. Analizar y conciliar"}
          </button>
          {informe?.puedeImportar && (
            <button
              name="accion"
              value="confirmar"
              disabled={ocupado || !acepta}
            >
              2. Confirmar importación
            </button>
          )}
        </div>
        {informe?.puedeImportar && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
            />
            Revisé la conciliación y autorizo cargar estos archivos en el
            proyecto nuevo vacío, usando cargos menos abonos y sin redondear los
            importes.
          </label>
        )}
      </form>
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
      {informe && (
        <section className="resultado">
          {informe.importado ? (
            <p className="exito">
              Importación confirmada. Consulta inventario, clientes y notas.
            </p>
          ) : (
            <>
              <h2>Resultado de la simulación</h2>
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Tabla</th>
                      <th>Total</th>
                      <th>Vigentes</th>
                      <th>Eliminados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(informe.resumen).map(([t, r]) => (
                      <tr key={t}>
                        <td>{t}</td>
                        <td>{r.total}</td>
                        <td>{r.vigentes}</td>
                        <td>{r.eliminados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {informe.errores.map((e, i) => (
                <p className="aviso" key={i}>
                  {e}
                </p>
              ))}
              {informe.advertencias.map((e, i) => (
                <p className="aviso" key={i}>
                  {e}
                </p>
              ))}
              {informe.diferencias.length > 0 && (
                <>
                  <p className="aviso">
                    Hay {informe.diferencias.length} diferencias entre el saldo
                    guardado y cargos menos abonos. La importación está basada
                    en la vista del origen: cargos menos abonos no eliminados.
                    El campo guardado se conserva como procedencia.
                  </p>
                  <div className="tabla-contenedor">
                    <table>
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Saldo guardado</th>
                          <th>Calculado</th>
                          <th>Diferencia USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {informe.diferencias.map((d) => (
                          <tr key={d.id}>
                            <td>{d.nombre}</td>
                            <td>{d.declarado}</td>
                            <td>{d.calculado}</td>
                            <td>{d.diferencia}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {informe.puedeImportar && (
                <p className="exito">
                  Validaciones correctas. Se usarán los saldos de la vista y se
                  conservarán todos los decimales y los datos originales. Revisa
                  los conteos y diferencias de procedencia antes de confirmar.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}

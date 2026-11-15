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
    try {
      if (confirmar) {
        form.set("huella", informe?.huella || "");
      }
      const r = await fetch("/api/migracion", { method: "POST", body: form });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
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
        action={enviar}
        onChange={(e) => {
          if (
            e.target instanceof HTMLInputElement &&
            e.target.type === "file"
          ) {
            setInforme(null);
            setAcepta(false);
          }
        }}
      >
        <div className="formulario">
          {tablas.map((t) => (
            <label key={t} className="archivo">
              {t}.csv
              <input type="file" name={t} accept=".csv,text/csv" required />
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
            proyecto nuevo vacío.
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
                    guardado y cargos menos abonos. La importación permanece
                    bloqueada hasta aclararlas.
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
                  Sin diferencias ni advertencias pendientes. Revisa los conteos
                  antes de autorizar.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}

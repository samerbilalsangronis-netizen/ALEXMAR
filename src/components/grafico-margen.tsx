"use client";
import { useState } from "react";
import { monto } from "@/lib/formatos";
import type { CategoriaMargen } from "@/lib/analitica";
export function GraficoMargen({ filas }: { filas: CategoriaMargen[] }) {
  const [campo, setCampo] = useState<"margen" | "venta" | "costo">("margen");
  const max = Math.max(...filas.map((f) => Math.abs(Number(f[campo]))), 1);
  return (
    <>
      <label className="selector-grafico">
        Comparar
        <select
          value={campo}
          onChange={(e) => setCampo(e.target.value as typeof campo)}
        >
          <option value="margen">Margen potencial USD</option>
          <option value="venta">Valor a precio de venta USD</option>
          <option value="costo">Valor al costo USD</option>
        </select>
      </label>
      {filas.length ? (
        <div className="barras" aria-label="Comparación por categoría">
          {filas.map((f) => (
            <div className="fila-barra" key={f.nombre}>
              <div>
                <span>{f.nombre}</span>
                <strong>{monto(f[campo])}</strong>
              </div>
              <div className="pista-barra">
                <span
                  className={Number(f[campo]) < 0 ? "negativa" : ""}
                  style={{
                    width: `${(Math.abs(Number(f[campo])) / max) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="vacio">
          Añade costo y precio a tus productos para comparar categorías.
        </p>
      )}
      <details className="datos-grafico">
        <summary>Ver datos y porcentajes</summary>
        <div className="tabla-contenedor">
          <table>
            <caption>Valores actuales · USD</caption>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Al costo</th>
                <th>A la venta</th>
                <th>Margen potencial</th>
                <th>Margen sobre venta</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.nombre}>
                  <td>{f.nombre}</td>
                  <td>{monto(f.costo)}</td>
                  <td>{monto(f.venta)}</td>
                  <td>{monto(f.margen)}</td>
                  <td>
                    {f.porcentaje === null
                      ? "Sin base de venta"
                      : Number(f.porcentaje).toLocaleString("es-VE", {
                          maximumFractionDigits: 2,
                        }) + " %"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

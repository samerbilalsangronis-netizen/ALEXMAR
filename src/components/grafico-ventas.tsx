"use client";
import { useId, useState } from "react";
import { monto } from "@/lib/formatos";
export type PuntoVentas = { fecha: string; total: string; facturas: number };
function etiqueta(fecha: string, semanal: boolean) {
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    ...(semanal ? {} : { weekday: "short" }),
  }).format(new Date(fecha + "T12:00:00Z"));
}
export function GraficoVentas({
  puntos,
  semanal = false,
}: {
  puntos: PuntoVentas[];
  semanal?: boolean;
}) {
  const id = useId();
  const [indice, setIndice] = useState(puntos.length - 1);
  const max = Math.max(...puntos.map((p) => Number(p.total)), 1),
    p = puntos[indice] || puntos.at(-1);
  return (
    <div className="grafico-ventas">
      <div className="grafico-ventas-lectura" id={id} aria-live="polite">
        {p && (
          <>
            <span>
              {semanal ? "Semana del " : ""}
              {etiqueta(p.fecha, semanal)}
            </span>
            <strong>{monto(p.total)}</strong>
            <small>
              {p.facturas} {p.facturas === 1 ? "factura" : "facturas"}
            </small>
          </>
        )}
      </div>
      <div
        className="grafico-ventas-barras"
        style={{
          gridTemplateColumns: `repeat(${puntos.length},minmax(0,1fr))`,
        }}
        aria-label={semanal ? "Ventas por semana" : "Ventas por día"}
      >
        {puntos.map((v, i) => (
          <button
            key={v.fecha}
            type="button"
            className={i === indice ? "activa" : ""}
            onClick={() => setIndice(i)}
            onFocus={() => setIndice(i)}
            onMouseEnter={() => setIndice(i)}
            aria-label={`${semanal ? "Semana del " : ""}${etiqueta(v.fecha, semanal)}: ${monto(v.total)}, ${v.facturas} facturas`}
            aria-pressed={i === indice}
            aria-describedby={id}
          >
            <span className="grafico-ventas-columna">
              <i
                style={{
                  height:
                    Math.max(
                      Number(v.total) > 0 ? 3 : 0,
                      (Number(v.total) / max) * 100,
                    ) + "%",
                }}
              />
            </span>
            <small>
              {semanal ? etiqueta(v.fecha, true) : v.fecha.slice(8)}
            </small>
          </button>
        ))}
      </div>
      <details className="grafico-ventas-datos">
        <summary>Ver datos del gráfico</summary>
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>{semanal ? "Semana del" : "Fecha"}</th>
                <th>Venta USD</th>
                <th>Facturas</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((v) => (
                <tr key={v.fecha}>
                  <td>{v.fecha}</td>
                  <td>{monto(v.total)}</td>
                  <td>{v.facturas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

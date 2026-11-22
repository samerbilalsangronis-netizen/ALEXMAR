import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { sesion } from "@/lib/supabase";
import { monto } from "@/lib/formatos";
import { GraficoVentas, type PuntoVentas } from "./grafico-ventas";
export type RendimientoDatos = {
  ahora: string;
  hoy: string;
  lunes: string;
  moneda: "USD";
  semana_actual: string;
  semana_anterior_comparable: string;
  diferencia: string;
  variacion_pct: string | null;
  facturas_semana: number;
  ventas_hoy: string;
  dias: PuntoVentas[];
  semanas: PuntoVentas[];
};
export async function RendimientoVentas() {
  const { db, perfil } = await sesion();
  if (!["administrador", "ventas"].includes(perfil.rol)) return null;
  const { data, error } = await db.rpc("rendimiento_ventas");
  if (error)
    return (
      <section className="aviso" role="alert">
        <h2>No se pudo cargar el rendimiento de ventas</h2>
        {["PGRST202", "42883"].includes(error.code) ? (
          <p>
            Aplica una vez el{" "}
            <a href="https://github.com/samerbilalsangronis-netizen/ALEXMAR/blob/main/supabase/migrations/20261122001200_control_stock_rendimiento.sql">
              SQL 012
            </a>{" "}
            para conectar las ventas diarias y semanales.
          </p>
        ) : (
          <p>{error.message}</p>
        )}
      </section>
    );
  const d = data as RendimientoDatos;
  const cambio = Number(d.diferencia),
    Icono = cambio > 0 ? TrendingUp : cambio < 0 ? TrendingDown : Minus;
  const variacion =
    d.variacion_pct === null
      ? Number(d.semana_actual) > 0
        ? "Sin ventas en el período anterior"
        : "Sin actividad en ambos períodos"
      : `${Number(d.variacion_pct) > 0 ? "+" : ""}${new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(Number(d.variacion_pct))} % frente al período anterior`;
  return (
    <section
      className="rendimiento-ventas"
      aria-label="Rendimiento diario y semanal"
    >
      <div className="indicadores rendimiento-totales">
        <article>
          <small>VENTAS DE HOY · USD</small>
          <strong>{monto(d.ventas_hoy)}</strong>
          <span>Día en curso · {d.hoy}</span>
        </article>
        <article>
          <small>ESTA SEMANA · USD</small>
          <strong>{monto(d.semana_actual)}</strong>
          <span>{d.facturas_semana} facturas · de lunes a ahora</span>
        </article>
        <article>
          <small>CAMBIO SEMANAL</small>
          <strong className={cambio < 0 ? "tendencia-baja" : "tendencia-alza"}>
            <Icono size={24} />
            {d.variacion_pct === null
              ? "Sin base comparable"
              : monto(d.diferencia)}
          </strong>
          <span>{variacion}</span>
        </article>
      </div>
      <div className="rendimiento-graficos">
        <article className="panel">
          <div className="titulo-seccion">
            <div>
              <span className="etiqueta">DÍA A DÍA</span>
              <h2>Ventas diarias</h2>
            </div>
            <span className="muted">Últimos 14 días</span>
          </div>
          <GraficoVentas puntos={d.dias} />
        </article>
        <article className="panel">
          <div className="titulo-seccion">
            <div>
              <span className="etiqueta">LA TENDENCIA</span>
              <h2>Ventas por semana</h2>
            </div>
            <span className="muted">Últimas 8 semanas</span>
          </div>
          <GraficoVentas puntos={d.semanas} semanal />
        </article>
      </div>
      <p className="rendimiento-nota">
        Comparación: lunes a ahora frente al mismo día y hora de la semana
        anterior ({monto(d.semana_anterior_comparable)}). La semana y el día
        actuales están en curso. Incluye facturas al contado y a crédito;
        excluye borradores, anuladas y movimientos del sistema anterior. Horario
        de Venezuela.
      </p>
      <Link className="rendimiento-enlace" href="/facturacion">
        Consultar facturas →
      </Link>
    </section>
  );
}

"use client";
import {
  Layers,
  Lightbulb,
  ShieldCheck,
  Volume2,
  BatteryCharging,
  Sparkles,
  Armchair,
  Disc3,
  CarFront,
  Wrench,
  Package,
  Check,
  Boxes,
  PackageX,
  ArrowUpDown,
  Tag,
  Coins,
} from "lucide-react";
function icono(texto: string) {
  const t = texto.toLowerCase();
  if (t.includes("ilumin")) return Lightbulb;
  if (t.includes("seguridad")) return ShieldCheck;
  if (t.includes("audio")) return Volume2;
  if (t.includes("electric")) return BatteryCharging;
  if (t.includes("limpieza")) return Sparkles;
  if (t.includes("interior")) return Armchair;
  if (t.includes("rueda")) return Disc3;
  if (t.includes("carrocer") || t.includes("espejo")) return CarFront;
  if (t.includes("herramient")) return Wrench;
  if (t.includes("agotad")) return PackageX;
  if (t.includes("disponib")) return Boxes;
  if (t.includes("precio")) return Tag;
  if (
    t.includes("existencia") ||
    t.includes("nombre") ||
    t.includes("relevancia")
  )
    return ArrowUpDown;
  return Package;
}
export function FiltroVisual({
  nombre,
  titulo,
  valor,
  opciones,
}: {
  nombre: string;
  titulo: string;
  valor: string;
  opciones: { valor: string; texto: string }[];
}) {
  return (
    <fieldset className={"filtro-visual filtro-" + nombre}>
      <legend>{titulo}</legend>
      <div className="opciones-visuales">
        {opciones.map((o, n) => {
          const Icono = o.valor ? icono(o.texto) : Layers;
          return (
            <label key={o.valor} className="opcion-visual">
              <input
                type="radio"
                name={nombre}
                value={o.valor}
                defaultChecked={valor === o.valor}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
              />
              <Icono size={21} aria-hidden="true" />
              <span>{o.texto}</span>
              <Check className="marca-elegida" size={14} aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

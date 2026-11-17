"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
export function Tema() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    setOscuro(document.documentElement.dataset.tema === "oscuro");
  }, []);
  function cambiar() {
    const siguiente = !oscuro;
    document.documentElement.dataset.tema = siguiente ? "oscuro" : "claro";
    try {
      localStorage.setItem("alexmar:tema", siguiente ? "oscuro" : "claro");
    } catch {}
    setOscuro(siguiente);
  }
  return (
    <button
      type="button"
      className="secundario tema"
      onClick={cambiar}
      aria-label={oscuro ? "Activar tema claro" : "Activar tema oscuro"}
    >
      {oscuro ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
      <span>{oscuro ? "Claro" : "Oscuro"}</span>
    </button>
  );
}

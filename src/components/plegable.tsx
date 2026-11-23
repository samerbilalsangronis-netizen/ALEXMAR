"use client";
import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
export function Plegable({
  titulo,
  preferencia,
  children,
  cerradoInicial = false,
}: {
  titulo: string;
  preferencia: string;
  children: React.ReactNode;
  cerradoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(!cerradoInicial);
  const id = useId();
  useEffect(() => {
    try {
      if (!cerradoInicial)
        setAbierto(localStorage.getItem(preferencia) !== "cerrado");
    } catch {}
  }, [preferencia, cerradoInicial]);
  function alternar() {
    setAbierto((v) => {
      try {
        localStorage.setItem(preferencia, v ? "cerrado" : "abierto");
      } catch {}
      return !v;
    });
  }
  return (
    <div className="plegable">
      <div className="plegable-cabecera">
        <strong>{titulo}</strong>
        <button
          type="button"
          className="secundario"
          onClick={alternar}
          aria-expanded={abierto}
          aria-controls={id}
          aria-label={
            (abierto ? "Minimizar " : "Mostrar ") + titulo.toLowerCase()
          }
        >
          {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{" "}
          {abierto ? "Minimizar" : "Mostrar"}
        </button>
      </div>
      <div id={id} hidden={!abierto}>
        {children}
      </div>
    </div>
  );
}

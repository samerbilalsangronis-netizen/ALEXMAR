"use client";
export function Imprimir() {
  return (
    <button className="secundario no-imprimir" onClick={() => window.print()}>
      Imprimir / Guardar PDF
    </button>
  );
}

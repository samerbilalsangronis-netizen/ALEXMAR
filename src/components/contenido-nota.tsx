import { leerContenidoNota, type FragmentoNota } from "@/lib/notas";
export function FragmentosNota({
  fragmentos,
}: {
  fragmentos: FragmentoNota[];
}) {
  return fragmentos
    .filter((f) => f.texto.length > 0)
    .map((f, i) => (
      <span
        key={i}
        style={{
          color: f.color,
          backgroundColor: f.fondo,
          fontWeight: f.negrita ? 700 : undefined,
          fontStyle: f.cursiva ? "italic" : undefined,
          textDecoration: f.subrayado ? "underline" : undefined,
        }}
      >
        {f.texto}
      </span>
    ));
}
export function ContenidoNota({ contenido }: { contenido: string }) {
  return (
    <div className="nota-texto">
      <FragmentosNota fragmentos={leerContenidoNota(contenido)} />
    </div>
  );
}

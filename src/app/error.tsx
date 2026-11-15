"use client";
export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="acceso">
      <section className="panel">
        <h1>No se pudo completar la consulta</h1>
        <p>
          Revisa la conexión y la instalación de la base nueva. Ningún dato se
          muestra como cero cuando falla una consulta.
        </p>
        <p className="aviso">
          {error.message.includes("digest")
            ? "La consulta falló. Intenta nuevamente."
            : error.message}
        </p>
        <button onClick={reset}>Reintentar</button>
        <a href="/">Volver al acceso</a>
      </section>
    </main>
  );
}

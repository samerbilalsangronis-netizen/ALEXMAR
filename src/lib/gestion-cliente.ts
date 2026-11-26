export async function guardarGestion(
  accion: string,
  datos: Record<string, unknown>,
) {
  const r = await fetch("/api/gestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion, datos }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
  return d;
}

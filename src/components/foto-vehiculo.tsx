"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload } from "lucide-react";
export function FotoVehiculo({
  nombre,
  url,
}: {
  nombre: string;
  url?: string;
}) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [url]);
  return url && !fallo ? (
    <img
      className="foto-vehiculo"
      src={url}
      alt={`Fotografía de referencia · ${nombre}`}
      onError={() => setFallo(true)}
      loading="lazy"
      width={640}
      height={400}
    />
  ) : (
    <div className="foto-pendiente">
      <Camera size={36} aria-hidden="true" />
      <span>{nombre}</span>
      <small>Foto real pendiente</small>
    </div>
  );
}
export function SubirFotoVehiculo({
  nombre,
  activado,
  tieneFoto,
}: {
  nombre: string;
  activado: boolean;
  tieneFoto: boolean;
}) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    const input = e.currentTarget;
    setError("");
    if (f.size > 3000000) {
      setError("La foto debe pesar menos de 3 MB.");
      input.value = "";
      return;
    }
    setOcupado(true);
    try {
      const datos = new FormData();
      datos.set("nombre", nombre);
      datos.set("foto", f);
      const r = await fetch("/api/vehiculos/foto", {
        method: "POST",
        body: datos,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo subir.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir.");
    } finally {
      setOcupado(false);
      input.value = "";
    }
  }
  return (
    <div className="subir-foto">
      {activado ? (
        <label className="boton secundario">
          <Upload size={15} aria-hidden="true" />
          {ocupado ? "Subiendo…" : tieneFoto ? "Cambiar foto" : "Añadir foto"}
          <input
            aria-label={"Foto real de " + nombre}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={subir}
            disabled={ocupado || !listo}
          />
        </label>
      ) : (
        <small>Activa las fotos con SQL 009</small>
      )}
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

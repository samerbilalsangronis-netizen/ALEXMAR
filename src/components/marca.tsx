import Image from "next/image";
export function Marca({ portada = false }: { portada?: boolean }) {
  return (
    <Image
      src="/logo-alexmar-sin-telefono.png"
      alt="Escudería Alexmar · Tovar, Mérida"
      width={1321}
      height={1191}
      priority={portada}
      className={portada ? "marca-imagen portada" : "marca-imagen"}
    />
  );
}

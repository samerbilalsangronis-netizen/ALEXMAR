import Image from "next/image";
import Link from "next/link";
import { Download, ArrowLeft } from "lucide-react";
import { Cabecera } from "@/components/comunes";
import { coleccionVehiculos } from "@/lib/imagenes-vehiculo";
export default function ImagenesVehiculos() {
  return (
    <>
      <Cabecera
        titulo="Tu colección de vehículos"
        subtitulo="20 imágenes de vehículos para reconocer modelos en el inventario. No certifican generación, año ni compatibilidad."
      >
        <Link className="boton secundario" href="/inventario">
          <ArrowLeft size={17} /> Volver al inventario
        </Link>
      </Cabecera>
      <p className="aviso">
        Se muestran automáticamente en las tarjetas que no tienen una foto
        original. Puedes sustituirlas usando Añadir foto en la marca o modelo.
        Cargo, 1721, 815 y Caribe quedan pendientes de identificar.
      </p>
      <div className="coleccion-vehiculos">
        {coleccionVehiculos.map((v) => (
          <article className="panel imagen-coleccion" key={v.slug}>
            <Image
              src={"/vehiculos/" + v.slug + ".png"}
              alt={"Vehículo de referencia · " + v.nombre}
              width={1536}
              height={1024}
              sizes="(max-width:700px) 90vw, (max-width:1100px) 45vw, 400px"
            />
            <div>
              <h2>{v.nombre}</h2>
              <a
                className="boton secundario"
                href={"/vehiculos/" + v.slug + ".png"}
                download={v.slug + ".png"}
              >
                <Download size={16} /> Descargar PNG
              </a>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

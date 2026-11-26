import { FormularioVivo } from "@/components/formulario-vivo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { consultar, sesion } from "@/lib/supabase";
import { guardarProveedor } from "@/app/actions";
import { Cabecera, Avisos, Paginacion } from "@/components/comunes";
import { pagina, type Pagina } from "@/lib/formatos";
type Proveedor = {
  id: string;
  nombre: string;
  activo: boolean;
  monedas: string[];
} & Record<string, unknown>;
const campos = [
  ["nombre", "Nombre de empresa, marca o vendedor"],
  ["documento", "Documento"],
  ["contacto", "Persona de contacto"],
  ["telefono", "Teléfono"],
  ["correo", "Correo"],
  ["ciudad", "Ciudad"],
  ["direccion", "Dirección"],
  ["categorias", "Categorías que suministra"],
  ["marcas", "Marcas que suministra"],
  ["condiciones", "Condiciones de pago"],
  ["notas", "Notas internas"],
] as const;
function Formulario({ dato }: { dato?: Proveedor }) {
  return (
    <form action={guardarProveedor} className="formulario">
      <input type="hidden" name="id" value={dato?.id || ""} />
      {campos.slice(0, 1).map(([k, label]) => (
        <label key={k}>
          {label}
          <input
            name={k}
            required={k === "nombre"}
            maxLength={k === "nombre" ? 200 : 2000}
            type={k === "correo" ? "email" : "text"}
            defaultValue={String(dato?.[k] || "")}
          />
        </label>
      ))}
      <details className="ancho-completo">
        <summary>Contacto y otros datos (opcional)</summary>
        <div className="formulario">
          {campos.slice(1).map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                name={k}
                maxLength={2000}
                type={k === "correo" ? "email" : "text"}
                defaultValue={String(dato?.[k] || "")}
              />
            </label>
          ))}
          <fieldset>
            <legend>Monedas aceptadas</legend>
            {["USD", "VES", "COP"].map((m) => (
              <label className="checkbox" key={m}>
                <input
                  type="checkbox"
                  name="monedas"
                  value={m}
                  defaultChecked={(dato?.monedas || ["USD"]).includes(m)}
                />
                {m}
              </label>
            ))}
          </fieldset>
        </div>
      </details>
      <input type="hidden" name="activo" value="on" />
      <button>Guardar proveedor</button>
    </form>
  );
}
export default async function Proveedores({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { perfil } = await sesion();
  if (!["administrador", "inventario"].includes(perfil.rol)) notFound();
  const p = await searchParams;
  const d = await consultar<Pagina<Proveedor>>("buscar_proveedores", {
    p: {
      q: p.q || "",
      estado: "activos",
      moneda: p.moneda || "",
      pagina: pagina(p.pagina),
    },
  });
  return (
    <>
      <Cabecera
        titulo="Tus proveedores"
        subtitulo="Recibe productos, actualiza existencias y consulta lo que debes a cada proveedor."
      />
      <Avisos p={p} />
      <section className="panel no-imprimir">
        <FormularioVivo className="filtros">
          <label>
            Buscar proveedor
            <input
              name="q"
              placeholder="Nombre, documento, ciudad o marca"
              defaultValue={p.q}
            />
          </label>
        </FormularioVivo>
      </section>
      <details className="panel no-imprimir">
        <summary>Registrar proveedor</summary>
        <Formulario />
      </details>
      <p className="muted">
        Abre un proveedor para registrar mercancía recibida, consultar sus
        productos y registrar pagos. Las recepciones confirmadas suman
        existencias automáticamente.
      </p>
      <div className="productos">
        {d.filas.map((c) => (
          <article key={c.id} className="producto">
            <div className="producto-superior">
              <span className="etiqueta">
                {String(c.ciudad || "PROVEEDOR")}
              </span>
            </div>
            {c.aproximado === true && <small>Coincidencia aproximada</small>}
            <h2>
              <Link href={"/proveedores/" + c.id}>{c.nombre}</Link>
            </h2>
            <p className="muted">
              {String(c.contacto || "Sin contacto registrado")}
            </p>
            <p>
              {String(c.telefono || "Sin teléfono")}
              <br />
              {String(c.correo || "")}
            </p>
            <p className="subtitulo">{c.monedas.join(" · ")}</p>
            <Link className="boton secundario" href={"/proveedores/" + c.id}>
              Abrir cuenta →
            </Link>
            <details>
              <summary>Ver y editar datos</summary>
              <Formulario dato={c} />
            </details>
          </article>
        ))}
      </div>
      {d.total === 0 && (
        <section className="vacio">
          <h2>No hay proveedores para esta consulta</h2>
          <p>Registra el primero o revisa los filtros.</p>
        </section>
      )}
      <Paginacion
        {...d}
        ruta="/proveedores"
        parametros={{
          q: p.q || "",
          estado: "activos",
          moneda: p.moneda || "",
        }}
      />
    </>
  );
}

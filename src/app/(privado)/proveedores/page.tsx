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
  ["nombre", "Nombre o razón social"],
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
      {campos.map(([k, label]) => (
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
      <label className="checkbox">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={dato?.activo ?? true}
        />
        Proveedor activo
      </label>
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
      estado: p.estado || "activos",
      moneda: p.moneda || "",
      pagina: pagina(p.pagina),
    },
  });
  return (
    <>
      <Cabecera
        titulo="Tus proveedores"
        subtitulo="Contactos y condiciones comerciales, siempre a mano."
      />
      <Avisos p={p} />
      <section className="panel no-imprimir">
        <form className="filtros">
          <label>
            Buscar proveedor
            <input
              name="q"
              placeholder="Nombre, documento, ciudad o marca"
              defaultValue={p.q}
            />
          </label>
          <label>
            Estado
            <select name="estado" defaultValue={p.estado || "activos"}>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <label>
            Moneda
            <select name="moneda" defaultValue={p.moneda || ""}>
              <option value="">Todas</option>
              {["USD", "VES", "COP"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <button>Buscar</button>
        </form>
      </section>
      <details className="panel no-imprimir">
        <summary>Registrar proveedor</summary>
        <Formulario />
      </details>
      <p className="muted">
        Directorio comercial. Las compras, recepciones y cuentas por pagar
        todavía están pendientes; aquí no se calculan saldos.
      </p>
      <div className="productos">
        {d.filas.map((c) => (
          <article key={c.id} className="producto">
            <div className="producto-superior">
              <span className="etiqueta">
                {String(c.ciudad || "PROVEEDOR")}
              </span>
              <span className={"estado " + (c.activo ? "verde" : "ambar")}>
                {c.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
            <h2>{c.nombre}</h2>
            <p className="muted">
              {String(c.contacto || "Sin contacto registrado")}
            </p>
            <p>
              {String(c.telefono || "Sin teléfono")}
              <br />
              {String(c.correo || "")}
            </p>
            <p className="subtitulo">{c.monedas.join(" · ")}</p>
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
          estado: p.estado || "activos",
          moneda: p.moneda || "",
        }}
      />
    </>
  );
}

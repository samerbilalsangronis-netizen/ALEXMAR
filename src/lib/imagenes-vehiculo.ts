/** Referencias generadas por IA; no certifican año ni compatibilidad. */
export const coleccionVehiculos = [
  {
    nombre: "Fiesta",
    slug: "fiesta",
    descripcion:
      "Ford Fiesta Power, five-door compact hatchback commonly seen in Venezuela, mid-2000s body style",
  },
  {
    nombre: "Hilux",
    slug: "hilux",
    descripcion: "Toyota Hilux double-cab pickup, late-2000s body style",
  },
  {
    nombre: "Corolla",
    slug: "corolla",
    descripcion:
      "Toyota Corolla compact four-door sedan, early-2000s body style",
  },
  {
    nombre: "Aveo",
    slug: "aveo",
    descripcion:
      "Chevrolet Aveo four-door compact sedan, late-2000s body style",
  },
  {
    nombre: "D-Max",
    slug: "d-max",
    descripcion: "Isuzu D-Max first-generation double-cab pickup",
  },
  {
    nombre: "NPR",
    slug: "npr",
    descripcion:
      "Isuzu NPR light-duty cab-over commercial truck, white cab, short plain flatbed, two axles",
  },
  {
    nombre: "FVR",
    slug: "fvr",
    descripcion:
      "Isuzu FVR medium-duty cab-over commercial truck, substantial white cab, medium plain flatbed, two axles; visibly larger than an NPR",
  },
  {
    nombre: "Corsa",
    slug: "corsa",
    descripcion:
      "Chevrolet Corsa compact four-door sedan, classic late-1990s to early-2000s Latin American body style",
  },
  {
    nombre: "Bronco",
    slug: "bronco",
    descripcion:
      "Ford Bronco full-size two-door SUV, classic mid-1990s body style",
  },
  {
    nombre: "Runner",
    slug: "runner",
    descripcion: "Toyota 4Runner third-generation five-door SUV",
  },
  {
    nombre: "Ford Ka",
    slug: "ford-ka",
    descripcion: "Ford Ka first-generation small three-door hatchback",
  },
  {
    nombre: "Silverado",
    slug: "silverado",
    descripcion:
      "Chevrolet Silverado full-size extended-cab pickup, early-2000s body style",
  },
  {
    nombre: "Fortuner",
    slug: "fortuner",
    descripcion: "Toyota Fortuner first-generation five-door SUV",
  },
  {
    nombre: "BT-50",
    slug: "bt-50",
    descripcion: "Mazda BT-50 first-generation double-cab pickup",
  },
  {
    nombre: "Samurai",
    slug: "samurai",
    descripcion:
      "Suzuki Samurai compact short-wheelbase two-door off-road SUV with solid hardtop, classic early-1990s body style",
  },
  {
    nombre: "F-150",
    slug: "f-150",
    descripcion:
      "Ford F-150 full-size extended-cab pickup, late-1990s to early-2000s rounded body style",
  },
  {
    nombre: "L200",
    slug: "l200",
    descripcion:
      "Mitsubishi L200 double-cab pickup, fourth-generation late-2000s body style",
  },
  {
    nombre: "Cheyenne",
    slug: "cheyenne",
    descripcion:
      "Chevrolet Cheyenne full-size single-cab pickup with long bed, classic early-1990s GMT400 body style",
  },
  {
    nombre: "Super Duty",
    slug: "super-duty",
    descripcion:
      "Ford F-350 Super Duty full-size crew-cab heavy-duty pickup, early-2000s body style",
  },
  {
    nombre: "Tritón",
    slug: "triton",
    descripcion:
      "Ford F-350 Triton full-size single-cab work pickup, early-2000s Super Duty body style",
  },
] as const;
function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const ejemplosMarca: Record<string, string> = {
  ford: "Fiesta",
  toyota: "Hilux",
  chevrolet: "Aveo",
  "isuzu chevrolet": "NPR",
  isuzu: "NPR",
  mazda: "BT-50",
  mitsubishi: "L200",
  suzuki: "Samurai",
};
export function referenciaVehiculo(nombre: string) {
  const key = normalizar(nombre).replace(/ sin modelo$/, "");
  const ejemplo = ejemplosMarca[key];
  const aliases: Record<string, string> = {
    "4runner": "Runner",
    "4 runner": "Runner",
    "toyota 4runner": "Runner",
    dmax: "D-Max",
    "fiesta power": "Fiesta",
  };
  const buscado = normalizar(ejemplo || aliases[key] || nombre);
  const item = coleccionVehiculos.find(
    (v) =>
      normalizar(v.nombre) === buscado ||
      normalizar(v.descripcion.split(",")[0]) === buscado,
  );
  return item
    ? {
        src: "/vehiculos/" + item.slug + ".png",
        modelo: item.nombre,
        ejemploMarca: Boolean(ejemplo),
      }
    : null;
}
